import { useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "stopped" | "error";

interface Result { blob: Blob; durationSec: number }

const MAX_SECONDS = 30;

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const cleanup = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRef.current?.stream) mediaRef.current.stream.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
  };

  useEffect(() => () => cleanup(), []);

  const start = async () => {
    setError(null);
    setResult(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const durationSec = Math.min(MAX_SECONDS, Math.round((Date.now() - startRef.current) / 1000));
        setResult({ blob, durationSec });
        setState("stopped");
        cleanup();
      };
      mr.start();
      startRef.current = Date.now();
      setElapsed(0);
      setState("recording");
      timerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(sec);
        if (sec >= MAX_SECONDS) stop();
      }, 200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Microphone unavailable");
      setState("error");
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state === "recording") mediaRef.current.stop();
  };

  const reset = () => { setState("idle"); setElapsed(0); setResult(null); setError(null); };

  return { state, elapsed, result, error, start, stop, reset, max: MAX_SECONDS };
}
