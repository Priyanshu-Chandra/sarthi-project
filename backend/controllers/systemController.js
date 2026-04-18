const achievementManifest = require("../utils/achievementManifest");
const { executionQueue } = require("../utils/executionQueue");

exports.getAchievementManifest = (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: achievementManifest,
    });
  } catch (error) {
    console.error("Error fetching achievement manifest:", error);
    return res.status(500).json({
      success: false,
      message: "Could not fetch achievement manifest",
      error: error.message,
    });
  }
};

exports.getQueueMetrics = (req, res) => {
  try {
    // Assuming getMetrics is added to executionQueue.js
    const metrics = typeof executionQueue.getMetrics === "function" 
      ? executionQueue.getMetrics() 
      : { running: 0, queued: 0, maxConcurrent: 0, maxQueue: 0, error: "Metrics not yet implemented on queue" };

    return res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Error fetching queue metrics:", error);
    return res.status(500).json({
      success: false,
      message: "Could not fetch queue metrics",
      error: error.message,
    });
  }
};
