const express = require("express");
const router = express.Router();

const { getPersonalizedRecommendations, getDailyChallenge } = require("../controllers/recommendationController");
const { auth } = require("../middleware/auth");

router.get("/practice-path", auth, getPersonalizedRecommendations);
router.get("/daily-challenge", auth, getDailyChallenge);

module.exports = router;
