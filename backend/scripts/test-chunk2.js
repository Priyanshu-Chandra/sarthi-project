const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { connectDB } = require("../config/database");

const UserStats = require("../models/UserStats");
const Test = require("../models/Test");
const TestResult = require("../models/TestResult");
const Problem = require("../models/Problem");
const CodingActivity = require("../models/CodingActivity");

const { awardXP } = require("../utils/xpEngine");
const { checkAchievements } = require("../utils/achievementEngine");
const { computeTestAnalysis } = require("../controllers/analysisController");

async function runTests() {
  await connectDB();
  console.log("🟢 DB Connected. Starting Chunk 2 Tests...\n");
  
  const dummyUserId = new mongoose.Types.ObjectId();
  
  try {
    // ----------------------------------------------------
    // TEST 1: XP Breakdown Engine
    // ----------------------------------------------------
    console.log("🧪 TEST 1: XP Engine & Invisible Math Payload");
    
    // Simulate first solve of the day with a medium problem and 10 streak
    const xpResult = await awardXP(dummyUserId, "Medium", true, true, 10);
    
    if (!xpResult.xpBreakdown) throw new Error("❌ xpBreakdown is missing!");
    if (xpResult.xpBreakdown.baseXP !== 20) throw new Error("❌ Base XP incorrect for Medium!");
    if (xpResult.xpBreakdown.dailyBonus !== 5) throw new Error("❌ Daily Bonus missing!");
    if (xpResult.xpBreakdown.multiplier !== 1.2) throw new Error("❌ Streak multiplier incorrect!");
    
    console.log("✅ XP Engine successfully generates xpBreakdown payload:");
    console.log("   ", xpResult.xpBreakdown);
    console.log("\n----------------------------------------------------\n");

    // ----------------------------------------------------
    // TEST 2: Gamification & Next Achievements
    // ----------------------------------------------------
    console.log("🧪 TEST 2: Gamification Engine & Next Achievements");
    
    await UserStats.updateOne(
      { userId: dummyUserId },
      {
        $set: {
          problemsSolved: 9,
          xp: 450,
          level: 3
        }
      }
    );
    
    const achResult = await checkAchievements(dummyUserId);
    if (achResult.next.length === 0) throw new Error("❌ nextAchievements array is empty!");
    
    const tenProbObj = achResult.next.find(a => a.badge === "10_PROBLEMS");
    if (!tenProbObj) throw new Error("❌ 10_PROBLEMS milestone missing from next array!");
    if (tenProbObj.progress !== 9 || tenProbObj.target !== 10) throw new Error("❌ Milestone progress is incorrect!");
    
    console.log("✅ Gamification Engine correctly pipes milestone progression:");
    console.log("   Next Badges:", achResult.next.map(a => `${a.badge}: ${a.progress}/${a.target}`));
    console.log("\n----------------------------------------------------\n");

    // ----------------------------------------------------
    // TEST 3: Exam Integrity Payload
    // ----------------------------------------------------
    console.log("🧪 TEST 3: Exam Integrity & Proctoring Summary");
    
    const dummyTest = await Test.create({
      title: "Chunk 2 Integrity Test - " + Date.now(),
      description: "Auto test",
      duration: 60,
      testType: "MCQ", 
      status: "Published",
      questions: [],
      createdBy: dummyUserId,
      courseId: dummyUserId
    });
    
    const dummyResult = await TestResult.create({
      studentId: dummyUserId,
      testId: dummyTest._id,
      score: 80,
      totalQuestions: 100,
      completed: true,
      
      // Cheating metrics injected natively
      tabSwitchCount: 4,
      multipleFacesDetected: true,
      cameraDisabled: false,
      lookingAwayCount: 15,
      suspicious: true
    });
    
    const analysisPayload = await computeTestAnalysis(dummyTest._id, dummyUserId);
    
    if (!analysisPayload) throw new Error("❌ Test analysis payload is null");
    if (!analysisPayload.cheatingSummary) throw new Error("❌ cheatingSummary is missing from payload!");
    if (analysisPayload.cheatingSummary.tabSwitchCount !== 4) throw new Error("❌ Proctoring metrics failed mapping (Tab Switch)!");
    if (analysisPayload.cheatingSummary.multipleFacesDetected !== true) throw new Error("❌ Proctoring metrics failed mapping (Faces)!");
    
    console.log("✅ Exam Integrity successfully aggregates cheatingSummary:");
    console.log("   ", analysisPayload.cheatingSummary);
    console.log("\n----------------------------------------------------\n");

    console.log("🎉 ALL CHUNK 2 TESTS PASSED SUCCESSFULLY! The APIs and Engines are mathematically sound.");

  } catch (error) {
    console.error("🚨 TEST FAILED:", error.message || error);
    process.exitCode = 1;
  } finally {
    // Cleanup
    await UserStats.deleteOne({ userId: dummyUserId });
    await TestResult.deleteMany({ userId: dummyUserId });
    await Test.deleteMany({ description: "Auto test" });
    
    mongoose.connection.close();
  }
}

runTests();
