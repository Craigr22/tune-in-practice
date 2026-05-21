import { useEffect, useMemo, useRef, useState } from "react";
import { useMicPitch, useLowG } from "@/hooks/useTuner";
import { HIGH_G, LOW_G, centsBetween, nearestString, type StringDef } from "@/lib/tuner";

interface Props {
  /** "gate": full pre-practice screen with footer. "compact": inline mini for the pill drop-down. "lesson": single-string guided flow. */
  variant?: "gate" | "compact" | "lesson";
  onSubmit?: (tuningCheckCompleted: boolean) => void;
  onClose?: () => void;
  /** If true, the gate's primary CTA reads "Done" instead of "Let's play". */
  doneLabel?: string;
  active?: boolean;
}

interface StringState {
  cents: number | null;
  lastInTune: number | null;
  done: boolean;
}

const INITIAL: StringState = { cents: null, lastInTune: null, done: false };

const TuneCheck = ({ variant = "gate", onSubmit, onClose, doneLabel, active = true }: Props) => {
  const [lowG, setLowG] = useLowG();
  const strings: StringDef[] = lowG ? LOW_G : HIGH_G;
  const { freq, running, error } = useMicPitch({ active });

  const [stateByString, setStateByString] = useState<Record<string, StringState>>({
    G: INITIAL, C: INITIAL, E: INITIAL, A: INITIAL,
  });

  // Reset when lowG toggles (frequencies change).
  const lowGRef = useRef(lowG);
  useEffect(() => {
    if (lowGRef.current !== lowG) {
      lowGRef.current = lowG;
      setStateByString({ G: INITIAL, C: INITIAL, E: INITIAL, A: INITIAL });
    }
  }, [lowG]);

  // On each new freq, update the detected string's cents and check "held 1s in tune".
  useEffect(() => {
    if (!freq || freq <= 0) return;
    const best = nearestString(freq, strings);
    if (!best) return;
    const name = best.string.name;
    const cents = Math.round(best.cents);
    const now = performance.now();

    setStateByString((prev) => {
      const cur = prev[name] ?? INITIAL;
      const inTune = Math.abs(cents) <= 5;
      let lastInTune = cur.lastInTune;
      let done = cur.done;
      if (inTune) {
        lastInTune = lastInTune ?? now;
        if (now - lastInTune >= 1000) done = true;
      } else {
        lastInTune = null;
      }
      return { ...prev, [name]: { cents, lastInTune, done } };
    });
  }, [freq, strings]);

  const allDone = useMemo(
    () => strings.every((s) => stateByString[s.name]?.done),
    [strings, stateByString]
  );

  const skip = () => onSubmit?.(false);
  const submit = () => onSubmit?.(true);

  return (
    <div
      className={variant === "compact" ? "p-4" : "p-6 md:p-8"}
      style={{ background: "var(--paper-warm)", borderRadius: 16 }}
    >
      {variant !== "compact" && (
        <header className="mb-5 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--gold-deep)" }}>
            Pre-practice
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mt-1" style={{ color: "var(--ink)" }}>
            Let's get in tune first
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
            Pluck each string. We'll listen and tell you when it's right.
          </p>
        </header>
      )}

      <div className={`grid ${variant === "compact" ? "grid-cols-4 gap-2" : "grid-cols-2 md:grid-cols-4 gap-3"}`}>
        {strings.map((s) => {
          const st = stateByString[s.name] ?? INITIAL;
          const isDetected = freq && nearestString(freq, strings)?.string.name === s.name;
          const cents = st.cents ?? 0;
          const absC = Math.abs(cents);
          const statusLabel = st.done
            ? "✓ In tune"
            : !isDetected
              ? "Play this"
              : absC <= 5 ? "Holding…" : cents < 0 ? `Flat ${cents}¢` : `Sharp +${cents}¢`;
          const needleColor = st.done
            ? "var(--olive)"
            : absC <= 5 ? "var(--olive)" : absC <= 15 ? "var(--gold-deep)" : "var(--crimson)";
          const cardBg = st.done ? "rgba(107,122,45,0.08)" : isDetected ? "rgba(0,133,199,0.06)" : "var(--card)";
          const borderColor = st.done ? "var(--olive)" : isDetected ? "var(--navy)" : "var(--border)";
          const needlePct = Math.max(-50, Math.min(50, cents));
          return (
            <div
              key={s.name}
              className="rounded-xl p-3 transition-colors"
              style={{ background: cardBg, border: `1.5px solid ${borderColor}` }}
            >
              <div className="flex items-baseline justify-between">
                <div style={{ fontSize: variant === "compact" ? 22 : 28, fontWeight: 800, color: "var(--ink)" }}>
                  {s.name}
                </div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
                  {s.octaveLabel}
                </div>
              </div>
              <div className="relative h-3 rounded-full mt-2" style={{ background: "var(--paper-cool)" }}>
                <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: "var(--border-strong)" }} />
                {st.cents != null && isDetected && (
                  <div
                    className="absolute top-0 bottom-0 w-1 rounded-full"
                    style={{
                      left: `calc(50% + ${needlePct}%)`,
                      transform: "translateX(-50%)",
                      background: needleColor,
                      transition: "left 80ms linear, background-color 120ms linear",
                    }}
                  />
                )}
              </div>
              <div className="mt-2 text-[11px] font-semibold" style={{ color: needleColor }}>
                {statusLabel}
              </div>
            </div>
          );
        })}
      </div>

      {variant !== "compact" && (
        <div className="mt-5 flex items-center justify-between text-xs">
          <label className="inline-flex items-center gap-2" style={{ color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={lowG} onChange={(e) => setLowG(e.target.checked)} />
            Low-G
          </label>
          <span style={{ color: running ? "var(--olive)" : "var(--ink-faint)" }}>
            {error ? error : running ? "🎙 Listening…" : "Mic off"}
          </span>
        </div>
      )}

      {variant === "gate" && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={skip}
            className="text-xs font-semibold underline"
            style={{ color: "var(--ink-soft)" }}
          >
            Skip tuning
          </button>
          <button
            onClick={submit}
            disabled={!allDone}
            className="rounded-full px-6 py-3 text-sm font-bold transition-all"
            style={{
              background: allDone ? "var(--gold)" : "var(--paper-cool)",
              color: allDone ? "#1A2332" : "var(--ink-faint)",
              cursor: allDone ? "pointer" : "not-allowed",
              boxShadow: allDone ? "0 10px 24px -8px rgba(244,208,63,0.55)" : "none",
            }}
          >
            {doneLabel ?? "Let's play →"}
          </button>
        </div>
      )}

      {variant === "compact" && onClose && (
        <div className="mt-3 flex justify-end">
          <button onClick={onClose} className="text-xs font-semibold" style={{ color: "var(--navy)" }}>
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default TuneCheck;
