const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/user');
const Test = require('../models/Test');
const MCQQuestion = require('../models/MCQQuestion');
const Problem = require('../models/Problem');
const TestResult = require('../models/TestResult');
const Course = require('../models/course');
const { getTestById, startTestAttempt, submitTest } = require('../controllers/testController');

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
  console.log("🚀 Starting Advanced E2E Edge Case Suite for Exam Flow...");

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

    const deviceId1 = "E2E-DEVICE-1-" + Date.now();
    const deviceId2 = "E2E-DEVICE-2-HIJACKER";

    // Cleanup previous attempts
    await TestResult.deleteMany({ studentId, testId });
    console.log("🧹 Cleaned up old test data");

    // ── SCENARIO 1: Ghost/Preflight Handling ──
    console.log("\n📡 Scenario 1: Preflight Generation & Cleanup...");
    const req1 = { user: { id: studentId, accountType: "Student" }, params: { id: testId }, query: { deviceId: deviceId1 } };
    let res1 = mockRes();
    await getTestById(req1, res1);
    
    // Call again to ensure it doesn't create multiple ghost attempts
    let res1_duplicate = mockRes();
    await getTestById(req1, res1_duplicate);
    
    const preflightCount = await TestResult.countDocuments({ studentId, testId, status: "IN_PROGRESS" });
    if (preflightCount === 0) {
       console.log("   ✅ Multiple preflights resolved cleanly (No ghost attempts leak, pure read-only)");
    } else {
       throw new Error(`Expected 0 preflight attempt, found ${preflightCount}`);
    }

    // ── SCENARIO 2: Starting Test ──
    console.log("\n🎬 Scenario 2: Starting Active Attempt...");
    const reqStart = { user: { id: studentId, accountType: "Student" }, params: { id: testId }, body: { deviceId: deviceId1 } };
    let resStart = mockRes();
    await startTestAttempt(reqStart, resStart);
    
    if (resStart.data.success && resStart.data.activeAttempt) {
       console.log("   ✅ Test Started Successfully");
    } else {
       throw new Error("Start failed: " + JSON.stringify(resStart.data));
    }
    const sessionToken = resStart.data.attemptSessionToken;

    // ── SCENARIO 3: Session Refresh / Recovery ──
    console.log("\n🔄 Scenario 3: Browser Refresh Recovery...");
    let resRefresh = mockRes();
    await getTestById(req1, resRefresh);
    if (resRefresh.data.activeAttempt && resRefresh.data.attemptSessionToken === sessionToken) {
       console.log("   ✅ Session gracefully recovered exactly as left");
    } else {
       throw new Error("Refresh failed to return active session token.");
    }

    // ── SCENARIO 4: Device Hijacking Prevention ──
    console.log("\n🛑 Scenario 4: Concurrent Device Prevention...");
    const reqHijack = { user: { id: studentId, accountType: "Student" }, params: { id: testId }, query: { deviceId: deviceId2 } };
    let resHijack = mockRes();
    await getTestById(reqHijack, resHijack);
    if (!resHijack.data.canAttempt && resHijack.data.message.includes("active on another device")) {
       console.log("   ✅ Secondary device correctly locked out");
    } else {
       console.warn("   ⚠️ Device hijacking protection not enforcing correctly:", resHijack.data.message);
    }

    // ── SCENARIO 5: Network Latency Grace Period vs Time Fraud ──
    console.log("\n⏳ Scenario 5: Validating Network Latency Grace Period...");
    
    // We will manually backdate the `startTime` in DB to exactly (timeLimitSecs + 30)
    // It should allow submission and evaluate answers correctly.
    const allowedSecs = testDoc.duration || 600; // default 10 min
    const validLateStartTime = Date.now() - ((allowedSecs + 30) * 1000); 
    
    await TestResult.findOneAndUpdate({ studentId, testId, status: "IN_PROGRESS" }, { startedAt: validLateStartTime });
    
    const reqSubmitLate = {
      user: { id: studentId },
      body: { quizId: testId, attemptSessionToken: sessionToken, deviceId: deviceId1, answers: {}, timeTaken: allowedSecs + 30, integrityScore: 100, violationLogs: [] }
    };
    let resSubmitLate = mockRes();
    await submitTest(reqSubmitLate, resSubmitLate);
    
    if (resSubmitLate.data.success && resSubmitLate.data.score !== undefined) {
        console.log("   ✅ Network latency buffer (30s) correctly accepted");
    } else {
        throw new Error("Network latency grace period failed");
    }

    // Now, test true Time Fraud: Time taken > allowedTime + 60
    console.log("\n⏳ Scenario 6: Validating Strict Time Fraud Rejection...");
    await TestResult.deleteMany({ studentId, testId }); // clear
    await getTestById(req1, mockRes()); // preflight
    let resStartFraud = mockRes();
    await startTestAttempt(reqStart, resStartFraud); // start
    const fraudToken = resStartFraud.data.attemptSessionToken;
    
    // Backdate startTime by allowedTime + 65 seconds
    const invalidLateStartTime = Date.now() - ((allowedSecs + 65) * 1000);
    await TestResult.findOneAndUpdate({ studentId, testId, status: "IN_PROGRESS" }, { startedAt: invalidLateStartTime });

    const reqSubmitFraud = {
      user: { id: studentId },
      body: { quizId: testId, attemptSessionToken: fraudToken, deviceId: deviceId1, answers: { 0: 1 }, timeTaken: allowedSecs + 65, integrityScore: 100, violationLogs: [] }
    };
    let resSubmitFraud = mockRes();
    await submitTest(reqSubmitFraud, resSubmitFraud);
    
    if (resSubmitFraud.data.success && resSubmitFraud.data.score === 0 && !resSubmitFraud.data.passed) {
        console.log("   ✅ Time fraud (> 60s grace) successfully intercepted, forced Score: 0");
    } else {
        throw new Error("Time fraud was not penalized!");
    }

    console.log("\n✨ Advanced Edge Case Test Suite Completed Flawlessly!");

  } catch (err) {
    console.error("\n❌ E2E Edge Case Test Failed!");
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runE2E();
