// Weekly plan orchestration. Builds 3 sessions per ISO week per student,
// stored in `weekly_plan_sessions`. Calls deterministic warmup/bonus generators.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";
import { usePracticeLogs, useSongProgress } from "@/hooks/useStudentProgress";
import { SESSION_ORDER, SESSION_TEMPLATES } from "@/lib/sessionTemplates";
import { generateWarmup, generateBonus } from "@/lib/sessionSegments";
import { SONGS } from "@/data/songs";
import { useStudentSongs, useStudentClassConfig } from "@/hooks/useBatchCoursework";
import type { SongProgress, PracticeLog } from "@/hooks/useStudentProgress";
import { useEffect, useMemo } from "react";

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

/* ----- date helpers ----- */
export function isoMonday(d = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  x.setDate(x.getDate() - ((day + 6) % 7));
  return x.toISOString().slice(0, 10);
}
const addDays = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const todayIso = () => new Date().toISOString().slice(0, 10);

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
}

export function buildWeekRows(input: GenInput) {
  const { studentId, weekStart, classDayOfWeek, weekNumber, progress, logs, existing = [], pool, songsPerSession = 3 } = input;
  const dates = practiceDaysForWeek(weekStart, classDayOfWeek);
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
    // Collapse distinct songs to honor the class's songs-per-session setting.
    // 3 → warmup/focus/bonus all distinct (default). 2 → bonus folds into the focus song.
    // 1 → warmup + bonus both fold into the focus song (one song for the whole 30 min).
    if (songsPerSession <= 2) {
      bonus.song_id = focusId;
      bonus.bonus_type = "callback_song";
      bonus.instruction = `Extra reps on ${focusTitle} to finish strong.`;
    }
    if (songsPerSession <= 1 && warm.song_id) {
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
  return rows;
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
        .select("batches:batch_id(day_of_week, start_time)")
        .eq("student_id", student!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const b = (data as { batches: { day_of_week: number; start_time: string } | null })?.batches;
      return b ? { day_of_week: b.day_of_week, start_time: b.start_time } : null;
    },
  });
}

export function addWeeks(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().slice(0, 10);
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
  const { songsPerSession } = useStudentClassConfig();
  const weekStart = weekStartArg ?? isoMonday();
  const { data: existing } = useWeeklyPlan(weekStart);

  useEffect(() => {
    if (!student?.id) return;
    if (existing === undefined) return; // still loading
    if (existing.length >= 3) return;

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
    });

    (async () => {
      const { error } = await supabase
        .from("weekly_plan_sessions")
        .upsert(rows, { onConflict: "student_id,week_start,session_index" });
      if (error) console.error("[weekly-plan] upsert failed", error);
      qc.invalidateQueries({ queryKey: ["weekly-plan", student.id, weekStart] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, existing?.length, batch?.day_of_week, weekStart]);
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

export function useTodaysSession(): WeeklyPlanSession | undefined {
  const { data: plan } = useWeeklyPlan();
  const today = todayIso();
  return useMemo(
    () => plan?.find((s) => s.scheduled_date === today && !s.completed_at) ?? plan?.find((s) => s.scheduled_date >= today && !s.completed_at),
    [plan, today]
  );
}
