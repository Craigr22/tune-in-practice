/**
 * What kind of clip this is, worked out from its title.
 *
 * There is no separate store for backing tracks — every clip is a row in
 * `course_videos` pointing at a file in the `videos` bucket, and the only
 * thing distinguishing a play-along from a tutorial is what it was named.
 * This reads that naming so the planner can group them; it affects display
 * only, so a clip named unusually is grouped oddly rather than lost.
 */
export type VideoKind = "lesson" | "track" | "exercise";

/** Numbered drills: "1. Technical C", "5. Strumming Im yours". */
const EXERCISE = /^\d+\.\s/;

/** Play-alongs and tempo tracks: "Piyu Bole Slow", "Photograph normal playalong", "60 bpm". */
const TRACK = /\b(playalong|play along|slow|normal|plucking|picking|strumming|bpm)\b/i;

export function videoKind(title: string): VideoKind {
  // Checked first: "5. Strumming Im yours" is a drill, not a backing track.
  if (EXERCISE.test(title)) return "exercise";
  if (TRACK.test(title)) return "track";
  return "lesson";
}

export const KIND_LABEL: Record<VideoKind, string> = {
  lesson: "Lesson",
  track: "Backing track",
  exercise: "Exercise",
};
