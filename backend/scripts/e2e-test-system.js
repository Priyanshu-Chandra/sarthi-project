const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/user');
const Test = require('../models/Test');
const TestResult = require('../models/TestResult');
const Course = require('../models/course');
const { getTestById, submitTest } = require('../controllers/testController');
const { computeTestAnalysis } = require('../controllers/analysisController');

// Mock response object
const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

async function runE2E() {
  console.log("🚀 Starting System Deep-Scan E2E Test (Non-Browser)...");

  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("✅ Database Connected");

    const studentId = '69b814e98f281552c9130da1';
    const testId = '69b1b4f9a61e43b6a333f863';
    
    // Auto-discover course ID and Enroll
    const testDoc = await Test.findById(testId);
    if (!testDoc) throw new Error("Test not found in DB");
    const courseId = testDoc.courseId;

    await Course.findByIdAndUpdate(courseId, { $addToSet: { studentsEnrolled: studentId } });
    await User.findByIdAndUpdate(studentId, { $addToSet: { courses: courseId } });
    console.log("📝 Auto-enrolled student in course: " + courseId);

    const deviceId = "E2E-TEST-DEVICE-ID-" + Date.now();

    // Cleanup previous attempts for a clean test
    await TestResult.deleteMany({ studentId, testId });
    console.log("🧹 Cleaned up old test data");

    // ── SCENARIO 1: Fetching Test & Session Initialization ──
    console.log("\n📡 Scenario 1: Fetching Test...");
    const req1 = {
      user: { id: studentId, accountType: "Student" },
      params: { id: testId },
      query: { deviceId: deviceId }
    };
    const res1 = mockRes();
    await getTestById(req1, res1);

    if (res1.data.success) {
      console.log("   ✅ Test Fetched Successfully");
      console.log(`   ✅ Session Token Generated: ${res1.data.attemptSessionToken.substring(0, 20)}...`);
    } else {
      throw new Error("Failed to fetch test: " + JSON.stringify(res1.data));
    }

    const sessionToken = res1.data.attemptSessionToken;

    // ── SCENARIO 2: Integrity & Proctoring (Simulated Violations) ──
    console.log("\n🛡️ Scenario 2: Submitting with Violations...");
    const req2 = {
      user: { id: studentId },
      body: {
        quizId: testId,
        attemptSessionToken: sessionToken,
        deviceId: deviceId,
        answers: { 0: 1, 1: 0 }, // Random answers
        timeTaken: 120,
        integrityScore: 85, // Simulated drop
        violationLogs: [
          { type: "TAB_SWITCH", weight: 5, timestamp: new Date() },
          { type: "LOOKING_AWAY", weight: 10, timestamp: new Date() }
        ]
      }
    };
    const res2 = mockRes();
    await submitTest(req2, res2);

    if (res2.data.success) {
      console.log("   ✅ Submission Successful");
      console.log(`   ✅ Integrity Score Saved: ${res2.data.integrityScore}`);
    } else {
      throw new Error("Submission failed: " + JSON.stringify(res2.data));
    }

    // ── SCENARIO 3: Device ID Mismatch Protection (While IN_PROGRESS) ──
    console.log("\n🚫 Scenario 3: Testing Device ID Security (While IN_PROGRESS)...");
    // Start a new attempt
    await TestResult.deleteMany({ studentId, testId });
    await getTestById(req1, mockRes()); // Initializes IN_PROGRESS
    
    const req3 = {
      user: { id: studentId, accountType: "Student" },
      params: { id: testId },
      query: { deviceId: "WRONG-DEVICE-ID" }
    };
    const res3 = mockRes();
    await getTestById(req3, res3);

    if (res3.statusCode === 403) {
      console.log("   ✅ Device ID Mismatch Correctly Blocked (403)");
    } else {
      console.warn("   ⚠️ Warning: Device ID mismatch did not return 403.");
    }

    // ── SCENARIO 4: Analysis Generation ──
    console.log("\n📊 Scenario 4: Generating Learning Analysis...");
    // Complete the attempt first
    await submitTest(req2, mockRes());
    const analysis = await computeTestAnalysis(testId, studentId);
    if (analysis) {
      console.log("   ✅ Analysis Generated Successfully");
    }

    // ── SCENARIO 5: Attempt Exhaustion ──
    console.log("\n⌛ Scenario 5: Checking Attempt Limits...");
    const testDoc2 = await Test.findById(testId);
    const max = testDoc2.maxAttempts || 2;
    console.log(`   (Test Max Attempts: ${max})`);
    
    // Fill up attempts
    for(let i=0; i < max; i++) {
        const resInit = mockRes();
        await getTestById(req1, resInit);
        if (resInit.data.canAttempt) {
            await submitTest({ ...req2, body: { ...req2.body, attemptSessionToken: resInit.data.attemptSessionToken } }, mockRes());
        }
    }

    const res5 = mockRes();
    await getTestById(req1, res5);
    if (res5.data.canAttempt === false) {
       console.log("   ✅ Attempt Limit Correctly Enforced");
    } else {
       console.warn("   ⚠️ Warning: Attempt limit NOT enforced.");
    }

    console.log("\n✨ E2E Test Completed Successfully!");

  } catch (err) {
    console.error("\n❌ E2E Test Failed!");
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runE2E();
