import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import type { Instrument } from "@/hooks/useSongCatalog";
import type { TierKey } from "@/lib/tiers";
import { isoMondayOf } from "@/lib/date";

/** Practice days in a week — matches the three weekly-plan sessions. */
export const PLAN_DAYS_PER_WEEK = 3;

/** What a student reads around a clip on this day. */
export interface VideoNote {
  above?: string;
  below?: string;
}

export interface CoursePlanDay {
  id: string;
  instrument: Instrument;
  week_number: number;
  day_number: number;
  class_topic: string | null;
  focus_song_id: string | null;
  warmup_instruction: string;
  focus_instruction: string;
  bonus_instruction: string;
  video_ids: string[];
  /** Per-clip notes for this day, keyed by video id. */
  video_notes: Record<string, VideoNote>;
  /** Which Journey stage this week belongs to. */
  tier: TierKey;
  updated_at?: string;
}

export interface CoursePlanSettings {
  instrument: Instrument;
  title: string;
  week_one_start: string | null;
}

const EMPTY_DAYS: CoursePlanDay[] = [];

export function useCoursePlanDays(instrument: Instrument) {
  return useQuery({
    queryKey: ["course-plan-days", instrument],
    queryFn: async (): Promise<CoursePlanDay[]> => {
      const { data, error } = await (supabase as any)
        .from("course_plan_days")
        .select("*")
        .eq("instrument", instrument)
        .order("week_number")
        .order("day_number");
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        video_ids: d.video_ids ?? [],
        video_notes: (d.video_notes ?? {}) as Record<string, VideoNote>,
        tier: (d.tier ?? "beginner") as TierKey,
      })) as CoursePlanDay[];
    },
  });
}

export function useCoursePlanSettings(instrument: Instrument) {
  return useQuery({
    queryKey: ["course-plan-settings", instrument],
    queryFn: async (): Promise<CoursePlanSettings> => {
      const { data, error } = await (supabase as any)
        .from("course_plan_settings")
        .select("*")
        .eq("instrument", instrument)
        .maybeSingle();
      if (error) throw error;
      return {
        instrument,
        title: data?.title ?? "Course 1",
        week_one_start: data?.week_one_start ?? null,
      };
    },
  });
}

export function useSaveCoursePlanDay(instrument: Instrument) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (day: Partial<CoursePlanDay> & { week_number: number; day_number: number }) => {
      const { id, ...rest } = day;
      const write = (row: Record<string, unknown>) =>
        (supabase as any)
          .from("course_plan_days")
          .upsert(
            { ...row, instrument, updated_at: new Date().toISOString() },
            { onConflict: "instrument,week_number,day_number" },
          );

      const { error } = await write(rest);
      if (!error) return;

      // The per-clip notes are a column added by migration. Until it lands,
      // save everything else rather than losing the whole day's edits.
      if (/video_notes/.test(error.message ?? "")) {
        const { video_notes, ...withoutNotes } = rest as Record<string, unknown>;
        const retry = await write(withoutNotes);
        if (retry.error) throw retry.error;
        return;
      }
      throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-plan-days", instrument] }),
  });
}

export function useSaveCoursePlanSettings(instrument: Instrument) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { title?: string; week_one_start?: string | null }) => {
      const { error } = await (supabase as any)
        .from("course_plan_settings")
        .upsert(
          { instrument, ...patch, updated_at: new Date().toISOString() },
          { onConflict: "instrument" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-plan-settings", instrument] }),
  });
}

export function useAddPlanWeek(instrument: Instrument) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (weekNumber: number) => {
      const rows = Array.from({ length: PLAN_DAYS_PER_WEEK }, (_, i) => ({
        instrument,
        week_number: weekNumber,
        day_number: i + 1,
      }));
      const { error } = await (supabase as any)
        .from("course_plan_days")
        .upsert(rows, { onConflict: "instrument,week_number,day_number" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-plan-days", instrument] }),
  });
}

export function useDeletePlanWeek(instrument: Instrument) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (weekNumber: number) => {
      const { error } = await (supabase as any)
        .from("course_plan_days")
        .delete()
        .eq("instrument", instrument)
        .eq("week_number", weekNumber);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-plan-days", instrument] }),
  });
}

/* ---------------- student side ---------------- */

/** Which curriculum week (1-based) a given ISO Monday falls on, or null. */
export function planWeekNumberFor(weekOneStart: string | null, weekStart: string): number | null {
  if (!weekOneStart) return null;
  const start = new Date(isoMondayOf(weekOneStart)).getTime();
  const week = new Date(weekStart).getTime();
  if (Number.isNaN(start) || Number.isNaN(week) || week < start) return null;
  return Math.round((week - start) / (7 * 86_400_000)) + 1;
}

/**
 * The curriculum week a date falls on, once the class's pauses are taken off.
 *
 * A class that lost a week is a week behind the calendar, so it should still
 * be shown the week it hasn't done yet.
 */
export function shiftedPlanWeek(
  weekOneStart: string | null,
  weekStart: string,
  shiftWeeks: number,
): number | null {
  const wk = planWeekNumberFor(weekOneStart, weekStart);
  // Before the course starts there is genuinely nothing planned.
  if (wk == null) return null;
  // A pause runs the previous week again, so a paused class keeps practising
  // what it has been taught. Held at week 1 rather than falling off the plan:
  // dropping out would hand students generated practice unrelated to their
  // lessons, which is the gap a pause is meant to avoid.
  return Math.max(1, wk - shiftWeeks);
}

/** The plan (settings + days) a student's weekly plan should be built from. */
export function useStudentCoursePlan(instrument: Instrument) {
  const { data: settings } = useCoursePlanSettings(instrument);
  const { data: days = EMPTY_DAYS } = useCoursePlanDays(instrument);
  return { weekOneStart: settings?.week_one_start ?? null, days };
}

/** The three plan days for one curriculum week, ordered day 1..3. */
export function daysForWeek(days: CoursePlanDay[], weekNumber: number): CoursePlanDay[] {
  return days
    .filter((d) => d.week_number === weekNumber)
    .sort((a, b) => a.day_number - b.day_number);
}

/** One song's place on the course. */
export interface CourseStop {
  songId: string;
  /** Curriculum week it is taught in — real if planned, projected if not. */
  week: number;
  tier: TierKey;
  /** False for songs the admin hasn't scheduled a week for yet. */
  planned: boolean;
}

/** A song's place in the plan: the first week that teaches it. */
function plannedStops(days: CoursePlanDay[]): CourseStop[] {
  const seen = new Set<string>();
  const stops: CourseStop[] = [];
  const inOrder = [...days].sort(
    (a, b) => a.week_number - b.week_number || a.day_number - b.day_number,
  );
  for (const d of inOrder) {
    if (!d.focus_song_id || seen.has(d.focus_song_id)) continue;
    seen.add(d.focus_song_id);
    stops.push({ songId: d.focus_song_id, week: d.week_number, tier: d.tier, planned: true });
  }
  return stops;
}

/**
 * The course in the order it is taught.
 *
 * The admin's plan comes first and is authoritative: a song sits at the week
 * that teaches it. Songs the plan hasn't reached yet follow in the course's
 * own order, each projected a week later than the last planned week, so the
 * map keeps reading as a sequence rather than stopping dead at the end of
 * whatever has been scheduled.
 */
export function courseOrder(
  days: CoursePlanDay[],
  fallback: Record<string, number>,
  opts: {
    fallbackTier?: TierKey;
    /** Everything else in the catalogue, so no song drops off the map. */
    rest?: { songId: string; tier: TierKey }[];
  } = {},
): CourseStop[] {
  const { fallbackTier = "beginner", rest = [] } = opts;
  const planned = plannedStops(days);
  const seen = new Set(planned.map((s) => s.songId));
  let week = planned.reduce((n, s) => Math.max(n, s.week), 0);

  const next = (songId: string, tier: TierKey): CourseStop => {
    seen.add(songId);
    return { songId, week: ++week, tier, planned: false };
  };

  const afterPlan = Object.entries(fallback)
    .filter(([songId]) => !seen.has(songId))
    .sort((a, b) => a[1] - b[1])
    .map(([songId]) => next(songId, fallbackTier));

  const remainder = rest
    .filter((r) => !seen.has(r.songId))
    .map((r) => next(r.songId, r.tier));

  return [...planned, ...afterPlan, ...remainder];
}

/** How far ahead of the current week the map shows. */
export const WEEKS_AHEAD = 2;

/**
 * Mark how much of the course is in reach.
 *
 * The whole map stays on screen — a student can see where the course goes —
 * but anything more than two weeks out is greyed, so what to work on now is
 * obvious without the rest being hidden. Before the course starts, weeks 1
 * and 2 are the ones in reach.
 */
export function withHorizon(
  stops: CourseStop[],
  currentWeek: number | null,
  weeksAhead: number = WEEKS_AHEAD,
): (CourseStop & { upcoming: boolean })[] {
  const week = currentWeek ?? 0;
  return stops.map((s) => ({ ...s, upcoming: s.week > week + weeksAhead }));
}
