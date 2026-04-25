const mongoose = require("mongoose");

const codingActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    default: 1,
  },
}, { timestamps: true });

codingActivitySchema.index({ userId: 1, date: 1 }, { unique: true });
codingActivitySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("CodingActivity", codingActivitySchema);
