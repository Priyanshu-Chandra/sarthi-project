import { Link } from "react-router-dom";

const tierConfig = {
  Perfect:             { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/40 shadow-emerald-500/5",  icon: "👑" },
  Excellent:           { color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/40 shadow-blue-500/5",       icon: "🚀" },
  Good:                { color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/40 shadow-indigo-500/5",   icon: "⭐" },
  Average:             { color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/40 shadow-amber-500/5",     icon: "📈" },
  "Needs Improvement": { color: "text-red-400",     bg: "bg-red-500/10 border-red-500/40 shadow-red-500/5",         icon: "💪" },
};

const testTypeConfig = {
  CODING: { badge: "bg-blue-900/50 border-blue-600 text-blue-300", label: "💻 Coding Test" },
  MCQ:    { badge: "bg-purple-900/50 border-purple-600 text-purple-300", label: "📝 MCQ Test" },
};

/* eslint-disable react/prop-types */
function PostTestAnalysis({ analysis }) {
  if (!analysis) return null;

  const {
    weakTopics = [],
    strongTopics = [],
    recommendations = [],
    topicBreakdown = [],
    performanceTier,
    percentage,
    testType,
    cheatingSummary,
  } = analysis;

  const tier          = tierConfig[performanceTier] || tierConfig["Average"];
  const testTypeInfo  = testTypeConfig[testType] || testTypeConfig.MCQ;
  const hasWeakTopics = weakTopics.length > 0;
  const hasStrongTopics = strongTopics.length > 0;
  const hasRecommendations = recommendations.length > 0;

  return (
    <div className="mt-8 rounded-3xl border border-richblack-800 bg-black overflow-hidden shadow-[0_20px_100px_rgba(0,0,0,0.8)] transition-all duration-300">
      {/* Header */}
      <div className="px-8 py-6 border-b border-richblack-800 bg-richblack-900/50 flex items-center justify-between">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
          <span className="text-2xl filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">🧠</span> Learning Insights
        </h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${testTypeInfo.badge}`}>
            {testTypeInfo.label}
          </span>
          <span className={`text-[11px] uppercase tracking-widest font-black px-4 py-1.5 rounded-full border shadow-lg ${tier.bg} text-white`}>
            {tier.icon} {performanceTier}
          </span>
        </div>
      </div>

      <div className="p-8 flex flex-col gap-10">

        {/* Performance Messages */}
        <div className={`flex items-start gap-4 rounded-2xl px-6 py-6 border transition-all ${
          performanceTier === "Perfect" || performanceTier === "Excellent"
            ? "bg-emerald-500/5 border-emerald-500/20" 
            : performanceTier === "Good"
            ? "bg-indigo-500/5 border-indigo-500/20"
            : "bg-amber-500/5 border-amber-500/20"
        }`}>
          <span className="text-3xl filter drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]">
            {performanceTier === "Perfect" ? "👑" : performanceTier === "Excellent" ? "🚀" : "📈"}
          </span>
          <div>
            <p className={`font-black text-lg tracking-tight ${
              performanceTier === "Perfect" || performanceTier === "Excellent" ? "text-emerald-400" : "text-indigo-400"
            }`}>
              {performanceTier === "Perfect"
                ? "Perfect Score Achieved!"
                : performanceTier === "Excellent"
                ? "Exceptional Knowledge!"
                : "Great Progress!"}
            </p>
            <p className="text-sm text-richblack-50 mt-2 leading-relaxed font-medium">
              {performanceTier === "Perfect"
                ? "You have demonstrated absolute mastery of these concepts. Your precision is remarkable!"
                : performanceTier === "Excellent"
                ? "You have a deep understanding of the material. Only minor refinements are needed to reach perfection."
                : "Your foundation is strong. Focus on the few highlighted areas to elevate your proficiency further."}
            </p>
            {percentage !== undefined && (
              <p className="text-xs text-richblack-400 mt-2 font-medium">
                Score: <span className="font-bold text-white">{percentage}%</span>
              </p>
            )}
          </div>
        </div>

        {/* Exam Integrity Section */}
        {cheatingSummary && (
          <div className="rounded-2xl overflow-hidden border border-richblack-800 bg-richblack-900/50 shadow-lg">
            <div className="bg-richblack-800/80 px-6 py-4 border-b border-richblack-700 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <span className="text-xl">🛡️</span> Exam Integrity Report
              </h3>
              {cheatingSummary.suspicious || cheatingSummary.multipleFacesDetected || cheatingSummary.cameraDisabled || cheatingSummary.tabSwitchCount > 3 ? (
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-red-900/40 text-red-400 border border-red-500/30">
                  FLAGGED
                </span>
              ) : (
                 <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-900/40 text-emerald-400 border border-emerald-500/30">
                  CLEAN
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
              <div className="bg-[#0f0f13] border border-richblack-800 rounded-xl p-4 text-center shadow-inner">
                <p className="text-[10px] font-bold text-richblack-400 uppercase mb-2">Tab Switches</p>
                <p className={`text-xl font-black ${cheatingSummary.tabSwitchCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {cheatingSummary.tabSwitchCount}
                </p>
              </div>
              <div className="bg-[#0f0f13] border border-richblack-800 rounded-xl p-4 text-center shadow-inner">
                <p className="text-[10px] font-bold text-richblack-400 uppercase mb-2">Faces Detect</p>
                <p className={`text-xl font-black ${cheatingSummary.multipleFacesDetected ? "text-red-400" : "text-emerald-400"}`}>
                  {cheatingSummary.multipleFacesDetected ? "Multiple" : "1"}
                </p>
              </div>
              <div className="bg-[#0f0f13] border border-richblack-800 rounded-xl p-4 text-center shadow-inner">
                <p className="text-[10px] font-bold text-richblack-400 uppercase mb-2">Camera</p>
                <p className={`text-xl font-black ${cheatingSummary.cameraDisabled ? "text-red-400" : "text-emerald-400"}`}>
                  {cheatingSummary.cameraDisabled ? "Disabled" : "Active"}
                </p>
              </div>
              <div className="bg-[#0f0f13] border border-richblack-800 rounded-xl p-4 text-center shadow-inner">
                <p className="text-[10px] font-bold text-richblack-400 uppercase mb-2">Lookaways</p>
                <p className={`text-xl font-black ${cheatingSummary.lookingAwayCount > 3 ? "text-amber-400" : "text-emerald-400"}`}>
                  {cheatingSummary.lookingAwayCount}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Topic Breakdown Table */}
        {topicBreakdown.length > 0 && (
          <div>
            <p className="text-[10px] text-richblack-500 mb-5 font-black uppercase tracking-[0.2em] flex items-center gap-2">
               📊 Detailed Topic Analysis
            </p>
            <div className="rounded-2xl overflow-hidden border border-richblack-800 shadow-xl bg-[#050505]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-richblack-900 text-richblack-300 text-[10px] uppercase tracking-widest font-black">
                    <th className="px-6 py-4 text-left">Concept Area</th>
                    <th className="px-6 py-4 text-center">{testType === "CODING" ? "Solved" : "Correct"}</th>
                    <th className="px-6 py-4 text-center">Total</th>
                    <th className="px-6 py-4 text-center">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-richblack-800">
                  {topicBreakdown.map((row, i) => {
                    const accuracy = row.accuracy ?? (row.total > 0 ? Math.round(((row.total - row.wrong) / row.total) * 100) : 0);
                    const classification = row.classification;
                    return (
                      <tr
                        key={i}
                        className={`transition-colors hover:bg-richblack-900/30 ${
                          classification === "weak"   ? "bg-red-500/5"     :
                          classification === "strong" ? "bg-emerald-500/5" :
                          "bg-transparent"
                        }`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${
                              classification === "weak" ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                              classification === "strong" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                              "bg-richblack-700"
                            }`} />
                            <span className="font-bold text-white">{row.topic}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center font-black text-white">
                          {row.total - row.wrong}
                        </td>
                        <td className="px-6 py-5 text-center text-richblack-400 font-medium">{row.total}</td>
                        <td className="px-6 py-5 text-center">
                          <div className={`inline-block px-4 py-1.5 rounded-full border font-black text-xs ${
                            accuracy >= 90 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
                            accuracy >= 70 ? "text-blue-400 bg-blue-500/10 border-blue-500/30"   :
                            accuracy >= 40 ? "text-amber-400 bg-amber-500/10 border-amber-500/30"   :
                            "text-red-400 bg-red-500/10 border-red-500/30"
                          }`}>
                            {accuracy}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Practice CTA */}
        {hasWeakTopics && (
          <div className="flex items-center justify-between bg-indigo-500/5 rounded-2xl p-6 border border-indigo-500/20 shadow-lg">
            <div className="flex items-center gap-4">
               <span className="text-3xl filter drop-shadow-[0_0_12px_rgba(99,102,241,0.2)]">🎯</span>
               <div>
                  <p className="font-black text-indigo-400 tracking-tight">Targeted Practice Available</p>
                  <p className="text-sm text-richblack-400 font-medium mt-1">Strengthen your core by practicing these specific topics.</p>
               </div>
            </div>
            <Link
              to="/dashboard/coding-practice/problems"
              className="shrink-0 ml-4 px-6 py-3 bg-indigo-600 text-white text-sm font-black uppercase tracking-widest rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 border border-indigo-400/30"
            >
              Start Practice
            </Link>
          </div>
        )}

        {/* Recommendations Section */}
        {hasRecommendations && (
          <div className="bg-yellow-500/5 rounded-2xl p-6 border border-yellow-500/20 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">💡</span>
              <div>
                <p className="font-black text-yellow-400 tracking-tight">Personalized Recommendations</p>
                <p className="text-sm text-richblack-400 font-medium">Based on your weak areas, we suggest exploring these topics next.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendations.map((rec, i) => (
                <Link
                  key={i}
                  to={`/dashboard/coding-practice/problems?topic=${encodeURIComponent(rec)}`}
                  className="px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-bold hover:bg-yellow-500/20 hover:text-yellow-200 transition-all"
                >
                  {rec}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Strong Topics Section */}
        {hasStrongTopics && (
          <div className="bg-emerald-500/5 rounded-2xl p-6 border border-emerald-500/20 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🏆</span>
              <p className="font-black text-emerald-400 tracking-tight">Topics You Mastered</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {strongTopics.map((topic, i) => (
                <span
                  key={i}
                  className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default PostTestAnalysis;
