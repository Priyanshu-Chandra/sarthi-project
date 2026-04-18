const express = require("express");
const router = express.Router();

const { auth, isInstructor } = require("../middleware/auth");
const {
  getExamOverview,
  getFailedQuestions,
  getTopPerformers
} = require("../controllers/instructorAnalytics");

router.get("/overview/:testId", auth, isInstructor, getExamOverview);
router.get("/failed/:testId", auth, isInstructor, getFailedQuestions);
router.get("/top-performers/:testId", auth, isInstructor, getTopPerformers);

module.exports = router;
