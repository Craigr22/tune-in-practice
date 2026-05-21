import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";

export interface PracticeLog {
  id: string;
  student_id: string;
  song_id: string;
  played_on: string;
  duration_min: number;
  self_rated_badge: number | null;
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
      return data ?? [];
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
    mutationFn: async ({ songId, durationMin, selfBadge }: { songId: string; durationMin: number; selfBadge: number | null }) => {
      if (!student?.id) throw new Error("Not linked to a student record yet");
      const { error } = await supabase.from("practice_logs").insert({
        student_id: student.id,
        song_id: songId,
        duration_min: durationMin,
        self_rated_badge: selfBadge,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practice-logs"] });
      qc.invalidateQueries({ queryKey: ["song-progress"] });
    },
  });
}

/* ----- helpers ----- */

export function computeStreak(logs: PracticeLog[]): number {
  if (!logs.length) return 0;
  const days = new Set(logs.map((l) => l.played_on));
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // allow today missing → start from yesterday if no log today
  const todayIso = d.toISOString().slice(0, 10);
  if (!days.has(todayIso)) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function minutesThisWeek(logs: PracticeLog[]): number {
  const now = new Date();
  const day = now.getDay(); // 0 Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const iso = monday.toISOString().slice(0, 10);
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
