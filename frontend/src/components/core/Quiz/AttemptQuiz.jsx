import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { fetchQuizById, startQuizAttempt, submitQuiz } from "../../../services/operations/quizAPI";
import { setEntireCourseData } from "../../../slices/viewCourseSlice";
import useExamProctoring from "../../../hooks/useExamProctoring";
import useCameraProctor from "../../../proctoring/camera/useCameraProctor";
import useFaceMonitor from "../../../proctoring/camera/useFaceMonitor";
import useMicMonitor from "../../../proctoring/audio/useMicMonitor";
import CodingTestWorkspace from "../../Coding/CodingTestWorkspace";
import PostTestAnalysis from "./PostTestAnalysis";
import { getPostTestAnalysis } from "../../../services/operations/analysisApi";

import { ACCOUNT_TYPE } from "../../../utils/constants";

// ── constants & pure helpers ───────────────────────────────────────────────────
const DEFAULT_ALLOWED_TIME_SECONDS = 10 * 60;

const getSessionStorageKey = (testId) => `test-attempt-session:${testId}`;
const getProctorStorageKey = (testId) => `examProctorState:${testId}`;
const getProgressStorageKey = (testId) => `test-attempt-progress:${testId}`;

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

const getStoredAttemptProgress = (key, attemptSessionToken, questionCount) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.attemptSessionToken !== attemptSessionToken) return null;
    if (!Array.isArray(parsed?.answers) || parsed.answers.length !== questionCount) return null;

    const answers = parsed.answers.map((answer) =>
      Number.isInteger(answer) && answer >= 0 ? answer : null,
    );
    const currentQ =
      Number.isInteger(parsed?.currentQ) &&
      parsed.currentQ >= 0 &&
      parsed.currentQ < questionCount
        ? parsed.currentQ
        : 0;
    const visited = Array.isArray(parsed?.visited)
      ? parsed.visited.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < questionCount)
      : [0];

    return {
      answers,
      currentQ,
      visited: visited.length ? visited : [0],
    };
  } catch {
    return null;
  }
};

const storeAttemptProgress = (key, data) =>
  sessionStorage.setItem(key, JSON.stringify(data));

const clearAttemptProgress = (key) => sessionStorage.removeItem(key);

const getTimeTakenSeconds = (startTime) =>
  Math.max(Math.floor((Date.now() - startTime) / 1000), 0);

const formatTime = (seconds) => {
  const s = Math.max(seconds, 0);
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
};

const generateDeviceId = () => {
  try {
    let deviceId = localStorage.getItem("sarthi_device_id");
    if (!deviceId) {
      deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("sarthi_device_id", deviceId);
    }
    return deviceId;
  } catch (e) {
    // Fallback to stable fingerprint if localStorage is disabled
    const fingerprint =
      navigator.userAgent +
      (navigator.hardwareConcurrency || "unknown") +
      (navigator.deviceMemory || "unknown") +
      navigator.platform;
    return btoa(fingerprint);
  }
};

const getInitialExamTabId = () => {
  try {
    const takeoverTabId = sessionStorage.getItem("pendingExamTabId");
    if (takeoverTabId) {
      sessionStorage.removeItem("pendingExamTabId");
      return takeoverTabId;
    }
  } catch {
    // Storage can fail in restrictive browser modes; fall back safely.
  }

  return `exam-tab-${Date.now()}-${Math.random()}`;
};

// ── UI Components ─────────────────────────────────────────────────────────────

const RadialTimer = memo(({ timeLeft, totalTime, colorClass }) => {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, timeLeft / totalTime));
  const offset = circumference - progress * circumference;

  const isUrgent = timeLeft < 120; // 2 minutes
  const isExtreme = timeLeft < 30; // 30 seconds

  return (
    <div className={`relative flex items-center justify-center w-16 h-16 md:w-20 md:h-20 transition-all duration-500 hover:scale-105 
      ${isExtreme ? 'animate-[shake_0.5s_infinite]' : ''}`}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      `}</style>
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="50%" cy="50%" r={radius}
          className="stroke-richblack-700/50 fill-none"
          strokeWidth="3.5"
        />
        <circle
          cx="50%" cy="50%" r={radius}
          className={`fill-none transition-all duration-1000 ease-linear ${colorClass.includes("red") ? "stroke-red-500/80" : colorClass.includes("amber") ? "stroke-amber-400/80" : "stroke-emerald-400/80"} ${isUrgent ? 'animate-pulse' : ''}`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={`absolute inset-0 flex flex-col items-center justify-center font-mono font-medium leading-none ${colorClass} ${isUrgent ? 'animate-pulse' : ''}`}>
        <span className="text-sm md:text-base">{formatTime(timeLeft)}</span>
      </div>
    </div>
  );
});

const ToastWarning = memo(({ toast }) => {
  if (!toast) return null;
  const { level, message } = toast;
  
  const config = {
    1: { bg: "bg-amber-500/5 border-amber-500/20", text: "text-amber-400/90", icon: "👀" },
    2: { bg: "bg-orange-500/5 border-orange-500/20", text: "text-orange-400/90", icon: "⚠️" },
    3: { bg: "bg-red-500/5 border-red-500/30", text: "text-red-500/90", icon: "🚨" },
  };
  const ui = config[level] || config[2];

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-lg transition-all duration-500 animate-fadeIn">
      <div className={`backdrop-blur-xl border px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-4 ${ui.bg}`}>
        <span className="text-xl">{ui.icon}</span>
        <p className={`text-sm font-medium tracking-tight ${ui.text}`}>{message}</p>
      </div>
    </div>
  );
});

const SystemStatusBar = memo(({ status, integrityScore }) => {
  // Use sentence case for status
  const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  
  const isHealthy = integrityScore > 80;
  const isWarning = integrityScore <= 80 && integrityScore > 50;
  
  return (
    <div className={`w-full py-2 px-6 flex items-center justify-between text-[10px] font-bold tracking-widest border-b z-50 relative transition-colors duration-700
      ${isHealthy ? 'bg-richblack-900 border-richblack-800 text-richblack-300' : 
        isWarning ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' : 
        'bg-red-500/5 border-red-500/20 text-red-500'}`}>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2">
           <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] animate-pulse ${isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-amber-400' : 'bg-red-500'}`}></span>
           {normalizedStatus}
        </span>
      </div>
      <div className="flex items-center gap-4 opacity-70">
        <span>Integrity score: {integrityScore}%</span>
      </div>
    </div>
  );
});

const SystemCheckWizard = ({ quiz, durationMins, onComplete, warning, videoRef, requestAccess, requestMicAccess }) => {
  const [step, setStep] = useState(0);
  const [mediaStatus, setMediaStatus] = useState("pending"); // Combined Camera + Mic
  const [netStatus, setNetStatus] = useState("pending");
  
  const checkMedia = async () => {
    setMediaStatus("verifying");
    try {
      const cameraStream = await requestAccess();
      await new Promise((res) => setTimeout(res, 250));
      const micStream = await requestMicAccess();

      if (cameraStream && micStream) {
        setMediaStatus("success");
        setStep(2);
        checkNetwork();
        return;
      }

      setMediaStatus("failed");
    } catch (err) {
      console.error("Permission denied or media error:", err);
      setMediaStatus("failed");
    }
  };

  const checkNetwork = () => {
    const isOnline = navigator.onLine;
    if (isOnline) {
      setNetStatus("success");
      setTimeout(() => setStep(3), 1000);
    } else {
      setNetStatus("failed");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center bg-richblack-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-richblack-800 to-richblack-900 p-4 md:p-10 overflow-y-auto">
      <div className="w-full max-w-3xl bg-black border border-richblack-700 rounded-[2rem] shadow-2xl overflow-hidden animate-fadeIn my-auto">
        
        <div className="bg-richblack-800/50 p-8 text-center border-b border-richblack-700 shadow-inner">
          <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
            Security Checkpoint
          </span>
          <h1 className="text-3xl font-black text-white italic">{quiz?.title}</h1>
        </div>

        <div className={`${step === 3 ? "p-8 pb-36" : "p-10"}`}>
          {step === 0 && (
             <div className="text-center animate-fadeIn">
                <div className="w-20 h-20 mx-auto bg-richblack-800 border-2 border-richblack-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-xl">🛡️</div>
                <h2 className="text-xl font-bold text-white mb-4">Sarthi proctoring engine</h2>
                <p className="text-richblack-300 mb-8 max-w-lg mx-auto font-medium leading-relaxed">
                  Before we begin, we must verify your environment. This ensures a fair, uninterrupted assessment for all candidates.
                </p>
                <div className="flex justify-center">
                  <button onClick={() => { setStep(1); checkMedia(); }} className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-richblack-100 hover:scale-105 active:scale-95 transition-all shadow-xl">
                    Initialize system check
                  </button>
                </div>
             </div>
          )}

          {step === 1 && (
             <div className="text-center animate-fadeIn">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl mb-6 ${mediaStatus === 'failed' ? 'bg-red-500/10 border border-red-500' : 'bg-amber-500/10 border border-amber-500 animate-pulse shadow-[0_0_20px_rgba(251,191,36,0.2)]'}`}>
                   {mediaStatus === 'failed' ? '❌' : '🎬'}
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Media & sensors</h2>
                <p className="text-richblack-400 text-sm mb-6">Requesting camera and microphone access...</p>
                {mediaStatus === 'failed' && (
                  <div className="flex flex-col items-center gap-4">
                    <button onClick={checkMedia} className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl active:scale-95 transition-all">Retry access</button>
                    <p className="text-[10px] text-richblack-500 max-w-xs italic">
                       Brave User? You may need to disable "Shields" or allow Fingerprinting in your browser settings for this site.
                    </p>
                  </div>
                )}
             </div>
          )}

          {step === 2 && (
             <div className="text-center animate-fadeIn">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl mb-6 ${netStatus === 'failed' ? 'bg-red-500/10 border border-red-500' : 'bg-emerald-500/10 border border-emerald-500 animate-pulse'}`}>
                   {netStatus === 'failed' ? '❌' : '🌐'}
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Network link</h2>
                <p className="text-richblack-400 text-sm mb-6">Verifying your internet stability for secure data sync.</p>
                {netStatus === 'failed' && (
                  <button onClick={checkNetwork} className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl mt-4 active:scale-95 transition-all">Retry link</button>
                )}
             </div>
          )}

          {step === 3 && (
             <div className="text-center animate-fadeIn">
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl mb-6 bg-emerald-500/10 border border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                   ✅
                </div>
                <h2 className="text-2xl font-bold text-emerald-400 mb-2">System verified</h2>
                <p className="text-richblack-400 text-sm mb-6 font-medium">All sensors and network links are secure. Verify your camera below:</p>

                {/* Camera Preview in Wizard */}
                <div className="mb-8 max-w-sm mx-auto aspect-video bg-richblack-900 rounded-2xl border-2 border-richblack-700 overflow-hidden relative shadow-2xl">
                   <video 
                     ref={videoRef} 
                     autoPlay 
                     muted 
                     playsInline 
                     className="w-full h-full object-cover scale-x-[-1]" 
                   />
                   <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-full border border-white/10">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-white font-bold tracking-widest uppercase">Live Preview</span>
                   </div>
                </div>

                
                {warning && (
                  <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-bounce">
                    {warning}
                  </div>
                )}

                <p className="text-xs text-richblack-500 font-semibold">
                  Use the highlighted action bar at the bottom to start the test.
                </p>
             </div>
          )}
        </div>
      </div>

      {step === 3 && (
        <div className="fixed bottom-0 left-0 right-0 z-[120] border-t-4 border-yellow-300 bg-black/95 px-4 py-4 shadow-[0_-20px_80px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border-2 border-yellow-300 bg-yellow-300 p-3 text-black shadow-[0_0_45px_rgba(253,224,71,0.55)] sm:flex-row sm:items-center sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-sm font-black uppercase tracking-[0.2em]">Ready to begin</p>
              <p className="text-xs font-bold opacity-80">Press the button below. The exam will enter fullscreen and start.</p>
            </div>
            <button
              type="button"
              onClick={onComplete}
              className="rounded-xl bg-black px-8 py-4 text-base font-black uppercase tracking-widest text-yellow-300 shadow-xl transition-all hover:scale-[1.02] hover:bg-richblack-900 active:scale-95"
            >
              Start Test Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ProctorPanel = memo(({ videoRef, faceDetected, isCentered, isCameraActive, isMicActive }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[60] w-56 bg-richblack-900 border border-richblack-700 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
         <div className="bg-richblack-800/50 px-4 py-2.5 border-b border-richblack-700 flex justify-between items-center">
            <span className="text-[10px] font-bold tracking-widest text-richblack-400">Live proctor feed</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
         </div>
         
         <div className="p-2">
           <div className="relative rounded-xl overflow-hidden border border-richblack-800 bg-black aspect-video shadow-inner">
             <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
             
             {!faceDetected && (
               <div className="absolute inset-0 bg-red-900/20 backdrop-blur-[1px] flex items-center justify-center">
                  <span className="text-[10px] font-black text-red-400 bg-black/60 px-2 py-1 rounded">Face lost</span>
               </div>
             )}
           </div>
         </div>

         {/* Status Badges - Real Data Bound */}
         <div className="px-4 pb-4 flex justify-between gap-2">
            <div className="flex flex-col flex-1">
              <span className="text-[8px] font-bold text-richblack-600 tracking-wider">Face presence</span>
              <span className={`text-[10px] font-bold flex items-center gap-1.5 mt-0.5 ${faceDetected ? 'text-emerald-400' : 'text-red-400'}`}>
                <span className="text-[8px]">{faceDetected ? '✅' : '🚫'}</span> 
                {faceDetected ? 'Secure' : 'Not detected'}
              </span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-[8px] font-bold text-richblack-600 tracking-wider">Gaze focus</span>
              <span className={`text-[10px] font-bold flex items-center gap-1.5 mt-0.5 ${isCentered ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className="text-[8px]">{isCentered ? '🎯' : '⚠️'}</span>
                {isCentered ? 'Optimal' : 'Looking away'}
              </span>
            </div>
         </div>

         <div className="px-4 pb-4 flex justify-between gap-2 border-t border-richblack-800">
            <div className="flex flex-col flex-1 pt-3">
              <span className="text-[8px] font-bold text-richblack-600 tracking-wider">Camera</span>
              <span className={`text-[10px] font-bold mt-0.5 ${isCameraActive ? "text-emerald-400" : "text-red-400"}`}>
                {isCameraActive ? "Connected" : "Offline"}
              </span>
            </div>
            <div className="flex flex-col flex-1 pt-3">
              <span className="text-[8px] font-bold text-richblack-600 tracking-wider">Mic</span>
              <span className={`text-[10px] font-bold mt-0.5 ${isMicActive ? "text-emerald-400" : "text-red-400"}`}>
                {isMicActive ? "Connected" : "Offline"}
              </span>
            </div>
         </div>
    </div>
  );
});

// ── component ──────────────────────────────────────────────────────────────────
export default function AttemptQuiz() {
  const { courseId, id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
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
  const [showTabLockModal, setShowTabLockModal] = useState(false);

  // ── Product-Level Proctoring State ──
  const [integrityScore, setIntegrityScore] = useState(100);
  const [systemStatus, setSystemStatus] = useState("Monitoring Active");
  const [toastWarning, setToastWarning] = useState(null);
  const [showPreSubmitWarning, setShowPreSubmitWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [submitCountdown, setSubmitCountdown] = useState(10);
  const [attemptsExhausted, setAttemptsExhausted] = useState(false);
  const [mediaAccessGranted, setMediaAccessGranted] = useState(false);
  const [preflightCameraReady, setPreflightCameraReady] = useState(false);
  const [preflightMicReady, setPreflightMicReady] = useState(false);

  const hasSubmittedRef  = useRef(false);
  const submitHandlerRef = useRef(null);
  const tabIdRef = useRef(getInitialExamTabId());
  const preflightCameraStreamRef = useRef(null);
  const preflightMicStreamRef = useRef(null);

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
  const [cameraNode, setCameraNode] = useState(null);
  const [wizardPreviewNode, setWizardPreviewNode] = useState(null);
  const [panelPreviewNode, setPanelPreviewNode] = useState(null);
  const captureVideoRef = useCallback((node) => {
    setCameraNode(node);
  }, []);
  const wizardPreviewRef = useCallback((node) => {
    setWizardPreviewNode(node);
  }, []);
  const panelPreviewRef = useCallback((node) => {
    setPanelPreviewNode(node);
  }, []);
  const storageKey = getSessionStorageKey(id);
  const proctorStorageKey = getProctorStorageKey(id);
  const progressStorageKey = getProgressStorageKey(id);
  const examTabStorageKey = id && user?._id ? `exam-tab-lock:${id}:${user._id}` : id ? `exam-tab-lock:${id}:anon` : null;

  const handleSystemStatus = useCallback((statusMsg) => {
    setSystemStatus(statusMsg);
  }, []);

  const handleViolationLevel = useCallback((level, message, currentScore) => {
    setIntegrityScore(currentScore);
    
    if (level >= 1 && level <= 3) {
      setToastWarning({ message, level });
      setTimeout(() => setToastWarning(null), 4000);
    }
    
    if (level >= 4) {
      setShowPreSubmitWarning(true);
      setSubmitCountdown(10);
    }
  }, []);

  const { emitViolation, emitWarning, enterFullscreen, exitFullscreen, getViolationReports } = useExamProctoring({
    isEnabled: hasStartedExam && !isSubmitted && !isSubmitting,
    storageKey: proctorStorageKey,
    examSessionActive: hasStartedExam && !isSubmitted && !isSubmitting,
    hasStartedExam,
    isSubmitted,
    onSystemStatus: handleSystemStatus,
    onViolationLevel: handleViolationLevel,
    onFullscreenChange: (isFull) => {
      setIsFullscreen(isFull);
    },
  });

  // Enable fullscreen detection even before the test starts to allow auto-start
  useEffect(() => {
    if (hasStartedExam || isSubmitted) return;

    const handleInitialFullscreen = () => {
      if (document.fullscreenElement) {
        setIsFullscreen(true);
        // If they are already in fullscreen and on the verification screen (likely after a reload or manual F11)
        // we can let them start, but we usually wait for the wizard to reach step 3.
      } else {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleInitialFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleInitialFullscreen);
  }, [hasStartedExam, isSubmitted]);

  const releaseExamTabLock = () => {
    if (!examTabStorageKey) return;

    const activeTab = localStorage.getItem(examTabStorageKey);
    if (activeTab === tabIdRef.current) {
      localStorage.removeItem(examTabStorageKey);
    }
  };

  // ── submit logic ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!attemptSessionToken || !startTime || !quiz) return;
    setIsSubmitting(true);
    try {
      const isCoding = quiz.testType === "CODING";
      const res = await submitQuiz(
        {
          quizId: id,
          ...(isCoding ? {} : { answers }),
          tabSwitchCount,
          attemptSessionToken,
          deviceId: deviceIdRef.current,
          timeTaken: getTimeTakenSeconds(startTime),
          integrityScore,
          violationLogs: getViolationReports ? getViolationReports() : [],
        },
        token
      );
      if (res?.score !== undefined) {
        if (quiz?.questions) {
          quiz.questions.forEach(q => {
            if (q.problemId?._id) {
              localStorage.removeItem(`exam_${id}_${q.problemId._id}`);
            }
          });
        }

        clearAttemptSession(storageKey);
        clearAttemptProgress(progressStorageKey);
        sessionStorage.removeItem(proctorStorageKey);
        releaseExamTabLock();
        setHasStartedExam(false);
        setMediaAccessGranted(false);
        setPreflightCameraReady(false);
        setPreflightMicReady(false);
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
        clearAttemptProgress(progressStorageKey);
        sessionStorage.removeItem(proctorStorageKey);
        setMediaAccessGranted(false);
        setPreflightCameraReady(false);
        setPreflightMicReady(false);
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

  // Pre-Submit Countdown Driver
  useEffect(() => {
    if (!showPreSubmitWarning) return;
    if (submitCountdown <= 0) {
       safeSubmitExam();
       return;
    }
    const timer = setTimeout(() => setSubmitCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [showPreSubmitWarning, submitCountdown]);

  const { isActive: isCameraActive, stream: cameraStream } = useCameraProctor({
    isEnabled: !isSubmitted && !!quiz,
    videoElement: cameraNode,
    autoStart: hasStartedExam,
    emitViolation,
    onCameraError: (err) => {
      console.error("Proctoring Camera Failure:", err);
      emitViolation("CAMERA_DISABLED");
    },
  });

  const handleExit = () => {
    setShowTabLockModal(false);
    navigate(user?.accountType === ACCOUNT_TYPE.STUDENT ? "/dashboard/enrolled-courses" : "/dashboard/my-profile", { replace: true });
  };

  const handleTakeOver = () => {
    if (examTabStorageKey) {
      try {
        sessionStorage.setItem("pendingExamTabId", tabIdRef.current);
      } catch {
        // Ignore sessionStorage failures here; takeover still attempts reload.
      }
      localStorage.setItem(examTabStorageKey, tabIdRef.current);
      setShowTabLockModal(false);
      window.location.reload(); // Re-mount with fresh lock
    }
  };

  const { faceDetected, isCentered } = useFaceMonitor({
    videoElement: cameraNode,
    isEnabled: hasStartedExam && !isSubmitted && isCameraActive,
    emitViolation,
    emitWarning,
  });

  const { micActive: isMicActive } = useMicMonitor({
    isEnabled: !isSubmitted && !!quiz,
    autoStart: hasStartedExam,
    emitWarning,
  });

  useEffect(() => {
    [wizardPreviewNode, panelPreviewNode].forEach((node) => {
      if (!node) return;
      node.srcObject = cameraStream || null;
    });
  }, [cameraStream, panelPreviewNode, wizardPreviewNode]);

  useEffect(() => {
    if (hasStartedExam) return;

    const preflightStream = preflightCameraStreamRef.current;
    if (!preflightStream) return;

    [wizardPreviewNode, panelPreviewNode].forEach((node) => {
      if (!node || node.srcObject === preflightStream) return;
      node.srcObject = preflightStream;
    });
  }, [hasStartedExam, panelPreviewNode, wizardPreviewNode, preflightCameraReady]);

  const requestCameraAccess = useCallback(async () => {
    if (!window.isSecureContext) {
      throw new Error("Camera access requires HTTPS or localhost.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support camera access.");
    }

    if (preflightCameraStreamRef.current?.active) {
      setPreflightCameraReady(true);
      setMediaAccessGranted(preflightMicReady || true);
      [wizardPreviewNode, panelPreviewNode].forEach((node) => {
        if (node) {
          node.srcObject = preflightCameraStreamRef.current;
        }
      });
      return preflightCameraStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });

    preflightCameraStreamRef.current = stream;
    [wizardPreviewNode, panelPreviewNode].forEach((node) => {
      if (node) {
        node.srcObject = stream;
      }
    });
    setPreflightCameraReady(true);
    setMediaAccessGranted(true);
    return stream;
  }, [panelPreviewNode, preflightMicReady, wizardPreviewNode]);

  const requestMicrophoneAccess = useCallback(async () => {
    if (!window.isSecureContext) {
      throw new Error("Microphone access requires HTTPS or localhost.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support microphone access.");
    }

    if (preflightMicStreamRef.current?.active) {
      setPreflightMicReady(true);
      setMediaAccessGranted(preflightCameraReady || true);
      return preflightMicStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    preflightMicStreamRef.current = stream;
    setPreflightMicReady(true);
    setMediaAccessGranted(true);
    return stream;
  }, [preflightCameraReady]);

  useEffect(() => {
    if (!hasStartedExam && !isSubmitted) return;

    if (preflightCameraStreamRef.current) {
      preflightCameraStreamRef.current.getTracks().forEach((track) => track.stop());
      preflightCameraStreamRef.current = null;
    }

    if (preflightMicStreamRef.current) {
      preflightMicStreamRef.current.getTracks().forEach((track) => track.stop());
      preflightMicStreamRef.current = null;
    }
  }, [hasStartedExam, isSubmitted]);

  useEffect(() => {
    return () => {
      if (preflightCameraStreamRef.current) {
        preflightCameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (preflightMicStreamRef.current) {
        preflightMicStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Mark each question as visited when navigated to
  useEffect(() => {
    setVisited((prev) => new Set([...prev, currentQ]));
  }, [currentQ]);

  useEffect(() => {
    if (!hasStartedExam || isSubmitted || isSubmitting || !attemptSessionToken || !quiz) return;
    const isCodingTest = quiz.testType === "CODING" || quiz.type === "CODING";
    if (isCodingTest || answers.length !== quiz.questions.length) return;

    storeAttemptProgress(progressStorageKey, {
      attemptSessionToken,
      answers,
      currentQ,
      visited: Array.from(visited),
      updatedAt: Date.now(),
    });
  }, [
    answers,
    attemptSessionToken,
    currentQ,
    hasStartedExam,
    isSubmitted,
    isSubmitting,
    progressStorageKey,
    quiz,
    visited,
  ]);

  useEffect(() => {
    if (!examTabStorageKey || !isTabCheckRequired || isSubmitted) return;

    const existingTab = localStorage.getItem(examTabStorageKey);

    if (existingTab && existingTab !== tabIdRef.current) {
      setShowTabLockModal(true);
      return;
    }

    localStorage.setItem(examTabStorageKey, tabIdRef.current);

    const handleStorageChange = (event) => {
      if (event.key !== examTabStorageKey) return;
      if (event.newValue && event.newValue !== tabIdRef.current) {
        setShowTabLockModal(true);
      }
    };

    const handleBeforeUnload = () => {
      const activeTab = localStorage.getItem(examTabStorageKey);
      if (activeTab === tabIdRef.current) {
        localStorage.removeItem(examTabStorageKey);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      const activeTab = localStorage.getItem(examTabStorageKey);
      if (activeTab === tabIdRef.current) {
        localStorage.removeItem(examTabStorageKey);
      }
    };
  }, [examTabStorageKey, isTabCheckRequired, isSubmitted]);


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
          const alreadyPassed = p?.passed === true;
          // Backend sends totalQuestions in TestResult; normalize to 'total' for display consistency
          const rawTotal = p?.totalQuestions ?? p?.total ?? res?.quiz?.questions?.length ?? 0;
          const scoreValue = p?.score ?? 0;
          const totalValue = rawTotal;

          setSubmitResult({
            score:       scoreValue,
            total:       totalValue,
            passed:      alreadyPassed,
            percentage:  p?.percentage ?? (totalValue > 0 ? Math.round((scoreValue / totalValue) * 100) : 0),
            details:     p?.studentAnswers || p?.details || [],
            codingSubmissions: p?.codingSubmissions || [],
            attemptsLeft: 0,
          });
           if (res?.quiz) setQuiz(res.quiz);
          setIsSubmitted(alreadyPassed);
          setAttemptsExhausted(!alreadyPassed);
          setHasStartedExam(false);
          setIsTabCheckRequired(false);
          setMediaAccessGranted(false);
          setPreflightCameraReady(false);
          setPreflightMicReady(false);
          clearAttemptSession(storageKey);
          clearAttemptProgress(progressStorageKey);
          sessionStorage.removeItem(proctorStorageKey);
          releaseExamTabLock();
          
          // Terminal result/limit states must never enter the proctoring wizard.
          if (examTabStorageKey) {
            localStorage.removeItem(examTabStorageKey);
          }
          return;
        }

        setIsTabCheckRequired(true);

        if (!res?.quiz) { setError("Failed to fetch test."); return; }

        const serverSecs =
          Number.isInteger(res.allowedTimeSeconds) && res.allowedTimeSeconds > 0
            ? res.allowedTimeSeconds : DEFAULT_ALLOWED_TIME_SECONDS;
        const stored = getStoredAttemptSession(storageKey);
        const serverSession =
          res.activeAttempt && typeof res.startTime === "number" && res.attemptSessionToken
            ? {
                startTime: res.startTime,
                allowedTimeSeconds: serverSecs,
                attemptSessionToken: res.attemptSessionToken,
              }
            : null;
        const active =
          stored?.attemptSessionToken && stored.allowedTimeSeconds === serverSecs
            ? stored
            : serverSession;

        if (active?.attemptSessionToken) storeAttemptSession(storageKey, active);

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

        const hasRecoverableAttempt = !!active?.attemptSessionToken && !!active?.startTime;
        const isCodingTest = res.quiz.testType === "CODING" || res.quiz.type === "CODING";
        const restoredProgress =
          hasRecoverableAttempt && !isCodingTest
            ? getStoredAttemptProgress(
                progressStorageKey,
                active.attemptSessionToken,
                res.quiz.questions.length,
              )
            : null;

        setError(""); setWarning(""); setIsSubmitting(false); setTabSwitchCount(0);
        setQuiz(res.quiz);
        setAnswers(restoredProgress?.answers ?? Array(res.quiz.questions.length).fill(null));
        setCurrentQ(restoredProgress?.currentQ ?? 0);
        setVisited(new Set(restoredProgress?.visited ?? [0]));
        setAttemptSessionToken(active?.attemptSessionToken || "");
        setStartTime(active?.startTime || null);
        setAllowedTimeSeconds(active?.allowedTimeSeconds || serverSecs);
        setHasStartedExam(hasRecoverableAttempt && (restoredHasStartedExam || !!res.activeAttempt));
        setMediaAccessGranted(hasRecoverableAttempt && (restoredHasStartedExam || !!res.activeAttempt));
        setPreflightCameraReady(hasRecoverableAttempt && (restoredHasStartedExam || !!res.activeAttempt));
        setPreflightMicReady(hasRecoverableAttempt && (restoredHasStartedExam || !!res.activeAttempt));
        // Restore per-problem coding state (runCount, status) so the UI is
        // accurate after a page reload or session resume.
        if (Array.isArray(res.codingSubmissions)) {
          setCodingSubmissionsInit(res.codingSubmissions);
        }
        const elapsed = active?.startTime ? getTimeTakenSeconds(active.startTime) : 0;
        setTimeLeft(Math.max((active?.allowedTimeSeconds || serverSecs) - elapsed, 0));
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
      const remaining = Math.max(allowedTimeSeconds - getTimeTakenSeconds(startTime), 0);
      setTimeLeft(remaining);
      
      // Auto-submit when time is up
      if (remaining === 0 && !hasSubmittedRef.current && !isSubmitted) {
        console.log("Time is up. Auto-submitting test...");
        safeSubmitExam();
        clearInterval(tick);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [startTime, allowedTimeSeconds, isSubmitted, safeSubmitExam]);


  const handleStartTest = async () => {
    if (!mediaAccessGranted || !preflightCameraReady || !preflightMicReady) {
      setWarning("Camera and microphone access are required before the test can start.");
      return;
    }

    try {
      const didEnterFullscreen = await enterFullscreen();
      if (!didEnterFullscreen) {
        setWarning("Fullscreen is required to start the test.");
        return;
      }

      let activeSession = {
        attemptSessionToken,
        startTime,
        allowedTimeSeconds,
      };
      let startRes = null;

      if (!activeSession.attemptSessionToken || !activeSession.startTime) {
        startRes = await startQuizAttempt(
          {
            quizId: id,
            deviceId: deviceIdRef.current,
          },
          token,
        );

        activeSession = {
          attemptSessionToken: startRes?.attemptSessionToken || "",
          startTime: typeof startRes?.startTime === "number" ? startRes.startTime : Date.now(),
          allowedTimeSeconds:
            Number.isInteger(startRes?.allowedTimeSeconds) && startRes.allowedTimeSeconds > 0
              ? startRes.allowedTimeSeconds
              : allowedTimeSeconds,
        };
      }

      if (!activeSession.attemptSessionToken || !activeSession.startTime) {
        setWarning("Unable to start the test session. Please retry the system check.");
        return;
      }

      storeAttemptSession(storageKey, activeSession);
      if (startRes?.quiz?.questions?.length) {
        clearAttemptProgress(progressStorageKey);
        setQuiz(startRes.quiz);
        setAnswers(Array(startRes.quiz.questions.length).fill(null));
        setCurrentQ(0);
        setVisited(new Set([0]));
      }
      setAttemptSessionToken(activeSession.attemptSessionToken);
      setStartTime(activeSession.startTime);
      setAllowedTimeSeconds(activeSession.allowedTimeSeconds);
      setTimeLeft(activeSession.allowedTimeSeconds);
      setWarning("");
      setHasStartedExam(true);
    } catch (err) {
      console.error("Failed to start test attempt:", err);
      const blocked = err?.response?.data;
      if (blocked?.canAttempt === false) {
        await exitFullscreen();
        const p = blocked.previousResult;
        const alreadyPassed = blocked.reason === "PASSED" || p?.passed === true;
        const totalValue = p?.totalQuestions ?? p?.total ?? quiz?.questions?.length ?? 0;
        const scoreValue = p?.score ?? 0;

        setSubmitResult({
          score: scoreValue,
          total: totalValue,
          passed: alreadyPassed,
          percentage: p?.percentage ?? (totalValue > 0 ? Math.round((scoreValue / totalValue) * 100) : 0),
          details: p?.studentAnswers || p?.details || [],
          codingSubmissions: p?.codingSubmissions || [],
          attemptsLeft: 0,
        });
        setIsSubmitted(alreadyPassed);
        setAttemptsExhausted(!alreadyPassed);
        setHasStartedExam(false);
        setIsTabCheckRequired(false);
        setMediaAccessGranted(false);
        setPreflightCameraReady(false);
        setPreflightMicReady(false);
        clearAttemptSession(storageKey);
        clearAttemptProgress(progressStorageKey);
        sessionStorage.removeItem(proctorStorageKey);
        releaseExamTabLock();
        setWarning("");
        return;
      }
      await exitFullscreen();
      setWarning(err?.response?.data?.message || "Unable to start the test session. Please try again.");
    }
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

  if (!hasStartedExam && !isSubmitted && !attemptsExhausted && !submitResult?.passed) {
    const durationMins = Math.floor(allowedTimeSeconds / 60);

    return (
      <SystemCheckWizard
        quiz={quiz}
        durationMins={durationMins}
        onComplete={handleStartTest}
        warning={warning}
        videoRef={wizardPreviewRef}
        requestAccess={requestCameraAccess}
        requestMicAccess={requestMicrophoneAccess}
      />
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
          <div className={`rounded-2xl border overflow-hidden bg-black
            ${passed 
              ? "border-emerald-500/30 shadow-[0_0_80px_-15px_rgba(16,185,129,0.15)]" 
              : "border-red-500/30 shadow-[0_0_80px_-15px_rgba(239,68,68,0.15)]"}`}>

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

  // ── Submitting screen (Prevents blanking / mid-render crashes) ──
  if (isSubmitting) {
    return (
      <div className="h-[calc(100vh-8rem)] w-full rounded-xl border border-richblack-700 bg-richblack-900 flex flex-col items-center justify-center p-6 shadow-lg">
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-xl font-bold animate-pulse text-yellow-500 tracking-wider">Securely Submitting Exam...</p>
        <p className="mt-2 text-sm text-richblack-400">Please do not close this tab or leave fullscreen.</p>
      </div>
    );
  }

  // ── PreSubmit Interrupt Screen (10-second warning) ──
  if (showPreSubmitWarning) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6 animate-fadeIn">
        <div className="max-w-2xl w-full text-center py-16 px-10 rounded-[3rem] bg-red-950/20 border-2 border-red-500 shadow-[0_0_100px_rgba(239,68,68,0.2)] relative overflow-hidden backdrop-blur-xl">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-500/20 blur-[120px] pointer-events-none" />
           <div className="relative z-10">
              <div className="w-24 h-24 rounded-full bg-red-500/10 border-4 border-red-500 flex items-center justify-center mx-auto mb-8 shadow-2xl">
                 <span className="text-4xl text-red-500 animate-pulse">🚨</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight uppercase drop-shadow-lg">Integrity Threshold Reached</h2>
              <p className="text-red-300 text-lg leading-relaxed mb-8 font-medium">
                  Your test is being auto-submitted due to repeated violations. 
                  Security protocols are now finalizing your attempt.
              </p>
              
              <div className="text-8xl font-black text-white italic mb-10 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] flex items-baseline justify-center gap-2">
                 {submitCountdown} <span className="text-2xl text-red-400 font-bold tracking-widest uppercase not-italic">Sec</span>
              </div>

              <div className="mt-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 inline-flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                 <span className="text-[11px] text-red-400 font-black uppercase tracking-[0.2em]">Automated Submission Enforced</span>
              </div>
           </div>
        </div>
      </div>
    );
  }

  // ── Fullscreen Lock Screen ──
  if (hasStartedExam && !isFullscreen && !isSubmitted) {
    return (
      <div className="fixed inset-0 z-[300] bg-black/98 flex items-center justify-center p-6 backdrop-blur-3xl animate-fadeIn">
        <div className="max-w-xl w-full text-center py-20 px-10 rounded-[3rem] bg-richblack-900 border-2 border-amber-500 shadow-[0_0_120px_rgba(245,158,11,0.2)]">
           <div className="w-20 h-20 rounded-full bg-amber-500/10 border-4 border-amber-500 flex items-center justify-center mx-auto mb-10 shadow-2xl">
              <span className="text-5xl text-amber-500 animate-pulse">⛶</span>
           </div>
           
           <h2 className="text-4xl font-black text-white mb-6 uppercase tracking-tight">Security Lock Active</h2>
           <p className="text-amber-200/70 text-lg leading-relaxed mb-12 font-medium">
              Examination integrity requires full-screen immersion. 
              Assessment content is locked until compliance is restored.
           </p>

           <button
              onClick={enterFullscreen}
              className="px-12 py-6 bg-amber-500 text-black font-black tracking-[0.2em] uppercase rounded-2xl hover:bg-amber-400 transition-all duration-300 shadow-2xl active:scale-95"
           >
              Restore Fullscreen
           </button>
           
           <div className="mt-12 text-[10px] text-richblack-500 font-black uppercase tracking-[0.3em]">
              Security Breach Attempt Logged
           </div>
        </div>
      </div>
    );
  }

  // ── Attempts Exhausted Screen ──
  if (attemptsExhausted && !isSubmitting) {
    return (
      <div className="min-h-screen bg-richblack-900 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-red-500/5 via-transparent to-transparent">
        <div className="max-w-2xl w-full text-center py-20 px-10 rounded-[3rem] bg-richblack-800 border-2 border-richblack-700 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
           
           <div className="relative z-10">
              <div className="w-24 h-24 rounded-full bg-red-500/10 border-4 border-red-500/20 flex items-center justify-center mx-auto mb-10 shadow-inner">
                 <span className="text-5xl">🚫</span>
              </div>
              
              <h2 className="text-4xl font-black text-white mb-6 uppercase tracking-tight">Attempt Limit Reached</h2>
              <p className="text-richblack-400 text-lg leading-relaxed mb-12 font-medium">
                 You have exhausted all available attempts for this assessment. 
                 Further attempts are strictly restricted to maintain evaluation integrity.
              </p>

              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-12">
                 <div className="bg-richblack-900 p-6 rounded-2xl border border-richblack-700">
                    <p className="text-3xl font-black text-white italic">{submitResult?.score || 0}</p>
                    <p className="text-[10px] text-richblack-500 font-black uppercase mt-1 tracking-widest">Best Score</p>
                 </div>
                 <div className="bg-richblack-900 p-6 rounded-2xl border border-richblack-700">
                    <p className="text-3xl font-black text-emerald-400 italic">{submitResult?.passed ? "PASSED" : "FAILED"}</p>
                    <p className="text-[10px] text-richblack-500 font-black uppercase mt-1 tracking-widest">Final Status</p>
                 </div>
              </div>

              <button
                 onClick={() => window.history.back()}
                 className="px-12 py-5 bg-white text-black font-black uppercase rounded-2xl hover:bg-richblack-200 transition-all duration-300 shadow-xl active:scale-95"
              >
                 Return to Course
              </button>
           </div>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQ];

  const isCoding = quiz.testType === "CODING" || quiz.type === "CODING";

  // ── Unified Security HUD Shell ──────────────────────────────────────────────
  return (
    <div className="h-screen w-full overflow-hidden bg-richblack-900 text-richblack-5 flex flex-col select-none shadow-lg">
      <video ref={captureVideoRef} autoPlay muted playsInline className="hidden" />
      <SystemStatusBar status={systemStatus} integrityScore={integrityScore} />
      <ToastWarning toast={toastWarning} />
      <ProctorPanel 
        videoRef={panelPreviewRef} 
        faceDetected={faceDetected} 
        isCentered={isCentered} 
        isCameraActive={isCameraActive}
        isMicActive={isMicActive}
      />

      {/* ── Shared Top Bar (Control Center) ─────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-richblack-800 shadow-2xl border-b border-richblack-700/50">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Unified Title */}
          <div className="flex flex-col gap-0.5 max-w-[40%]">
            <h1 className="font-black text-lg text-white truncate drop-shadow-sm">{quiz.title}</h1>
            <p className="text-[10px] text-richblack-400 font-bold uppercase tracking-widest">
              {quiz.testType.toLowerCase()} assessment
            </p>
          </div>

          {/* Unified Timer hub */}
          <div className="flex items-center">
            <RadialTimer 
              timeLeft={timeLeft} 
              totalTime={allowedTimeSeconds} 
              colorClass={timerColor} 
            />
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-6">
            {!isCoding && (
              <div className="hidden sm:flex flex-col items-end gap-0.5">
                <span className="text-white text-sm font-black">
                  {answeredCount} / {quiz.questions.length}
                </span>
                <span className="text-[9px] text-richblack-500 font-bold uppercase tracking-tighter">Answered</span>
              </div>
            )}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isSubmitting}
              className="group relative bg-yellow-50 text-richblack-900 font-black px-6 py-2.5 rounded-xl
                         hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 shadow-[0_0_20px_rgba(255,214,10,0.2)] hover:shadow-[0_0_30px_rgba(255,214,10,0.4)]"
            >
              <span className="relative z-10">{isSubmitting ? "Submitting…" : "Finish Test"}</span>
              <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
            </button>
          </div>
        </div>

        {/* Global Progress Strip (MCQ Only - Coding has internal problem tracking) */}
        {!isCoding && (
          <div className="h-0.5 bg-richblack-700 w-full relative">
            <div
              className="h-full bg-emerald-400 transition-all duration-700 ease-in-out shadow-[0_0_10px_rgba(52,211,153,0.8)]"
              style={{ width: `${(answeredCount / quiz.questions.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Main Workspace ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {isCoding ? (
          <div className="flex-1 relative overflow-hidden bg-richblack-900">
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
          </div>
        ) : (
          <>
            {/* ── Left: MCQ Panel ──────────────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto p-6 lg:p-10 bg-richblack-900 custom-scrollbar">
              <div className="mb-8 p-6 rounded-3xl bg-richblack-800/20 border border-richblack-700/30 shadow-[inset_0_0_40px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-3 mb-3">
                   <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-emerald-500/10">
                    Question {currentQ + 1}
                   </span>
                   <div className="h-px flex-1 bg-richblack-700/30" />
                </div>
                <p className="text-xl md:text-2xl font-bold text-white leading-relaxed">
                  {question.question}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {question.options.map((option, oIdx) => {
                  const selected = answers[currentQ] === oIdx;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => selectAnswer(currentQ, oIdx)}
                      className={`group relative overflow-hidden w-full text-left flex items-center gap-5 px-6 py-5 rounded-2xl border transition-all duration-500 ease-out active:scale-[0.98]
                        ${selected 
                          ? "bg-emerald-500/5 border-emerald-400/30 shadow-[0_0_30px_rgba(52,211,153,0.05)] ring-1 ring-emerald-500/10" 
                          : "bg-richblack-800/20 border-richblack-700 shadow-sm text-richblack-100 hover:bg-richblack-800/40 hover:border-richblack-600 hover:translate-x-1"}`}
                    >
                      {selected && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />}
                      <span className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black transition-all duration-500 shadow-xl
                        ${selected ? "bg-emerald-400 text-black scale-105" : "bg-richblack-900 text-richblack-500 group-hover:bg-richblack-700 group-hover:text-white"}`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className={`flex-1 text-base md:text-lg transition-all duration-300 ${selected ? "text-white font-bold" : "text-richblack-200"}`}>{option}</span>
                      
                      {/* Micro-interaction: Confirmation Tick */}
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-700 
                        ${selected ? "bg-emerald-400 border-emerald-400 scale-110 opacity-100 rotate-0" : "border-richblack-700 scale-50 opacity-0 -rotate-90"}`}>
                        <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mt-12 pt-8 border-t border-richblack-800">
                <button onClick={() => setCurrentQ((q) => Math.max(q - 1, 0))} disabled={currentQ === 0} className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-richblack-800 text-richblack-300 font-black uppercase text-xs tracking-widest hover:bg-richblack-700 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 border border-richblack-700 active:scale-95">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  Previous
                </button>
                <div className="flex gap-1.5">{Array.from({length: Math.min(quiz.questions.length, 5)}).map((_, i) => (<div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentQ % 5 ? "bg-emerald-400 w-4 transition-all" : "bg-richblack-700"}`} />))}</div>
                <button onClick={() => setCurrentQ((q) => Math.min(q + 1, quiz.questions.length - 1))} disabled={currentQ === quiz.questions.length - 1} className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-richblack-800 text-richblack-300 font-black uppercase text-xs tracking-widest hover:bg-richblack-700 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 border border-richblack-700 active:scale-95">
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </main>

            {/* ── Right: Sidebar Navigator ────────────────────────────────────── */}
            <aside className="w-72 shrink-0 bg-richblack-800/80 backdrop-blur-xl border-l border-richblack-700/50 overflow-y-auto p-6 hidden lg:flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <p className="text-richblack-400 text-[10px] font-black uppercase tracking-[0.25em]">Exam Map</p>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-10">
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <span className="text-emerald-400 text-lg font-black">{answeredCount}</span>
                  <span className="text-[9px] font-black uppercase text-richblack-400">Done</span>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/10">
                  <span className="text-yellow-400 text-lg font-black">{visited.size - answeredCount}</span>
                  <span className="text-[9px] font-black uppercase text-richblack-400">Visit</span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                {quiz.questions.map((_, idx) => (
                  <button key={idx} onClick={() => setCurrentQ(idx)} className={`aspect-square flex items-center justify-center rounded-xl text-xs font-black transition-all duration-300 ${idx === currentQ ? "bg-white text-black scale-110" : answers[idx] !== null ? "bg-emerald-500 text-black" : visited.has(idx) ? "bg-yellow-400 text-black" : "bg-richblack-900/50 text-richblack-600"}`}>
                    {idx + 1}
                  </button>
                ))}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* ── Modals (Universal) ───────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-richblack-800 border border-richblack-700 rounded-3xl shadow-2xl w-full max-w-md p-8 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-4xl mx-auto mb-4 border border-emerald-500/20">🏁</div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Final Submission?</h2>
              <p className="text-richblack-400 text-sm mt-1">Ready to commit your answers for {quiz.title}?</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowConfirm(false); safeSubmitExam(); }}
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg active:scale-95"
              >
                {isSubmitting ? "Submitting…" : "Confirm & Submit"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-full py-4 rounded-2xl bg-richblack-700 text-richblack-200 font-black uppercase tracking-widest hover:bg-richblack-600 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTabLockModal && (
        <div className="fixed inset-0 z-[200] bg-richblack-900 flex items-center justify-center p-6 animate-fadeIn">
            <div className="max-w-2xl w-full text-center py-16 px-10 rounded-[3rem] bg-richblack-800 border-2 border-red-500/30 relative">
                <div className="relative z-10 text-center">
                    <div className="w-24 h-24 rounded-full bg-red-500/10 border-4 border-red-500/20 flex items-center justify-center mx-auto mb-8"><span className="text-5xl text-red-500">🔒</span></div>
                    <h2 className="text-4xl font-black text-white mb-4 tracking-tight uppercase">Session Conflict</h2>
                    <p className="text-richblack-400 text-lg mb-12">Multi-tab assessment is strictly prohibited. Security protocol active.</p>
                    <div className="flex flex-col md:flex-row gap-4 justify-center">
                        <button onClick={handleTakeOver} className="px-10 py-5 bg-white text-black font-black uppercase rounded-2xl hover:bg-emerald-400 transition-all active:scale-95">Take Over Session</button>
                        <button onClick={handleExit} className="px-10 py-5 bg-richblack-700 text-richblack-200 font-black uppercase rounded-2xl hover:bg-red-500 hover:text-black transition-all active:scale-95">Abort & Exit</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
