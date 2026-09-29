import { useMemo, useState } from "react";
import { usePayments } from "@/hooks/useFinance";
import { useStudents } from "@/hooks/useStudents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, iso } from "@/lib/finance";
import RecordPaymentDialog from "@/components/admin/finance/RecordPaymentDialog";
import { useFinanceDataset } from "@/hooks/useFinanceDataset";

export default function Payments() {
  const { data: payments = [], isLoading } = usePayments();
  const { data: students = [] } = useStudents();
  // Class names for the payments already tied to one.
  const { data: dataset } = useFinanceDataset();
  const classLabel = useMemo(
    () => new Map((dataset?.batches ?? []).map((b) => [b.id, b.label])),
    [dataset],
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [open, setOpen] = useState(false);

  const lastPaidByStudent = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of payments as any[]) {
      if (p.status !== "paid" || !p.period_end) continue;
      const prev = m.get(p.student_id);
      if (!prev || p.period_end > prev) m.set(p.student_id, p.period_end);
    }
    return m;
  }, [payments]);

  const rows = useMemo(() => {
    const today = iso(new Date());
    return (payments as any[])
      .filter((p) => (!from || (p.paid_on ?? "") >= from) && (!to || (p.paid_on ?? "") <= to))
      .filter((p) => !studentFilter || p.student_id === studentFilter)
      .filter((p) => !statusFilter || p.status === statusFilter)
      .filter((p) => !methodFilter || p.method === methodFilter)
      .map((p) => {
        const last = lastPaidByStudent.get(p.student_id);
        const overdue = last ? (new Date(today).getTime() - new Date(last).getTime()) / 86400000 > 7 : false;
        const displayStatus = p.status === "paid" ? "paid" : overdue ? "overdue" : p.status;
        return { ...p, displayStatus };
      });
  }, [payments, from, to, studentFilter, statusFilter, methodFilter, lastPaidByStudent]);

  const exportCSV = () => {
    const headers = ["paid_on", "student", "amount", "period_start", "period_end", "method", "status"];
    const lines = [headers.join(",")].concat(
      rows.map((r) => [r.paid_on ?? "", (r.students?.name ?? "").replace(/,/g, " "), r.amount, r.period_start ?? "", r.period_end ?? "", r.method ?? "", r.displayStatus].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payments-${iso(new Date())}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
          <Button onClick={() => setOpen(true)}>Record payment</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        <select className="border rounded-md p-2 bg-background text-sm" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
          <option value="">All students</option>
          {students.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="border rounded-md p-2 bg-background text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="paid">paid</option>
          <option value="pending">pending</option>
          <option value="overdue">overdue</option>
        </select>
        <select className="border rounded-md p-2 bg-background text-sm" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="">All methods</option>
          <option value="cash">cash</option>
          <option value="upi">upi</option>
          <option value="bank">bank</option>
          <option value="card">card</option>
        </select>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Student</th>
              <th className="text-left p-3">Class</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Period</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No payments.</td></tr>}
            {rows.map((p: any) => (
              <tr key={p.id} className={`border-b ${p.displayStatus === "overdue" ? "bg-red-500/10" : ""}`}>
                <td className="p-3">{p.paid_on ?? "—"}</td>
                <td className="p-3">{p.students?.name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{p.batch_id ? classLabel.get(p.batch_id) ?? "—" : "—"}</td>
                <td className="p-3 text-right">{formatINR(Number(p.amount))}</td>
                <td className="p-3">{p.period_start ? `${p.period_start} → ${p.period_end ?? "?"}` : "—"}</td>
                <td className="p-3">{p.method ?? "—"}</td>
                <td className={`p-3 font-medium ${p.displayStatus === "overdue" ? "text-red-600" : p.displayStatus === "paid" ? "text-emerald-600" : ""}`}>
                  {p.displayStatus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RecordPaymentDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
