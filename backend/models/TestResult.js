const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  question: String,
  selectedOption: Number,
  correctOption: Number,
  isCorrect: Boolean,
  code: String,       // Added for coding tests
  passRatio: Number,  // Added for coding tests
});

const questionSnapshotSchema = new mongoose.Schema(
  {
    mcqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MCQQuestion",
      required: false,
    },
    question: String,
    options: [String],
    correctAnswer: Number,
  },
  { _id: false },
);

const codingSubmissionSchema = new mongoose.Schema(
  {
    problemId:     { type: mongoose.Schema.Types.ObjectId, ref: "Problem" },
    language:      { type: String },
    code:          { type: String, maxlength
      : 50000 },   // guard against large payloads
    status: {
      type: String,
      enum: [
        "Accepted",
        "Wrong Answer",
        "Compilation Error",
        "Runtime Error",
        "Time Limit Exceeded",
        "Pending", // for async processing if needed
      ],
      default: "Pending",
    },
    executionTime: { type: String },
    memory:        { type: String },

    // Test case statistics
    passedTestCases: { type: Number, default: 0 },
    totalTestCases:  { type: Number, default: 0 },

    // Timing & analytics
    submittedAt: { type: Date, default: Date.now },
    runCount:    { type: Number, default: 0 },           // how many times student ran code
    failedTest:  { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

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
      enum: ["IN_PROGRESS", "COMPLETED", "CHEATED"],
      default: "COMPLETED",
    },
    startedAt: {
      type: Date,
    },
    timeLimitSeconds: {
      type: Number,
      default: 0,
    },
    timeTakenSeconds: {
      type: Number,
      default: 0,
    },
    lastAttemptSessionToken: {
      type: String,
      default: "",
    },
    deviceId: {
      type: String,
      default: "",
    },
    startedByStudent: {
      type: Boolean,
      default: false,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    tabSwitchCount: {
      type: Number,
      default: 0,
    },
    multipleFacesDetected: {
      type: Boolean,
      default: false,
    },
    cameraDisabled: {
      type: Boolean,
      default: false,
    },
    lookingAwayCount: {
      type: Number,
      default: 0,
    },
    noiseDetected: {
      type: Boolean,
      default: false,
    },
    suspicious: {
      type: Boolean,
      default: false,
    },
    integrityScore: {
      type: Number,
      default: 100,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    violationLogs: [
      {
        type: { type: String },
        timestamp: { type: Date, default: Date.now },
        weight: { type: Number },
      }
    ],
    eligibleForCertificate: {
      type: Boolean,
      default: false,
    },
    questionSnapshot:   [questionSnapshotSchema],
    studentAnswers:     [answerSchema],
    codingSubmissions:  [codingSubmissionSchema],   // NEW — CODING test results
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "quizresults",
  }
);

// Fast lookup for student's result on a specific test
testResultSchema.index({ studentId: 1, testId: 1 });
// Optimized for exam security queries (testId + studentId + status)
testResultSchema.index({ testId: 1, studentId: 1, status: 1 });
// High-performance index for analytics
testResultSchema.index({ testId: 1, status: 1 });
// Allow only one active attempt per student/test at a time.
testResultSchema.index(
  { studentId: 1, testId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "IN_PROGRESS" },
  },
);

module.exports =
  mongoose.models.TestResult || mongoose.model("TestResult", testResultSchema);
