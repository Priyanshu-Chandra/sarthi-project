import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { getStudentAnalytics, getMyRank } from "../services/operations/analysisApi";
import { getUserCodingStats } from "../services/operations/codingApi";

import SkillRadarChart from "../components/analytics/SkillRadarChart";
import SpeedCard from "../components/analytics/SpeedCard";
import DifficultyChart from "../components/analytics/DifficultyChart";
import GamificationWidget from "../components/analytics/GamificationWidget";

/* eslint-disable react/prop-types */
const TotalStatsCard = ({ data }) => {
  return (
    <div className="bg-[#1f2937] p-6 rounded-2xl shadow-md flex flex-col justify-center min-h-[250px]">
      <h2 className="text-white text-lg mb-6 text-center">Total Stats</h2>
      
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-400">Problems Solved:</span>
        <span className="text-white font-bold text-xl">{data?.problemsSolved || 0}</span>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <span className="text-gray-400">Total Submissions:</span>
        <span className="text-white font-bold text-xl">{data?.totalSubmissions || 0}</span>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400">Acceptance Rate:</span>
          <span className={`font-bold ${
            (data?.acceptanceRate || 0) < 40 ? "text-red-400" : 
            (data?.acceptanceRate || 0) < 70 ? "text-yellow-400" : "text-green-400"
          }`}>{(data?.acceptanceRate || 0)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full transition-all duration-1000 ${
              (data?.acceptanceRate || 0) < 40 ? "bg-red-500" : 
              (data?.acceptanceRate || 0) < 70 ? "bg-yellow-500" : "bg-green-500"
            }`} 
            style={{ width: `${data?.acceptanceRate || 0}%` }}
          ></div>
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
