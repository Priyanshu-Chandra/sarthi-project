const TestResult = require("../models/TestResult");
const { calculateRisk } = require("../utils/riskEngine");

exports.getCheatingSummary = async (req, res) => {
  try {
    const { testId } = req.params;

    const results = await TestResult.find({ 
      $or: [{ testId }, { quizId: testId }],
      status: { $in: ["COMPLETED", "CHEATED"] } 
    }).lean();

    const summary = { safe: 0, suspicious: 0, high: 0, avgRiskScore: 0, highRiskRatio: 0 };
    let totalRiskScore = 0;

    results.forEach(r => {
      const { score, level } = calculateRisk(r);
      totalRiskScore += score;
      
      if (level === "HIGH") summary.high++;
      else if (level === "SUSPICIOUS") summary.suspicious++;
      else summary.safe++;
    });

    summary.avgRiskScore = results.length === 0 
      ? 0 
      : Number((totalRiskScore / results.length).toFixed(1));

    summary.highRiskRatio = results.length === 0
      ? 0
      : Number(((summary.high / results.length) * 100).toFixed(1));

    res.json(summary);
  } catch (err) {
    console.error("Cheating Summary Error:", err);
    res.status(500).json({ error: "Failed to fetch cheating summary" });
  }
};

exports.getCheatingAnalysis = async (req, res) => {
  try {
    const { testId } = req.params;

    const results = await TestResult.find({ 
      $or: [{ testId }, { quizId: testId }],
      status: { $in: ["COMPLETED", "CHEATED"] } 
    })
    .populate("studentId", "firstName lastName email")
    .lean();

    const flagged = results.map(r => {
      const { score, level } = calculateRisk(r);

      // Auto-mark cheating should be a synchronous background job on test submission 
      // (Not on GET API), maintaining strictly RESTful design.

      return {
        student: `${r.studentId?.firstName || "Unknown"} ${r.studentId?.lastName || ""}`.trim(),
        email: r.studentId?.email,
        score: r.score,
        riskScore: score,
        riskPercent: Math.min((score / 20) * 100, 100),
        riskLevel: level,

        riskBreakdown: {
          tabSwitch: r.tabSwitchCount || 0,
          multipleFaces: r.multipleFacesDetected || false,
          cameraDisabled: r.cameraDisabled || false,
          lookingAway: r.lookingAwayCount || 0,
          noise: r.noiseDetected || false
        }
      };
    });

    // sort by highest risk
    flagged.sort((a, b) => b.riskScore - a.riskScore);

    res.json(flagged);

  } catch (err) {
    console.error("Cheating Analysis Error:", err);
    res.status(500).json({ error: "Failed to fetch cheating analysis" });
  }
};
