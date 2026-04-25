const Problem = require("../models/Problem");
const CodeSubmission = require("../models/CodeSubmission");
const TestResult = require("../models/TestResult");
const { computeTestAnalysis } = require("./analysisController");

exports.getPersonalizedRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Fetch solved problems efficiently using .distinct()
    const solvedIdsObj = await CodeSubmission.distinct("problemId", {
      userId,
      status: "Accepted"
    });
    const solvedIds = solvedIdsObj.map(id => id.toString());

    // 2️⃣ Fetch last completed test
    const lastTest = await TestResult.findOne({
      studentId: userId,
      status: "COMPLETED"
    }).sort({ createdAt: -1 });

    let weakTopics = [];

    if (lastTest) {
      const analysis = await computeTestAnalysis(lastTest.testId, userId);
      if (analysis && analysis.weakTopics) {
        weakTopics = analysis.weakTopics;
      }
    }

    // Extract topic names
    let topics = weakTopics.map(t =>
      t.replace(/\((Easy|Medium|Hard)\)/i, "").trim()
    );

    // 3️⃣ Fallback if no weak topics exist (Cold Start)
    if (topics.length === 0) {
      const randomProblems = await Problem.aggregate([
        { $match: { _id: { $nin: solvedIdsObj } } },
        { $sample: { size: 6 } },
        { $project: { title: 1, difficulty: 1, topic: 1, slug: 1 } }
      ]);

      return res.status(200).json({
        success: true,
        data: randomProblems
      });
    }

    // 4️⃣ Fetch recent submissions to prevent over-recommending saturated topics
    const recentSubmissions = await CodeSubmission.find({
      userId,
      status: "Accepted"
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("problemId", "topic");

    const recentSolvedCounts = {};
    recentSubmissions.forEach((s) => {
      const topic = s.problemId?.topic;
      if (!topic) return;
      recentSolvedCounts[topic] = (recentSolvedCounts[topic] || 0) + 1;
    });

    // 5️⃣ Fetch failed attempts to calculate Learning Velocity "struggle scores"
    const failedAttempts = await CodeSubmission.find({
      userId,
      status: { $ne: "Accepted" }
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("problemId", "topic");

    const struggleScores = {};
    failedAttempts.forEach(a => {
      const topic = a.problemId?.topic;
      if (!topic) return;
      struggleScores[topic] = (struggleScores[topic] || 0) + 2;
    });

    // 6️⃣ Fetch candidate problems (bounded by .limit(50))
    const candidates = await Problem.find({
      topic: { $in: topics },
      _id: { $nin: solvedIds }
    })
      .select("title difficulty topic slug")
      .limit(50);

    // Filter out heavily practiced topics
    const filtered = candidates.filter((p) => {
      const recent = recentSolvedCounts[p.topic] || 0;
      return recent < 3;
    });

    const finalCandidates = filtered.length ? filtered : candidates;

    // 7️⃣ Topic Diversification & Sorting
    const grouped = {};
    finalCandidates.forEach((problem) => {
      if (!grouped[problem.topic]) {
        grouped[problem.topic] = [];
      }
      grouped[problem.topic].push(problem);
    });

    // Sort internal groups by difficulty
    const difficultyRank = { Easy: 1, Medium: 2, Hard: 3 };
    Object.keys(grouped).forEach(top => {
      grouped[top].sort((a, b) => {
        return (difficultyRank[a.difficulty] || 1) - (difficultyRank[b.difficulty] || 1);
      });
    });

    // Sort the group keys by struggle score to prioritize high-fail topics
    const sortedTopics = Object.keys(grouped).sort((a, b) => {
      const scoreA = struggleScores[a] || 0;
      const scoreB = struggleScores[b] || 0;
      return scoreB - scoreA; // descending
    });

    const diversified = [];
    sortedTopics.forEach(top => {
      if (grouped[top].length > 0) {
        diversified.push(grouped[top][0]);
      }
    });

    // Fill remaining slots
    const remaining = finalCandidates.filter(
      (p) => !diversified.find((d) => d._id.toString() === p._id.toString())
    );

    const finalList = [...diversified, ...remaining].slice(0, 6);

    res.status(200).json({
      success: true,
      data: finalList
    });

  } catch (err) {
    console.error("RECOMMENDATION_ERROR", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate recommendations"
    });
  }
};

exports.getDailyChallenge = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Seed index based on UTC date
    const todayStr = new Date().toLocaleDateString("en-CA");
    const seed = Array.from(todayStr).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const count = await Problem.countDocuments();
    if (count === 0) {
      return res.status(404).json({ success: false, message: "No problems found" });
    }

    const index = seed % count;
    
    // Efficient scan for modest scale
    const dailyProblem = await Problem.findOne()
      .skip(index)
      .select("title difficulty topic slug")
      .lean();
    
    // Check if the current user has already solved it
    const solved = await CodeSubmission.findOne({
      userId,
      problemId: dailyProblem._id,
      status: "Accepted"
    });

    res.status(200).json({
      success: true,
      data: {
        problem: dailyProblem,
        isSolved: !!solved
      }
    });
  } catch (err) {
    console.error("DAILY_CHALLENGE_ERROR", err);
    res.status(500).json({ success: false, message: "Failed to load daily challenge" });
  }
};
