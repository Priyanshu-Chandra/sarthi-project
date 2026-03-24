const express = require("express");
const router = express.Router();
const { generateAIResponse } = require("../services/aiService");
const { 
  createStudyPlan, 
  getUserStudyPlans, 
  updateStudyPlanProgress, 
  adaptExistingStudyPlan,
  deleteStudyPlan
} = require("../services/studyPlannerService");
const { auth, isStudent } = require("../middleware/auth");

router.post("/", (req, res) => {
  try {
    const { message, history, courseId } = req.body;
    if (!message) return res.status(400).json({ reply: "Message missing" });

    return Promise.resolve(generateAIResponse(message, history, courseId))
      .then((result) => res.json({ reply: result }))
      .catch((err) => {
        console.error("Chat error:", err);
        res.status(500).json({ reply: "Server error" });
      });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ reply: "Server error" });
  }
});

// ── AI Study Plan / Roadmap ──────────────────────────────────────────────────
router.post("/study-plan", auth, isStudent, async (req, res) => {
  try {
    const { goal, duration, dailyHours, level, weaknesses } = req.body;
    if (!goal) {
      return res.status(400).json({ success: false, message: "goal is required" });
    }
    const result = await createStudyPlan(req.user.id, {
      goal,
      duration,
      dailyHours,
      level,
      weaknesses,
    });
    return res.json({ success: true, planId: result.planId, plan: result.plan });
  } catch (err) {
    console.error("Study plan error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/study-plan/my-plans", auth, isStudent, async (req, res) => {
  try {
    const plans = await getUserStudyPlans(req.user.id);
    return res.json({ success: true, plans });
  } catch (err) {
    console.error("Fetch plans error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/study-plan/:planId/progress", auth, isStudent, async (req, res) => {
  try {
    const { planId } = req.params;
    const { progress } = req.body; // { week, day, completed }
    const result = await updateStudyPlanProgress(planId, progress);
    return res.json({ success: true, planId: result.planId, plan: result.plan });
  } catch (err) {
    console.error("Update progress error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/study-plan/:planId/adapt", auth, isStudent, async (req, res) => {
  try {
    const { planId } = req.params;
    const { message } = req.body;
    const result = await adaptExistingStudyPlan(planId, message);
    return res.json({ success: true, planId: result.planId, plan: result.plan });
  } catch (err) {
    console.error("Adapt plan error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/study-plan/:planId", auth, isStudent, async (req, res) => {
  try {
    const { planId } = req.params;
    await deleteStudyPlan(req.user.id, planId);
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete plan error:", err);
    const is404 = err.message === "Study plan not found or access denied";
    res.status(is404 ? 404 : 500).json({ success: false, message: err.message || "Server error" });
  }
});

module.exports = router;

