import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { useFinanceDataset } from "@/hooks/useFinanceDataset";
import {
  addMonths,
  computeBatchEconomics,
  computeRenewals,
  isDeadWeight,
  monthsBetween,
  revenueByMonth,
} from "@/lib/financeModel";
import { formatINR } from "@/lib/finance";
import { toLocalIso } from "@/lib/date";

function KPI({ label, value, hint, to, tone }: { label: string; value: string; hint?: string; to?: string; tone?: string }) {
  const body = (
    <>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone ?? ""}`}>{value}</div>
      {hint && <div className={`text-xs mt-1 ${to ? "text-primary" : "text-muted-foreground"}`}>{hint}</div>}
    </>
  );
  return to ? (
    <Link to={to} className="block rounded-lg border p-4 bg-card hover:bg-muted transition-colors">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border p-4 bg-card">{body}</div>
  );
}

/**
 * The school's money at a glance.
 *
 * Two revenue lines, because they answer different questions. Collected is
 * the cash that arrived — what the bank and the accountant see, and lumpy,
 * because most students pay twelve weeks at once. Earned spreads each payment
 * across the weeks it buys, which is the only way to compare one month with
 * the next or tell whether the business is growing.
 *
 * Underneath, the two things to act on: who has run out, and which classes
 * don't pay for themselves. Everything is worked out from a single read of
 * each table.
 */
export default function Overview() {
  const { data, isLoading, error } = useFinanceDataset();
  const today = toLocalIso();
  const thisMonth = `${today.slice(0, 7)}-01`;
  const nextMonth = addMonths(thisMonth, 1);
  const fyStart = Number(today.slice(5, 7)) >= 4 ? `${today.slice(0, 4)}-04-01` : `${Number(today.slice(0, 4)) - 1}-04-01`;
  const fyLabel = `FY ${fyStart.slice(0, 4)}-${String(Number(fyStart.slice(0, 4)) + 1).slice(2)}`;

  const view = useMemo(() => {
    if (!data) return null;
    const year = revenueByMonth(data.payments, monthsBetween(fyStart, addMonths(fyStart, 12)));
    const month = computeBatchEconomics({ ...data, from: thisMonth, to: nextMonth });
    const quarter = computeBatchEconomics({ ...data, from: addMonths(thisMonth, -2), to: nextMonth });
    const renewals = computeRenewals({ ...data, today });
    const now = year.find((m) => m.month === today.slice(0, 7)) ?? { collected: 0, earned: 0 };
    const teacher = month.rows.reduce((a, r) => a + r.teacherCost, 0);
    const expenses = data.expenses
      .filter((e) => e.date >= thisMonth && e.date < nextMonth)
      .reduce((a, e) => a + e.amount, 0);
    const toDate = year.filter((m) => `${m.month}-01` <= thisMonth);
    return {
      chart: year.map((m) => ({
        month: new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" }),
        Collected: Math.round(m.collected),
        Earned: Math.round(m.earned),
      })),
      collected: now.collected,
      earned: now.earned,
      teacher,
      expenses,
      net: now.earned - teacher - expenses,
      fyCollected: toDate.reduce((a, m) => a + m.collected, 0),
      fyEarned: toDate.reduce((a, m) => a + m.earned, 0),
      renewals,
      dead: quarter.rows.filter(isDeadWeight).sort((a, b) => a.contribution - b.contribution),
    };
  }, [data, fyStart, thisMonth, nextMonth, today]);

  if (error) return <div className="p-6 text-red-600">Couldn't load finance data: {(error as Error).message}</div>;

  const expired = view?.renewals.filter((r) => r.status === "expired") ?? [];
  const due = view?.renewals.filter((r) => r.status === "due") ?? [];
  const neverPaid = view?.renewals.filter((r) => r.status === "never-paid") ?? [];
  const atStake = [...expired, ...due].reduce((a, r) => a + (r.student.feeAmount || 0), 0);
  const monthName = new Date(`${thisMonth}T00:00:00`).toLocaleDateString(undefined, { month: "long" });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Finance · Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label={`Collected · ${monthName}`} value={formatINR(view?.collected ?? 0)} hint="Cash that arrived" />
        <KPI label={`Earned · ${monthName}`} value={formatINR(view?.earned ?? 0)} hint="Fees spread over what they buy" />
        <KPI label="Teachers" value={formatINR(view?.teacher ?? 0)} hint="For completed classes" />
        <KPI label="Expenses" value={formatINR(view?.expenses ?? 0)} hint="Offices and overhead" />
        <KPI
          label="Net"
          value={formatINR(view?.net ?? 0)}
          tone={(view?.net ?? 0) < 0 ? "text-red-600" : ""}
          hint="Full P&L →"
          to="pnl"
        />
      </div>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="font-semibold">Revenue · {fyLabel}</h2>
          <div className="text-sm text-muted-foreground">
            To date: {formatINR(view?.fyCollected ?? 0)} collected · {formatINR(view?.fyEarned ?? 0)} earned
          </div>
        </div>
        <div className="h-64">
          {isLoading ? (
            <div className="h-full grid place-items-center text-muted-foreground text-sm">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view?.chart ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v: any) => formatINR(Number(v))} />
                <Legend />
                <Bar dataKey="Collected" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Earned" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Collected is lumpy because most students pay for twelve weeks at once. Earned is the fair comparison between
          months.
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold">Renewals</h2>
            <Link to="renewals" className="text-sm text-primary">
              All renewals →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <Count n={expired.length} label="Expired" tone="text-red-600" />
            <Count n={due.length} label="Due in 14 days" tone="text-amber-600" />
            <Count n={neverPaid.length} label="Never paid" tone="text-red-600" />
          </div>
          {atStake > 0 ? (
            <p className="text-sm">
              <strong>{formatINR(atStake)}</strong> in fees from students who have run out or are about to.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Everyone in a class is paid up.</p>
          )}
          <ul className="mt-2 text-sm divide-y">
            {[...expired, ...due].slice(0, 5).map((r) => (
              <li key={r.student.id} className="py-1.5 flex justify-between gap-2">
                <span>{r.student.name}</span>
                <span className={r.status === "expired" ? "text-red-600" : "text-amber-600"}>
                  {r.daysLeft! < 0 ? `${-r.daysLeft!} days over` : r.daysLeft === 0 ? "today" : `in ${r.daysLeft} days`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold">Worth a look · last 3 months</h2>
            <Link to="batches" className="text-sm text-primary">
              All batches →
            </Link>
          </div>
          {!view || view.dead.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every class is covering its costs. Classes that lose money, or are half-empty and barely covering
              themselves, will show here.
            </p>
          ) : (
            <ul className="text-sm divide-y">
              {view.dead.slice(0, 6).map((r) => (
                <li key={r.batch.id} className="py-2 flex justify-between gap-2">
                  <span>
                    <span className="font-medium">{r.batch.label}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {r.enrolled}
                      {r.capacity ? `/${r.capacity}` : ""} students
                      {r.batch.teacherName ? ` · ${r.batch.teacherName}` : ""}
                    </span>
                  </span>
                  <span className={r.contribution < 0 ? "text-red-600 font-medium" : "text-amber-600"}>
                    {formatINR(r.contribution)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Count({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-md bg-muted/50 py-2">
      <div className={`text-xl font-semibold ${n ? tone : ""}`}>{n}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
