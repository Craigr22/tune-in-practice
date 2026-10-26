import { useEffect, useMemo, useState } from "react";
import {
  HIGH_G, LOW_G, centsBetween, nearestString,
  type StringDef,
} from "@/lib/tuner";
import { mic, type MicState } from "@/lib/micEngine";

/** Re-export the legacy Tuner page component (for /student/tuner & FAB). */
export { default as Tuner } from "@/components/Tuner";

/* ============================================================
   useMicPitch — listens through the shared microphone.
   Mounting with `active` claims the microphone; unmounting lets it go.
============================================================ */

export function useMicPitch({ active }: { active: boolean }) {
  const [state, setState] = useState<MicState>(mic.state);
  useEffect(() => mic.subscribe(setState), []);
  useEffect(() => {
    if (!active) return;
    mic.acquire();
    return () => mic.release();
  }, [active]);
  return {
    freq: state.freq,
    running: state.status === "listening",
    error: state.error,
    status: state.status,
    level: state.level,
    quiet: state.quiet,
    diag: state.diag,
    /** For a tap: wake the audio and reopen the microphone if it has gone. */
    wake: () => mic.wake(),
  };
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
