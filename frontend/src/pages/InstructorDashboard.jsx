import { useEffect, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { useParams, Link } from "react-router-dom";

import ExamStatsCard from "../components/analytics/ExamStatsCard";
import FailedQuestionsChart from "../components/analytics/FailedQuestionsChart";
import CheatingTable from "../components/analytics/CheatingTable";

const BASE_URL = import.meta.env.VITE_APP_BASE_URL || "http://localhost:5000/api";

const InstructorDashboard = () => {
  const { testId } = useParams();
  const { token } = useSelector((state) => state.auth);
  
  const [overview, setOverview] = useState(null);
  const [failed, setFailed] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [cheating, setCheating] = useState([]);
  const [cheatingSummary, setCheatingSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const config = {
          headers: {
            Authorization: `Bearer ${token}`
          }
        };

        const [oRes, fRes, tRes, cRes, sumRes] = await Promise.all([
          axios.get(`${BASE_URL}/instructor/overview/${testId}`, config),
          axios.get(`${BASE_URL}/instructor/failed/${testId}`, config),
          axios.get(`${BASE_URL}/instructor/top-performers/${testId}`, config),
          axios.get(`${BASE_URL}/cheating/${testId}`, config),
          axios.get(`${BASE_URL}/cheating/summary/${testId}`, config)
        ]);

        setOverview(oRes.data);
        setFailed(fRes.data);
        setTopPerformers(tRes.data);
        setCheating(cRes.data);
        setCheatingSummary(sumRes.data);
      } catch (err) {
        console.error("Failed to fetch instructor dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    if (testId && token) {
      fetchData();
    }
  }, [testId, token]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-white mb-6 animate-pulse">Loading Analytics...</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="h-[120px] bg-richblack-800 rounded-2xl animate-pulse"></div>
          <div className="h-[120px] bg-richblack-800 rounded-2xl animate-pulse"></div>
          <div className="h-[120px] bg-richblack-800 rounded-2xl animate-pulse"></div>
          <div className="h-[120px] bg-richblack-800 rounded-2xl animate-pulse"></div>
        </div>
        <div className="h-[350px] bg-richblack-800 rounded-2xl animate-pulse"></div>
      </div>
    );
  }

  if (!overview && failed.length === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto w-full text-center py-20 text-white">
        <h2 className="text-2xl font-bold mb-4">No Data Available</h2>
        <p className="text-gray-400">No students have completed this exam yet.</p>
        <Link to="/dashboard/my-courses" className="text-yellow-400 mt-4 block underline">Back to Courses</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Instructor Intelligence</h1>
          <p className="text-richblack-300">Class-level performance insights for your exam.</p>
        </div>
        <div className="text-right">
            <span className="text-sm text-gray-400 block">Total Participants</span>
            <span className="text-2xl font-bold text-caribbeangreen-400">{overview?.totalStudents || 0}</span>
        </div>
      </div>

      <div className="grid gap-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ExamStatsCard title="Avg Score" value={overview?.avgScore} />
          <ExamStatsCard title="Pass Rate" value={`${overview?.passRate || 0}%`} />
          <ExamStatsCard title="Highest Score" value={overview?.highest} />
          <ExamStatsCard title="Lowest Score" value={overview?.lowest} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            {/* Failed Questions */}
            <FailedQuestionsChart data={failed} />
          </div>

          <div>
             {/* Top Performers */}
            {topPerformers.length > 0 ? (
              <div className="bg-[#1f2937] p-5 rounded-2xl shadow-md h-full">
                <h2 className="text-white text-lg mb-4 text-center">🏆 Top Performers</h2>
                <div className="space-y-3">
                  {topPerformers.map((student) => (
                    <div key={student.rank} className="flex justify-between items-center p-3 bg-[#111827] border border-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-caribbeangreen-400 font-bold bg-[#1f2937] w-8 h-8 flex items-center justify-center rounded-full">#{student.rank}</span>
                        <span className="text-white font-medium truncate max-w-[100px]" title={student.name}>{student.name}</span>
                      </div>
                      <span className="text-yellow-400 font-bold">{student.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
               <div className="bg-[#1f2937] p-5 rounded-2xl shadow-md h-full flex flex-col items-center justify-center">
                 <h2 className="text-white text-lg mb-2 text-center">🏆 Top Performers</h2>
                 <p className="text-gray-400">No rankings yet.</p>
               </div>
            )}
          </div>
        </div>

        {/* Cheating Analytics */}
        <div className="mt-2 text-white">
          {cheatingSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-[#1f2937] p-4 rounded-xl border border-gray-700 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Safe Attempts</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">{cheatingSummary.safe || 0}</p>
                </div>
                <div className="text-3xl">🟢</div>
              </div>
              <div className="bg-[#1f2937] p-4 rounded-xl border border-gray-700 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Suspicious</p>
                  <p className="text-2xl font-bold text-yellow-400 mt-1">{cheatingSummary.suspicious || 0}</p>
                </div>
                <div className="text-3xl">🟡</div>
              </div>
              <div className="bg-[#1f2937] p-4 rounded-xl border border-gray-700 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">High Risk</p>
                  <p className="text-2xl font-bold text-red-500 mt-1">{cheatingSummary.high || 0}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">
                    {cheatingSummary.highRiskRatio || 0}% Cheating Density
                  </p>
                </div>
                <div className="text-3xl">🚨</div>
              </div>
              <div className="bg-[#1f2937] p-4 rounded-xl border border-gray-700 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Avg Risk Score</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    cheatingSummary.avgRiskScore >= 9 ? "text-red-500" :
                    cheatingSummary.avgRiskScore >= 4 ? "text-yellow-400" : "text-green-400"
                  }`}>
                    {cheatingSummary.avgRiskScore || 0}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                    {cheatingSummary.avgRiskScore >= 9 ? "Critical Risk" :
                     cheatingSummary.avgRiskScore >= 4 ? "Moderate Risk" : "Low Risk"}
                  </p>
                </div>
                <div className="text-3xl">🛡️</div>
              </div>
            </div>
          )}
          <CheatingTable data={cheating} />
        </div>

      </div>
    </div>
  );
};

export default InstructorDashboard;
