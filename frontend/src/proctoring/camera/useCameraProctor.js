import { useEffect, useRef, useState, useCallback } from "react";

import { requestCameraStream } from "./cameraUtils";

export default function useCameraProctor({
  isEnabled,
  videoElement,
  autoStart = true,
  onCameraError,
  emitViolation,
}) {
  const streamRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState(null);

  const stopStream = useCallback(() => {
    setIsActive(false);
    setStream(null);

    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoElement) {
      videoElement.srcObject = null;
    }
  }, [videoElement]);

  const startStream = useCallback(async () => {
    if (!isEnabled) {
      return;
    }

    // If already active and stream is healthy, don't restart
    if (streamRef.current && streamRef.current.active) {
      if (videoElement && videoElement.srcObject !== streamRef.current) {
        videoElement.srcObject = streamRef.current;
      }
      setIsActive(true);
      setStream(streamRef.current);
      return streamRef.current;
    }

    if (document.visibilityState === "hidden") {
      return;
    }

    try {
      const stream = await requestCameraStream();

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setIsActive(false);
          if (emitViolation) {
            emitViolation("CAMERA_DISABLED");
          }
        };
      }

      streamRef.current = stream;
      if (videoElement) {
        videoElement.srcObject = stream;
      }
      setIsActive(true);
      setStream(stream);
      retryCountRef.current = 0;
      return stream;
    } catch (error) {
      stopStream();

      if (retryCountRef.current < 2) {
        retryCountRef.current += 1;
        console.warn(`Camera initialization failed. Retrying... (${retryCountRef.current}/3)`);
        if (isEnabled && autoStart) {
          retryTimeoutRef.current = window.setTimeout(() => {
            startStream().catch(() => {});
          }, 3000);
        }
      } else {
        if (emitViolation) {
          emitViolation("CAMERA_DISABLED");
        }
        if (onCameraError) {
          onCameraError(error);
        }
      }
      throw error;
    }
  }, [emitViolation, isEnabled, onCameraError, stopStream, videoElement]);

  useEffect(() => {
    if (!isEnabled) {
      stopStream();
    } else if (autoStart && document.visibilityState === "visible") {
      startStream().catch(() => {});
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (isEnabled && autoStart) startStream().catch(() => {});
      } else if (isEnabled) {
        stopStream();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopStream();
    };
  }, [autoStart, isEnabled, startStream, stopStream]);

  return { isActive, stream, requestAccess: startStream, stopStream };
}
