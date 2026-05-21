import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";

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
      checkIn: CheckIn;
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

export function computeStreak(logs: PracticeLog[]): number {
  if (!logs.length) return 0;
  const days = new Set(logs.map((l) => l.played_on));
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
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
  const day = now.getDay();
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
    const iso = d.toISOString().slice(0, 10);
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
