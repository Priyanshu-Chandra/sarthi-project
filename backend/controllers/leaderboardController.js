const UserStats = require("../models/UserStats");
const { leaderboardCache, LEADERBOARD_CACHE_TTL } = require("../utils/cacheStore");

exports.getWeeklyLeaderboard = async (req, res) => {
  try {
    const CACHE_KEY = "weekly_leaderboard";

    // 30-second cache to avoid hammering DB on every page load
    const cached = leaderboardCache.get(CACHE_KEY);
    if (cached && Date.now() - cached.time < LEADERBOARD_CACHE_TTL) {
      return res.json({ success: true, data: cached.data });
    }

    const leaderboard = await UserStats.aggregate([
      { $match: { weeklyXp: { $gt: 0 } } },
      { $sort: { weeklyXp: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { firstName: 1, lastName: 1, image: 1 } }]
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          image: "$user.image",
          xp: "$weeklyXp",
          totalXp: "$xp",
          level: "$level"
        }
      }
    ]);

    // Tie-aware ranking: users with equal XP get the same rank
    let rank = 1;
    const ranked = leaderboard.map((u, i) => {
      if (i > 0 && u.xp === leaderboard[i - 1].xp) {
        // same rank as previous
      } else {
        rank = i + 1;
      }
      return { rank, ...u };
    });

    leaderboardCache.set(CACHE_KEY, { data: ranked, time: Date.now() });

    res.json({ success: true, data: ranked });
  } catch (err) {
    console.error("Leaderboard Error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch leaderboard" });
  }
};

exports.getMyRank = async (req, res) => {
  try {
    const userId = req.user.id;

    const me = await UserStats.findOne({ userId }).lean();
    if (!me) return res.json({ success: true, data: null });

    // Count users ahead of me by weeklyXp (parallel queries)
    const [betterUsers, totalUsers] = await Promise.all([
      UserStats.countDocuments({ weeklyXp: { $gt: me.weeklyXp } }),
      UserStats.countDocuments({ weeklyXp: { $gt: 0 } })
    ]);

    const rank = betterUsers + 1;
    const percentile = totalUsers === 0 ? 0 : Number(
      (((totalUsers - rank) / totalUsers) * 100).toFixed(1)
    );

    // How far until the next rank up (user just above them)
    const userJustAbove = await UserStats.findOne({
      weeklyXp: { $gt: me.weeklyXp }
    }).sort({ weeklyXp: 1 }).lean();

    const xpToNextRank = userJustAbove
      ? userJustAbove.weeklyXp - me.weeklyXp
      : null;

    res.json({
      success: true,
      data: {
        rank,
        percentile,
        xp: me.weeklyXp,
        totalXp: me.xp,
        level: me.level,
        xpToNextRank  // null if already at top
      }
    });
  } catch (err) {
    console.error("MyRank Error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch rank" });
  }
};
