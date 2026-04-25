import { useState } from "react";

const getRiskColor = (level) => {
  if (level === "HIGH") return "text-red-400";
  if (level === "SUSPICIOUS") return "text-yellow-400";
  return "text-green-400";
};

const getBadge = (level) => {
  if (level === "HIGH") return "🔴";
  if (level === "SUSPICIOUS") return "🟡";
  return "🟢";
};

const getPrimaryRiskFactor = (bd) => {
  if (bd.cameraDisabled) return "Camera Disabled";
  if (bd.multipleFaces) return "Multiple Faces Detected";
  if (bd.tabSwitch > 10) return "Excessive Tab Switching";
  if (bd.lookingAway > 15) return "Significant Lookaways";
  if (bd.noise) return "Unusual Noise Detected";
  if (bd.tabSwitch > 0) return "Tab Switching";
  if (bd.lookingAway > 0) return "Lookaways Detected";
  return "Nominal Activity";
};

const CheatingTable = ({ data }) => {
  const [filterSuspicious, setFilterSuspicious] = useState(false);
  const [sortBy, setSortBy] = useState("riskScore");

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#1f2937] p-6 rounded-2xl text-center text-gray-100 border border-richblack-700">
        No suspicious activity detected 🎉
      </div>
    );
  }

  // Filter
  let processedData = filterSuspicious ? data.filter(d => d.riskLevel !== "SAFE") : [...data];

  // Sort
  processedData.sort((a, b) => {
    if (sortBy === "riskScore") return b.riskScore - a.riskScore;
    if (sortBy === "score") return (b.score || 0) - (a.score || 0);
    if (sortBy === "tabs") return (b.riskBreakdown?.tabSwitch || 0) - (a.riskBreakdown?.tabSwitch || 0);
    return 0;
  });

  return (
    <div className="bg-[#1f2937] p-4 rounded-2xl shadow-2xl border border-richblack-700 overflow-x-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-white text-xl font-bold text-center pl-2 flex items-center gap-2">
          <span className="text-2xl">🚨</span> Cheating Analysis
        </h2>
        
        <div className="flex items-center gap-4">
          <select 
            className="bg-gray-700 text-gray-300 text-sm border-none rounded-lg focus:ring-caribbeangreen-400 focus:border-caribbeangreen-400 px-3 py-1.5 outline-none cursor-pointer shadow-inner"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="riskScore">Sort by Risk Severity</option>
            <option value="score">Sort by Exam Score</option>
            <option value="tabs">Sort by Tab Switches</option>
          </select>

          <label className="flex items-center text-gray-300 text-sm cursor-pointer hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors">
            <input 
              type="checkbox" 
              className="mr-2 rounded border-gray-600 bg-gray-700 text-caribbeangreen-400 focus:ring-caribbeangreen-400"
              checked={filterSuspicious}
              onChange={() => setFilterSuspicious(!filterSuspicious)}
            />
            Show Suspicious Only
          </label>
        </div>
      </div>

      <table className="w-full text-sm text-left text-white">
        <thead className="text-[10px] uppercase bg-gray-800 text-richblack-300 font-black tracking-widest">
          <tr>
            <th className="px-5 py-4 rounded-tl-xl border-b border-gray-700">Student</th>
            <th className="px-5 py-4 border-b border-gray-700">Score</th>
            <th className="px-5 py-4 border-b border-gray-700">Risk Level</th>
            <th className="px-5 py-4 border-b border-gray-700 min-w-[160px]">Detailed Risk Factor</th>
            <th className="px-5 py-4 border-b border-gray-700">Info</th>
            <th className="px-5 py-4 border-b border-gray-700 text-center">Tab Swaps</th>
            <th className="px-5 py-4 border-b border-gray-700 text-center">Mult-Face</th>
            <th className="px-5 py-4 rounded-tr-xl border-b border-gray-700 text-center">Camera</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-800">
          {processedData.length === 0 ? (
            <tr>
              <td colSpan="8" className="text-center py-10 text-gray-400 font-bold italic">
                No high-risk students found! 🙌
              </td>
            </tr>
          ) : (
            processedData.map((s, i) => {
              const bd = s.riskBreakdown || {};
              const tooltipText = `Tab Switches: ${bd.tabSwitch || 0}\nMultiple Faces: ${bd.multipleFaces ? "Yes" : "No"}\nCamera Off: ${bd.cameraDisabled ? "Yes" : "No"}\nLooking Away: ${bd.lookingAway || 0}\nNoise: ${bd.noise ? "Yes" : "No"}`;
              const pFactor = getPrimaryRiskFactor(bd);

              return (
                <tr key={s.email || i} className={`hover:bg-gray-800/60 transition-colors ${
                  s.riskLevel === "HIGH" ? "bg-red-900/10" : ""
                }`}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-base text-white">{s.student || "Unknown Student"}</p>
                    {s.email && <span className="block text-[11px] text-richblack-400 font-medium">{s.email}</span>}
                  </td>
                  <td className="px-5 py-4 font-black text-white">
                    {s.score ?? "-"} <span className="text-richblack-400 font-normal text-[10px] uppercase">pts</span>
                  </td>
                  <td className={`px-5 py-4 font-black flex items-center gap-2 ${getRiskColor(s.riskLevel)}`}>
                    <span className="text-lg">{getBadge(s.riskLevel)}</span> 
                    <span className="tracking-tight">{s.riskLevel || "N/A"}</span>
                    <span className="text-[10px] opacity-60">({s.riskScore || 0})</span>
                  </td>
                  <td className="px-5 py-4">
                    <p className={`text-[11px] font-black uppercase tracking-tight mb-1 ${
                      s.riskLevel === "HIGH" ? "text-red-400" : s.riskLevel === "SUSPICIOUS" ? "text-yellow-400" : "text-emerald-400"
                    }`}>
                      {pFactor}
                    </p>
                    <div className="w-full bg-gray-700/50 rounded-full h-1.5 shadow-inner">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
                          s.riskLevel === "HIGH" ? "bg-red-500" : 
                          s.riskLevel === "SUSPICIOUS" ? "bg-yellow-500" : "bg-emerald-500"
                        }`} 
                        style={{ width: `${s.riskPercent || 10}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button 
                      className="text-gray-400 hover:text-white transition-colors"
                      title={tooltipText}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-center text-white">{bd.tabSwitch || 0}</td>
                  <td className={`px-5 py-4 font-black text-center ${bd.multipleFaces ? "text-red-400" : "text-white"}`}>
                    {bd.multipleFaces ? "YES" : "NO"}
                  </td>
                  <td className={`px-5 py-4 font-black text-center ${bd.cameraDisabled ? "text-red-400" : "text-emerald-400"}`}>
                    {bd.cameraDisabled ? "OFF" : "ON"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CheatingTable;
