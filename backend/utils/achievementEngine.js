const Achievement = require("../models/Achievement");
const UserStats = require("../models/UserStats");
const CodingActivity = require("../models/CodingActivity");
const achievementManifest = require("./achievementManifest");

const formatDate = (d) => new Date(d).toISOString().split("T")[0];

const unlock = async (userId, badge, category) => {
  try {
    await Achievement.create({ userId, badge, category });
    return true; // Newly unlocked
  } catch (error) {
    // If error is duplicate key, it means badge already exists, so ignore safely.
    return false;
  }
};

const calculateStreak = (activity) => {
  const normalizedDates = new Set(activity.map(a => formatDate(a.date)));
  let streak = 0;
  let d = new Date();
  
  while (true) {
    const dString = formatDate(d);
    if (normalizedDates.has(dString)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // To account for users working later, check yesterday as well if today isn't present yet
  if (streak === 0) {
    d = new Date();
    d.setDate(d.getDate() - 1);
    const dString = formatDate(d);
    if (normalizedDates.has(dString)) {
      streak = 1;
      while (true) {
        d.setDate(d.getDate() - 1);
        const prevString = formatDate(d);
        if (normalizedDates.has(prevString)) {
          streak++;
        } else {
          break;
        }
      }
    }
  }

  return streak;
};

const checkAchievements = async (userId) => {
  const stats = await UserStats.findOne({ userId });
  // Get active dates chronologically
  const activity = await CodingActivity.find({ userId }).sort({ date: -1 });

  const existingBadges = await Achievement.find({ userId }).select("badge");
  const badgeSet = new Set(existingBadges.map(b => b.badge));

  if (!stats) return { unlocked: [], next: [] };

  let unlocked = [];
  let next = [];

  const getAch = (code) => achievementManifest.find(a => a.code === code);

  const tryUnlock = async (code) => {
    if (!badgeSet.has(code)) {
      const ach = getAch(code);
      if (await unlock(userId, code, ach.category)) {
        unlocked.push(ach.label);
        return true;
      }
    }
    return false;
  };

  const addNext = (code, progress) => {
    if (!badgeSet.has(code)) {
      const ach = getAch(code);
      next.push({ badge: code, label: ach.label, progress, target: ach.target, category: ach.category });
    }
  };

  // 🏆 Problems solved
  if (stats.problemsSolved >= 10) await tryUnlock("10_PROBLEMS");
  else addNext("10_PROBLEMS", stats.problemsSolved);

  if (stats.problemsSolved >= 50) await tryUnlock("50_PROBLEMS");
  else if (stats.problemsSolved >= 10) addNext("50_PROBLEMS", stats.problemsSolved);

  if (stats.problemsSolved >= 100) await tryUnlock("100_PROBLEMS");
  else if (stats.problemsSolved >= 50) addNext("100_PROBLEMS", stats.problemsSolved);

  // ⚡ Performance
  if (stats.problemsSolved > 0) {
    const avg = stats.totalAttempts / stats.problemsSolved;
    if (avg <= 1.5) await tryUnlock("FAST_SOLVER");
    
    // ZERO_ERROR_SOLVER
    if (avg === 1.0 && stats.problemsSolved >= 5) await tryUnlock("ZERO_ERROR_SOLVER");
  }

  // 🔥 Streak
  const streak = calculateStreak(activity);

  if (streak >= 3) await tryUnlock("3_DAY_STREAK");
  else addNext("3_DAY_STREAK", streak);

  if (streak >= 7) await tryUnlock("7_DAY_STREAK");
  else if (streak >= 3) addNext("7_DAY_STREAK", streak);

  if (streak >= 7) await tryUnlock("PERFECT_WEEK");

  if (streak >= 30) await tryUnlock("30_DAY_STREAK");
  else if (streak >= 7) addNext("30_DAY_STREAK", streak);

  if (streak >= 30) await tryUnlock("HARD_STREAK_MASTER");

  // Cap next array to top 3 motivators to avoid overwhelming UI
  return { unlocked, next: next.slice(0, 3) };
};

module.exports = { checkAchievements, calculateStreak };
