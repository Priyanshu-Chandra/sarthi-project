const mongoose = require("mongoose");

const studyPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    goal: {
      type: String,
      trim: true,
    },
    duration: {
      type: String,
      trim: true,
    },
    dailyHours: {
      type: mongoose.Schema.Types.Mixed,
    },
    level: {
      type: String,
      trim: true,
    },
    weaknesses: {
      type: [String],
      default: [],
    },
    plan: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudyPlan", studyPlanSchema);
