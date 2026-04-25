const TestResult = require("../models/TestResult");
const MCQQuestion = require("../models/MCQQuestion");
const Problem = require("../models/Problem");

exports.getExamOverview = async (req, res) => {
  try {
    const { testId } = req.params;
    const { Types } = require("mongoose");
    const Test = require("../models/Test");
    
    if (!Types.ObjectId.isValid(testId)) {
       return res.status(400).json({ error: "Invalid testId format" });
    }

    const oid = new Types.ObjectId(testId);
    
    // Fetch test details for passing threshold (default to 40 if not set)
    const test = await Test.findById(oid).select("passingScore");
    const PASS_THRESHOLD = test?.passingScore || 40;

    console.log(`[Analytics] Fetching overview for Test: ${testId} (Pass Threshold: ${PASS_THRESHOLD})`);

    const aggregateStats = await TestResult.aggregate([
      { 
        $match: { 
          $or: [{ testId: oid }, { quizId: oid }],
          status: { $in: ["COMPLETED", "CHEATED"] } 
        } 
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: { $ifNull: ["$score", 0] } },
          highest: { $max: "$score" },
          lowest: { $min: "$score" },
          totalStudents: { $sum: 1 },
          passCount: {
            $sum: {
              $cond: [
                { $or: ["$passed", { $gte: [{ $ifNull: ["$score", 0] }, PASS_THRESHOLD] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    if (!aggregateStats || aggregateStats.length === 0) {
      console.log(`[Analytics] No results found for Test: ${testId}`);
      return res.json({ totalStudents: 0 });
    }

    const stats = aggregateStats[0];
    const passRate = stats.totalStudents === 0 ? 0 : (stats.passCount / stats.totalStudents) * 100;

    console.log(`[Analytics] Success! Found ${stats.totalStudents} participants for Test: ${testId}`);

    res.json({
      avgScore: Number((stats.avgScore || 0).toFixed(1)),
      passRate: Number(passRate.toFixed(1)),
      highest: stats.highest || 0,
      lowest: stats.lowest || 0,
      totalStudents: stats.totalStudents
    });

  } catch (err) {
    console.error("Exam Overview Error:", err);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
};

exports.getFailedQuestions = async (req, res) => {
  try {
    const { testId } = req.params;

    const results = await TestResult.find({ 
      $or: [{ testId }, { quizId: testId }],
      status: { $in: ["COMPLETED", "CHEATED"] } 
    }).lean();

    const questionStats = {};

    results.forEach(r => {
      // Handle MCQ Answers
      if (r.studentAnswers && Array.isArray(r.studentAnswers)) {
        r.studentAnswers.forEach(ans => {
          const qid = String(ans.question || "");
          if (!qid) return;

          if (!questionStats[qid]) {
            questionStats[qid] = { wrong: 0, total: 0, text: ans.question, type: "[MCQ]" };
          }

          questionStats[qid].total += 1;

          if (!ans.isCorrect) {
            questionStats[qid].wrong += 1;
          }
        });
      }
      
      // Handle Coding Submissions (Optional for completeness)
      if (r.codingSubmissions && Array.isArray(r.codingSubmissions)) {
        r.codingSubmissions.forEach(sub => {
           const pid = String(sub.problemId || "");
           if (!pid || pid === "undefined") return;

           if (!questionStats[pid]) {
             questionStats[pid] = { wrong: 0, total: 0, text: pid, type: "[CODING]" };
           }

           questionStats[pid].total += 1;
           if (sub.status !== "Accepted") {
             questionStats[pid].wrong += 1;
           }
        });
      }
    });

    const output = await Promise.all(Object.keys(questionStats).map(async (qid) => {
      const { wrong, total, type } = questionStats[qid];
      let { text } = questionStats[qid];
      const failureRate = total === 0 ? 0 : Number(((wrong / total) * 100).toFixed(1));

      try {
        if (type === "[MCQ]") {
          const qObj = await MCQQuestion.findById(qid).select("question");
          if (qObj) text = qObj.question;
        } else if (type === "[CODING]") {
          const pObj = await Problem.findById(qid).select("title");
          if (pObj) text = pObj.title;
        }
      } catch (e) {
        // ignore ID parse errors for deleted entities
      }

      return {
        questionId: qid,
        questionText: text,
        type,
        failureRate
      };
    }));

    // sort by most failed
    output.sort((a, b) => b.failureRate - a.failureRate);

    res.json(output.slice(0, 5)); // top 5

  } catch (err) {
    console.error("Failed Questions Error:", err);
    res.status(500).json({ error: "Failed to fetch failed questions" });
  }
};

exports.getTopPerformers = async (req, res) => {
  try {
    const { testId } = req.params;
    const results = await TestResult.find({ 
      $or: [{ testId }, { quizId: testId }],
      status: { $in: ["COMPLETED", "CHEATED"] } 
    })
      .sort({ score: -1 })
      .limit(15) // Fetch slightly more to handle ties within top 10
      .populate("studentId", "firstName lastName email")
      .lean();

    let currentRank = 1;
    const ranking = results.map((r, index) => {
      if (index > 0 && r.score < results[index - 1].score) {
        currentRank = index + 1;
      }
      return {
        rank: currentRank,
        name: `${r.studentId?.firstName || 'Unknown'} ${r.studentId?.lastName || ''}`.trim(),
        email: r.studentId?.email,
        score: r.score || 0
      };
    });

    res.json(ranking.slice(0, 10)); // return strict top 10
  } catch (err) {
    console.error("Top Performers Error:", err);
    res.status(500).json({ error: "Failed to fetch top performers" });
  }
};
