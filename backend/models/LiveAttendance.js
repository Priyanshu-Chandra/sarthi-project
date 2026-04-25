const mongoose = require("mongoose");

const liveAttendanceSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LiveSession",
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  joinedAt: Date,
  leftAt: Date,
  lastSeenAt: Date,
  rejoinCount: {
    type: Number,
    default: 0,
  },
  activeSeconds: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["present", "left", "absent"],
    default: "present",
  },
  engagementScore: {
    type: Number,
    default: 0,
  },
  engagementBreakdown: {
    chat:  { type: Number, default: 0 },
    polls: { type: Number, default: 0 },
    board: { type: Number, default: 0 },
    hands: { type: Number, default: 0 },
  },
  attendanceStatus: {
    type: String,
    enum: ["active", "passive", "dropoff"],
  },
}, { timestamps: true });

liveAttendanceSchema.index({ sessionId: 1, userId: 1 }, { unique: true });
liveAttendanceSchema.index({ sessionId: 1 });
liveAttendanceSchema.index({ userId: 1 });
liveAttendanceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days cleanup

module.exports = mongoose.model("LiveAttendance", liveAttendanceSchema);
