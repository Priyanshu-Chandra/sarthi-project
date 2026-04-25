import { useEffect, useState } from "react";

/**
 * TerminalOutput (Elite V5 Professional)
 * ─────────────────────────────────────────────────────────────────────────────
 * Features:
 * 1. Multi-tab results for Public/Hidden test cases.
 * 2. Privacy protection for hidden test logic.
 * 3. Integrated custom input (stdin) handling.
 * 4. Structured comparison for sample cases.
 */
/* eslint-disable react/prop-types */
const TerminalOutput = ({
  output,
  input,
  setInput,
  isError,
  time,
  memory,
  testResults,
  xpBreakdown = null,
  showInput = true,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    setActiveTab(0);
  }, [testResults]);

  // Determine Overall Status Banner
  const getBannerColor = () => {
    if (isError) return "bg-pink-900/40 border-pink-500/50 text-pink-200";
    if (testResults && testResults.length > 0) {
      const allPassed = testResults.every((t) => t.passed);
      return allPassed 
        ? "bg-caribbeangreen-900/40 border-caribbeangreen-500/50 text-caribbeangreen-200" 
        : "bg-yellow-900/40 border-yellow-500/50 text-yellow-200";
    }
    if (output) return "bg-blue-900/40 border-blue-500/50 text-blue-200";
    return "bg-richblack-800 border-richblack-700 text-richblack-400";
  };

  const currentResult = testResults && testResults[activeTab];
  const caseMemory =
    currentResult?.memory !== null && currentResult?.memory !== undefined && currentResult?.memory !== ""
      ? `${currentResult.memory} KB`
      : (memory || "--");

  return (
    <div className="flex flex-col h-full gap-4 custom-scrollbar">
      
      {/* 1. STATUS HEADER SECTION */}
      {testResults && testResults.length > 0 && (
        <div className={`border rounded-lg p-3 flex justify-between items-center transition-all ${getBannerColor()}`}>
           <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Overall Result</span>
              <span className="text-lg font-bold">
                {testResults.every(t => t.passed) ? "Accepted" : "Wrong Answer"}
              </span>
           </div>
           <div className="text-right">
              <span className="text-2xl font-black opacity-80">
                {testResults.filter(t => t.passed).length}/{testResults.length}
              </span>
              <p className="text-[10px] uppercase font-bold opacity-60">Test Cases Passed</p>
           </div>
        </div>
      )}

      {/* 2. INPUT SECTION */}
      {showInput && (
        <div className="flex flex-col bg-richblack-900 border border-richblack-700 rounded-lg p-4 shadow-lg ring-1 ring-white/5">
          <label htmlFor="custom-input" className="text-xs font-bold uppercase tracking-widest text-richblack-400 mb-2">
            stdin (Custom Input)
          </label>
          <textarea
            id="custom-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-20 bg-richblack-800 text-richblack-5 p-3 rounded-md border border-richblack-700 outline-none focus:ring-1 focus:ring-yellow-50/30 resize-none font-mono text-sm transition-all placeholder:text-richblack-600 shadow-inner"
            placeholder="Enter custom input to override sample test cases..."
          />
        </div>
      )}

      {/* 3. MULTI-TEST RESULTS SECTION (LeetCode Style) */}
      {testResults && testResults.length > 0 && (
        <div className="flex flex-col bg-richblack-900 border border-richblack-700 rounded-lg overflow-hidden shadow-xl">
          {/* Tabs Header */}
          <div className="flex bg-richblack-800 border-b border-richblack-700 overflow-x-auto no-scrollbar">
            {testResults.map((result, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border-b-2 flex items-center gap-2 ${
                  activeTab === idx 
                    ? "bg-richblack-900 text-yellow-50 border-yellow-50" 
                    : "text-richblack-400 border-transparent hover:text-richblack-200"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${result.passed ? "bg-caribbeangreen-500" : "bg-pink-500"}`}></div>
                Case {idx + 1}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {currentResult && (
            <div className="p-4 space-y-4 animate-fadeIn">
              {currentResult.isPublic ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-richblack-400 font-bold uppercase tracking-widest">Input</p>
                    <pre className="bg-richblack-800 p-3 rounded border border-richblack-700 text-xs text-richblack-200 overflow-x-auto">{currentResult.input}</pre>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-caribbeangreen-400 font-bold uppercase tracking-widest">Expected</p>
                    <pre className="bg-richblack-800 p-3 rounded border border-caribbeangreen-900/30 text-xs text-caribbeangreen-200 overflow-x-auto">{currentResult.expected}</pre>
                  </div>
                  <div className="space-y-1.5">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                      currentResult.passed ? "text-caribbeangreen-400" : "text-pink-400"
                    }`}>
                      Your Output
                    </p>
                    {currentResult.error ? (
                      <pre className="p-3 rounded border border-pink-900/40 text-xs text-pink-400 bg-pink-900/10 overflow-x-auto whitespace-pre-wrap font-mono uppercase tracking-tight">
                        {currentResult.error}
                      </pre>
                    ) : (
                      <pre className={`p-3 rounded border text-xs overflow-x-auto ${
                        currentResult.passed
                          ? "bg-caribbeangreen-900/10 border-caribbeangreen-900/30 text-caribbeangreen-200"
                          : "bg-pink-900/10 border-pink-900/30 text-pink-200"
                      }`}>
                        {currentResult.actual || "No Output"}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-richblack-800 flex items-center justify-center text-2xl mb-3 shadow-inner">🔒</div>
                  <p className="text-sm text-richblack-100 font-bold uppercase tracking-widest">Hidden Test Case</p>
                  <p className="text-xs text-richblack-500 mt-1 max-w-[280px]">Hidden test results are protected. Only pass/fail status is available to prevent cheating.</p>
                  <div className={`mt-4 px-3 py-1 rounded-full text-[10px] font-black uppercase ${currentResult.passed ? "bg-caribbeangreen-900/50 text-caribbeangreen-300" : "bg-pink-900/50 text-pink-300"}`}>
                    {currentResult.passed ? "STATUS: PASSED" : "STATUS: FAILED"}
                  </div>
                </div>
              )}
              
              {/* Case-specific metrics */}
              <div className="pt-2 border-t border-richblack-800 flex gap-4">
                 <span className="text-[10px] font-mono text-richblack-400">
                   TIME: <span className="text-caribbeangreen-400">{currentResult.time || "0.00"}s</span>
                 </span>
                 <span className="text-[10px] font-mono text-richblack-400">
                   MEMORY: <span className="text-blue-400">{caseMemory}</span>
                 </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3.5 XP BREAKDOWN "Invisible Math" */}
      {xpBreakdown && testResults && testResults.length > 0 && testResults.every(t => t.passed) && (
        <div className="flex flex-col bg-richblack-900 border border-yellow-500/50 rounded-lg p-4 shadow-[0_0_15px_rgba(255,214,10,0.2)] mt-2 mb-2 animate-fadeIn">
           <h3 className="text-yellow-50 font-black uppercase text-sm mb-3 flex items-center gap-2">
             <span className="text-xl">🌟</span> XP Breakdown
           </h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-richblack-800 rounded-lg p-3 text-center border border-richblack-700">
                <p className="text-[10px] text-richblack-300 font-bold uppercase mb-1">Base XP</p>
                <p className="text-caribbeangreen-200 font-black text-lg">+{xpBreakdown.baseXP}</p>
              </div>
              <div className="bg-richblack-800 rounded-lg p-3 text-center border border-richblack-700">
                <p className="text-[10px] text-richblack-300 font-bold uppercase mb-1">Streak Bonus ({xpBreakdown.multiplier}x)</p>
                <p className="text-blue-200 font-black text-lg">+{xpBreakdown.streakBonus}</p>
              </div>
              <div className="bg-richblack-800 rounded-lg p-3 text-center border border-richblack-700">
                <p className="text-[10px] text-richblack-300 font-bold uppercase mb-1">Daily Bonus</p>
                <p className="text-pink-200 font-black text-lg">+{xpBreakdown.dailyBonus}</p>
              </div>
              <div className="bg-yellow-900/40 rounded-lg p-3 text-center border border-yellow-500/30">
                <p className="text-[10px] text-yellow-200 font-bold uppercase mb-1">Total Earned</p>
                <p className="text-yellow-50 font-black text-xl">+{xpBreakdown.totalXP} XP</p>
              </div>
           </div>
        </div>
      )}

      {/* 4. RAW STDOUT SECTION (Fall-back for failures or custom runs) */}
      {(!testResults || testResults.length === 0 || isError) && (
        <div className="flex-1 flex flex-col bg-richblack-900 border border-richblack-700 rounded-lg overflow-hidden shadow-lg ring-1 ring-white/5 min-h-[160px]">
          <div className="bg-richblack-800 flex justify-between items-center px-4 py-3 border-b border-richblack-700">
            <label className="text-xs font-bold uppercase tracking-widest text-richblack-400">
              Stdout / Error Log
            </label>
            <div className="flex gap-4 items-center">
              {time && <span className="text-[13px] font-mono text-caribbeangreen-400 uppercase font-bold">{time}</span>}
              {memory && (
                <span className="text-[13px] font-mono text-blue-400 border-l border-richblack-600 pl-4 uppercase font-bold">
                  {memory}
                </span>
              )}
            </div>
          </div>
          <div className={`flex-1 p-5 font-mono text-sm whitespace-pre-wrap overflow-y-auto ${isError ? 'text-pink-400 bg-pink-900/5' : 'text-richblack-100'}`}>
            {output ? output : <span className="text-richblack-600 italic text-sm">Output will appear here...</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalOutput;
