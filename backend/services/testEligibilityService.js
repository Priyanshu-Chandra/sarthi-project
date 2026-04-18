const Test = require("../models/Test");
const TestResult = require("../models/TestResult");

async function checkCourseEligibility(userId, courseId) {
  const tests = await Test.find({ courseId }).select("_id").lean();

  if (tests.length === 0) {
    return { eligible: true, reason: "ELIGIBLE" };
  }

  const testIds = tests.map((test) => test._id);

  const results = await TestResult.find({
    studentId: userId,
    testId: { $in: testIds },
  })
    .select("testId passed status suspicious")
    .lean();

  // Check for cheating ONLY within tests for this specific course
  const hasCheatedInCourse = results.some(
    (attempt) =>
      attempt.status === "CHEATED" || attempt.suspicious === true
  );

  if (hasCheatedInCourse) {
    return { eligible: false, reason: "CHEATING_DETECTED" };
  }

  const resultsByTestId = new Map();

  results.forEach((result) => {
    const key = result.testId.toString();

    if (!resultsByTestId.has(key)) {
      resultsByTestId.set(key, []);
    }

    resultsByTestId.get(key).push(result);
  });

  const eligible = testIds.every((testId) => {
    const attempts = resultsByTestId.get(testId.toString()) || [];
    const hasAttempted = attempts.length > 0;
    const hasPassed = attempts.some((attempt) => attempt.passed === true);
    const hasCheated = attempts.some(
      (attempt) =>
        attempt.status === "CHEATED" || attempt.suspicious === true
    );

    return hasAttempted && hasPassed && !hasCheated;
  });

  return {
    eligible,
    reason: eligible ? "ELIGIBLE" : "NOT_ALL_TESTS_PASSED",
  };
}

module.exports = {
  checkCourseEligibility,
};
