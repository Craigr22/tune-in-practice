import { useFinanceOverview } from "@/hooks/useFinance";
import { formatINR } from "@/lib/finance";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { data } = useFinanceOverview();
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Admin · Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Gross MTD" value={formatINR(data?.gross ?? 0)} />
        <KPI label="Outstanding dues" value={formatINR(data?.dues ?? 0)} />
      </div>
      <div className="flex gap-3">
        <Link className="underline text-sm" to="/admin/finance">Open Finance →</Link>
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4 bg-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
