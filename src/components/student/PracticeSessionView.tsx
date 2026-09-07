import type { ReactNode } from "react";

interface Props {
  instruction: string;
  minutes: number;
  content: ReactNode;
  saving: boolean;
  onDone: () => void;
}

/** One practice session, presented as one continuous activity. */
export default function PracticeSessionView({ instruction, minutes, content, saving, onDone }: Props) {
  return (
    <div className="p-4">
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-bold text-sm">Today&apos;s practice</div>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full"
            style={{ background: "var(--paper-cool)", color: "var(--ink-soft)" }}
          >
            {minutes} min
          </span>
        </div>
        {instruction && <p className="text-sm mb-3" style={{ color: "var(--ink)" }}>{instruction}</p>}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {content}
        </div>
        <button
          onClick={onDone}
          disabled={saving}
          className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold transition-transform hover:scale-[1.01] disabled:opacity-60"
          style={{ background: "var(--navy)", color: "#fff" }}
        >
          {saving ? "Saving…" : "Finish practice ✓"}
        </button>
      </div>
    </div>
  );
}
