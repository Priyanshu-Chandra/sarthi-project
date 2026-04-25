const MyRankCard = ({ data }) => {
  if (!data) return (
    <div className="bg-richblack-800 border border-richblack-700 p-6 rounded-2xl text-center text-richblack-400 shadow-md">
      Solve at least one problem this week to appear on the leaderboard!
    </div>
  );

  const topPercent = Number((100 - data.percentile).toFixed(1));

  return (
    <div className="bg-gradient-to-br from-richblack-800 to-richblack-900 border border-yellow-700/30 p-6 rounded-2xl shadow-lg">
      <h2 className="text-lg font-semibold text-richblack-200 mb-4 text-center">🎯 Your Weekly Standing</h2>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-richblack-700 rounded-xl p-4">
          <p className="text-3xl font-extrabold text-yellow-400">#{data.rank}</p>
          <p className="text-xs text-richblack-400 mt-1 uppercase tracking-wide">Rank</p>
        </div>
        <div className="bg-richblack-700 rounded-xl p-4">
          <p className="text-3xl font-extrabold text-caribbeangreen-400">{data.xp}</p>
          <p className="text-xs text-richblack-400 mt-1 uppercase tracking-wide">Weekly XP</p>
        </div>
        <div className="bg-richblack-700 rounded-xl p-4">
          <p className="text-3xl font-extrabold text-blue-400">Lv {data.level}</p>
          <p className="text-xs text-richblack-400 mt-1 uppercase tracking-wide">Level</p>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-richblack-300 text-sm">
          You're in the <span className="text-yellow-400 font-bold">top {topPercent}%</span> of coders this week 🚀
        </p>
      </div>

      {/* XP to next rank motivator */}
      {data.xpToNextRank !== null && data.xpToNextRank > 0 && (
        <div className="mt-4 bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-yellow-200">🔥 Only <strong>{data.xpToNextRank} XP</strong> to climb one rank!</span>
          <span className="text-xs text-yellow-500 font-bold animate-pulse">Solve Now →</span>
        </div>
      )}
    </div>
  );
};

export default MyRankCard;
