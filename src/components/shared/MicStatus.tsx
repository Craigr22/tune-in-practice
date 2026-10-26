import { useEffect, useState } from "react";
import type { MicState } from "@/lib/micEngine";

/** Diagnostics are off unless asked for: ?tunerdebug in the address, once, keeps them on. */
function useDiagnostics(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("tunerdebug")) localStorage.setItem("bam.tuner.debug", "1");
      setOn(localStorage.getItem("bam.tuner.debug") === "1");
    } catch {
      /* private mode */
    }
  }, []);
  return on;
}

/**
 * What the microphone is doing, said plainly: a level bar so a student can
 * see it hears them, and a way out of each of the ways it can stop.
 */
export default function MicStatus({
  status,
  level,
  quiet,
  error,
  diag,
  onWake,
  compact = false,
}: Pick<MicState, "status" | "level" | "quiet" | "error" | "diag"> & { onWake: () => void; compact?: boolean }) {
  const diagnostics = useDiagnostics();
  const bars = 5;
  const lit = status === "listening" ? Math.round(Math.min(1, level) * bars) : 0;

  let message: React.ReactNode = null;
  if (status === "error") message = error;
  else if (status === "needs-tap") message = "The tuner is paused.";
  else if (status === "starting") message = "Starting the microphone…";
  else if (status === "listening" && quiet) message = "Can't hear the ukulele. Bring the phone closer, or pluck a little harder.";
  else if (status === "listening") message = "Listening";
  else message = "Mic off";

  const tone = status === "error" ? "var(--crimson, #c0392b)" : status === "listening" && !quiet ? "var(--olive, #5a7d2a)" : "var(--ink-soft)";

  return (
    <div className={compact ? "" : "mt-3"} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-[12px]" style={{ color: tone }}>
        <span className="inline-flex items-end gap-[2px] h-3" aria-hidden>
          {Array.from({ length: bars }, (_, i) => (
            <span
              key={i}
              style={{
                width: 3,
                height: 4 + i * 2,
                borderRadius: 1,
                background: i < lit ? "currentColor" : "var(--border, #d9dde3)",
                transition: "background-color 80ms linear",
              }}
            />
          ))}
        </span>
        <span>{message}</span>
        {(status === "needs-tap" || status === "error") && (
          <button
            type="button"
            onClick={onWake}
            className="ml-auto rounded-full px-3 py-1 text-[12px] font-bold"
            style={{ background: "var(--navy, #0085C7)", color: "#fff" }}
          >
            {status === "needs-tap" ? "Tap to start the tuner" : "Try again"}
          </button>
        )}
      </div>
      {diagnostics && (
        <div className="mt-1 font-mono text-[10px]" style={{ color: "var(--ink-faint)" }}>
          {status} · audio {diag.ctx} · {diag.sampleRate || "?"}Hz · boost ×{diag.gain} · room {diag.floor} · level {level.toFixed(2)} · {diag.device || "no mic"}
        </div>
      )}
    </div>
  );
}
