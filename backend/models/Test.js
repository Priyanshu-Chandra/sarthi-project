const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["MCQ", "CODING"],
    default: "MCQ",
  },
  
  // LEGACY & MANUAL MCQ
  question: { type: String, required: function() { return this.type === "MCQ" && !this.mcqId; } },
  options: { type: [String], required: function() { return this.type === "MCQ" && !this.mcqId; } },
  correctAnswer: { type: Number, required: function() { return this.type === "MCQ" && !this.mcqId; } },
  
  // NEW SYSTEM (EXTERNAL REFS)
  mcqId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MCQQuestion"
  },
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Problem"
  }
});

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    testType: {
      type: String,
      enum: ["MCQ", "CODING"],
      default: "MCQ"
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Mixed"],
      default: "Mixed"
    },
    isLegacy: {
      type: Boolean,
      default: true
    },
    timeLimitSeconds: {
      type: Number,
      default: 600,
      min: 60,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
    },
    maxAttempts: {
      type: Number,
      default: 2,
      min: 1,
    },
    passingScore: {
      type: Number,
      default: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questions: [questionSchema],
    createdAt: { type: Date, default: Date.now },
  },
  {
    collection: "quizzes",
  }
);

testSchema.index({ courseId: 1 });

module.exports = mongoose.models.Test || mongoose.model("Test", testSchema);
