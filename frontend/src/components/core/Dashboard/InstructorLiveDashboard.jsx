import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import { apiConnector } from "../../../services/apiConnector";

// ─────────────────────────────────────────────────────────────────────────────
// InstructorLiveDashboard
// Props:
//   metrics    — live socket metrics (live mode only)
//   sessionId  — MongoDB session _id (required for post-session load)
//   isLive     — true while class is running, false after it ends
//   isHistorical — true when opened from InstructorSessionHistory (no live data)
//   onClose    — callback to close the overlay
// ─────────────────────────────────────────────────────────────────────────────
export default function InstructorLiveDashboard({ metrics, sessionId, isLive, isHistorical, onClose }) {
  const { token } = useSelector((s) => s.auth);

  const [summary, setSummary]             = useState(null);
  const [students, setStudents]           = useState([]);
  const [polls, setPolls]                 = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingPolls, setLoadingPolls]     = useState(false);
  const [loadError, setLoadError]         = useState(null);
  const [engagementHistory, setEngagementHistory] = useState([]);
  const [activeTab, setActiveTab]         = useState("overview");

  const showLive = isLive && !isHistorical;

  // ── Live engagement timeline (only in live mode) ──────────────────────────
  useEffect(() => {
    if (!showLive || !metrics) return;
    setEngagementHistory(prev => {
      const snap = {
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        active:   metrics.activeStudents  || 0,
        messages: metrics.messages        || 0,
        polls:    metrics.pollResponses   || 0,
        board:    metrics.boardDraws      || 0,
      };
      return [...prev, snap].slice(-30);
    });
  }, [metrics, showLive]);

  // ── Post-class summary load ───────────────────────────────────────────────
  useEffect(() => {
    if (showLive || !sessionId) return;
    const load = async () => {
      setLoadingSummary(true);
      setLoadError(null);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const BASE = import.meta.env.VITE_APP_BASE_URL || "";
        const [sumRes, stuRes] = await Promise.all([
          apiConnector("GET", `${BASE}/api/v1/live-analytics/session/${sessionId}/summary`, null, headers),
          apiConnector("GET", `${BASE}/api/v1/live-analytics/session/${sessionId}/students?limit=100`, null, headers),
        ]);
        if (sumRes.data?.success) setSummary(sumRes.data.summary);
        else setLoadError(sumRes.data?.message || "Failed to load summary");
        if (stuRes.data?.success) setStudents(stuRes.data.students || []);
      } catch (err) {
        console.error("Dashboard load failed:", err);
        setLoadError("Could not connect to analytics server.");
      } finally {
        setLoadingSummary(false);
      }
    };
    load();
  }, [showLive, sessionId, token]);

  // ── Polls load (historical) ────────────────────────────────────────────────
  useEffect(() => {
    if (showLive || activeTab !== "polls" || !sessionId) return;
    const loadPolls = async () => {
      setLoadingPolls(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const BASE = import.meta.env.VITE_APP_BASE_URL || "";
        const res = await apiConnector("GET", `${BASE}/api/v1/live-analytics/session/${sessionId}/polls`, null, headers);
        if (res.data?.success) setPolls(res.data.polls || []);
      } catch (err) {
        console.error("Polls load failed:", err);
      } finally {
        setLoadingPolls(false);
      }
    };
    loadPolls();
  }, [activeTab, sessionId, showLive, token]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const statusColor = (s) => {
    switch (s?.toLowerCase()) {
      case "active":  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "passive": return "bg-yellow-500/20  text-yellow-400  border-yellow-500/30";
      case "dropoff": return "bg-red-500/20     text-red-400     border-red-500/30";
      default:        return "bg-white/10       text-white/40";
    }
  };
  const insightIcon = (lvl) => lvl === "high" ? "🔥" : lvl === "medium" ? "⚠️" : "💡";
  const trophy      = (i)   => ["🏆","🥈","🥉","⭐","⭐"][i] ?? "⭐";
  const fmt         = (d)   => d ? new Date(d).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}) : "--:--";
  const safeMetrics = metrics || { activeStudents:0, raisedHands:0, messages:0, pollResponses:0, boardDraws:0 };

  // ── Donut data (post session) ─────────────────────────────────────────────
  const donut = summary ? [
    { name: "Active",  value: summary.activeCount  || 0, color: "#10b981" },
    { name: "Passive", value: summary.passiveCount || 0, color: "#f59e0b" },
    { name: "Dropped", value: summary.dropoffCount || 0, color: "#ef4444" },
  ] : [];

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0a0a10] text-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-white/8 px-8 py-5 shrink-0 bg-gradient-to-r from-[#0d0d18] to-[#0a0a14]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-lg">📊</div>
            <h2 className="text-lg font-black tracking-tight">
              {showLive ? "Live Analytics" : "Session Report"}
            </h2>
          </div>
          {showLive ? (
            <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[10px] font-black text-emerald-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE
            </span>
          ) : (
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-[10px] font-black text-indigo-400 uppercase tracking-wider">
              POST-CLASS
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-xl bg-white/5 border border-white/10 px-5 py-2 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
        >✕ Close</button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* ══ LIVE MODE ══ */}
        {showLive && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label:"Active Students", value: safeMetrics.activeStudents, icon:"👥", from:"from-blue-500/20",  border:"border-blue-500/20"  },
                { label:"Hands Raised",    value: safeMetrics.raisedHands,    icon:"✋", from:"from-yellow-400/20",border:"border-yellow-400/20" },
                { label:"Chat Messages",   value: safeMetrics.messages,       icon:"💬", from:"from-purple-500/20",border:"border-purple-500/20" },
                { label:"Board Draws",     value: safeMetrics.boardDraws,     icon:"🎨", from:"from-emerald-400/20",border:"border-emerald-400/20"},
                { label:"Poll Votes",      value: safeMetrics.pollResponses,  icon:"📊", from:"from-pink-500/20", border:"border-pink-500/20"},
              ].map(c => (
                <div key={c.label} className={`rounded-2xl border bg-gradient-to-br ${c.from} to-transparent ${c.border} p-5 hover:-translate-y-0.5 transition-all`}>
                  <div className="text-3xl mb-3 opacity-80">{c.icon}</div>
                  <div className="text-3xl font-black">{c.value ?? 0}</div>
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mt-1">{c.label}</div>
                </div>
              ))}
            </div>

            {/* Engagement stream chart */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
              <h3 className="mb-5 text-xs font-black uppercase tracking-[0.2em] text-white/50 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />Real-time Engagement
              </h3>
              {engagementHistory.length < 2 ? (
                <div className="flex h-40 items-center justify-center text-white/20 text-xs font-bold uppercase tracking-widest">
                  Waiting for data points...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={engagementHistory}>
                    <defs>
                      <linearGradient id="gMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                    <XAxis dataKey="time" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:12 }}
                      labelStyle={{ color:"#94a3b8", fontSize:11 }}
                    />
                    <Area type="monotone" dataKey="messages" stroke="#8b5cf6" fill="url(#gMessages)" strokeWidth={2} name="Chat" />
                    <Area type="monotone" dataKey="active"   stroke="#3b82f6" fill="url(#gActive)"   strokeWidth={2} name="Active" />
                    <Area type="monotone" dataKey="board"    stroke="#10b981" fill="transparent"     strokeWidth={1.5} strokeDasharray="4 2" name="Board" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* ══ POST-SESSION MODE ══ */}
        {!showLive && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Tab bar */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-xl w-fit border border-white/8">
              {["overview","students","polls"].map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === t ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-white/40 hover:text-white/70"
                  }`}>{t}</button>
              ))}
            </div>

            {loadingSummary ? (
              <div className="flex h-64 items-center justify-center gap-3 text-white/30">
                <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold uppercase tracking-widest">Aggregating metrics…</span>
              </div>
            ) : loadError ? (
              <div className="flex flex-col h-64 items-center justify-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/5">
                <div className="text-4xl">⚠️</div>
                <p className="text-sm font-bold text-red-400">{loadError}</p>
                <p className="text-xs text-white/30">Ensure the backend is running and the session exists.</p>
              </div>
            ) : !summary ? (
              <div className="flex flex-col h-64 items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10">
                <div className="text-4xl opacity-20">📋</div>
                <p className="text-xs font-black uppercase tracking-widest text-white/30">No report data found</p>
                <p className="text-[10px] text-white/20">The session may not have any recorded analytics yet.</p>
              </div>
            ) : activeTab === "overview" ? (

              /* ── Overview Tab ── */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
                {/* Left col */}
                <div className="lg:col-span-2 space-y-6">

                  {/* Attendance Donut + Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Donut chart */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 flex flex-col items-center justify-center">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-4">Attendance Breakdown</h3>
                      {donut.every(d => d.value === 0) ? (
                        <div className="text-white/20 text-xs">No attendance data</div>
                      ) : (
                        <PieChart width={160} height={160}>
                          <Pie data={donut} cx={80} cy={80} innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value">
                            {donut.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                        </PieChart>
                      )}
                      <div className="flex gap-4 mt-3 flex-wrap justify-center">
                        {donut.map(d => (
                          <div key={d.name} className="flex items-center gap-1.5 text-[10px] font-bold">
                            <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                            <span className="text-white/50">{d.name}</span>
                            <span className="font-black text-white/80">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* KPI grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label:"Active",      value: summary.activeCount,  color:"text-emerald-400", sub:"≥ 60% time" },
                        { label:"Passive",     value: summary.passiveCount, color:"text-yellow-400",  sub:"20-60% time" },
                        { label:"Dropped",     value: summary.dropoffCount, color:"text-red-400",     sub:"< 20% time" },
                        { label:"Attendance",  value: summary.attendanceRate != null ? `${summary.attendanceRate}%` : "—", color:"text-indigo-400", sub:"of enrolled" },
                        { label:"Hands",       value: summary.raisedHands  || 0, color:"text-blue-400",   sub:"raised" },
                        { label:"Late",        value: summary.lateJoiners  || 0, color:"text-orange-400", sub:"joined > 5 min" },
                      ].map(m => (
                        <div key={m.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{m.label}</p>
                          <p className={`text-2xl font-black mt-1 ${m.color}`}>{m.value ?? 0}</p>
                          <p className="text-[9px] text-white/25 mt-1">{m.sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Engagement Timeline Chart */}
                  {summary.timeline?.length > 0 && (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-5">Engagement Timeline</h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={summary.timeline}>
                          <defs>
                            <linearGradient id="tChat" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="tBoard" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" vertical={false} />
                          <XAxis dataKey="minute" tick={{ fontSize:10, fill:"#ffffff30" }} label={{ value:"min", position:"insideBottomRight", fill:"#ffffff20", fontSize:9 }} />
                          <YAxis hide />
                          <Tooltip contentStyle={{ background:"#0f172a", border:"none", borderRadius:12 }} itemStyle={{ fontSize:11 }} />
                          <Area type="monotone" dataKey="chat"  stackId="1" stroke="#a78bfa" fill="url(#tChat)"  strokeWidth={2} name="Chat" />
                          <Area type="monotone" dataKey="board" stackId="1" stroke="#34d399" fill="url(#tBoard)" strokeWidth={2} name="Board" />
                          <Area type="monotone" dataKey="active" stroke="#3b82f6" fill="transparent" strokeWidth={2} name="Active Users" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Interaction stats bar */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label:"Chat Messages", value: summary.messages || 0, icon:"💬", color:"bg-purple-500/20 border-purple-500/20" },
                      { label:"Poll Responses", value: summary.polls   || 0, icon:"📊", color:"bg-yellow-500/20 border-yellow-500/20" },
                      { label:"Board Actions",  value: summary.board   || 0, icon:"🎨", color:"bg-emerald-500/20 border-emerald-500/20" },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl border ${s.color} p-4 flex items-center gap-3`}>
                        <span className="text-2xl">{s.icon}</span>
                        <div>
                          <div className="text-xl font-black">{s.value}</div>
                          <div className="text-[9px] font-bold text-white/30 uppercase tracking-wider">{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right col */}
                <div className="space-y-5">
                  {/* Session metadata */}
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-4">Session Info</h3>
                    {[
                      { k:"Course",    v: summary.course },
                      { k:"Instructor",v: summary.instructor },
                      { k:"Start",     v: fmt(summary.startedAt) },
                      { k:"End",       v: fmt(summary.endedAt) },
                      { k:"Duration",  v: summary.durationSeconds ? `${Math.round(summary.durationSeconds/60)} min` : "—" },
                      { k:"Enrolled",  v: summary.expectedStudents ?? "—" },
                      { k:"Attended",  v: summary.totalAttended ?? "—" },
                    ].map(r => (
                      <div key={r.k} className="flex justify-between text-xs">
                        <span className="text-white/30 font-medium">{r.k}</span>
                        <span className="font-bold text-white/80 text-right max-w-[55%] truncate">{r.v || "—"}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs pt-2 border-t border-white/5">
                      <span className="text-white/30">Ended by</span>
                      <span className={`font-black uppercase tracking-tighter text-[10px] ${summary.endedReason === "completed" || summary.endedReason === "manual" ? "text-emerald-400" : "text-pink-400"}`}>
                        {summary.endedReason || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="rounded-2xl border border-white/8 bg-gradient-to-b from-indigo-950/30 to-transparent p-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-4">AI Insights</h3>
                    {summary.insights?.length > 0 ? (
                      <div className="space-y-3">
                        {summary.insights.map((ins, i) => (
                          <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5">
                            <span className="text-lg shrink-0">{insightIcon(ins.level)}</span>
                            <p className="text-xs leading-relaxed text-white/70">{ins.msg}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-white/25 italic">No critical anomalies detected.</p>
                    )}
                  </div>

                  {/* Top participants */}
                  {summary.topParticipants?.length > 0 && (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400/70 mb-4">Top Participants</h3>
                      <div className="space-y-2">
                        {summary.topParticipants.slice(0,5).map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] transition-all">
                            <div className="flex items-center gap-3">
                              <span className="text-base w-6 text-center">{trophy(i)}</span>
                              <div>
                                <p className="text-xs font-bold text-white/90">{p.name}</p>
                                <p className="text-[9px] text-white/30">{p.activeMinutes}m active</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black text-emerald-400">{p.engagementScore ?? 0}</p>
                              <p className="text-[8px] text-white/25 uppercase tracking-tighter">pts</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            ) : activeTab === "students" ? (
              /* ── Students Tab ── */
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden mb-10">
                <div className="grid grid-cols-6 bg-white/5 px-6 py-3 text-[9px] font-black uppercase tracking-widest text-white/30 border-b border-white/8">
                  <span>Student</span>
                  <span className="text-center">Active Time</span>
                  <span className="text-center">Engagement</span>
                  <span className="text-center">Breakdown</span>
                  <span className="text-center">Rejoins</span>
                  <span className="text-center">Status</span>
                </div>
                {students.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-white/20 text-xs font-bold uppercase tracking-widest">No attendance records found</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {students.map((s, i) => (
                      <div key={s.userId || i} className="grid grid-cols-6 items-center px-6 py-4 hover:bg-white/[0.04] transition-all group">
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400">
                             {s.name.charAt(0)}
                           </div>
                           <div className="truncate">
                             <p className="text-xs font-bold text-white/90 truncate">{s.name}</p>
                             <p className="text-[9px] text-white/30 truncate">{s.email}</p>
                           </div>
                        </div>
                        <p className="text-center text-xs font-mono text-white/70">{s.activeMinutes}m</p>
                        <div className="flex flex-col items-center gap-1.5">
                           <p className="text-sm font-black text-white/80">{s.engagementScore ?? 0}</p>
                           <div className="h-1 w-20 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${Math.min(s.engagementScore, 100)}%` }} />
                           </div>
                        </div>
                        <div className="flex justify-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                           {[
                             { icon: "💬", val: s.breakdown?.chat  || 0 },
                             { icon: "🎨", val: s.breakdown?.board || 0 },
                             { icon: "📊", val: s.breakdown?.polls || 0 },
                             { icon: "✋", val: s.breakdown?.hands || 0 },
                           ].map((item, idx) => (
                             <div key={idx} className="flex flex-col items-center">
                               <span className="text-[9px]">{item.icon}</span>
                               <span className="text-[8px] font-black text-white/60">{item.val}</span>
                             </div>
                           ))}
                        </div>
                        <p className="text-center text-xs text-white/40">
                          {s.rejoinCount > 3 ? <span className="text-orange-400">{s.rejoinCount} ⚠️</span> : s.rejoinCount}
                        </p>
                        <div className="flex justify-center">
                          <span className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${statusColor(s.status)}`}>
                            {s.status || "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── Polls Tab ── */
              <div className="max-w-6xl mx-auto space-y-6 pb-20">
                {loadingPolls ? (
                  <div className="flex h-64 items-center justify-center gap-3 text-white/30">
                    <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Loading Poll Results…</span>
                  </div>
                ) : polls.length === 0 ? (
                  <div className="flex flex-col h-64 items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10">
                    <div className="text-4xl opacity-10">📊</div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 text-center">No polls were conducted in this session</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {polls.map((p, idx) => (
                      <div key={p.id || idx} className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-6">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Question {idx + 1}</div>
                          <h3 className="text-lg font-bold text-white leading-tight">{p.question}</h3>
                        </div>
                        
                        <div className="space-y-3">
                          {p.options.map(opt => {
                            const votes = p.tally[opt] || 0;
                            const pct = p.totalVotes ? Math.round((votes / p.totalVotes) * 100) : 0;
                            return (
                              <div key={opt} className="space-y-1.5">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span className="text-white/70">{opt}</span>
                                  <span className="text-indigo-400 font-black">{pct}% ({votes})</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-1000" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/30">
                          <span>Total Votes: {p.totalVotes}</span>
                          <span>{new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
