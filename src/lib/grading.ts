/**
 * Grading, which belongs to the student.
 *
 * A teacher used to rate each song, and nothing counted as mastered until
 * they gave the top badge — so a Journey sat at nothing for months, waiting
 * on one person. Students now grade their own songs, once a week, when they
 * tick the last session before their next class.
 */

/** Cheetah or Eagle: "full speed, clean strumming" is the bar. */
export const MASTERED_AT = 4;

/** A student's own grade for a song, or null if they haven't given one. */
export const songGrade = (p: { self_badge: number | null } | null | undefined): number | null =>
  p?.self_badge && p.self_badge > 0 ? p.self_badge : null;

/**
 * Mastered while the student's latest grade says so. Grading a song back
 * down takes it away again: an honest "not any more" has to be allowed.
 */
export const isMastered = (p: { self_badge: number | null } | null | undefined): boolean =>
  (songGrade(p) ?? 0) >= MASTERED_AT;

interface WeekSession {
  id: string;
  scheduled_date: string;
  song_id: string | null;
  completed: boolean;
}

/**
 * The songs to ask about once a session has just been ticked.
 *
 * Only the week's last session asks — the one before the next class — and
 * only about songs the student actually ticked practice for that week. A
 * song they skipped isn't theirs to grade yet.
 */
export function songsToGrade(week: WeekSession[], finishedId: string): string[] {
  if (!week.length) return [];
  const last = week.reduce((a, b) => (b.scheduled_date > a.scheduled_date ? b : a));
  if (last.id !== finishedId) return [];
  const songs: string[] = [];
  for (const s of [...week].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))) {
    if ((s.completed || s.id === finishedId) && s.song_id && !songs.includes(s.song_id)) songs.push(s.song_id);
  }
  return songs;
}
