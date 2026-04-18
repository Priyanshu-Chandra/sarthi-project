import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { fetchQuizById, submitQuiz } from "../../../services/operations/quizAPI";
import { setEntireCourseData } from "../../../slices/viewCourseSlice";
import useExamProctoring from "../../../hooks/useExamProctoring";
import useCameraProctor from "../../../proctoring/camera/useCameraProctor";
import useFaceMonitor from "../../../proctoring/camera/useFaceMonitor";
import useMicMonitor from "../../../proctoring/audio/useMicMonitor";
import CodingTestWorkspace from "../../Coding/CodingTestWorkspace";
import PostTestAnalysis from "./PostTestAnalysis";
import { getPostTestAnalysis } from "../../../services/operations/analysisApi";

// ── constants & pure helpers ───────────────────────────────────────────────────
const DEFAULT_ALLOWED_TIME_SECONDS = 10 * 60;

const getSessionStorageKey = (testId) => `test-attempt-session:${testId}`;
const getProctorStorageKey = (testId) => `examProctorState:${testId}`;

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

const generateDeviceId = () => {
  const fingerprint =
    navigator.userAgent +
    screen.width +
    screen.height +
    navigator.platform;

  return btoa(fingerprint);
};

// ── component ──────────────────────────────────────────────────────────────────
export default function AttemptQuiz() {
  const { courseId, id } = useParams();
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.profile);
  const { courseEntireData } = useSelector((state) => state.viewCourse);

  const [quiz, setQuiz]                     = useState(null);
  const [answers, setAnswers]               = useState([]);
  const [currentQ, setCurrentQ]             = useState(0);
  const [error, setError]                   = useState("");
  const [warning, setWarning]               = useState("");
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [isSubmitted,  setIsSubmitted]      = useState(false);
  const [isTabCheckRequired, setIsTabCheckRequired] = useState(false);
  const [submitResult, setSubmitResult]     = useState(null); // { score, total }
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [hasStartedExam, setHasStartedExam] = useState(false);
  const [attemptSessionToken, setAttemptSessionToken] = useState("");
  const [startTime, setStartTime]           = useState(null);
  const [allowedTimeSeconds, setAllowedTimeSeconds]   = useState(DEFAULT_ALLOWED_TIME_SECONDS);
  const [timeLeft, setTimeLeft]             = useState(DEFAULT_ALLOWED_TIME_SECONDS);

  // Track which questions have been opened (even if not answered)
  const [visited, setVisited] = useState(() => new Set([0]));

  const [showReview, setShowReview] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [codingSubmissionsInit, setCodingSubmissionsInit] = useState([]);

  const hasSubmittedRef  = useRef(false);
  const submitHandlerRef = useRef(null);
  const tabIdRef = useRef(`exam-tab-${Date.now()}-${Math.random()}`);

  // Fetch post-test analysis once the test is submitted
  useEffect(() => {
    if (isSubmitted && id && token) {
      setAnalysisLoading(true);
      getPostTestAnalysis(id, token)
        .then((data) => {
          if (data) setAnalysisData(data);
        })
        .finally(() => setAnalysisLoading(false));
    }
  }, [isSubmitted, id, token]);
  const deviceIdRef = useRef(generateDeviceId());
  const cameraRef = useRef(null);
  const storageKey = getSessionStorageKey(id);
  const proctorStorageKey = getProctorStorageKey(id);
  const examTabStorageKey =
    id && user?._id ? `activeExamTab:${id}:${user._id}` : "";
  const { emitViolation, emitWarning, enterFullscreen, exitFullscreen } = useExamProctoring({
    isEnabled: hasStartedExam && !isSubmitted && !isSubmitting,
    storageKey: proctorStorageKey,
    examSessionActive: hasStartedExam && !isSubmitted && !isSubmitting,
    hasStartedExam,
    isSubmitted,
    onViolation: (count) => {
      setTabSwitchCount(count);
      if (count > 3) {
        safeSubmitExam();
      }
    },
  });

  const releaseExamTabLock = () => {
    if (!examTabStorageKey) return;

    const activeTab = localStorage.getItem(examTabStorageKey);
    if (activeTab === tabIdRef.current) {
      localStorage.removeItem(examTabStorageKey);
    }
  };

  useCameraProctor({
    isEnabled: hasStartedExam && !isSubmitted,
    videoRef: cameraRef,
    emitViolation,
    onCameraError: () => {
      window.alert("Camera permission is required for this test.");
    },
  });

  useFaceMonitor({
    videoRef: cameraRef,
    isEnabled: hasStartedExam && !isSubmitted,
    emitViolation,
    emitWarning,
  });

  useMicMonitor({
    isEnabled: hasStartedExam && !isSubmitted,
    emitWarning,
  });

  // Mark each question as visited when navigated to
  useEffect(() => {
    setVisited((prev) => new Set([...prev, currentQ]));
  }, [currentQ]);

  useEffect(() => {
    if (!examTabStorageKey || !isTabCheckRequired || isSubmitted) return;

    const existingTab = localStorage.getItem(examTabStorageKey);

    if (existingTab && existingTab !== tabIdRef.current) {
      window.alert("⚠️ This exam is already open in another tab.");
      window.location.href = "/dashboard";
      return;
    }

    localStorage.setItem(examTabStorageKey, tabIdRef.current);

    const handleStorageChange = (event) => {
      if (event.key !== examTabStorageKey) {
        return;
      }

      if (event.newValue && event.newValue !== tabIdRef.current) {
        window.alert("⚠️ Exam opened in another tab. This session will close.");
        window.location.reload();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);

      const activeTab = localStorage.getItem(examTabStorageKey);
      if (activeTab === tabIdRef.current) {
        localStorage.removeItem(examTabStorageKey);
      }
    };
  }, [examTabStorageKey, isTabCheckRequired, isSubmitted, submitResult?.passed]);

  // ── fetch quiz ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await fetchQuizById(
          {
            quizId: id,
            deviceId: deviceIdRef.current,
          },
          token
        );
        
        if (res?.canAttempt === false) {
          const p = res.previousResult;
          // Backend sends totalQuestions in TestResult; normalize to 'total' for display consistency
          const rawTotal = p?.totalQuestions ?? p?.total ?? quiz?.questions?.length ?? 0;
          const scoreValue = p?.score ?? 0;
          const totalValue = rawTotal;

          setSubmitResult({
            score:       scoreValue,
            total:       totalValue,
            passed:      p?.passed || false,
            percentage:  p?.percentage ?? (totalValue > 0 ? Math.round((scoreValue / totalValue) * 100) : 0),
            details:     p?.studentAnswers || p?.details || [],
            codingSubmissions: p?.codingSubmissions || [],
            attemptsLeft: 0,
          });
          if (res?.quiz) setQuiz(res.quiz);
          setIsSubmitted(true);
          setIsTabCheckRequired(false);
          
          // CRITICAL: If passed, immediately clear any ghost tab locks for the results view
          if (p?.passed && examTabStorageKey) {
            localStorage.removeItem(examTabStorageKey);
          }
          return;
        }

        setIsTabCheckRequired(true);

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
        const storedProctorState = sessionStorage.getItem(proctorStorageKey);
        let restoredHasStartedExam = false;

        if (storedProctorState) {
          try {
            const parsedState = JSON.parse(storedProctorState);
            restoredHasStartedExam = parsedState?.hasStartedExam === true;
          } catch {
            restoredHasStartedExam = false;
          }
        }

        setError(""); setWarning(""); setIsSubmitting(false); setTabSwitchCount(0);
        setQuiz(res.quiz);
        setAnswers(Array(res.quiz.questions.length).fill(null));
        setAttemptSessionToken(active.attemptSessionToken);
        setStartTime(active.startTime);
        setAllowedTimeSeconds(active.allowedTimeSeconds);
        setHasStartedExam(restoredHasStartedExam);
        // Restore per-problem coding state (runCount, status) so the UI is
        // accurate after a page reload or session resume.
        if (Array.isArray(res.codingSubmissions)) {
          setCodingSubmissionsInit(res.codingSubmissions);
        }
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
    if (!attemptSessionToken || !startTime || !quiz) return;
    setIsSubmitting(true);
    try {
      const isCoding = quiz.testType === "CODING";
      const res = await submitQuiz(
        {
          quizId: id,
          // Omit answers for CODING tests — backend scores via codingSubmissions instead
          ...(isCoding ? {} : { answers }),
          tabSwitchCount,
          attemptSessionToken,
          deviceId: deviceIdRef.current,
          timeTaken: getTimeTakenSeconds(startTime),
        },
        token
      );
      if (res?.score !== undefined) {
        // Bulk Clear Autosave for Coding Problems
        if (quiz?.questions) {
          quiz.questions.forEach(q => {
            if (q.problemId?._id) {
              localStorage.removeItem(`exam_${id}_${q.problemId._id}`);
            }
          });
        }

        clearAttemptSession(storageKey);
        sessionStorage.removeItem(proctorStorageKey);
        releaseExamTabLock();
        setHasStartedExam(false);
        dispatch(
          setEntireCourseData({
            ...courseEntireData,
            certificateEligibility: {
              eligible: res.courseEligible ?? false,
              reason: res.courseEligibilityReason || "NOT_ALL_TESTS_PASSED",
            },
          })
        );
        setSubmitResult({
          score:       res.score,
          total:       res.total ?? res.totalQuestions ?? quiz?.questions?.length ?? 0,
          passed:      res.passed,
          percentage:  Math.round(res.percentage ?? (res.total > 0 ? (res.score / res.total) * 100 : 0)),
          details:     res.details ?? [],
          codingSubmissions: res.details?.filter(d => d.passRatio !== undefined) || [],
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
      if (["Time limit exceeded","Attempt session missing","Attempt session expired or invalid"].includes(msg)) {
        clearAttemptSession(storageKey);
        sessionStorage.removeItem(proctorStorageKey);
      } else { hasSubmittedRef.current = false; setIsSubmitting(false); }
    }
  };

  const safeSubmitExam = async () => {
    if (hasSubmittedRef.current) return;

    hasSubmittedRef.current = true;

    try {
      await exitFullscreen();

      if (submitHandlerRef.current) {
        await submitHandlerRef.current();
      }
    } catch (error) {
      console.error("Auto-submit failed:", error);
      hasSubmittedRef.current = false;
      setIsSubmitting(false);
    }
  };

  submitHandlerRef.current = handleSubmit;

  const handleStartTest = async () => {
    const didEnterFullscreen = await enterFullscreen();

    if (!didEnterFullscreen) {
      setWarning("Fullscreen is required to start the test.");
      return;
    }

    setWarning("");
    setHasStartedExam(true);
  };

  // ── auto-submit on expiry ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasStartedExam || !startTime || !allowedTimeSeconds || hasSubmittedRef.current) return;
    const timer = setInterval(() => {
      if (getTimeTakenSeconds(startTime) > allowedTimeSeconds) {
        clearInterval(timer);
        safeSubmitExam();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [allowedTimeSeconds, hasStartedExam, startTime]);

  // ── prevent accidental page exit ─────────────────────────────────────────────
  useEffect(() => {
    if (isSubmitted || !hasStartedExam) {
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
  }, [hasStartedExam, isSubmitted]);

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

  if (!hasStartedExam && !submitResult?.passed) {
    const testTypeBadge = quiz?.testType === "CODING"
      ? { label: "💻 Coding Test", cls: "bg-blue-900/40 border-blue-600 text-blue-200" }
      : { label: "📝 MCQ Test",    cls: "bg-purple-900/40 border-purple-600 text-purple-200" };

    const durationMins = Math.floor(allowedTimeSeconds / 60);

    return (
      <div className="h-[calc(100vh-8rem)] w-full rounded-xl border border-richblack-700 bg-richblack-900 flex items-center justify-center p-6 shadow-lg">
        <div className="w-full max-w-2xl rounded-3xl border border-richblack-700 bg-gradient-to-br from-richblack-800 to-richblack-900 p-8 md:p-10 text-richblack-5 shadow-2xl">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-100/70">
              Secure Test Mode
            </p>
            <h1 className="mt-4 text-3xl font-bold text-richblack-5 md:text-4xl">
              {quiz?.title}
            </h1>

            {/* ── Test Info Card (Step 6) ── */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-richblack-600 bg-richblack-800/80 p-4">
                <p className="text-xs text-richblack-400 mb-1">Test Type</p>
                <span className={`text-xs font-bold px-2 py-1 rounded border ${testTypeBadge.cls}`}>
                  {testTypeBadge.label}
                </span>
              </div>
              <div className="rounded-xl border border-richblack-600 bg-richblack-800/80 p-4">
                <p className="text-xs text-richblack-400 mb-1">Duration</p>
                <p className="text-lg font-bold text-yellow-300">⏱ {durationMins} min</p>
              </div>
              <div className="rounded-xl border border-richblack-600 bg-richblack-800/80 p-4">
                <p className="text-xs text-richblack-400 mb-1">Questions</p>
                <p className="text-lg font-bold text-richblack-5">📋 {quiz?.questions?.length ?? 0}</p>
              </div>
            </div>

            {/* ── Proctoring Checklist (Step 7) ── */}
            <div className="mt-6 rounded-2xl border border-richblack-700 bg-richblack-800/80 p-5 text-left">
              <p className="text-sm font-semibold text-richblack-100">Before you begin</p>
              <ul className="mt-3 space-y-2 text-sm text-richblack-300">
                <li>🖥️ Enter fullscreen mode to unlock the test.</li>
                <li>📸 Camera permission is required — face detection is active.</li>
                <li>🎙️ Microphone is monitored for unusual audio.</li>
                <li>🔀 Leaving fullscreen or switching tabs will count as violations.</li>
                <li>⏰ Your timer starts as soon as you enter fullscreen.</li>
              </ul>
            </div>

            {warning && (
              <div className="mt-6 rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 text-sm font-medium text-yellow-100">
                {warning}
              </div>
            )}

            <button
              onClick={handleStartTest}
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-yellow-50 px-6 py-3 text-base font-semibold text-richblack-900 transition-all duration-200 hover:scale-[1.02] hover:bg-yellow-100"
            >
              Start Test in Fullscreen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Submitted screen (full lock) ────────────────────────────────────

  if (isSubmitted) {
    const r = submitResult;
    const passed = r?.passed;
    const correctCount = r?.details?.filter((d) => d.isCorrect).length ?? r?.score ?? 0;
    const wrongCount   = (r?.total ?? 0) - correctCount;

    return (
      <div className="h-[calc(100vh-8rem)] w-full rounded-xl border border-richblack-700 bg-richblack-900 overflow-y-auto flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* ── Result Card ── */}
          <div className={`rounded-2xl border shadow-[0_20px_100px_-15px_rgba(0,0,0,1)] overflow-hidden bg-black
            ${passed ? "border-emerald-500/30" : "border-red-500/30"}`}>

            <div className={`px-8 py-10 flex flex-col items-center gap-4 text-center
              ${passed
                ? "bg-emerald-500/10"
                : "bg-red-500/10"}`}>

              {/* Pass / Fail badge */}
              <span className={`inline-flex items-center gap-2 px-6 py-2 rounded-full text-[15px] font-black shadow-lg tracking-wider uppercase
                ${passed
                  ? "bg-emerald-500 text-black border border-emerald-400"
                  : "bg-red-600 text-white border border-red-500"}`}>
                {passed ? "✔ PASSED" : "✘ FAILED"}
              </span>

              <h2 className="text-3xl font-black text-white">{quiz?.title}</h2>
              <p className="text-richblack-300 text-sm font-medium tracking-wide">Test Result • {new Date().toLocaleDateString()}</p>
            </div>

            {/* Body */}
            <div className="px-8 py-8 flex flex-col gap-8 text-white">

              {/* Big score */}
              <div className="flex flex-col items-center gap-1">
                <p className={`text-8xl font-black tracking-tighter
                  ${passed ? "text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]" : "text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]"}`}>
                  {r?.score ?? 0}
                  <span className="text-richblack-500 text-4xl font-normal tracking-wide"> / {r?.total ?? 0}</span>
                </p>
                <p className={`text-2xl font-black mt-2 uppercase tracking-[0.3em]
                  ${passed ? "text-emerald-500/80" : "text-red-500/80"}`}>
                  {r?.percentage ?? 0}% Score
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-richblack-900 border border-richblack-800 rounded-2xl p-6 text-center shadow-lg">
                  <p className="text-3xl font-black text-white">{r?.total ?? 0}</p>
                  <p className="text-[10px] text-richblack-500 mt-2 uppercase tracking-[0.2em] font-black">Questions</p>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-6 text-center shadow-lg">
                  <p className="text-3xl font-black text-emerald-400">{correctCount}</p>
                  <p className="text-[10px] text-emerald-500/60 mt-2 uppercase tracking-[0.2em] font-black">Passed</p>
                </div>
                <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-6 text-center shadow-lg">
                  <p className="text-3xl font-black text-red-500">{wrongCount}</p>
                  <p className="text-[10px] text-red-500/60 mt-2 uppercase tracking-[0.2em] font-black">Failed</p>
                </div>
              </div>

              {/* Attempts left */}
              {r?.attemptsLeft > 0 && !passed && (
                <p className="text-center text-amber-400 text-sm font-medium">
                  You have <span className="font-bold underline underline-offset-4">{r.attemptsLeft}</span> attempt{r.attemptsLeft !== 1 ? "s" : ""} remaining.
                </p>
              )}

              {/* Review toggle */}
              {r?.details?.length > 0 && (
                <button
                  onClick={() => setShowReview((v) => !v)}
                  className="w-full py-4 rounded-2xl bg-white text-black
                             hover:bg-richblack-50 transition-all duration-300 text-sm font-black tracking-widest uppercase shadow-lg active:scale-95"
                >
                  {showReview ? "Hide" : "Show"} Detailed Review
                </button>
              )}

              {/* Detailed review */}
              {showReview && r?.details?.length > 0 && (
                <div className="flex flex-col gap-6">
                  {r.details.map((d, i) => (
                    <div key={i}
                      className={`rounded-xl border p-6 text-sm transition-all duration-300 bg-richblack-900/40
                        ${d.isCorrect
                          ? "border-emerald-500/20 shadow-lg shadow-emerald-500/5"
                          : "border-red-500/20 shadow-lg shadow-red-500/5"}`}>
                      
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                           <p className="font-black text-white text-base flex items-center gap-3 tracking-tight">
                             <span className="text-richblack-500 font-mono text-sm uppercase tracking-tighter">PRB {i + 1}</span>
                             {d.question}
                           </p>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest
                          ${d.isCorrect ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                          {d.isCorrect ? "ACCEPTED" : "FAILED"}
                        </span>
                      </div>

                      {quiz?.testType === "CODING" ? (
                        <div className="space-y-4">
                           {/* Coding Specific Review */}
                           <div className="flex flex-wrap gap-4">
                             <div className="flex flex-col gap-1">
                               <span className="text-[10px] text-richblack-500 uppercase font-bold tracking-widest">TestCase Pass Rate</span>
                               <p className="text-white font-mono font-bold">
                                 {d.passedTestCases} / {d.totalTestCases}
                                 <span className="ml-2 text-xs text-richblack-400">({Math.round(d.passRatio * 100)}%)</span>
                               </p>
                             </div>
                           </div>

                           {d.code && (
                             <div className="mt-4">
                               <p className="text-[10px] text-richblack-500 uppercase font-bold mb-2 tracking-widest">Submitted Code</p>
                               <div className="relative rounded-lg border border-richblack-800 bg-black p-4 font-mono text-xs overflow-x-auto max-h-60 shadow-inner">
                                 <pre className="text-richblack-100"><code>{d.code}</code></pre>
                               </div>
                             </div>
                           )}
                        </div>
                      ) : (
                        /* MCQ Specific Review */
                        <div className="flex flex-col items-start gap-4">
                          <p className={`text-xs px-4 py-2.5 rounded-xl inline-block border font-black shadow-lg
                            ${d.isCorrect
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-red-500/10 border-red-500/30 text-red-100"}`}>
                            Your answer: <span className="ml-2 text-base uppercase text-white font-black">
                              {d.selectedOption !== null
                                ? String.fromCharCode(65 + d.selectedOption)
                                : "Not answered"}
                            </span>
                            {d.selectedOption !== null && quiz?.questions[i]?.options[d.selectedOption] && (
                              <span className="ml-3 font-bold opacity-60 text-[11px]">— {quiz.questions[i].options[d.selectedOption]}</span>
                            )}
                          </p>
                          {!d.isCorrect && (
                            <p className="text-xs px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black inline-block shadow-lg">
                              Correct answer: <span className="ml-2 text-base uppercase text-white font-black">{String.fromCharCode(65 + d.correctOption)}</span>
                              {quiz?.questions[i]?.options[d.correctOption] && (
                                 <span className="ml-3 font-bold opacity-60 text-[11px]">— {quiz.questions[i].options[d.correctOption]}</span>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* ── Post-Test Learning Insights ── */}
          {analysisLoading ? (
            <div className="mt-6 rounded-2xl border border-richblack-700 bg-richblack-900 p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-5 w-40 bg-richblack-700 rounded-full" />
                <div className="h-5 w-24 bg-richblack-700 rounded-full ml-auto" />
              </div>
              <div className="h-3 w-32 bg-richblack-700 rounded-full mb-3" />
              <div className="flex gap-2 mb-5">
                <div className="h-7 w-24 bg-richblack-700 rounded-full" />
                <div className="h-7 w-28 bg-richblack-700 rounded-full" />
              </div>
              <div className="h-3 w-36 bg-richblack-700 rounded-full mb-3" />
              <div className="h-24 w-full bg-richblack-700 rounded-xl" />
            </div>
          ) : analysisData ? (
            <PostTestAnalysis analysis={analysisData} />
          ) : (
            isSubmitted && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => navigate(`/view-course/${courseId}`)}
                  className="px-8 py-3 bg-yellow-50 text-richblack-900 font-bold rounded-xl hover:bg-yellow-100 transition-all shadow-lg"
                >
                  Return to Course Content
                </button>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQ];

  // ── CODING test fork ──────────────────────────────────────────────────────────
  if (quiz.testType === "CODING") {
    return (
      <>
        {/* Hidden camera for proctoring — still active for coding tests */}
        <video
          ref={cameraRef}
          autoPlay
          muted
          playsInline
          className="fixed bottom-4 right-4 z-30 h-28 w-40 rounded-xl border border-richblack-600 bg-richblack-800 object-cover shadow-xl"
        />
        <CodingTestWorkspace
          questions={quiz.questions}
          testId={id}
          onSubmit={safeSubmitExam}
          isSubmitting={isSubmitting}
          timeLeft={timeLeft}
          formatTime={formatTime}
          timerColor={timerColor}
          isLow={isLow}
          isWarning={isWarning}
          warning={warning}
          codingSubmissions={codingSubmissionsInit}
        />
      </>
    );
  }

  // ── MCQ render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-8rem)] w-full rounded-xl border border-richblack-700 overflow-hidden bg-richblack-900 text-richblack-5 flex flex-col select-none shadow-lg">
      <video
        ref={cameraRef}
        autoPlay
        muted
        playsInline
        className="fixed bottom-4 right-4 z-30 h-28 w-40 rounded-xl border border-richblack-600 bg-richblack-800 object-cover shadow-xl"
      />

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
                onClick={() => { setShowConfirm(false); safeSubmitExam(); }}
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
