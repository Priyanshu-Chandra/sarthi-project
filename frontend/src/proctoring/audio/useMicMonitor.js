import { useEffect, useRef } from "react";

export default function useMicMonitor({
  isEnabled,
  emitWarning,
}) {
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const intervalRef = useRef(null);
  const lastQuietRef = useRef(Date.now());
  const lastWarningRef = useRef(0);

  useEffect(() => {
    let isCancelled = false;

    const stopMonitoring = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const startMonitoring = async () => {
      if (!isEnabled || !emitWarning) {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
          return;
        }

        const audioContext = new AudioContextClass();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        source.connect(analyser);
        analyser.fftSize = 512;

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        lastQuietRef.current = Date.now();

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        intervalRef.current = window.setInterval(() => {
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i += 1) {
            sum += dataArray[i];
          }
          const volume = sum / dataArray.length;

          if (volume < 25) {
            lastQuietRef.current = Date.now();
            return;
          }

          if (Date.now() - lastQuietRef.current > 4000) {
            if (Date.now() - lastWarningRef.current > 8000) {
              emitWarning("MIC_ACTIVITY");
              lastWarningRef.current = Date.now();
            }
          }
        }, 2000);
      } catch (error) {
        console.warn("Microphone access denied.");
      }
    };

    if (isEnabled) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      isCancelled = true;
      stopMonitoring();
    };
  }, [emitWarning, isEnabled]);
}
