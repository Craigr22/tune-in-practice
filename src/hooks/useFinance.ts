import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { buildPnL, calculateTeacherPayout, fiscalYearBounds, monthBounds } from "@/lib/finance";

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
