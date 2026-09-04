// Course 1 — first-month ukulele curriculum.
//
// Fixed plan authored by BAM (not generated): 4 weeks × 3 practice days.
// The first class is Saturday/Sunday Sep 6th, 2026; practice weeks run on
// ISO weeks (Mon–Sun), so curriculum week 1 is the week starting Mon Sep 7.
// While a week falls inside this plan, the weekly-plan generator uses these
// days verbatim instead of generating build/flow/stretch content.

export interface CurriculumDay {
  /** Song the day centres on (catalog id). */
  focusSongId: string;
  warmupInstruction: string;
  focusInstruction: string;
  bonusInstruction: string;
}

export interface CurriculumWeek {
  /** What class covered, shown to teachers/students as context. */
  classTopic: string;
  days: [CurriculumDay, CurriculumDay, CurriculumDay];
}

export interface Curriculum {
  id: string;
  title: string;
  /** Monday of curriculum week 1 (ISO date). */
  weekOneStart: string;
  weeks: CurriculumWeek[];
}

export const COURSE_1: Curriculum = {
  id: "course-1",
  title: "Course 1 · First month",
  weekOneStart: "2026-09-07",
  weeks: [
    {
      classTopic: "Class 1 — C and half F, full F · how to tune · You Are My Sunshine (no G chord yet)",
      days: [
        {
          focusSongId: "sunshine",
          warmupInstruction: "Watch “Tuning your ukulele”, then tune each string — G C E A.",
          focusInstruction: "Watch the first lesson, then play along: C and F (half and full). No G chord yet.",
          bonusInstruction: "Slow C → F changes. Ten clean ones, no rushing.",
        },
        {
          focusSongId: "sunshine",
          warmupInstruction: "Tune up, then strum open strings to loosen your hand.",
          focusInstruction: "Exercise 1: shifting between C and F. Slow and clean beats fast and messy.",
          bonusInstruction: "Try the first line of You Are My Sunshine using just C and F.",
        },
        {
          focusSongId: "sunshine",
          warmupInstruction: "Tune up, then run a few C → F changes.",
          focusInstruction: "Watch the You Are My Sunshine tutorial, then play it through.",
          bonusInstruction: "Play-throughs — as many relaxed runs as fit in the time.",
        },
      ],
    },
    {
      classTopic: "Class 2 — Piyu Bole · the G chord · Sunshine with G · sharps & flats theory",
      days: [
        {
          focusSongId: "piyu-bole",
          warmupInstruction: "Tune up, then revise C, F and your new G chord.",
          focusInstruction: "Watch the Piyu Bole summary and learn the chord shapes.",
          bonusInstruction: "Loop the trickiest change in Piyu Bole a few times.",
        },
        {
          focusSongId: "sunshine",
          warmupInstruction: "Tune up.",
          focusInstruction: "Exercise 2: changes between C and G. Then watch the completed Sunshine summary and add the G chord.",
          bonusInstruction: "One full Sunshine run with the G chord in.",
        },
        {
          focusSongId: "piyu-bole",
          warmupInstruction: "Tune up, then one gentle Sunshine run.",
          focusInstruction: "Piyu Bole play-throughs.",
          bonusInstruction: "Finish with your favourite section, just for fun.",
        },
      ],
    },
    {
      classTopic: "Class 3 — Photograph · chord progressions · major scale",
      days: [
        {
          focusSongId: "photograph",
          warmupInstruction: "Tune up, then revise C, F, G changes.",
          focusInstruction: "Watch the Photograph summary and learn the shapes.",
          bonusInstruction: "Slow-motion run of Photograph's chord loop.",
        },
        {
          focusSongId: "photograph",
          warmupInstruction: "Tune up.",
          focusInstruction: "Arpeggiate each Photograph chord 3 times — one string at a time, slow and even.",
          bonusInstruction: "Put two chords together, still arpeggiated.",
        },
        {
          focusSongId: "photograph",
          warmupInstruction: "Tune up, then a C–F–G warm run.",
          focusInstruction: "Photograph play-along with the track.",
          bonusInstruction: "One more run — this time don't stop for mistakes.",
        },
      ],
    },
    {
      classTopic: "Class 4 — finish Photograph, revise · all three songs with tracks",
      days: [
        {
          focusSongId: "photograph",
          warmupInstruction: "Tune up.",
          focusInstruction: "Photograph play-through — everything in tempo.",
          bonusInstruction: "The Photograph motif, three relaxed repeats.",
        },
        {
          focusSongId: "sunshine",
          warmupInstruction: "Tune up.",
          focusInstruction: "You Are My Sunshine completed play-through. Then Exercise 3, progression changes: C F G Am · F G C Am · Am G C F.",
          bonusInstruction: "Pick the progression that trips you up and loop it.",
        },
        {
          focusSongId: "piyu-bole",
          warmupInstruction: "Tune up, then one Sunshine chorus.",
          focusInstruction: "Piyu Bole full play-through.",
          bonusInstruction: "Celebrate — play any song from the month, your choice.",
        },
      ],
    },
  ],
};

/** The curriculum week (0-based) covering the given ISO Monday, or null when outside the plan. */
export function curriculumWeekFor(curriculum: Curriculum, weekStart: string): CurriculumWeek | null {
  const start = new Date(curriculum.weekOneStart).getTime();
  const week = new Date(weekStart).getTime();
  if (Number.isNaN(start) || week < start) return null;
  const index = Math.round((week - start) / (7 * 86_400_000));
  return curriculum.weeks[index] ?? null;
}
