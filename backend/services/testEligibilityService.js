const Test = require("../models/Test");
const TestResult = require("../models/TestResult");

async function checkCourseEligibility(userId, courseId) {
  const tests = await Test.find({ courseId }).select("_id").lean();

  if (tests.length === 0) {
    return { eligible: true };
  }

  const testIds = tests.map((test) => test._id);

  const results = await TestResult.find({
    studentId: userId,
    testId: { $in: testIds },
  })
    .select("testId passed")
    .lean();

  const passedTestIds = new Set(
    results
      .filter((result) => result.passed === true)
      .map((result) => result.testId.toString())
  );

  const eligible = testIds.every((testId) =>
    passedTestIds.has(testId.toString())
  );

  return { eligible };
}

module.exports = {
  checkCourseEligibility,
};
