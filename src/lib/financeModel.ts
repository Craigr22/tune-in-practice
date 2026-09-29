/**
 * The school's money, worked out from rows already fetched.
 *
 * Everything here is pure: it takes plain rows and returns numbers, with no
 * database access. The pages fetch each table once and hand the rows over, so
 * a month's view costs a handful of queries rather than one per teacher per
 * month per batch — which is what the older calculators did, and what got the
 * app rate-limited.
 *
 * Dates are local calendar dates as "YYYY-MM-DD" strings throughout. Day
 * arithmetic is done on UTC day numbers so no timezone can shift a boundary.
 */

export type FeeCycle = "monthly" | "quarterly" | "semester";
export type PaymentType = "per_hour" | "per_session" | "fixed_monthly";

export const CYCLE_MONTHS: Record<FeeCycle, number> = { monthly: 1, quarterly: 3, semester: 6 };

/** A fee expressed per month, whatever cycle it is billed on. */
export function monthlyFee(amount: number, cycle: FeeCycle | string | null | undefined): number {
  const months = CYCLE_MONTHS[(cycle ?? "monthly") as FeeCycle] ?? 1;
  return Number(amount || 0) / months;
}

/* ---------------- date arithmetic ---------------- */

/** Days since the epoch for a calendar date, immune to the local timezone. */
export function dayNum(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromDayNum(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDayNum(dayNum(iso) + days);
}

/** `iso` moved on by whole months, the day clamped to the target month's length. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** "YYYY-MM" for the month a date falls in. */
export const monthOf = (iso: string) => iso.slice(0, 7);

/** First day of a "YYYY-MM" month. */
export const monthStart = (month: string) => `${month}-01`;

/** First day of the month after. */
export const nextMonthStart = (month: string) => addMonths(monthStart(month), 1);

/** Every "YYYY-MM" from `from` up to but not including `to` (both first-of-month dates). */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = monthStart(monthOf(from)); m < to; m = addMonths(m, 1)) out.push(monthOf(m));
  return out;
}

/** Overlap in days between [a0, a1] and [b0, b1), both inclusive of their start. */
function overlapDays(periodStart: string, periodEnd: string, from: string, to: string): number {
  const s = Math.max(dayNum(periodStart), dayNum(from));
  const e = Math.min(dayNum(periodEnd) + 1, dayNum(to)); // periodEnd is inclusive, `to` exclusive
  return Math.max(0, e - s);
}

/* ---------------- rows ---------------- */

export interface PaymentRow {
  studentId: string;
  batchId: string | null;
  amount: number;
  paidOn: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
}

export interface StudentRow {
  id: string;
  name: string;
  feeAmount: number;
  feeCycle: FeeCycle;
  isActive: boolean;
}

export interface EnrollmentRow {
  studentId: string;
  batchId: string;
  status: string;
}

export interface BatchRow {
  id: string;
  label: string;
  locationId: string | null;
  locationName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  paymentType: PaymentType | null;
  rate: number;
  durationMin: number;
  maxStudents: number;
  isActive: boolean;
  /** "Sun 10:45" — for display only. */
  when?: string;
}

export interface SessionRow {
  batchId: string;
  date: string;
  status: string;
  durationMin: number | null;
}

export interface ExpenseRow {
  amount: number;
  locationId: string | null;
  date: string;
}

/* ---------------- revenue ---------------- */

/** True when a payment says what period it pays for, so it can be spread. */
export const hasPeriod = (p: PaymentRow) =>
  !!p.periodStart && !!p.periodEnd && p.periodEnd >= p.periodStart;

/**
 * How much of a payment was *earned* between `from` (inclusive) and `to`
 * (exclusive).
 *
 * Twelve weeks paid in April is not April's revenue: it is a week's worth in
 * each of twelve weeks. Spreading it across the period it buys is what turns
 * a lumpy cash line — ₹92,000 in April, ₹20,000 in June — into one where the
 * months can be compared. A payment with no period can't be spread, so it is
 * counted on the day it was paid, the same as cash.
 */
export function earnedWithin(p: PaymentRow, from: string, to: string): number {
  if (p.status !== "paid") return 0;
  if (hasPeriod(p)) {
    const total = dayNum(p.periodEnd!) - dayNum(p.periodStart!) + 1;
    return (Number(p.amount) * overlapDays(p.periodStart!, p.periodEnd!, from, to)) / total;
  }
  const on = p.paidOn ?? p.periodStart;
  return on && on >= from && on < to ? Number(p.amount) : 0;
}

/** Cash that arrived between `from` (inclusive) and `to` (exclusive). */
export function collectedWithin(p: PaymentRow, from: string, to: string): number {
  if (p.status !== "paid" || !p.paidOn) return 0;
  return p.paidOn >= from && p.paidOn < to ? Number(p.amount) : 0;
}

export interface MonthRevenue {
  month: string;
  collected: number;
  earned: number;
}

/** Collected and earned, month by month. */
export function revenueByMonth(payments: PaymentRow[], months: string[]): MonthRevenue[] {
  return months.map((month) => {
    const from = monthStart(month);
    const to = nextMonthStart(month);
    let collected = 0;
    let earned = 0;
    for (const p of payments) {
      collected += collectedWithin(p, from, to);
      earned += earnedWithin(p, from, to);
    }
    return { month, collected, earned };
  });
}

/* ---------------- attribution ---------------- */

/**
 * Which class a payment belongs to.
 *
 * Payments recorded from now on name their batch. Older ones don't, so they
 * fall back to the student's class — but only when they are in exactly one.
 * A student in two classes is genuinely ambiguous, and guessing would move
 * money between batches on a coin toss; those stay unattributed and are
 * reported as such.
 */
export function batchFor(p: PaymentRow, activeBatchesByStudent: Map<string, string[]>): string | null {
  if (p.batchId) return p.batchId;
  const batches = activeBatchesByStudent.get(p.studentId) ?? [];
  return batches.length === 1 ? batches[0] : null;
}

export function activeBatchesByStudent(enrollments: EnrollmentRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of enrollments) {
    if (e.status !== "active") continue;
    const list = map.get(e.studentId) ?? [];
    if (!list.includes(e.batchId)) list.push(e.batchId);
    map.set(e.studentId, list);
  }
  return map;
}

/* ---------------- batch economics ---------------- */

export type Verdict = "healthy" | "thin" | "loss" | "no-data";

export interface BatchEconomics {
  batch: BatchRow;
  enrolled: number;
  capacity: number;
  /** Enrolled ÷ capacity, 0–1. Null when capacity isn't set. */
  fill: number | null;
  revenue: number;
  teacherCost: number;
  roomCost: number;
  contribution: number;
  /** Contribution ÷ revenue, as a percentage. Null with no revenue. */
  marginPct: number | null;
  classHours: number;
  completedSessions: number;
  revenuePerHour: number | null;
  /** Average monthly fee of the students in it. */
  avgMonthlyFee: number | null;
  /** Students needed for revenue to cover the batch's own costs. */
  breakEven: number | null;
  verdict: Verdict;
  flags: {
    lowFill: boolean;
    belowBreakEven: boolean;
    /** Students enrolled but no completed class logged: teacher cost is understated. */
    noSessionsLogged: boolean;
  };
}

export interface EconomicsInput {
  batches: BatchRow[];
  sessions: SessionRow[];
  expenses: ExpenseRow[];
  payments: PaymentRow[];
  enrollments: EnrollmentRow[];
  students: StudentRow[];
  /** First day of the range, inclusive. */
  from: string;
  /** First day after the range. */
  to: string;
}

export interface EconomicsResult {
  rows: BatchEconomics[];
  /** Earned in range but not attributable to any one batch. */
  unattributedRevenue: number;
  /** Expenses with no office: the company's overhead, not any class's. */
  sharedOverhead: number;
  /** Paid payments in range with no period, counted on the day they were paid. */
  unspreadPayments: number;
}

/** A margin below this is positive but not much of a cushion. */
export const THIN_MARGIN_PCT = 25;
/** Half-empty is the point a room stops paying for itself. */
export const LOW_FILL = 0.5;

/**
 * What each class earns and what it costs, over a range.
 *
 * Contribution is revenue less the two costs a class actually causes: its
 * teacher and its share of its office. Company overhead — expenses not tied
 * to an office — is left out on purpose and reported separately; spreading it
 * across batches would make every class look worse by the same arbitrary
 * amount and change nothing about which ones to keep.
 *
 * Teacher cost follows each teacher's pay type. Hourly and per-session
 * teachers cost what their completed classes cost. A salaried teacher's month
 * is shared across their classes by how many each actually ran, and evenly if
 * none was logged. An office's costs are shared across the active classes in
 * it by their weekly class time.
 */
export function computeBatchEconomics(input: EconomicsInput): EconomicsResult {
  const { batches, sessions, expenses, payments, enrollments, students, from, to } = input;
  const months = monthsBetween(from, to);
  const monthCount = Math.max(1, months.length);
  const byStudent = activeBatchesByStudent(enrollments);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const batchById = new Map(batches.map((b) => [b.id, b]));

  // Revenue by batch.
  const revenue = new Map<string, number>();
  let unattributedRevenue = 0;
  let unspreadPayments = 0;
  for (const p of payments) {
    const earned = earnedWithin(p, from, to);
    if (earned === 0) continue;
    if (!hasPeriod(p)) unspreadPayments += 1;
    const b = batchFor(p, byStudent);
    if (b && batchById.has(b)) revenue.set(b, (revenue.get(b) ?? 0) + earned);
    else unattributedRevenue += earned;
  }

  // Completed classes in range, by batch and by batch-month.
  const completed = sessions.filter((s) => s.status === "completed" && s.date >= from && s.date < to);
  const hoursByBatch = new Map<string, number>();
  const countByBatch = new Map<string, number>();
  const countByBatchMonth = new Map<string, number>();
  for (const s of completed) {
    const b = batchById.get(s.batchId);
    if (!b) continue;
    const mins = s.durationMin ?? b.durationMin ?? 60;
    hoursByBatch.set(s.batchId, (hoursByBatch.get(s.batchId) ?? 0) + mins / 60);
    countByBatch.set(s.batchId, (countByBatch.get(s.batchId) ?? 0) + 1);
    const key = `${s.batchId}|${monthOf(s.date)}`;
    countByBatchMonth.set(key, (countByBatchMonth.get(key) ?? 0) + 1);
  }

  // Teacher cost by batch.
  const teacherCost = new Map<string, number>();
  const batchesByTeacher = new Map<string, BatchRow[]>();
  for (const b of batches) {
    if (!b.teacherId) continue;
    const list = batchesByTeacher.get(b.teacherId) ?? [];
    list.push(b);
    batchesByTeacher.set(b.teacherId, list);
  }
  for (const b of batches) {
    if (b.paymentType === "per_hour") teacherCost.set(b.id, b.rate * (hoursByBatch.get(b.id) ?? 0));
    else if (b.paymentType === "per_session") teacherCost.set(b.id, b.rate * (countByBatch.get(b.id) ?? 0));
  }
  for (const [, teacherBatches] of batchesByTeacher) {
    const salaried = teacherBatches.filter((b) => b.paymentType === "fixed_monthly");
    if (!salaried.length) continue;
    const salary = salaried[0].rate;
    const active = teacherBatches.filter((b) => b.isActive);
    for (const month of months) {
      const counts = teacherBatches.map((b) => countByBatchMonth.get(`${b.id}|${month}`) ?? 0);
      const total = counts.reduce((a, c) => a + c, 0);
      teacherBatches.forEach((b, i) => {
        const share = total > 0 ? counts[i] / total : active.length && b.isActive ? 1 / active.length : 0;
        teacherCost.set(b.id, (teacherCost.get(b.id) ?? 0) + salary * share);
      });
    }
  }

  // Office cost by batch, shared by weekly class time among active batches there.
  const roomCost = new Map<string, number>();
  let sharedOverhead = 0;
  const officeSpend = new Map<string, number>();
  for (const e of expenses) {
    if (e.date < from || e.date >= to) continue;
    if (!e.locationId) {
      sharedOverhead += Number(e.amount);
      continue;
    }
    officeSpend.set(e.locationId, (officeSpend.get(e.locationId) ?? 0) + Number(e.amount));
  }
  for (const [locationId, spend] of officeSpend) {
    const here = batches.filter((b) => b.isActive && b.locationId === locationId);
    const minutes = here.reduce((a, b) => a + (b.durationMin || 60), 0);
    if (!minutes) {
      sharedOverhead += spend; // an office with no running classes is overhead
      continue;
    }
    for (const b of here) roomCost.set(b.id, (spend * (b.durationMin || 60)) / minutes);
  }

  // Who is in each class now.
  const enrolledStudents = new Map<string, StudentRow[]>();
  for (const e of enrollments) {
    if (e.status !== "active") continue;
    const s = studentById.get(e.studentId);
    if (!s?.isActive) continue;
    const list = enrolledStudents.get(e.batchId) ?? [];
    if (!list.some((x) => x.id === s.id)) list.push(s);
    enrolledStudents.set(e.batchId, list);
  }
  const allFees = students.filter((s) => s.isActive && s.feeAmount > 0).map((s) => monthlyFee(s.feeAmount, s.feeCycle));
  const schoolAvgFee = allFees.length ? allFees.reduce((a, f) => a + f, 0) / allFees.length : null;

  const rows: BatchEconomics[] = batches.map((batch) => {
    const kids = enrolledStudents.get(batch.id) ?? [];
    const enrolled = kids.length;
    const capacity = batch.maxStudents || 0;
    const rev = revenue.get(batch.id) ?? 0;
    const tCost = teacherCost.get(batch.id) ?? 0;
    const rCost = roomCost.get(batch.id) ?? 0;
    const contribution = rev - tCost - rCost;
    const classHours = hoursByBatch.get(batch.id) ?? 0;
    const completedSessions = countByBatch.get(batch.id) ?? 0;

    const fees = kids.filter((k) => k.feeAmount > 0).map((k) => monthlyFee(k.feeAmount, k.feeCycle));
    // An empty class still needs a price to judge against: the school's own.
    const avgMonthlyFee = fees.length ? fees.reduce((a, f) => a + f, 0) / fees.length : schoolAvgFee;
    const monthlyCost = (tCost + rCost) / monthCount;
    const breakEven =
      avgMonthlyFee && avgMonthlyFee > 0 && monthlyCost > 0 ? Math.ceil(monthlyCost / avgMonthlyFee) : null;

    const marginPct = rev > 0 ? (contribution / rev) * 100 : null;
    const verdict: Verdict =
      rev === 0 && tCost === 0 && rCost === 0
        ? "no-data"
        : contribution < 0
          ? "loss"
          : (marginPct ?? 0) < THIN_MARGIN_PCT
            ? "thin"
            : "healthy";

    return {
      batch,
      enrolled,
      capacity,
      fill: capacity > 0 ? enrolled / capacity : null,
      revenue: rev,
      teacherCost: tCost,
      roomCost: rCost,
      contribution,
      marginPct,
      classHours,
      completedSessions,
      revenuePerHour: classHours > 0 ? rev / classHours : null,
      avgMonthlyFee,
      breakEven,
      verdict,
      flags: {
        lowFill: capacity > 0 && enrolled / capacity < LOW_FILL,
        belowBreakEven: breakEven != null && enrolled < breakEven,
        noSessionsLogged: enrolled > 0 && completedSessions === 0,
      },
    };
  });

  return { rows, unattributedRevenue, sharedOverhead, unspreadPayments };
}

/** A class worth a hard look: losing money, or half-empty and barely covering itself. */
export const isDeadWeight = (e: BatchEconomics) =>
  e.batch.isActive && (e.verdict === "loss" || (e.flags.lowFill && e.verdict === "thin"));

/* ---------------- renewals ---------------- */

export type RenewalStatus = "expired" | "due" | "ok" | "never-paid";

export interface RenewalRow {
  student: StudentRow;
  batchId: string | null;
  lastPaidOn: string | null;
  lastAmount: number | null;
  /** Where the last paid period ended, as recorded. */
  periodEnd: string | null;
  /** Classes the school cancelled inside that period — each one owed back. */
  cancelledCredits: number;
  /** periodEnd pushed out a week for every cancelled class. */
  expiresOn: string | null;
  daysLeft: number | null;
  status: RenewalStatus;
  /** The period a renewal would pay for, starting the day after expiry. */
  nextPeriod: { start: string; end: string };
}

/** How far ahead "due" reaches. */
export const DUE_WITHIN_DAYS = 14;

/** The period a fee on this cycle buys, from `start`. */
export function periodFrom(start: string, cycle: FeeCycle): { start: string; end: string } {
  return { start, end: addDays(addMonths(start, CYCLE_MONTHS[cycle] ?? 1), -1) };
}

/**
 * Who has paid up to when, and who is about to run out.
 *
 * This is what every teacher's spreadsheet is really for: the fee total is a
 * by-product, the column that matters is the expiry date. A pack runs to the
 * end of the period the last payment bought, plus a week for every class the
 * school cancelled inside it — a class the student paid for and didn't get.
 * A class the student chose to miss is theirs to lose, and doesn't extend it.
 */
export function computeRenewals(input: {
  students: StudentRow[];
  enrollments: EnrollmentRow[];
  payments: PaymentRow[];
  sessions: SessionRow[];
  today: string;
}): RenewalRow[] {
  const { students, enrollments, payments, sessions, today } = input;
  const byStudent = activeBatchesByStudent(enrollments);

  const rows: RenewalRow[] = [];
  for (const student of students) {
    if (!student.isActive) continue;
    const batches = byStudent.get(student.id) ?? [];
    if (!batches.length) continue; // not in a class, nothing to renew
    const batchId = batches.length === 1 ? batches[0] : null;

    const paid = payments.filter((p) => p.studentId === student.id && p.status === "paid");
    // The payment that reaches furthest, by the period it bought or, lacking
    // one, a cycle from the day it was paid.
    let last: PaymentRow | null = null;
    let lastEnd: string | null = null;
    for (const p of paid) {
      const end = hasPeriod(p)
        ? p.periodEnd!
        : p.paidOn
          ? periodFrom(p.paidOn, student.feeCycle).end
          : null;
      if (end && (!lastEnd || end > lastEnd)) {
        last = p;
        lastEnd = end;
      }
    }

    if (!last || !lastEnd) {
      rows.push({
        student,
        batchId,
        lastPaidOn: null,
        lastAmount: null,
        periodEnd: null,
        cancelledCredits: 0,
        expiresOn: null,
        daysLeft: null,
        status: "never-paid",
        nextPeriod: periodFrom(today, student.feeCycle),
      });
      continue;
    }

    const periodStart = last.periodStart ?? last.paidOn ?? lastEnd;
    const cancelledCredits = sessions.filter(
      (s) => batches.includes(s.batchId) && s.status === "cancelled" && s.date >= periodStart && s.date <= lastEnd!,
    ).length;
    const expiresOn = addDays(lastEnd, 7 * cancelledCredits);
    const daysLeft = dayNum(expiresOn) - dayNum(today);
    const status: RenewalStatus = daysLeft < 0 ? "expired" : daysLeft <= DUE_WITHIN_DAYS ? "due" : "ok";

    rows.push({
      student,
      batchId,
      lastPaidOn: last.paidOn,
      lastAmount: Number(last.amount),
      periodEnd: lastEnd,
      cancelledCredits,
      expiresOn,
      daysLeft,
      status,
      nextPeriod: periodFrom(addDays(expiresOn, 1), student.feeCycle),
    });
  }

  // Most urgent first: longest-lapsed, then soonest to run out, then the
  // never-paid, then everyone who is fine.
  const rank: Record<RenewalStatus, number> = { expired: 0, due: 1, "never-paid": 2, ok: 3 };
  return rows.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.daysLeft ?? 0) - (b.daysLeft ?? 0) ||
      a.student.name.localeCompare(b.student.name),
  );
}
