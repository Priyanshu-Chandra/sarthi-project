import { useEffect, useRef } from "react";

const violationMessages = {
  COPY: "⚠️ Copying content during the test is not allowed.",
  PASTE: "⚠️ Pasting content during the test is not allowed.",
  RIGHT_CLICK: "⚠️ Right click is disabled during the test.",
  KEYBOARD_SHORTCUT: "⚠️ Keyboard shortcuts are disabled during the test.",
  FULLSCREEN_EXIT: "⚠️ Please stay in fullscreen mode during the test.",
  TAB_SWITCH: "⚠️ Please do not switch tabs during the test.",
  WINDOW_BLUR: "⚠️ Please remain focused on the test window.",
  DEVTOOLS: "⚠️ Please close developer tools during the test.",
  CAMERA_DISABLED: "⚠️ Camera access lost. Please keep your camera enabled during the test.",
  CAMERA_OBSTRUCTED: "⚠️ Camera view is obstructed. Please ensure your face is visible.",
  FACE_MISSING: "⚠️ Face not detected. Please stay in front of the camera.",
  MULTIPLE_FACES: "⚠️ Multiple faces detected. Only one person is allowed during the test.",
  FACE_TOO_FAR: "⚠️ You are too far from the camera. Please stay clearly visible.",
  LOOKING_AWAY: "⚠️ Please keep your face directed toward the screen.",
  MIC_ACTIVITY: "⚠️ Unusual audio activity detected during the test.",
};

const violationCooldown = 1200;

export default function useExamProctoring({
  onViolation,
  isEnabled = true,
  storageKey = "",
  hasStartedExam = false,
  examSessionActive = false,
  isSubmitted = false,
} = {}) {
  const violationCount = useRef(0);
  const lastWarningTime = useRef(0);
  const lastViolationRef = useRef(0);
  const shouldEnforceFullscreen = useRef(false);

  const persistState = () => {
    if (!storageKey || isSubmitted) {
      return;
    }

    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        examSessionActive,
        violationCount: violationCount.current,
        hasStartedExam,
      })
    );
  };

  const warnUser = (fallbackMessage) => {
    const now = Date.now();

    if (now - lastWarningTime.current < 2000) {
      return;
    }

    lastWarningTime.current = now;
    violationCount.current += 1;

    let message = fallbackMessage;

    if (violationCount.current === 1) {
      message = "⚠️ Warning: Copying or pasting is not allowed during the test.";
    } else if (violationCount.current === 2) {
      message = "⚠️ Second warning: Please stay focused on the test.";
    } else if (violationCount.current === 3) {
      message = "⚠️ Final warning: Further violations may submit your test.";
    } else if (violationCount.current > 3) {
      message = "🚫 Multiple violations detected.";
    }

    window.alert(message);

    persistState();

    if (onViolation) {
      onViolation(violationCount.current);
    }
  };

  const emitViolation = (type) => {
    if (!isEnabled) {
      return;
    }

    const now = Date.now();

    if (now - lastViolationRef.current < violationCooldown) {
      return;
    }

    lastViolationRef.current = now;

    const message = violationMessages[type];

    if (!message) {
      return;
    }

    warnUser(message);
  };

  const emitWarning = (type) => {
    if (!isEnabled) {
      return;
    }

    const message = violationMessages[type];

    if (!message) {
      return;
    }

    window.alert(message);
  };

  useEffect(() => {
    if (!storageKey || isSubmitted || !examSessionActive) {
      return;
    }

    const raw = sessionStorage.getItem(storageKey);

    if (!raw) {
      persistState();
      return;
    }

    try {
      const parsed = JSON.parse(raw);

      if (
        parsed?.examSessionActive === true &&
        typeof parsed?.violationCount === "number"
      ) {
        violationCount.current = parsed.violationCount;
      }
    } catch {
      violationCount.current = 0;
    }

    persistState();
  }, [examSessionActive, hasStartedExam, isSubmitted, storageKey]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    if (isSubmitted || !examSessionActive) {
      sessionStorage.removeItem(storageKey);
      return;
    }

    persistState();
  }, [examSessionActive, hasStartedExam, isSubmitted, storageKey]);

  useEffect(() => {
    const handleCopy = (event) => {
      if (!isEnabled) {
        return;
      }

      event.preventDefault();
      emitViolation("COPY");
    };

    const handlePaste = (event) => {
      if (!isEnabled) {
        return;
      }

      event.preventDefault();
      emitViolation("PASTE");
    };

    const handleRightClick = (event) => {
      if (!isEnabled) {
        return;
      }

      event.preventDefault();
      emitViolation("RIGHT_CLICK");
    };

    const handleKeyDown = (event) => {
      if (!isEnabled) {
        return;
      }

      const key = event.key?.toLowerCase();
      const isBlockedCtrlShortcut =
        (event.ctrlKey || event.metaKey) &&
        ["c", "v", "u", "s", "p"].includes(key);
      const isBlockedInspectShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        key === "i";

      if (!isBlockedCtrlShortcut && !isBlockedInspectShortcut) {
        return;
      }

      event.preventDefault();
      emitViolation("KEYBOARD_SHORTCUT");
    };

    const handleFullscreenChange = async () => {
      if (!isEnabled || !shouldEnforceFullscreen.current) {
        return;
      }

      if (document.fullscreenElement) {
        return;
      }

      emitViolation("FULLSCREEN_EXIT");

      try {
        await document.documentElement.requestFullscreen();
      } catch (error) {
        console.error("Failed to re-enter fullscreen mode:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        emitViolation("TAB_SWITCH");
      }
    };

    const handleWindowBlur = () => {
      emitViolation("WINDOW_BLUR");
    };

    const handleDevToolsSignal = () => {
      if (!isEnabled || !shouldEnforceFullscreen.current) {
        return;
      }

      const devtoolsOpen =
        window.outerWidth - window.innerWidth > 160 ||
        window.outerHeight - window.innerHeight > 160;

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
  }, [isEnabled, onViolation]);

  const enterFullscreen = async () => {
    try {
      shouldEnforceFullscreen.current = true;
      await document.documentElement.requestFullscreen();
      return true;
    } catch (error) {
      shouldEnforceFullscreen.current = false;
      console.error("Failed to enter fullscreen mode:", error);
      return false;
    }
  };

  const exitFullscreen = async () => {
    shouldEnforceFullscreen.current = false;

    if (!document.fullscreenElement) {
      return;
    }

    try {
      await document.exitFullscreen();
    } catch (error) {
      console.error("Failed to exit fullscreen mode:", error);
    }
  };

  return {
    getViolations: () => violationCount.current,
    emitViolation,
    emitWarning,
    enterFullscreen,
    exitFullscreen,
  };
}
