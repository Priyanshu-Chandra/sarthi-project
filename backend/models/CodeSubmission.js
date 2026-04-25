const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Problem",
    required: true,
  },
  language: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["Accepted", "Wrong Answer", "Compilation Error", "Time Limit Exceeded", "Runtime Error"],
    required: true,
  },
  executionTime: {
    type: String, // format like "200ms"
  },
  memory: {
    type: String, // format like "5MB"
  },
  passedTestCases: {
    type: Number,
  },
  totalTestCases: {
    type: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isFirstAccepted: {
    type: Boolean,
    default: false,
  },
  failedTest: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
});

submissionSchema.index({ userId: 1 });
submissionSchema.index({ problemId: 1 });
submissionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("CodeSubmission", submissionSchema);
