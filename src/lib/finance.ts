import { supabase } from "@/lib/db";

export function monthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end, startISO: iso(start), endISO: iso(end) };
}

export function iso(d: Date) { return d.toISOString().slice(0, 10); }

export function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
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

export async function calculateOutstandingDues(monthStart: Date, monthEnd: Date): Promise<number> {
  // Expected: sum of fee_amount for active enrollments whose batch overlaps the month.
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, status, students(fee_amount, fee_cycle, is_active)")
    .eq("status", "active");
  let expected = 0;
  for (const e of (enrollments ?? []) as any[]) {
    if (!e.students?.is_active) continue;
    const fee = Number(e.students?.fee_amount ?? 0);
    expected += e.students?.fee_cycle === "monthly" ? fee : fee / 3;
  }
  // Paid (booked period overlaps with month).
  const { data: paid } = await supabase
    .from("payments")
    .select("amount, period_start, period_end, status")
    .eq("status", "paid")
    .or(`period_start.lt.${iso(monthEnd)},period_start.is.null`);
  const monthStartISO = iso(monthStart);
  const monthEndISO = iso(monthEnd);
  const collected = ((paid ?? []) as any[]).reduce((s, p) => {
    const ps = p.period_start ?? p.paid_on;
    const pe = p.period_end ?? ps;
    if (!ps) return s + Number(p.amount ?? 0);
    if (pe >= monthStartISO && ps < monthEndISO) return s + Number(p.amount ?? 0);
    return s;
  }, 0);
  return Math.max(0, expected - collected);
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

export interface BatchUnitEconomics {
  batchId: string;
  fillPct: number;
  enrolled: number;
  capacity: number;
  gross: number;
  teacherCost: number;
  margin: number;
  marginPct: number;
}

export async function calculateBatchUnitEconomics(
  batchId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<BatchUnitEconomics> {
  const { data: batch } = await supabase
    .from("batches")
    .select("*, teachers(payment_type, rate)")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) {
    return { batchId, fillPct: 0, enrolled: 0, capacity: 0, gross: 0, teacherCost: 0, margin: 0, marginPct: 0 };
  }
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("students(fee_amount, fee_cycle, is_active)")
    .eq("batch_id", batchId)
    .eq("status", "active");
  const activeEnrollments = ((enrollments ?? []) as any[]).filter((e) => e.students?.is_active);
  const enrolled = activeEnrollments.length;
  const capacity = batch.max_students ?? 0;
  const gross = activeEnrollments.reduce((s, e: any) => {
    const fee = Number(e.students?.fee_amount ?? 0);
    return s + (e.students?.fee_cycle === "monthly" ? fee : fee / 3);
  }, 0);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id")
    .eq("batch_id", batchId)
    .eq("status", "completed")
    .gte("scheduled_date", iso(monthStart))
    .lt("scheduled_date", iso(monthEnd));
  const sessionCount = (sessions ?? []).length;
  const hours = (sessionCount * (batch.duration_min ?? 60)) / 60;
  const rate = Number(batch.teachers?.rate ?? 0);
  let teacherCost = 0;
  if (batch.teachers?.payment_type === "per_hour") teacherCost = rate * hours;
  else if (batch.teachers?.payment_type === "per_session") teacherCost = rate * sessionCount;
  // fixed_monthly: allocate proportionally — handled at teacher level, skip here.

  const margin = gross - teacherCost;
  const marginPct = gross > 0 ? (margin / gross) * 100 : 0;
  return {
    batchId,
    enrolled,
    capacity,
    fillPct: capacity > 0 ? (enrolled / capacity) * 100 : 0,
    gross,
    teacherCost,
    margin,
    marginPct,
  };
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}
