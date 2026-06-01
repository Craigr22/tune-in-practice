import { useState } from "react";
import { usePnL, useRevenueYears } from "@/hooks/useFinance";
import { useLocations } from "@/hooks/useLocations";
import { formatINR, fiscalYearBounds } from "@/lib/finance";
import { EXPENSE_CATEGORIES } from "./Expenses";

const catLabel = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;

// office scope: "all" => undefined, "shared" => null, otherwise location id
type Scope = string;

const currentFyStart = () => {
  const d = new Date();
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
};

export default function PnL() {
  const { data: locations = [] } = useLocations();
  const { data: years } = useRevenueYears();
  const [scope, setScope] = useState<Scope>("all");
  const [selectedFy, setSelectedFy] = useState<number | null>(null);
  const filter = scope === "all" ? undefined : scope === "shared" ? null : scope;
  const activeFy = selectedFy ?? years?.latest ?? currentFyStart();
  const fyDate = new Date(activeFy, 3, 1);
  const { data: pnl, isLoading } = usePnL(fyDate, filter);
  const fy = fiscalYearBounds(fyDate);
  const fyList = years?.years?.length ? years.years : [currentFyStart()];

  const tabs: { value: Scope; label: string }[] = [
    { value: "all", label: "Whole business" },
    ...locations.map((l: any) => ({ value: l.id as string, label: l.name as string })),
    { value: "shared", label: "Shared only" },
  ];

  const cats = pnl?.categories ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Profit &amp; Loss</h1>
          <p className="text-xs text-muted-foreground">{fy.label} · April–March · cash basis</p>
          <div className="flex gap-1 flex-wrap mt-2">
            {fyList.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedFy(y)}
                className={`px-2.5 py-1 text-xs rounded-md ${activeFy === y ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
              >
                FY {y}-{String(y + 1).slice(2)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setScope(t.value)}
              className={`px-3 py-1.5 text-sm rounded-md ${scope === t.value ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {scope !== "all" && (
        <p className="text-xs text-muted-foreground">
          Revenue and teacher payouts are business-wide; only expenses are scoped to this office.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Revenue (FY)" value={formatINR(pnl?.totals.revenue ?? 0)} />
        <KPI label="Net profit (FY)" value={formatINR(pnl?.totals.netProfit ?? 0)} hint={`${(pnl?.totals.marginPct ?? 0).toFixed(1)}% margin`} />
        <KPI label="Expense / student" value={formatINR(pnl?.expensePerStudent ?? 0)} hint={`${pnl?.activeStudents ?? 0} active students`} />
        <KPI label="Total expenses (FY)" value={formatINR((pnl?.totals.expenses ?? 0) + (pnl?.totals.teacherPayouts ?? 0))} hint="Payouts + overheads" />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="text-left p-3 sticky left-0 bg-card">Line</th>
              {(pnl?.periods ?? []).map((p) => <th key={p.monthISO} className="text-right p-3">{p.label}</th>)}
              <th className="text-right p-3 font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={14} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && pnl && (
              <>
                <Row label="Class fee revenue" periods={pnl.periods} pick={(p) => p.revenue} total={pnl.totals.revenue} />
                <Row label="Teacher payouts" periods={pnl.periods} pick={(p) => -p.teacherPayouts} total={-pnl.totals.teacherPayouts} muted />
                <Row label="Gross profit" periods={pnl.periods} pick={(p) => p.grossProfit} total={pnl.totals.grossProfit} bold />
                {cats.map((c) => (
                  <Row
                    key={c}
                    label={catLabel(c)}
                    periods={pnl.periods}
                    pick={(p) => -(p.expensesByCategory[c] ?? 0)}
                    total={-(pnl.totals.expensesByCategory[c] ?? 0)}
                    muted
                    indent
                  />
                ))}
                <Row label="Total expenses" periods={pnl.periods} pick={(p) => -p.expenses} total={-pnl.totals.expenses} muted />
                <Row label="Net profit" periods={pnl.periods} pick={(p) => p.netProfit} total={pnl.totals.netProfit} bold highlight />
                <tr className="border-t">
                  <td className="p-3 text-xs text-muted-foreground sticky left-0 bg-card">Margin %</td>
                  {pnl.periods.map((p) => (
                    <td key={p.monthISO} className="p-3 text-right text-xs text-muted-foreground">{p.revenue > 0 ? `${p.marginPct.toFixed(0)}%` : "—"}</td>
                  ))}
                  <td className="p-3 text-right text-xs font-semibold">{pnl.totals.marginPct.toFixed(1)}%</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  label,
  periods,
  pick,
  total,
  bold,
  muted,
  highlight,
  indent,
}: {
  label: string;
  periods: any[];
  pick: (p: any) => number;
  total: number;
  bold?: boolean;
  muted?: boolean;
  highlight?: boolean;
  indent?: boolean;
}) {
  const cell = (v: number) => {
    if (v === 0) return <span className="text-muted-foreground">—</span>;
    return <span className={v < 0 ? "text-red-600" : ""}>{formatINR(v)}</span>;
  };
  return (
    <tr className={`border-b ${highlight ? "bg-muted/40" : ""}`}>
      <td className={`p-3 sticky left-0 bg-card ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""} ${indent ? "pl-6" : ""}`}>{label}</td>
      {periods.map((p) => (
        <td key={p.monthISO} className={`p-3 text-right ${bold ? "font-semibold" : ""}`}>{cell(pick(p))}</td>
      ))}
      <td className={`p-3 text-right ${bold ? "font-bold" : "font-medium"}`}>{cell(total)}</td>
    </tr>
  );
}

function KPI({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
