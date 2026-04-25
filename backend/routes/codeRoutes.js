const express = require("express");
const router = express.Router();

const { runCode, submitCode, getUserSubmissions, getUserStats, getCodingActivity, getCodingAnalytics } = require("../controllers/codeController");
const { auth, isStudent } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

const executionLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 20, 
  message: { success: false, message: "Too many execution requests. Please try again later." }
});

router.post("/run", auth, isStudent, executionLimiter, runCode);
router.post("/submit", auth, isStudent, executionLimiter, submitCode);
router.get("/history", auth, isStudent, getUserSubmissions);
router.get("/stats", auth, isStudent, getUserStats);
// NOTE: Old all-time leaderboard (/leaderboard) removed — superseded by /api/v1/leaderboard/weekly
router.get("/activity", auth, isStudent, getCodingActivity);
router.get("/analytics", auth, isStudent, getCodingAnalytics);

module.exports = router;
