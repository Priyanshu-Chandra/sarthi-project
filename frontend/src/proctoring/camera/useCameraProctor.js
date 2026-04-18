import { useEffect, useRef } from "react";

import { requestCameraStream } from "./cameraUtils";

export default function useCameraProctor({
  isEnabled,
  videoRef,
  onCameraError,
  emitViolation,
}) {
  const streamRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef?.current) {
        videoRef.current.srcObject = null;
      }
    };

    const startStream = async () => {
      if (!isEnabled || !videoRef?.current || streamRef.current) {
        return;
      }

      try {
        const stream = await requestCameraStream();

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const videoTrack = stream.getVideoTracks()[0];

        if (videoTrack) {
          videoTrack.onended = () => {
            if (emitViolation) {
              emitViolation("CAMERA_DISABLED");
            }
          };
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
      } catch (error) {
        stopStream();

        if (onCameraError) {
          onCameraError(error);
        }
      }
    };

    if (isEnabled) {
      startStream();
    } else {
      stopStream();
    }

    return () => {
      isCancelled = true;
      stopStream();
    };
  }, [emitViolation, isEnabled, onCameraError, videoRef]);
}
