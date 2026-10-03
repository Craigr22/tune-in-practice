import { BADGE_LIST } from "@/lib/badges";

/**
 * Five ways a song can be going, in words.
 *
 * Chosen by description rather than by number: "plays through with stops" is
 * harder to talk yourself past than a 2.
 */
export default function GradePicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className="grid gap-1.5">
      {BADGE_LIST.map((b) => {
        const on = value === b.level;
        return (
          <button
            key={b.level}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(b.level)}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors disabled:opacity-60"
            style={{
              background: on ? "var(--gold-bg)" : "var(--card)",
              border: `2px solid ${on ? "var(--gold-deep)" : "var(--border)"}`,
            }}
          >
            <span className="text-2xl leading-none">{b.emoji}</span>
            <span className="min-w-0">
              <span className="block text-sm font-bold" style={{ color: "var(--ink)" }}>{b.name}</span>
              <span className="block text-xs" style={{ color: "var(--ink-soft)" }}>{b.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
