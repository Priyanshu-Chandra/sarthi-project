const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  question: String,
  selectedOption: Number,
  correctOption: Number,
  isCorrect: Boolean
});

const quizResultSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  studentAnswers: [answerSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("QuizResult", quizResultSchema);