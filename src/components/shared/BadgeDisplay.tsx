import { getBadge, nextBadge, type BadgeLevel } from "@/lib/badges";

type Size = "sm" | "md" | "lg" | "hero";

const SIZE_MAP: Record<Size, { emoji: string; label: string; sub: string; gap: string }> = {
  sm:   { emoji: "text-xl",   label: "text-xs font-semibold",  sub: "text-[10px]", gap: "gap-1.5" },
  md:   { emoji: "text-3xl",  label: "text-sm font-semibold",  sub: "text-xs",     gap: "gap-2" },
  lg:   { emoji: "text-5xl",  label: "text-base font-bold",    sub: "text-xs",     gap: "gap-2" },
  hero: { emoji: "text-7xl",  label: "text-lg font-bold",      sub: "text-sm",     gap: "gap-3" },
};

interface Props {
  level: number | null | undefined;
  size?: Size;
  showLabel?: boolean;
  showNext?: boolean;
  emptyLabel?: string;
  animate?: boolean;
}

const BadgeDisplay = ({ level, size = "md", showLabel = true, showNext = false, emptyLabel = "Not started", animate = false }: Props) => {
  const badge = getBadge(level);
  const next = showNext ? nextBadge(level) : null;
  const s = SIZE_MAP[size];

  if (!badge) {
    return (
      <div className={`inline-flex items-center ${s.gap}`} style={{ color: "var(--ink-faint)" }}>
        <span className={s.emoji} style={{ filter: "grayscale(1)", opacity: 0.5 }}>🥚</span>
        {showLabel && <span className={s.label}>{emptyLabel}</span>}
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center ${s.gap}`}>
      <div className="inline-flex items-center gap-2">
        <span
          className={s.emoji}
          style={
            animate
              ? { display: "inline-block", animation: "badgeBob 2.4s ease-in-out infinite", filter: "drop-shadow(0 6px 14px rgba(184,148,31,0.35))" }
              : undefined
          }
        >
          {badge.emoji}
        </span>
        {showLabel && (
          <div className="flex flex-col items-start leading-tight">
            <span className={s.label} style={{ color: "var(--ink)" }}>{badge.name}</span>
            <span className={s.sub} style={{ color: "var(--ink-soft)" }}>{badge.blurb}</span>
          </div>
        )}
      </div>
      {next && (
        <div className={`${s.sub} inline-flex items-center gap-1`} style={{ color: "var(--ink-soft)" }}>
          <span>Next:</span>
          <span>{next.emoji}</span>
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{next.name}</span>
        </div>
      )}
      <style>{`@keyframes badgeBob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(2deg); } }`}</style>
    </div>
  );
};

export default BadgeDisplay;
export type { BadgeLevel };
