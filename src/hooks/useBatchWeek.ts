import { toInstrument } from "@/hooks/useBatchCoursework";
import { useStudentCoursePlan, shiftedPlanWeek } from "@/hooks/useCoursePlan";
import { useBatchPlanShifts, totalShiftWeeks } from "@/hooks/useBatchPlanShift";
import { classWeekStart, planWeekOneStart } from "@/hooks/useWeeklyPlan";

interface BatchLike {
  id: string;
  day_of_week?: number | null;
  semester_start?: string | null;
  instruments?: { name?: string | null } | null;
}

/**
 * Where a class is in its course: the week it is on, out of how many the
 * plan runs to, and how long it has been paused. One reading of it, so the
 * class card, the class page and the course itself can't disagree.
 */
export function useBatchWeek(batch: BatchLike) {
  const instrument = toInstrument(batch.instruments?.name);
  const { days } = useStudentCoursePlan(instrument);
  const { data: shifts = [] } = useBatchPlanShifts(batch.id);
  const paused = totalShiftWeeks(shifts);
  const classDow = batch.day_of_week ?? 6;
  const start = batch.semester_start ?? null;
  const currentWeek = start
    ? shiftedPlanWeek(planWeekOneStart(start, classDow), classWeekStart(classDow), paused)
    : null;
  const totalWeeks = new Set(days.map((d) => d.week_number)).size;
  return { instrument, start, currentWeek, totalWeeks, paused };
}

/** "Week 3 of 12", or why there isn't one. */
export function weekLabel(w: { start: string | null; currentWeek: number | null; totalWeeks: number }): string {
  if (!w.start) return "Not started";
  if (!w.currentWeek) return `Starts ${w.start}`;
  if (!w.totalWeeks) return `Week ${w.currentWeek}`;
  if (w.currentWeek > w.totalWeeks) return `Past the ${w.totalWeeks}-week plan`;
  return `Week ${w.currentWeek} of ${w.totalWeeks}`;
}
