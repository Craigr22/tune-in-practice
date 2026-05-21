import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HIGH_G, LOW_G, autoCorrelate, centsBetween, nearestString,
  type StringDef,
} from "@/lib/tuner";

/** Re-export the legacy Tuner page component (for /student/tuner & FAB). */
export { default as Tuner } from "@/components/Tuner";

/* ============================================================
   useMicPitch — owns the mic + RAF loop, returns latest freq.
   Designed to be cheap to mount/unmount via the `active` flag.
============================================================ */

export function useMicPitch({ active }: { active: boolean }) {
  const [freq, setFreq] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    setRunning(false);
    setFreq(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        ctxRef.current = ctx;
      }
      if (ctx.state === "suspended") await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      setRunning(true);

      const loop = () => {
        const a = analyserRef.current;
        const b = bufRef.current;
        const c = ctxRef.current;
        if (!a || !b || !c) return;
        a.getFloatTimeDomainData(b);
        const f = autoCorrelate(b, c.sampleRate);
        if (f > 0) setFreq(f);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not access microphone";
      setError(
        msg.includes("denied") || msg.includes("Permission")
          ? "Microphone permission denied. Allow mic access and try again."
          : msg
      );
      stop();
    }
  }, [stop]);

  useEffect(() => {
    if (active) start();
    else stop();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => () => { ctxRef.current?.close(); }, []);

  return { freq, running, error, start, stop };
}

/* ============================================================
   useLowG — shared local-storage preference (G3 vs G4).
============================================================ */

export function useLowG() {
  const [lowG, setLowG] = useState<boolean>(() => {
    try { return localStorage.getItem("bam.tuner.lowG") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("bam.tuner.lowG", lowG ? "1" : "0"); } catch { /* ignore */ }
  }, [lowG]);
  return [lowG, setLowG] as const;
}

/* ============================================================
   useTuner — mode-aware tuner state.
============================================================ */

export type TunerMode = "full" | "single-string" | "passive-monitor";
export type SingleStringStatus = "waiting" | "listening" | "flat" | "sharp" | "in_tune";

export interface UseTunerOptions {
  mode: TunerMode;
  active?: boolean;
  lowG?: boolean;
  /** required when mode = 'single-string' — the string name to listen for */
  targetString?: string;
  /** cents threshold for "in tune" (default 5) */
  inTuneCents?: number;
  /** drift threshold for passive-monitor (default 15) */
  driftCents?: number;
}

export function useTuner(opts: UseTunerOptions) {
  const {
    mode, active = true, lowG = false, targetString,
    inTuneCents = 5, driftCents = 15,
  } = opts;
  const strings: StringDef[] = useMemo(() => (lowG ? LOW_G : HIGH_G), [lowG]);
  const { freq, running, error } = useMicPitch({ active });

  // Detected string + cents (works for all modes)
  const detected = useMemo(
    () => (freq && freq > 0 ? nearestString(freq, strings) : null),
    [freq, strings]
  );

  /* ---- mode-specific projections ---- */
  let singleStatus: SingleStringStatus = "waiting";
  let singleCents = 0;
  if (mode === "single-string" && targetString) {
    const target = strings.find((s) => s.name === targetString);
    if (target && freq && freq > 0) {
      singleCents = Math.round(centsBetween(freq, target.freq));
      const matchesString = detected?.string.name === targetString;
      if (!matchesString) {
        singleStatus = "listening";
      } else if (Math.abs(singleCents) <= inTuneCents) {
        singleStatus = "in_tune";
      } else if (singleCents < 0) {
        singleStatus = "flat";
      } else {
        singleStatus = "sharp";
      }
    } else if (active) {
      singleStatus = "waiting";
    }
  }

  // Passive-monitor: only surface when a string drifts > driftCents.
  const drifted =
    mode === "passive-monitor" && detected && Math.abs(detected.cents) > driftCents
      ? { name: detected.string.name, cents: Math.round(detected.cents) }
      : null;

  // Full mode: per-string snapshot (currently detected string + cents)
  const perString =
    mode === "full" && detected
      ? { [detected.string.name]: { cents: Math.round(detected.cents) } }
      : null;

  return {
    freq,
    running,
    error,
    lowG,
    strings,
    detected,
    // mode-specific
    singleStatus,
    singleCents,
    drifted,
    perString,
  };
}
