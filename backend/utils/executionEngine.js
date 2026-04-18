const crypto = require("crypto");
const { runOne } = require("./localProvider");
const { mapRunResult, mapTestResult } = require("./statusMapper");

const DEFAULT_TIME_LIMIT_MS = 2000;
const DEFAULT_MEMORY_LIMIT_MB = 256;

const MAX_TIME_LIMIT = 3000;          // absolute cap (3s)
const MAX_INPUT_SIZE = 10000;         // 10KB
const MAX_OUTPUT_SIZE = 1024 * 1024;  // 1MB

const resolveLimits = (limits = {}) => ({
  timeLimit: Number(limits.timeLimit) > 0 ? Number(limits.timeLimit) : DEFAULT_TIME_LIMIT_MS,
  memoryLimit: Number(limits.memoryLimit) > 0 ? Number(limits.memoryLimit) : DEFAULT_MEMORY_LIMIT_MB,
});

/**
 * validateSignature
 * ─────────────────────────────────────────────────────────────────────────────
 * Elite V5: Strict Language-Aware Signature Validation.
 */
const validateSignature = (code, language, functionName) => {
  if (!functionName) return true;
  
  let regex;
  if (language === "python") {
    regex = new RegExp(`def\\s+${functionName}\\s*\\(`);
  } else if (language === "cpp" || language === "c") {
    regex = new RegExp(`\\b(?:int|void|bool|long|double|string|vector<.*?>)\\s+${functionName}\\s*\\(`);
  } else if (language === "java") {
    regex = new RegExp(`\\b(?:public|private|protected)?\\s*(?:static)?\\s*\\w+\\s+${functionName}\\s*\\(`);
  } else {
    regex = new RegExp(`\\b${functionName}\\s*\\(`);
  }
  
  if (!regex.test(code)) {
    throw new Error(`Execution Denied: Missing or malformed function signature for '${functionName}'.`);
  }
  return true;
};

/**
 * injectBoilerplate
 */
const injectBoilerplate = (code, boilerplate = {}) => {
  const parts = [
    boilerplate.prefix || "",
    code || "",
    boilerplate.driverCode || ""
  ];
  return parts.filter(Boolean).join("\n\n");
};

/**
 * runSingle
 * ─────────────────────────────────────────────────────────────────────────────
 * Raw execution for custom inputs. Returns unmapped run result.
 */
const runSingle = async ({ code, language, input = "", limits = {}, boilerplate = {} }) => {
  const executionId = crypto.randomUUID();
  if (input && input.length > MAX_INPUT_SIZE) {
    throw new Error(`Input too large (max ${MAX_INPUT_SIZE} characters)`);
  }

  if (boilerplate && boilerplate.functionName) {
    validateSignature(code, language, boilerplate.functionName);
  }

  const resolved = resolveLimits(limits);
  resolved.timeLimit = Math.min(resolved.timeLimit, MAX_TIME_LIMIT);

  const finalCode = injectBoilerplate(code, boilerplate);

  const raw = await runOne({
    code: finalCode,
    language,
    input,
    timeLimit: resolved.timeLimit,
    memoryLimit: resolved.memoryLimit,
  });
  
  return mapRunResult(raw);
};

/**
 * runTestsSequentially
 * ─────────────────────────────────────────────────────────────────────────────
 * Elite V5 Multi-Result Runner:
 * Runs a set of tests and returns an array of structured mappings.
 * Automatically redacts content for hidden tests to maintain privacy.
 */
const runTestsSequentially = async ({ tests, code, language, limits, boilerplate = {} }) => {
  const testResults = [];
  let passedCount = 0;
  let totalTime = 0;
  let maxMemory = 0;

  const finalCode = injectBoilerplate(code, boilerplate);

  for (let i = 0; i < tests.length; i++) {
    const testCase = tests[i];
    const isPublic = testCase.type === "public" || !testCase.type;

    const raw = await runOne({
      code: finalCode,
      language,
      input: testCase.input || "",
      timeLimit: limits.timeLimit,
      memoryLimit: limits.memoryLimit,
    });

    const mapped = mapTestResult(raw, testCase.expectedOutput);
    
    totalTime += Number(mapped.time || 0);
    maxMemory = Math.max(maxMemory, Number(mapped.memory || 0));

    if (mapped.passed) passedCount += 1;

    // Build structured result item
    const resultItem = {
      testIndex: i + 1,
      isPublic,
      passed: mapped.passed,
      status: mapped.appStatus,
      time: mapped.time,
      memory: mapped.memory,
      // Privacy Protection: Only expose data for public tests
      input: isPublic ? testCase.input : null,
      expected: isPublic ? testCase.expectedOutput : null,
      actual: isPublic ? (mapped.stdout || "") : null,
      error: isPublic ? (mapped.stderr || mapped.compile_output || null) : null,
      // For failed non-public tests, we still provide the status but hide content
    };

    testResults.push(resultItem);

    // Optional: Standard LeetCode stops after FIRST failure for performance?
    // User asked "show all test cases with structure" - so we run them all.
    // If you want to optimize for large test sets, you could break if (!mapped.passed && !isPublic)
  }

  return { testResults, passedCount, totalTime, maxMemory };
};

/**
 * runSubmission
 * ─────────────────────────────────────────────────────────────────────────────
 * Full evaluation: Public + Hidden.
 */
const runSubmission = async ({ 
  code, 
  language, 
  publicTests = [], 
  hiddenTests = [], 
  limits = {},
  boilerplate = {} 
}) => {
  const executionId = crypto.randomUUID();
  const resolved = resolveLimits(limits);
  resolved.timeLimit = Math.min(resolved.timeLimit, MAX_TIME_LIMIT);

  if (boilerplate && boilerplate.functionName) {
    validateSignature(code, language, boilerplate.functionName);
  }

  try {
    // 1. Run Public Tests
    const publicData = await runTestsSequentially({
      tests: publicTests,
      code,
      language,
      limits: resolved,
      boilerplate
    });

    // 2. Run Hidden Tests only if Public passed 
    // OR: Run them anyway if user wants full transparency (We'll run them if public passed for efficiency)
    let hiddenData = { testResults: [], passedCount: 0, totalTime: 0, maxMemory: 0 };
    
    const allPublicPassed = publicData.passedCount === publicTests.length;
    
    // LeetCode behavior: Hidden tests are only run if public tests pass
    if (allPublicPassed && hiddenTests.length > 0) {
      hiddenData = await runTestsSequentially({
        tests: hiddenTests,
        code,
        language,
        limits: resolved,
        boilerplate
      });
    }

    const aggregatedResults = [...publicData.testResults, ...hiddenData.testResults];
    const totalPassed = publicData.passedCount + hiddenData.passedCount;
    const totalTests = publicTests.length + hiddenTests.length;
    
    // Determine overall status
    let finalStatus = "Accepted";
    const failedCase = aggregatedResults.find(r => !r.passed);
    if (failedCase) {
      finalStatus = failedCase.status;
    }

    return {
      status: finalStatus,
      passedCount: totalPassed,
      total: totalTests,
      totalTime: publicData.totalTime + hiddenData.totalTime,
      maxMemory: Math.max(publicData.maxMemory, hiddenData.maxMemory),
      testResults: aggregatedResults,
      failedTest: failedCase // Keep legacy support for single-detail consumers
    };

  } catch (error) {
    console.error("CODE_EXEC_CRITICAL_FAIL", error);
    return {
      status: "Runtime Error",
      error: error.message,
      passedCount: 0,
      total: publicTests.length + hiddenTests.length,
      testResults: []
    };
  }
};

module.exports = {
  DEFAULT_MEMORY_LIMIT_MB,
  DEFAULT_TIME_LIMIT_MS,
  runSingle,
  runSubmission,
  runTestsSequentially
};
