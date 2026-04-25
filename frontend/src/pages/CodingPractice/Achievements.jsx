import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { getUserCodingStats } from "../../services/operations/codingApi";
import { apiConnector } from "../../services/apiConnector";

const BASE_URL = import.meta.env.VITE_APP_BASE_URL || "http://localhost:5000/api";

const ACHIEVEMENTS_ICONS = {
  MILESTONE: "🏆",
  PERFORMANCE: "🚀",
  STREAK: "🔥"
};

const Achievements = () => {
  const { token } = useSelector((state) => state.auth);
  const [manifest, setManifest] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAchievementsData = async () => {
      try {
        setLoading(true);
        // Fetch universal badge manifest
        const manifestRes = await apiConnector("GET", `${BASE_URL}/api/v1/system/achievements/manifest`);
        if (manifestRes.data?.success) {
          setManifest(manifestRes.data.data);
        }

        // Fetch user unlocked badges
        const statsRes = await getUserCodingStats(token);
        if (statsRes) {
          setUserStats(statsRes);
        }
      } catch (err) {
        console.error("Failed to load achievements data", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) fetchAchievementsData();
  }, [token]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto w-full text-white">
        <h1 className="text-3xl font-bold mb-6">Hall of Fame</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-richblack-800 rounded-xl"></div>
          <div className="h-24 bg-richblack-800 rounded-xl"></div>
          <div className="h-24 bg-richblack-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Map to simple array of unlocked badge codes for O(1) checks
  const unlockedBadges = new Set((userStats?.achievements || []).map(a => a.badge));

  return (
    <div className="p-6 max-w-6xl mx-auto w-full">
       <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Hall of Fame</h1>
       <p className="text-richblack-300 mb-10 text-lg">Your legacy. Track your unlocked milestones and upcoming challenges.</p>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {manifest.map((badge, idx) => {
             const isUnlocked = unlockedBadges.has(badge.code);

             return (
                <div 
                  key={idx} 
                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                    isUnlocked 
                      ? "bg-richblack-800 border-yellow-500 shadow-[0_0_20px_rgba(255,214,10,0.15)] hover:-translate-y-1" 
                      : "bg-richblack-900 border-richblack-700 opacity-60 grayscale hover:grayscale-0"
                  }`}
                >
                   {/* Icon */}
                   <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 ${
                     isUnlocked ? "bg-yellow-500/20 text-yellow-500" : "bg-richblack-700 text-richblack-400"
                   }`}>
                      {ACHIEVEMENTS_ICONS[badge.category] || "🎖️"}
                   </div>

                   {/* Title */}
                   <h3 className={`text-xl font-black mb-2 ${isUnlocked ? "text-white" : "text-richblack-400"}`}>
                     {badge.name}
                   </h3>

                   {/* Description */}
                   <p className="text-sm text-richblack-300 min-h-[40px] mb-4">
                     {badge.description}
                   </p>

                   {/* Under Banner */}
                   <div className="flex items-center justify-between mt-auto">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-richblack-500">
                        {badge.category}
                     </span>
                     {isUnlocked ? (
                       <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 font-bold text-xs rounded-full border border-yellow-500/30">
                         Unlocked
                       </span>
                     ) : (
                       <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-richblack-400 font-bold">Goal: {badge.target}</span>
                          <span className="px-3 py-1 bg-richblack-800 text-richblack-400 font-bold text-xs rounded-full border border-richblack-600">
                            Locked
                          </span>
                       </div>
                     )}
                   </div>
                </div>
             )
          })}
       </div>
    </div>
  );
};

export default Achievements;
