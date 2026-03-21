const express = require("express");
const {
  createStudyPlan,
  adaptExistingStudyPlan,
  updateStudyPlanProgress,
} = require("../services/studyPlannerService");

const router = express.Router();

router.post("/study-plan", async (req, res) => {
  try {
    const { goal, duration, dailyHours, level, weaknesses } = req.body;

    const result = await createStudyPlan({
      goal,
      duration,
      dailyHours,
      level,
      weaknesses,
    });

    return res.json({
      success: true,
      planId: result.planId,
      plan: result.plan,
    });
  } catch (error) {
    console.error("Study planner error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not generate study plan",
    });
  }
});

router.put("/study-plan/:id/progress", async (req, res) => {
  try {
    const { id } = req.params;
    const { week, day, completed } = req.body;

    const result = await updateStudyPlanProgress(id, {
      week,
      day,
      completed,
    });

    return res.json({
      success: true,
      planId: result.planId,
      plan: result.plan,
    });
  } catch (error) {
    console.error("Study plan progress update error:", error);

    if (
      error.message === "Study plan not found" ||
      error.message === "Week not found" ||
      error.message === "Day not found"
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Could not update study plan progress",
    });
  }
});

router.post("/study-plan/:id/adapt", async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const result = await adaptExistingStudyPlan(id, message);

    return res.json({
      success: true,
      planId: result.planId,
      plan: result.plan,
    });
  } catch (error) {
    console.error("Study plan adapt error:", error);

    if (error.message === "Study plan not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Could not adapt study plan",
    });
  }
});

module.exports = router;
