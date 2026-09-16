import { useClassBoard, withPlaces } from "@/hooks/useClassBoard";

/** A nod for the top three, and a plain number for everyone else. */
const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Where a student stands in their own class.
 *
 * Their class, not the school: six names they know, all of whom started the
 * course on the same day. The count is sessions finished all-time, so nobody
 * is knocked down the list by one bad week — the number only ever grows.
 *
 * Everyone is shown, not a top three. A board that hides the bottom half
 * tells the bottom half exactly where they are anyway, and a student who has
 * done two sessions can see that two more puts them level with someone.
 */
export default function ClassBoard() {
  const { data } = useClassBoard();

  // Not migrated yet, or a viewer with no class of their own.
  if (!data || data.length < 2) return null;

  const rows = withPlaces(data);

  return (
    <section
      className="rounded-2xl p-4 md:p-5"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--gold-deep)" }}>
          Your class
        </h2>
        <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
          sessions finished
        </span>
      </div>

      <ol className="flex flex-col gap-1">
        {rows.map((r) => (
          <li
            key={r.student_id}
            className="flex items-center gap-3 rounded-xl px-3 py-2"
            style={{
              background: r.is_me ? "rgba(59,130,246,0.10)" : "var(--paper-warm)",
              border: `1px solid ${r.is_me ? "var(--blue-bright)" : "var(--border)"}`,
            }}
          >
            <span
              className="w-6 shrink-0 text-center text-sm font-bold tabular-nums"
              style={{ color: "var(--ink-soft)" }}
              aria-hidden
            >
              {MEDALS[r.place - 1] ?? r.place}
            </span>
            <span
              className="flex-1 min-w-0 truncate text-sm"
              style={{ color: "var(--ink)", fontWeight: r.is_me ? 700 : 500 }}
            >
              {r.display_name}
              {r.is_me && (
                <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--ink-soft)" }}>
                  you
                </span>
              )}
            </span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "var(--ink)" }}>
              {r.sessions}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
        Every session you finish adds one, and it stays — miss a week and you keep what you've done.
      </p>
    </section>
  );
}
