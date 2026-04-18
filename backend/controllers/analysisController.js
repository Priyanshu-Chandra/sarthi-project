const TestResult = require("../models/TestResult");
const Problem = require("../models/Problem");
const Test = require("../models/Test");
const MCQQuestion = require("../models/MCQQuestion");
const mongoose = require("mongoose");

// ─── Recommendation Map ──────────────────────────────────────────────────────
const RECOMMENDATION_MAP = {
  "Dynamic Programming": ["Memoization", "Tabulation", "Greedy Algorithms"],
  "Recursion":           ["Backtracking", "Divide and Conquer"],
  "Graphs":              ["BFS / DFS", "Topological Sort", "Shortest Path"],
  "Trees":               ["Binary Search Trees", "Tree Traversal", "Segment Trees"],
  "Arrays":              ["Two Pointers", "Sliding Window", "Prefix Sum"],
  "Strings":             ["Pattern Matching", "KMP Algorithm", "Tries"],
  "Sorting":             ["Merge Sort", "Quick Sort", "Heap Sort"],
  "Searching":           ["Binary Search", "Ternary Search"],
  "Hashing":             ["Hash Maps", "Collision Resolution"],
  "Linked Lists":        ["Fast & Slow Pointers", "Doubly Linked Lists"],
  "Stacks":              ["Monotonic Stack", "Expression Evaluation"],
  "Queues":              ["Priority Queues", "Deque Patterns"],
  "Heaps":               ["Min/Max Heaps", "K-Way Merge"],
  "Greedy":              ["Interval Scheduling", "Activity Selection"],
  "Math":                ["Number Theory", "Modular Arithmetic"],
  "Bit Manipulation":    ["Bitmasking", "XOR Tricks"],
};

const getRecommendations = (weakTopics) => {
  const recs = new Set();
  weakTopics.forEach((topic) => {
    const baseTopic = topic.replace(/\s*\(.*?\)\s*$/, "").trim();
    const mapped = RECOMMENDATION_MAP[baseTopic];
    if (mapped) mapped.forEach((r) => recs.add(r));
  });
  return [...recs];
};

const classifyTopic = (wrong, total) => {
  if (total === 0) return "average";
  const ratio = wrong / total;
  
  // Stricter classification for detailed insights
  if (ratio >= 0.3) return "weak";
  if (ratio < 0.1 && total >= 2) return "strong"; // Need at least 2 questions and <10% failure for strong
  return "average";
};

exports.computeTestAnalysis = async (testId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(testId)) {
    throw new Error("Invalid testId");
  }

  const result = await TestResult.findOne({
    testId,
    studentId: userId,
    status: "COMPLETED",
  }).sort({ createdAt: -1 });

  if (!result) return null;

  const test = await Test.findById(testId);
  if (!test) return null;

  let weakTopics   = [];
  let strongTopics = [];
  let topicBreakdown = [];

  // ─── MCQ Analysis ──────────────────────────────────────────────────────────
  if (test.testType === "MCQ" && result.studentAnswers?.length > 0) {
    const snapshotIds = (result.questionSnapshot || [])
      .filter((q) => q.mcqId)
      .map((q) => q.mcqId);

    const mcqIdTopicMap = {};
    if (snapshotIds.length > 0) {
      const mcqDocsById = await MCQQuestion.find({ _id: { $in: snapshotIds } }).select("_id topic");
      mcqDocsById.forEach((doc) => {
        mcqIdTopicMap[doc._id.toString()] = doc.topic;
      });
    }

    const allQuestions = result.studentAnswers.filter((a) => a.question).map((a) => a.question);
    const questionTextTopicMap = {};
    if (allQuestions.length > 0) {
      const mcqDocsByText = await MCQQuestion.find({ question: { $in: allQuestions } }).select("question topic");
      mcqDocsByText.forEach((doc) => {
        questionTextTopicMap[doc.question] = doc.topic;
      });
    }

    const snapshotMcqIdMap = {};
    (result.questionSnapshot || []).forEach((snap) => {
      if (snap.mcqId && snap.question) {
        snapshotMcqIdMap[snap.question] = snap.mcqId.toString();
      }
    });

    const topicStats = {};
    result.studentAnswers.forEach((ans) => {
      const mcqId = snapshotMcqIdMap[ans.question];
      const topic =
        (mcqId && mcqIdTopicMap[mcqId]) ||
        questionTextTopicMap[ans.question] ||
        "General";

      if (!topicStats[topic]) topicStats[topic] = { total: 0, wrong: 0 };
      topicStats[topic].total++;
      if (!ans.isCorrect) topicStats[topic].wrong++;
    });

    Object.entries(topicStats).forEach(([topic, stat]) => {
      const accuracy = stat.total > 0 ? Math.round(((stat.total - stat.wrong) / stat.total) * 100) : 0;
      const classification = classifyTopic(stat.wrong, stat.total);

      topicBreakdown.push({ topic, wrong: stat.wrong, total: stat.total, accuracy, classification });

      if (classification === "weak")   weakTopics.push(topic);
      if (classification === "strong") strongTopics.push(topic);
    });
  }

  // ─── CODING Analysis ───────────────────────────────────────────────────────
  if (test.testType === "CODING" && result.codingSubmissions?.length > 0) {
    const problemIds = result.codingSubmissions.map((s) => s.problemId).filter(Boolean);
    const problems = await Problem.find({ _id: { $in: problemIds } }).select("_id topic difficulty");

    const problemMap = {};
    problems.forEach((p) => {
      problemMap[p._id.toString()] = { topic: p.topic, difficulty: p.difficulty };
    });

    const topicStats = {};
    result.codingSubmissions.forEach((sub) => {
      const meta = problemMap[sub.problemId?.toString()];
      if (!meta) return;

      const topicKey = meta.difficulty
        ? `${meta.topic} (${meta.difficulty})`
        : meta.topic || "General";

      if (!topicStats[topicKey]) topicStats[topicKey] = { attempts: 0, passedCases: 0, totalCases: 0 };

      topicStats[topicKey].attempts++;
      topicStats[topicKey].passedCases += sub.passedTestCases || 0;
      topicStats[topicKey].totalCases  += sub.totalTestCases  || 1;
    });

    Object.entries(topicStats).forEach(([topic, stat]) => {
      const failureRatio = stat.totalCases > 0
        ? 1 - (stat.passedCases / stat.totalCases)
        : 1;

      const wrong = Math.round(failureRatio * stat.attempts);
      const accuracy = Math.round((1 - failureRatio) * 100);
      const classification = classifyTopic(wrong, stat.attempts);

      topicBreakdown.push({ topic, wrong, total: stat.attempts, accuracy, classification });

      if (classification === "weak")   weakTopics.push(topic);
      if (classification === "strong") strongTopics.push(topic);
    });
  }

  weakTopics   = [...new Set(weakTopics)];
  strongTopics = [...new Set(strongTopics)];

  const recommendations = getRecommendations(weakTopics);

  const percentage = result.score != null && result.totalQuestions
    ? Math.round((result.score / result.totalQuestions) * 100)
    : 0;

  const performanceTier =
    percentage === 100 ? "Perfect"    :
    percentage >= 90  ? "Excellent"  :
    percentage >= 75  ? "Good"       :
    percentage >= 50  ? "Average"    : "Needs Improvement";

  return {
    testType: test.testType,
    weakTopics,
    strongTopics,
    topicBreakdown,
    recommendations,
    performanceTier,
    percentage,
    cheatingSummary: {
      tabSwitchCount: result.tabSwitchCount || 0,
      multipleFacesDetected: result.multipleFacesDetected || false,
      cameraDisabled: result.cameraDisabled || false,
      lookingAwayCount: result.lookingAwayCount || 0,
      noiseDetected: result.noiseDetected || false,
      suspicious: result.suspicious || false,
    }
  };
};

exports.getPostTestAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;
    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({ success: false, message: "Invalid testId" });
    }

    const analysisData = await exports.computeTestAnalysis(testId, userId);

    if (!analysisData) {
      return res.status(404).json({ success: false, message: "Analysis not found" });
    }

    return res.status(200).json({
      success: true,
      data: analysisData,
    });
  } catch (err) {
    console.error("POST_TEST_ANALYSIS_ERROR", err);
    return res.status(500).json({ success: false, message: "Analysis failed" });
  }
};
