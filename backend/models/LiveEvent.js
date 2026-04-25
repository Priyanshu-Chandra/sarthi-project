const mongoose = require("mongoose");

const liveEventSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LiveSession",
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  type: {
    type: String,
    enum: [
      "join",
      "leave",
      "raise_hand",
      "message",
      "poll_vote",
      "board_draw",
      "screen_share",
      "permission",
      "system"
    ],
  },
  meta: Object,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

liveEventSchema.index({ sessionId: 1 });
liveEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days cleanup

module.exports = mongoose.model("LiveEvent", liveEventSchema);
