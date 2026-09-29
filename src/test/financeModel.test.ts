import { describe, it, expect } from "vitest";
import {
  addMonths,
  batchFor,
  activeBatchesByStudent,
  computeBatchEconomics,
  computeRenewals,
  earnedWithin,
  isDeadWeight,
  monthlyFee,
  monthsBetween,
  periodFrom,
  revenueByMonth,
  type BatchRow,
  type EnrollmentRow,
  type PaymentRow,
  type SessionRow,
  type StudentRow,
} from "@/lib/financeModel";

/**
 * The finance model, checked against the shape of a real teacher's register:
 * ₹4,000 a month, mostly paid twelve weeks at a time, lumpy as a result.
 */

const pay = (over: Partial<PaymentRow>): PaymentRow => ({
  studentId: "s1",
  batchId: null,
  amount: 12000,
  paidOn: "2026-04-01",
  periodStart: null,
  periodEnd: null,
  status: "paid",
  ...over,
});

const student = (id: string, over: Partial<StudentRow> = {}): StudentRow => ({
  id,
  name: id,
  feeAmount: 4000,
  feeCycle: "monthly",
  isActive: true,
  ...over,
});

const batch = (id: string, over: Partial<BatchRow> = {}): BatchRow => ({
  id,
  label: id,
  locationId: "loc205",
  locationName: "205",
  teacherId: "t1",
  teacherName: "Brendan",
  paymentType: "per_hour",
  rate: 1000,
  durationMin: 60,
  maxStudents: 6,
  isActive: true,
  ...over,
});

const enrol = (studentId: string, batchId: string, status = "active"): EnrollmentRow => ({ studentId, batchId, status });
const session = (batchId: string, date: string, status = "completed", durationMin: number | null = null): SessionRow => ({
  batchId,
  date,
  status,
  durationMin,
});

describe("fees and dates", () => {
  it("expresses every cycle per month — a semester is six, not three", () => {
    expect(monthlyFee(4000, "monthly")).toBe(4000);
    expect(monthlyFee(12000, "quarterly")).toBe(4000);
    expect(monthlyFee(24000, "semester")).toBe(4000);
  });

  it("clamps a month-end to the shorter month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-04-15", 3)).toBe("2026-07-15");
  });

  it("lists whole months across a range", () => {
    expect(monthsBetween("2026-04-01", "2026-07-01")).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("gives a period that ends the day before the next one begins", () => {
    expect(periodFrom("2026-04-01", "quarterly")).toEqual({ start: "2026-04-01", end: "2026-06-30" });
    expect(periodFrom("2026-04-01", "monthly")).toEqual({ start: "2026-04-01", end: "2026-04-30" });
  });
});

describe("collected versus earned", () => {
  const quarter = pay({ periodStart: "2026-04-01", periodEnd: "2026-06-30" }); // 91 days

  it("spreads a twelve-week payment across the weeks it buys", () => {
    const apr = earnedWithin(quarter, "2026-04-01", "2026-05-01");
    const may = earnedWithin(quarter, "2026-05-01", "2026-06-01");
    const jun = earnedWithin(quarter, "2026-06-01", "2026-07-01");
    expect(apr).toBeCloseTo((12000 * 30) / 91);
    expect(may).toBeCloseTo((12000 * 31) / 91);
    expect(jun).toBeCloseTo((12000 * 30) / 91);
    // Nothing lost or invented in the spreading.
    expect(apr + may + jun).toBeCloseTo(12000);
  });

  it("shows the cash all landing in the month it was paid", () => {
    const rows = revenueByMonth([quarter], ["2026-04", "2026-05", "2026-06"]);
    expect(rows.map((r) => r.collected)).toEqual([12000, 0, 0]);
    expect(rows[1].earned).toBeGreaterThan(0);
  });

  it("counts a payment with no period on the day it was paid", () => {
    const loose = pay({ paidOn: "2026-05-10" });
    expect(earnedWithin(loose, "2026-05-01", "2026-06-01")).toBe(12000);
    expect(earnedWithin(loose, "2026-04-01", "2026-05-01")).toBe(0);
  });

  it("ignores anything not paid", () => {
    expect(earnedWithin(pay({ status: "pending", periodStart: "2026-04-01", periodEnd: "2026-06-30" }), "2026-04-01", "2026-07-01")).toBe(0);
  });
});

describe("which class a payment belongs to", () => {
  it("uses the batch it was recorded against", () => {
    expect(batchFor(pay({ batchId: "b9" }), new Map())).toBe("b9");
  });

  it("falls back to the student's only class", () => {
    const map = activeBatchesByStudent([enrol("s1", "b1")]);
    expect(batchFor(pay({}), map)).toBe("b1");
  });

  it("refuses to guess for a student in two classes", () => {
    const map = activeBatchesByStudent([enrol("s1", "b1"), enrol("s1", "b2")]);
    expect(batchFor(pay({}), map)).toBeNull();
  });
});

describe("batch economics", () => {
  const april = { from: "2026-04-01", to: "2026-05-01" };

  it("costs an hourly teacher by the classes actually taught", () => {
    const { rows } = computeBatchEconomics({
      ...april,
      batches: [batch("b1", { rate: 1000, durationMin: 90 })],
      sessions: [session("b1", "2026-04-05"), session("b1", "2026-04-12"), session("b1", "2026-04-19", "cancelled")],
      expenses: [],
      payments: [],
      enrollments: [],
      students: [],
    });
    // Two completed 90-minute classes; the cancelled one costs nothing.
    expect(rows[0].teacherCost).toBe(3000);
    expect(rows[0].classHours).toBe(3);
  });

  it("costs a per-session teacher per class", () => {
    const { rows } = computeBatchEconomics({
      ...april,
      batches: [batch("b1", { paymentType: "per_session", rate: 800 })],
      sessions: [session("b1", "2026-04-05"), session("b1", "2026-04-12")],
      expenses: [],
      payments: [],
      enrollments: [],
      students: [],
    });
    expect(rows[0].teacherCost).toBe(1600);
  });

  it("shares a salaried teacher's month by the classes each batch ran", () => {
    const salaried = { paymentType: "fixed_monthly" as const, rate: 30000 };
    const { rows } = computeBatchEconomics({
      ...april,
      batches: [batch("b1", salaried), batch("b2", salaried)],
      sessions: [
        session("b1", "2026-04-05"),
        session("b1", "2026-04-12"),
        session("b1", "2026-04-19"),
        session("b2", "2026-04-09"),
      ],
      expenses: [],
      payments: [],
      enrollments: [],
      students: [],
    });
    expect(rows[0].teacherCost).toBe(22500);
    expect(rows[1].teacherCost).toBe(7500);
  });

  it("shares a salary evenly when no class was logged, rather than losing it", () => {
    const salaried = { paymentType: "fixed_monthly" as const, rate: 30000 };
    const { rows } = computeBatchEconomics({
      ...april,
      batches: [batch("b1", salaried), batch("b2", salaried)],
      sessions: [],
      expenses: [],
      payments: [],
      enrollments: [],
      students: [],
    });
    expect(rows[0].teacherCost + rows[1].teacherCost).toBe(30000);
  });

  it("shares an office's costs by weekly class time, and keeps company overhead apart", () => {
    const { rows, sharedOverhead } = computeBatchEconomics({
      ...april,
      batches: [batch("b1", { durationMin: 60 }), batch("b2", { durationMin: 120 })],
      sessions: [],
      expenses: [
        { amount: 30000, locationId: "loc205", date: "2026-04-01" },
        { amount: 5000, locationId: null, date: "2026-04-10" },
        { amount: 9999, locationId: "loc205", date: "2026-05-01" }, // next month
      ],
      payments: [],
      enrollments: [],
      students: [],
    });
    expect(rows[0].roomCost).toBe(10000);
    expect(rows[1].roomCost).toBe(20000);
    expect(sharedOverhead).toBe(5000);
  });

  it("calls a batch that doesn't cover its costs a loss, and a dead weight", () => {
    const { rows } = computeBatchEconomics({
      ...april,
      batches: [batch("b1", { rate: 2000, maxStudents: 8 })],
      sessions: ["2026-04-05", "2026-04-12", "2026-04-19", "2026-04-26"].map((d) => session("b1", d)),
      expenses: [],
      payments: [pay({ studentId: "s1", batchId: "b1", amount: 4000, periodStart: "2026-04-01", periodEnd: "2026-04-30" })],
      enrollments: [enrol("s1", "b1")],
      students: [student("s1")],
    });
    const r = rows[0];
    expect(r.revenue).toBeCloseTo(4000);
    expect(r.teacherCost).toBe(8000);
    expect(r.verdict).toBe("loss");
    // 1 of 8 seats; costs ₹8,000 a month against ₹4,000 a head → needs 2.
    expect(r.flags.lowFill).toBe(true);
    expect(r.breakEven).toBe(2);
    expect(r.flags.belowBreakEven).toBe(true);
    expect(isDeadWeight(r)).toBe(true);
  });

  it("calls a full, well-priced batch healthy", () => {
    const kids = ["s1", "s2", "s3", "s4", "s5", "s6"];
    const { rows } = computeBatchEconomics({
      ...april,
      batches: [batch("b1", { rate: 1000 })],
      sessions: ["2026-04-05", "2026-04-12", "2026-04-19", "2026-04-26"].map((d) => session("b1", d)),
      expenses: [],
      payments: kids.map((id) =>
        pay({ studentId: id, batchId: "b1", amount: 4000, periodStart: "2026-04-01", periodEnd: "2026-04-30" }),
      ),
      enrollments: kids.map((id) => enrol(id, "b1")),
      students: kids.map((id) => student(id)),
    });
    expect(rows[0].verdict).toBe("healthy");
    expect(rows[0].fill).toBe(1);
    expect(isDeadWeight(rows[0])).toBe(false);
  });

  it("warns when students are enrolled but no class was logged", () => {
    const { rows } = computeBatchEconomics({
      ...april,
      batches: [batch("b1")],
      sessions: [],
      expenses: [],
      payments: [],
      enrollments: [enrol("s1", "b1")],
      students: [student("s1")],
    });
    // Teacher cost would read as zero and flatter the batch.
    expect(rows[0].flags.noSessionsLogged).toBe(true);
  });

  it("reports revenue it cannot attribute instead of guessing", () => {
    const { unattributedRevenue } = computeBatchEconomics({
      ...april,
      batches: [batch("b1"), batch("b2")],
      sessions: [],
      expenses: [],
      payments: [pay({ studentId: "s1", amount: 4000, paidOn: "2026-04-10" })],
      enrollments: [enrol("s1", "b1"), enrol("s1", "b2")],
      students: [student("s1")],
    });
    expect(unattributedRevenue).toBe(4000);
  });
});

describe("renewals", () => {
  const today = "2026-09-29";
  const base = {
    students: [student("s1", { feeCycle: "quarterly", feeAmount: 12000 })],
    enrollments: [enrol("s1", "b1")],
    sessions: [] as SessionRow[],
    today,
  };

  it("runs a pack to the end of the period it bought", () => {
    const [r] = computeRenewals({
      ...base,
      payments: [pay({ periodStart: "2026-08-09", periodEnd: "2026-11-01" })],
    });
    expect(r.expiresOn).toBe("2026-11-01");
    expect(r.status).toBe("ok");
    expect(r.daysLeft).toBe(33);
  });

  it("flags one running out inside a fortnight", () => {
    const [r] = computeRenewals({ ...base, payments: [pay({ periodStart: "2026-07-01", periodEnd: "2026-10-06" })] });
    expect(r.status).toBe("due");
    expect(r.daysLeft).toBe(7);
  });

  it("flags one that has already run out", () => {
    const [r] = computeRenewals({ ...base, payments: [pay({ periodStart: "2026-06-01", periodEnd: "2026-09-20" })] });
    expect(r.status).toBe("expired");
    expect(r.daysLeft).toBe(-9);
  });

  it("owes a week back for each class the school cancelled, and none for a class they skipped", () => {
    const [r] = computeRenewals({
      ...base,
      payments: [pay({ periodStart: "2026-07-01", periodEnd: "2026-09-20" })],
      sessions: [
        session("b1", "2026-07-12", "cancelled"),
        session("b1", "2026-08-16", "cancelled"),
        session("b1", "2026-10-04", "cancelled"), // after the period: not owed
        session("b1", "2026-08-23", "completed"),
      ],
    });
    expect(r.cancelledCredits).toBe(2);
    expect(r.expiresOn).toBe("2026-10-04");
    expect(r.status).toBe("due");
  });

  it("names a student who is in a class and has never paid", () => {
    const [r] = computeRenewals({ ...base, payments: [] });
    expect(r.status).toBe("never-paid");
  });

  it("leaves out students who aren't in a class", () => {
    expect(computeRenewals({ ...base, enrollments: [], payments: [] })).toEqual([]);
  });

  it("works out a payment with no period from the student's cycle", () => {
    const [r] = computeRenewals({ ...base, payments: [pay({ paidOn: "2026-08-01" })] });
    expect(r.periodEnd).toBe("2026-10-31");
  });

  it("puts the most urgent at the top", () => {
    const rows = computeRenewals({
      ...base,
      students: ["fine", "soon", "gone", "never"].map((id) => student(id, { feeCycle: "quarterly" })),
      enrollments: ["fine", "soon", "gone", "never"].map((id) => enrol(id, "b1")),
      payments: [
        pay({ studentId: "fine", periodStart: "2026-09-01", periodEnd: "2026-12-01" }),
        pay({ studentId: "soon", periodStart: "2026-07-01", periodEnd: "2026-10-03" }),
        pay({ studentId: "gone", periodStart: "2026-06-01", periodEnd: "2026-09-01" }),
      ],
    });
    expect(rows.map((r) => r.student.id)).toEqual(["gone", "soon", "never", "fine"]);
  });

  it("offers the next period starting the day after expiry", () => {
    const [r] = computeRenewals({ ...base, payments: [pay({ periodStart: "2026-07-01", periodEnd: "2026-09-30" })] });
    expect(r.nextPeriod).toEqual({ start: "2026-10-01", end: "2026-12-31" });
  });
});
