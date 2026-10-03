import { useMemo } from "react";
import { useStudentClassConfig } from "@/hooks/useBatchCoursework";
import { useStudentCoursePlan, shiftedPlanWeek } from "@/hooks/useCoursePlan";
import { classWeekStart, planWeekOneStart, useStudentBatchDay } from "@/hooks/useWeeklyPlan";
import { chickStage, tierForWeek, type ChickStage } from "@/lib/chick";

/** The signed-in student's chick, from the week their class is on. */
export function useChickStage(): ChickStage {
  const { instrument, courseStartDate, shiftWeeks } = useStudentClassConfig();
  const { days } = useStudentCoursePlan(instrument);
  const { data: batch } = useStudentBatchDay();
  const classDow = batch?.day_of_week ?? 6;
  const week = courseStartDate
    ? shiftedPlanWeek(planWeekOneStart(courseStartDate, classDow), classWeekStart(classDow), shiftWeeks)
    : null;
  return useMemo(() => {
    const lastWeek = days.length ? Math.max(...days.map((d) => d.week_number)) : null;
    return chickStage({ week, tier: tierForWeek(days, week), lastWeek });
  }, [days, week]);
}
