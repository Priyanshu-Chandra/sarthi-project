const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswer: { type: Number, required: true },
});

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
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

module.exports = mongoose.models.Test || mongoose.model("Test", testSchema);
