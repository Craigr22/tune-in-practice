import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type StudentInput = {
  name: string;
  email: string | null;
  phone: string | null;
  parent_name: string | null;
  fee_amount: number;
  fee_cycle: "monthly" | "quarterly" | "semester";
  is_active?: boolean;
};

// Insert (no id) or update (with id), mirroring useSaveExpense.
export function useSaveStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: StudentInput & { id?: string }) => {
      if (id) {
        const { error } = await supabase.from("students").update(values as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(values as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

// Soft delete: flip is_active rather than removing the row (payments/enrollments FK to it).
export function useSetStudentActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("students").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

// Classes a student is enrolled in (for the profile drawer).
export function useStudentEnrollments(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-enrollments", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, status, batches(id, day_of_week, start_time, instruments(name), locations(name), teachers(name))")
        .eq("student_id", studentId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Recent payments for a student (for the profile drawer).
export function useStudentPayments(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-payments", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, paid_on, status, notes")
        .eq("student_id", studentId!)
        .order("paid_on", { ascending: false, nullsFirst: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { student_id: string; amount: number; paid_on: string; notes?: string | null }) => {
      const { error } = await supabase.from("payments").insert({
        student_id: p.student_id,
        amount: p.amount,
        paid_on: p.paid_on,
        period_start: p.paid_on,
        status: "paid",
        notes: p.notes ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["student-payments", vars.student_id] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["finance-overview"] });
    },
  });
}
