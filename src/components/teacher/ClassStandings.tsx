import type { Standing } from "@/hooks/useTeacherStudents";

/**
 * A class side by side: every student and the sessions they have finished.
 *
 * The same count and the same order the students see on their own class
 * board, with full names. The bar is each student against the one furthest
 * ahead, so who has drifted is visible without reading a number.
 */
export default function ClassStandings({
  rows,
  loading,
  onOpen,
}: {
  rows: Standing[];
  loading?: boolean;
  onOpen?: (studentId: string) => void;
}) {
  if (!rows.length) return <div className="px-4 py-4 text-sm text-muted-foreground">No students enrolled.</div>;
  const most = Math.max(...rows.map((r) => r.sessions), 1);
  return (
    <ol className="divide-y">
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onOpen?.(r.id)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
          >
            <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
              {loading ? "" : r.place}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate text-sm font-medium">{r.name}</span>
              <span className="mt-1 block h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
                <span
                  className="block h-full rounded-full bg-primary transition-all"
                  style={{ width: loading ? 0 : `${(r.sessions / most) * 100}%` }}
                />
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-none">{loading ? "–" : r.sessions}</span>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                {r.sessions === 1 && !loading ? "session" : "sessions"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
