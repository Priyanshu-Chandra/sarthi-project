const analyticsCache = new Map();
const analyticsCacheExpiry = new Map();

// Clear the cache periodically to ensure new activity is reflected
setInterval(() => {
  const now = Date.now();
  for (let [key, expiry] of analyticsCacheExpiry.entries()) {
    if (expiry <= now) {
      analyticsCache.delete(key);
      analyticsCacheExpiry.delete(key);
    }
  }
}, 2 * 60 * 1000); // Check every 2 mins

module.exports = {
  analyticsCache,
  analyticsCacheExpiry,
  leaderboardCache: new Map(),  // { data, time } — 30 sec TTL
  LEADERBOARD_CACHE_TTL: 30 * 1000
};
