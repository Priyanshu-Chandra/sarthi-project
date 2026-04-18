const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { getWeeklyLeaderboard, getMyRank } = require("../controllers/leaderboardController");

router.get("/weekly", auth, getWeeklyLeaderboard);
router.get("/my-rank", auth, getMyRank);

module.exports = router;
