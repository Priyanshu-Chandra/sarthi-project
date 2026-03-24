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

const DEFAULT_TEST_DURATION_SECONDS = 10 * 60;

const getTestTimeLimit = (test) => {
  const limit = test?.timeLimitSeconds;
  return Number.isInteger(limit) && limit > 0
    ? limit
    : DEFAULT_TEST_DURATION_SECONDS;
};

const buildAttemptSession = ({ testId, userId, timeLimitSeconds, startTime = Date.now() }) => {
  const allowedTimeSeconds =
    Number.isInteger(timeLimitSeconds) && timeLimitSeconds > 0
      ? timeLimitSeconds
      : DEFAULT_TEST_DURATION_SECONDS;

  const attemptSessionToken = jwt.sign(
    {
      type: "test-attempt",
      testId: testId.toString(),
      userId: userId.toString(),
      startTime,
      allowedTimeSeconds,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: allowedTimeSeconds + 300,
    }
  );

  return {
    attemptSessionToken,
    startTime,
    allowedTimeSeconds,
  };
};

const buildTestPayload = (test) => {
  const sanitizedQuestions = test.questions.map((question) => ({
    question: question.question,
    options: question.options,
  }));

  return {
    _id: test._id,
    title: test.title,
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
    } = req.body;

    if (!sectionId) {
      return res.status(400).json({ success: false, error: "sectionId is required" });
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

    const validatedQuestions = validateQuestions(questions);

    if (validatedQuestions.length !== questions.length) {
      return res.status(400).json({
        success: false,
        error:
          "All questions must have exactly 4 options and a valid correctAnswer (0-3)",
      });
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
      timeLimitSeconds: Number.isInteger(timeLimitSeconds) && timeLimitSeconds >= 60
        ? timeLimitSeconds
        : DEFAULT_TEST_DURATION_SECONDS,
      maxAttempts: Number.isInteger(maxAttempts) ? maxAttempts : 2,
      passingScore: typeof passingScore === "number" ? passingScore : 0,
      totalMarks:
        typeof totalMarks === "number"
          ? totalMarks
          : validatedQuestions.length,
      courseId,
      sectionId,
      questions: validatedQuestions,
      createdBy: req.user.id,
    });

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
      "title timeLimitSeconds maxAttempts totalMarks createdAt questions sectionId"
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

const getTestByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const test = await Test.findOne({ courseId });

    if (!test) {
      return res.status(404).json({
        success: false,
        error: "Test not found for this course",
      });
    }

    const attemptSession = buildAttemptSession({
      testId: test._id,
      userId: req.user.id,
      timeLimitSeconds: getTestTimeLimit(test),
    });
    const testPayload = buildTestPayload(test);

    return res.json({
      success: true,
      test: testPayload,
      quiz: testPayload,
      ...attemptSession,
    });
  } catch (error) {
    console.error("GET TEST BY COURSE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getTestById = async (req, res) => {
  try {
    const testId = req.params.id;
    const test = await Test.findById(testId);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: "Test not found",
      });
    }

    // Allow instructor who created the test to view it
    if (req.user?.accountType === "Instructor") {
      if (test.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: "You are not authorized to access this test",
        });
      }

      // Return full test data for instructor (including correct answers)
      return res.json({
        success: true,
        test,
        quiz: test,
      });
    }

    // For students — check enrollment
    if (req.user?.accountType !== "Student") {
      return res.status(403).json({
        success: false,
        error: "Only enrolled students or the test creator can access this test",
      });
    }

    const student = await User.findById(req.user.id).select("courses");
    const isEnrolled = student?.courses?.some(
      (course) => course.toString() === test.courseId.toString()
    );

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to access this test",
      });
    }

    let existingResult = await TestResult.findOne({
      studentId: req.user.id,
      $or: [{ testId: test._id }, { quizId: test._id }]
    });

    const maxAttempts = test.maxAttempts || 2;
    const timeLimitSecs = getTestTimeLimit(test);

    // Close abandoned attempt
    if (existingResult?.status === "IN_PROGRESS" && existingResult.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(existingResult.startedAt).getTime()) / 1000);
      if (elapsed > timeLimitSecs + 60) {
        existingResult.status = "COMPLETED";
        existingResult.attemptNumber = (existingResult.attemptNumber || 0) + 1;
        existingResult.score = 0;
        await existingResult.save();
      }
    }

    if (existingResult?.status === "COMPLETED") {
      if (existingResult.passed || existingResult.attemptNumber >= maxAttempts) {
        const testPayload = buildTestPayload(test);
        return res.json({
          success: true,
          canAttempt: false,
          previousResult: existingResult,
          test: testPayload,
          quiz: testPayload
        });
      }
    }

    let startTime;
    let attemptSessionToken;

    if (existingResult?.status === "IN_PROGRESS") {
      startTime = existingResult.startedAt ? new Date(existingResult.startedAt).getTime() : Date.now();
      attemptSessionToken = existingResult.lastAttemptSessionToken;
    } else {
      startTime = Date.now();
      const session = buildAttemptSession({ testId: test._id, userId: req.user.id, timeLimitSeconds: timeLimitSecs, startTime });
      attemptSessionToken = session.attemptSessionToken;

      if (existingResult) {
         existingResult.status = "IN_PROGRESS";
         existingResult.startedAt = startTime;
         existingResult.lastAttemptSessionToken = attemptSessionToken;
         await existingResult.save();
      } else {
         existingResult = await TestResult.create({
           testId: test._id, quizId: test._id, studentId: req.user.id,
           status: "IN_PROGRESS", startedAt: startTime, lastAttemptSessionToken: attemptSessionToken, attemptNumber: 0
         });
      }
    }

    const testPayload = buildTestPayload(test);

    return res.json({
      success: true,
      canAttempt: true,
      test: testPayload,
      quiz: testPayload,
      attemptSessionToken,
      startTime,
      allowedTimeSeconds: timeLimitSecs
    });
  } catch (error) {
    console.error("GET TEST BY ID ERROR:", error);

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
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 50) {
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
      }
    );

    if (!response.ok) {
      console.error("OPENROUTER API ERROR:", response.status, response.statusText);
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
    const { quizId, testId, answers, tabSwitchCount, attemptSessionToken } =
      req.body;
    const effectiveTestId = testId || quizId;

    if (!attemptSessionToken) {
      return res.status(400).json({
        success: false,
        message: "Attempt session missing",
      });
    }

    let verifiedAttemptSession;

    try {
      verifiedAttemptSession = jwt.verify(
        attemptSessionToken,
        process.env.JWT_SECRET
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Attempt session expired or invalid",
      });
    }

    const test = await Test.findById(effectiveTestId);

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
      return res.status(403).json({
        success: false,
        message: "Invalid attempt session",
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
    const timeTaken = Math.max(
      Math.floor((Date.now() - startTime) / 1000),
      0
    );

    if (timeTaken > allowedTimeSeconds) {
      return res.status(400).json({
        success: false,
        message: "Time limit exceeded",
        timeTaken,
        allowedTimeSeconds,
      });
    }

    const existingAttempt = await TestResult.findOne({
      studentId: req.user.id,
      $or: [
        { testId: effectiveTestId },
        { quizId: effectiveTestId },
      ],
    });

    if (existingAttempt?.status === "COMPLETED" && existingAttempt?.lastAttemptSessionToken === attemptSessionToken) {
      return res.status(409).json({
        success: false,
        message: "Test already submitted",
      });
    }

    if (existingAttempt?.passed === true) {
      return res.status(400).json({
        success: false,
        message: "Test already passed",
      });
    }

    const currentAttemptCount = existingAttempt?.attemptNumber || 0;

    if (currentAttemptCount >= (test.maxAttempts || 2)) {
      return res.status(400).json({
        success: false,
        message: "You have reached maximum attempts",
      });
    }

    const nextAttemptNumber = currentAttemptCount + 1;

    let score = 0;
    const details = [];

    test.questions.forEach((question, index) => {
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

    const totalQuestions = test.questions.length;
    const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    const passed = score >= (test.passingScore || 0);
    const eligibleForCertificate = passed === true;
    const normalizedTabSwitchCount =
      typeof tabSwitchCount === "number" && tabSwitchCount >= 0
        ? tabSwitchCount
        : 0;
    const suspicious = normalizedTabSwitchCount > 3;

    let result;

    if (existingAttempt) {
      result = await TestResult.findOneAndUpdate(
        {
          _id: existingAttempt._id,
          status: "IN_PROGRESS",
        },
        {
          $set: {
            testId: effectiveTestId,
            quizId: effectiveTestId,
            status: "COMPLETED",
            score,
            totalQuestions,
            timeTakenSeconds: timeTaken,
            lastAttemptSessionToken: attemptSessionToken,
            attemptNumber: nextAttemptNumber,
            tabSwitchCount: normalizedTabSwitchCount,
            suspicious,
            passed,
            eligibleForCertificate,
            studentAnswers: details,
          },
        },
        { new: true }
      );
    } else {
      result = await TestResult.create({
        testId: effectiveTestId,
        quizId: effectiveTestId,
        status: "COMPLETED",
        studentId: req.user.id,
        score,
        totalQuestions,
        timeTakenSeconds: timeTaken,
        lastAttemptSessionToken: attemptSessionToken,
        attemptNumber: nextAttemptNumber,
        tabSwitchCount: normalizedTabSwitchCount,
        suspicious,
        passed,
        eligibleForCertificate,
        studentAnswers: details,
      });
    }

    if (!result) {
      return res.status(409).json({
        success: false,
        message: "Test already submitted",
      });
    }

    const { eligible: courseEligible } = await checkCourseEligibility(
      req.user.id,
      test.courseId
    );
    const attemptsLeft = Math.max((test.maxAttempts || 2) - result.attemptNumber, 0);

    return res.json({
      success: true,
      message: passed ? "Passed" : "Failed",
      score,
      passed,
      attemptsLeft,
      courseEligible,
      percentage,
      timeTaken,
      allowedTimeSeconds,
      attemptNumber: result.attemptNumber,
      tabSwitchCount: result.tabSwitchCount,
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
      }).select("lastAttemptSessionToken");

      if (
        duplicateAttempt?.lastAttemptSessionToken &&
        duplicateAttempt.lastAttemptSessionToken === req.body?.attemptSessionToken
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
    const tests = await Test.find({ courseId: { $in: courseIds } }).select("title createdAt");

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
  getTestByCourse,
  getTestById,
  generateAITest,
  submitTest,
  deleteTest,
  getTestSubjects,
  getTestsBySubject,
  getStudentTestResults,

  createQuiz: createTest,
  getQuizByCourse: getTestByCourse,
  getQuizById: getTestById,
  generateAIQuiz: generateAITest,
  submitQuiz: submitTest,
  deleteQuiz: deleteTest,
  getSubjects: getTestSubjects,
  getQuizzesBySubject: getTestsBySubject,
  getStudentResults: getStudentTestResults,
};
