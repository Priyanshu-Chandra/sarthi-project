const mongoose = require("mongoose");

const boardSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
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

    // JSON array of strokes for replay reconstruction
    strokes: {
      type: Array,
      required: true,
    },

    strokeCount: {
      type: Number,
      default: 0,
    },

    duration: {
      type: Number, // in seconds
    },

    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("BoardSession", boardSessionSchema);
