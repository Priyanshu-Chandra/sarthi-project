const mongoose = require("mongoose");

const pollResultSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LiveSession",
    required: true,
  },
  roomId: {
    type: String,
    required: true,
  },
  pollId: {
    type: String, // Tracks specific poll instance
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: true,
  },
  tally: {
    type: Map,
    of: Number,
    required: true,
  },
  totalVotes: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

pollResultSchema.index({ sessionId: 1, pollId: 1 });

module.exports = mongoose.model("PollResult", pollResultSchema);
