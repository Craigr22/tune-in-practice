import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";
import { toLocalIso, addDaysIso } from "@/lib/date";
import { practiceDatesUpTo, type PracticeSchedule } from "@/lib/practiceWeek";
import type { Song } from "@/lib/types";

export type CheckIn = "nailed" | "got_through" | "need_help";

export interface PracticeLog {
  id: string;
  student_id: string;
  song_id: string;
  played_on: string;
  duration_min: number;
  self_rated_badge: number | null;
  tuning_check_completed: boolean;
  check_in: CheckIn | null;
  shared_with_teacher: boolean;
  recording_url: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface SongProgress {
  id: string;
  student_id: string;
  song_id: string;
  teacher_badge: number | null;
  self_badge: number | null;
  last_practiced: string | null;
  last_updated: string;
}

export function usePracticeLogs() {
  const { data: student } = useStudentMe();
  return useQuery({
    queryKey: ["practice-logs", student?.id],
    enabled: !!student?.id,
    queryFn: async (): Promise<PracticeLog[]> => {
      const { data, error } = await supabase
        .from("practice_logs")
        .select("*")
        .eq("student_id", student!.id)
        .order("played_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PracticeLog[];
    },
  });
}

export function useSongProgress() {
  const { data: student } = useStudentMe();
  return useQuery({
    queryKey: ["song-progress", student?.id],
    enabled: !!student?.id,
    queryFn: async (): Promise<SongProgress[]> => {
      const { data, error } = await supabase
        .from("song_progress")
        .select("*")
        .eq("student_id", student!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLogPractice() {
  const qc = useQueryClient();
  const { data: student } = useStudentMe();
  return useMutation({
    mutationFn: async (args: {
      songId: string;
      durationMin: number;
      selfBadge: number | null;
      tuningCheckCompleted?: boolean;
      /** Null when the student just marked a session done without rating it. */
      checkIn: CheckIn | null;
      sharedWithTeacher?: boolean;
      recordingBlob?: Blob | null;
    }) => {
      if (!student?.id) throw new Error("Not linked to a student record yet");

      // Insert log first to get id.
      const { data: inserted, error } = await supabase
        .from("practice_logs")
        .insert({
          student_id: student.id,
          song_id: args.songId,
          duration_min: args.durationMin,
          self_rated_badge: args.selfBadge,
          tuning_check_completed: !!args.tuningCheckCompleted,
          check_in: args.checkIn,
          shared_with_teacher: args.sharedWithTeacher ?? true,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Upload recording if provided.
      if (args.recordingBlob) {
        const path = `${student.id}/${inserted.id}.webm`;
        const { error: upErr } = await supabase
          .storage
          .from("recordings")
          .upload(path, args.recordingBlob, { contentType: args.recordingBlob.type || "audio/webm" });
        if (upErr) throw upErr;
        const { error: updErr } = await supabase
          .from("practice_logs")
          .update({ recording_url: path })
          .eq("id", inserted.id);
        if (updErr) throw updErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practice-logs"] });
      qc.invalidateQueries({ queryKey: ["song-progress"] });
    },
  });
}

export function tuningRate(logs: PracticeLog[]): { tuned: number; total: number; pct: number } {
  const total = logs.length;
  const tuned = logs.filter((l) => l.tuning_check_completed).length;
  return { tuned, total, pct: total > 0 ? Math.round((tuned / total) * 100) : 0 };
}

/* ----- helpers ----- */

/**
 * How many practice sessions in a row a student has done.
 *
 * This used to count consecutive calendar days, which a three-day-a-week plan
 * can never satisfy: practice falls two days apart, so the day in between
 * always broke the run and the streak could never read higher than 1. It now
 * counts the days the student was actually asked to practise — the two that
 * follow each lesson — so keeping to the plan keeps the streak.
 *
 * Today never breaks a run: an unfinished session is still ahead of them.
 * Without a schedule (the class hasn't loaded yet) it falls back to counting
 * calendar days, which is right for a student with no class at all.
 */
export function computeStreak(logs: PracticeLog[], schedule?: PracticeSchedule | null): number {
  if (!logs.length) return 0;
  const days = new Set(logs.map((l) => l.played_on));
  const today = toLocalIso();

  const expected = schedule
    ? practiceDatesUpTo(today, schedule)
    : // Every day back from today, in the same newest-first order.
      Array.from({ length: 365 }, (_, i) => addDaysIso(today, -i));

  let streak = 0;
  for (const date of expected) {
    if (days.has(date)) streak += 1;
    // A session still open today hasn't been missed yet.
    else if (date !== today) break;
  }
  return streak;
}

export function minutesThisWeek(logs: PracticeLog[]): number {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const iso = toLocalIso(monday);
  return logs.filter((l) => l.played_on >= iso).reduce((a, l) => a + (l.duration_min || 0), 0);
}

export function songsInProgress(progress: SongProgress[]): number {
  return progress.filter((p) => (p.teacher_badge ?? 0) > 0 && (p.teacher_badge ?? 0) < 5).length;
}

export function avgCourseBadge(progress: SongProgress[]): number | null {
  const levels = progress.map((p) => p.teacher_badge).filter((v): v is number => typeof v === "number" && v > 0);
  if (!levels.length) return null;
  return levels.reduce((a, b) => a + b, 0) / levels.length;
}

/**
 * Overlay a catalog song with the signed-in student's persisted progress.
 * Catalog fields describe teaching content only; they must never award a
 * student mastery or fabricate a practice streak.
 */
export function songWithStudentProgress(
  song: Song,
  logs: PracticeLog[],
  progress: SongProgress[],
  today = new Date(),
): Song {
  const songLogs = logs.filter((log) => log.song_id === song.id);
  const songProgress = progress.find((row) => row.song_id === song.id);
  const target = song.dailyTarget || 4;
  const countsByDay = new Map<string, number>();
  for (const log of songLogs) {
    countsByDay.set(log.played_on, (countsByDay.get(log.played_on) ?? 0) + 1);
  }

  const todayIso = toLocalIso(today);
  const approvedDays = [...countsByDay.values()].filter((count) => count >= target).length;
  const teacherBadge = songProgress?.teacher_badge ?? 0;
  const hasProgress = songLogs.length > 0 || teacherBadge > 0 || (songProgress?.self_badge ?? 0) > 0;
  const history = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (13 - index));
    return countsByDay.get(toLocalIso(day)) ?? 0;
  });

  return {
    ...song,
    state: teacherBadge >= 5 ? "mastered" : hasProgress ? "in-progress" : "next",
    playsToday: countsByDay.get(todayIso) ?? 0,
    approvedDays,
    history,
  };
}

/* ----- check-in sentiment ----- */

export interface SentimentDay { date: string; checkIn: CheckIn | null }

// Returns last `days` days as array oldest→newest. checkIn is the worst sentiment that day
// (need_help wins over got_through wins over nailed) so red doesn't get hidden.
export function sentimentStrip(logs: { played_on: string; check_in: CheckIn | null }[], days = 7): SentimentDay[] {
  const rank: Record<CheckIn, number> = { nailed: 1, got_through: 2, need_help: 3 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: SentimentDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = toLocalIso(d);
    let worst: CheckIn | null = null;
    for (const l of logs) {
      if (l.played_on !== iso || !l.check_in) continue;
      if (!worst || rank[l.check_in] > rank[worst]) worst = l.check_in;
    }
    out.push({ date: iso, checkIn: worst });
  }
  return out;
}

export const CHECK_IN_COLOR: Record<CheckIn | "none", string> = {
  nailed: "bg-emerald-500",
  got_through: "bg-amber-400",
  need_help: "bg-red-500",
  none: "bg-muted",
};

export const CHECK_IN_LABEL: Record<CheckIn, string> = {
  nailed: "Nailed it",
  got_through: "Got through it",
  need_help: "Need help",
};

export const CHECK_IN_EMOJI: Record<CheckIn, string> = {
  nailed: "🎯",
  got_through: "👍",
  need_help: "😅",
};
