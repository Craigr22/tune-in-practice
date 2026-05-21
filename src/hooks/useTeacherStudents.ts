import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useTeacherMe } from "./useTeacherMe";

// All students enrolled in batches taught by the current teacher, grouped by batch.
export function useTeacherStudents() {
  const { data: teacher } = useTeacherMe();
  const teacherId = teacher?.id;
  return useQuery({
    queryKey: ["teacher-students", teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const { data: batches, error: bErr } = await supabase
        .from("batches")
        .select("*, locations(name), instruments(name)")
        .eq("teacher_id", teacherId!)
        .eq("is_active", true);
      if (bErr) throw bErr;

      const batchIds = (batches ?? []).map((b) => b.id);
      if (!batchIds.length) return [];

      const { data: enrollments, error: eErr } = await supabase
        .from("enrollments")
        .select("batch_id, status, students(*)")
        .in("batch_id", batchIds)
        .eq("status", "active");
      if (eErr) throw eErr;

      return (batches ?? []).map((b: any) => ({
        batch: b,
        students: (enrollments ?? [])
          .filter((e: any) => e.batch_id === b.id)
          .map((e: any) => e.students)
          .filter(Boolean),
      }));
    },
  });
}

// Per-student practice + attendance + song_progress (for sparkline, retention, badges).
export function useStudentDetail(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-detail", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const [{ data: practice }, { data: attendance }, { data: progress }] = await Promise.all([
        supabase
          .from("practice_logs")
          .select("*")
          .eq("student_id", studentId!)
          .gte("played_on", new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10))
          .order("played_on", { ascending: true }),
        supabase
          .from("attendance")
          .select("*, sessions(scheduled_date)")
          .eq("student_id", studentId!),
        supabase.from("song_progress").select("*").eq("student_id", studentId!),
      ]);
      return {
        practice: practice ?? [],
        attendance: (attendance ?? []).map((a: any) => ({ ...a, session_date: a.sessions?.scheduled_date })),
        progress: progress ?? [],
      };
    },
  });
}
