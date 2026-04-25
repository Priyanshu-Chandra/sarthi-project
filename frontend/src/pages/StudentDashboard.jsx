import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { getStudentAnalytics, getMyRank } from "../services/operations/analysisApi";
import { getUserCodingStats } from "../services/operations/codingApi";

import SkillRadarChart from "../components/analytics/SkillRadarChart";
import SpeedCard from "../components/analytics/SpeedCard";
import DifficultyChart from "../components/analytics/DifficultyChart";
import GamificationWidget from "../components/analytics/GamificationWidget";

const TotalStatsCard = ({ data }) => {
  const acceptanceRate = data?.acceptanceRate || 0;
  
  return (
    <div className="bg-richblack-800 border border-richblack-700 p-6 rounded-3xl shadow-xl flex flex-col justify-center min-h-[250px] relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full translate-x-1/3 translate-y-1/3"></div>
      
      <div className="flex items-center gap-3 mb-8 relative z-10">
        <span className="text-2xl drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">📈</span>
        <h2 className="text-white text-xl font-bold tracking-tight">Total Stats</h2>
      </div>
      
      <div className="flex flex-col gap-5 relative z-10">
        <div className="flex justify-between items-center pb-3 border-b border-richblack-700/50">
          <span className="text-richblack-300 font-medium text-sm uppercase tracking-wider">Problems Solved</span>
          <span className="text-white font-black text-2xl">{data?.problemsSolved || 0}</span>
        </div>
        
        <div className="flex justify-between items-center pb-3 border-b border-richblack-700/50">
          <span className="text-richblack-300 font-medium text-sm uppercase tracking-wider">Total Submissions</span>
          <span className="text-white font-black text-2xl">{data?.totalSubmissions || 0}</span>
        </div>

        <div className="pt-2">
          <div className="flex justify-between items-center mb-3">
            <span className="text-richblack-300 font-medium text-sm uppercase tracking-wider">Acceptance Rate</span>
            <span className={`font-black text-lg drop-shadow-md ${
              acceptanceRate < 40 ? "text-pink-200" : 
              acceptanceRate < 70 ? "text-yellow-50" : "text-caribbeangreen-100"
            }`}>{acceptanceRate}%</span>
          </div>
          <div className="w-full bg-richblack-900 rounded-full h-3 border border-richblack-700 shadow-inner overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                acceptanceRate < 40 ? "bg-gradient-to-r from-pink-400 to-pink-200 shadow-[0_0_10px_rgba(239,71,111,0.5)]" : 
                acceptanceRate < 70 ? "bg-gradient-to-r from-yellow-200 to-yellow-50 shadow-[0_0_10px_rgba(255,214,10,0.5)]" : "bg-gradient-to-r from-caribbeangreen-300 to-caribbeangreen-100 shadow-[0_0_10px_rgba(6,214,160,0.5)]"
              }`} 
              style={{ width: `${acceptanceRate}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StudentDashboard = () => {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    const fetchDashboardState = async () => {
      try {
        setLoading(true);
        const [analyticsRes, statsRes, rankRes] = await Promise.all([
          getStudentAnalytics(token),
          getUserCodingStats(token),
          getMyRank(token)
        ]);
        setData(analyticsRes || {});
        setStats(statsRes || {});
        setMyRank(rankRes || null);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDashboardState();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-white mb-6">Student Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            <div className="md:col-span-3 h-[350px] bg-richblack-800 rounded-2xl"></div>
            <div className="h-[250px] bg-richblack-800 rounded-2xl"></div>
            <div className="h-[250px] bg-richblack-800 rounded-2xl"></div>
            <div className="h-[250px] bg-richblack-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto w-full">
      <h1 className="text-3xl font-bold text-white mb-2">Student Analytics</h1>
      <p className="text-richblack-300 mb-8">Gain deep insights into your coding performance, progression, and gamification rank.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Gamification Widget */}
        <GamificationWidget stats={stats} myRank={myRank} />
        
        {/* Total Stats */}
        <TotalStatsCard data={data} />
        
        {/* Speed */}
        <SpeedCard avgAttempts={data?.avgAttempts} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <div className="md:col-span-2">
          <SkillRadarChart data={data?.radar} />
        </div>

        {/* Difficulty */}
        <div className="md:col-span-1 border border-richblack-700 rounded-2xl">
          <DifficultyChart data={data?.difficultyStats} />
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
