import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { getUserCodingStats, getCodingActivity, getCodingAnalytics, getPracticePath, getDailyChallenge } from "../../services/operations/codingApi";
import ActivityHeatmap, { ActivityHeatmapSkeleton } from "../../components/Coding/ActivityHeatmap";
import AnalyticsDashboard from "../../components/Coding/AnalyticsDashboard";
import PracticePath from "../../components/Coding/PracticePath";
import { calculateStreaks } from "../../utils/streakCalculator";

function CodingPracticeHome() {
  const { token } = useSelector((state) => state.auth);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [practicePath, setPracticePath] = useState([]);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streaks, setStreaks] = useState({ currentStreak: 0, longestStreak: 0 });

  const refreshAfterAcceptedSubmission = useCallback(async () => {
    const [pathRes, activityRes, statsRes, dailyRes] = await Promise.all([
      getPracticePath(token),
      getCodingActivity(token),
      getUserCodingStats(token),
      getDailyChallenge(token),
    ]);

    setPracticePath(Array.isArray(pathRes) ? pathRes : []);
    if (activityRes) {
      setActivity(activityRes);
      setStreaks(calculateStreaks(activityRes));
    }
    if (statsRes) setStats(statsRes);
    if (dailyRes) setDailyChallenge(dailyRes);
  }, [token]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [statsRes, activityRes, analyticsRes, pathRes, dailyRes] = await Promise.all([
        getUserCodingStats(token),
        getCodingActivity(token),
        getCodingAnalytics(token),
        getPracticePath(token),
        getDailyChallenge(token)
      ]);
      
      if (statsRes) setStats(statsRes);
      if (activityRes) {
        setActivity(activityRes);
        setStreaks(calculateStreaks(activityRes));
      }
      if (analyticsRes) setAnalytics(analyticsRes);
      setPracticePath(Array.isArray(pathRes) ? pathRes : []);
      if (dailyRes) setDailyChallenge(dailyRes);
      
      setLoading(false);
    };
    fetchData();
  }, [token]);

  useEffect(() => {
    const handlePracticePathUpdate = () => {
      refreshAfterAcceptedSubmission();
    };

    const handleStorageUpdate = (event) => {
      if (event.key === "coding:practice-path-updated-at") {
        refreshAfterAcceptedSubmission();
      }
    };

    window.addEventListener("coding:practice-path-updated", handlePracticePathUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener("coding:practice-path-updated", handlePracticePathUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [refreshAfterAcceptedSubmission]);

  return (
    <div className="w-full p-6 text-richblack-5 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2">Coding Practice Hub</h1>
      <p className="text-richblack-300 mb-8">Sharpen your programming skills and climb the leaderboard.</p>

      {/* Daily Challenge Widget */}
      {!loading && dailyChallenge?.problem && (
        <div className="bg-gradient-to-r from-richblack-800 to-richblack-900 p-6 rounded-lg border border-yellow-700/30 mb-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-yellow-300">
              🔥 Problem of the Day
            </h2>
            <p className="text-richblack-200 mt-1">
              Solve today's challenge to maintain your streak: <span className="font-semibold text-richblack-50">{dailyChallenge.problem.title}</span>
            </p>
          </div>
          <Link
            to={`/dashboard/coding-practice/problems/${dailyChallenge.problem.slug}`}
            className={`px-6 py-3 rounded-lg font-bold transition-all shadow-md ${
              dailyChallenge.isSolved
                ? "bg-emerald-900 border border-emerald-700 text-emerald-300 pointer-events-none"
                : "bg-yellow-50 text-richblack-900 hover:bg-yellow-100 hover:scale-105"
            }`}
          >
            {dailyChallenge.isSolved ? "Solved ✅" : "Solve Challenge →"}
          </Link>
        </div>
      )}

      {/* Activity Heatmap Widget */}
      <div className="bg-richblack-800 p-6 rounded-lg border border-richblack-700 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between mb-4 border-b border-richblack-700 pb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span>🔥</span> Coding Activity
          </h2>
          {!loading && streaks && (
            <div className="flex gap-4 text-sm mt-2 md:mt-0">
               <div className="bg-richblack-900 border border-richblack-700 px-3 py-1 rounded-full flex items-center gap-2 group">
                <span className="text-richblack-300">Today:</span>
                <span className="text-caribbeangreen-300 font-bold">
                   {activity?.some(a => a.date === new Date().toLocaleDateString("en-CA")) ? "Solved ✅" : "Missing ❌"}
                </span>
              </div>
              <div className="bg-richblack-900 border border-richblack-700 px-3 py-1 rounded-full flex items-center gap-2">
                <span className="text-richblack-300">Current Streak:</span>
                <span className="text-richblack-5 font-semibold text-base flex items-center gap-1 animate-pulse">
                  {streaks.currentStreak} <span className="text-xl">🔥</span>
                </span>
              </div>
              <div className="hidden sm:bg-richblack-900 border border-richblack-700 px-3 py-1 rounded-full sm:flex items-center gap-2">
                <span className="text-richblack-300">Max Streak:</span>
                <span className="text-richblack-5 font-semibold text-base">{streaks.longestStreak}</span>
              </div>
            </div>
          )}
        </div>
        {/* Streak Protection Warning */}
        {(() => {
          if (!streaks || streaks.currentStreak === 0 || !activity) return null;
          const solvedToday = activity.some(a => a.date === new Date().toLocaleDateString("en-CA") && a.count > 0);
          if (solvedToday) return null;
          
          const hoursLeft = 24 - new Date().getHours();
          return (
            <div className="mt-3 mb-4 bg-yellow-900/40 border border-yellow-700 text-yellow-200 px-4 py-3 rounded-md text-sm flex items-center justify-between gap-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <span>
                  Your <strong>{streaks.currentStreak}-day</strong> streak is at risk. 
                  Solve a problem in the next <span className="font-bold text-yellow-400">{hoursLeft} hours</span> to keep it alive!
                </span>
              </div>
              <Link to="/dashboard/coding-practice/problems" className="bg-yellow-50 text-richblack-900 px-3 py-1.5 rounded-md font-bold text-xs shrink-0 whitespace-nowrap hover:bg-yellow-100 transition">
                Solve Now
              </Link>
            </div>
          );
        })()}
        {loading ? (
            <ActivityHeatmapSkeleton />
        ) : (
            <ActivityHeatmap activityData={activity} />
        )}
      </div>

      {/* Recommended Practice Path Widget */}
      {!loading && practicePath.length > 0 && (
        <div className="mb-8">
          <PracticePath problems={practicePath} />
        </div>
      )}

      {/* Analytics Dashboard Widget */}
      <div className="bg-richblack-800 p-6 rounded-lg border border-richblack-700 mb-8 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 border-b border-richblack-700 pb-2">
          📊 Coding Analytics
        </h2>
        {loading ? (
          <div className="animate-pulse flex space-x-4 h-64 items-center justify-center text-richblack-300">Loading analytics...</div>
        ) : (
          <AnalyticsDashboard analytics={analytics} />
        )}
      </div>

      {/* User Stats & Gamification Widget */}
      <div className="bg-richblack-800 p-6 rounded-lg border border-richblack-700 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b border-richblack-700 pb-2">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">Milestone Stats</h2>
            <Link 
              to="/dashboard/coding-practice/achievements"
              className="text-[10px] bg-richblack-900 border border-yellow-700/50 text-yellow-100 px-3 py-1 rounded-full font-black uppercase tracking-widest hover:bg-yellow-900/40 transition"
            >
              View Hall of Fame 🏆
            </Link>
          </div>
          {!loading && stats && (
             <div className="mt-2 md:mt-0 flex items-center gap-4">
               <div className="flex flex-col items-end">
                 <span className="text-sm font-bold text-yellow-500">Level {stats.level || 1}</span>
                 <span className="text-xs text-richblack-300 relative top-[-2px]">
                   {stats.xp || 0} / {stats.nextLevelXP || 200} XP
                 </span>
               </div>
               <div className="w-32 bg-richblack-900 h-2.5 outline outline-1 outline-richblack-700 rounded-full overflow-hidden">
                 <div 
                   className="bg-yellow-500 h-2.5 rounded-full transition-all duration-1000" 
                   style={{ width: `${stats.levelProgress || 0}%` }}
                 ></div>
               </div>
             </div>
          )}
        </div>
        
        {loading ? (
          <div className="animate-pulse flex space-x-4 h-20 items-center justify-center text-richblack-300">Loading stats...</div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-richblack-700 p-4 rounded-md text-center">
              <p className="text-sm text-richblack-200 mb-1">Total Solved</p>
              <p className="text-3xl font-bold tracking-tight">{stats.totalSolved}</p>
            </div>
            <div className="bg-caribbeangreen-900/40 p-4 rounded-md text-center border border-caribbeangreen-800">
              <p className="text-sm text-caribbeangreen-200 mb-1">Easy</p>
              <p className="text-2xl font-bold text-caribbeangreen-50">{stats.easySolved}</p>
            </div>
            <div className="bg-yellow-900/40 p-4 rounded-md text-center border border-yellow-800">
              <p className="text-sm text-yellow-200 mb-1">Medium</p>
              <p className="text-2xl font-bold text-yellow-50">{stats.mediumSolved}</p>
            </div>
            <div className="bg-pink-900/40 p-4 rounded-md text-center border border-pink-800">
              <p className="text-sm text-pink-200 mb-1">Hard</p>
              <p className="text-2xl font-bold text-pink-50">{stats.hardSolved}</p>
            </div>
          </div>
        ) : (
          <div className="text-richblack-300">Start solving problems to see your stats!</div>
        )}

        {/* Badges / Achievements Grid */}
        {!loading && stats && stats.achievements && stats.achievements.length > 0 && (
          <div className="mt-8 border-t border-richblack-700 pt-6">
            <h3 className="text-lg font-semibold mb-4 text-caribbeangreen-300">🎖️ Unlocked Achievements</h3>
            <div className="flex flex-wrap gap-4">
              {stats.achievements.map((ach, idx) => (
                <div key={idx} className="bg-richblack-900 border border-richblack-600 px-4 py-2 rounded-lg flex items-center gap-3 shadow-md hover:scale-105 transition-transform cursor-default">
                  <span className="text-2xl">
                    {ach.category === "STREAK" ? "🔥" : 
                     ach.category === "MILESTONE" ? "🏆" : 
                     ach.category === "PERFORMANCE" ? "⚡" : "🏅"}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-richblack-5">{ach.badge.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-richblack-300 uppercase tracking-wider">{ach.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked Badges / Next Progress UI */}
        {!loading && stats && stats.nextAchievements && stats.nextAchievements.length > 0 && (
          <div className="mt-6">
            <h3 className="text-md font-semibold mb-3 text-richblack-300">🎯 Next Objectives</h3>
            <div className="flex flex-wrap gap-4">
              {stats.nextAchievements.map((ach, idx) => {
                const pct = Math.round((ach.progress / ach.target) * 100);
                const almostThere = pct >= 80;
                return (
                  <div
                    key={`next_${idx}`}
                    className={`px-4 py-3 rounded-lg flex flex-col gap-2 shadow-sm w-full md:w-64 border transition-all duration-500 ${
                      almostThere
                        ? "bg-yellow-900/10 border-yellow-600/60 shadow-yellow-500/10 shadow-md"
                        : "bg-richblack-800 border-richblack-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-richblack-300">
                      <span className={`text-lg ${almostThere ? "animate-pulse" : "opacity-70"}`}>
                        {almostThere ? "🔓" : "🔒"}
                      </span>
                      <p className={`text-sm font-bold truncate ${almostThere ? "text-yellow-300" : ""}`}>
                        {ach.badge.replace(/_/g, " ")}
                      </p>
                      {almostThere && <span className="ml-auto text-[9px] bg-yellow-600 text-black font-bold px-1.5 py-0.5 rounded-full shrink-0">Almost!</span>}
                    </div>
                    <div className="w-full bg-richblack-900 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-700 ${
                          almostThere ? "bg-yellow-400" : "bg-richblack-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-right text-richblack-400 font-mono">
                      ({ach.progress}/{ach.target}) — {pct}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-richblack-800 p-6 rounded-lg border border-richblack-700 hover:scale-[1.02] transition-transform shadow-sm">
          <h2 className="text-2xl font-semibold mb-2">Practice Problems</h2>
          <p className="text-richblack-200 mb-4 h-12">Browse problems by topic and difficulty to practice data structures and algorithms.</p>
          <div className="flex flex-wrap gap-2">
             <Link to="/dashboard/coding-practice/problems" className="bg-yellow-50 text-black px-4 py-2 rounded font-medium hover:bg-yellow-100 transition-colors">Go to Problems</Link>
             <Link to="/dashboard/coding-practice/submissions" className="bg-richblack-700 text-richblack-5 px-4 py-2 rounded font-medium hover:bg-richblack-600 transition-colors border border-richblack-600">My Submissions</Link>
          </div>
        </div>

        <div className="bg-richblack-800 p-6 rounded-lg border border-richblack-700 hover:scale-[1.02] transition-transform shadow-sm">
          <h2 className="text-2xl font-semibold mb-2">Compete</h2>
          <p className="text-richblack-200 mb-4 h-12">Check where you stand globally on the live coder leaderboard against top students.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard/coding-practice/leaderboard" className="bg-caribbeangreen-200 text-caribbeangreen-900 px-4 py-2 rounded font-bold hover:bg-caribbeangreen-300 transition-colors">View Leaderboard</Link>
            <Link to="/dashboard/coding-practice/compiler" className="bg-richblack-700 text-richblack-5 px-4 py-2 rounded font-medium hover:bg-richblack-600 transition-colors border border-richblack-600">Online Compiler</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodingPracticeHome;
