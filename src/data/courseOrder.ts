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
