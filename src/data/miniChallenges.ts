// Tiny bonus challenges. Pure data — no LLM. `prerequisite_min_week` gates difficulty.

export interface MiniChallenge {
  id: string;
  title: string;
  instruction: string;
  prerequisite_min_week: number; // 1 = brand new, higher = needs more weeks under belt
}

export const MINI_CHALLENGES: MiniChallenge[] = [
  { id: "c-clean", title: "Clean C chord", instruction: "Play the C chord 5 times in a row, each one ringing cleanly. Stop if any string buzzes.", prerequisite_min_week: 1 },
  { id: "g7-clean", title: "G7 fingers", instruction: "Set up G7 from open. Lift all fingers, then plant them together. 8 reps.", prerequisite_min_week: 1 },
  { id: "f-clean", title: "F without looking", instruction: "Play F, look away, play F again. Repeat 6 times.", prerequisite_min_week: 2 },
  { id: "am-rest", title: "Am ring test", instruction: "Strum Am, count to 4 while it rings. No muting allowed.", prerequisite_min_week: 1 },
  { id: "swing-strum", title: "Swing strum", instruction: "Take any chord you know. Try a swing strum — long-short-long-short. 30 seconds.", prerequisite_min_week: 3 },
  { id: "island-strum", title: "Island strum", instruction: "D-D-U-U-D-U on one chord. Slow first, then double speed.", prerequisite_min_week: 3 },
  { id: "fsharpm", title: "Try F#m", instruction: "Try the F#m chord — just play it cleanly once. No song, no rhythm.", prerequisite_min_week: 4 },
  { id: "bm-stretch", title: "Bm finger stretch", instruction: "Form Bm. Hold for 10 seconds. Release. Repeat 3 times.", prerequisite_min_week: 4 },
  { id: "two-chord-flip", title: "Two-chord flip", instruction: "Pick any two chords you know. Flip between them 20 times as smoothly as you can.", prerequisite_min_week: 2 },
  { id: "fingerpick-1", title: "Thumb-index pluck", instruction: "Hold C. Thumb plucks string 4, index plucks string 1. Alternate for 30 seconds.", prerequisite_min_week: 3 },
  { id: "mute-control", title: "Palm mute", instruction: "Rest your strumming hand lightly on the strings. Strum any chord — practice the muted thud.", prerequisite_min_week: 3 },
  { id: "tempo-up", title: "Tempo bump", instruction: "Take your last song, play it 10% faster than usual for 30 seconds. Then go back to tempo.", prerequisite_min_week: 5 },
  { id: "sing-strum", title: "Strum + hum", instruction: "Hum the melody of any song you've learned while strumming the chord. 1 minute.", prerequisite_min_week: 2 },
  { id: "string-by-string", title: "String-by-string check", instruction: "Form any chord. Pluck each string one at a time. Adjust fingers until all 4 ring.", prerequisite_min_week: 1 },
  { id: "key-change", title: "Capo trick (visualize)", instruction: "Pick a song you know. Imagine playing it 2 frets up. Visualize the new chord shapes for 1 minute.", prerequisite_min_week: 5 },
];

export function challengesForWeek(weekNumber: number) {
  return MINI_CHALLENGES.filter((c) => c.prerequisite_min_week <= Math.max(1, weekNumber));
}
