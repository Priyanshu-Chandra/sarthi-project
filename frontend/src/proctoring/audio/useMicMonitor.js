import { useEffect, useRef, useState, useCallback } from "react";

export default function useMicMonitor({
  isEnabled,
  autoStart = true,
  emitWarning,
}) {
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const intervalRef = useRef(null);
  const lastQuietRef = useRef(Date.now());
  const lastWarningRef = useRef(0);
  const baselineVolumeRef = useRef(20);
  const calibrationUntilRef = useRef(0);
  const calibrationSamplesRef = useRef([]);
  const [isActive, setIsActive] = useState(false);

  const stopMonitoring = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    baselineVolumeRef.current = 20;
    calibrationUntilRef.current = 0;
    calibrationSamplesRef.current = [];

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startMonitoring = useCallback(async () => {
    if (!isEnabled || !emitWarning) {
      return;
    }

    if (streamRef.current && streamRef.current.active) {
      setIsActive(true);
      return streamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        setIsActive(true);
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
      baselineVolumeRef.current = 20;
      calibrationUntilRef.current = Date.now() + 2000;
      calibrationSamplesRef.current = [];
      setIsActive(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      intervalRef.current = window.setInterval(() => {
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          sum += dataArray[i];
        }
        const volume = sum / dataArray.length;
        const now = Date.now();

        if (now < calibrationUntilRef.current) {
          calibrationSamplesRef.current.push(volume);
          const avgBaseline =
            calibrationSamplesRef.current.reduce((acc, sample) => acc + sample, 0) /
            calibrationSamplesRef.current.length;
          baselineVolumeRef.current = Math.max(15, Math.min(45, avgBaseline));
          lastQuietRef.current = now;
          return;
        }

        const sustainedNoiseThreshold = Math.max(baselineVolumeRef.current + 15, 30);
        const spikeThreshold = Math.max(baselineVolumeRef.current + 30, 55);

        if (volume < sustainedNoiseThreshold) {
          lastQuietRef.current = now;
          return;
        }

        if (volume >= spikeThreshold && now - lastWarningRef.current > 8000) {
          emitWarning("MIC_ACTIVITY");
          lastWarningRef.current = now;
          return;
        }

        if (now - lastQuietRef.current > 4000) {
          if (now - lastWarningRef.current > 8000) {
            emitWarning("MIC_ACTIVITY");
            lastWarningRef.current = now;
          }
        }
      }, 1500);
      
      return stream;
    } catch (error) {
      console.warn("Microphone access denied.");
      stopMonitoring();
      setIsActive(false);
      throw error;
    }
  }, [emitWarning, isEnabled, stopMonitoring]);

  useEffect(() => {
    if (!isEnabled) {
      stopMonitoring();
    } else if (autoStart) {
      startMonitoring().catch(() => {});
    }

    return () => {
      stopMonitoring();
    };
  }, [autoStart, isEnabled, startMonitoring, stopMonitoring]);

  useEffect(() => {
    if (!isEnabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const ctx = audioContextRef.current;
      if (ctx?.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isEnabled]);

  return { micActive: isActive, requestMicAccess: startMonitoring };
}
