const express = require("express");
const router  = express.Router();

const { auth, isInstructor } = require("../middleware/auth");
const {
  getSessionSummary,
  getCourseSessionHistory,
  getSessionStudents,
  getSessionPolls,
} = require("../controllers/liveAnalytics");

// All analytics are instructor-only
router.get("/session/:sessionId/summary",  auth, isInstructor, getSessionSummary);
router.get("/session/:sessionId/students", auth, isInstructor, getSessionStudents);
router.get("/session/:sessionId/polls",    auth, isInstructor, getSessionPolls);
router.get("/course/:courseId/history",    auth, isInstructor, getCourseSessionHistory);

module.exports = router;
