import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFinanceOverview, useRevenueTrend } from "@/hooks/useFinance";

import { useStudents } from "@/hooks/useStudents";
import { useBatches } from "@/hooks/useBatches";
import { useTeachers } from "@/hooks/useTeachers";
import { formatINR } from "@/lib/finance";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function KPI({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

type SortKey = "marginPct" | "margin" | "gross" | "fillPct";

export default function Overview() {
  const { data: overview, isLoading } = useFinanceOverview();
  const { data: trend } = useRevenueTrend(6);
  const { data: batches = [] } = useBatches();
  const { data: teachers = [] } = useTeachers();
  const [sortKey, setSortKey] = useState<SortKey>("margin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const batchById = useMemo(() => new Map(batches.map((b: any) => [b.id, b])), [batches]);
  const teacherById = useMemo(() => new Map(teachers.map((t: any) => [t.id, t])), [teachers]);

  const rows = useMemo(() => {
    const list = overview?.batchEconomics ?? [];
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? 0; const bv = b[sortKey] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [overview, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setSortDir("desc"); }
  };
  const sortIndicator = (k: SortKey) => (sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : "");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Finance · Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Gross revenue (MTD)" value={formatINR(overview?.gross ?? 0)} hint="Paid this month" />
        <KPI label="Outstanding dues" value={formatINR(overview?.dues ?? 0)} hint="Booked − collected" />
        <KPI label="Teacher payouts" value={formatINR(overview?.payouts ?? 0)} hint="Calculated for MTD" />
        <KPI label="Expenses (MTD)" value={formatINR(overview?.expenses ?? 0)} hint="Overheads this month" />
        <Link to="pnl" className="block rounded-lg border p-4 bg-card hover:bg-muted transition-colors">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Net</div>
          <div className="text-2xl font-semibold mt-1">{formatINR(overview?.net ?? 0)}</div>
          <div className="text-xs text-primary mt-1">View full P&amp;L →</div>
        </Link>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">Revenue trend · last 6 months</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend?.rows ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: any) => formatINR(Number(v))} />
              <Legend />
              {(trend?.locations ?? []).map((loc, i) => (
                <Bar key={loc} dataKey={loc} stackId="a" fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="p-4 border-b font-semibold">Unit economics</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="text-left p-3">Batch</th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort("fillPct")}>Fill %{sortIndicator("fillPct")}</th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort("gross")}>Monthly gross{sortIndicator("gross")}</th>
                <th className="text-right p-3">Teacher cost</th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort("margin")}>Margin{sortIndicator("margin")}</th>
                <th className="text-right p-3 cursor-pointer" onClick={() => toggleSort("marginPct")}>Margin %{sortIndicator("marginPct")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No active batches.</td></tr>}
              {rows.map((r) => {
                const b: any = batchById.get(r.batchId);
                const t: any = b ? teacherById.get(b.teacher_id) : null;
                const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                const color = r.marginPct > 50 ? "text-emerald-600" : r.marginPct >= 25 ? "text-amber-600" : "text-red-600";
                return (
                  <tr key={r.batchId} className="border-b">
                    <td className="p-3">
                      <div className="font-medium">{b?.locations?.name ?? b?.location_id?.slice(0, 6) ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {dayNames[b?.day_of_week ?? 0]} · {b?.start_time?.slice(0,5)} · {b?.instruments?.name ?? ""} · {t?.name ?? "—"}
                      </div>
                    </td>
                    <td className="p-3 text-right">{r.fillPct.toFixed(0)}% <span className="text-xs text-muted-foreground">({r.enrolled}/{r.capacity})</span></td>
                    <td className="p-3 text-right">{formatINR(r.gross)}</td>
                    <td className="p-3 text-right">{formatINR(r.teacherCost)}</td>
                    <td className={`p-3 text-right ${color} font-medium`}>{formatINR(r.margin)}</td>
                    <td className={`p-3 text-right ${color} font-medium`}>{r.marginPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AtRiskPanel />
    </div>
  );
}

function AtRiskPanel() {
  const { data: students = [] } = useStudents();
  // Simple proxy: count active students × monthly fee × 3 (semester proxy).
  const atRisk = useMemo(() => {
    const active = (students ?? []).filter((s: any) => s.is_active);
    return { count: active.length, value: active.reduce((s: number, x: any) => s + Number(x.fee_amount ?? 0) * 3, 0) };
  }, [students]);
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">At-risk revenue (active students × remaining semester fees)</div>
      <div className="text-2xl font-semibold mt-1">{formatINR(atRisk.value)}</div>
      <div className="text-xs text-muted-foreground">{atRisk.count} active students considered</div>
    </section>
  );
}
