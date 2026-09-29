import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { addMonths } from "@/lib/financeModel";
import { toLocalIso } from "@/lib/date";
import type {
  BatchRow,
  EnrollmentRow,
  ExpenseRow,
  FeeCycle,
  PaymentRow,
  PaymentType,
  SessionRow,
  StudentRow,
} from "@/lib/financeModel";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PAGE = 1000;

/**
 * Every row a query returns, not just the first thousand.
 *
 * The API caps a read at a thousand rows and says nothing when it does. A
 * payments table passes that within a few years, and from then every total on
 * these pages would quietly stop counting. So each table is read in pages
 * until one comes back short.
 */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** How a class is named on the finance pages: "Sun 10:45 · Brendan". */
function describe(b: any): string {
  const time = String(b.start_time ?? "").slice(0, 5);
  return `${DAYS[b.day_of_week] ?? "?"} ${time}`.trim();
}

export interface FinanceDataset {
  payments: PaymentRow[];
  students: StudentRow[];
  enrollments: EnrollmentRow[];
  batches: BatchRow[];
  sessions: SessionRow[];
  expenses: ExpenseRow[];
  /** The earliest date sessions and expenses were read from. */
  since: string;
}

/**
 * Everything the finance pages work from, read once.
 *
 * The older calculators queried per month, per teacher and per batch — a
 * year's P&L ran to hundreds of requests, enough to have the app rate
 * limited. This reads each table a single time and leaves the arithmetic to
 * lib/financeModel, which needs no database at all.
 *
 * Sessions and expenses go back two financial years: far enough for any range
 * the pages offer and for the pack a renewal is working out from.
 */
export function useFinanceDataset() {
  return useQuery({
    queryKey: ["finance-dataset"],
    queryFn: async (): Promise<FinanceDataset> => {
      const today = toLocalIso();
      const fyStartYear = Number(today.slice(5, 7)) >= 4 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
      const since = addMonths(`${fyStartYear}-04-01`, -12);

      const [payments, students, enrollments, batches, sessions, expenses] = await Promise.all([
        // "*" rather than naming batch_id: the column arrives by migration,
        // and naming it would fail the whole read until then.
        readAll<any>((a, b) => supabase.from("payments").select("*").range(a, b)),
        readAll<any>((a, b) =>
          supabase.from("students").select("id, name, fee_amount, fee_cycle, is_active").range(a, b),
        ),
        readAll<any>((a, b) => supabase.from("enrollments").select("student_id, batch_id, status").range(a, b)),
        readAll<any>((a, b) =>
          supabase
            .from("batches")
            .select(
              "id, code, day_of_week, start_time, duration_min, max_students, is_active, location_id, teacher_id, teachers(name, payment_type, rate), locations(name)",
            )
            .range(a, b),
        ),
        readAll<any>((a, b) =>
          supabase
            .from("sessions")
            .select("batch_id, scheduled_date, status, duration_min")
            .gte("scheduled_date", since)
            .range(a, b),
        ),
        readAll<any>((a, b) =>
          supabase.from("expenses").select("amount, location_id, incurred_on").gte("incurred_on", since).range(a, b),
        ),
      ]);

      return {
        since,
        payments: payments.map((p) => ({
          studentId: p.student_id,
          batchId: p.batch_id ?? null,
          amount: Number(p.amount ?? 0),
          paidOn: p.paid_on ?? null,
          periodStart: p.period_start ?? null,
          periodEnd: p.period_end ?? null,
          status: p.status,
        })),
        students: students.map((s) => ({
          id: s.id,
          name: s.name,
          feeAmount: Number(s.fee_amount ?? 0),
          feeCycle: (s.fee_cycle ?? "monthly") as FeeCycle,
          isActive: !!s.is_active,
        })),
        enrollments: enrollments.map((e) => ({ studentId: e.student_id, batchId: e.batch_id, status: e.status })),
        batches: batches.map((b) => ({
          id: b.id,
          label: b.code || describe(b),
          locationId: b.location_id ?? null,
          locationName: b.locations?.name ?? null,
          teacherId: b.teacher_id ?? null,
          teacherName: b.teachers?.name ?? null,
          paymentType: (b.teachers?.payment_type ?? null) as PaymentType | null,
          rate: Number(b.teachers?.rate ?? 0),
          durationMin: Number(b.duration_min ?? 60),
          maxStudents: Number(b.max_students ?? 0),
          isActive: !!b.is_active,
          when: describe(b),
        })),
        sessions: sessions.map((s) => ({
          batchId: s.batch_id,
          date: s.scheduled_date,
          status: s.status,
          durationMin: s.duration_min ?? null,
        })),
        expenses: expenses.map((e) => ({
          amount: Number(e.amount ?? 0),
          locationId: e.location_id ?? null,
          date: e.incurred_on,
        })),
      };
    },
  });
}
