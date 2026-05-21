import { useEffect, useState } from "react";
import { useMicPitch, useLowG } from "@/hooks/useTuner";
import { HIGH_G, LOW_G, centsBetween, nearestString } from "@/lib/tuner";
import { useMarkFoundationComplete, useFoundationProgress } from "@/hooks/useFoundationProgress";
import { toast } from "@/hooks/use-toast";

const STEPS = ["G", "C", "E", "A"];

const TuneCheckLesson = ({ onDone }: { onDone?: () => void }) => {
  const [lowG, setLowG] = useLowG();
  const strings = lowG ? LOW_G : HIGH_G;
  const [stepIdx, setStepIdx] = useState(0);
  const [held, setHeld] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { freq, running, error } = useMicPitch({ active: !confirmed });
  const mark = useMarkFoundationComplete();
  const { data: completed = [] } = useFoundationProgress();
  const alreadyDone = completed.some((c) => c.foundation_id === "tune");

  const target = strings.find((s) => s.name === STEPS[stepIdx])!;
  const detected = freq && freq > 0 ? nearestString(freq, strings) : null;
  const isOnTarget = detected?.string.name === target.name;
  const cents = isOnTarget && freq ? Math.round(centsBetween(freq, target.freq)) : null;
  const inTune = cents != null && Math.abs(cents) <= 5;

  // hold-in-tune timer (1s) → unlock Next
  useEffect(() => {
    if (inTune) {
      if (held == null) setHeld(performance.now());
    } else if (held != null) {
      setHeld(null);
    }
  }, [inTune, held]);
  const readyToConfirm = held != null && performance.now() - held >= 1000;

  const next = async () => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
      setHeld(null);
      return;
    }
    setConfirmed(true);
    try {
      await mark.mutateAsync({ foundationId: "tune" });
      toast({ title: "Tuning mastered 🎵", description: "Foundation complete." });
      onDone?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save progress.";
      toast({ title: "Couldn't save", description: msg, variant: "destructive" });
    }
  };

  if (confirmed || alreadyDone) {
    return (
      <div className="p-5 rounded-xl text-center" style={{ background: "rgba(107,122,45,0.08)", border: "1px solid var(--olive)" }}>
        <div className="text-3xl">✅</div>
        <div className="mt-2 font-bold" style={{ color: "var(--ink)" }}>Tuning foundation complete</div>
        <div className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>You can tune your ukulele on your own. Use the floating tuner anytime.</div>
      </div>
    );
  }

  const guidance = !isOnTarget
    ? `Play your ${target.name} string`
    : inTune
      ? `Hold it… ${readyToConfirm ? "great!" : ""}`
      : (cents! < 0 ? "Turn the peg up — you're flat" : "Turn the peg down — you're sharp");

  return (
    <div className="p-5 rounded-xl" style={{ background: "var(--paper-warm)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--gold-deep)" }}>
          Step {stepIdx + 1} of {STEPS.length}
        </div>
        <label className="text-xs inline-flex items-center gap-2" style={{ color: "var(--ink-soft)" }}>
          <input type="checkbox" checked={lowG} onChange={(e) => setLowG(e.target.checked)} /> Low-G
        </label>
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <div className="text-5xl font-bold" style={{ color: "var(--ink)" }}>{target.name}</div>
        <div className="text-xs uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>{target.octaveLabel}</div>
      </div>
      <p className="mt-3 text-sm" style={{ color: "var(--ink-soft)" }}>{guidance}</p>

      <div className="mt-4 relative h-3 rounded-full" style={{ background: "var(--paper-cool)" }}>
        <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: "var(--border-strong)" }} />
        {cents != null && (
          <div
            className="absolute top-0 bottom-0 w-1 rounded-full"
            style={{
              left: `calc(50% + ${Math.max(-50, Math.min(50, cents))}%)`,
              transform: "translateX(-50%)",
              background: inTune ? "var(--olive)" : Math.abs(cents) <= 15 ? "var(--gold-deep)" : "var(--crimson)",
              transition: "left 80ms linear, background-color 120ms linear",
            }}
          />
        )}
      </div>
      <div className="mt-2 text-[11px] flex justify-between" style={{ color: "var(--ink-faint)" }}>
        <span>flat</span>
        <span>{cents == null ? "—" : `${cents > 0 ? "+" : ""}${cents}¢`}</span>
        <span>sharp</span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px]" style={{ color: running ? "var(--olive)" : "var(--ink-faint)" }}>
          {error ? error : running ? "🎙 Listening…" : "Mic off"}
        </span>
        <button
          onClick={next}
          disabled={!readyToConfirm}
          className="rounded-full px-5 py-2 text-sm font-bold"
          style={{
            background: readyToConfirm ? "var(--gold)" : "var(--paper-cool)",
            color: readyToConfirm ? "#1A2332" : "var(--ink-faint)",
            cursor: readyToConfirm ? "pointer" : "not-allowed",
          }}
        >
          {stepIdx === STEPS.length - 1 ? "Finish ✓" : "Confirm & next →"}
        </button>
      </div>
    </div>
  );
};

export default TuneCheckLesson;
