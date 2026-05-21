import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import {
  calculateBatchUnitEconomics,
  calculateGrossRevenue,
  calculateOutstandingDues,
  calculateTeacherPayout,
  iso,
  monthBounds,
} from "@/lib/finance";

export function useFinanceOverview(date = new Date()) {
  const { start, end } = monthBounds(date);
  return useQuery({
    queryKey: ["finance-overview", iso(start)],
    queryFn: async () => {
      const [gross, dues, batches, teachers, expenses] = await Promise.all([
        calculateGrossRevenue(start, end),
        calculateOutstandingDues(start, end),
        supabase.from("batches").select("id").eq("is_active", true),
        supabase.from("teachers").select("id").eq("is_active", true),
        supabase
          .from("expenses")
          .select("amount")
          .gte("incurred_on", iso(start))
          .lt("incurred_on", iso(end)),
      ]);
      const batchEconomics = await Promise.all(
        (batches.data ?? []).map((b) => calculateBatchUnitEconomics(b.id, start, end))
      );
      const teacherPayouts = await Promise.all(
        (teachers.data ?? []).map(async (t) => ({
          teacherId: t.id,
          ...(await calculateTeacherPayout(t.id, start, end)),
        }))
      );
      const totalPayouts = teacherPayouts.reduce((s, p) => s + p.calculated, 0);
      const totalExpenses = ((expenses.data ?? []) as any[]).reduce((s, e) => s + Number(e.amount ?? 0), 0);
      return {
        gross,
        dues,
        payouts: totalPayouts,
        expenses: totalExpenses,
        net: gross - totalPayouts - totalExpenses,
        batchEconomics,
      };
    },
  });
}

export function useRevenueTrend(months = 6) {
  return useQuery({
    queryKey: ["revenue-trend", months],
    queryFn: async () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, paid_on, student_id")
        .eq("status", "paid")
        .gte("paid_on", iso(start));
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, batch_id, batches(location_id, locations(name))");

      const studentToLoc = new Map<string, string>();
      for (const e of (enrollments ?? []) as any[]) {
        const loc = e.batches?.locations?.name ?? "Unknown";
        studentToLoc.set(e.student_id, loc);
      }
      const rows: Record<string, any>[] = [];
      const locSet = new Set<string>();
      for (let i = 0; i < months; i++) {
        const m = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
        const label = m.toLocaleDateString(undefined, { month: "short" });
        const row: Record<string, any> = { month: label };
        for (const p of (payments ?? []) as any[]) {
          const d = new Date(p.paid_on);
          if (d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth()) {
            const loc = studentToLoc.get(p.student_id) ?? "Unknown";
            locSet.add(loc);
            row[loc] = (row[loc] ?? 0) + Number(p.amount ?? 0);
          }
        }
        rows.push(row);
      }
      return { rows, locations: Array.from(locSet) };
    },
  });
}

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, students(name, fee_amount)")
        .order("paid_on", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });
}

export function useTeacherPayoutsForMonth(date: Date) {
  const { start, end, startISO } = monthBounds(date);
  return useQuery({
    queryKey: ["teacher-payouts", startISO],
    queryFn: async () => {
      const { data: teachers } = await supabase.from("teachers").select("*").eq("is_active", true);
      const { data: recorded } = await supabase
        .from("teacher_payouts")
        .select("*")
        .eq("month", startISO);
      const recordedMap = new Map(((recorded ?? []) as any[]).map((r) => [r.teacher_id, r]));
      const rows = await Promise.all(
        ((teachers ?? []) as any[]).map(async (t) => {
          const calc = await calculateTeacherPayout(t.id, start, end);
          return { teacher: t, ...calc, recorded: recordedMap.get(t.id) ?? null };
        })
      );
      return rows;
    },
  });
}
