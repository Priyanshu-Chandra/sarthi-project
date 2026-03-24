const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  question: String,
  selectedOption: Number,
  correctOption: Number,
  isCorrect: Boolean,
});

const testResultSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    score: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED"],
      default: "COMPLETED",
    },
    startedAt: {
      type: Date,
    },
    timeTakenSeconds: {
      type: Number,
      default: 0,
    },
    lastAttemptSessionToken: {
      type: String,
      default: "",
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    tabSwitchCount: {
      type: Number,
      default: 0,
    },
    suspicious: {
      type: Boolean,
      default: false,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    eligibleForCertificate: {
      type: Boolean,
      default: false,
    },
    studentAnswers: [answerSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "quizresults",
  }
);

testResultSchema.index({ testId: 1, studentId: 1 }, { unique: true });

module.exports =
  mongoose.models.TestResult || mongoose.model("TestResult", testResultSchema);
