import { addDaysIso, toLocalIso } from "@/lib/date";
import { SESSION_DAY_OFFSETS, classWeekStart, planWeekOneStart } from "@/lib/practiceWeek";

/**
 * How a class is doing, as five percentages.
 *
 * Everything is a share of something, never a raw count, so a class of four
 * and a class of twelve read on the same scale and an admin can run an eye
 * down a list of them.
 *
 * What "due" means matters: a student who never opens the app has no session
 * rows at all, so counting rows would flatter exactly the students who have
 * drifted. Due is worked out from the calendar instead — every class day and
 * the practice two and four days after it, from the class's first lesson (or
 * the day the student joined, if later) up to today.
 */
export interface BatchStats {
  /** Sessions ticked, of all those due so far. */
  done: number | null;
  /** The same, for the class week in progress. */
  thisWeek: number | null;
  /** Of sessions ticked, those ticked on their day or the day after. */
  onTime: number | null;
  /** Students who have ticked anything in the last 14 days. */
  active: number | null;
  /** The average of students' own grades, as a share of the top grade. */
  confidence: number | null;
}

export interface BatchStatsInput {
  classDow: number | null;
  courseStart: string | null;
  students: { id: string; joined_on?: string | null }[];
  logs: { student_id: string; played_on: string; created_at?: string | null }[];
  grades: { student_id: string; self_badge: number | null }[];
  today?: string;
}

export const EMPTY_STATS: BatchStats = { done: null, thisWeek: null, onTime: null, active: null, confidence: null };

const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);

/** Every session date from `from` up to and including `to`. */
export function sessionDatesBetween(weekOne: string, to: string): string[] {
  const dates: string[] = [];
  for (let week = weekOne; week <= to; week = addDaysIso(week, 7)) {
    for (const o of SESSION_DAY_OFFSETS) {
      const d = addDaysIso(week, o);
      if (d <= to) dates.push(d);
    }
  }
  return dates;
}

export function batchStats(input: BatchStatsInput): BatchStats {
  const today = input.today ?? toLocalIso();
  const dow = input.classDow ?? 6;
  if (!input.courseStart || !input.students.length) return EMPTY_STATS;
  const weekOne = planWeekOneStart(input.courseStart, dow);
  if (weekOne > today) return EMPTY_STATS;

  const allDue = sessionDatesBetween(weekOne, today);
  const thisWeekStart = classWeekStart(dow, today);
  const recently = addDaysIso(today, -13);
  const ids = new Set(input.students.map((s) => s.id));

  // Each student's ticked days, and when each was actually ticked.
  const ticked = new Map<string, Map<string, string | null>>();
  for (const l of input.logs) {
    if (!ids.has(l.student_id)) continue;
    if (!ticked.has(l.student_id)) ticked.set(l.student_id, new Map());
    const days = ticked.get(l.student_id)!;
    const when = l.created_at ? toLocalIso(new Date(l.created_at)) : null;
    // A day logged twice keeps its earliest tick.
    const had = days.get(l.played_on);
    if (!days.has(l.played_on) || (when && (!had || when < had))) days.set(l.played_on, when);
  }

  let due = 0, done = 0, weekDue = 0, weekDone = 0, onTime = 0, timed = 0, active = 0;
  for (const s of input.students) {
    const days = ticked.get(s.id) ?? new Map<string, string | null>();
    const from = s.joined_on && s.joined_on > weekOne ? s.joined_on : weekOne;
    for (const d of allDue) {
      if (d < from) continue;
      const inWeek = d >= thisWeekStart;
      due++;
      if (inWeek) weekDue++;
      if (!days.has(d)) continue;
      done++;
      if (inWeek) weekDone++;
      const when = days.get(d);
      if (when) {
        timed++;
        if (when <= addDaysIso(d, 1)) onTime++;
      }
    }
    if ([...days.values()].some((when) => when != null && when >= recently)) active++;
  }

  const grades = input.grades.filter((g) => ids.has(g.student_id) && (g.self_badge ?? 0) > 0);
  const confidence = grades.length
    ? Math.round((grades.reduce((n, g) => n + (g.self_badge ?? 0), 0) / (grades.length * 5)) * 100)
    : null;

  return {
    done: pct(done, due),
    thisWeek: pct(weekDone, weekDue),
    onTime: pct(onTime, timed),
    active: pct(active, input.students.length),
    confidence,
  };
}

/** The five, in the order they are shown, with what each one means. */
export const STAT_LABELS: { key: keyof BatchStats; label: string; hint: string }[] = [
  { key: "done", label: "Practice done", hint: "Sessions ticked, of all those due since the first class" },
  { key: "thisWeek", label: "This week", hint: "Sessions ticked this class week, of those due so far" },
  { key: "onTime", label: "On time", hint: "Of sessions ticked, those ticked on their day or the day after" },
  { key: "active", label: "Active", hint: "Students who ticked a session in the last 14 days" },
  { key: "confidence", label: "Confidence", hint: "Average of students' own song grades, out of the top grade" },
];
