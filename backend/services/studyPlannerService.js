const StudyPlan = require("../models/studyPlan");
const {
  generateStudyPlan: generateStudyPlanContent,
  adaptStudyPlan,
} = require("./aiService");

async function createStudyPlan(userId, data = {}) {
  const normalizedWeaknesses = Array.isArray(data.weaknesses)
    ? data.weaknesses.filter(Boolean)
    : data.weaknesses
      ? [data.weaknesses]
      : [];

  const plan = await generateStudyPlanContent({
    ...data,
    weaknesses: normalizedWeaknesses,
  });

  const savedPlan = await StudyPlan.create({
    user: userId,
    goal: data.goal || "",
    duration: data.duration || "",
    dailyHours: data.dailyHours ?? "",
    level: data.level || "",
    weaknesses: normalizedWeaknesses,
    plan,
  });

  return {
    planId: savedPlan._id.toString(),
    plan: savedPlan.plan,
  };
}

async function updateStudyPlanProgress(planId, progress = {}) {
  const { week, day, completed } = progress;

  const studyPlan = await StudyPlan.findById(planId);
  if (!studyPlan) {
    throw new Error("Study plan not found");
  }

  const weekNumber = Number(week);
  const dayNumber = Number(day);

  const targetWeek = Array.isArray(studyPlan.plan?.weeks)
    ? studyPlan.plan.weeks.find((item) => item?.week === weekNumber)
    : null;

  if (!targetWeek) {
    throw new Error("Week not found");
  }

  const targetDay = Array.isArray(targetWeek.days)
    ? targetWeek.days.find((item) => item?.day === dayNumber)
    : null;

  if (!targetDay) {
    throw new Error("Day not found");
  }

  targetDay.completed = Boolean(completed);
  studyPlan.markModified("plan");
  await studyPlan.save();

  return {
    planId: studyPlan._id.toString(),
    plan: studyPlan.plan,
  };
}

async function adaptExistingStudyPlan(planId, message = "") {
  const studyPlan = await StudyPlan.findById(planId);
  if (!studyPlan) {
    throw new Error("Study plan not found");
  }

  const updatedPlan = await adaptStudyPlan(studyPlan.plan, message);
  studyPlan.plan = updatedPlan;
  studyPlan.markModified("plan");
  await studyPlan.save();

  return {
    planId: studyPlan._id.toString(),
    plan: studyPlan.plan,
  };
}

async function getUserStudyPlans(userId) {
  return await StudyPlan.find({ user: userId }).sort({ createdAt: -1 });
}

module.exports = {
  createStudyPlan,
  updateStudyPlanProgress,
  adaptExistingStudyPlan,
  getUserStudyPlans,
};
