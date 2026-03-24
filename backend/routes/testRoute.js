const express = require("express");
const { auth, isInstructor, isStudent } = require("../middleware/auth.js");

const {
  createTest,
  getTestSubjects,
  getTestsBySubject,
  getTestById,
  submitTest,
  deleteTest,
  getStudentTestResults,
  getTestByCourse,
  getTestsByCourse,
  generateAITest,
} = require("../controllers/testController.js");

const router = express.Router();

router.post("/create", auth, isInstructor, createTest);
router.get("/course/:courseId/list", auth, getTestsByCourse);
router.get("/course/:courseId", auth, isStudent, getTestByCourse);
router.get("/subjects", auth, getTestSubjects);
router.get("/by-subject/:subject", auth, isStudent, getTestsBySubject);
router.post("/submit", auth, isStudent, submitTest);
router.get("/results", auth, isStudent, getStudentTestResults);
router.delete("/:id", auth, isInstructor, deleteTest);
router.get("/:id", auth, getTestById);
router.post("/generate-ai", auth, isInstructor, generateAITest);

module.exports = router;
