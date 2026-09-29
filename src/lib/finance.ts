import { supabase } from "@/lib/db";
import { toLocalIso } from "@/lib/date";

export function monthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end, startISO: iso(start), endISO: iso(end) };
}

/**
 * A calendar date as "YYYY-MM-DD", in local time.
 *
 * This used toISOString(), which converts to UTC first. East of UTC a local
 * midnight is the previous evening there, so in India the 1st of every month
 * came out as the last day of the one before — every month boundary in the
 * P&L was a day early, and a payment on the 1st was counted in the wrong month.
 */
export function iso(d: Date) { return toLocalIso(d); }

export function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

// BAM runs an April–March (Indian) fiscal year.
export function fiscalYearBounds(d = new Date()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; // Apr (month 3) starts the FY
  const start = new Date(y, 3, 1);
  const end = new Date(y + 1, 3, 1);
  return { start, end, startISO: iso(start), endISO: iso(end), label: `FY ${y}-${String(y + 1).slice(2)}` };
}

// The 12 months of a fiscal year, Apr → Mar.
export function fiscalMonths(d = new Date()) {
  const { start } = fiscalYearBounds(d);
  return Array.from({ length: 12 }, (_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1));
}

// ============ Pure calculators ============

export async function calculateGrossRevenue(monthStart: Date, monthEnd: Date): Promise<number> {
  const { data } = await supabase
    .from("payments")
    .select("amount")
    .eq("status", "paid")
    .gte("paid_on", iso(monthStart))
    .lt("paid_on", iso(monthEnd));
  return (data ?? []).reduce((s, p: any) => s + Number(p.amount ?? 0), 0);
}

export interface TeacherPayoutResult {
  sessions: number;
  hours: number;
  calculated: number;
}

export async function calculateTeacherPayout(
  teacherId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<TeacherPayoutResult> {
  const { data: teacher } = await supabase
    .from("teachers")
    .select("payment_type, rate")
    .eq("id", teacherId)
    .maybeSingle();
  const { data: batches } = await supabase.from("batches").select("id, duration_min").eq("teacher_id", teacherId);
  const batchIds = (batches ?? []).map((b) => b.id);
  if (!batchIds.length || !teacher) return { sessions: 0, hours: 0, calculated: 0 };
  const durationByBatch = new Map((batches ?? []).map((b: any) => [b.id, b.duration_min]));

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, batch_id")
    .in("batch_id", batchIds)
    .eq("status", "completed")
    .gte("scheduled_date", iso(monthStart))
    .lt("scheduled_date", iso(monthEnd));
  const sessionCount = (sessions ?? []).length;
  const minutes = (sessions ?? []).reduce((s, r: any) => s + (durationByBatch.get(r.batch_id) ?? 60), 0);
  const hours = minutes / 60;
  const rate = Number(teacher.rate ?? 0);
  let calculated = 0;
  if (teacher.payment_type === "per_hour") calculated = rate * hours;
  else if (teacher.payment_type === "per_session") calculated = rate * sessionCount;
  else if (teacher.payment_type === "fixed_monthly") calculated = rate;
  return { sessions: sessionCount, hours, calculated };
}

export interface ExpenseBreakdown {
  total: number;
  byCategory: Record<string, number>;
}

// Cash-basis expenses for a period, optionally scoped to one office.
// locationFilter: undefined = all, null = shared/unattributed only, string = that office.
export async function calculateExpenses(
  start: Date,
  end: Date,
  locationFilter?: string | null
): Promise<ExpenseBreakdown> {
  const { data } = await supabase
    .from("expenses")
    .select("amount, category, location_id")
    .gte("incurred_on", iso(start))
    .lt("incurred_on", iso(end));
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const e of (data ?? []) as any[]) {
    if (locationFilter !== undefined) {
      if (locationFilter === null && e.location_id) continue;
      if (typeof locationFilter === "string" && e.location_id !== locationFilter) continue;
    }
    const amt = Number(e.amount ?? 0);
    byCategory[e.category] = (byCategory[e.category] ?? 0) + amt;
    total += amt;
  }
  return { total, byCategory };
}

export interface PnLPeriod {
  monthISO: string;
  label: string;
  revenue: number;
  teacherPayouts: number;
  grossProfit: number;
  expenses: number;
  expensesByCategory: Record<string, number>;
  netProfit: number;
  marginPct: number;
}

export interface PnLResult {
  periods: PnLPeriod[];
  totals: PnLPeriod;
  categories: string[];
  activeStudents: number;
  expensePerStudent: number;
}

// Apr–Mar cash-basis P&L. v1 scope: class-fee revenue − teacher payouts − expenses.
// locationFilter scopes rent/office-attributed costs; pass undefined for the whole entity.
export async function buildPnL(date = new Date(), locationFilter?: string | null): Promise<PnLResult> {
  const months = fiscalMonths(date);
  const periods: PnLPeriod[] = [];
  const categorySet = new Set<string>();

  for (const m of months) {
    const start = m;
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const [revenue, exp] = await Promise.all([
      calculateGrossRevenue(start, end),
      calculateExpenses(start, end, locationFilter),
    ]);

    // Teacher payouts for completed sessions in the month.
    const { data: teachers } = await supabase.from("teachers").select("id").eq("is_active", true);
    const payoutResults = await Promise.all(
      (teachers ?? []).map((t) => calculateTeacherPayout(t.id, start, end))
    );
    const teacherPayouts = payoutResults.reduce((s, p) => s + p.calculated, 0);

    Object.keys(exp.byCategory).forEach((c) => categorySet.add(c));
    const grossProfit = revenue - teacherPayouts;
    const netProfit = grossProfit - exp.total;
    periods.push({
      monthISO: iso(start),
      label: m.toLocaleDateString(undefined, { month: "short" }),
      revenue,
      teacherPayouts,
      grossProfit,
      expenses: exp.total,
      expensesByCategory: exp.byCategory,
      netProfit,
      marginPct: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    });
  }

  const sum = (pick: (p: PnLPeriod) => number) => periods.reduce((s, p) => s + pick(p), 0);
  const totalsByCategory: Record<string, number> = {};
  for (const c of categorySet) totalsByCategory[c] = sum((p) => p.expensesByCategory[c] ?? 0);
  const totalRevenue = sum((p) => p.revenue);
  const totalNet = sum((p) => p.netProfit);
  const totals: PnLPeriod = {
    monthISO: "total",
    label: "Total",
    revenue: totalRevenue,
    teacherPayouts: sum((p) => p.teacherPayouts),
    grossProfit: sum((p) => p.grossProfit),
    expenses: sum((p) => p.expenses),
    expensesByCategory: totalsByCategory,
    netProfit: totalNet,
    marginPct: totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0,
  };

  // Active-student denominator for expense-per-student.
  const { data: activeEnrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(is_active)")
    .eq("status", "active");
  const activeIds = new Set<string>();
  for (const e of (activeEnrollments ?? []) as any[]) {
    if (e.students?.is_active) activeIds.add(e.student_id);
  }
  const activeStudents = activeIds.size;
  const totalExpenses = totals.expenses + totals.teacherPayouts;

  return {
    periods,
    totals,
    categories: Array.from(categorySet).sort(),
    activeStudents,
    expensePerStudent: activeStudents > 0 ? totalExpenses / activeStudents : 0,
  };
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}
