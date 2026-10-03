import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface GradePrompt {
  /** The class week the songs were practised in. */
  weekStart: string;
  songIds: string[];
}

const KEY = ["grade-prompt"];
const LATER = "bam.gradeLater";

/**
 * A prompt put off with "Later" is kept in the browser and offered once more
 * the next time the home page opens. After that it is let go — it's a
 * question, not a chore.
 */
function readLater(): GradePrompt | null {
  try {
    const raw = window.localStorage.getItem(LATER);
    return raw ? (JSON.parse(raw) as GradePrompt) : null;
  } catch {
    return null;
  }
}
function writeLater(p: GradePrompt | null) {
  try {
    if (p) window.localStorage.setItem(LATER, JSON.stringify(p));
    else window.localStorage.removeItem(LATER);
  } catch {
    /* private mode */
  }
}

/** Take the put-off prompt, if there is one. It is only ever handed back once. */
export function takeLaterPrompt(): GradePrompt | null {
  const p = readLater();
  if (p) writeLater(null);
  return p;
}

/**
 * The "how did your songs go?" prompt, shared between whatever ticks a
 * session and the dialog that asks.
 */
export function useGradePrompt() {
  const qc = useQueryClient();
  const { data: prompt = null } = useQuery<GradePrompt | null>({
    queryKey: KEY,
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
    initialData: null,
  });
  const raise = (p: GradePrompt, opts?: { second?: boolean }) =>
    qc.setQueryData(KEY, { ...p, second: !!opts?.second });
  const close = (how: "saved" | "later") => {
    const cur = qc.getQueryData<(GradePrompt & { second?: boolean }) | null>(KEY);
    if (how === "later" && cur && !cur.second) writeLater({ weekStart: cur.weekStart, songIds: cur.songIds });
    qc.setQueryData(KEY, null);
  };
  return { prompt, raise, close };
}
