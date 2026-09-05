import { useMemo } from "react";
import { useStudentClassConfig } from "@/hooks/useBatchCoursework";
import { useStudentCoursePlan, shiftedPlanWeek, daysForWeek } from "@/hooks/useCoursePlan";
import { useCourseVideos, useSignedVideoUrls } from "@/hooks/useCourseVideos";
import { isoMonday, planWeekOneMonday, useStudentBatchDay } from "@/hooks/useWeeklyPlan";
import type { VideoNote } from "@/hooks/useCoursePlan";

const EMPTY_NOTES: Record<string, VideoNote> = {};

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
  const { instrument, courseStartDate, shiftWeeks } = useStudentClassConfig();
  const { days: planDays } = useStudentCoursePlan(instrument);
  const { data: allVideos = [] } = useCourseVideos(instrument);
  const { data: batch } = useStudentBatchDay();
  const classDow = batch?.day_of_week ?? 6;

  const planDay = useMemo(() => {
    if (!day || !courseStartDate) return null;
    const weekOne = planWeekOneMonday(courseStartDate, classDow);
    const wk = shiftedPlanWeek(weekOne, isoMonday(new Date(day.scheduled_date)), shiftWeeks);
    if (!wk) return null;
    return daysForWeek(planDays, wk)[day.session_index] ?? null;
  }, [day?.scheduled_date, day?.session_index, courseStartDate, classDow, shiftWeeks, planDays]);

  const videos = useMemo(() => {
    const ids = planDay?.video_ids ?? [];
    return ids.map((id) => allVideos.find((v) => v.id === id)).filter(Boolean) as typeof allVideos;
  }, [planDay, allVideos]);

  const { data: urls = {} } = useSignedVideoUrls(videos.map((v) => v.storage_path));

  // What the admin wrote around each clip for this particular day.
  const notes = planDay?.video_notes ?? EMPTY_NOTES;

  return { videos, urls, notes };
}
