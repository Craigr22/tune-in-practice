import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useClassGrades, useClassLogs } from "@/hooks/useTeacherStudents";
import { batchStats, type BatchStats } from "@/lib/batchStats";

export interface StatsBatch {
  id: string;
  day_of_week?: number | null;
  semester_start?: string | null;
  students: { id: string; joined_on?: string | null }[];
}

/**
 * The five percentages for each of the given classes.
 *
 * One read of practice and one of grades covers every class asked for, so a
 * teacher's three classes or an admin's whole list cost the same two calls.
 */
export function useBatchStats(batches: StatsBatch[]): { stats: Map<string, BatchStats>; loading: boolean } {
  const ids = useMemo(() => batches.flatMap((b) => b.students.map((s) => s.id)), [batches]);
  const { data: logs, isLoading: l1 } = useClassLogs(ids);
  const { data: grades, isLoading: l2 } = useClassGrades(ids);
  const stats = useMemo(() => {
    const map = new Map<string, BatchStats>();
    for (const b of batches) {
      map.set(
        b.id,
        batchStats({
          classDow: b.day_of_week ?? null,
          courseStart: b.semester_start ?? null,
          students: b.students,
          logs: logs ?? [],
          grades: grades ?? [],
        }),
      );
    }
    return map;
  }, [batches, logs, grades]);
  return { stats, loading: ids.length > 0 && (l1 || l2 || !logs || !grades) };
}

/** Who is in each class — for the admin, who isn't handed a teacher's own list. */
export function useBatchStudents(batchIds: string[]) {
  const ids = [...batchIds].sort();
  return useQuery({
    queryKey: ["batch-students", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Map<string, { id: string; joined_on: string | null }[]>> => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("batch_id, students(id, joined_on)")
        .in("batch_id", ids)
        .eq("status", "active");
      if (error) throw error;
      const map = new Map<string, { id: string; joined_on: string | null }[]>();
      for (const e of (data ?? []) as any[]) {
        if (!e.students) continue;
        if (!map.has(e.batch_id)) map.set(e.batch_id, []);
        map.get(e.batch_id)!.push(e.students);
      }
      return map;
    },
  });
}
