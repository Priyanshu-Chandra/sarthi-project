const mongoose = require("mongoose");

const liveSessionSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  liveRoomId: {
    type: String,
    required: true,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: Date,
  status: {
    type: String,
    enum: ["active", "ended"],
    default: "active",
  },
  endedReason: {
    type: String,
    enum: ["manual", "timeout", "crash"],
  },
  expectedStudents: Number,
  presentStudents: Number,
  avgEngagementScore: {
    type: Number,
    default: 0,
  },
  messages: { type: Number, default: 0 },
  boardDraws: { type: Number, default: 0 },
  pollResponses: { type: Number, default: 0 },
  raisedHands: { type: Number, default: 0 },
  engagementTimeline: [{
    minute: Number,
    chat:   { type: Number, default: 0 },
    polls:  { type: Number, default: 0 },
    board:  { type: Number, default: 0 },
    hands:  { type: Number, default: 0 },
    active: { type: Number, default: 0 }, // unique active users in this minute
  }],
  summaryCache: {
    activeCount:    Number,
    passiveCount:   Number,
    dropoffCount:   Number,
    lateJoiners:    Number,
    unstableCount:  Number, // rejoinCount > 3
    insights:       [Object], // { level: String, msg: String }
    topParticipants: [Object],
  },
}, { timestamps: true });

liveSessionSchema.index({ courseId: 1 });
liveSessionSchema.index({ endedAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days cleanup
liveSessionSchema.index({ status: 1, startedAt: -1 });
liveSessionSchema.index({ liveRoomId: 1, status: 1 });

module.exports = mongoose.model("LiveSession", liveSessionSchema);
