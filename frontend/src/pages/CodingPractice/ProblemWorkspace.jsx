import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { getProblemDetails } from "../../services/operations/problemApi";
import {
  executeCode,
  submitCode,
  getAICodeHelp,
  getPracticePath,
} from "../../services/operations/codingApi";

import { Group as PanelGroup, Panel } from "react-resizable-panels";
import ResizeHandle from "../../components/common/ResizeHandle";

import LanguageSelector from "../../components/Coding/LanguageSelector";
import CodeEditor from "../../components/Coding/CodeEditor";
import TerminalOutput from "../../components/Coding/TerminalOutput";
import IconBtn from "../../components/common/IconBtn";
import AIAssistantPanel from "../../components/Coding/AIAssistantPanel";

function ProblemWorkspace() {
  const { id } = useParams();
  const { token } = useSelector((state) => state.auth);

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);

  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [isError, setIsError] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runMetrics, setRunMetrics] = useState({ time: null, memory: null });
  const [testResults, setTestResults] = useState([]);
  const [xpBreakdown, setXpBreakdown] = useState(null);

  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [isAILoading, setIsAILoading] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  const [failedTest, setFailedTest] = useState(null);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [nextRecommendation, setNextRecommendation] = useState(null);
  const [isNextRecommendationLoading, setIsNextRecommendationLoading] = useState(false);

  const resetSubmissionUi = () => {
    setSubmissionStatus("");
    setNextRecommendation(null);
    setIsNextRecommendationLoading(false);
  };

  const broadcastPracticePathUpdate = () => {
    const refreshAt = Date.now().toString();
    window.dispatchEvent(
      new CustomEvent("coding:practice-path-updated", { detail: { refreshAt } })
    );
    window.localStorage.setItem("coding:practice-path-updated-at", refreshAt);
  };

  const getResultTotal = (result) =>
    result?.total || result?.totalTestCases || result?.testResults?.length || "";

  useEffect(() => {
    const fetchProblem = async () => {
      setLoading(true);
      const res = await getProblemDetails(id, token);
      if (res) {
        setProblem(res);
        setFailedTest(null);
        setTestResults([]);
        setOutput("");
        resetSubmissionUi();
        setRunMetrics({ time: null, memory: null });
        const initialStarter =
          res.boilerplate?.[language]?.starterCode || res.starterCode?.[language] || "";
        setCode(initialStarter);
      }
      setLoading(false);
    };
    fetchProblem();
  }, [id, token]);

  useEffect(() => {
    if (problem) {
      const starter =
        problem.boilerplate?.[language]?.starterCode || problem.starterCode?.[language] || "";
      setCode(starter);
    }
  }, [language, problem]);

  const handleRunCode = async () => {
    if (!code) return;
    setIsExecuting(true);
    setOutput("");
    setIsError(false);
    setFailedTest(null);
    setTestResults([]);
    setXpBreakdown(null);
    resetSubmissionUi();

    const data = { language, code, input: "", problemId: problem._id };
    const result = await executeCode(data, token);

    if (result) {
      setRunMetrics({ time: result.executionTime, memory: result.memory });
      const runtimeErrors = (result.testResults || [])
        .map((test) => test?.error?.trim())
        .filter(Boolean);
      const terminalError = result.compile_output || result.stderr || runtimeErrors[0] || "";

      if (terminalError) {
        setOutput(terminalError);
        setIsError(true);
        setTestResults([]);
        setAiPanelOpen(true);
      } else {
        setOutput(result.stdout || "");
        setTestResults(result.testResults || []);
        setIsError(false);
      }
    } else {
      setOutput("An error occurred during execution.");
      setIsError(true);
    }
    setIsExecuting(false);
  };

  const handleSubmitCode = async () => {
    if (!code || !problem) return;
    setIsSubmitting(true);
    setIsError(false);
    setFailedTest(null);
    setTestResults([]);
    setXpBreakdown(null);

    const data = { problemId: problem._id, language, code };
    const result = await submitCode(data, token);

    if (result) {
      setRunMetrics({ time: result.executionTime, memory: result.memory });
      setFailedTest(result.failedTest);
      setTestResults(result.testResults || []);
      setXpBreakdown(result.xpBreakdown || null);

      const status = result.status || "";
      const isAccepted = status === "Accepted";
      const isSystemError = status.includes("Error") || status.includes("Compilation");
      setSubmissionStatus(status);
      setIsError(isSystemError);

      if (isSystemError && result.failedTest) {
        const errorMsg = result.failedTest.compile_output || result.failedTest.stderr || "";
        setOutput(errorMsg);
      }

      if (isAccepted) {
        const total = getResultTotal(result);
        setOutput(total ? `All ${total} test cases passed!` : "All test cases passed!");
        setIsNextRecommendationLoading(true);
        try {
          const refreshedPath = await getPracticePath(token);
          const nextFromPath = (refreshedPath || []).find(
            (candidate) =>
              candidate?._id !== problem?._id && candidate?.slug !== problem?.slug
          );
          setNextRecommendation(nextFromPath || null);
        } finally {
          setIsNextRecommendationLoading(false);
        }
        broadcastPracticePathUpdate();
      } else if (!isSystemError) {
        setOutput(`Submission Status: ${status}`);
      }
    } else {
      setRunMetrics({ time: null, memory: null });
      setSubmissionStatus("");
      setOutput("Submission failed.");
      setIsError(true);
    }
    setIsSubmitting(false);
  };

  const handleAskAI = async (question) => {
    if (!question || isAILoading) return;
    setIsAILoading(true);
    setAiResponse("");
    try {
      const res = await getAICodeHelp(
        {
          problemId: problem._id,
          problemDescription: problem.description,
          language,
          userCode: code,
          userQuestion: question,
        },
        token
      );
      if (res) {
        setAiResponse(res);
      } else {
        setAiResponse("I'm sorry, I couldn't generate a response. Please try again.");
      }
    } catch (err) {
      setAiResponse("An error occurred while contacting the AI mentor.");
    } finally {
      setIsAILoading(false);
    }
  };

  if (loading) return <div className="p-6 text-richblack-5">Loading Workspace...</div>;
  if (!problem) return <div className="p-6 text-richblack-5">Problem not found.</div>;

  return (
    <div className="w-full h-[calc(100vh-8rem)] flex flex-col overflow-hidden bg-richblack-900 rounded-xl border border-richblack-800 shadow-2xl">
      <div className="bg-richblack-800/50 px-4 py-2 border-b border-richblack-700 flex items-center justify-between shrink-0">
        <nav className="text-xs text-richblack-400 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLeftPanelOpen((open) => !open)}
            className="flex h-7 w-7 items-center justify-center rounded border border-richblack-700 bg-richblack-800 text-richblack-200 transition hover:bg-richblack-700"
            aria-label={isLeftPanelOpen ? "Collapse problem panel" : "Expand problem panel"}
            title={isLeftPanelOpen ? "Collapse problem panel" : "Expand problem panel"}
          >
            {isLeftPanelOpen ? "<<" : ">"}
          </button>
          <Link
            to="/dashboard/coding-practice/problems"
            className="hover:text-yellow-100 transition-colors"
          >
            Problems
          </Link>
          <span>/</span>
          <span className="text-richblack-5 font-bold">{problem.title}</span>
        </nav>
      </div>

      <PanelGroup orientation="horizontal" className="flex-1">
        {isLeftPanelOpen ? (
          <>
            <Panel
              defaultSize={30}
              minSize={20}
              className="bg-richblack-900 flex flex-col h-full overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="border-b border-richblack-800 pb-4">
                  <h1 className="text-2xl font-black text-richblack-5 tracking-tight">
                    {problem.title}
                  </h1>
                  <div className="flex gap-2 mt-3 items-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                        problem.difficulty === "Easy"
                          ? "bg-caribbeangreen-900/40 text-caribbeangreen-200 border border-caribbeangreen-900/30"
                          : problem.difficulty === "Medium"
                          ? "bg-yellow-900/40 text-yellow-200 border border-yellow-900/30"
                          : "bg-pink-900/40 text-pink-200 border border-pink-900/30"
                      }`}
                    >
                      {problem.difficulty}
                    </span>
                    <span className="bg-richblack-800 text-richblack-400 px-2 py-0.5 rounded text-[10px] font-bold border border-richblack-700">
                      {problem.topic.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="text-richblack-200 space-y-4">
                  <div className="prose prose-sm prose-invert max-w-none text-richblack-100">
                    <p className="whitespace-pre-wrap leading-relaxed">{problem.description}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-richblack-5 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-3 bg-yellow-50 rounded-full" /> Example Test Case
                      </h3>
                      <div className="bg-richblack-800 border border-richblack-700 rounded-lg overflow-hidden">
                        <div className="px-3 py-1.5 bg-richblack-700/50 border-b border-richblack-700 text-[10px] font-bold uppercase text-richblack-400">
                          Input
                        </div>
                        <pre className="p-3 text-xs text-richblack-5 font-mono overflow-x-auto">
                          {problem.exampleInput}
                        </pre>
                        <div className="px-3 py-1.5 bg-richblack-700/50 border-y border-richblack-700 text-[10px] font-bold uppercase text-richblack-400">
                          Output
                        </div>
                        <pre className="p-3 text-xs text-caribbeangreen-200 font-mono overflow-x-auto">
                          {problem.exampleOutput}
                        </pre>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-richblack-5 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-3 bg-pink-500 rounded-full" /> Constraints
                      </h3>
                      <pre className="bg-richblack-800/50 p-3 rounded-lg border border-richblack-700/50 text-xs text-richblack-400 italic whitespace-pre-wrap">
                        {problem.constraints}
                      </pre>
                    </div>

                    {submissionStatus === "Accepted" && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-black text-richblack-5 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1 h-3 bg-caribbeangreen-300 rounded-full" /> Next
                          Recommended Problem
                        </h3>
                        {isNextRecommendationLoading ? (
                          <div className="bg-richblack-800/60 border border-richblack-700 rounded-lg p-3 text-xs text-richblack-300">
                            Updating your personalized practice path...
                          </div>
                        ) : nextRecommendation ? (
                          <Link
                            to={`/dashboard/coding-practice/problems/${nextRecommendation.slug}`}
                            className="block bg-richblack-800 border border-richblack-700 rounded-lg p-3 hover:bg-richblack-700 transition"
                          >
                            <p className="text-richblack-25 text-sm font-semibold">
                              {nextRecommendation.title}
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-[10px]">
                              {nextRecommendation.topic && (
                                <span className="rounded-full border border-richblack-600 bg-richblack-900 px-2 py-1 text-richblack-200 uppercase tracking-wide">
                                  {nextRecommendation.topic}
                                </span>
                              )}
                              <span
                                className={`rounded-full border px-2 py-1 font-bold uppercase tracking-wide ${
                                  nextRecommendation.difficulty === "Easy"
                                    ? "border-emerald-700/50 bg-emerald-900/40 text-emerald-300"
                                    : nextRecommendation.difficulty === "Medium"
                                    ? "border-yellow-700/50 bg-yellow-900/40 text-yellow-200"
                                    : "border-pink-700/50 bg-pink-900/40 text-pink-200"
                                }`}
                              >
                                {nextRecommendation.difficulty}
                              </span>
                              <span className="text-yellow-100 font-semibold ml-auto">Solve Next -&gt;</span>
                            </div>
                          </Link>
                        ) : (
                          <div className="bg-richblack-800/60 border border-richblack-700 rounded-lg p-3 text-xs text-richblack-300">
                            Great progress. We will suggest your next best problem soon.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <ResizeHandle direction="horizontal" />
          </>
        ) : (
          <div className="flex items-start p-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsLeftPanelOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded border border-richblack-700 bg-richblack-800 text-richblack-200 transition hover:bg-richblack-700"
              aria-label="Expand problem panel"
              title="Expand problem panel"
            >
              {">"}
            </button>
          </div>
        )}

        <Panel defaultSize={aiPanelOpen ? 45 : 70} minSize={30} className="flex flex-col h-full bg-richblack-800">
          <PanelGroup orientation="vertical">
            <Panel defaultSize={65} minSize={20} className="flex flex-col bg-richblack-900">
              <div className="px-4 py-2 border-b border-richblack-700 bg-richblack-800 flex items-center justify-between shrink-0">
                <LanguageSelector language={language} setLanguage={setLanguage} setCode={setCode} />
                <div className="flex gap-2">
                  <button
                    onClick={() => setAiPanelOpen(!aiPanelOpen)}
                    className={`text-xs px-4 py-1.5 rounded font-black uppercase transition-all flex items-center gap-2 ${
                      aiPanelOpen
                        ? "bg-yellow-100 text-richblack-900 ring-2 ring-yellow-50"
                        : "bg-richblack-700 text-yellow-50 hover:bg-richblack-600 border border-yellow-50/20"
                    }`}
                  >
                    <span>AI</span> {aiPanelOpen ? "Close AI" : "Ask AI"}
                  </button>
                  <IconBtn
                    text={isExecuting ? "Running..." : "Run"}
                    onclick={handleRunCode}
                    disabled={isExecuting || isSubmitting}
                    customClasses={`text-xs px-3 py-1.5 bg-richblack-700 text-richblack-5 hover:bg-richblack-600 ${
                      isExecuting ? "opacity-50" : ""
                    }`}
                  />
                  <IconBtn
                    text={isSubmitting ? "Submitting..." : "Submit"}
                    onclick={handleSubmitCode}
                    disabled={isExecuting || isSubmitting}
                    customClasses={`text-xs px-4 py-1.5 bg-yellow-50 text-richblack-900 border-none hover:bg-yellow-100 font-black ${
                      isSubmitting ? "opacity-50" : ""
                    }`}
                  />
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden">
                <CodeEditor language={language} code={code} setCode={setCode} />
              </div>
            </Panel>

            <ResizeHandle direction="vertical" />

            <Panel defaultSize={35} minSize={10} className="bg-richblack-900 p-2 overflow-hidden flex flex-col">
              <TerminalOutput
                output={output}
                input=""
                setInput={() => {}}
                isError={isError}
                time={runMetrics.time}
                memory={runMetrics.memory}
                failedTest={failedTest}
                testResults={!isError ? testResults : []}
                xpBreakdown={xpBreakdown}
                showInput={false}
              />
            </Panel>
          </PanelGroup>
        </Panel>

        {aiPanelOpen && (
          <>
            <ResizeHandle direction="horizontal" />
            <Panel defaultSize={25} minSize={20} className="bg-richblack-800 border-l border-richblack-700">
              <AIAssistantPanel
                onClose={() => setAiPanelOpen(false)}
                onAskAI={handleAskAI}
                aiResponse={aiResponse}
                isAILoading={isAILoading}
              />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}

export default ProblemWorkspace;
