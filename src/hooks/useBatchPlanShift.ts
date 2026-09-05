import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

export interface BatchPlanShift {
  id: string;
  batch_id: string;
  weeks: number;
  reason: string | null;
  created_at: string;
}

const EMPTY: BatchPlanShift[] = [];

/**
 * How far a class's course has been pushed back, and why.
 *
 * A cancelled lesson doesn't move the start date — the class still began when
 * it began — so the pause is recorded separately and subtracted from the week
 * number. Two cancellations put the class two weeks behind the calendar,
 * which is exactly right: they've had two fewer lessons.
 */
function usePlanShiftQuery(batchId?: string | null) {
  return useQuery({
    queryKey: ["batch-plan-shifts", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<{ rows: BatchPlanShift[]; available: boolean }> => {
      const { data, error } = await (supabase as any)
        .from("batch_plan_shifts")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false });
      // The table arrives by migration. Until then no class is shifted, and
      // the teacher's control says so rather than failing when pressed.
      if (error) return { rows: EMPTY, available: false };
      return { rows: (data ?? []) as BatchPlanShift[], available: true };
    },
  });
}

export function useBatchPlanShifts(batchId?: string | null) {
  const q = usePlanShiftQuery(batchId);
  return { ...q, data: q.data?.rows ?? EMPTY };
}

/** False only when the pause feature hasn't been migrated in yet. */
export function usePlanShiftsAvailable(batchId?: string | null): boolean {
  return usePlanShiftQuery(batchId).data?.available ?? true;
}

/** Total weeks this class is behind the calendar. */
export function totalShiftWeeks(shifts: BatchPlanShift[]): number {
  return shifts.reduce((n, s) => n + (s.weeks || 0), 0);
}

/**
 * Weeks a class is behind, for anyone who belongs to it.
 *
 * Students can't read the pause list itself — the reasons are staff notes —
 * so the number comes back on its own from the database.
 */
export function useBatchShiftWeeks(batchId?: string | null) {
  return useQuery({
    queryKey: ["batch-shift-weeks", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await (supabase as any).rpc("get_batch_shift_weeks", {
        _batch_id: batchId,
      });
      if (error) return 0;
      return (data as number) ?? 0;
    },
  });
}


export function useAddPlanShift(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { weeks: number; reason?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("batch_plan_shifts").insert({
        batch_id: batchId,
        weeks: args.weeks,
        reason: args.reason?.trim() || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch-plan-shifts", batchId] });
      // Students' generated weeks follow the plan, so they need rebuilding.
      qc.invalidateQueries({ queryKey: ["weekly-plan"] });
    },
  });
}

export function useUndoPlanShift(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("batch_plan_shifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch-plan-shifts", batchId] });
      qc.invalidateQueries({ queryKey: ["weekly-plan"] });
    },
  });
}
