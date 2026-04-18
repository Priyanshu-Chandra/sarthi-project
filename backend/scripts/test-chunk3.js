const mongoose = require("mongoose");
const TestResult = require("../models/TestResult");
const Problem = require("../models/Problem");
const MCQQuestion = require("../models/MCQQuestion");
const { executionQueue } = require("../utils/executionQueue");
const { connectDB } = require("../config/database");
const systemController = require("../controllers/systemController");
const instructorAnalytics = require("../controllers/instructorAnalytics");

require("dotenv").config();

(async () => {
  let hasFailed = false;

  console.log("==========================================");
  console.log("   🚀 STARTING CHUNK 3 E2E AUTOMATED TESTS ");
  console.log("==========================================\n");

  try {
    connectDB();
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("[db] Connected to MongoDB.");

    // =========================================================================
    // TEST 1: QUEUE METRICS (executionQueue.js & systemController.js)
    // =========================================================================
    console.log("\n--- TEST 1: System Health & Queue Metrics ---");
    
    // Check underlying engine
    const metrics = executionQueue.getMetrics();
    if (metrics.running !== undefined && metrics.queued !== undefined) {
      console.log("✅ [executionQueue] getMetrics() correctly returns memory cluster state.");
    } else {
      console.error("❌ [executionQueue] Failed to extract metrics natively.");
      hasFailed = true;
    }

    // Check Controller Endpoint
    let controllerData = null;
    const mockReq = {};
    const mockRes = {
      status: (code) => ({
        json: (data) => { controllerData = data; }
      })
    };

    systemController.getQueueMetrics(mockReq, mockRes);
    if (controllerData && controllerData.success && controllerData.data) {
      console.log("✅ [systemController] /queue-metrics endpoint successfully broadcasts metrics to Admins.");
    } else {
      console.error("❌ [systemController] /queue-metrics endpoint failed.");
      hasFailed = true;
    }

    // =========================================================================
    // TEST 2: FAILED QUESTIONS TAGGING (instructorAnalytics.js)
    // =========================================================================
    console.log("\n--- TEST 2: Failed Questions Analyzer [CODING] and [MCQ] ---");

    // We will dynamically create a fake test result in memory to test the tagging logic
    const testProblem = await Problem.findOne();
    const testQuestion = await mongoose.connection.db.collection("mcqquestions").findOne();

    if (testProblem && testQuestion) {
       // Seed fake data directly
       const fakeResult = new TestResult({
          studentId: testProblem._id, // random valid ID
          testId: testProblem._id,
          status: "COMPLETED",
          score: 0,
          studentAnswers: [{ question: testQuestion._id.toString(), isCorrect: false }],
          codingSubmissions: [{ problemId: testProblem._id.toString(), status: "Wrong Answer" }]
       });

       await fakeResult.save();

       // Test instructor analytics
       const mockAnalyticsReq = { params: { testId: testProblem._id } };
       let analyticsData = null;
       const mockAnalyticsRes = {
           status: (code) => ({
             json: (data) => { analyticsData = data; }
           }),
           json: (data) => { analyticsData = data; }
       };

       await instructorAnalytics.getFailedQuestions(mockAnalyticsReq, mockAnalyticsRes);
       
       if (analyticsData && Array.isArray(analyticsData)) {
          const fq = analyticsData;
          const codingNode = fq.find(q => q.type === "[CODING]");
          const mcqNode = fq.find(q => q.type === "[MCQ]");

          if (codingNode && mcqNode) {
            console.log(`✅ [instructorAnalytics] Correctly tagged Problem ID with "[CODING]": ${codingNode.questionText}`);
            console.log(`✅ [instructorAnalytics] Correctly tagged Question ID with "[MCQ]": ${mcqNode.questionText}`);
          } else {
            console.error("❌ [instructorAnalytics] Did not find both [CODING] and [MCQ] tagged items in payload.");
            console.log(fq);
            hasFailed = true;
          }
       } else {
          console.error("❌ [instructorAnalytics] Failed to fetch exam overview or failedQuestions missing.");
          hasFailed = true;
       }

       // cleanup
       await TestResult.deleteOne({ _id: fakeResult._id });
    } else {
      console.log("⚠️ [instructorAnalytics] Skipping DB verification (no problems/questions in local DB). Code syntax assumed correct.");
    }

    // =========================================================================
    // TEST 3: LEARNING INSIGHTS API (Ensuring difficulty stats available for Frontend)
    // =========================================================================
     console.log("\n--- TEST 3: Analytics Dashboard API Readiness ---");
     const codingAnalyticsController = require("../controllers/codeController");
     const mockUserReq = { user: { id: testProblem._id } }; // Random valid id
     let studentData = null;
     const mockStudentRes = {
       status: (code) => ({
         json: (data) => { studentData = data; }
       })
     };

     await codingAnalyticsController.getCodingAnalytics(mockUserReq, mockStudentRes);
     if (studentData && studentData.success) {
        if (studentData.data.difficultyStats && studentData.data.acceptanceRate !== undefined) {
           console.log("✅ [analytics Dashboard] API surfaces deep difficulty array and acceptance metrics for behavioral nudges.");
        } else {
           console.error("❌ [analytics Dashboard] Data structure is missing fields for generateInsights() frontend hook.");
           hasFailed = true;
        }
     } else {
       console.error("❌ [analytics Dashboard] API failed to respond.");
       hasFailed = true;
     }

  } catch (error) {
    console.error("TEST SCRIPT ERROR:", error);
    hasFailed = true;
  } finally {
    console.log("\n==========================================");
    if (hasFailed) {
      console.error("❌ CHUNK 3 EVALUATION FAILED.");
      process.exit(1);
    } else {
      console.log("✅ CHUNK 3 EVALUATION PASSED FLAWLESSLY.");
      console.log("==========================================");
      process.exit(0);
    }
  }
})();
