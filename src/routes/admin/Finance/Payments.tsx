import { useMemo, useState } from "react";
import { usePayments } from "@/hooks/useFinance";
import { useStudents } from "@/hooks/useStudents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/db";
import { useQueryClient } from "@tanstack/react-query";
import { formatINR, iso } from "@/lib/finance";
import { toast } from "sonner";

export default function Payments() {
  const { data: payments = [], isLoading } = usePayments();
  const { data: students = [] } = useStudents();
  const qc = useQueryClient();
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
          <option value="failed">failed</option>
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
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Period</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No payments.</td></tr>}
            {rows.map((p: any) => (
              <tr key={p.id} className={`border-b ${p.displayStatus === "overdue" ? "bg-red-500/10" : ""}`}>
                <td className="p-3">{p.paid_on ?? "—"}</td>
                <td className="p-3">{p.students?.name ?? "—"}</td>
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

      <RecordPaymentDialog open={open} onClose={() => setOpen(false)} students={students} onSaved={() => qc.invalidateQueries({ queryKey: ["payments"] })} />
    </div>
  );
}

function RecordPaymentDialog({ open, onClose, students, onSaved }: { open: boolean; onClose: () => void; students: any[]; onSaved: () => void }) {
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(iso(new Date()));
  const [ps, setPs] = useState("");
  const [pe, setPe] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const onPickStudent = (id: string) => {
    setStudentId(id);
    const s = students.find((x) => x.id === id);
    if (s && !amount) setAmount(String(s.fee_amount ?? ""));
  };

  const save = async () => {
    if (!studentId || !amount) { toast.error("Student and amount required"); return; }
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      student_id: studentId,
      amount: Number(amount),
      paid_on: paidOn,
      period_start: ps || null,
      period_end: pe || null,
      method: method as any,
      status: "paid",
      notes: notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment recorded");
    onSaved();
    onClose();
    setStudentId(""); setAmount(""); setPs(""); setPe(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <select className="w-full border rounded-md p-2 bg-background" value={studentId} onChange={(e) => onPickStudent(e.target.value)}>
            <option value="">Select student…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs">Paid on</label><Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></div>
            <div><label className="text-xs">Period start</label><Input type="date" value={ps} onChange={(e) => setPs(e.target.value)} /></div>
            <div><label className="text-xs">Period end</label><Input type="date" value={pe} onChange={(e) => setPe(e.target.value)} /></div>
          </div>
          <select className="w-full border rounded-md p-2 bg-background" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">cash</option>
            <option value="upi">upi</option>
            <option value="bank">bank</option>
            <option value="card">card</option>
          </select>
          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
