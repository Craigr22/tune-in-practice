// Weekly plan orchestration. Builds 3 sessions per ISO week per student,
// stored in `weekly_plan_sessions`. Calls deterministic warmup/bonus generators.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";
import { usePracticeLogs, useSongProgress } from "@/hooks/useStudentProgress";
import { SESSION_ORDER, SESSION_TEMPLATES } from "@/lib/sessionTemplates";
import { generateWarmup, generateBonus } from "@/lib/sessionSegments";
import { SONGS } from "@/data/songs";
import {
  planWeekNumberFor,
  daysForWeek,
  useStudentCoursePlan,
  type CoursePlanDay,
} from "@/hooks/useCoursePlan";
import { useStudentSongs, useStudentClassConfig } from "@/hooks/useBatchCoursework";
import type { SongProgress, PracticeLog } from "@/hooks/useStudentProgress";
import { useEffect, useMemo } from "react";
import { isoMondayOf, addDaysIso, todayLocalIso } from "@/lib/date";
import { rowsToWrite } from "@/lib/planSync";

export interface WeeklyPlanSession {
  id: string;
  student_id: string;
  week_start: string;
  session_index: number;
  scheduled_date: string;
  session_type: "build" | "flow" | "stretch";
  focus_song_id: string;
  focus_instruction: string;
  focus_target_min: number;
  warmup_target_min: number;
  warmup_song_id: string | null;
  warmup_instruction: string;
  bonus_target_min: number;
  bonus_type: "callback_song" | "mini_challenge" | "jam" | "foundation_refresh";
  bonus_song_id: string | null;
  bonus_instruction: string;
  warmup_completed: boolean;
  focus_completed: boolean;
  bonus_completed: boolean;
  generated_at: string;
  completed_at: string | null;
}

/* ----- date helpers (local dates — see src/lib/date.ts) ----- */
export const isoMonday = (d: Date | string = new Date()) => isoMondayOf(d);
const addDays = addDaysIso;
const todayIso = todayLocalIso;

/** Three practice days spaced ~1 rest day apart, avoiding the class weekday. */
export function practiceDaysForWeek(weekStart: string, classDayOfWeek: number /* 0=Sun..6=Sat */): string[] {
  // weekStart is Monday; offsets relative to Monday: Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6.
  // Map JS day (0=Sun..6=Sat) to Monday-based offset (Mon=0..Sun=6).
  const classOffset = (classDayOfWeek + 6) % 7;
  // Candidate spread: 3 days with rest. Prefer Mon/Wed/Fri, then shift if class lands on one.
  const presets: number[][] = [
    [0, 2, 4], [1, 3, 5], [0, 3, 5], [1, 2, 4], [0, 2, 5], [1, 3, 4],
  ];
  for (const p of presets) {
    if (!p.includes(classOffset)) return p.map((o) => addDays(weekStart, o));
  }
  return presets[0].map((o) => addDays(weekStart, o));
}

/**
 * The Monday of course week 1.
 *
 * Week numbers used to be counted from the calendar week containing the class's
 * start date. But practice never runs before that date, so a class starting on
 * a Sunday — the last day of its week — had no practice days left in it: course
 * week 1 passed without a single session, and the student's first real week of
 * practice was served week 2's material and week 2's videos.
 *
 * Week 1 is therefore the first week that actually holds a practice day.
 */
export function planWeekOneMonday(courseStart: string, classDayOfWeek: number): string {
  const monday = isoMondayOf(courseStart);
  const hasPractice = practiceDaysForWeek(monday, classDayOfWeek).some((d) => d >= courseStart);
  return hasPractice ? monday : addDays(monday, 7);
}

/* ----- focus song pick ----- */
/** Minimal shape both the static catalog and a class's effective song list satisfy. */
export type FocusPoolSong = {
  id: string;
  title?: string;
  fingerstyle?: boolean;
  state?: string;
  track: number | "fs";
  order: number;
};

function pickFocusSong(progress: SongProgress[], pool?: FocusPoolSong[]): FocusPoolSong | undefined {
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
  classDayOfWeek: number;
  weekNumber: number;
  progress: SongProgress[];
  logs: PracticeLog[];
  existing?: WeeklyPlanSession[];
  /** Class-effective song list (unlocked, teacher-ordered). Falls back to the static catalog. */
  pool?: FocusPoolSong[];
  /** Distinct songs to fit into a single 30-min session (1–3). 3 = warmup/focus/bonus all distinct. */
  songsPerSession?: number;
  /** Per-practice-day counts, in session order. Overrides songsPerSession per day. */
  songsPerDay?: number[];
  /** The admin's planned days for this week (day 1..3). Used verbatim when present. */
  planDays?: CoursePlanDay[];
  /** Nothing is planned before this date — the class hasn't started yet. */
  notBefore?: string | null;
}

export function buildWeekRows(input: GenInput) {
  const { studentId, weekStart, classDayOfWeek, weekNumber, progress, logs, existing = [], pool, songsPerSession = 3, songsPerDay, planDays, notBefore } = input;
  const dates = practiceDaysForWeek(weekStart, classDayOfWeek);

  // While a week is covered by the admin's course plan, use those days
  // verbatim — a human planned this week, so nothing is generated.
  // Days before the class starts aren't practice days at all.
  const onOrAfterStart = (iso: string) => !notBefore || iso >= notBefore;

  if (planDays?.length) {
    return SESSION_ORDER.map((kind, i) => {
      const day = planDays[i];
      const tpl = SESSION_TEMPLATES[kind];
      const songId = day?.focus_song_id ?? pool?.[0]?.id ?? SONGS[0].id;
      return {
        student_id: studentId,
        week_start: weekStart,
        session_index: i,
        scheduled_date: dates[i],
        session_type: kind,
        focus_song_id: songId,
        focus_instruction: day?.focus_instruction || tpl.focus_instruction,
        focus_target_min: tpl.focus_target_min,
        warmup_target_min: tpl.warmup_target_min,
        warmup_song_id: null as string | null,
        warmup_instruction: day?.warmup_instruction || "Tune up and loosen your hands.",
        bonus_target_min: tpl.bonus_target_min,
        bonus_type: "callback_song" as const,
        bonus_song_id: songId,
        bonus_instruction: day?.bonus_instruction || "Finish with a song you enjoy.",
        generated_at: new Date().toISOString(),
      };
    }).filter((r) => onOrAfterStart(r.scheduled_date));
  }

  const focus = pickFocusSong(progress, pool);
  const focusId = focus?.id ?? SONGS[0].id;
  const focusTitle = focus?.title ?? "your focus song";

  const recentWarmupIds: string[] = existing
    .slice()
    .sort((a, b) => b.session_index - a.session_index)
    .map((r) => r.warmup_song_id || "")
    .filter(Boolean)
    .slice(0, 2);

  let previousBonusType: GenInput["existing"][number]["bonus_type"] | null = null;
  const rows = SESSION_ORDER.map((kind, i) => {
    const tpl = SESSION_TEMPLATES[kind];
    const warm = generateWarmup({
      progress, logs, currentSongId: focusId,
      recentWarmupIds, weekNumber,
    });
    const bonus = generateBonus({
      progress, logs, currentSongId: focusId,
      previousBonusType, weekNumber,
    });
    // Collapse distinct songs to honor the teacher's plan for THIS day.
    // 3 → warmup/focus/bonus all distinct. 2 → bonus folds into the focus song.
    // 1 → warmup + bonus both fold into the focus song (one song for the whole 30 min).
    const dayCount = songsPerDay?.[i] ?? songsPerSession;
    if (dayCount <= 2) {
      bonus.song_id = focusId;
      bonus.bonus_type = "callback_song";
      bonus.instruction = `Extra reps on ${focusTitle} to finish strong.`;
    }
    if (dayCount <= 1 && warm.song_id) {
      warm.song_id = focusId;
      warm.instruction = `Ease in with ${focusTitle} — slow and clean.`;
    }

    if (warm.song_id) recentWarmupIds.unshift(warm.song_id);
    previousBonusType = bonus.bonus_type;

    return {
      student_id: studentId,
      week_start: weekStart,
      session_index: i,
      scheduled_date: dates[i],
      session_type: kind,
      focus_song_id: focusId,
      focus_instruction: tpl.focus_instruction,
      focus_target_min: tpl.focus_target_min,
      warmup_target_min: tpl.warmup_target_min,
      warmup_song_id: warm.song_id,
      warmup_instruction: warm.instruction,
      bonus_target_min: tpl.bonus_target_min,
      bonus_type: bonus.bonus_type,
      bonus_song_id: bonus.song_id,
      bonus_instruction: bonus.instruction,
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
  const weekStart = weekStartArg ?? isoMonday();
  return useQuery({
    queryKey: ["weekly-plan", student?.id, weekStart],
    enabled: !!student?.id,
    queryFn: async (): Promise<WeeklyPlanSession[]> => {
      const { data, error } = await supabase
        .from("weekly_plan_sessions")
        .select("*")
        .eq("student_id", student!.id)
        .eq("week_start", weekStart)
        .order("session_index");
      if (error) throw error;
      return (data ?? []) as unknown as WeeklyPlanSession[];
    },
  });
}

export function useEnsureWeeklyPlan(weekStartArg?: string) {
  const qc = useQueryClient();
  const { data: student } = useStudentMe();
  const { data: batch } = useStudentBatchDay();
  const { data: progress = [] } = useSongProgress();
  const { data: logs = [] } = usePracticeLogs();
  const classSongs = useStudentSongs();
  const { songsPerSession, songsPerDay, instrument, courseStartDate } = useStudentClassConfig();
  const { days: allPlanDays } = useStudentCoursePlan(instrument);
  const weekStart = weekStartArg ?? isoMonday();
  const { data: existing } = useWeeklyPlan(weekStart);

  // The plan is a pure template with no dates of its own: a student follows it
  // from their class's first practice week.
  const weekOneStart = courseStartDate
    ? planWeekOneMonday(courseStartDate, batch?.day_of_week ?? 6)
    : null;
  const planWeek = planWeekNumberFor(weekOneStart, weekStart);
  const planDays = planWeek ? daysForWeek(allPlanDays, planWeek) : [];
  // A student's practice can't begin before their class does.
  const notBefore = courseStartDate ?? batch?.semester_start ?? null;

  /**
   * What a planned week currently says. When an admin edits the plan — or when
   * a class's start date moves the week onto different plan content — sessions
   * that were generated earlier are stale, so this drives a re-sync.
   */
  const planSignature = planDays
    .map((d) => `${d.focus_song_id}|${d.focus_instruction}|${d.warmup_instruction}|${d.bonus_instruction}`)
    .join("~");

  useEffect(() => {
    if (!student?.id) return;
    if (existing === undefined) return; // still loading
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
      classDayOfWeek: batch?.day_of_week ?? 6,
      weekNumber,
      progress,
      logs,
      existing: [],
      pool: classSongs,
      songsPerSession,
      songsPerDay,
      planDays,
      notBefore,
    });

    if (!rows.length) return;

    const toWrite = rowsToWrite(rows, existing, { planned: planDays.length > 0, today: todayIso() });
    if (!toWrite.length) return;

    (async () => {
      const { error } = await supabase
        .from("weekly_plan_sessions")
        .upsert(toWrite, { onConflict: "student_id,week_start,session_index" });
      if (error) console.error("[weekly-plan] upsert failed", error);
      qc.invalidateQueries({ queryKey: ["weekly-plan", student.id, weekStart] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, existing?.length, batch?.day_of_week, weekStart, weekOneStart, allPlanDays.length, planSignature]);
}

export function useCompleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; segment: "warmup" | "focus" | "bonus" }) => {
      const col = `${args.segment}_completed` as const;
      const { error } = await supabase
        .from("weekly_plan_sessions")
        .update({ [col]: true } as never)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-plan"] }),
  });
}

export function useMarkSessionComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("weekly_plan_sessions")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-plan"] }),
  });
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
      return (data ?? null) as unknown as WeeklyPlanSession | null;
    },
  });
  return data ?? undefined;
}

export function useTodaysSession(): WeeklyPlanSession | undefined {
  const { data: plan } = useWeeklyPlan();
  const today = todayIso();
  return useMemo(
    () => plan?.find((s) => s.scheduled_date === today && !s.completed_at) ?? plan?.find((s) => s.scheduled_date >= today && !s.completed_at),
    [plan, today]
  );
}
