import { useEffect, useRef, useCallback } from "react";

const violationMessages = {
  COPY: "Copying content during the test is not allowed.",
  PASTE: "Pasting content during the test is not allowed.",
  RIGHT_CLICK: "Right click is disabled during the test.",
  KEYBOARD_SHORTCUT: "Keyboard shortcuts are disabled during the test.",
  FULLSCREEN_EXIT: "Please stay in fullscreen mode during the test.",
  TAB_SWITCH: "Please do not switch tabs during the test.",
  WINDOW_BLUR: "Please remain focused on the test window.",
  DEVTOOLS: "Please close developer tools during the test.",
  CAMERA_DISABLED: "Camera access lost. Please keep your camera enabled during the test.",
  CAMERA_OBSTRUCTED: "Camera view is obstructed. Please ensure your face is visible.",
  FACE_MISSING: "Face not detected. Please stay in front of the camera.",
  MULTIPLE_FACES: "Multiple faces detected. Only one person is allowed during the test.",
  FACE_TOO_FAR: "You are too far from the camera. Please stay clearly visible.",
  MIC_ACTIVITY: "Unusual audio activity detected during the test.",
};

// Define explicit weights for different violations
const violationWeights = {
  COPY: 2, PASTE: 2, RIGHT_CLICK: 2, KEYBOARD_SHORTCUT: 2, FULLSCREEN_EXIT: 20, 
  TAB_SWITCH: 20, WINDOW_BLUR: 20, DEVTOOLS: 25,
  FACE_MISSING: 10, CAMERA_OBSTRUCTED: 10, CAMERA_DISABLED: 25, FACE_TOO_FAR: 10,
  MULTIPLE_FACES: 25, MIC_ACTIVITY: 15,
};

// Cooldown is now dynamic based on violation type

export default function useExamProctoring({
  onViolationLevel, // Callback receiving (level, message, integrityScore)
  onSystemStatus,   // Callback for passive status updates (type)
  onFullscreenChange, // Callback for fullscreen entry/exit
  isEnabled = true,
  storageKey = "",
  hasStartedExam = false,
  examSessionActive = false,
  isSubmitted = false,
} = {}) {
  const integrityScore = useRef(100);
  const violationCount = useRef(0);
  const violationLogs = useRef([]);
  const systemStatusRef = useRef("Monitoring Active");
  const totalRecoveredPointsRef = useRef(0);
  
  const lastViolationMapRef = useRef({});
  const globalLastViolationRef = useRef(Date.now());
  const lastUIPopupTimeRef = useRef(0);
  const shouldEnforceFullscreen = useRef(false);

  const persistState = useCallback(() => {
    if (!storageKey || isSubmitted) return;
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        examSessionActive,
        integrityScore: integrityScore.current,
        violationCount: violationCount.current,
        violationLogs: violationLogs.current,
        hasStartedExam,
        lastGlobalViolation: globalLastViolationRef.current,
        systemStatus: systemStatusRef.current,
        totalRecoveredPoints: totalRecoveredPointsRef.current,
      })
    );
  }, [examSessionActive, hasStartedExam, isSubmitted, storageKey]);

  useEffect(() => {
    if (!storageKey || isSubmitted || !examSessionActive) return;
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) {
      persistState();
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.examSessionActive === true) {
        if (typeof parsed?.integrityScore === "number") integrityScore.current = parsed.integrityScore;
        if (typeof parsed?.violationCount === "number") violationCount.current = parsed.violationCount;
        if (Array.isArray(parsed?.violationLogs)) violationLogs.current = parsed.violationLogs;
        if (typeof parsed?.lastGlobalViolation === "number") globalLastViolationRef.current = parsed.lastGlobalViolation;
        if (typeof parsed?.systemStatus === "string") {
          systemStatusRef.current = parsed.systemStatus;
          if (onSystemStatus) onSystemStatus(parsed.systemStatus);
        }
        if (typeof parsed?.totalRecoveredPoints === "number") totalRecoveredPointsRef.current = parsed.totalRecoveredPoints;
      }
    } catch {
      integrityScore.current = 100;
      violationCount.current = 0;
      violationLogs.current = [];
    }
    persistState();
  }, [examSessionActive, hasStartedExam, isSubmitted, storageKey, persistState]);

  useEffect(() => {
    if (!storageKey) return;
    if (isSubmitted || !examSessionActive) {
      sessionStorage.removeItem(storageKey);
      return;
    }
    persistState();
  }, [examSessionActive, hasStartedExam, isSubmitted, storageKey, persistState]);

  const processEvent = useCallback((type) => {
    if (!isEnabled) return;
    const now = Date.now();
    
    // Per-type cooldown check (20s for Hard, 10s for Soft)
    const hardViolations = ["TAB_SWITCH", "WINDOW_BLUR", "DEVTOOLS", "MULTIPLE_FACES", "CAMERA_DISABLED", "FULLSCREEN_EXIT", "COPY", "PASTE", "RIGHT_CLICK", "KEYBOARD_SHORTCUT"];
    const cooldownPeriod = hardViolations.includes(type) ? 20000 : 10000;
    const lastTypeTime = lastViolationMapRef.current[type] || 0;
    if (now - lastTypeTime < cooldownPeriod) return;
    
    lastViolationMapRef.current[type] = now;
    globalLastViolationRef.current = now;

    const message = violationMessages[type];
    const weight = violationWeights[type] || 2;

    if (!message) return;

    integrityScore.current = Math.max(0, integrityScore.current - weight);
    violationCount.current += 1;
    violationLogs.current.push({ type, timestamp: new Date().toISOString(), weight });
    persistState();

    const currentScore = integrityScore.current;
    const isCritical = currentScore <= 50;
    
    // Score-Based Escalation Matrix with 10s UI throttle
    if (isCritical || now - lastUIPopupTimeRef.current >= 10000) {
      if (!isCritical) {
        lastUIPopupTimeRef.current = now;
      }

      if (currentScore > 90) {
        // Passive Transparent Feedback
        if (onSystemStatus) {
          onSystemStatus(`Minor activity detected (Confidence: ${currentScore}%)`);
          systemStatusRef.current = `Minor activity detected (Confidence: ${currentScore}%)`;
        }
        if (onViolationLevel) onViolationLevel(0, null, currentScore);
      } 
      else if (currentScore > 80) {
        // Level 1: Soft Toast
        if (onViolationLevel) onViolationLevel(1, `System status: Slightly unstable (${type.replace('_', ' ').toLowerCase()}).`, currentScore);
        if (onSystemStatus) {
          onSystemStatus(`Caution: Active Monitoring`);
          systemStatusRef.current = `Caution: Active Monitoring`;
        }
      } 
      else if (currentScore > 65) {
        // Level 2: Medium Warning
        if (onViolationLevel) onViolationLevel(2, `Attention Required: Significant integrity variance detected.`, currentScore);
        if (onSystemStatus) {
          onSystemStatus(`Focus Threshold Warning`);
          systemStatusRef.current = `Focus Threshold Warning`;
        }
      }
      else if (currentScore > 50) {
        // Level 3: Hard Warning
        if (onViolationLevel) onViolationLevel(3, `Final Warning: Your activity pattern is reaching a critical threshold.`, currentScore);
        if (onSystemStatus) {
          onSystemStatus(`Submission Risk: CRITICAL`);
          systemStatusRef.current = `Submission Risk: CRITICAL`;
        }
      }
      else {
        // Level 4: Final Notice (Triggers Pre-Submit Overlay)
        if (onViolationLevel) onViolationLevel(4, `Compliance Bridge: Preparing for automated submission.`, currentScore);
        if (onSystemStatus) {
          onSystemStatus(`Manual Revision Required`);
          systemStatusRef.current = `Manual Revision Required`;
        }
      }
    }
  }, [isEnabled, onSystemStatus, onViolationLevel, persistState]);

  // Integrity Recovery Loop (+1 point per 60s of clean behavioral data)
  useEffect(() => {
    if (!isEnabled || !examSessionActive || isSubmitted) return;
    
    const recoveryInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastViolation = now - globalLastViolationRef.current;
      
      if (timeSinceLastViolation >= 60000 && integrityScore.current < 100 && totalRecoveredPointsRef.current < 10) {
        integrityScore.current = Math.min(100, integrityScore.current + 1);
        totalRecoveredPointsRef.current += 1;
        
        if (onViolationLevel) onViolationLevel(0, null, integrityScore.current);
        if (onSystemStatus) {
          onSystemStatus(`Integrity Restored: ${integrityScore.current}% (Recovery Cap: ${totalRecoveredPointsRef.current}/10)`);
          systemStatusRef.current = `Integrity Restored: ${integrityScore.current}% (Recovery Cap: ${totalRecoveredPointsRef.current}/10)`;
        }
        persistState();
      }
    }, 10000); // Check every 10s

    return () => clearInterval(recoveryInterval);
  }, [isEnabled, examSessionActive, isSubmitted, onViolationLevel, onSystemStatus, persistState]);

  // Backward compatibility signatures, functionally identical now
  const emitViolation = useCallback((type) => {
    processEvent(type);
  }, [processEvent]);

  const emitWarning = useCallback((type) => {
    processEvent(type);
  }, [processEvent]);

  useEffect(() => {
    const handleCopy = (event) => {
      if (!isEnabled) return;
      event.preventDefault();
      emitWarning("COPY");
    };

    const handlePaste = (event) => {
      if (!isEnabled) return;
      event.preventDefault();
      emitWarning("PASTE");
    };

    const handleRightClick = (event) => {
      if (!isEnabled) return;
      event.preventDefault();
      emitViolation("RIGHT_CLICK");
    };

    const handleKeyDown = (event) => {
      if (!isEnabled) return;
      const key = event.key?.toLowerCase();
      const isBlockedCtrlShortcut = (event.ctrlKey || event.metaKey) && ["c", "v", "u", "s", "p"].includes(key);
      const isBlockedInspectShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && key === "i";

      if (!isBlockedCtrlShortcut && !isBlockedInspectShortcut) return;
      event.preventDefault();
      emitViolation("KEYBOARD_SHORTCUT");
    };

    const handleFullscreenChange = async () => {
      if (!isEnabled || !shouldEnforceFullscreen.current) return;
      const isFull = !!document.fullscreenElement;
      
      if (onFullscreenChange) onFullscreenChange(isFull);

      if (isFull) return;

      emitViolation("FULLSCREEN_EXIT");
      try {
        await document.documentElement.requestFullscreen();
      } catch (error) {
        console.warn("Failed to implicitly re-enter fullscreen mode:", error);
      }
    };

    const handleVisibilityChange = () => {
      // Unify visibility and blur to prevent double-counting
      if (document.visibilityState === "hidden") {
        emitViolation("TAB_SWITCH");
      }
    };

    const handleWindowBlur = () => {
      // Only emit if the tab is still technically visible (handle true window blurs)
      if (document.visibilityState === "visible") {
        emitViolation("WINDOW_BLUR");
      }
    };

    const handleDevToolsSignal = () => {
      if (!isEnabled || !shouldEnforceFullscreen.current) return;
      const devtoolsOpen = window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160;
      if (devtoolsOpen) {
        emitViolation("DEVTOOLS");
      }
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleRightClick);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    const devToolsInterval = window.setInterval(handleDevToolsSignal, 2000);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleRightClick);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.clearInterval(devToolsInterval);
    };
  }, [isEnabled, emitViolation, emitWarning]);

  const enterFullscreen = useCallback(async () => {
    try {
      shouldEnforceFullscreen.current = true;
      await document.documentElement.requestFullscreen();
      return true;
    } catch (error) {
      shouldEnforceFullscreen.current = false;
      console.warn("Failed to enter fullscreen mode:", error);
      return false;
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    shouldEnforceFullscreen.current = false;
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.warn("Failed to exit fullscreen mode:", error);
    }
  }, []);

  return {
    getIntegrityScore: () => integrityScore.current,
    getViolationReports: () => violationLogs.current,
    emitViolation,
    emitWarning,
    enterFullscreen,
    exitFullscreen,
  };
}
