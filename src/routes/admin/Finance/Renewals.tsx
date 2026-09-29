import { useMemo, useState } from "react";
import { useFinanceDataset } from "@/hooks/useFinanceDataset";
import { computeRenewals, DUE_WITHIN_DAYS, type RenewalRow, type RenewalStatus } from "@/lib/financeModel";
import { formatINR } from "@/lib/finance";
import { toLocalIso } from "@/lib/date";
import { Button } from "@/components/ui/button";
import RecordPaymentDialog, { type PaymentPrefill } from "@/components/admin/finance/RecordPaymentDialog";

const STATUS: Record<RenewalStatus, { label: string; cls: string }> = {
  expired: { label: "Expired", cls: "bg-red-500/15 text-red-700" },
  due: { label: "Due soon", cls: "bg-amber-500/15 text-amber-700" },
  "never-paid": { label: "Never paid", cls: "bg-red-500/10 text-red-700" },
  ok: { label: "Paid up", cls: "bg-emerald-500/15 text-emerald-700" },
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })
    : "—";

/**
 * Who has paid up to when, and who needs chasing.
 *
 * This is what each teacher's spreadsheet was really for — the fee total is a
 * by-product; the column that matters is the expiry date. It's worked out
 * from payments rather than kept by hand: a pack runs to the end of the
 * period its last payment bought, plus a week for every class the school
 * cancelled inside it.
 *
 * Renewing from here records the payment with the next period already filled
 * in, so the chain of periods never breaks.
 */
export default function Renewals() {
  const { data, isLoading, error } = useFinanceDataset();
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const [classFilter, setClassFilter] = useState("");
  const [prefill, setPrefill] = useState<PaymentPrefill | null>(null);

  const today = toLocalIso();
  const all = useMemo(() => (data ? computeRenewals({ ...data, today }) : []), [data, today]);
  const labelOf = useMemo(() => new Map((data?.batches ?? []).map((b) => [b.id, b])), [data]);

  const rows = all
    .filter((r) => filter === "all" || r.status !== "ok")
    .filter((r) => !classFilter || r.batchId === classFilter);

  const count = (s: RenewalStatus) => all.filter((r) => r.status === s).length;
  const atStake = all
    .filter((r) => r.status === "expired" || r.status === "due")
    .reduce((a, r) => a + (r.student.feeAmount || 0), 0);

  if (error) return <div className="p-6 text-red-600">Couldn't load renewals: {(error as Error).message}</div>;

  const renew = (r: RenewalRow) =>
    setPrefill({
      studentId: r.student.id,
      batchId: r.batchId,
      amount: r.student.feeAmount,
      // An expired pack renews from today, not from a date already gone.
      periodStart: r.status === "expired" ? today : r.nextPeriod.start,
      periodEnd: r.status === "expired" ? undefined : r.nextPeriod.end,
    });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Renewals</h1>
        <p className="text-sm text-muted-foreground">
          Who has paid up to when. Worked out from payments — nothing to keep by hand.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Expired" value={count("expired")} tone="text-red-600" hint="Pack has run out" />
        <Tile label={`Due in ${DUE_WITHIN_DAYS} days`} value={count("due")} tone="text-amber-600" hint="Chase this week" />
        <Tile label="Never paid" value={count("never-paid")} tone="text-red-600" hint="In a class, no payment" />
        <div className="rounded-lg border p-4 bg-card">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">At stake</div>
          <div className="text-2xl font-semibold mt-1">{formatINR(atStake)}</div>
          <div className="text-xs text-muted-foreground mt-1">One cycle's fee from each expired or due</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["attention", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-md border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
          >
            {f === "attention" ? "Needs attention" : "Everyone"}
          </button>
        ))}
        <select
          className="border rounded-md p-1.5 bg-background text-sm"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">All classes</option>
          {(data?.batches ?? [])
            .filter((b) => b.isActive)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
                {b.teacherName ? ` · ${b.teacherName}` : ""}
              </option>
            ))}
        </select>
      </div>

      <section className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="text-left p-3">Student</th>
              <th className="text-left p-3">Class</th>
              <th className="text-left p-3">Last paid</th>
              <th className="text-left p-3">Runs until</th>
              <th className="text-right p-3">Days</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  {filter === "attention" ? "Nobody needs chasing." : "No students in a class."}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const b = r.batchId ? labelOf.get(r.batchId) : null;
              const s = STATUS[r.status];
              return (
                <tr key={r.student.id} className={`border-b ${r.status === "expired" || r.status === "never-paid" ? "bg-red-500/5" : ""}`}>
                  <td className="p-3">
                    <div className="font-medium">{r.student.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatINR(r.student.feeAmount)} {r.student.feeCycle}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {b ? (
                      <>
                        {b.label}
                        {b.teacherName && <div className="text-xs">{b.teacherName}</div>}
                      </>
                    ) : (
                      <span className="text-xs">more than one</span>
                    )}
                  </td>
                  <td className="p-3">
                    {fmt(r.lastPaidOn)}
                    {r.lastAmount != null && <div className="text-xs text-muted-foreground">{formatINR(r.lastAmount)}</div>}
                  </td>
                  <td className="p-3">
                    {fmt(r.expiresOn)}
                    {r.cancelledCredits > 0 && (
                      <div className="text-xs text-muted-foreground" title="A week back for each class the school cancelled">
                        +{r.cancelledCredits} wk for cancelled class{r.cancelledCredits === 1 ? "" : "es"}
                      </div>
                    )}
                  </td>
                  <td
                    className={`p-3 text-right tabular-nums ${r.daysLeft != null && r.daysLeft < 0 ? "text-red-600 font-medium" : ""}`}
                  >
                    {r.daysLeft == null ? "—" : r.daysLeft < 0 ? `${-r.daysLeft} over` : r.daysLeft}
                  </td>
                  <td className="p-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant={r.status === "ok" ? "outline" : "default"} onClick={() => renew(r)}>
                      {r.status === "never-paid" ? "Record payment" : "Renew"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <RecordPaymentDialog open={!!prefill} prefill={prefill ?? undefined} onClose={() => setPrefill(null)} />
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: string }) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${value ? tone : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}
