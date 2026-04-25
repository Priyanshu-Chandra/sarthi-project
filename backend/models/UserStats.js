const mongoose = require("mongoose");

const topicStatSchema = new mongoose.Schema({
  solved: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 }
}, { _id: false });

const userStatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  totalSubmissions: { type: Number, default: 0 },
  acceptedSubmissions: { type: Number, default: 0 },
  problemsSolved: { type: Number, default: 0 },

  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  weeklyXp: { type: Number, default: 0 },
  lastWeeklyReset: { type: Date, default: Date.now },

  totalAttempts: { type: Number, default: 0 },

  topicStats: {
    type: Map,
    of: topicStatSchema,
    default: {}
  },

  difficultyStats: {
    easy: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    hard: { type: Number, default: 0 }
  }

}, { timestamps: true });

userStatsSchema.index({ userId: 1 });
userStatsSchema.index({ weeklyXp: -1 }); // Fast leaderboard sort

module.exports = mongoose.model("UserStats", userStatsSchema);
