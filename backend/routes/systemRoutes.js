const express = require("express");
const router = express.Router();

const { getAchievementManifest, getQueueMetrics } = require("../controllers/systemController");
const { auth, isAdmin } = require("../middleware/auth");

router.get("/achievements/manifest", getAchievementManifest);
router.get("/queue-metrics", auth, isAdmin, getQueueMetrics);

module.exports = router;
