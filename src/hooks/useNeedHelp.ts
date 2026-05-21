import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useTeacherMe } from "./useTeacherMe";

export interface NeedHelpItem {
  id: string;
  student_id: string;
  student_name: string;
  song_id: string;
  played_on: string;
  recording_url: string | null;
  acknowledged_at: string | null;
}

// All "need_help" check-ins from this teacher's students, last 14 days, not yet acknowledged.
export function useNeedHelpItems() {
  const { data: teacher } = useTeacherMe();
  const teacherId = teacher?.id;
  return useQuery({
    queryKey: ["need-help", teacherId],
    enabled: !!teacherId,
    queryFn: async (): Promise<NeedHelpItem[]> => {
      const { data: batches } = await supabase.from("batches").select("id").eq("teacher_id", teacherId!);
      const batchIds = (batches ?? []).map((b) => b.id);
      if (!batchIds.length) return [];
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id")
        .in("batch_id", batchIds)
        .eq("status", "active");
      const studentIds = Array.from(new Set((enrollments ?? []).map((e: any) => e.student_id)));
      if (!studentIds.length) return [];
      const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("practice_logs")
        .select("id, student_id, song_id, played_on, recording_url, acknowledged_at, shared_with_teacher, students(name)")
        .eq("check_in", "need_help")
        .eq("shared_with_teacher", true)
        .is("acknowledged_at", null)
        .in("student_id", studentIds)
        .gte("played_on", since)
        .order("played_on", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id, student_id: r.student_id, song_id: r.song_id, played_on: r.played_on,
        recording_url: r.recording_url, acknowledged_at: r.acknowledged_at,
        student_name: r.students?.name ?? "Student",
      }));
    },
  });
}

export function useAcknowledgeNeedHelp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from("practice_logs")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["need-help"] }),
  });
}
