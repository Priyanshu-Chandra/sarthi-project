import { useEffect, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { useParams, Link } from "react-router-dom";

import ExamStatsCard from "../components/analytics/ExamStatsCard";
import FailedQuestionsChart from "../components/analytics/FailedQuestionsChart";
import CheatingTable from "../components/analytics/CheatingTable";

import { 
  instructorAnalyticsEndpoints, 
  cheatingAnalyticsEndpoints 
} from "../services/apis";

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
          axios.get(`${instructorAnalyticsEndpoints.GET_EXAM_OVERVIEW_API}/${testId}`, config),
          axios.get(`${instructorAnalyticsEndpoints.GET_FAILED_QUESTIONS_API}/${testId}`, config),
          axios.get(`${instructorAnalyticsEndpoints.GET_TOP_PERFORMERS_API}/${testId}`, config),
          axios.get(`${cheatingAnalyticsEndpoints.GET_CHEATING_ANALYSIS_API}/${testId}`, config),
          axios.get(`${cheatingAnalyticsEndpoints.GET_CHEATING_SUMMARY_API}/${testId}`, config)
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
      <div className="p-6 max-w-6xl mx-auto w-full min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-yellow-100 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h1 className="text-2xl font-bold text-white mb-6 animate-pulse">Analyzing Test Intelligence...</h1>
        </div>
      </div>
    );
  }

  // Robust check for empty data: If overview is empty or has 0 students AND no failed questions
  const hasNoData = (!overview || Object.keys(overview).length === 0 || overview.totalStudents === 0) && failed.length === 0;

  if (hasNoData) {
    return (
      <div className="p-6 max-w-6xl mx-auto w-full text-center py-24 bg-richblack-900/50 rounded-3xl border border-richblack-800">
        <div className="text-6xl mb-6">📊</div>
        <h2 className="text-3xl font-bold mb-4 text-white font-boogaloo">Intelligence Pending</h2>
        <p className="text-richblack-300 max-w-md mx-auto">
          We haven't received any completed submissions for this test yet. Once students finish their attempt, AI-powered insights will appear here.
        </p>
        <Link 
          to="/dashboard/instructor" 
          className="mt-8 inline-block px-6 py-3 bg-yellow-50 text-richblack-900 font-bold rounded-xl hover:scale-105 transition-all"
        >
          Back to Portal
        </Link>
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

        {/* Cheating Analytics - High Contrast Section */}
        <div className="mt-8 bg-[#1f2937]/50 border-2 border-pink-500/30 rounded-3xl p-6 shadow-2xl shadow-pink-500/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-pink-500/20 p-2 rounded-xl text-pink-400">
              <span className="text-2xl">🚨</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Cheating Risk Analysis</h2>
              <p className="text-richblack-400 text-sm italic">Automated proctoring & integrity report</p>
            </div>
            {cheatingSummary?.high > 0 && (
              <div className="ml-auto bg-pink-500 text-white px-4 py-1 rounded-full text-xs font-bold animate-pulse">
                ACTION REQUIRED: HIGH RISK DETECTED
              </div>
            )}
          </div>

          {cheatingSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#111827] p-5 rounded-2xl border border-richblack-700 shadow-lg group hover:border-caribbeangreen-400/50 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-richblack-300 text-xs font-bold uppercase tracking-wider">Safe Attempts</p>
                  <span className="text-green-400">🟢</span>
                </div>
                <p className="text-3xl font-bold text-caribbeangreen-50">{cheatingSummary.safe || 0}</p>
              </div>

              <div className="bg-[#111827] p-5 rounded-2xl border border-richblack-700 shadow-lg group hover:border-yellow-400/50 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-richblack-300 text-xs font-bold uppercase tracking-wider">Suspicious</p>
                  <span className="text-yellow-400">🟡</span>
                </div>
                <p className="text-3xl font-bold text-yellow-50">{cheatingSummary.suspicious || 0}</p>
              </div>

              <div className="bg-[#111827] p-5 rounded-2xl border border-pink-500/50 shadow-lg group hover:border-pink-500 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-richblack-300 text-xs font-bold uppercase tracking-wider">High Risk</p>
                  <span className="text-pink-500">🚨</span>
                </div>
                <p className="text-3xl font-bold text-pink-50">{cheatingSummary.high || 0}</p>
                <div className="mt-2 h-1 w-full bg-richblack-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-pink-500 transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (cheatingSummary.highRiskRatio || 0))}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-[#111827] p-5 rounded-2xl border border-richblack-700 shadow-lg group hover:border-blue-400/50 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-richblack-300 text-xs font-bold uppercase tracking-wider">Avg Risk Score</p>
                  <span className="text-blue-400">🛡️</span>
                </div>
                <p className={`text-3xl font-bold ${
                  cheatingSummary.avgRiskScore >= 9 ? "text-pink-500" :
                  cheatingSummary.avgRiskScore >= 4 ? "text-yellow-400" : "text-caribbeangreen-100"
                }`}>
                  {cheatingSummary.avgRiskScore || 0}
                </p>
                <p className="text-[10px] text-richblack-500 font-mono mt-1 uppercase">
                  {cheatingSummary.avgRiskScore >= 9 ? "System Compromised" :
                   cheatingSummary.avgRiskScore >= 4 ? "Elevated Alert" : "Clean History"}
                </p>
              </div>
            </div>
          )}
          
          <div className="bg-[#111827] rounded-2xl overflow-hidden border border-richblack-700">
            <CheatingTable data={cheating} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default InstructorDashboard;
