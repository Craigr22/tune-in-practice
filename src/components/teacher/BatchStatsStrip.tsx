import { STAT_LABELS, type BatchStats } from "@/lib/batchStats";

const show = (v: number | null, loading?: boolean) => (loading ? "…" : v == null ? "—" : `${v}%`);

/** Red, amber or green — only as a nudge for the eye; the number is the fact. */
const tone = (v: number | null) =>
  v == null ? "text-muted-foreground" : v >= 70 ? "text-emerald-600" : v >= 40 ? "text-amber-600" : "text-red-600";

/**
 * A class in five percentages, as tiles. Sits above the class.
 */
export default function BatchStatsStrip({ stats, loading }: { stats: BatchStats | undefined; loading?: boolean }) {
  return (
    <div className="grid grid-cols-5 divide-x border-b bg-card">
      {STAT_LABELS.map((s) => {
        const v = stats?.[s.key] ?? null;
        return (
          <div key={s.key} className="px-1.5 py-2.5 text-center min-w-0" title={s.hint}>
            <div className={`text-base sm:text-lg font-bold tabular-nums leading-none ${loading ? "text-muted-foreground" : tone(v)}`}>
              {show(v, loading)}
            </div>
            <div className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-wider text-muted-foreground leading-tight">
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The same five on one line, for a row in a table. */
export function BatchStatsLine({ stats, loading }: { stats: BatchStats | undefined; loading?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {STAT_LABELS.map((s) => {
        const v = stats?.[s.key] ?? null;
        return (
          <span key={s.key} title={s.hint} className="whitespace-nowrap">
            <span className="text-muted-foreground">{s.label}</span>{" "}
            <span className={`font-semibold tabular-nums ${loading ? "text-muted-foreground" : tone(v)}`}>{show(v, loading)}</span>
          </span>
        );
      })}
    </div>
  );
}
