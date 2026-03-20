// ⭐ FIX 1: Correct model imports (remove .default)
const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");


// ===============================
// CREATE QUIZ (Instructor)
// ===============================
exports.createQuiz = async (req, res) => {
  try {

    console.log("===== CREATE QUIZ START =====");

    const { title, courseId, questions } = req.body;

    console.log("Title:", title);
    console.log("CourseId:", courseId);
    console.log("Questions Count:", questions?.length);

    const quiz = await Quiz.create({
      title,
      courseId,
      questions,
      createdBy: req.user.id
    });

    console.log("Quiz created successfully:", quiz._id);

    return res.status(201).json({
      success: true,
      message: "Quiz created",
      quiz
    });

  } catch (err) {

    console.error("CREATE QUIZ ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


// ===============================
// GET QUIZ BY COURSE
// ===============================
exports.getQuizByCourse = async (req, res) => {

  try {

    const courseId = req.params.courseId;

    console.log("===== FETCH QUIZ BY COURSE =====");
    console.log("CourseId received:", courseId);

    const quiz = await Quiz.findOne({ courseId });
    console.log("Quiz fetched:", quiz);

    if (!quiz) {

      console.log("No quiz found for this course");

      return res.status(404).json({
        success: false,
        error: "Quiz not found for this course"
      });
    }

    console.log("Quiz found:", quiz._id);

    const sanitizedQuestions = quiz.questions.map((q) => ({
      question: q.question,
      options: q.options
    }));

    return res.json({
      success: true,
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        questions: sanitizedQuestions
      }
    });

  } catch (err) {

    console.error("GET QUIZ BY COURSE ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


// ===============================
// GET QUIZ BY ID
// ===============================
exports.getQuizById = async (req, res) => {

  try {

    const quizId = req.params.id;

    console.log("Fetching quiz by ID:", quizId);

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {

      console.log("Quiz not found:", quizId);

      return res.status(404).json({
        success: false,
        error: "Quiz not found"
      });
    }

    const sanitizedQuestions = quiz.questions.map((q) => ({
      question: q.question,
      options: q.options
    }));

    return res.json({
      success: true,
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        questions: sanitizedQuestions
      }
    });

  } catch (err) {

    console.error("GET QUIZ BY ID ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


// ===============================
// SUBMIT QUIZ
// ===============================
exports.submitQuiz = async (req, res) => {

  try {

    const { quizId, answers } = req.body;

    console.log("===== QUIZ SUBMISSION =====");
    console.log("QuizId:", quizId);
    console.log("Student:", req.user.id);

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {

      console.log("Quiz not found during submission");

      return res.status(404).json({
        success: false,
        error: "Quiz not found"
      });
    }

    const existingAttempt = await QuizResult.findOne({
      quizId,
      studentId: req.user.id
    });

    if (existingAttempt) {

      console.log("Student already attempted quiz");

      return res.status(400).json({
        success: false,
        message: "You have already attempted this quiz"
      });
    }

    let score = 0;
    const details = [];

    quiz.questions.forEach((q, idx) => {

      const selected =
        typeof answers[idx] === "number"
          ? answers[idx]
          : null;

      const isCorrect = selected === q.correctAnswer;

      if (isCorrect) score++;

      details.push({
        question: q.question,
        selectedOption: selected,
        correctOption: q.correctAnswer,
        isCorrect
      });

    });

    const result = await QuizResult.create({
      quizId,
      studentId: req.user.id,
      score,
      totalQuestions: quiz.questions.length,
      studentAnswers: details
    });

    console.log("Quiz submitted successfully:", result._id);

    return res.json({
      success: true,
      message: "Quiz submitted",
      score,
      total: quiz.questions.length,
      resultId: result._id,
      details
    });

  } catch (err) {

    console.error("QUIZ SUBMIT ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
exports.getSubjects = async (req, res) => {
  try {

    console.log("Fetching quiz subjects");

    const subjects = await Quiz.distinct("subject");

    return res.json({
      success: true,
      subjects
    });

  } catch (err) {

    console.error("GET SUBJECTS ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
exports.getQuizzesBySubject = async (req, res) => {
  try {

    const subject = req.params.subject;

    console.log("Fetching quizzes for subject:", subject);

    const quizzes = await Quiz.find({ subject }).select("title createdAt");

    return res.json({
      success: true,
      quizzes
    });

  } catch (err) {

    console.error("GET QUIZZES BY SUBJECT ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
exports.getStudentResults = async (req, res) => {

  try {

    console.log("Fetching student quiz results");

    const results = await QuizResult.find({
      studentId: req.user.id
    })
      .populate("quizId", "title")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      results
    });

  } catch (err) {

    console.error("GET STUDENT RESULTS ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};