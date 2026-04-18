const mongoose = require("mongoose");
const Problem = require("../models/Problem");
const testUser = require("../models/user"); // lowercase `user` inside Sarthi-main/backend/models
const CodeSubmission = require("../models/CodeSubmission");
const UserStats = require("../models/UserStats");
const { getLimits } = require("../utils/languageProfiles"); // Unused here, but ensuring logic exists
const { runSubmission } = require("../utils/executionEngine");
const { connectDB } = require("../config/database");

require("dotenv").config();

(async () => {
  try {
    connectDB();
    // Wait for connection to establish since connectDB doesn't return a promise directly
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("Connected to MongoDB");

    // 1. Get an existing student
    const student = await mongoose.model("User").findOne({ accountType: "Student" });
    if (!student) throw new Error("No student found");

    // 2. Get an existing problem
    const problem = await Problem.findOne();
    if (!problem) throw new Error("No problem found");

    // 3. Make sure the problem has test cases
    if (!problem.testCases || problem.testCases.length === 0) {
      problem.testCases = [
        { type: "public", input: "2 2", expected: "4" },
        { type: "hidden", input: "10 5", expected: "15" }
      ];
      await problem.save();
    }

    console.log(`Executing fake compilation for ${student.firstName} on ${problem.title}`);

    // 4. Force a wrong answer submission directly
    const badCode = `def solve(a, b):\n    return a - b # Intentional Bug!`;
    const evaluation = await runSubmission({
      code: badCode,
      language: "python",
      publicTests: problem.testCases.filter(t => t.type !== "hidden"),
      hiddenTests: problem.testCases.filter(t => t.type === "hidden"),
      limits: { timeLimit: 2000, memoryLimit: 256 },
      boilerplate: {}
    });

    console.log("Evaluation Result:", evaluation.status);

    // 5. Store it in DB manually the way the controller does
    const submissionRecord = await CodeSubmission.create({
      userId: student._id,
      problemId: problem._id,
      language: "python",
      code: badCode,
      status: "Wrong Answer",
      executionTime: "0.05s",
      memory: "10.00MB",
      passedTestCases: 0,
      totalTestCases: problem.testCases.length,
      isFirstAccepted: false,
      failedTest: evaluation.failedTest, // This was dropping previously
    });

    console.log("Record inserted ID:", submissionRecord._id);

    // 6. Refetch and assert persistence
    const fetched = await CodeSubmission.findById(submissionRecord._id).lean();

    if (!fetched.failedTest) {
      console.error("❌ FAILED: failedTest was NOT persisted to the database schema!");
      process.exit(1);
    } else {
      console.log("✅ SUCCESS: failedTest was persisted successfully!");
      console.log(fetched.failedTest);
      process.exit(0);
    }
  } catch (err) {
    console.error("Test Script Error:", err);
    process.exit(1);
  }
})();
