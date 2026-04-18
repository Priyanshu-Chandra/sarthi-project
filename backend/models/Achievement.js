const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    badge: {
      type: String,
      required: true,
    },
    category: {
      type: String, // STREAK, SKILL, PERFORMANCE, MILESTONE, EXAM
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure a user can only unlock a specific badge once
achievementSchema.index({ userId: 1, badge: 1 }, { unique: true });

module.exports = mongoose.model("Achievement", achievementSchema);
