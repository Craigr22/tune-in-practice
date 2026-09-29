import { useMemo, useState } from "react";
import { useFinanceDataset } from "@/hooks/useFinanceDataset";
import {
  addMonths,
  computeBatchEconomics,
  isDeadWeight,
  LOW_FILL,
  THIN_MARGIN_PCT,
  type BatchEconomics,
  type Verdict,
} from "@/lib/financeModel";
import { formatINR } from "@/lib/finance";
import { toLocalIso } from "@/lib/date";

type Range = "month" | "quarter" | "fy";

const RANGES: { key: Range; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "Last 3 months" },
  { key: "fy", label: "Financial year" },
];

/** [from, to) for a range, in whole months, ending with the current one. */
function bounds(range: Range): { from: string; to: string } {
  const today = toLocalIso();
  const thisMonth = `${today.slice(0, 7)}-01`;
  const to = addMonths(thisMonth, 1);
  if (range === "month") return { from: thisMonth, to };
  if (range === "quarter") return { from: addMonths(thisMonth, -2), to };
  const y = Number(today.slice(5, 7)) >= 4 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
  return { from: `${y}-04-01`, to };
}

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  healthy: { label: "Healthy", cls: "bg-emerald-500/15 text-emerald-700" },
  thin: { label: "Thin", cls: "bg-amber-500/15 text-amber-700" },
  loss: { label: "Losing money", cls: "bg-red-500/15 text-red-700" },
  "no-data": { label: "No data", cls: "bg-muted text-muted-foreground" },
};

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone ?? ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

/**
 * Which classes pay for themselves, and which don't.
 *
 * Each class is judged on what it earned and what it cost over the range:
 * revenue earned (fees spread over the weeks they pay for), its teacher, and
 * its share of its office. Company overhead is kept out of it — spreading
 * that across every class makes them all look worse by the same amount and
 * changes nothing about which to keep.
 *
 * The ones worth a hard look sort to the top.
 */
export default function Batches() {
  const { data, isLoading, error } = useFinanceDataset();
  const [range, setRange] = useState<Range>("quarter");
  const [showInactive, setShowInactive] = useState(false);
  const { from, to } = bounds(range);

  const result = useMemo(() => {
    if (!data) return null;
    return computeBatchEconomics({ ...data, from, to });
  }, [data, from, to]);

  const rows = useMemo(() => {
    const list = (result?.rows ?? []).filter((r) => showInactive || r.batch.isActive);
    // Dead weight first, worst first; then the rest by contribution.
    return list.sort(
      (a, b) =>
        Number(isDeadWeight(b)) - Number(isDeadWeight(a)) || a.contribution - b.contribution,
    );
  }, [result, showInactive]);

  const totals = useMemo(() => {
    const active = (result?.rows ?? []).filter((r) => r.batch.isActive);
    const sum = (f: (r: BatchEconomics) => number) => active.reduce((a, r) => a + f(r), 0);
    const revenue = sum((r) => r.revenue);
    const contribution = sum((r) => r.contribution);
    return {
      revenue,
      teacher: sum((r) => r.teacherCost),
      room: sum((r) => r.roomCost),
      contribution,
      dead: active.filter(isDeadWeight).length,
      net: contribution - (result?.sharedOverhead ?? 0) + (result?.unattributedRevenue ?? 0),
    };
  }, [result]);

  if (error) return <div className="p-6 text-red-600">Couldn't load finance data: {(error as Error).message}</div>;

  const noSessions = rows.filter((r) => r.batch.isActive && r.flags.noSessionsLogged).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Batches</h1>
          <p className="text-sm text-muted-foreground">What each class earns against what it costs.</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-sm rounded-md border ${range === r.key ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Revenue earned" value={formatINR(totals.revenue)} hint="Fees spread over the weeks they pay for" />
        <Stat label="Teachers" value={formatINR(totals.teacher)} hint="By each teacher's pay type" />
        <Stat label="Offices" value={formatINR(totals.room)} hint="Rent & running costs, by class time" />
        <Stat
          label="Contribution"
          value={formatINR(totals.contribution)}
          tone={totals.contribution < 0 ? "text-red-600" : "text-emerald-700"}
          hint="What the classes leave over"
        />
        <Stat
          label="Worth a look"
          value={String(totals.dead)}
          tone={totals.dead ? "text-red-600" : ""}
          hint={totals.dead ? "Losing money, or half-empty and thin" : "No dead weight"}
        />
      </div>

      {/* The things that make the numbers above less than the whole truth. */}
      {result && (
        <div className="space-y-2 text-sm">
          {result.unattributedRevenue > 0 && (
            <Notice>
              {formatINR(result.unattributedRevenue)} earned isn't tied to a class — payments from students in more than
              one class, recorded before payments named their class. It's in the company total, not in any row below.
            </Notice>
          )}
          {result.unspreadPayments > 0 && (
            <Notice>
              {result.unspreadPayments} payment{result.unspreadPayments === 1 ? " has" : "s have"} no period, so{" "}
              {result.unspreadPayments === 1 ? "it's" : "they're"} counted on the day paid rather than spread. New
              payments fill the period in automatically.
            </Notice>
          )}
          {noSessions > 0 && (
            <Notice>
              {noSessions} active class{noSessions === 1 ? " has" : "es have"} students but no completed class logged in
              this range, so the teacher cost reads as nothing and flatters{" "}
              {noSessions === 1 ? "it" : "them"}. Classes count once they're marked complete.
            </Notice>
          )}
          {result.sharedOverhead > 0 && (
            <p className="text-muted-foreground">
              Company overhead not tied to an office — {formatINR(result.sharedOverhead)} — is left out of each class.
              After it, the school's net is{" "}
              <strong className={totals.net < 0 ? "text-red-600" : "text-foreground"}>{formatINR(totals.net)}</strong>.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Losing money = costs more than it earns. Thin = under {THIN_MARGIN_PCT}% margin. Low fill = under{" "}
          {LOW_FILL * 100}% of seats taken.
        </div>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      <section className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="text-left p-3">Class</th>
              <th className="text-left p-3">Students</th>
              <th className="text-right p-3">Earned</th>
              <th className="text-right p-3">Teacher</th>
              <th className="text-right p-3">Office</th>
              <th className="text-right p-3">Contribution</th>
              <th className="text-right p-3" title="Earned per hour of class taught">₹ / hour</th>
              <th className="text-right p-3" title="Students needed to cover this class's own costs">Break-even</th>
              <th className="text-left p-3">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-muted-foreground">
                  No classes.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <BatchRowView key={r.batch.id} r={r} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800">{children}</div>;
}

function BatchRowView({ r }: { r: BatchEconomics }) {
  const v = VERDICT[r.verdict];
  const dead = isDeadWeight(r);
  const fillPct = r.fill != null ? Math.round(r.fill * 100) : null;

  return (
    <tr className={`border-b align-top ${dead ? "bg-red-500/5" : ""} ${r.batch.isActive ? "" : "opacity-60"}`}>
      <td className="p-3">
        <div className="font-medium">
          {r.batch.label}
          {!r.batch.isActive && <span className="ml-2 text-xs text-muted-foreground">inactive</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {[r.batch.label !== r.batch.when ? r.batch.when : null, r.batch.teacherName, r.batch.locationName]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </td>
      <td className="p-3 min-w-[9rem]">
        <div className="tabular-nums">
          {r.enrolled}
          {r.capacity > 0 && <span className="text-muted-foreground"> / {r.capacity}</span>}
        </div>
        {fillPct != null && (
          <div className="mt-1 h-1.5 w-28 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full ${r.flags.lowFill ? "bg-red-500" : fillPct >= 80 ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${Math.min(100, fillPct)}%` }}
            />
          </div>
        )}
      </td>
      <td className="p-3 text-right tabular-nums">{formatINR(r.revenue)}</td>
      <td className="p-3 text-right tabular-nums text-muted-foreground">
        {formatINR(r.teacherCost)}
        {r.flags.noSessionsLogged && (
          <div className="text-[11px] text-amber-600" title="No completed class logged in this range">
            none logged
          </div>
        )}
      </td>
      <td className="p-3 text-right tabular-nums text-muted-foreground">{formatINR(r.roomCost)}</td>
      <td className={`p-3 text-right tabular-nums font-medium ${r.contribution < 0 ? "text-red-600" : "text-emerald-700"}`}>
        {formatINR(r.contribution)}
        {r.marginPct != null && <div className="text-[11px] font-normal">{r.marginPct.toFixed(0)}%</div>}
      </td>
      <td className="p-3 text-right tabular-nums">{r.revenuePerHour != null ? formatINR(r.revenuePerHour) : "—"}</td>
      <td className="p-3 text-right tabular-nums">
        {r.breakEven != null ? (
          <span className={r.flags.belowBreakEven ? "text-red-600 font-medium" : ""}>
            {r.breakEven}
            {r.flags.belowBreakEven && (
              <div className="text-[11px] font-normal">needs {r.breakEven - r.enrolled} more</div>
            )}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="p-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>
        <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          {r.flags.lowFill && <span>Low fill</span>}
          {dead && <span className="text-red-600 font-medium">Dead weight</span>}
        </div>
      </td>
    </tr>
  );
}
