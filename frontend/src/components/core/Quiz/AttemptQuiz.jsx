import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";

import { fetchQuizById, submitQuiz } from "../../../services/operations/quizAPI";

// ── constants & pure helpers ───────────────────────────────────────────────────
const DEFAULT_ALLOWED_TIME_SECONDS = 10 * 60;

const getSessionStorageKey = (testId) => `test-attempt-session:${testId}`;

const getStoredAttemptSession = (storageKey) => {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.startTime !== "number" ||
      typeof parsed?.allowedTimeSeconds !== "number" ||
      typeof parsed?.attemptSessionToken !== "string"
    ) return null;
    return parsed;
  } catch {
    return null;
  }
};

const storeAttemptSession = (key, data) =>
  sessionStorage.setItem(key, JSON.stringify(data));

const clearAttemptSession = (key) => sessionStorage.removeItem(key);

const getTimeTakenSeconds = (startTime) =>
  Math.max(Math.floor((Date.now() - startTime) / 1000), 0);

const formatTime = (seconds) => {
  const s = Math.max(seconds, 0);
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
};

// ── component ──────────────────────────────────────────────────────────────────
export default function AttemptQuiz() {
  const { id } = useParams();
  const { token } = useSelector((state) => state.auth);

  const [quiz, setQuiz]                     = useState(null);
  const [answers, setAnswers]               = useState([]);
  const [currentQ, setCurrentQ]             = useState(0);
  const [error, setError]                   = useState("");
  const [warning, setWarning]               = useState("");
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [isSubmitted,  setIsSubmitted]      = useState(false);
  const [submitResult, setSubmitResult]     = useState(null); // { score, total }
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [attemptSessionToken, setAttemptSessionToken] = useState("");
  const [startTime, setStartTime]           = useState(null);
  const [allowedTimeSeconds, setAllowedTimeSeconds]   = useState(DEFAULT_ALLOWED_TIME_SECONDS);
  const [timeLeft, setTimeLeft]             = useState(DEFAULT_ALLOWED_TIME_SECONDS);

  // Track which questions have been opened (even if not answered)
  const [visited, setVisited] = useState(() => new Set([0]));

  const [showReview, setShowReview] = useState(false);

  const hasSubmittedRef  = useRef(false);
  const submitHandlerRef = useRef(null);
  const storageKey = getSessionStorageKey(id);

  // Mark each question as visited when navigated to
  useEffect(() => {
    setVisited((prev) => new Set([...prev, currentQ]));
  }, [currentQ]);

  // ── fetch quiz ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await fetchQuizById(id, token);
        
        if (res?.canAttempt === false) {
          const p = res.previousResult;
          setSubmitResult({
            score: p?.score || 0,
            total: p?.totalQuestions || 0,
            passed: p?.passed || false,
            percentage: p?.totalQuestions ? Math.round((p.score / p.totalQuestions) * 100) : 0,
            details: p?.studentAnswers || [],
            attemptsLeft: 0,
          });
          if (res?.quiz) setQuiz(res.quiz);
          setIsSubmitted(true);
          return;
        }

        if (!res?.quiz) { setError("Failed to fetch test."); return; }

        const serverSecs =
          Number.isInteger(res.allowedTimeSeconds) && res.allowedTimeSeconds > 0
            ? res.allowedTimeSeconds : DEFAULT_ALLOWED_TIME_SECONDS;

        const serverSession = {
          startTime: typeof res.startTime === "number" ? res.startTime : Date.now(),
          allowedTimeSeconds: serverSecs,
          attemptSessionToken: res.attemptSessionToken || "",
        };
        const stored = getStoredAttemptSession(storageKey);
        const active =
          stored?.attemptSessionToken && stored.allowedTimeSeconds === serverSecs
            ? stored : serverSession;

        if (active.attemptSessionToken) storeAttemptSession(storageKey, active);

        hasSubmittedRef.current = false;
        setError(""); setWarning(""); setIsSubmitting(false); setTabSwitchCount(0);
        setQuiz(res.quiz);
        setAnswers(Array(res.quiz.questions.length).fill(null));
        setAttemptSessionToken(active.attemptSessionToken);
        setStartTime(active.startTime);
        setAllowedTimeSeconds(active.allowedTimeSeconds);
        const elapsed = getTimeTakenSeconds(active.startTime);
        setTimeLeft(Math.max(active.allowedTimeSeconds - elapsed, 0));
      } catch {
        setError("An error occurred while fetching the test.");
      }
    };
    fetchQuiz();
  }, [id, storageKey, token]);

  // ── countdown display ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!startTime || !allowedTimeSeconds) return;
    const tick = setInterval(() => {
      setTimeLeft(Math.max(allowedTimeSeconds - getTimeTakenSeconds(startTime), 0));
    }, 1000);
    return () => clearInterval(tick);
  }, [startTime, allowedTimeSeconds]);

  // ── submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (hasSubmittedRef.current || !attemptSessionToken || !startTime || !quiz) return;
    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await submitQuiz(
        { quizId: id, answers, tabSwitchCount, attemptSessionToken,
          timeTaken: getTimeTakenSeconds(startTime) },
        token
      );
      if (res?.score !== undefined) {
        clearAttemptSession(storageKey);
        setSubmitResult({
          score:       res.score,
          total:       res.total,
          passed:      res.passed,
          percentage:  Math.round(res.percentage ?? (res.score / res.total) * 100),
          details:     res.details ?? [],
          attemptsLeft: res.attemptsLeft ?? 0,
        });
        setIsSubmitted(true);
      } else {
        setError("Failed to submit test.");
        hasSubmittedRef.current = false;
        setIsSubmitting(false);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "An error occurred while submitting.";
      setError(msg);
      if (["Time limit exceeded","Attempt session missing","Attempt session expired or invalid"].includes(msg))
        clearAttemptSession(storageKey);
      else { hasSubmittedRef.current = false; setIsSubmitting(false); }
    }
  };

  submitHandlerRef.current = handleSubmit;

  // ── anti-cheat: tab visibility ────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => {
      if (!document.hidden) return;
      setWarning("Switching tabs is not allowed");
      setTabSwitchCount((prev) => {
        const next = prev + 1;
        if (next > 3 && submitHandlerRef.current) submitHandlerRef.current();
        return next;
      });
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  // ── anti-cheat: copy / paste / right-click ────────────────────────────────────
  useEffect(() => {
    const warn = (msg) => setWarning(msg);
    const onCtx   = (e) => { e.preventDefault(); warn("Right click is not allowed during the test"); };
    const onCopy  = (e) => { e.preventDefault(); warn("Copy is not allowed during the test"); };
    const onPaste = (e) => { e.preventDefault(); warn("Paste is not allowed during the test"); };
    const onKey   = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "c") { e.preventDefault(); warn("Copy is not allowed"); }
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "v") { e.preventDefault(); warn("Paste is not allowed"); }
    };
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("copy",        onCopy);
    document.addEventListener("paste",       onPaste);
    document.addEventListener("keydown",     onKey);
    return () => {
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("copy",        onCopy);
      document.removeEventListener("paste",       onPaste);
      document.removeEventListener("keydown",     onKey);
    };
  }, []);

  // ── auto-submit on expiry ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!startTime || !allowedTimeSeconds || hasSubmittedRef.current) return;
    const timer = setInterval(() => {
      if (getTimeTakenSeconds(startTime) > allowedTimeSeconds) {
        clearInterval(timer);
        if (submitHandlerRef.current) submitHandlerRef.current();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [allowedTimeSeconds, startTime]);

  // ── prevent accidental page exit ─────────────────────────────────────────────
  useEffect(() => {
    if (isSubmitted) {
      window.onbeforeunload = null;
      return;
    }
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Your test is in progress. Leaving will not submit your answers.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSubmitted]);

  // ── answer helper ─────────────────────────────────────────────────────────────
  const selectAnswer = (qIdx, oIdx) => {
    const copy = [...answers];
    copy[qIdx] = oIdx;
    setAnswers(copy);
  };

  const answeredCount = answers.filter((a) => a !== null).length;
  const unansweredCount = quiz ? quiz.questions.length - answeredCount : 0;
  const [showConfirm, setShowConfirm] = useState(false);
  const isWarning = timeLeft <= 5 * 60 && timeLeft > 2 * 60; // amber: 2–5 min
  const isLow     = timeLeft <= 2 * 60;                       // red:   < 2 min

  const timerColor = isLow
    ? "text-red-400"
    : isWarning
    ? "text-amber-400"
    : "text-yellow-50";

  // ── early returns ─────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-richblack-900">
      <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md text-center">
        <p className="font-semibold">Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    </div>
  );

  if (!quiz) return (
    <div className="min-h-screen flex items-center justify-center bg-richblack-900">
      <div className="flex flex-col items-center gap-3 text-richblack-100">
        <div className="w-10 h-10 border-4 border-yellow-50 border-t-transparent rounded-full animate-spin" />
        <p>Loading test…</p>
      </div>
    </div>
  );

  // ── Submitted screen (full lock) ────────────────────────────────────

  if (isSubmitted) {
    const r = submitResult;
    const passed = r?.passed;
    const correctCount = r?.details?.filter((d) => d.isCorrect).length ?? r?.score ?? 0;
    const wrongCount   = (r?.total ?? 0) - correctCount;

    return (
      <div className="h-[calc(100vh-8rem)] w-full rounded-xl border border-richblack-700 bg-richblack-800 overflow-y-auto flex items-start justify-center py-10 px-4 shadow-lg">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* ── Result Card ── */}
          <div className={`rounded-2xl border shadow-2xl overflow-hidden bg-richblack-900
            ${passed ? "border-green-500/50" : "border-red-500/50"}`}>

            {/* Header band */}
            <div className={`px-8 py-8 flex flex-col items-center gap-4 text-center
              ${passed
                ? "bg-green-900/30"
                : "bg-red-900/30"}`}>

              {/* Pass / Fail badge */}
              <span className={`inline-flex items-center gap-2 px-6 py-2 rounded-full text-[15px] font-extrabold shadow-md tracking-wider uppercase
                ${passed
                  ? "bg-green-500 text-white"
                  : "bg-red-600 text-white"}`}>
                {passed ? "✔ PASSED" : "✘ FAILED"}
              </span>

              <h2 className="text-2xl font-bold text-richblack-5">{quiz?.title}</h2>
              <p className="text-richblack-400 text-sm">Test Submitted Successfully</p>
            </div>

            {/* Body */}
            <div className="px-8 py-8 flex flex-col gap-8">

              {/* Big score */}
              <div className="flex flex-col items-center gap-1">
                <p className={`text-7xl font-black tracking-tight
                  ${passed ? "text-green-400" : "text-red-400"}`}>
                  {r?.score ?? 0}
                  <span className="text-richblack-500 text-3xl font-normal"> / {r?.total ?? 0}</span>
                </p>
                <p className={`text-2xl font-bold mt-1
                  ${passed ? "text-green-300" : "text-red-300"}`}>
                  {r?.percentage ?? 0}%
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-richblack-700 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-richblack-5">{r?.total ?? 0}</p>
                  <p className="text-xs text-richblack-400 mt-0.5">Total</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{correctCount}</p>
                  <p className="text-xs text-richblack-400 mt-0.5">Correct</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">{wrongCount}</p>
                  <p className="text-xs text-richblack-400 mt-0.5">Wrong</p>
                </div>
              </div>

              {/* Attempts left */}
              {r?.attemptsLeft > 0 && !passed && (
                <p className="text-center text-amber-400 text-sm">
                  You have <span className="font-bold">{r.attemptsLeft}</span> attempt{r.attemptsLeft !== 1 ? "s" : ""} remaining.
                </p>
              )}

              {/* Review toggle */}
              {r?.details?.length > 0 && (
                <button
                  onClick={() => setShowReview((v) => !v)}
                  className="w-full py-2.5 rounded-lg bg-richblack-700 text-richblack-200
                             hover:bg-richblack-600 text-sm font-medium transition-colors duration-150"
                >
                  {showReview ? "Hide" : "Show"} Detailed Review
                </button>
              )}

              {/* Detailed review */}
              {showReview && r?.details?.length > 0 && (
                <div className="flex flex-col gap-4">
                  {r.details.map((d, i) => (
                    <div key={i}
                      className={`rounded-xl border p-4 text-sm
                        ${d.isCorrect
                          ? "bg-green-500/5 border-green-500/25"
                          : "bg-red-500/5 border-red-500/25"}`}>
                      <p className="font-semibold text-richblack-100 mb-3">
                        <span className="text-richblack-400 mr-2">Q{i + 1}.</span>{d.question}
                      </p>
                      <div className="flex flex-col items-start gap-2">
                        <p className={`text-xs px-3 py-2 rounded-lg inline-block shadow-sm
                          ${d.isCorrect
                            ? "bg-green-600 font-medium text-white"
                            : "bg-red-600 font-medium text-white"}`}>
                          Your answer: <span className="font-extrabold ml-1">
                            {d.selectedOption !== null
                              ? String.fromCharCode(65 + d.selectedOption)
                              : "Not answered"}
                          </span>
                          {d.selectedOption !== null && quiz?.questions[i]?.options[d.selectedOption] && (
                            <span className="ml-2 font-semibold">- {quiz.questions[i].options[d.selectedOption]}</span>
                          )}
                        </p>
                        {!d.isCorrect && (
                          <p className="text-xs px-3 py-2 rounded-lg bg-green-600 font-medium text-white inline-block shadow-sm">
                            Correct answer: <span className="font-extrabold ml-1">{String.fromCharCode(65 + d.correctOption)}</span>
                            {quiz?.questions[i]?.options[d.correctOption] && (
                               <span className="ml-2 font-semibold">- {quiz.questions[i].options[d.correctOption]}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQ];

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-8rem)] w-full rounded-xl border border-richblack-700 overflow-hidden bg-richblack-900 text-richblack-5 flex flex-col select-none shadow-lg">

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-richblack-800 shadow-md">
        <div className="flex items-center justify-between px-6 py-3 border-b border-richblack-700">
          {/* Title */}
          <h1 className="font-bold text-lg truncate max-w-[40%]">{quiz.title}</h1>

          {/* Timer */}
          <div className={`flex flex-col items-center font-mono font-bold
                          ${timerColor} ${isLow ? "animate-pulse" : ""}`}>
            <span className="text-2xl tracking-widest">{formatTime(timeLeft)}</span>
            <span className="text-[10px] font-normal opacity-70 mt-0.5">
              {isLow ? "⚠ TIME ALMOST UP" : isWarning ? "Time is running low" : "Time Remaining"}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-4">
            <span className="text-richblack-300 text-sm hidden sm:block">
              {answeredCount}/{quiz.questions.length} answered
            </span>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isSubmitting}
              className="bg-yellow-50 text-richblack-900 font-semibold px-5 py-2 rounded-lg
                         hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200"
            >
              {isSubmitting ? "Submitting…" : "Submit Test"}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-richblack-700 w-full relative">
          <div
            className="h-full bg-green-500 transition-all duration-300 ease-out"
            style={{ width: `${(answeredCount / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Warning Banner ───────────────────────────────────────────────────── */}
      {warning && (
        <div className="bg-yellow-400 text-richblack-900 text-sm font-medium
                        text-center py-2 px-4 animate-pulse">
          ⚠️ {warning}
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Question Panel ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          {/* Question header */}
          <div className="mb-6">
            <span className="text-richblack-400 text-sm">
              Question {currentQ + 1} of {quiz.questions.length}
            </span>
            <p className="mt-2 text-lg font-semibold leading-relaxed">
              {question.question}
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3">
            {question.options.map((option, oIdx) => {
              const selected = answers[currentQ] === oIdx;
              return (
                <button
                  key={oIdx}
                  onClick={() => selectAnswer(currentQ, oIdx)}
                  className={`group w-full text-left flex items-center gap-4 px-5 py-4 rounded-xl border-2
                              transition-all duration-200 ease-out
                    ${selected
                      ? "bg-yellow-50 border-yellow-400 ring-2 ring-yellow-300/50 text-richblack-900 scale-[1.01]"
                      : "bg-richblack-700 border-richblack-600 text-richblack-100 hover:bg-richblack-600 hover:border-yellow-400/50 hover:scale-[1.01]"
                    }`}
                >
                  {/* Letter badge */}
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                                    text-sm font-bold transition-colors duration-200
                    ${selected
                      ? "bg-yellow-400 text-richblack-900"
                      : "bg-richblack-600 text-richblack-300 group-hover:bg-richblack-500 group-hover:text-richblack-100"
                    }`}>
                    {String.fromCharCode(65 + oIdx)}
                  </span>

                  {/* Option text */}
                  <span className={`flex-1 font-medium ${selected ? "font-semibold" : ""}`}>
                    {option}
                  </span>

                  {/* Checkmark — visible only when selected */}
                  {selected && (
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Prev / Next */}
          <div className="flex justify-between mt-10">
            <button
              onClick={() => setCurrentQ((q) => Math.max(q - 1, 0))}
              disabled={currentQ === 0}
              className="px-5 py-2 rounded-lg bg-richblack-700 text-richblack-100
                         hover:bg-richblack-600 disabled:opacity-30 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              ← Previous
            </button>
            <button
              onClick={() => setCurrentQ((q) => Math.min(q + 1, quiz.questions.length - 1))}
              disabled={currentQ === quiz.questions.length - 1}
              className="px-5 py-2 rounded-lg bg-richblack-700 text-richblack-100
                         hover:bg-richblack-600 disabled:opacity-30 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              Next →
            </button>
          </div>
        </main>

        {/* ── Right: Navigator Panel ────────────────────────────────────────── */}
        <aside className="w-56 shrink-0 bg-richblack-800 border-l border-richblack-700
                          overflow-y-auto p-4 hidden sm:block">
          <p className="text-richblack-400 text-xs font-semibold uppercase mb-3 tracking-wide">
            Questions
          </p>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4 text-[11px] text-richblack-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-yellow-50 inline-block" /> Current
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Answered
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> Visited
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-richblack-600 inline-block" /> Not visited
            </span>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-4 gap-2">
            {quiz.questions.map((_, idx) => {
              const answered  = answers[idx] !== null;
              const current   = idx === currentQ;
              const wasVisited = visited.has(idx);
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentQ(idx)}
                  className={`h-9 w-full rounded-md text-xs font-bold transition-all duration-150
                    ${current
                      ? "bg-yellow-50 text-richblack-900 ring-2 ring-yellow-200"
                      : answered
                      ? "bg-green-500 text-white hover:bg-green-400"
                      : wasVisited
                      ? "bg-yellow-400 text-richblack-900 hover:bg-yellow-300"
                      : "bg-richblack-600 text-richblack-300 hover:bg-richblack-500"
                    }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-5 pt-4 border-t border-richblack-700 text-xs text-richblack-400 space-y-1">
            <p>Answered: <span className="text-green-400 font-semibold">{answeredCount}</span></p>
            <p>Skipped:  <span className="text-richblack-300 font-semibold">{quiz.questions.length - answeredCount}</span></p>
            <p>Total:    <span className="text-richblack-100 font-semibold">{quiz.questions.length}</span></p>
          </div>
        </aside>
      </div>

      {/* ── Confirm Submit Modal ──────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-richblack-800 border border-richblack-600 rounded-2xl shadow-2xl
                          w-full max-w-md mx-4 p-8 flex flex-col gap-5 animate-fadeIn">

            {/* Icon + heading */}
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 rounded-full bg-yellow-50/10 flex items-center justify-center text-3xl">
                📋
              </div>
              <h2 className="text-xl font-bold text-richblack-5">Submit Test?</h2>
              <p className="text-richblack-300 text-sm">Are you sure you want to submit?</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{answeredCount}</p>
                <p className="text-xs text-richblack-300 mt-0.5">Answered</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{unansweredCount}</p>
                <p className="text-xs text-richblack-300 mt-0.5">Unanswered</p>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-amber-400 text-xs text-center">
                ⚠️ You have {unansweredCount} unanswered question{unansweredCount > 1 ? "s" : ""}.
                Unanswered questions will be marked as incorrect.
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-richblack-700 text-richblack-100
                           hover:bg-richblack-600 font-medium transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); handleSubmit(); }}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-lg bg-yellow-50 text-richblack-900 font-semibold
                           hover:bg-yellow-100 disabled:opacity-50 transition-colors duration-150"
              >
                {isSubmitting ? "Submitting…" : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
