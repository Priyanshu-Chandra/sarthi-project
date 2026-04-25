const UserStats = require("../models/UserStats");

const calculateLevel = (xp) => {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
};

const getLevelProgress = (xp, level) => {
  const currentLevelXP = Math.pow(level - 1, 2) * 50;
  const nextLevelXP = Math.pow(level, 2) * 50;
  const progress = Math.min(100, Math.max(0, Math.round(
    ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
  )));
  return { currentLevelXP, nextLevelXP, progress };
};

const awardXP = async (userId, problemDifficulty, isFirstAccepted, firstSolveToday = false, streak = 0) => {
  if (!isFirstAccepted) return { xpAwarded: 0, levelUp: false, xpBreakdown: null };

  const dif = problemDifficulty ? problemDifficulty.toLowerCase() : "easy";

  // Base Problem XP
  let baseXP = 10;
  if (dif === "medium") baseXP = 20;
  else if (dif === "hard") baseXP = 40;

  // Multiplier (applied to base only)
  let multiplier = 1.0;
  if (streak >= 30) multiplier = 1.5;
  else if (streak >= 7) multiplier = 1.2;

  let xp = Math.floor(baseXP * multiplier);

  // Daily Bonus (added after multiplication)
  const dailyBonus = firstSolveToday ? 5 : 0;
  xp += dailyBonus;

  let stats = await UserStats.findOne({ userId });
  if (!stats) {
    stats = await UserStats.create({ userId });
  }

  // Weekly Reset Logic
  const msInWeek = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - new Date(stats.lastWeeklyReset).getTime() > msInWeek) {
    stats.weeklyXp = 0;
    stats.lastWeeklyReset = Date.now();
  }

  stats.weeklyXp = (stats.weeklyXp || 0) + xp;

  const oldLevel = stats.level || 1;
  stats.xp = (stats.xp || 0) + xp;
  stats.level = calculateLevel(stats.xp);

  const levelUp = stats.level > oldLevel;

  await stats.save();

  const { currentLevelXP, nextLevelXP, progress } = getLevelProgress(stats.xp, stats.level);

  return {
    xpAwarded: xp,
    levelUp,
    newLevel: stats.level,
    levelProgress: progress,
    currentLevelXP,
    nextLevelXP,
    totalXP: stats.xp,
    xpBreakdown: { baseXP, multiplier, streakBonus: Math.floor(baseXP * multiplier) - baseXP, dailyBonus, totalXP: xp }
  };
};

// You can expand this generic method in the future for Daily streak bumps etc.
const bumpXP = async (userId, amount) => {
  let stats = await UserStats.findOne({ userId });
  if (!stats) return;

  stats.xp = (stats.xp || 0) + amount;
  stats.level = Math.floor(Math.sqrt(stats.xp / 50)) + 1;

  await stats.save();
};

module.exports = { awardXP, bumpXP };
