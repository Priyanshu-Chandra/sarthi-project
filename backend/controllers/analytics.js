const UserStats = require("../models/UserStats");

exports.getStudentAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await UserStats.findOne({ userId }).lean();

    if (!stats) {
      return res.status(200).json({ success: true, data: {} });
    }

    // Skill Radar
    const radar = {};

    if (stats.topicStats) {
      Object.entries(stats.topicStats).forEach(([key, value]) => {
        radar[key] = value.attempts === 0
          ? 0
          : Number((value.solved / value.attempts).toFixed(2));
      });
    }

    // Problem solving speed
    const avgAttempts = stats.problemsSolved === 0
      ? 0
      : stats.totalAttempts / stats.problemsSolved;

    const acceptanceRate = stats.totalSubmissions === 0
      ? 0
      : Number(((stats.acceptedSubmissions / stats.totalSubmissions) * 100).toFixed(1));

    res.status(200).json({
      success: true,
      data: {
        radar,
        avgAttempts,
        difficultyStats: stats.difficultyStats,
        totalSubmissions: stats.totalSubmissions,
        problemsSolved: stats.problemsSolved,
        acceptedSubmissions: stats.acceptedSubmissions,
        acceptanceRate
      }
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ success: false, message: "Failed to load analytics" });
  }
};
