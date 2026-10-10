import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { toLocalIso } from "@/lib/date";
import type { EnrolmentRow } from "@/lib/attrition";

/** True when the attrition columns haven't reached the database yet. */
const notMigrated = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42703" || e.code === "PGRST204" || /left_on|leave_reason/i.test(e.message ?? ""));

/** Every enrolment, past and present, for the given classes. */
export function useEnrolmentHistory(batchIds: string[]) {
  const ids = [...batchIds].sort();
  return useQuery({
    queryKey: ["enrolment-history", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<EnrolmentRow[]> => {
      const { data, error } = await supabase.from("enrollments").select("*").in("batch_id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as EnrolmentRow[];
    },
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["batch-enrollments", "batch-list", "enrolment-history", "batch-students", "teacher-students", "student-class", "student-enrolment"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

/**
 * De-register a student from a class.
 *
 * The enrolment stays, marked as dropped with the day and the reason: that is
 * the record attrition is counted from. Everything a student is shown comes
 * through an active enrolment, so this is also what ends their access.
 */
export function useDeregister() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (args: { enrolmentId: string; reason: string; leftOn?: string }) => {
      const full = { status: "dropped", left_on: args.leftOn ?? toLocalIso(), leave_reason: args.reason };
      const { error } = await (supabase as any).from("enrollments").update(full).eq("id", args.enrolmentId);
      if (!error) return;
      // Before the migration lands there is nowhere to keep the date and the
      // reason — but the student should still be de-registered.
      if (notMigrated(error)) {
        const retry = await supabase.from("enrollments").update({ status: "dropped" }).eq("id", args.enrolmentId);
        if (retry.error) throw retry.error;
        return;
      }
      throw error;
    },
    onSuccess: refresh,
  });
}

/** Bring a de-registered student back into the class. */
export function useReenrol() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (enrolmentId: string) => {
      const { error } = await (supabase as any)
        .from("enrollments")
        .update({ status: "active", left_on: null, leave_reason: null })
        .eq("id", enrolmentId);
      if (!error) return;
      if (notMigrated(error)) {
        const retry = await supabase.from("enrollments").update({ status: "active" }).eq("id", enrolmentId);
        if (retry.error) throw retry.error;
        return;
      }
      throw error;
    },
    onSuccess: refresh,
  });
}

/** Take an enrolment away entirely: for a student added by mistake, who never counts as having left. */
export function useRemoveEnrolment() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (enrolmentId: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", enrolmentId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
