const express = require("express");
const { auth, isInstructor, isStudent } = require("../middleware/auth.js");

const {
  createQuiz,
  getSubjects,
  getQuizzesBySubject,
  getQuizById,
  submitQuiz,
  getStudentResults,
  getQuizByCourse
} = require("../controllers/quizController.js");

const router = express.Router();

router.post("/create", auth, isInstructor, createQuiz);
router.get("/course/:courseId", auth, isStudent, getQuizByCourse);
router.get("/subjects", auth, getSubjects);
router.get("/by-subject/:subject", auth, isStudent, getQuizzesBySubject);
router.post("/submit", auth, isStudent, submitQuiz);
router.get("/results", auth, isStudent, getStudentResults);
router.get("/:id", auth, isStudent, getQuizById);

module.exports = router;