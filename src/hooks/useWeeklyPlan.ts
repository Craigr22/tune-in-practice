// Weekly plan orchestration. Builds three continuous sessions per week.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";
import { useSongProgress } from "@/hooks/useStudentProgress";
import { SESSION_ORDER, SESSION_TEMPLATES } from "@/lib/sessionTemplates";
import { SONGS } from "@/data/songs";
import {
  shiftedPlanWeek,
  daysForWeek,
  useStudentCoursePlan,
  type CoursePlanDay,
} from "@/hooks/useCoursePlan";
import { useStudentSongs, useStudentClassConfig } from "@/hooks/useBatchCoursework";
import type { SongProgress } from "@/hooks/useStudentProgress";
import { useEffect, useMemo } from "react";
import { addDaysIso, todayLocalIso } from "@/lib/date";
import { classWeekStart, planWeekOneStart, sessionDatesForWeek } from "@/lib/practiceWeek";
import { rowsToWrite } from "@/lib/planSync";
import { rpcError } from "@/lib/rpc";

export interface WeeklyPlanSession {
  id: string;
  student_id: string;
  week_start: string;
  session_index: number;
  scheduled_date: string;
  session_type: "build" | "flow" | "stretch";
  song_id: string;
  instruction: string;
  target_min: number;
  completed: boolean;
  generated_at: string;
  completed_at: string | null;
}

/** Convert the legacy storage shape at the database boundary only. */
const sessionFromStorage = (row: any): WeeklyPlanSession => ({
  id: row.id,
  student_id: row.student_id,
  week_start: row.week_start,
  session_index: row.session_index,
  scheduled_date: row.scheduled_date,
  session_type: row.session_type,
  song_id: row.focus_song_id,
  instruction: row.focus_instruction,
  target_min: Number(row.warmup_target_min || 0) + Number(row.focus_target_min || 0) + Number(row.bonus_target_min || 0),
  completed: !!row.completed_at || (!!row.warmup_completed && !!row.focus_completed && !!row.bonus_completed),
  generated_at: row.generated_at,
  completed_at: row.completed_at,
});

const sessionToStorage = (row: any) => ({
  student_id: row.student_id,
  week_start: row.week_start,
  session_index: row.session_index,
  scheduled_date: row.scheduled_date,
  session_type: row.session_type,
  focus_song_id: row.song_id,
  focus_instruction: row.instruction,
  focus_target_min: row.target_min,
  generated_at: row.generated_at,
});

/* ----- date helpers (local dates — see src/lib/date.ts) ----- */
const addDays = addDaysIso;
const todayIso = todayLocalIso;

// Kept exported from here: the plan's callers reach for the week shape and the
// hooks in the same breath.
export {
  SESSION_DAY_OFFSETS,
  classWeekStart,
  sessionDatesForWeek,
  planWeekOneStart,
} from "@/lib/practiceWeek";

/** Minimal shape both the static catalog and a class's effective song list satisfy. */
export type PracticePoolSong = {
  id: string;
  title?: string;
  fingerstyle?: boolean;
  state?: string;
  track: number | "fs";
  order: number;
};

function pickPracticeSong(progress: SongProgress[], pool?: PracticePoolSong[]): PracticePoolSong | undefined {
  // A class pool arrives pre-filtered (unlocked only) and in the teacher's order — keep it.
  // The static catalog needs sorting by track/order.
  const ordered = (pool && pool.length ? pool : [...SONGS])
    .filter((s) => !s.fingerstyle && s.state !== "locked");
  const sorted = pool && pool.length
    ? ordered
    : ordered.slice().sort((a, b) => (Number(a.track) || 99) - (Number(b.track) || 99) || a.order - b.order);
  const inProgress = sorted.find((s) => {
    const p = progress.find((pp) => pp.song_id === s.id);
    return (p?.teacher_badge ?? 0) > 0 && (p?.teacher_badge ?? 0) < 5;
  });
  return inProgress ?? sorted.find((s) => s.state === "in-progress" || s.state === "next") ?? sorted[0];
}

/* ----- main generator ----- */
interface GenInput {
  studentId: string;
  weekStart: string;
  weekNumber: number;
  progress: SongProgress[];
  /** Class-effective song list (unlocked, teacher-ordered). Falls back to the static catalog. */
  pool?: PracticePoolSong[];
  /** The admin's planned days for this week (day 1..3). Used verbatim when present. */
  planDays?: CoursePlanDay[];
  /** Nothing is planned before this date — the class hasn't started yet. */
  notBefore?: string | null;
}

export function buildWeekRows(input: GenInput) {
  const { studentId, weekStart, progress, pool, planDays, notBefore } = input;
  const dates = sessionDatesForWeek(weekStart);

  // While a week is covered by the admin's course plan, use those days
  // verbatim — a human planned this week, so nothing is generated.
  // Days before the class starts aren't practice days at all.
  const onOrAfterStart = (iso: string) => !notBefore || iso >= notBefore;

  if (planDays?.length) {
    return SESSION_ORDER.map((kind, i) => {
      const day = planDays[i];
      const tpl = SESSION_TEMPLATES[kind];
      const songId = day?.song_id ?? pool?.[0]?.id ?? SONGS[0].id;
      return {
        student_id: studentId,
        week_start: weekStart,
        session_index: i,
        scheduled_date: dates[i],
        session_type: kind,
        song_id: songId,
        instruction: day?.instruction || tpl.instruction,
        target_min: tpl.targetMin,
        generated_at: new Date().toISOString(),
      };
    }).filter((r) => onOrAfterStart(r.scheduled_date));
  }

  const chosen = pickPracticeSong(progress, pool);
  const songId = chosen?.id ?? SONGS[0].id;
  const rows = SESSION_ORDER.map((kind, i) => {
    const tpl = SESSION_TEMPLATES[kind];
    return {
      student_id: studentId,
      week_start: weekStart,
      session_index: i,
      scheduled_date: dates[i],
      session_type: kind,
      song_id: songId,
      instruction: tpl.instruction,
      target_min: tpl.targetMin,
      generated_at: new Date().toISOString(),
    };
  });
  return rows.filter((r) => onOrAfterStart(r.scheduled_date));
}

/* ----- hooks ----- */

export function useStudentBatchDay() {
  const { data: student } = useStudentMe();
  return useQuery({
    queryKey: ["student-batch-day", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("batches:batch_id(day_of_week, start_time, semester_start)")
        .eq("student_id", student!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const b = (data as { batches: { day_of_week: number; start_time: string; semester_start: string | null } | null })?.batches;
      return b
        ? { day_of_week: b.day_of_week, start_time: b.start_time, semester_start: b.semester_start ?? null }
        : null;
    },
  });
}

export function addWeeks(iso: string, n: number): string {
  return addDaysIso(iso, n * 7);
}

export function useWeeklyPlan(weekStartArg?: string) {
  const { data: student } = useStudentMe();
  const { data: batch } = useStudentBatchDay();
  // Without an explicit week, "this week" is the one that began at the last
  // class — so it can't be worked out until the class day is known.
  const weekStart = weekStartArg ?? (batch ? classWeekStart(batch.day_of_week) : null);
  return useQuery({
    queryKey: ["weekly-plan", student?.id, weekStart],
    enabled: !!student?.id && !!weekStart,
    queryFn: async (): Promise<WeeklyPlanSession[]> => {
      const { data, error } = await supabase
        .from("weekly_plan_sessions")
        .select("*")
        .eq("student_id", student!.id)
        .eq("week_start", weekStart!)
        .order("session_index");
      if (error) throw error;
      return (data ?? []).map(sessionFromStorage);
    },
  });
}

export function useEnsureWeeklyPlan(weekStartArg?: string) {
  const qc = useQueryClient();
  const { data: student } = useStudentMe();
  const { data: batch } = useStudentBatchDay();
  const { data: progress = [] } = useSongProgress();
  const classSongs = useStudentSongs();
  const { instrument, courseStartDate, shiftWeeks } = useStudentClassConfig();
  const { days: allPlanDays } = useStudentCoursePlan(instrument);
  const weekStart = weekStartArg ?? (batch ? classWeekStart(batch.day_of_week) : null);
  const { data: existing } = useWeeklyPlan(weekStart ?? undefined);

  // The plan is a pure template with no dates of its own: a student follows it
  // from their class's first practice week.
  const weekOneStart =
    courseStartDate && batch ? planWeekOneStart(courseStartDate, batch.day_of_week) : null;
  const planWeek = weekStart ? shiftedPlanWeek(weekOneStart, weekStart, shiftWeeks) : null;
  const planDays = planWeek ? daysForWeek(allPlanDays, planWeek) : [];
  // A student's practice can't begin before their class does — and the class
  // begins at its first lesson, not at the date typed into the settings.
  const notBefore = weekOneStart;

  /**
   * What a planned week currently says. When an admin edits the plan — or when
   * a class's start date moves the week onto different plan content — sessions
   * that were generated earlier are stale, so this drives a re-sync.
   */
  const planSignature = planDays
    .map((d) => `${d.song_id}|${d.instruction}`)
    .join("~");

  useEffect(() => {
    if (!student?.id || !weekStart) return;
    if (existing === undefined) return; // still loading
    // Nothing exists before the first lesson. Without this, paging the week
    // strip back through the run-up to the course generated practice into
    // those weeks — sessions in the past, for a course that had not started.
    if (weekOneStart && weekStart < weekOneStart) return;
    // Wait for the course plan before generating, so a planned week isn't
    // filled with generated content just because the query hadn't landed.
    if (weekOneStart && !allPlanDays.length) return;

    const weeksSinceJoin = Math.floor(
      (new Date(weekStart).getTime() - new Date(student.joined_on).getTime()) / (7 * 86_400_000)
    );
    const weekNumber = Math.max(1, weeksSinceJoin + 1);

    const rows = buildWeekRows({
      studentId: student.id,
      weekStart,
      weekNumber,
      progress,
      pool: classSongs,
      planDays,
      notBefore,
    });

    if (!rows.length) return;

    const toWrite = rowsToWrite(rows, existing, { planned: planDays.length > 0, today: todayIso() });
    if (!toWrite.length) return;

    (async () => {
      const { error } = await supabase
        .from("weekly_plan_sessions")
        .upsert(toWrite.map(sessionToStorage), { onConflict: "student_id,week_start,session_index" });
      if (error) {
        // Refetching what was not written only spends another request.
        console.error("[weekly-plan] upsert failed", error);
        return;
      }
      qc.invalidateQueries({ queryKey: ["weekly-plan", student.id, weekStart] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, existing?.length, batch?.day_of_week, weekStart, weekOneStart, shiftWeeks, allPlanDays.length, planSignature]);
}

/**
 * Persist completion through the existing database contract.
 *
 * Each compatibility call and the resulting practice log update happen in a
 * server transaction, keeping previously stored plans valid.
 *
 * Idempotent, so a double tap completes once.
 */
function usePersistCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; segment: "warmup" | "focus" | "bonus" }) => {
      const { error } = await (supabase as any).rpc("complete_practice_segment", {
        p_session_id: args.id,
        p_segment: args.segment,
      });
      if (error) throw rpcError(error, "Saving practice");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weekly-plan"] });
      qc.invalidateQueries({ queryKey: ["next-session"] });
      qc.invalidateQueries({ queryKey: ["practice-logs"] });
      qc.invalidateQueries({ queryKey: ["song-progress"] });
    },
  });
}

/**
 * Finish a day's practice in one action.
 *
 * The storage adapter fulfills the existing database contract, then the
 * server completes the session and writes the practice log. Every call is
 * idempotent, so retrying a partially saved action is safe. Shared so the home
 * page and week strip finish a day the same way.
 */
export function useFinishDay() {
  const complete = usePersistCompletion();
  const finish = async (sessionId: string) => {
    for (const segment of ["warmup", "focus", "bonus"] as const) {
      await complete.mutateAsync({ id: sessionId, segment });
    }
  };
  return { finish, isPending: complete.isPending };
}

/**
 * The next practice session after today, whichever week it falls in.
 *
 * `useTodaysSession` only sees the current week, so from the last practice day
 * until Monday it has nothing to offer — on a Mon/Wed/Fri plan that's three
 * days in seven where the page could say nothing about what comes next.
 */
export function useNextSession(): WeeklyPlanSession | undefined {
  const { data: student } = useStudentMe();
  const today = todayIso();
  const { data } = useQuery({
    queryKey: ["next-session", student?.id, today],
    enabled: !!student?.id,
    queryFn: async (): Promise<WeeklyPlanSession | null> => {
      const { data, error } = await supabase
        .from("weekly_plan_sessions")
        .select("*")
        .eq("student_id", student!.id)
        .gt("scheduled_date", today)
        .is("completed_at", null)
        .order("scheduled_date")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? sessionFromStorage(data) : null;
    },
  });
  return data ?? undefined;
}

/**
 * Today's session, if today is a practice day.
 *
 * This used to fall back to the next unfinished session in the week when today
 * had none, which quietly put tomorrow's work on today's page — the very thing
 * the home page is meant not to do.
 *
 * A finished session still counts as today's. Dropping it the moment it was
 * completed emptied the page, so the material a student had just worked
 * through — and might want to play again — went with it.
 */
export function useTodaysSession(): WeeklyPlanSession | undefined {
  const { data: plan } = useWeeklyPlan();
  const today = todayIso();
  return useMemo(() => plan?.find((s) => s.scheduled_date === today), [plan, today]);
}
