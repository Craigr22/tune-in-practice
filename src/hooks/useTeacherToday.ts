import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useTeacherMe } from "./useTeacherMe";

// Returns today's batches (with location + instrument) plus or-creates a session.
export function useTeacherToday() {
  const { data: teacher } = useTeacherMe();
  const teacherId = teacher?.id;
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const dow = today.getDay(); // 0..6

  return useQuery({
    queryKey: ["teacher-today", teacherId, todayISO],
    enabled: !!teacherId,
    queryFn: async () => {
      const { data: batches, error } = await supabase
        .from("batches")
        .select("*, locations(name, address), instruments(name)")
        .eq("teacher_id", teacherId!)
        .eq("day_of_week", dow)
        .eq("is_active", true)
        .order("start_time");
      if (error) throw error;

      const batchIds = (batches ?? []).map((b) => b.id);
      const enrollmentsByBatch = new Map<string, number>();
      const sessionsByBatch = new Map<string, any>();
      if (batchIds.length) {
        const [{ data: enrollments }, { data: sessions }] = await Promise.all([
          supabase.from("enrollments").select("batch_id, status").in("batch_id", batchIds).eq("status", "active"),
          supabase.from("sessions").select("*").in("batch_id", batchIds).eq("scheduled_date", todayISO),
        ]);
        for (const e of enrollments ?? []) {
          enrollmentsByBatch.set(e.batch_id, (enrollmentsByBatch.get(e.batch_id) ?? 0) + 1);
        }
        for (const s of sessions ?? []) sessionsByBatch.set(s.batch_id, s);
      }

      return (batches ?? []).map((b: any) => ({
        ...b,
        studentCount: enrollmentsByBatch.get(b.id) ?? 0,
        session: sessionsByBatch.get(b.id) ?? null,
      }));
    },
  });
}

export function useBatchRoster(batchId: string | undefined) {
  return useQuery({
    queryKey: ["batch-roster", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, students(*)")
        .eq("batch_id", batchId!)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.students).filter(Boolean);
    },
  });
}
