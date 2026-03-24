import { useState, useEffect } from "react";
import { useSelector } from "react-redux";

const BASE_URL = import.meta.env.VITE_APP_BASE_URL;
const LEVELS = ["beginner", "intermediate", "advanced"];

// ── JSON Week card renderer ──────────────────────────────────────────────────
function PlanDisplay({ plan, planId, token, setPlan, onRegenerate }) {
  if (!plan || !plan.weeks || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    return (
      <div className="bg-richblack-800 border-l-4 border-pink-500 rounded-r-xl p-6 text-richblack-200">
        <h3 className="text-lg font-bold text-pink-300 mb-2">Plan Generation Failed</h3>
        <p>No valid study plan data was returned from the AI. The AI might have failed to format your roadmap. Please try generating it again.</p>
        <button
          onClick={onRegenerate}
          className="mt-4 rounded-lg bg-pink-500 hover:bg-pink-600 focus:outline-none transition px-6 py-2 text-sm font-semibold text-white"
        >
          Regenerate Roadmap
        </button>
        <pre className="mt-4 text-[10px] overflow-auto text-richblack-400 max-h-40">{JSON.stringify(plan, null, 2)}</pre>
      </div>
    );
  }

  async function handleToggleProgress(weekNum, dayNum, currentCompleted) {
    if (!planId) return;
    try {
      const res = await fetch(`${BASE_URL}/api/chat/study-plan/${planId}/progress`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          progress: { week: weekNum, day: dayNum, completed: !currentCompleted },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan(data.plan);
      }
    } catch (err) {
      console.error("Error toggling progress:", err);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Strategy ── */}
      {plan.strategy && (
        <div className="bg-richblack-800 border-l-4 border-yellow-50 rounded-r-xl px-6 py-5 mb-2 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-richblack-300 mb-2 flex items-center gap-2">
            <span>💡</span> Strategy & Approach
          </h3>
          <p className="text-sm text-richblack-100 leading-relaxed">
            {plan.strategy}
          </p>
        </div>
      )}

      {plan.weeks.map((weekObj, idx) => (
        <div key={idx} className="bg-richblack-800 border border-richblack-700 rounded-xl px-6 py-5">
          <h2 className="text-lg font-bold text-yellow-50 mb-4 border-b border-richblack-700 pb-2">
            Week {weekObj.week}
          </h2>

          <div className="flex flex-col gap-4">
            {/* ── Daily Breakdown (New Format) ── */}
            {weekObj.days && weekObj.days.length > 0 && (
              <div className="grid grid-cols-1 gap-3">
                {weekObj.days.map((dayObj, i) => (
                  <div 
                    key={i} 
                    className={`border border-richblack-700 rounded-lg p-4 transition ${
                      dayObj.completed ? "bg-richblack-800 border-caribbeangreen-400" : "bg-richblack-900 hover:border-richblack-500"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={dayObj.completed || false}
                          onChange={() => handleToggleProgress(weekObj.week, dayObj.day, dayObj.completed)}
                          className="h-5 w-5 rounded cursor-pointer accent-caribbeangreen-300"
                        />
                        <h3 className={`text-sm font-bold ${dayObj.completed ? "text-caribbeangreen-300 line-through" : "text-yellow-50"}`}>
                          Day {dayObj.day}
                        </h3>
                      </div>
                      {dayObj.estimatedTime && (
                        <span className="text-xs bg-richblack-800 text-richblack-200 px-2.5 py-1 rounded-full border border-richblack-600 font-medium shrink-0">
                          ⏱ {dayObj.estimatedTime}
                        </span>
                      )}
                    </div>
                    
                    <div className={`flex flex-col gap-2.5 ${dayObj.completed ? "opacity-60" : ""}`}>
                      {dayObj.topic && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-richblack-400 sm:w-16 shrink-0 sm:mt-0.5">Topic</span>
                          <span className="text-sm text-richblack-5 font-medium">{dayObj.topic}</span>
                        </div>
                      )}
                      {dayObj.practice && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-richblack-400 sm:w-16 shrink-0 sm:mt-0.5">Practice</span>
                          <span className="text-sm text-richblack-200 leading-relaxed">{dayObj.practice}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Weekly Revision ── */}
            {weekObj.revision && (
              <div className="mt-2 border-l-2 border-yellow-50 pl-4 py-1">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-richblack-400 mb-1">
                  Weekly Revision
                </h3>
                <p className="text-sm text-richblack-100 leading-relaxed">
                  {weekObj.revision}
                </p>
              </div>
            )}

            {/* ── Weekly Notes ── */}
            {weekObj.notes && (
              <div className="mt-1 bg-richblack-700/30 rounded-lg p-3 border border-richblack-700">
                <p className="text-xs text-richblack-200">
                  <span className="font-semibold text-richblack-50">Note:</span> {weekObj.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* ── Recommended Courses ── */}
      {plan.recommendedCourses && plan.recommendedCourses.length > 0 && (
        <div className="bg-richblack-800 border border-richblack-700 rounded-xl px-6 py-5 mt-4">
          <h2 className="text-lg font-bold text-yellow-50 mb-3 border-b border-richblack-700 pb-2">
            Recommended Courses for You
          </h2>
          <div className="flex flex-col gap-3">
            {plan.recommendedCourses.map((course, idx) => (
              <div key={idx} className="bg-richblack-900 border border-richblack-700 rounded-lg p-4">
                <h3 className="text-sm font-bold text-caribbeangreen-100">{course.name}</h3>
                {course.reason && (
                  <p className="text-xs text-richblack-200 mt-1.5 leading-relaxed">
                    {course.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StudyPlanner() {
  const { token } = useSelector((state) => state.auth);

  const [myPlans, setMyPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  
  const [form, setForm] = useState({
    goal: "",
    duration: "",
    dailyHours: "",
    level: "beginner",
    weaknesses: "",
  });
  
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [adaptMessage, setAdaptMessage] = useState("");
  const [adapting, setAdapting] = useState(false);

  // Fetch past roadmaps on mount
  useEffect(() => {
    async function fetchMyPlans() {
      try {
        const res = await fetch(`${BASE_URL}/api/chat/study-plan/my-plans`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.plans) {
          setMyPlans(data.plans);
        }
      } catch (err) {
        console.error("Failed to load past plans:", err);
      }
    }
    if (token) fetchMyPlans();
  }, [token]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.goal.trim()) { setError("Goal is required."); return; }
    setError(""); setPlan(null); setActivePlanId(null); setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/chat/study-plan`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to generate plan");
      
      setPlan(data.plan);
      setActivePlanId(data.planId);
      
      // Add to myPlans list automatically
      if (data.planId) {
        setMyPlans((prev) => [{ _id: data.planId, goal: form.goal, duration: form.duration, level: form.level, plan: data.plan }, ...prev]);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdapt(e) {
    e.preventDefault();
    if (!adaptMessage.trim() || !activePlanId) return;
    
    setAdapting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/chat/study-plan/${activePlanId}/adapt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: adaptMessage })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      
      setPlan(data.plan);
      setAdaptMessage("");
    } catch (err) {
      console.error("Adapt error:", err);
      alert("Failed to adapt plan");
    } finally {
      setAdapting(false);
    }
  }

  function loadPlan(p) {
    setPlan(p.plan);
    setActivePlanId(p._id);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  async function handleDelete(e, planId) {
    e.stopPropagation(); // Prevent the card's onClick (loadPlan) from firing
    if (!window.confirm("Are you sure you want to permanently delete this roadmap?")) return;
    try {
      const res = await fetch(`${BASE_URL}/api/chat/study-plan/${planId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      // Remove from list
      setMyPlans((prev) => prev.filter((p) => p._id !== planId));
      // Clear active view if deleted plan was loaded
      if (activePlanId === planId) {
        setPlan(null);
        setActivePlanId(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete the roadmap. Please try again.");
    }
  }

  const inputCls =
    "rounded-lg bg-richblack-700 border border-richblack-600 px-4 py-2.5 text-sm text-richblack-5 placeholder-richblack-400 outline-none focus:border-yellow-50 transition w-full";

  return (
    <div>
      {/* ── My Past Roadmaps ── */}
      {myPlans.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-richblack-5 mb-4">Your Saved Roadmaps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myPlans.map((p) => (
              <div 
                key={p._id} 
                className={`relative border rounded-xl p-5 cursor-pointer transition ${
                  activePlanId === p._id ? "bg-richblack-800 border-yellow-50 ring-1 ring-yellow-50 shadow-md shadow-yellow-50/20" : "bg-richblack-800 border-richblack-700 hover:border-richblack-500"
                }`}
                onClick={() => loadPlan(p)}
              >
                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, p._id)}
                  title="Delete this roadmap"
                  className="absolute top-3 right-3 text-richblack-400 hover:text-pink-400 transition p-1 rounded-lg hover:bg-richblack-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                <div className="flex justify-between items-start mb-2 pr-6">
                  <h3 className="font-semibold text-richblack-5 line-clamp-2">{p.goal}</h3>
                </div>
                <div className="flex gap-2 text-xs text-richblack-300">
                  <span className="bg-richblack-700 px-2 py-1 rounded">{p.duration || 'Custom'}</span>
                  <span className="bg-richblack-700 px-2 py-1 rounded capitalize">{p.level || 'Beginner'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-7">
        <h1 className="text-3xl font-bold text-richblack-5 font-boogaloo">
          Generate New Roadmap
        </h1>
        <p className="mt-1 text-sm text-richblack-300">
          Describe your goal and get a week-by-week personalised roadmap.
        </p>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="bg-richblack-800 border border-richblack-700 rounded-xl p-6 flex flex-col gap-4 max-w-2xl"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-richblack-300">
            Goal <span className="text-pink-300 normal-case">*</span>
          </label>
          <input name="goal" value={form.goal} onChange={handleChange}
            placeholder="e.g. Master React and Node.js" className={inputCls} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-richblack-300">
              Duration
            </label>
            <input name="duration" value={form.duration} onChange={handleChange}
              placeholder="e.g. 4 weeks" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-richblack-300">
              Daily Hours
            </label>
            <input name="dailyHours" value={form.dailyHours} onChange={handleChange}
              type="number" min="0.5" max="24" step="0.5"
              placeholder="e.g. 2" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-richblack-300">
              Level
            </label>
            <select name="level" value={form.level} onChange={handleChange}
              className={`${inputCls} cursor-pointer`}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-richblack-300">
              Weaknesses / Focus Areas <span className="text-[10px] text-richblack-400 capitalize normal-case tracking-normal">(Optional)</span>
            </label>
            <input name="weaknesses" value={form.weaknesses} onChange={handleChange}
              placeholder="e.g. state management" className={inputCls} />
          </div>
        </div>

        {error && (
          <p className="text-sm text-pink-300 bg-pink-900/20 border border-pink-700 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}
          className="mt-1 self-start rounded-lg bg-yellow-50 px-6 py-2.5 text-sm font-semibold text-richblack-900 hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed transition">
          {loading ? "Generating…" : "Generate Study Plan"}
        </button>
      </form>

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="mt-8 max-w-2xl flex items-center gap-3 text-richblack-300 text-sm">
          <span className="h-4 w-4 rounded-full border-2 border-yellow-50 border-t-transparent animate-spin" />
          Building your roadmap — this takes a few seconds…
        </div>
      )}

      {/* ── Result ───────────────────────────────────────────────────────── */}
      {plan && !loading && (
        <div className="mt-12 max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-richblack-5">
              Your Study Roadmap
            </h2>
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(plan, null, 2))}
              className="text-xs text-yellow-50 border border-richblack-600 rounded-lg px-3 py-1.5 hover:bg-richblack-700 transition">
              Copy JSON
            </button>
          </div>

          <PlanDisplay plan={plan} planId={activePlanId} token={token} setPlan={setPlan} onRegenerate={handleSubmit} />
          
          {/* ── Adapt Plan ── */}
          <div className="mt-8 bg-richblack-800 border-l-4 border-caribbeangreen-300 rounded-r-xl px-6 py-5">
            <h3 className="text-md font-bold text-richblack-5 mb-2">Need to adjust your plan?</h3>
            <p className="text-sm text-richblack-200 mb-4">
              Fell behind or want to shift focus? Tell the AI to reorganize your active plan below. Completed days will remain untouched!
            </p>
            <form onSubmit={handleAdapt} className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                value={adaptMessage}
                onChange={(e) => setAdaptMessage(e.target.value)}
                placeholder="e.g. I got sick on Day 2, reschedule everything by 2 days" 
                className={inputCls}
                required
              />
              <button 
                type="submit" 
                disabled={adapting}
                className="shrink-0 rounded-lg bg-caribbeangreen-300 px-6 py-2.5 text-sm font-semibold text-richblack-900 hover:bg-caribbeangreen-200 disabled:opacity-50 transition"
              >
                {adapting ? "Adapting..." : "Update Plan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
