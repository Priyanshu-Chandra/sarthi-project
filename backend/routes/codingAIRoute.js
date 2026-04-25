const express = require("express");
const router = express.Router();

const { getAICodeHelp } = require("../controllers/codingAIController");
const { auth, isStudent } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { success: false, message: "AI request limit reached. Please wait." }
});

router.post("/code-help", auth, isStudent, aiLimiter, getAICodeHelp);

module.exports = router;
