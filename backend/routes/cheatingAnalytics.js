const express = require("express");
const router = express.Router();

const { auth, isInstructor } = require("../middleware/auth");
const { getCheatingAnalysis, getCheatingSummary } = require("../controllers/cheatingAnalytics");

router.get("/summary/:testId", auth, isInstructor, getCheatingSummary);
router.get("/:testId", auth, isInstructor, getCheatingAnalysis);

module.exports = router;
