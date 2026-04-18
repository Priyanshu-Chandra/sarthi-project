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

const CheatingTable = ({ data }) => {
  const [filterSuspicious, setFilterSuspicious] = useState(false);
  const [sortBy, setSortBy] = useState("riskScore");

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#1f2937] p-6 rounded-2xl text-center text-gray-400">
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
    <div className="bg-[#1f2937] p-4 rounded-2xl shadow-md overflow-x-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-white text-lg text-center pl-2">
          🚨 Cheating Analysis
        </h2>
        
        <div className="flex items-center gap-4">
          <select 
            className="bg-gray-700 text-gray-300 text-sm border-none rounded-lg focus:ring-caribbeangreen-400 focus:border-caribbeangreen-400 px-3 py-1.5 outline-none cursor-pointer"
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

      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs uppercase bg-gray-700 text-gray-300">
          <tr>
            <th className="px-4 py-3 rounded-tl-lg">Student</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Risk Level</th>
            <th className="px-4 py-3 min-w-[120px]">Risk Factor</th>
            <th className="px-4 py-3">Info</th>
            <th className="px-4 py-3">Tab Swaps</th>
            <th className="px-4 py-3">Mult-Face</th>
            <th className="px-4 py-3 rounded-tr-lg">Camera off</th>
          </tr>
        </thead>

        <tbody>
          {processedData.length === 0 ? (
            <tr>
              <td colSpan="8" className="text-center py-6 text-gray-400 font-medium">
                No high-risk students found! 🙌
              </td>
            </tr>
          ) : (
            processedData.map((s, i) => {
              const bd = s.riskBreakdown || {};
              const tooltipText = `Tab Switches: ${bd.tabSwitch || 0}\nMultiple Faces: ${bd.multipleFaces ? "Yes" : "No"}\nCamera Off: ${bd.cameraDisabled ? "Yes" : "No"}\nLooking Away: ${bd.lookingAway || 0}\nNoise: ${bd.noise ? "Yes" : "No"}`;

              return (
                <tr key={s.email || i} className={`border-b border-gray-700 hover:bg-gray-800 transition-colors ${
                  s.riskLevel === "HIGH" ? "bg-red-900/10" : ""
                }`}>
                  <td className="px-4 py-3 font-medium text-white">
                    {s.student || "Unknown Student"}
                    {s.email && <span className="block text-xs text-gray-500 font-normal">{s.email}</span>}
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {s.score ?? "-"} <span className="text-gray-500 font-normal text-xs">pts</span>
                  </td>
                  <td className={`px-4 py-3 font-bold flex items-center gap-2 ${getRiskColor(s.riskLevel)}`}>
                    {getBadge(s.riskLevel)} {s.riskLevel || "N/A"} ({s.riskScore || 0})
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-1000 ${
                          s.riskLevel === "HIGH" ? "bg-red-500" : 
                          s.riskLevel === "SUSPICIOUS" ? "bg-yellow-500" : "bg-green-500"
                        }`} 
                        style={{ width: `${s.riskPercent || 0}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      className="text-gray-400 hover:text-white"
                      title={tooltipText}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono">{bd.tabSwitch || 0}</td>
                  <td className={`px-4 py-3 font-bold ${bd.multipleFaces ? "text-red-400" : "text-gray-500"}`}>
                    {bd.multipleFaces ? "Yes" : "No"}
                  </td>
                  <td className={`px-4 py-3 font-bold ${bd.cameraDisabled ? "text-red-400" : "text-gray-500"}`}>
                    {bd.cameraDisabled ? "Off" : "On"}
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
