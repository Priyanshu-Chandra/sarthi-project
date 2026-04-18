const Problem = require("../models/Problem");
const mongoose = require("mongoose");

exports.getAllProblems = async (req, res) => {
  try {
    const { difficulty, topic, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Build query filter
    const filter = {};
    if (difficulty) filter.difficulty = difficulty;
    if (topic) filter.topic = topic;
    
    let queryOptions = {};
    if (search) {
      // Use efficient text search via text index
      filter.$text = { $search: search };
      queryOptions = { score: { $meta: "textScore" } };
    }

    const problemQuery = Problem.find(filter, queryOptions).select("-starterCode -testCases");
    
    // Sort by text relevance if search exists, else by newest (default behavior)
    if (search) {
        problemQuery.sort({ score: { $meta: "textScore" } });
    } else {
        problemQuery.sort({ createdAt: -1 }); // Default fallback, adjust if needed
    }

    // Pagination
    const problems = await problemQuery.skip((page - 1) * limit).limit(limit);
    const totalProblems = await Problem.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: problems,
      total: totalProblems,
      totalPages: Math.ceil(totalProblems / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("GET_ALL_PROBLEMS_ERROR", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch problems",
    });
  }
};

exports.getProblemById = async (req, res) => {
  try {
    const { id } = req.params;
    let problem;

    // 1. Try finding by ObjectId if it's a valid format
    if (mongoose.Types.ObjectId.isValid(id)) {
      problem = await Problem.findById(id).select("-testCases");
    }

    // 2. If not found or not an ID, try finding by Slug (Elite V5)
    if (!problem) {
      problem = await Problem.findOne({ slug: id }).select("-testCases");
    }
    
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: "Problem not found",
      });
    }

    res.status(200).json({
      success: true,
      data: problem,
    });
  } catch (error) {
    console.error("GET_PROBLEM_BY_ID_ERROR", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch problem",
    });
  }
};
