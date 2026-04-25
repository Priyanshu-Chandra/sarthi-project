
import { Link } from 'react-router-dom';

/* eslint-disable react/prop-types */
const GamificationWidget = ({ stats, myRank }) => {
  if (!stats) return null;

  return (
    <div className="bg-richblack-800 border border-richblack-700 p-6 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background flare */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-yellow-500/5 blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2"></div>
      
      <div className="relative z-10 flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(255,214,10,0.4)]">🏆</span>
          <div>
            <h2 className="text-white text-xl font-bold tracking-tight">Level {stats.level}</h2>
            <p className="text-richblack-300 text-xs uppercase tracking-widest font-bold mt-1">{stats.xp} Total XP</p>
          </div>
        </div>
        <div className="bg-yellow-50 text-richblack-900 rounded-xl px-4 py-2 font-black transform -rotate-2 shadow-[0_0_15px_rgba(255,214,10,0.4)] border border-yellow-200">
           #{myRank?.rank || ' -- '} <span className="text-[10px] uppercase opacity-70 ml-1 tracking-widest">Rank</span>
        </div>
      </div>

      <div className="relative z-10 mb-6 bg-richblack-900/50 p-5 rounded-2xl border border-richblack-700/50 shadow-inner">
        <div className="flex justify-between text-[10px] uppercase font-bold text-richblack-300 tracking-widest mb-3">
          <span>{stats.currentLevelXP} XP</span>
          <span>{stats.nextLevelXP} XP</span>
        </div>
        <div className="w-full bg-richblack-800 rounded-full h-3 border border-richblack-700">
          <div 
            className="bg-gradient-to-r from-yellow-200 to-yellow-50 h-full rounded-full shadow-[0_0_15px_rgba(255,214,10,0.6)] transition-all duration-1000 ease-out"
            style={{ width: `${stats.levelProgress}%` }}
          ></div>
        </div>
        <p className="text-center text-xs text-yellow-400/80 font-bold mt-3 uppercase tracking-widest">
          {stats.nextLevelXP - stats.xp} XP to next level
        </p>
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-richblack-700/50">
          <h3 className="text-richblack-100 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="text-lg">🏅</span> Next Milestones
          </h3>
          <Link to="/dashboard/coding-practice/achievements" className="text-yellow-400 text-[10px] uppercase tracking-widest font-bold hover:text-yellow-300 hover:underline transition-colors">
            View Badges
          </Link>
        </div>
        
        {stats.nextAchievements && stats.nextAchievements.length > 0 ? (
          <div className="space-y-4">
            {stats.nextAchievements.map((ach, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-xl hover:bg-richblack-900/30 transition-colors border border-transparent hover:border-richblack-700/50">
                <div className="flex justify-between text-sm items-center">
                   <span className="text-white font-bold tracking-tight">{ach.label || ach.badge.replace(/_/g, " ")}</span>
                   <span className="text-richblack-200 text-xs font-mono">{ach.progress} / {ach.target}</span>
                </div>
                <div className="w-full bg-richblack-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-400 h-full rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, (ach.progress / ach.target) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-richblack-700/50 bg-richblack-900/30 text-center">
            <p className="text-sm text-richblack-400 italic">No upcoming milestones available right now.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamificationWidget;
