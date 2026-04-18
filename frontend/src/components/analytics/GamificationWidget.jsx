
import { Link } from 'react-router-dom';

/* eslint-disable react/prop-types */
const GamificationWidget = ({ stats, myRank }) => {
  if (!stats) return null;

  return (
    <div className="bg-richblack-800 p-6 rounded-2xl shadow-md flex flex-col justify-between">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-white text-xl font-bold">Level {stats.level}</h2>
          <p className="text-richblack-300 text-sm">{stats.xp} Total XP</p>
        </div>
        <div className="bg-yellow-50 text-richblack-900 rounded-full px-4 py-2 font-bold transform -rotate-2 shadow-[0_0_15px_rgba(255,214,10,0.4)]">
           Weekly Rank: #{myRank?.rank || ' -- '}
        </div>
      </div>

      <div className="mb-6 bg-richblack-900 p-4 rounded-xl border border-richblack-700">
        <div className="flex justify-between text-xs text-richblack-300 mb-2">
          <span>{stats.currentLevelXP} XP</span>
          <span>{stats.nextLevelXP} XP</span>
        </div>
        <div className="w-full bg-richblack-700 rounded-full h-2">
          <div 
            className="bg-yellow-50 h-2 rounded-full shadow-[0_0_10px_rgba(255,214,10,0.8)]"
            style={{ width: `${stats.levelProgress}%` }}
          ></div>
        </div>
        <p className="text-center text-xs text-richblack-400 mt-2">
          {stats.nextLevelXP - stats.xp} XP to next level
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-richblack-100 font-semibold text-sm uppercase tracking-wider">Next Milestones</h3>
          <Link to="/dashboard/coding-practice/achievements" className="text-yellow-50 text-xs hover:underline">
            View All Badges
          </Link>
        </div>
        
        {stats.nextAchievements && stats.nextAchievements.length > 0 ? (
          <div className="space-y-3">
            {stats.nextAchievements.map((ach, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                   <span className="text-richblack-5">{ach.label || ach.badge.replace(/_/g, " ")}</span>
                   <span className="text-richblack-300">{ach.progress} / {ach.target}</span>
                </div>
                <div className="w-full bg-richblack-700 rounded-full h-1">
                  <div 
                    className="bg-caribbeangreen-400 h-1 rounded-full"
                    style={{ width: `${Math.min(100, (ach.progress / ach.target) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-richblack-400 italic">No upcoming milestones available right now.</p>
        )}
      </div>
    </div>
  );
};

export default GamificationWidget;
