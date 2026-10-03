/**
 * The Beginner course, in teaching order.
 *
 * The course plan decides the order for the weeks an admin has actually
 * planned. This is the fallback for everything after that — the songs the
 * beginner course goes on to, before anyone has scheduled them.
 *
 * Numbers are spaced rather than sequential so a song can be slipped between
 * two others without renumbering the rest.
 */
export const BEGINNER_ORDER: Record<string, number> = {
  sunshine: 10,
  "piyu-bole": 12,
  photograph: 16,
  "im-yours": 20,
  "kaisi-paheli": 24,
  "kho-gaye": 26,
  "over-rainbow": 30,
  // Not in the song catalogue yet. Listed so it lands in the right place the
  // moment it is added, rather than appearing at the end.
  "jab-koi-baat": 34,
  riptide: 38,
  sham: 42,
};

/**
 * The three songs every Beginner class learns.
 *
 * Anything else that sits in the Beginner stage is an extra: it stays off a
 * class's map until that class's teacher switches it on. Some classes have
 * the time for a fourth song and some don't, and the teacher is the one who
 * knows which.
 */
export const BEGINNER_CORE: readonly string[] = ["sunshine", "piyu-bole", "photograph"];

/** Whether a stop on the course is one of the Beginner extras. */
export const isBeginnerExtra = (stop: { songId: string; tier: string }) =>
  stop.tier === "beginner" && !BEGINNER_CORE.includes(stop.songId);

/** The extras a class's teacher has switched on, from that class's song rows. */
export const activatedSongs = (rows: { song_id: string; is_unlocked: boolean }[]) =>
  new Set(rows.filter((r) => r.is_unlocked).map((r) => r.song_id));

/**
 * The Beginner extras a class isn't doing — the ones to leave off its map.
 * Only an explicit "on" from the teacher counts; no row means off.
 */
export function hiddenExtras(
  stops: { songId: string; tier: string }[],
  rows: { song_id: string; is_unlocked: boolean }[],
): Set<string> {
  const on = activatedSongs(rows);
  return new Set(stops.filter((s) => isBeginnerExtra(s) && !on.has(s.songId)).map((s) => s.songId));
}
