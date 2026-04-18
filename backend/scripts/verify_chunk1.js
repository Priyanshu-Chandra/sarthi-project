const mongoose = require('mongoose');
const achievementManifest = require('../utils/achievementManifest');
const achievementEngine = require('../utils/achievementEngine');
const systemController = require('../controllers/systemController');
const executionQueue = require('../utils/executionQueue');

async function runTests() {
  console.log("🚀 Starting Chunk 1 Verification Tests...\n");
  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  };

  // Test 1: Achievement Manifest validation
  console.log("--- Test 1: Achievement Manifest ---");
  try {
    assert(Array.isArray(achievementManifest), "Manifest is an array");
    assert(achievementManifest.length === 10, "Manifest has 10 default achievements");
    const fastSolver = achievementManifest.find(a => a.code === 'FAST_SOLVER');
    assert(fastSolver && fastSolver.category === 'PERFORMANCE', "Fast Solver is correctly defined");
  } catch (err) {
    console.error(err);
    failed++;
  }

  // Test 2: System Controller - getAchievementManifest
  console.log("\n--- Test 2: System Controller (Manifest) ---");
  try {
    const mockRes1 = {
      status: function(s) {
        this.statusCode = s;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      }
    };
    systemController.getAchievementManifest({}, mockRes1);
    assert(mockRes1.statusCode === 200, "getAchievementManifest returns 200 status");
    assert(mockRes1.data && mockRes1.data.success === true, "getAchievementManifest returns success=true");
    assert(mockRes1.data && mockRes1.data.data.length === 10, "getAchievementManifest returns full manifest data");
  } catch (err) {
    console.error(err);
    failed++;
  }

  // Test 3: System Controller - getQueueMetrics
  console.log("\n--- Test 3: System Controller (Queue Metrics) ---");
  try {
    const mockRes2 = {
      status: function(s) {
        this.statusCode = s;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      }
    };
    systemController.getQueueMetrics({}, mockRes2);
    assert(mockRes2.statusCode === 200, "getQueueMetrics returns 200 status");
    assert(mockRes2.data && mockRes2.data.success === true, "getQueueMetrics returns success=true");
    assert(mockRes2.data && mockRes2.data.data.running !== undefined, "getQueueMetrics payload contains running metric");
  } catch (err) {
    console.error(err);
    failed++;
  }

  // Test 4: Verify Auth Middleware exports (Since we fixed the spelling from middlewares to middleware)
  console.log("\n--- Test 4: Auth Middleware Path Check ---");
  try {
    const { auth, isAdmin } = require('../middleware/auth');
    assert(typeof auth === 'function', "auth middleware successfully loaded from correct path");
    assert(typeof isAdmin === 'function', "isAdmin middleware successfully loaded from correct path");
  } catch (err) {
    console.error(`❌ FAIL: Middleware path is still broken! Error: ${err.message}`);
    failed++;
  }

  console.log("\n--- Verification Complete ---");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests();
