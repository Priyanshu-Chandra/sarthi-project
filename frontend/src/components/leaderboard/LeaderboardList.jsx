const LeaderboardList = ({ leaders, myRank }) => {
  if (!leaders || leaders.length === 0) return null;

  return (
    <div className="bg-richblack-800 border border-richblack-700 rounded-2xl overflow-hidden shadow-md mb-8">
      <div className="px-5 py-3 border-b border-richblack-700 text-xs uppercase tracking-wider text-richblack-400 grid grid-cols-12">
        <span className="col-span-1">Rank</span>
        <span className="col-span-7">Player</span>
        <span className="col-span-2 text-right">Level</span>
        <span className="col-span-2 text-right">XP</span>
      </div>

      {leaders.map((user) => {
        const isMe = myRank && user.rank === myRank.rank;
        return (
          <div
            key={user.rank}
            className={`grid grid-cols-12 items-center px-5 py-4 border-b border-richblack-700 last:border-b-0 transition-colors ${
              isMe
                ? "bg-yellow-900/20 border-l-2 border-l-yellow-500"
                : "hover:bg-richblack-700/40"
            }`}
          >
            <span className="col-span-1 font-bold text-richblack-300 text-sm">#{user.rank}</span>
            <div className="col-span-7 flex items-center gap-3">
              {user.image ? (
                <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-richblack-600" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-richblack-600 flex items-center justify-center text-sm font-bold text-richblack-200">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <span className={`font-medium text-sm ${isMe ? "text-yellow-300" : "text-richblack-50"}`}>
                {user.name} {isMe && <span className="text-[10px] bg-yellow-500 text-black font-bold px-1.5 py-0.5 rounded-full ml-1">You</span>}
              </span>
            </div>
            <span className="col-span-2 text-right text-sm text-richblack-300">Lv {user.level}</span>
            <span className="col-span-2 text-right font-bold text-caribbeangreen-300 text-sm">{user.xp} XP</span>
          </div>
        );
      })}
    </div>
  );
};

export default LeaderboardList;
