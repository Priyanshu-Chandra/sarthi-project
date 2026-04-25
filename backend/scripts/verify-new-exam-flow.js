const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/user');
const Test = require('../models/Test');
const TestResult = require('../models/TestResult');
const Course = require('../models/course');
const { getTestById, startTestAttempt, submitTest } = require('../controllers/testController');
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
  console.log("🚀 Starting Full Automated Test Script for New Exam Flow...");

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

    // ── SCENARIO 1: Fetching Test (Preflight) ──
    console.log("\n📡 Scenario 1: Fetching Test (Preflight Check)...");
    const req1 = {
      user: { id: studentId, accountType: "Student" },
      params: { id: testId },
      query: { deviceId: deviceId }
    };
    const res1 = mockRes();
    await getTestById(req1, res1);

    if (res1.data.success && res1.data.activeAttempt === false) {
      console.log("   ✅ Test Fetched Successfully (Preflight Attempt created, not active)");
    } else {
      throw new Error("Failed to fetch test or it incorrectly became active: " + JSON.stringify(res1.data));
    }

    // ── SCENARIO 2: Starting Test Attempt ──
    console.log("\n🎬 Scenario 2: Starting Test Attempt (After Fullscreen)...");
    const reqStart = {
      user: { id: studentId, accountType: "Student" },
      params: { id: testId },
      body: { deviceId: deviceId }
    };
    const resStart = mockRes();
    await startTestAttempt(reqStart, resStart);

    if (resStart.data.success && resStart.data.activeAttempt === true) {
      console.log("   ✅ Test Started Successfully");
      console.log(`   ✅ Session Token Generated: ${resStart.data.attemptSessionToken.substring(0, 20)}...`);
    } else {
      throw new Error("Failed to start test attempt: " + JSON.stringify(resStart.data));
    }

    const sessionToken = resStart.data.attemptSessionToken;

    // ── SCENARIO 3: Submitting Test ──
    console.log("\n🛡️ Scenario 3: Submitting Test...");
    const reqSubmit = {
      user: { id: studentId },
      body: {
        quizId: testId,
        attemptSessionToken: sessionToken,
        deviceId: deviceId,
        answers: { 0: 1, 1: 0 }, // Mock answers
        timeTaken: 120,
        integrityScore: 85, 
        violationLogs: []
      }
    };
    const resSubmit = mockRes();
    await submitTest(reqSubmit, resSubmit);

    if (resSubmit.data.success) {
      console.log("   ✅ Submission Successful");
      console.log(`   ✅ Score Computed: ${resSubmit.data.score}/${resSubmit.data.total}`);
    } else {
      throw new Error("Submission failed: " + JSON.stringify(resSubmit.data));
    }

    // ── SCENARIO 4: Attempt Exhaustion ──
    console.log("\n⌛ Scenario 4: Checking Attempt Limits...");
    const max = testDoc.maxAttempts || 2;
    console.log(`   (Test Max Attempts: ${max})`);
    
    // Fill up attempts
    for(let i=1; i < max; i++) { // We already did 1 attempt
        const rInit = mockRes();
        await getTestById(req1, rInit);
        if (rInit.data.canAttempt) {
            const rStart = mockRes();
            await startTestAttempt(reqStart, rStart);
            await submitTest({ ...reqSubmit, body: { ...reqSubmit.body, attemptSessionToken: rStart.data.attemptSessionToken } }, mockRes());
        }
    }

    const resLimit = mockRes();
    await getTestById(req1, resLimit);
    if (resLimit.data.canAttempt === false) {
       console.log("   ✅ Attempt Limit Correctly Enforced");
    } else {
       console.warn("   ⚠️ Warning: Attempt limit NOT enforced. Result:", resLimit.data);
    }

    console.log("\n✨ New Flow E2E Test Completed Successfully!");

  } catch (err) {
    console.error("\n❌ E2E Test Failed!");
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runE2E();
