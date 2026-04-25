import { Link } from "react-router-dom";

const tierConfig = {
  Perfect:             { color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/20",  icon: "👑" },
  Excellent:           { color: "text-blue-400",    bg: "bg-blue-500/5 border-blue-500/20",       icon: "🚀" },
  Good:                { color: "text-indigo-400",  bg: "bg-indigo-500/5 border-indigo-500/20",   icon: "⭐" },
  Average:             { color: "text-amber-400",   bg: "bg-amber-500/5 border-amber-500/20",     icon: "📈" },
  "Needs Improvement": { color: "text-red-400",     bg: "bg-red-500/5 border-red-500/20",         icon: "💪" },
};

const testTypeConfig = {
  CODING: { badge: "bg-blue-900/50 border-blue-600 text-blue-300", label: "💻 Coding Test" },
  MCQ:    { badge: "bg-purple-900/50 border-purple-600 text-purple-300", label: "📝 MCQ Test" },
};

const violationDisplayMap = {
  TAB_SWITCH:         { label: "Tab switching",      icon: "🔀", color: "text-amber-400/80" },
  WINDOW_BLUR:        { label: "Window focus lost",  icon: "🪟", color: "text-amber-400/80" },
  CAMERA_DISABLED:    { label: "Camera lost/off",    icon: "🚫", color: "text-red-400/80" },
  CAMERA_OBSTRUCTED:  { label: "View obstructed",    icon: "🌚", color: "text-red-400/80" },
  MULTIPLE_FACES:     { label: "Multiple people",    icon: "👥", color: "text-red-400/80" },
  FACE_MISSING:       { label: "Face not visible",   icon: "❌", color: "text-red-400/80" },
  MIC_ACTIVITY:       { label: "Suspicious noise",   icon: "🔊", color: "text-amber-400/80" },
  LOOKING_AWAY:       { label: "Gaze distraction",   icon: "👀", color: "text-amber-400/80" },
  DEVTOOLS:           { label: "Developer tools",    icon: "🛠️", color: "text-red-400/80" },
  COPY:               { label: "Clipboard action",   icon: "📋", color: "text-amber-400/80" },
  PASTE:              { label: "Clipboard action",   icon: "📋", color: "text-amber-400/80" },
  KEYBOARD_SHORTCUT:  { label: "Restricted keys",    icon: "⌨️", color: "text-amber-400/80" },
  FULLSCREEN_EXIT:    { label: "Security exit",      icon: "🚪", color: "text-red-400/80" },
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
    score,
    totalQuestions,
    timeTakenSeconds,
  } = analysis;

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const tier          = tierConfig[performanceTier] || tierConfig["Average"];
  const testTypeInfo  = testTypeConfig[testType] || testTypeConfig.MCQ;
  const hasWeakTopics = weakTopics.length > 0;
  const hasStrongTopics = strongTopics.length > 0;
  const hasRecommendations = recommendations.length > 0;

  return (
    <div className="mt-8 rounded-3xl border border-richblack-800 bg-black overflow-hidden shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="px-8 py-6 border-b border-richblack-800 bg-richblack-900/30 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
          <span className="text-2xl opacity-80">🧠</span> Learning insights
        </h2>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${testTypeInfo.badge}`}>
            {testTypeInfo.label}
          </span>
          <span className={`text-[10px] font-bold px-4 py-1.5 rounded-full border ${tier.bg} ${tier.color}`}>
            {tier.icon} {performanceTier}
          </span>
        </div>
      </div>

      <div className="p-8 flex flex-col gap-10">
        {/* Security Alert Integration (Item 5/6) */}
        {cheatingSummary?.suspicious && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex items-center gap-6">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl shrink-0">
              ⚠️
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-400 tracking-tight">Security integrity alert</h3>
              <p className="text-richblack-200 text-sm mt-1 leading-relaxed font-medium">
                Significant activity variances were detected during the session. 
                Certificate eligibility is pending manual review.
              </p>
            </div>
          </div>
        )}

        {/* Performance Messages */}
        <div className={`relative flex items-start gap-4 rounded-2xl px-6 py-6 border transition-all overflow-hidden shadow-lg ${
          performanceTier === "Perfect" || performanceTier === "Excellent"
            ? "bg-gradient-to-br from-emerald-900/40 to-emerald-900/5 border-emerald-500/30" 
            : performanceTier === "Good"
            ? "bg-gradient-to-br from-indigo-900/40 to-indigo-900/5 border-indigo-500/30"
            : "bg-gradient-to-br from-amber-900/40 to-amber-900/5 border-amber-500/30"
        }`}>
          {/* Subtle glow effect */}
          <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[50px] opacity-20 pointer-events-none ${
             performanceTier === "Perfect" || performanceTier === "Excellent" ? "bg-emerald-500" :
             performanceTier === "Good" ? "bg-indigo-500" : "bg-amber-500"
          }`}></div>
          <span className="text-3xl filter drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]">
            {performanceTier === "Perfect" ? "👑" : performanceTier === "Excellent" ? "🚀" : "📈"}
          </span>
          <div>
            <p className={`font-bold text-lg tracking-tight ${
              performanceTier === "Perfect" || performanceTier === "Excellent" ? "text-emerald-400" : "text-indigo-400"
            }`}>
              {performanceTier === "Perfect"
                ? "Perfect score achieved!"
                : performanceTier === "Excellent"
                ? "Exceptional knowledge!"
                : "Great progress!"}
            </p>
            <p className="text-sm text-richblack-100 mt-1.5 leading-relaxed font-medium">
              {performanceTier === "Perfect"
                ? "You have demonstrated mastery of these concepts. Your precision is remarkable!"
                : performanceTier === "Excellent"
                ? "You have a deep understanding of the material. Minimal refinements needed to reach perfection."
                : "Your foundation is strong. Focus on highlighted areas to elevate your proficiency further."}
            </p>
            {percentage !== undefined && (
              <div className="mt-5 flex items-center">
                <div className={`flex items-center gap-4 px-5 py-2 rounded-xl bg-black/20 border border-white/5`}>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-richblack-400 font-bold">Score</span>
                    <span className="text-sm font-bold text-white">{score}/{totalQuestions}</span>
                  </div>
                  <div className="w-px h-6 bg-richblack-700" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-richblack-400 font-bold">Accuracy</span>
                    <span className="text-sm font-bold text-white">{percentage}%</span>
                  </div>
                  <div className="w-px h-6 bg-richblack-700" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-richblack-400 font-bold">Time taken</span>
                    <span className="text-sm font-bold text-white">{formatTime(timeTakenSeconds)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Exam Integrity Section */}
        {cheatingSummary && (
          <div className="rounded-2xl overflow-hidden border border-richblack-800 bg-richblack-900/20">
            <div className="bg-richblack-800/30 px-6 py-4 border-b border-richblack-700 flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-richblack-200 tracking-wider flex items-center gap-2">
                <span className="text-lg">🛡️</span> Exam integrity report
              </h3>
              {cheatingSummary.integrityScore !== undefined ? (
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cheatingSummary.integrityScore >= 90 ? "bg-emerald-900/20 text-emerald-400 border-emerald-500/20" : cheatingSummary.integrityScore >= 70 ? "bg-amber-900/20 text-amber-400 border-amber-500/20" : "bg-red-900/20 text-red-400 border-red-500/20"}`}>
                   Integrity score: {cheatingSummary.integrityScore}%
                 </span>
              ) : (
                cheatingSummary.suspicious || cheatingSummary.multipleFacesDetected || cheatingSummary.cameraDisabled || cheatingSummary.tabSwitchCount > 3 ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/20 text-red-400 border border-red-500/20">
                    Flagged
                  </span>
                ) : (
                   <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/20 text-emerald-400 border border-emerald-500/20">
                    Clean
                  </span>
                )
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-6">
              {[
                { label: "Tab switches", value: cheatingSummary.tabSwitchCount, unit: "Events", alert: cheatingSummary.tabSwitchCount > 0 },
                { label: "Presence", value: cheatingSummary.multipleFacesDetected ? "Variable" : "Verified", alert: cheatingSummary.multipleFacesDetected },
                { label: "Sensor status", value: cheatingSummary.cameraDisabled ? "Lost" : "Stable", alert: cheatingSummary.cameraDisabled },
                { label: "Attention", value: cheatingSummary.lookingAwayCount > 5 ? "Variable" : "High", alert: cheatingSummary.lookingAwayCount > 5 },
                { label: "Atmosphere", value: cheatingSummary.noiseDetected ? "Active" : "Quiet", alert: cheatingSummary.noiseDetected },
              ].map((stat, i) => (
                <div key={i} className={`p-4 rounded-xl border transition-all ${stat.alert ? "border-amber-500/20 bg-amber-500/5 text-amber-400" : "border-richblack-800 bg-richblack-800/30 text-white"}`}>
                  <p className="text-[9px] font-bold text-richblack-400 mb-1.5 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Forensic Violation Timeline (Item 7 Upgrade) */}
        {cheatingSummary?.violationLogs?.length > 0 && (
          <div className="rounded-2xl border border-richblack-800 bg-[#070707]">
             <div className="px-6 py-4 border-b border-richblack-800 bg-richblack-900/20 flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-richblack-400 uppercase tracking-widest flex items-center gap-2">
                  📊 Observation chronology
                </h4>
             </div>
             <div className="p-2 flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                {cheatingSummary.violationLogs.map((log, idx) => {
                  const meta = violationDisplayMap[log.type] || { label: log.type, icon: "⚠️", color: "text-richblack-400" };
                  return (
                    <div key={idx} className="flex items-center justify-between px-4 py-2 hover:bg-richblack-800/20 rounded-lg transition-colors border border-transparent hover:border-richblack-800/40">
                       <div className="flex items-center gap-3">
                          <span className="text-sm">{meta.icon}</span>
                          <span className={`text-[11px] font-bold ${meta.color}`}>{meta.label}</span>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black border border-richblack-700 px-2 py-0.5 rounded-md text-richblack-400 bg-richblack-900">
                             Penalty: -{log.weight || 2}
                          </span>
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        {/* Topic Breakdown Table */}
        {topicBreakdown.length > 0 && (
          <div>
            <p className="text-[10px] text-richblack-500 mb-4 font-bold uppercase tracking-widest flex items-center gap-2">
               📈 Topic breakdown
            </p>
            <div className="rounded-2xl overflow-hidden border border-richblack-800 bg-[#050505]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-richblack-900/50 text-richblack-400 text-[9px] uppercase tracking-wider font-bold">
                    <th className="px-6 py-4 text-left">Knowledge area</th>
                    <th className="px-6 py-4 text-center">{testType === "CODING" ? "Solved" : "Correct"}</th>
                    <th className="px-6 py-4 text-center">Total</th>
                    <th className="px-6 py-4 text-center">Proficiency</th>
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
                          <div className={`inline-block px-4 py-1.5 rounded-full border font-black text-xs text-white shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                            accuracy >= 90 ? "bg-emerald-600 border-emerald-400 shadow-emerald-500/20" :
                            accuracy >= 70 ? "bg-blue-600 border-blue-400 shadow-blue-500/20"   :
                            accuracy >= 40 ? "bg-amber-600 border-amber-400 shadow-amber-500/20"   :
                            "bg-red-600 border-red-400 shadow-red-500/20"
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
          <div className="flex items-center justify-between bg-indigo-500/5 rounded-2xl p-6 border border-indigo-500/10">
            <div className="flex items-center gap-4">
               <span className="text-2xl">🎯</span>
               <div>
                  <p className="font-bold text-indigo-400 tracking-tight">Personalized practice</p>
                  <p className="text-sm text-richblack-400 font-medium mt-1">Strengthen your core by practicing these specific topics.</p>
               </div>
            </div>
            <Link
              to="/dashboard/coding-practice/problems"
              className="shrink-0 ml-4 px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 transition-all active:scale-95 border border-indigo-400/20"
            >
              Start practice
            </Link>
          </div>
        )}

        {/* Recommendations Section */}
        {hasRecommendations && (
          <div className="bg-yellow-500/5 rounded-2xl p-6 border border-yellow-500/10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">💡</span>
              <div>
                <p className="font-bold text-yellow-500 tracking-tight">Smarter recommendations</p>
                <p className="text-sm text-richblack-400 font-medium">Based on your weak areas, we suggest exploring these topics next.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendations.map((rec, i) => (
                <Link
                  key={i}
                  to={`/dashboard/coding-practice/problems?topic=${encodeURIComponent(rec)}`}
                  className="px-4 py-2 rounded-full bg-richblack-800 border border-richblack-700 text-yellow-400 text-xs font-bold hover:bg-richblack-700 transition-all"
                >
                  {rec}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Strong Topics Section */}
        {hasStrongTopics && (
          <div className="bg-emerald-500/5 rounded-2xl p-6 border border-emerald-500/10">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🏆</span>
              <p className="font-bold text-emerald-400 tracking-tight">Topics mastered</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {strongTopics.map((topic, i) => (
                <span
                  key={i}
                  className="px-4 py-1.5 rounded-full bg-richblack-800 border border-richblack-700 text-emerald-400 text-xs font-bold"
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
