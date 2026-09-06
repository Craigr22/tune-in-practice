import { addDaysIso, toLocalIso, onOrAfterDayOfWeek, onOrBeforeDayOfWeek } from "@/lib/date";

/**
 * The shape of a practice week.
 *
 * Pure date arithmetic, kept apart from the hooks so that anything needing to
 * know when a student was meant to practise — the plan generator, the streak —
 * can ask without pulling in Supabase.
 */

/** How far after the class each of the week's three days falls. */
export const SESSION_DAY_OFFSETS = [0, 2, 4] as const;

/**
 * The start of the practice week containing `d` — the class itself.
 *
 * A student's week runs from lesson to lesson, not Monday to Sunday. Anchoring
 * it on the Monday meant a Sunday class sat at the far end of its own week,
 * with the practice that follows it spilling into the next one; week numbers,
 * plan content and videos all had to be patched around that. From the class
 * day, day 1 is the lesson and the practice that follows it is simply +2 and
 * +4, whichever weekday the class happens to run on.
 */
export function classWeekStart(classDayOfWeek: number, d: Date | string = new Date()): string {
  const iso = typeof d === "string" ? d : toLocalIso(d);
  return onOrBeforeDayOfWeek(iso, classDayOfWeek);
}

/**
 * The week's three dates: the class, then practice two and four days later.
 *
 * `weekStart` is the class date, so the offsets need no knowledge of weekdays.
 */
export function sessionDatesForWeek(weekStart: string): string[] {
  return SESSION_DAY_OFFSETS.map((o) => addDaysIso(weekStart, o));
}

/**
 * The start of course week 1 — the class's first lesson.
 *
 * A start date can be set to any day; the course begins when the class first
 * meets, so it snaps forward to that lesson.
 */
export function planWeekOneStart(courseStart: string, classDayOfWeek: number): string {
  return onOrAfterDayOfWeek(courseStart, classDayOfWeek);
}

/** When a student is expected to practise. Day 1 is the lesson, not practice. */
export interface PracticeSchedule {
  classDayOfWeek: number;
  /** Nothing is expected before the course begins. */
  courseStart?: string | null;
}

/** Two years of weeks — far more than a course, and a hard stop on the walk. */
const MAX_WEEKS_BACK = 105;

/**
 * The days a student was meant to practise, on or before `iso`, newest first.
 *
 * The two practice days of each week, walked backwards to the first lesson.
 */
export function practiceDatesUpTo(iso: string, schedule: PracticeSchedule): string[] {
  const first = schedule.courseStart
    ? planWeekOneStart(schedule.courseStart, schedule.classDayOfWeek)
    : null;
  const out: string[] = [];
  let week = classWeekStart(schedule.classDayOfWeek, iso);

  for (let i = 0; i < MAX_WEEKS_BACK; i++) {
    if (first && week < first) break;
    // Latest first, and only days that have actually come round.
    for (const date of sessionDatesForWeek(week).slice(1).reverse()) {
      if (date <= iso) out.push(date);
    }
    week = addDaysIso(week, -7);
  }
  return out;
}
