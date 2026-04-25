import { useEffect, useRef, useState } from "react";
import * as FaceDetectionModule from "@mediapipe/face_detection";

export default function useFaceMonitor({
  videoElement,
  isEnabled,
  emitViolation,
  emitWarning,
}) {
  const [faceDetected, setFaceDetected] = useState(false);
  const [isCentered, setIsCentered] = useState(true);

  const detectorRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const lastFaceSeenRef = useRef(Date.now());
  const lastFaceLargeEnoughRef = useRef(Date.now());
  const lastCenteredRef = useRef(Date.now());
  const lastBrightRef = useRef(Date.now());
  const faceHistoryRef = useRef([]);
  const multipleFaceHistoryRef = useRef([]);
  const HISTORY_SIZE = 4;

  useEffect(() => {
    let isCancelled = false;

    const stopDetection = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      canvasRef.current = null;
      setFaceDetected(false);
      setIsCentered(true);
    };

    const startDetection = async () => {
      if (!isEnabled || !videoElement || !emitViolation || !emitWarning) {
        return;
      }

      if (!detectorRef.current) {
        const FaceDetectionCtor =
          FaceDetectionModule.FaceDetection ||
          FaceDetectionModule.default ||
          window.FaceDetection;

        if (!FaceDetectionCtor) {
          console.error("MediaPipe FaceDetection constructor unavailable.");
          return;
        }

        const detector = new FaceDetectionCtor({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
        });

        detector.setOptions({
          model: "short",
          minDetectionConfidence: 0.5,
        });

        detector.onResults((results) => {
          const faces = results?.detections || [];
          const currentFaceDetected = faces.length > 0;
          const multipleFaces = faces.length > 1;

          setFaceDetected(currentFaceDetected);

          faceHistoryRef.current.push(currentFaceDetected);
          if (faceHistoryRef.current.length > HISTORY_SIZE) {
            faceHistoryRef.current.shift();
          }

          multipleFaceHistoryRef.current.push(multipleFaces);
          if (multipleFaceHistoryRef.current.length > HISTORY_SIZE) {
            multipleFaceHistoryRef.current.shift();
          }

          if (faces.length === 1) {
            lastFaceSeenRef.current = Date.now();
            const box = faces[0].boundingBox;
            const faceTooFar = box.width < 0.1 || box.height < 0.12;
            const faceCenterX = box.xmin + box.width / 2;
            const currentCentered = faceCenterX > 0.25 && faceCenterX < 0.75;
            
            setIsCentered(currentCentered);

            if (!faceTooFar) {
              lastFaceLargeEnoughRef.current = Date.now();
            }

            if (faceTooFar) {
              if (Date.now() - lastFaceLargeEnoughRef.current > 5000) {
                emitWarning("FACE_TOO_FAR");
              }
            }

            if (currentCentered) {
              lastCenteredRef.current = Date.now();
            } else if (Date.now() - lastCenteredRef.current > 5000) {
              emitWarning("LOOKING_AWAY");
            }
          }
          else if (faces.length === 0) {
             setIsCentered(false);
          }

          const noFaceConsistent =
            faceHistoryRef.current.length === HISTORY_SIZE &&
            faceHistoryRef.current.every((value) => value === false);

          if (noFaceConsistent) {
            if (Date.now() - lastFaceSeenRef.current > 7000) {
              emitViolation("FACE_MISSING");
            }
          }

          const multipleFacesConfirmed =
            multipleFaceHistoryRef.current.length === HISTORY_SIZE &&
            multipleFaceHistoryRef.current.every((value) => value === true);

          if (multipleFacesConfirmed) {
            emitViolation("MULTIPLE_FACES");
          }
        });

        detectorRef.current = detector;
      }

      if (intervalRef.current) {
        return;
      }

      if (!canvasRef.current) {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          return;
        }

        canvasRef.current = { canvas, context };
      }

      lastFaceSeenRef.current = Date.now();
      lastFaceLargeEnoughRef.current = Date.now();
      lastCenteredRef.current = Date.now();
      lastBrightRef.current = Date.now();
      faceHistoryRef.current = [];
      multipleFaceHistoryRef.current = [];

      intervalRef.current = window.setInterval(async () => {
        const video = videoElement;

        if (
          isCancelled ||
          !video ||
          video.readyState < 2 ||
          video.videoWidth === 0 ||
          !isEnabled
        ) {
          setFaceDetected(false);
          faceHistoryRef.current = [];
          multipleFaceHistoryRef.current = [];
          return;
        }

        const frameSampler = canvasRef.current;

        if (frameSampler) {
          const { canvas, context } = frameSampler;

          canvas.width = 64;
          canvas.height = 48;

          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const frame = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          ).data;

          let brightness = 0;

          for (let i = 0; i < frame.length; i += 4) {
            brightness += frame[i] + frame[i + 1] + frame[i + 2];
          }

          brightness /= frame.length;

          if (brightness > 20) {
            lastBrightRef.current = Date.now();
          } else if (Date.now() - lastBrightRef.current > 6000) {
            emitViolation("CAMERA_OBSTRUCTED");
          }
        }

        try {
          await detectorRef.current.send({ image: video });
        } catch (error) {
          console.error("Face detection failed:", error);
        }
      }, 750);
    };

    if (isEnabled) {
      startDetection();
    } else {
      stopDetection();
    }

    return () => {
      isCancelled = true;
      stopDetection();
    };
  }, [emitViolation, emitWarning, isEnabled, videoElement]);

  return { faceDetected, isCentered };
}
