import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useTeacherMe } from "./useTeacherMe";

export function usePendingRecordings() {
  const { data: teacher } = useTeacherMe();
  const teacherId = teacher?.id;
  return useQuery({
    queryKey: ["pending-recordings", teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      // Find batches taught by this teacher, then attendance rows with a recording_url and no reviewed_at.
      const { data: batches } = await supabase
        .from("batches")
        .select("id")
        .eq("teacher_id", teacherId!);
      const batchIds = (batches ?? []).map((b) => b.id);
      if (!batchIds.length) return [];

      const { data: sessions } = await supabase.from("sessions").select("id").in("batch_id", batchIds);
      const sessionIds = (sessions ?? []).map((s) => s.id);
      if (!sessionIds.length) return [];

      const { data, error } = await supabase
        .from("attendance")
        .select("*, students(name, id)")
        .in("session_id", sessionIds)
        .not("recording_url", "is", null)
        .is("reviewed_at", null)
        .order("submitted_at", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubmitRecordingFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      attendanceId: string;
      studentId: string;
      songId: string;
      comment: string;
      teacherBadge: number;
    }) => {
      const { error: aErr } = await supabase
        .from("attendance")
        .update({ teacher_comment: args.comment, reviewed_at: new Date().toISOString() })
        .eq("id", args.attendanceId);
      if (aErr) throw aErr;

      // Upsert song_progress
      const { data: existing } = await supabase
        .from("song_progress")
        .select("id")
        .eq("student_id", args.studentId)
        .eq("song_id", args.songId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("song_progress")
          .update({ teacher_badge: args.teacherBadge, last_updated: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("song_progress")
          .insert({ student_id: args.studentId, song_id: args.songId, teacher_badge: args.teacherBadge });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-recordings"] });
    },
  });
}
