import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import {
  buildPnL,
  calculateBatchUnitEconomics,
  calculateGrossRevenue,
  calculateOutstandingDues,
  calculateTeacherPayout,
  fiscalYearBounds,
  iso,
  monthBounds,
} from "@/lib/finance";

export function usePnL(date = new Date(), locationFilter?: string | null) {
  const { startISO } = fiscalYearBounds(date);
  return useQuery({
    queryKey: ["pnl", startISO, locationFilter ?? "all"],
    queryFn: () => buildPnL(date, locationFilter),
  });
}

// Fiscal years (Apr–Mar start years) that have any paid revenue, plus the latest one.
export function useRevenueYears() {
  return useQuery({
    queryKey: ["revenue-years"],
    queryFn: async () => {
      const [{ data: maxRow }, { data: minRow }] = await Promise.all([
        supabase.from("payments").select("paid_on").eq("status", "paid")
          .order("paid_on", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
        supabase.from("payments").select("paid_on").eq("status", "paid")
          .order("paid_on", { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
      ]);
      if (!maxRow?.paid_on || !minRow?.paid_on) return { years: [] as number[], latest: null as number | null };
      const fyStart = (s: string) => {
        const d = new Date(s);
        return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      };
      const lo = fyStart(minRow.paid_on);
      const hi = fyStart(maxRow.paid_on);
      const years: number[] = [];
      for (let y = lo; y <= hi; y++) years.push(y);
      return { years, latest: hi };
    },
  });
}

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
