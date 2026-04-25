import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { executeCode, submitCode } from "../../services/operations/codingApi";
import CodeEditor from "./CodeEditor";
import LanguageSelector from "./LanguageSelector";
import TerminalOutput from "./TerminalOutput";
import { Group as PanelGroup, Panel } from "react-resizable-panels";
import ResizeHandle from "../common/ResizeHandle";

/**
 * CodingTestWorkspace
 * ─────────────────────────────────────────────────────────────────────────────
 * Exam-mode coding workspace. Reuses existing CodeEditor / LanguageSelector /
 * TerminalOutput / Judge0 APIs. Wraps them with exam controls.
 */
const MAX_RUNS_PER_PROBLEM = 10;

const DIFF_COLORS = {
  Easy:   "bg-caribbeangreen-900/60 text-caribbeangreen-200 border-caribbeangreen-700",
  Medium: "bg-yellow-900/60 text-yellow-200 border-yellow-700",
  Hard:   "bg-pink-900/60 text-pink-200 border-pink-700",
};

/* eslint-disable react/prop-types */
export default function CodingTestWorkspace({
  questions,
  onSubmit,
  isSubmitting,
  timeLeft,
  formatTime,
  timerColor,
  isLow,
  testId,
  codingSubmissions = [],
}) {
  const { token } = useSelector((state) => state.auth);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [language, setLanguage]     = useState("python");
  const [code, setCode]             = useState("");
  const [output, setOutput]         = useState("");
  const [isError, setIsError]       = useState(false);
  const [isRunning, setIsRunning]   = useState(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [runMetrics, setRunMetrics] = useState({ time: null, memory: null });
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  const [problemStates, setProblemStates] = useState({});
  const [submissionResult, setSubmissionResult] = useState(null); 
  const [failedTest, setFailedTest] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [xpBreakdown, setXpBreakdown] = useState(null);

  useEffect(() => {
    const initialState = {};
    questions.forEach((q) => {
      const id = q.problemId._id;
      // Try to restore status/runCount from the server-side codingSubmissions
      // (passed in from AttemptQuiz on resume). Falls back to defaults for
      // brand-new attempts where no previous execution exists.
      const existing = codingSubmissions.find(
        (s) => s.problemId?.toString() === id.toString()
      );
      initialState[id] = {
        runCount: existing?.runCount ?? 0,
        status:
          existing?.status === "Accepted"
            ? "solved"
            : existing?.status
            ? "attempted"
            : "unattempted",
        code: existing?.code ?? "",
      };
    });
    setProblemStates(initialState);
  }, [questions, codingSubmissions]);

  const currentQ   = questions[currentIdx] ?? null;
  const problem    = currentQ?.problemId   ?? null;
  const problemId  = problem?._id;

  useEffect(() => {
    if (!problemId) return;

    setOutput("");
    setIsError(false);
    setSubmissionResult(null);
    setFailedTest(null);
    setTestResults([]);
    setXpBreakdown(null);
    setRunMetrics({ time: null, memory: null });

    const saved = localStorage.getItem(`exam_${testId}_${problemId}`);
    if (saved) {
      setCode(saved);
    } else if (problemStates[problemId]?.code) {
      setCode(problemStates[problemId].code);
    } else {
      const starter = problem.starterCode?.[language] || "";
      setCode(starter);
    }
  }, [currentIdx, problemId, language]);

  useEffect(() => {
    if (!problemId || !code) return;

    const timeout = setTimeout(() => {
      localStorage.setItem(`exam_${testId}_${problemId}`, code);
      setProblemStates(prev => ({
        ...prev,
        [problemId]: { ...prev[problemId], code: code }
      }));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [code, problemId]);

  const runCount = problemStates[problemId]?.runCount || 0;
  const runsLeft = MAX_RUNS_PER_PROBLEM - runCount;

  const handleRun = async () => {
    if (!code || runsLeft <= 0 || isRunning) return;
    setIsRunning(true);
    setOutput("");
    setIsError(false);
    setSubmissionResult(null);
    setFailedTest(null);
    setTestResults([]);
    setXpBreakdown(null);

    const result = await executeCode({ language, code, input: "", testId, problemId }, token);
    if (result) {
      setRunMetrics({ time: result.executionTime, memory: result.memory });
      setProblemStates((prev) => ({
        ...prev,
        [problemId]: {
          ...prev[problemId],
          runCount: result.runCount !== undefined ? result.runCount : (prev[problemId]?.runCount || 0) + 1,
        },
      }));

      const runtimeErrors = (result.testResults || [])
        .map((test) => test?.error?.trim())
        .filter(Boolean);
      const terminalError = result.compile_output || result.stderr || runtimeErrors[0] || "";

      if (terminalError) {
        setOutput(terminalError);
        setIsError(true);
        setTestResults([]);
      } else {
        setOutput(result.stdout || "");
        setTestResults(result.testResults || []); 
        setIsError(false);
      }
    } else {
      setOutput("Execution failed — check your code.");
      setIsError(true);
    }
    setIsRunning(false);
  };

  const handleCodeSubmit = async () => {
    if (!code || !problem) return;
    setIsSubmittingCode(true);
    setOutput("");
    setIsError(false);
    setTestResults([]);
    setXpBreakdown(null);

    const result = await submitCode({ problemId: problem._id, language, code, testId }, token);
    if (result) {
      setRunMetrics({ time: result.executionTime, memory: result.memory });
      setSubmissionResult(result);
      setFailedTest(result.failedTest);
      setTestResults(result.testResults || []);
      setXpBreakdown(result.xpBreakdown || null);

      const isAccepted = result.status === "Accepted";
      const isSystemError = result.status.includes("Error") || result.status.includes("Compilation");
      if (isAccepted) localStorage.removeItem(`exam_${testId}_${problemId}`);

      setProblemStates((prev) => ({
        ...prev,
        [problemId]: {
          ...prev[problemId],
          status: isAccepted ? "solved" : "attempted",
        },
      }));
      setIsError(isSystemError);

      if (isSystemError && result.failedTest) {
        const errorMsg = result.failedTest.compile_output || result.failedTest.stderr || "";
        setOutput(errorMsg);
        setTestResults([]);
      } else if (isAccepted) {
        setOutput(`All ${result.total || ""} test cases passed!`);
      } else {
        setOutput(`Submission Status: ${result.status}`);
      }
    } else {
      setOutput("Submission failed.");
      setIsError(true);
    }
    setIsSubmittingCode(false);
  };

  const handleFinalSubmit = () => {
     questions.forEach(q => localStorage.removeItem(`exam_${testId}_${q.problemId._id}`));
     setShowConfirm(false);
     onSubmit();
  };

  return (
    <div className="h-[calc(100vh-8rem)] w-full rounded-xl border border-richblack-700 overflow-hidden bg-richblack-900 text-richblack-5 flex flex-col select-none shadow-lg">

      {/* ── Top Bar ───────────────────────────────────────────────── */}
      <div className="shrink-0 bg-richblack-800 shadow-md border-b border-richblack-700">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLeftPanelOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded border border-richblack-700 bg-richblack-900/50 text-richblack-200 transition hover:bg-richblack-700"
              aria-label={isLeftPanelOpen ? "Collapse test panel" : "Expand test panel"}
              title={isLeftPanelOpen ? "Collapse test panel" : "Expand test panel"}
            >
              {isLeftPanelOpen ? "<<" : ">"}
            </button>
            <div className="flex items-center gap-2 p-1 px-2 bg-richblack-900/50 rounded-lg border border-richblack-700 font-mono text-[10px] font-bold text-richblack-400">
               Coding test
            </div>
          </div>

          <div className={`flex min-w-[120px] flex-col items-center font-mono font-bold ${timerColor} ${isLow ? "animate-pulse" : ""}`}>
            <span className="text-xl tracking-widest md:text-2xl">{formatTime(timeLeft)}</span>
            <span className="text-[10px] font-medium opacity-70 mt-0.5">
              {isLow ? "⚠ Time almost up" : "Time remaining"}
            </span>
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            disabled={isSubmitting}
            className="bg-yellow-50 text-richblack-900 font-semibold px-4 py-2 text-sm rounded-lg hover:bg-yellow-100 disabled:opacity-50 transition-all duration-200 md:px-5"
          >
            {isSubmitting ? "Submitting…" : "Submit Test"}
          </button>
        </div>

        <div className="h-1 bg-richblack-700 w-full">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: questions.length ? `${(Object.values(problemStates).filter(s => s.status === 'solved').length / questions.length) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
        
        {isLeftPanelOpen ? (
          <>
            {/* Navigation Sidebar */}
            <Panel defaultSize={20} minSize={15} className="bg-richblack-800 border-r border-richblack-700 flex flex-col p-4 overflow-y-auto hidden md:flex">
              <p className="text-richblack-400 text-[10px] font-bold tracking-widest mb-4">Questions</p>
              <div className="grid grid-cols-4 gap-2 mb-8">
                {questions.map((q, index) => {
                  const pId = q.problemId._id;
                  const state = problemStates[pId];
                  return (
                    <button
                      key={pId}
                      onClick={() => setCurrentIdx(index)}
                      className={`aspect-square flex items-center justify-center rounded-lg font-bold text-sm transition-all
                        ${index === currentIdx ? "bg-white text-black" : state?.status === 'solved' ? "bg-emerald-500/80 text-white" : "bg-richblack-700 hover:bg-richblack-600"}`}
                    >
                      {index+1}
                    </button>
                  );
                })}
              </div>

              <div className="bg-richblack-900 border border-richblack-700 p-4 rounded-xl space-y-4">
                <p className="text-[10px] text-richblack-400 font-bold">Current status</p>
                <div className="flex flex-col gap-4">
                   <div>
                      <p className="text-[9px] text-richblack-500 mb-1">Execution</p>
                      <p className="text-xs font-mono">{runCount} / 10 runs</p>
                      <div className="w-full h-1 bg-richblack-700 rounded-full mt-1 overflow-hidden">
                         <div className="h-full bg-blue-500" style={{ width: `${(runCount/10)*100}%` }} />
                      </div>
                   </div>
                   <div>
                      <p className="text-[9px] text-richblack-500 mb-1">Result</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${problemStates[problemId]?.status === 'solved' ? 'text-emerald-300 border-emerald-900 bg-emerald-900/20' : 'text-richblack-400 border-richblack-800 bg-richblack-800/20'}`}>
                         {problemStates[problemId]?.status ? problemStates[problemId].status.charAt(0).toUpperCase() + problemStates[problemId].status.slice(1) : 'None'}
                      </span>
                   </div>
                </div>
              </div>
            </Panel>

            <ResizeHandle direction="horizontal" />
          </>
        ) : (
          <div className="hidden shrink-0 items-start p-2 md:flex">
            <button
              type="button"
              onClick={() => setIsLeftPanelOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded border border-richblack-700 bg-richblack-800 text-richblack-200 transition hover:bg-richblack-700"
              aria-label="Expand test panel"
              title="Expand test panel"
            >
              {">"}
            </button>
          </div>
        )}

        {/* Main Coding Area */}
        <Panel defaultSize={80} minSize={40}>
          <PanelGroup orientation="horizontal">
            
            {/* Description Pane */}
            <Panel defaultSize={35} minSize={20} className="bg-richblack-800 p-5 overflow-y-auto flex flex-col">
              {!problem ? <p className="text-richblack-400">Loading...</p> : (
                <>
                  <h3 className="text-xl font-bold mb-2 break-words">{problem.title}</h3>
                  <div className="flex gap-2 mb-5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${DIFF_COLORS[problem.difficulty]}`}>{problem.difficulty}</span>
                    <span className="bg-richblack-900 border border-richblack-700 px-2.5 py-0.5 rounded text-[10px] text-richblack-400 font-medium">{problem.topic}</span>
                  </div>
                  <div className="prose prose-sm prose-invert text-richblack-200">
                    <p className="whitespace-pre-wrap leading-relaxed">{problem.description}</p>
                  </div>
                  {problem.exampleInput && (
                    <div className="mt-8">
                      <p className="text-[10px] text-richblack-500 font-bold mb-2 tracking-widest">Example</p>
                      <pre className="bg-richblack-900 p-4 rounded-xl border border-richblack-700 text-xs font-mono overflow-x-auto text-richblack-100">{problem.exampleInput}</pre>
                    </div>
                  )}
                </>
              )}
            </Panel>

            <ResizeHandle direction="horizontal" />

            {/* Editor + Terminal */}
            <Panel defaultSize={65} minSize={30}>
              <PanelGroup orientation="vertical">
                 <Panel defaultSize={65} minSize={20} className="flex flex-col bg-richblack-900">
                    <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-richblack-800 border-b border-richblack-700">
                       <LanguageSelector language={language} setLanguage={setLanguage} setCode={setCode} disabled={problemStates[problemId]?.status === 'solved'} />
                       <div className="flex gap-2">
                          <button onClick={handleRun} disabled={isRunning || runCount >= 10 || problemStates[problemId]?.status === 'solved'} className="px-4 py-1.5 bg-richblack-700 text-xs rounded hover:bg-richblack-600">Run</button>
                          <button onClick={handleCodeSubmit} disabled={isSubmittingCode || problemStates[problemId]?.status === 'solved'} className="px-4 py-1.5 bg-yellow-50 text-richblack-900 text-xs font-bold rounded">Submit</button>
                       </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                       <CodeEditor language={language} code={code} setCode={setCode} readOnly={problemStates[problemId]?.status === 'solved'} />
                       {submissionResult && (
                          <div className="absolute left-3 right-3 top-3 z-50 animate-slideInRight rounded-xl border border-richblack-700 bg-richblack-800 p-4 shadow-2xl md:left-auto md:right-4 md:top-4 md:max-w-sm">
                            <h4 className="text-[10px] font-bold text-richblack-400 tracking-widest mb-3">Judge result</h4>
                            <div className="flex justify-between text-xs mb-1">
                               <span className="text-richblack-400">Verdict</span>
                               <span className={`font-bold ${submissionResult.status === "Accepted" ? "text-emerald-400" : "text-red-400"}`}>{submissionResult.status}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                               <span className="text-richblack-400">Passed</span>
                               <span className="font-mono font-bold">{submissionResult.passedTestCases} / {submissionResult.total}</span>
                            </div>
                          </div>
                       )}
                    </div>
                 </Panel>
                 <ResizeHandle direction="vertical" />
                 <Panel defaultSize={35} minSize={10} className="bg-richblack-900 p-2 overflow-hidden flex flex-col">
                    <TerminalOutput output={output} input="" setInput={() => {}} isError={isError} time={runMetrics.time} memory={runMetrics.memory} failedTest={failedTest} testResults={!isError ? testResults : []} xpBreakdown={xpBreakdown} showInput={false} />
                 </Panel>
              </PanelGroup>
            </Panel>

          </PanelGroup>
        </Panel>
      </PanelGroup>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-richblack-800 p-8 rounded-2xl border border-richblack-700 max-w-md w-full mx-4 shadow-2xl text-center">
            <h2 className="text-2xl font-bold mb-4">Finish Test?</h2>
            <p className="text-richblack-300 text-sm mb-8">Are you sure you want to end the test? You won&apos;t be able to return.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 bg-richblack-700 rounded-xl font-bold">Cancel</button>
              <button onClick={handleFinalSubmit} className="flex-1 py-3 bg-yellow-50 text-richblack-900 rounded-xl font-bold">End Test</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
