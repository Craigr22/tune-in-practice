import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

export function useBatches() {
  return useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("batches").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// One row per batch ("class") with its joins and a live enrolled count.
export function useBatchList() {
  return useQuery({
    queryKey: ["batch-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select(
          "id, day_of_week, start_time, duration_min, max_students, is_active, semester_start, semester_end, teacher_id, instrument_id, location_id, teachers(name), instruments(name), locations(name), enrollments(count)",
        )
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []).map((b: any) => ({
        ...b,
        enrolled: b.enrollments?.[0]?.count ?? 0,
      }));
    },
  });
}

export type BatchInput = {
  teacher_id: string;
  instrument_id: string;
  location_id: string;
  day_of_week: number;
  start_time: string; // "HH:MM:SS"
  duration_min: number;
  max_students: number;
  semester_start: string;
  semester_end: string | null;
};

export function useSaveBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: BatchInput & { id?: string }) => {
      if (id) {
        const { error } = await supabase.from("batches").update(values as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("batches").insert(values as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch-list"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["admin-sessions"] });
    },
  });
}

// Archive / restore a class (soft toggle; sessions and enrollments keep their FK).
export function useSetBatchActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("batches").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch-list"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["admin-sessions"] });
    },
  });
}

// Returns active batches for a teacher on a given weekday whose time overlaps the
// proposed slot (excluding one batch id), used to warn about double-booking.
export async function findTeacherClashes(
  teacherId: string,
  dayOfWeek: number,
  startTime: string,
  durationMin: number,
  excludeId?: string,
) {
  const { data, error } = await supabase
    .from("batches")
    .select("id, start_time, duration_min, instruments(name), locations(name)")
    .eq("teacher_id", teacherId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);
  if (error) throw error;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const start = toMin(startTime);
  const end = start + durationMin;
  return (data ?? []).filter((b: any) => {
    if (excludeId && b.id === excludeId) return false;
    const bStart = toMin(b.start_time);
    const bEnd = bStart + (b.duration_min || 60);
    return start < bEnd && bStart < end; // overlap
  });
}
