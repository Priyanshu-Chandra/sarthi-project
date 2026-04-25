import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiConnector } from "../../../services/apiConnector";

// ─────────────────────────────────────────────────────────────────────────────
// InstructorLiveDashboard
// Renders as a full-screen overlay inside LiveClass.jsx.
// Receives live metrics via the `metrics` prop (pushed from socket)
// and loads post-class summary when sessionId is provided and class has ended.
// ─────────────────────────────────────────────────────────────────────────────
export default function InstructorLiveDashboard({ metrics, sessionId, onClose, isLive }) {
  const [summary, setSummary]             = useState(null);
  const [students, setStudents]           = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [engagementHistory, setEngagementHistory] = useState([]);
  const [activeTab, setActiveTab]         = useState("overview"); // overview | students

  // Build a short engagement timeline from live metrics snapshots (Live Mode Only)
  useEffect(() => {
    if (!metrics || isLive === false) return;
    setEngagementHistory(prev => {
      const snap = {
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        active: metrics.activeStudents || 0,
        messages: metrics.messages || 0,
        polls: metrics.pollResponses || 0,
      };
      const updated = [...prev, snap];
      return updated.slice(-30); 
    });
  }, [metrics, isLive]);

  // Load post-class summary once class ends and sessionId is available
  useEffect(() => {
    if (isLive || !sessionId) return;
    const loadSummary = async () => {
      setLoadingSummary(true);
      try {
        const [sumRes, stuRes] = await Promise.all([
          apiConnector("GET", `/api/v1/live-analytics/session/${sessionId}/summary`),
          apiConnector("GET", `/api/v1/live-analytics/session/${sessionId}/students?limit=100`),
        ]);
        if (sumRes.data?.success) setSummary(sumRes.data.summary);
        if (stuRes.data?.success) setStudents(stuRes.data.students);
      } catch (err) {
        console.error("Summary load failed:", err);
      } finally {
        setLoadingSummary(false);
      }
    };
    loadSummary();
  }, [isLive, sessionId]);

  // ── Colour/Status Helpers ──────────────────────────────────────────────
  const statusColor = (s) => {
    switch(s?.toLowerCase()) {
      case "active": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "passive": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "dropoff": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-richblack-700 text-richblack-300";
    }
  };

  const insightIcon = (lvl) => {
    if (lvl === "high") return "🔥";
    if (lvl === "medium") return "⚠️";
    return "💡";
  };

  const trophyIcon = (index) => {
    if (index === 0) return "🏆";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "⭐";
  };

  const formatClockTime = (dateStr) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-richblack-900/98 backdrop-blur-md overflow-hidden text-richblack-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-richblack-700 px-6 py-4 shrink-0 bg-richblack-800/50">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold tracking-tight">Analytics Dashboard</h2>
          {isLive ? (
            <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE MONITORING
            </span>
          ) : (
            <span className="rounded-full bg-richblack-700 px-3 py-1 text-xs font-medium text-richblack-300">Session Summary</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg bg-richblack-800 border border-richblack-700 px-4 py-2 text-sm font-medium hover:bg-richblack-700 transition-all active:scale-95"
        >
          ✕ Close Analytics
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
        {isLive ? (
          /* ── LIVE MONITORING VIEW ── */
          <div className="space-y-8 max-w-6xl mx-auto">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Active Students", value: metrics.activeStudents, icon: "👥", color: "from-blue-500/20 to-transparent border-blue-500/30" },
                { label: "Hands Raised",    value: metrics.raisedHands,    icon: "✋", color: "from-yellow-400/20 to-transparent border-yellow-400/30" },
                { label: "Engagement",      value: metrics.messages + (metrics.pollResponses * 2), icon: "⚡", color: "from-purple-400/20 to-transparent border-purple-400/30" },
                { label: "Whiteboard",      value: metrics.boardDraws,     icon: "🎨", color: "from-emerald-400/20 to-transparent border-emerald-400/30" },
              ].map(card => (
                <div key={card.label} className={`group rounded-2xl border bg-gradient-to-br p-5 transition-all hover:translate-y-[-2px] ${card.color}`}>
                  <div className="text-3xl mb-3 opacity-80 group-hover:scale-110 transition-transform">{card.icon}</div>
                  <div className="text-3xl font-black">{card.value ?? "0"}</div>
                  <div className="text-xs font-medium text-richblack-400 uppercase tracking-wider mt-1">{card.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-richblack-800 bg-richblack-800/40 p-6">
              <h3 className="mb-6 flex items-center gap-2 text-sm font-semibold text-richblack-100">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                Real-time Engagement Stream
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={engagementHistory}>
                  <defs>
                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.4)" }}
                    labelStyle={{ color: "#94a3b8", fontSize: 11 }}
                  />
                  <Area type="monotone" dataKey="messages" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorActive)" strokeWidth={3} name="Chat" />
                  <Area type="monotone" dataKey="active"   stroke="#3b82f6" fillOpacity={0.1} strokeWidth={3} name="Users" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          /* ── POST-SESSION ANALYSIS VIEW ── */
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex gap-2 p-1.5 bg-richblack-800 rounded-xl w-fit">
              {["overview", "students"].map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === t ? "bg-yellow-50 text-richblack-900 shadow-lg" : "text-richblack-400 hover:text-richblack-50"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {loadingSummary ? (
              <div className="flex h-64 items-center justify-center gap-3 text-richblack-400">
                <div className="h-5 w-5 border-2 border-yellow-50 border-t-transparent rounded-full animate-spin" />
                Aggregating session metrics...
              </div>
            ) : summary ? (
              activeTab === "overview" ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                  <div className="lg:col-span-2 space-y-8">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {[ 
                        { label: "Active", value: summary.activeCount, sub: "Stayed > 60% time", color: "text-emerald-400" },
                        { label: "Passive", value: summary.passiveCount, sub: "Stayed 20-60%", color: "text-yellow-400" },
                        { label: "Dropped", value: summary.dropoffCount, sub: "Left < 20% time", color: "text-red-400" },
                        { label: "Hands Raised", value: summary.raisedHands, sub: "In-class curiosity", color: "text-blue-400" },
                        { label: "Late Joiners", value: summary.lateJoiners, sub: "Joined > 5 min late", color: "text-richblack-200" },
                      ].map(m => (
                        <div key={m.label} className="bg-richblack-800/40 border border-richblack-700/50 p-5 rounded-2xl">
                          <p className="text-[10px] font-black text-richblack-400 uppercase tracking-widest">{m.label}</p>
                          <p className={`text-4xl font-black mt-1 ${m.color}`}>{m.value ?? 0}</p>
                          <p className="text-[10px] text-richblack-500 mt-2 italic">{m.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* Full Timeline Chart */}
                    <div className="bg-richblack-800/40 border border-richblack-800 p-6 rounded-2xl">
                      <h3 className="text-sm font-bold mb-6 text-richblack-100 uppercase tracking-wide">Engagement Timeline (Per Minute)</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={summary.timeline || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                          <XAxis dataKey="minute" label={{ value: 'Minute', position: 'insideBottom', offset: -5 }} />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: 12 }}
                            itemStyle={{ fontSize: 12, padding: "2px 0" }}
                          />
                          <Area type="monotone" dataKey="chat"  stackId="1" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.4} name="Chat Messages" />
                          <Area type="monotone" dataKey="board" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.4} name="Whiteboard" />
                          <Area type="monotone" dataKey="active" stroke="#3b82f6" fill="transparent" strokeWidth={2} name="Active Users" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Insights Panel */}
                    <div className="bg-gradient-to-b from-richblack-800 to-richblack-900 border border-richblack-700 p-6 rounded-2xl h-fit">
                      <h3 className="text-xs font-black text-yellow-100 uppercase tracking-[0.2em] mb-5">Command Insights</h3>
                      <div className="space-y-4">
                        {summary.insights?.map((ins, i) => (
                          <div key={i} className="flex gap-4 p-4 rounded-xl bg-richblack-700/30 border border-richblack-600/30 animate-fade-in">
                            <span className="text-xl shrink-0">{insightIcon(ins.level)}</span>
                            <p className="text-sm leading-relaxed text-richblack-50">{ins.msg}</p>
                          </div>
                        ))}
                        {(!summary.insights || summary.insights.length === 0) && (
                          <p className="text-sm text-richblack-400 italic">No critical anomalies detected this session.</p>
                        )}
                      </div>
                    </div>

                    {/* NEW: Leaderboard Panel (Product-Level Improvement) */}
                    {summary.topParticipants?.length > 0 && (
                      <div className="bg-richblack-900 border border-richblack-700 p-6 rounded-2xl shadow-2xl">
                         <h3 className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] mb-5">Top Participants</h3>
                         <div className="space-y-3">
                            {summary.topParticipants.slice(0, 5).map((p, i) => (
                               <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-richblack-800/40 border border-richblack-700/50 hover:bg-richblack-700/30 transition-all group">
                                  <div className="flex items-center gap-3">
                                     <span className="text-lg w-8 text-center">{trophyIcon(i)}</span>
                                     <div>
                                        <p className="text-sm font-bold text-richblack-50 group-hover:text-white">{p.name}</p>
                                        <p className="text-[10px] text-richblack-500">{p.activeMinutes}m active</p>
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-xs font-black text-emerald-400">{p.engagementScore}</p>
                                     <p className="text-[9px] uppercase tracking-tighter text-richblack-600 font-bold">Score</p>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    )}

                    <div className="bg-richblack-800/40 p-6 rounded-2xl border border-richblack-700">
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-richblack-400">Class Interval</span>
                          <span className="font-mono text-yellow-50">{formatClockTime(summary.startedAt)} - {formatClockTime(summary.endedAt)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-richblack-400">Duration</span>
                          <span className="font-bold">{Math.round(summary.durationSeconds/60)} minutes</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-richblack-400">Total Enrolled</span>
                          <span className="font-bold">{summary.expectedStudents}</span>
                        </div>
                        <div className="flex justify-between text-xs text-emerald-400">
                          <span className="opacity-80">Attendance Rate</span>
                          <span className="font-black">{summary.attendanceRate}%</span>
                        </div>
                        <div className="flex justify-between text-xs pt-2 border-t border-richblack-700/50">
                          <span className="text-richblack-500 italic">Termination</span>
                          <span className={`font-bold uppercase tracking-tighter ${summary.endedReason === 'completed' ? 'text-emerald-400' : 'text-pink-400'}`}>
                             {summary.endedReason || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Students Tab Overhaul ── */
                <div className="bg-richblack-800/20 border border-richblack-800 rounded-2xl overflow-hidden mb-10">
                  <div className="grid grid-cols-5 bg-richblack-800 px-6 py-4 text-xs font-black uppercase tracking-widest text-richblack-400 border-b border-richblack-700">
                    <span>Student</span>
                    <span className="text-center">Active Time</span>
                    <span className="text-center">Engagement</span>
                    <span className="text-center">Rejoins</span>
                    <span className="text-center">Final Status</span>
                  </div>
                  <div className="divide-y divide-richblack-800/50">
                    {students.map(s => (
                      <div key={s.userId} className="grid grid-cols-5 items-center px-6 py-4 hover:bg-richblack-700/20 transition-all group">
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-yellow-50 transition-colors">{s.name}</p>
                          <p className="text-[10px] text-richblack-400 font-medium">{s.email}</p>
                        </div>
                        <p className="text-center text-sm font-mono">{s.activeMinutes}m</p>
                        <p className="text-center text-sm font-black text-richblack-50">{s.engagementScore}</p>
                        <p className="text-center text-sm text-richblack-400">{s.rejoinCount > 3 ? `${s.rejoinCount}⚠️` : s.rejoinCount}</p>
                        <div className="flex justify-center">
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border shadow-sm ${statusColor(s.status)}`}>
                            {s.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
