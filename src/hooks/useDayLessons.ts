import { useMemo } from "react";
import { useStudentClassConfig } from "@/hooks/useBatchCoursework";
import { useStudentCoursePlan, planWeekNumberFor, daysForWeek } from "@/hooks/useCoursePlan";
import { useCourseVideos, useSignedVideoUrls } from "@/hooks/useCourseVideos";
import { isoMonday, planWeekOneMonday, useStudentBatchDay } from "@/hooks/useWeeklyPlan";

/** Enough of a session to locate its day in the course plan. */
export interface LessonDay {
  scheduled_date: string;
  session_index: number;
}

/**
 * The clips planned for one practice day.
 *
 * Videos hang off the admin's course plan rather than off the student's own
 * session row, so they're resolved live: which course week the date falls in,
 * then which day of that week. Taking a session as an argument means the same
 * lookup serves today's practice and any other day the student looks at.
 */
export function useDayLessons(day: LessonDay | null | undefined) {
  const { instrument, courseStartDate } = useStudentClassConfig();
  const { days: planDays } = useStudentCoursePlan(instrument);
  const { data: allVideos = [] } = useCourseVideos(instrument);
  const { data: batch } = useStudentBatchDay();
  const classDow = batch?.day_of_week ?? 6;

  const planDay = useMemo(() => {
    if (!day || !courseStartDate) return null;
    const weekOne = planWeekOneMonday(courseStartDate, classDow);
    const wk = planWeekNumberFor(weekOne, isoMonday(new Date(day.scheduled_date)));
    if (!wk) return null;
    return daysForWeek(planDays, wk)[day.session_index] ?? null;
  }, [day?.scheduled_date, day?.session_index, courseStartDate, classDow, planDays]);

  const videos = useMemo(() => {
    const ids = planDay?.video_ids ?? [];
    return ids.map((id) => allVideos.find((v) => v.id === id)).filter(Boolean) as typeof allVideos;
  }, [planDay, allVideos]);

  const { data: urls = {} } = useSignedVideoUrls(videos.map((v) => v.storage_path));

  return { videos, urls };
}
