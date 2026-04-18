const mongoose = require("mongoose");

const mcqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: {
    type: [String],
    validate: {
      validator: (v) => v.length === 4,
      message: "MCQ must have exactly 4 options"
    },
    required: true
  },
  correctAnswer: {
    type: Number,
    min: 0,
    max: 3,
    required: true
  },
  topic: { type: String, required: true }
});

module.exports = mongoose.model("MCQQuestion", mcqSchema);
