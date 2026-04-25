const mongoose = require("mongoose");

const problemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    unique: true,
    required: true,
  },
  difficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard"],
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  exampleInput: {
    type: String,
    required: true,
  },
  exampleOutput: {
    type: String,
    required: true,
  },
  constraints: {
    type: String,
    required: true,
  },
  timeLimit: {
    type: Number,
    default: 2000,
  },
  memoryLimit: {
    type: Number,
    default: 256,
  },
  starterCode: {
    python: { type: String, default: "" },
    c: { type: String, default: "" },
    cpp: { type: String, default: "" },
    java: { type: String, default: "" },
  },
  boilerplate: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  tags: [String],
  constraintsParsed: { type: mongoose.Schema.Types.Mixed },
  testCases: [
    {
      input: {
        type: String,
        required: true,
      },
      expectedOutput: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: ["public", "hidden"],
        default: "hidden"
      }
    },
  ],
}, { timestamps: true });

problemSchema.index({ difficulty: 1 });
problemSchema.index({ topic: 1 });
problemSchema.index({ difficulty: 1, topic: 1 });
problemSchema.index({ title: "text" });

module.exports = mongoose.model("Problem", problemSchema);
