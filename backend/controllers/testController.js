const Test = require("../models/Test");
const TestResult = require("../models/TestResult");
const User = require("../models/user");
const Course = require("../models/course");
const Category = require("../models/category");
const jwt = require("jsonwebtoken");
const {
  checkCourseEligibility,
} = require("../services/testEligibilityService");
const {
  extractJSON,
  fixQuestions: validateQuestions,
} = require("../utils/aiHelper");
const mailSender = require("../utils/mailSender");
const { newTestNotificationEmail } = require("../mail/templates/newTestNotification");

const DEFAULT_TEST_DURATION_SECONDS = 10 * 60;
const FINALIZED_TEST_STATUSES = ["COMPLETED", "CHEATED"];

const VIOLATION_WEIGHTS = {
  COPY: 2, PASTE: 2, RIGHT_CLICK: 2, KEYBOARD_SHORTCUT: 2, FULLSCREEN_EXIT: 2, 
  TAB_SWITCH: 2, WINDOW_BLUR: 2, DEVTOOLS: 2, LOOKING_AWAY: 2,
  FACE_MISSING: 10, CAMERA_OBSTRUCTED: 10, CAMERA_DISABLED: 10, FACE_TOO_FAR: 10,
  MULTIPLE_FACES: 25, MIC_ACTIVITY: 25,
};

const getTestTimeLimit = (test) => {
  const limit = test?.timeLimitSeconds;
  return Number.isInteger(limit) && limit > 0
    ? limit
    : DEFAULT_TEST_DURATION_SECONDS;
};

const isMeaningfulFinalizedAttempt = (result) => {
  if (!FINALIZED_TEST_STATUSES.includes(result?.status)) return false;
  if (result.status === "CHEATED") return true;
  if (result.passed === true) return true;
  if ((result.totalQuestions || 0) > 0) return true;
  if ((result.timeTakenSeconds || 0) > 0 && (result.studentAnswers?.length || 0) > 0) return true;
  if ((result.codingSubmissions?.length || 0) > 0) return true;
  return false;
};

const isEmptyPreflightAttempt = (result) =>
  result?.status === "IN_PROGRESS" &&
  result.startedByStudent !== true &&
  (result.studentAnswers?.length || 0) === 0 &&
  (result.codingSubmissions?.length || 0) === 0 &&
  (result.violationLogs?.length || 0) === 0 &&
  (result.tabSwitchCount || 0) === 0;

const buildAttemptSession = ({
  testId,
  userId,
  deviceId = "",
  timeLimitSeconds,
  startTime = Date.now(),
}) => {
  const allowedTimeSeconds =
    Number.isInteger(timeLimitSeconds) && timeLimitSeconds > 0
      ? timeLimitSeconds
      : DEFAULT_TEST_DURATION_SECONDS;

  const attemptSessionToken = jwt.sign(
    {
      type: "test-attempt",
      testId: testId.toString(),
      userId: userId.toString(),
      deviceId,
      startTime,
      allowedTimeSeconds,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: allowedTimeSeconds + 300,
    },
  );

  return {
    attemptSessionToken,
    startTime,
    allowedTimeSeconds,
  };
};

const shuffleArray = (arr = []) =>
  arr
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);

const buildQuestionSnapshot = (questions = []) =>
  shuffleArray(questions).map((q) => {
    // Handle both legacy (embedded) and new (populated mcqId) formats
    const questionText = q.mcqId?.question || q.question;
    const rawOptions = q.mcqId?.options || q.options || [];
    const correctIdx = q.mcqId?.correctAnswer !== undefined ? q.mcqId.correctAnswer : q.correctAnswer;

    const correctOptionValue = rawOptions[correctIdx];
    const shuffledOptions = shuffleArray([...rawOptions]);

    return {
      // Persist the reference ID (new tests) for fast O(1) topic lookup in analysis
      mcqId: q.mcqId?._id || q.mcqId || null,
      question: questionText,
      options: shuffledOptions,
      correctAnswer: shuffledOptions.indexOf(correctOptionValue),
    };
  });

const sanitizeQuestionsForClient = (questions = []) =>
  questions.map((question) => ({
    question: question.question,
    options: question.options,
  }));

const buildTestPayload = (test, questionSource = test.questions) => {
  const isCoding = test.testType === "CODING";

  // For CODING tests, questions already carry full populated problem data
  // Just pass them through; sanitization only strips answers from MCQ
  const sanitizedQuestions = isCoding
    ? (questionSource || []).map((q) => ({
        problemId: q.problemId,
        type: q.type || "CODING",
      }))
    : sanitizeQuestionsForClient(questionSource);

  return {
    _id: test._id,
    title: test.title,
    testType: test.testType || "MCQ",
    questions: sanitizedQuestions,
    allowedTimeSeconds: getTestTimeLimit(test),
    maxAttempts: test.maxAttempts || 2,
    timeLimitSeconds: getTestTimeLimit(test),
  };
};

const createTest = async (req, res) => {
  try {
    console.log("===== CREATE TEST START =====");

    const {
      title,
      courseId,
      sectionId,
      questions,
      passingScore,
      totalMarks,
      maxAttempts,
      timeLimitSeconds,
      testType = "MCQ",
    } = req.body;

    if (!sectionId) {
      return res
        .status(400)
        .json({ success: false, error: "sectionId is required" });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: "Title is required",
      });
    }

    if (!courseId) {
      return res.status(400).json({
        success: false,
        error: "courseId is required",
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one question is required",
      });
    }

    if (testType === "MCQ") {
      if (questions.length < 1 || questions.length > 50) {
        return res.status(400).json({ success: false, error: "MCQ test must contain between 1 and 50 questions" });
      }
    } else if (testType === "CODING") {
      if (questions.length < 1 || questions.length > 5) {
        return res.status(400).json({ success: false, error: "Coding test must contain between 1 and 5 problems" });
      }
    }

    const course = await Course.findById(courseId).populate("category");
    if (!course) {
      return res.status(400).json({ success: false, error: "Course not found" });
    }
    const courseTopic = course.category?.name || "Uncategorized";

    let finalQuestions = [];

    if (testType === "MCQ") {
      // Isolate new inline manually/AI added questions to validate
      const newInline = questions.filter((q) => !q.mcqId);
      const validatedInline = validateQuestions(newInline);

      if (validatedInline.length !== newInline.length) {
        return res.status(400).json({
          success: false,
          error:
            "All new questions must have exactly 4 options and a valid correctAnswer (0-3)",
        });
      }

      const MCQQuestion = require("../models/MCQQuestion");

      // Batch query existing MCQ refs — avoids N+1 DB calls
      const existingMcqIds = questions
        .filter((q) => q.mcqId)
        .map((q) => q.mcqId);
      const existingMcqs = await MCQQuestion.find({
        _id: { $in: existingMcqIds },
      });
      const mcqMap = new Map(existingMcqs.map((m) => [m._id.toString(), m]));

      for (const q of questions) {
        if (q.mcqId) {
          const mcq = mcqMap.get(q.mcqId.toString());
          if (!mcq)
            return res
              .status(400)
              .json({ success: false, error: `MCQ not found: ${q.mcqId}` });
          finalQuestions.push({ type: "MCQ", mcqId: mcq._id });
        } else {
          // Auto-save inline (manual/AI) MCQs into MCQQuestion collection
          const newMcq = await MCQQuestion.create({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            topic: q.topic || courseTopic,
          });
          finalQuestions.push({ type: "MCQ", mcqId: newMcq._id });
        }
      }
    } else if (testType === "CODING") {
      const Problem = require("../models/Problem");

      // Batch query problems — avoids N+1 DB calls
      const problemIds = questions.map(q => q.problemId).filter(Boolean);
      const problems = await Problem.find({ _id: { $in: problemIds } });
      const problemMap = new Map(problems.map(p => [p._id.toString(), p]));

      for (const q of questions) {
        if (!q.problemId) return res.status(400).json({ success: false, error: "problemId is missing" });
        const problem = problemMap.get(q.problemId.toString());
        if (!problem) return res.status(400).json({ success: false, error: `Coding problem not found: ${q.problemId}` });
        finalQuestions.push({ type: "CODING", problemId: problem._id });
      }
    }

    if (
      maxAttempts !== undefined &&
      (!Number.isInteger(maxAttempts) || maxAttempts < 1)
    ) {
      return res.status(400).json({
        success: false,
        error: "maxAttempts must be an integer greater than or equal to 1",
      });
    }

    if (
      timeLimitSeconds !== undefined &&
      (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 60)
    ) {
      return res.status(400).json({
        success: false,
        error: "timeLimitSeconds must be an integer >= 60 (1 minute minimum)",
      });
    }

    const test = await Test.create({
      title: title.trim(),
      testType,
      isLegacy: false,
      timeLimitSeconds:
        Number.isInteger(timeLimitSeconds) && timeLimitSeconds >= 60
          ? timeLimitSeconds
          : DEFAULT_TEST_DURATION_SECONDS,
      maxAttempts: Number.isInteger(maxAttempts) ? maxAttempts : 2,
      passingScore: typeof passingScore === "number" ? passingScore : 0,
      totalMarks:
        typeof totalMarks === "number" ? totalMarks : finalQuestions.length,
      courseId,
      sectionId,
      questions: finalQuestions,
      createdBy: req.user.id,
    });

    // ================ NOTIFICATION FEATURE ================
    try {
      // Find all enrolled students and their details
      const enrolledStudents = await User.find({
        _id: { $in: course.studentsEnrolled }
      }).select("email firstName");

      if (enrolledStudents.length > 0) {
        console.log(`Sending new test notifications to ${enrolledStudents.length} students`);
        
        // Get instructor details
        const instructor = await User.findById(req.user.id);

        // Sequential email sending to avoid rate limits
        for (const student of enrolledStudents) {
          try {
            const emailBody = newTestNotificationEmail(
              course.courseName,
              test.title,
              `${instructor.firstName} ${instructor.lastName}`
            );
            await mailSender(
              student.email,
              `📝 New Test Available: ${test.title} in ${course.courseName}`,
              emailBody
            );
            // Configurable delay between emails (default 100ms)
            const delayMs = process.env.MAIL_DELAY_MS ? parseInt(process.env.MAIL_DELAY_MS) : 100;
            await new Promise(resolve => setTimeout(resolve, delayMs));
          } catch (err) {
            console.error(`[Notification] Test notification FAILED for ${student.email}:`, err.message);
          }
        }
        console.log("All test notifications processed");
      }
    } catch (err) {
      console.log("Error while sending test notifications:", err);
      // Don't fail the response if email fails
    }

    return res.status(201).json({
      success: true,
      message: "Test created",
      test,
      quiz: test,
    });
  } catch (error) {
    console.error("CREATE TEST ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getTestsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const tests = await Test.find({ courseId }).select(
      "title timeLimitSeconds maxAttempts totalMarks createdAt questions sectionId",
    );

    return res.json({
      success: true,
      tests: tests.map((t) => ({
        _id: t._id,
        title: t.title,
        timeLimitSeconds: getTestTimeLimit(t),
        maxAttempts: t.maxAttempts || 2,
        totalMarks: t.totalMarks || t.questions?.length || 0,
        questionCount: t.questions?.length || 0,
        createdAt: t.createdAt,
        sectionId: t.sectionId ? t.sectionId.toString() : null,
      })),
    });
  } catch (error) {
    console.error("GET TESTS BY COURSE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getTestById = async (req, res) => {
  try {
    const testId = req.params.id;
    const deviceId =
      typeof req.query?.deviceId === "string" ? req.query.deviceId.trim() : "";
    const test = await Test.findById(testId);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: "Test not found",
      });
    }

    // For CODING tests — populate the full problem document into each question ref
    const isCoding = test.testType === "CODING";
    let populatedTest = test;
    if (isCoding) {
      populatedTest = await Test.findById(testId).populate({
        path: "questions.problemId",
        select: "title difficulty topic description exampleInput exampleOutput constraints starterCode",
      });
    } else {
      // For MCQ tests - populate mcqId to get question text and options
      populatedTest = await Test.findById(testId).populate("questions.mcqId");
    }


    // Allow instructor who created the test or Admin to view it
    const isInstructor = req.user?.accountType === "Instructor";
    const isAdmin = req.user?.accountType === "Admin";

    if (isInstructor || isAdmin) {
      const isCreator = test.createdBy && test.createdBy.toString() === req.user.id;
      
      if (!isCreator && !isAdmin) {
        console.warn("[GetTestById] Instructor Authorization Failed:", { 
          userId: req.user.id, 
          creatorId: test.createdBy,
          testId: test._id 
        });
        return res.status(403).json({
          success: false,
          error: "You are not authorized to access this test",
        });
      }

      // Return full test data for instructor/admin
      return res.json({
        success: true,
        test: populatedTest,
        quiz: populatedTest,
      });
    }

    // For students — check enrollment
    if (req.user?.accountType !== "Student") {
      console.warn("[GetTestById] Non-Student Access Denied:", { 
        userId: req.user.id, 
        accountType: req.user?.accountType 
      });
      return res.status(403).json({
        success: false,
        error:
          "Only enrolled students or the test creator can access this test",
      });
    }

    const userCourses = await User.findById(req.user.id).select("courses");
    const isEnrolled = userCourses?.courses?.some(
      (courseId) => courseId.toString() === test.courseId.toString(),
    );

    const course = await Course.findById(test.courseId);
    const isCourseInstructor = course?.instructor?.toString() === req.user.id;

    if (!isEnrolled && !isCourseInstructor) {
      console.warn("[GetTestById] Access Denied (Not Enrolled & Not Instructor):", { 
        userId: req.user.id, 
        courseId: test.courseId,
        isEnrolled,
        isCourseInstructor
      });
      return res.status(403).json({
        success: false,
        error: "You are not authorized to access this test. Please enroll in the course first.",
      });
    }

    let existingResult = await TestResult.findOne({
      studentId: req.user.id,
      $or: [{ testId: test._id }, { quizId: test._id }],
    })
      .populate("codingSubmissions.problemId", "title difficulty")
      .sort({ attemptNumber: -1 });

    if (isEmptyPreflightAttempt(existingResult)) {
      existingResult.status = "COMPLETED";
      existingResult.timeTakenSeconds = 0;
      existingResult.totalQuestions = 0;
      existingResult.lastAttemptSessionToken = "";
      await existingResult.save();
      existingResult = null;
    }

    const maxAttempts = test.maxAttempts || 2;
    const timeLimitSecs = getTestTimeLimit(test);
    const finalizedAttempts = await TestResult.find({
      studentId: req.user.id,
      $or: [{ testId: test._id }, { quizId: test._id }],
      status: { $in: FINALIZED_TEST_STATUSES },
    }).select("status passed totalQuestions timeTakenSeconds studentAnswers codingSubmissions attemptNumber questionSnapshot");
    let meaningfulFinalizedAttempts = finalizedAttempts.filter(isMeaningfulFinalizedAttempt);
    let hasPassedAttempt = meaningfulFinalizedAttempts.some((result) => result.passed === true);

    // Close abandoned attempt
    if (existingResult?.status === "IN_PROGRESS" && existingResult.startedAt) {
      const elapsed = Math.floor(
        (Date.now() - new Date(existingResult.startedAt).getTime()) / 1000
      );
      if (elapsed > timeLimitSecs + 60) {
        existingResult.status = "COMPLETED";
        existingResult.score = 0;
        existingResult.passed = false;
        existingResult.suspicious = false;
        existingResult.eligibleForCertificate = false;
        existingResult.timeTakenSeconds = elapsed;
        existingResult.totalQuestions =
          existingResult.totalQuestions ||
          (isCoding
            ? populatedTest.questions?.length || 0
            : existingResult.questionSnapshot?.length || populatedTest.questions?.length || 0);
        await existingResult.save();

        const alreadyTracked = meaningfulFinalizedAttempts.some(
          (attempt) => attempt._id?.toString() === existingResult._id.toString(),
        );
        if (isMeaningfulFinalizedAttempt(existingResult) && !alreadyTracked) {
          meaningfulFinalizedAttempts = [...meaningfulFinalizedAttempts, existingResult];
          hasPassedAttempt = meaningfulFinalizedAttempts.some((result) => result.passed === true);
        }
      }
    }

    if (hasPassedAttempt || meaningfulFinalizedAttempts.length >= maxAttempts) {
      const previousCandidate =
        meaningfulFinalizedAttempts.sort((a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0))[0] ||
        existingResult;
      const previousResult = previousCandidate?._id
        ? await TestResult.findById(previousCandidate._id).populate("codingSubmissions.problemId", "title difficulty")
        : previousCandidate;
      if (previousResult) {
        const testPayload = buildTestPayload(
          populatedTest,
          isCoding
            ? populatedTest.questions
            : previousResult.questionSnapshot?.length
            ? previousResult.questionSnapshot
            : populatedTest.questions,
        );
        return res.json({
          success: true,
          canAttempt: false,
          previousResult,
          test: testPayload,
          quiz: testPayload,
        });
      }
    }

    if (existingResult?.status === "IN_PROGRESS") {
      if (existingResult.deviceId && existingResult.deviceId !== deviceId) {
        return res.status(403).json({
          success: false,
          message: "Exam already active on another device",
        });
      }

      if (!existingResult.deviceId && deviceId) {
        existingResult.deviceId = deviceId;
        await existingResult.save();
      }

      if (!isCoding && !existingResult.questionSnapshot?.length) {
        return res.status(409).json({
          success: false,
          message: "Active attempt snapshot missing",
        });
      }

      const startTime = existingResult.startedAt
        ? new Date(existingResult.startedAt).getTime()
        : Date.now();
      let attemptSessionToken = existingResult.lastAttemptSessionToken;

      if (!attemptSessionToken) {
        const session = buildAttemptSession({
          testId: test._id,
          userId: req.user.id,
          deviceId: existingResult.deviceId || deviceId,
          timeLimitSeconds: timeLimitSecs,
          startTime,
        });
        attemptSessionToken = session.attemptSessionToken;
        existingResult.lastAttemptSessionToken = attemptSessionToken;
        await existingResult.save();
      }

      // CODING tests: don't use snapshot (problems are fetched live with populate)
      const testPayload = isCoding
        ? buildTestPayload(populatedTest, populatedTest.questions)
        : buildTestPayload(test, existingResult.questionSnapshot);

      return res.json({
        success: true,
        canAttempt: true,
        activeAttempt: true,
        test: testPayload,
        quiz: testPayload,
        attemptSessionToken,
        startTime,
        allowedTimeSeconds: timeLimitSecs,
        codingSubmissions: existingResult.codingSubmissions || [],
      });
    }

    // Fresh attempts start only after the student completes the pre-flight checks.
    const testPayload = isCoding
      ? buildTestPayload(populatedTest, populatedTest.questions)
      : buildTestPayload(populatedTest, populatedTest.questions);

    return res.json({
      success: true,
      canAttempt: true,
      activeAttempt: false,
      test: testPayload,
      quiz: testPayload,
      allowedTimeSeconds: timeLimitSecs,
    });
  } catch (error) {
    console.error("GET TEST BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const startTestAttempt = async (req, res) => {
  try {
    const testId = req.params.id || req.body?.testId || req.body?.quizId;
    const deviceId =
      typeof req.body?.deviceId === "string" ? req.body.deviceId.trim() : "";

    const test = await Test.findById(testId);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: "Test not found",
      });
    }

    if (req.user?.accountType !== "Student") {
      return res.status(403).json({
        success: false,
        error: "Only enrolled students can start this test",
      });
    }

    const userCourses = await User.findById(req.user.id).select("courses");
    const isEnrolled = userCourses?.courses?.some(
      (courseId) => courseId.toString() === test.courseId.toString(),
    );

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to access this test. Please enroll in the course first.",
      });
    }

    let existingResult = await TestResult.findOne({
      studentId: req.user.id,
      $or: [{ testId: test._id }, { quizId: test._id }],
    }).sort({ attemptNumber: -1 });

    if (isEmptyPreflightAttempt(existingResult)) {
      existingResult.status = "COMPLETED";
      existingResult.timeTakenSeconds = 0;
      existingResult.totalQuestions = 0;
      existingResult.lastAttemptSessionToken = "";
      await existingResult.save();
      existingResult = null;
    }

    const maxAttempts = test.maxAttempts || 2;
    const timeLimitSecs = getTestTimeLimit(test);
    const isCoding = test.testType === "CODING";

    if (existingResult?.status === "IN_PROGRESS" && existingResult.startedAt) {
      const elapsed = Math.floor(
        (Date.now() - new Date(existingResult.startedAt).getTime()) / 1000,
      );
      if (elapsed > timeLimitSecs + 60) {
        existingResult.status = "COMPLETED";
        existingResult.score = 0;
        existingResult.passed = false;
        existingResult.suspicious = false;
        existingResult.eligibleForCertificate = false;
        existingResult.timeTakenSeconds = elapsed;
        existingResult.totalQuestions =
          existingResult.totalQuestions ||
          (isCoding ? test.questions?.length || 0 : existingResult.questionSnapshot?.length || test.questions?.length || 0);
        existingResult.startedByStudent = true;
        await existingResult.save();
        existingResult = null;
      }
    }

    const finalizedAttempts = await TestResult.find({
      studentId: req.user.id,
      $or: [{ testId: test._id }, { quizId: test._id }],
      status: { $in: FINALIZED_TEST_STATUSES },
    }).select("status passed totalQuestions timeTakenSeconds studentAnswers codingSubmissions attemptNumber");
    const meaningfulFinalizedAttempts = finalizedAttempts.filter(isMeaningfulFinalizedAttempt);
    const hasPassedAttempt = meaningfulFinalizedAttempts.some((result) => result.passed === true);
    const latestMeaningfulAttempt = meaningfulFinalizedAttempts
      .sort((a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0))[0];
    const blockedPreviousResult = latestMeaningfulAttempt?._id
      ? await TestResult.findById(latestMeaningfulAttempt._id).populate("codingSubmissions.problemId", "title difficulty")
      : null;

    if (hasPassedAttempt) {
      return res.status(409).json({
        success: false,
        canAttempt: false,
        reason: "PASSED",
        message: "Test already passed",
        previousResult: blockedPreviousResult,
      });
    }

    if (meaningfulFinalizedAttempts.length >= maxAttempts) {
      return res.status(409).json({
        success: false,
        canAttempt: false,
        reason: "MAX_ATTEMPTS",
        message: "You have reached maximum attempts",
        previousResult: blockedPreviousResult,
      });
    }

    if (existingResult?.status === "IN_PROGRESS") {
      if (existingResult.deviceId && existingResult.deviceId !== deviceId) {
        return res.status(403).json({
          success: false,
          message: "Exam already active on another device",
        });
      }

      if (existingResult.startedByStudent !== true) {
        existingResult.startedByStudent = true;
        await existingResult.save();
      }

      const resumedStartTime = existingResult.startedAt
        ? new Date(existingResult.startedAt).getTime()
        : Date.now();

      if (!existingResult.lastAttemptSessionToken) {
        const session = buildAttemptSession({
          testId: test._id,
          userId: req.user.id,
          deviceId: existingResult.deviceId || deviceId,
          timeLimitSeconds: timeLimitSecs,
          startTime: resumedStartTime,
        });
        existingResult.lastAttemptSessionToken = session.attemptSessionToken;
        existingResult.deviceId = existingResult.deviceId || deviceId;
        await existingResult.save();
      }

      const populatedTest = isCoding
        ? await Test.findById(testId).populate({
            path: "questions.problemId",
            select: "title difficulty topic description exampleInput exampleOutput constraints starterCode",
          })
        : test;

      const testPayload = isCoding
        ? buildTestPayload(populatedTest, populatedTest.questions)
        : buildTestPayload(test, existingResult.questionSnapshot);

      return res.json({
        success: true,
        activeAttempt: true,
        test: testPayload,
        quiz: testPayload,
        attemptSessionToken: existingResult.lastAttemptSessionToken,
        startTime: resumedStartTime,
        allowedTimeSeconds: timeLimitSecs,
      });
    }

    let populatedTest = test;
    if (isCoding) {
      populatedTest = await Test.findById(testId).populate({
        path: "questions.problemId",
        select: "title difficulty topic description exampleInput exampleOutput constraints starterCode",
      });
    } else {
      populatedTest = await Test.findById(testId).populate("questions.mcqId");
    }

    const startTime = Date.now();
    const session = buildAttemptSession({
      testId: test._id,
      userId: req.user.id,
      deviceId,
      timeLimitSeconds: timeLimitSecs,
      startTime,
    });

    const questionSnapshot = isCoding
      ? []
      : buildQuestionSnapshot(populatedTest.questions);

    const nextAttemptNumber = meaningfulFinalizedAttempts.length + 1;

    await TestResult.create({
      testId: test._id,
      quizId: test._id,
      studentId: req.user.id,
      status: "IN_PROGRESS",
      startedAt: startTime,
      timeLimitSeconds: timeLimitSecs,
      lastAttemptSessionToken: session.attemptSessionToken,
      deviceId,
      startedByStudent: true,
      attemptNumber: nextAttemptNumber,
      questionSnapshot,
    });

    const testPayload = isCoding
      ? buildTestPayload(populatedTest, populatedTest.questions)
      : buildTestPayload(test, questionSnapshot);

    return res.json({
      success: true,
      activeAttempt: true,
      test: testPayload,
      quiz: testPayload,
      attemptSessionToken: session.attemptSessionToken,
      startTime,
      allowedTimeSeconds: timeLimitSecs,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const activeAttempt = await TestResult.findOne({
        studentId: req.user.id,
        $or: [{ testId: req.params.id }, { quizId: req.params.id }],
        status: "IN_PROGRESS",
      }).sort({ attemptNumber: -1 });

      if (activeAttempt) {
        if (activeAttempt.deviceId && activeAttempt.deviceId !== req.body?.deviceId?.trim?.()) {
          return res.status(403).json({
            success: false,
            message: "Exam already active on another device",
          });
        }

        const activeTest = await Test.findById(req.params.id);
        const isCoding = activeTest?.testType === "CODING";
        const populatedTest = isCoding
          ? await Test.findById(req.params.id).populate({
              path: "questions.problemId",
              select: "title difficulty topic description exampleInput exampleOutput constraints starterCode",
            })
          : activeTest;
        const testPayload = populatedTest
          ? isCoding
            ? buildTestPayload(populatedTest, populatedTest.questions)
            : buildTestPayload(populatedTest, activeAttempt.questionSnapshot)
          : null;

        return res.json({
          success: true,
          activeAttempt: true,
          ...(testPayload ? { test: testPayload, quiz: testPayload } : {}),
          attemptSessionToken: activeAttempt.lastAttemptSessionToken,
          startTime: activeAttempt.startedAt
            ? new Date(activeAttempt.startedAt).getTime()
            : Date.now(),
          allowedTimeSeconds:
            activeAttempt.timeLimitSeconds > 0
              ? activeAttempt.timeLimitSeconds
              : DEFAULT_TEST_DURATION_SECONDS,
        });
      }
    }

    console.error("START TEST ATTEMPT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const deleteTest = async (req, res) => {
  try {
    const testId = req.params.id;
    const test = await Test.findById(testId);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: "Test not found",
      });
    }

    if (test.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to delete this test",
      });
    }

    // Delete the test and all associated results
    await TestResult.deleteMany({ testId: test._id });
    await Test.findByIdAndDelete(testId);

    return res.json({
      success: true,
      message: "Test deleted successfully",
    });
  } catch (error) {
    console.error("DELETE TEST ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const generateAITest = async (req, res) => {
  try {
    const { topic, count } = req.body;

    // Input validation
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({
        success: false,
        error: "Topic is required and must be a non-empty string",
      });
    }

    const questionCount = Number(count);
    if (
      !Number.isInteger(questionCount) ||
      questionCount < 1 ||
      questionCount > 50
    ) {
      return res.status(400).json({
        success: false,
        error: "Count must be an integer between 1 and 50",
      });
    }

    const prompt = `
Generate ${questionCount} MCQ questions on "${topic.trim()}".

STRICT RULES:
- Return ONLY valid JSON
- No explanation, no markdown
- Each question MUST have exactly 4 options
- correctAnswer MUST be a NUMBER (0, 1, 2, or 3)
- correctAnswer MUST match the correct option index

Format:
[
  {
    "question": "string",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0
  }
]
`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [{ role: "user", content: prompt }],
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "OPENROUTER API ERROR:",
        response.status,
        response.statusText,
      );
      return res.status(502).json({
        success: false,
        error: "AI service returned an error. Please try again.",
      });
    }

    const data = await response.json();
    console.log("OPENROUTER RESPONSE:", data);
    const rawText = data.choices?.[0]?.message?.content || "";
    console.log("RAW TEXT EXTRACTED:", rawText);
    let questions = extractJSON(rawText);
    questions = validateQuestions(questions);
    console.log("VALIDATED QUESTIONS COUNT:", questions.length);

    if (!questions.length) {
      return res.status(422).json({
        success: false,
        error: "AI did not return valid questions",
      });
    }

    return res.json({
      success: true,
      questions,
    });
  } catch (error) {
    console.error("AI TEST GENERATION ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const submitTest = async (req, res) => {
  try {
    const {
      quizId,
      testId,
      answers,
      tabSwitchCount,
      integrityScore,
      violationLogs,
      attemptSessionToken,
      deviceId,
    } = req.body;
    
    const effectiveTestId = testId || quizId;
    const normalizedDeviceId = typeof deviceId === "string" ? deviceId.trim() : "";

    if (!attemptSessionToken) {
      return res.status(400).json({
        success: false,
        message: "Attempt session missing",
      });
    }

    const normalizedTabSwitchCount =
      typeof tabSwitchCount === "number" && tabSwitchCount >= 0
        ? tabSwitchCount
        : 0;

    const normalizedIntegrityScore =
      typeof integrityScore === "number" ? Math.max(0, Math.min(100, integrityScore)) : 100;
    
    const effectiveIntegrity = normalizedIntegrityScore;

    const safeLogs = Array.isArray(violationLogs)
      ? violationLogs
          .filter((entry) => entry && typeof entry.type === "string")
          .map((entry) => ({
            type: entry.type,
            timestamp: entry.timestamp || entry.time || new Date().toISOString(),
            weight:
              typeof entry.weight === "number"
                ? entry.weight
                : VIOLATION_WEIGHTS[entry.type] || 0,
          }))
      : [];

    let verifiedAttemptSession;

    try {
      verifiedAttemptSession = jwt.verify(
        attemptSessionToken,
        process.env.JWT_SECRET,
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Attempt session expired or invalid",
      });
    }

    const test = await Test.findById(effectiveTestId).populate("questions.problemId", "title");

    if (!test) {
      return res.status(404).json({
        success: false,
        error: "Test not found",
      });
    }


    if (
      verifiedAttemptSession?.type !== "test-attempt" ||
      verifiedAttemptSession?.userId !== req.user.id ||
      verifiedAttemptSession?.testId !== effectiveTestId.toString()
    ) {
      console.warn("[SubmitTest] Session Mismatch:", { 
        sessionUser: verifiedAttemptSession?.userId, 
        reqUser: req.user.id, 
        sessionTest: verifiedAttemptSession?.testId, 
        reqTest: effectiveTestId.toString() 
      });
      return res.status(403).json({
        success: false,
        message: "Invalid attempt session",
      });
    }

    if (verifiedAttemptSession?.deviceId !== normalizedDeviceId) {
      console.warn("[SubmitTest] Device Mismatch:", { 
        sessionDevice: verifiedAttemptSession?.deviceId, 
        reqDevice: normalizedDeviceId 
      });
      return res.status(403).json({
        success: false,
        message: "Invalid exam session",
      });
    }

    const allowedTimeSeconds =
      Number.isInteger(verifiedAttemptSession?.allowedTimeSeconds) &&
      verifiedAttemptSession.allowedTimeSeconds > 0
        ? verifiedAttemptSession.allowedTimeSeconds
        : getTestTimeLimit(test);
    const startTime =
      typeof verifiedAttemptSession?.startTime === "number"
        ? verifiedAttemptSession.startTime
        : Date.now();
    const timeTaken = Math.max(Math.floor((Date.now() - startTime) / 1000), 0);

    const existingAttempt = await TestResult.findOne({
      studentId: req.user.id,
      $or: [{ testId: effectiveTestId }, { quizId: effectiveTestId }],
    }).sort({ attemptNumber: -1 });

    if (existingAttempt?.deviceId && existingAttempt.deviceId !== normalizedDeviceId) {
      return res.status(403).json({
        success: false,
        message: "Exam already active on another device",
      });
    }

    if (
      FINALIZED_TEST_STATUSES.includes(existingAttempt?.status) &&
      existingAttempt?.lastAttemptSessionToken === attemptSessionToken
    ) {
      return res.status(409).json({
        success: false,
        message: "Test already submitted",
      });
    }

    if (
      existingAttempt?.status === "IN_PROGRESS" &&
      existingAttempt?.lastAttemptSessionToken &&
      existingAttempt.lastAttemptSessionToken !== attemptSessionToken
    ) {
      return res.status(403).json({
        success: false,
        message: "Another active session detected",
      });
    }

    if (existingAttempt?.passed === true) {
      return res.status(400).json({
        success: false,
        message: "Test already passed",
      });
    }

    // Sanity-check: flag as suspicious if tab switches are implausibly high
    // relative to time spent (more than 1 switch per 30 seconds + buffer is unrealistic)
    const maxPlausibleTabSwitches = Math.ceil(timeTaken / 30) + 2;
    const isImplausiblyHigh = normalizedTabSwitchCount > maxPlausibleTabSwitches;
    const cheated = normalizedTabSwitchCount > 3;

    if (existingAttempt?.status !== "IN_PROGRESS") {
      return res.status(400).json({
        success: false,
        message: "No active attempt found",
      });
    }

    const isCoding = test.testType === "CODING" || test.type === "CODING";

    if (!isCoding && !existingAttempt.questionSnapshot?.length) {
      return res.status(400).json({
        success: false,
        message: "Attempt questions unavailable",
      });
    }

    if (existingAttempt.attemptNumber > (test.maxAttempts || 2)) {
      return res.status(400).json({
        success: false,
        message: "You have reached maximum attempts",
      });
    }

    const activeQuestions = existingAttempt.questionSnapshot || [];
    let totalQuestions = activeQuestions.length;
    const NETWORK_LATENCY_BUFFER = 60; // 60-second grace period for network delays
    if (timeTaken > allowedTimeSeconds + NETWORK_LATENCY_BUFFER) {
      const result = await TestResult.findOneAndUpdate(
        {
          studentId: req.user.id,
          $or: [{ testId: effectiveTestId }, { quizId: effectiveTestId }],
          status: "IN_PROGRESS",
        },
        {
          $set: {
            status: "COMPLETED",
            score: 0,
            totalQuestions,
            timeTakenSeconds: timeTaken,
            lastAttemptSessionToken: attemptSessionToken,
            deviceId: existingAttempt.deviceId || normalizedDeviceId,
            attemptNumber: existingAttempt.attemptNumber,
            tabSwitchCount: normalizedTabSwitchCount,
            integrityScore: effectiveIntegrity,
            violationLogs: Array.isArray(violationLogs) ? violationLogs : [],
            suspicious: effectiveIntegrity < 65,
            passed: false,
            eligibleForCertificate: false,
            studentAnswers: [],
          },
        },
        { new: true },
      );

      if (!result) {
        return res.status(400).json({
          success: false,
          message: "No active attempt found",
        });
      }

      const { eligible: courseEligible, reason: courseEligibilityReason } = await checkCourseEligibility(
        req.user.id,
        test.courseId,
      );
      const attemptsLeft = Math.max(
        (test.maxAttempts || 2) - result.attemptNumber,
        0,
      );

      return res.json({
        success: true,
        message: "Time limit exceeded",
        cheated: false,
        score: 0,
        passed: false,
        attemptsLeft,
        courseEligible,
        courseEligibilityReason,
        percentage: 0,
        timeTaken,
        allowedTimeSeconds,
        attemptNumber: result.attemptNumber,
        tabSwitchCount: result.tabSwitchCount,
        integrityScore: result.integrityScore,
        suspicious: result.suspicious,
        eligibleForCertificate: false,
        total: totalQuestions,
        resultId: result._id,
        details: [],
      });
    }

    if (cheated) {
      const result = await TestResult.findOneAndUpdate(
        {
          studentId: req.user.id,
          $or: [{ testId: effectiveTestId }, { quizId: effectiveTestId }],
          status: "IN_PROGRESS",
        },
        {
          $set: {
            status: "CHEATED",
            score: 0,
            totalQuestions,
            timeTakenSeconds: timeTaken,
            lastAttemptSessionToken: attemptSessionToken,
            deviceId: existingAttempt.deviceId || normalizedDeviceId,
            attemptNumber: existingAttempt.attemptNumber,
            tabSwitchCount: normalizedTabSwitchCount,
            integrityScore: effectiveIntegrity,
            violationLogs: Array.isArray(violationLogs) ? violationLogs : [],
            suspicious: true,
            passed: false,
            eligibleForCertificate: false,
            studentAnswers: [],
          },
        },
        { new: true },
      );

      if (!result) {
        return res.status(400).json({
          success: false,
          message: "No active attempt found",
        });
      }

      const { eligible: courseEligible, reason: courseEligibilityReason } = await checkCourseEligibility(
        req.user.id,
        test.courseId,
      );
      const attemptsLeft = Math.max(
        (test.maxAttempts || 2) - result.attemptNumber,
        0,
      );

      return res.json({
        success: true,
        message: "Test auto-submitted due to suspicious activity",
        score: 0,
        passed: false,
        cheated: true,
        attemptsLeft,
        courseEligible,
        courseEligibilityReason,
        percentage: 0,
        timeTaken,
        allowedTimeSeconds,
        attemptNumber: result.attemptNumber,
        tabSwitchCount: result.tabSwitchCount,
        integrityScore: result.integrityScore,
        suspicious: true,
        eligibleForCertificate: false,
        total: totalQuestions,
        resultId: result._id,
        details: [],
      });
    }

    let score = 0;
    const details = [];
    let percentage = 0;

    if (isCoding) {
      let totalRatio = 0;
      const submissions = existingAttempt.codingSubmissions || [];

      test.questions.forEach((q) => {
        const sub = submissions.find(
          (s) =>
            s.problemId.toString() ===
            (q.problemId._id || q.problemId).toString(),
        );

        const problemTitle = q.problemId.title || "Coding Problem";

        if (sub) {
          const ratio =
            sub.totalTestCases > 0 ? sub.passedTestCases / sub.totalTestCases : 0;
          totalRatio += ratio;

          details.push({
            question: problemTitle,
            isCorrect: ratio === 1,
            passRatio: ratio,
            code: sub.code || "",
            passedTestCases: sub.passedTestCases,
            totalTestCases: sub.totalTestCases,
          });
        } else {
          details.push({
            question: problemTitle,
            isCorrect: false,
            passRatio: 0,
            code: "",
            passedTestCases: 0,
            totalTestCases: 0,
          });
        }
      });

      percentage =
        test.questions.length > 0
          ? (totalRatio / test.questions.length) * 100
          : 0;
      
      score = Number(totalRatio.toFixed(2));
      totalQuestions = test.questions.length;
    } else {
      // Default MCQ logic
      activeQuestions.forEach((question, index) => {
        const selected =
          typeof answers?.[index] === "number" ? answers[index] : null;
        const isCorrect = selected === question.correctAnswer;

        if (isCorrect) {
          score++;
        }

        details.push({
          question: question.question,
          selectedOption: selected,
          correctOption: question.correctAnswer,
          isCorrect,
        });
      });
      percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    }

    const passed = percentage >= (test.passingScore || 50); 

    // Server-Side Reality Check on Time
    // Realistic Timing Check: Question Density Audit (Item 3)
    // If student averages less than 3 seconds per question, it's implausibly fast
    const minRealisticTime = totalQuestions * 3; 
    const isImplausiblyFast = (timeTaken < minRealisticTime && totalQuestions > 3);
    const isImplausiblyLate = (timeTaken > allowedTimeSeconds + 300); // 5 minute hard grace

    // NEW: TIER 1 Backend Zero-Trust Log Scanner & Integrity Audit
    // safeLogs is already declared at the top during normalization
    
    // Independent flags derived solely from forensic logs
    let multipleFacesDetected = false;
    let cameraDisabled = false;
    let noiseDetected = false;
    let lookingAwayCount = 0;

    const recomputedPenalty = safeLogs.reduce((acc, v) => {
      // Logic fix: Ignore unknown types to avoid penalty-bypass via fake types (Item 5)
      if (!VIOLATION_WEIGHTS[v.type]) return acc;

      // 1. Re-calculate Integrity Score
      const weight = VIOLATION_WEIGHTS[v.type];
      
      // 2. Derive authoritative status flags from logs (Zero-Trust)
      if (v.type === "MULTIPLE_FACES") multipleFacesDetected = true;
      if (v.type === "CAMERA_DISABLED" || v.type === "CAMERA_OBSTRUCTED") cameraDisabled = true;
      if (v.type === "MIC_ACTIVITY") noiseDetected = true;
      if (v.type === "LOOKING_AWAY") lookingAwayCount++;

      return acc + weight;
    }, 0);

    const serverCalculatedIntegrity = Math.max(0, 100 - recomputedPenalty);
    
    // Log-Wipe Detection: If client reports many tab switches but NO logs are provided
    const isLogWipeDetected = (normalizedTabSwitchCount > 0 && safeLogs.length === 0);
    
    // Logic fix: Unify inconsistent variable names (Item 2)
    let finalIntegrity = Math.min(normalizedIntegrityScore, serverCalculatedIntegrity);

    // Hard Link: Force integrity floor if camera was disabled (Item 6)
    if (cameraDisabled) {
      finalIntegrity = Math.min(finalIntegrity, 50);
    }

    const suspicious = isImplausiblyHigh || 
                       normalizedTabSwitchCount > 5 || 
                       finalIntegrity < 65 || 
                       isImplausiblyFast || 
                       isImplausiblyLate ||
                       isLogWipeDetected;

    // Align eligibility lock with security status (Item 8)
    const eligibleForCertificate = passed === true && !suspicious;

    const result = await TestResult.findOneAndUpdate(
      {
        studentId: req.user.id,
        $or: [{ testId: effectiveTestId }, { quizId: effectiveTestId }],
        status: "IN_PROGRESS",
      },
      {
        $set: {
          status: "COMPLETED",
          score,
          totalQuestions,
          timeTakenSeconds: timeTaken,
          lastAttemptSessionToken: attemptSessionToken,
          deviceId: existingAttempt.deviceId || normalizedDeviceId,
          attemptNumber: existingAttempt.attemptNumber,
          tabSwitchCount: normalizedTabSwitchCount,
          integrityScore: finalIntegrity,
          violationLogs: safeLogs,
          multipleFacesDetected,
          cameraDisabled,
          noiseDetected,
          lookingAwayCount,
          suspicious,
          passed,
          eligibleForCertificate,
          studentAnswers: details,
        },
      },
      { new: true },
    );

    if (!result) {
      return res.status(400).json({
        success: false,
        message: "No active attempt found",
      });
    }

    const { eligible: courseEligible, reason: courseEligibilityReason } = await checkCourseEligibility(
      req.user.id,
      test.courseId,
    );
    const attemptsLeft = Math.max(
      (test.maxAttempts || 2) - result.attemptNumber,
      0,
    );

    return res.json({
      success: true,
      message: passed ? "Passed" : "Failed",
      cheated: false,
      score,
      passed,
      attemptsLeft,
      courseEligible,
      courseEligibilityReason,
      percentage,
      timeTaken,
      allowedTimeSeconds,
      attemptNumber: result.attemptNumber,
      tabSwitchCount: result.tabSwitchCount,
      integrityScore: result.integrityScore,
      suspicious: result.suspicious,
      eligibleForCertificate,
      total: totalQuestions,
      resultId: result._id,
      details,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateAttempt = await TestResult.findOne({
        studentId: req.user.id,
        $or: [
          { testId: req.body?.testId || req.body?.quizId },
          { quizId: req.body?.testId || req.body?.quizId },
        ],
      })
        .sort({ attemptNumber: -1 })
        .select("lastAttemptSessionToken");

      if (
        duplicateAttempt?.lastAttemptSessionToken &&
        duplicateAttempt.lastAttemptSessionToken ===
          req.body?.attemptSessionToken
      ) {
        return res.status(409).json({
          success: false,
          message: "Test already submitted",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Test already attempted",
      });
    }

    console.error("TEST SUBMIT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getTestSubjects = async (req, res) => {
  try {
    // Get all distinct courseIds that have tests
    const courseIds = await Test.distinct("courseId");

    // Find courses with those IDs and populate their category name
    const courses = await Course.find({ _id: { $in: courseIds } })
      .populate("category", "name")
      .select("category");

    // Extract unique category names
    const subjectSet = new Set();
    courses.forEach((course) => {
      if (course.category?.name) {
        subjectSet.add(course.category.name);
      }
    });

    const subjects = Array.from(subjectSet);

    return res.json({
      success: true,
      subjects,
    });
  } catch (error) {
    console.error("GET TEST SUBJECTS ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getTestsBySubject = async (req, res) => {
  try {
    const { subject } = req.params;

    // Find the category matching the subject name
    const category = await Category.findOne({ name: subject }).select("_id");

    if (!category) {
      return res.json({ success: true, tests: [], quizzes: [] });
    }

    // Find courses in this category
    const courses = await Course.find({ category: category._id }).select("_id");
    const courseIds = courses.map((c) => c._id);

    // Find tests for those courses
    const tests = await Test.find({ courseId: { $in: courseIds } }).select(
      "title createdAt",
    );

    return res.json({
      success: true,
      tests,
      quizzes: tests,
    });
  } catch (error) {
    console.error("GET TESTS BY SUBJECT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getStudentTestResults = async (req, res) => {
  try {
    const results = await TestResult.find({
      studentId: req.user.id,
    })
      .populate("testId", "title")
      .populate("quizId", "title")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("GET STUDENT TEST RESULTS ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  createTest,
  getTestsByCourse,
  getTestById,
  startTestAttempt,
  generateAITest,
  submitTest,
  deleteTest,
  getTestSubjects,
  getTestsBySubject,
  getStudentTestResults,

  createQuiz: createTest,
  getQuizById: getTestById,
  startQuizAttempt: startTestAttempt,
  generateAIQuiz: generateAITest,
  submitQuiz: submitTest,
  deleteQuiz: deleteTest,
  getSubjects: getTestSubjects,
  getQuizzesBySubject: getTestsBySubject,
  getStudentResults: getStudentTestResults,
};
