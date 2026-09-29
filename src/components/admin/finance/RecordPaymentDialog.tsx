import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/db";
import { toast } from "sonner";
import { toLocalIso } from "@/lib/date";
import { useFinanceDataset } from "@/hooks/useFinanceDataset";
import { activeBatchesByStudent, addDays, hasPeriod, periodFrom, CYCLE_MONTHS } from "@/lib/financeModel";

export interface PaymentPrefill {
  studentId?: string;
  batchId?: string | null;
  amount?: number;
  periodStart?: string;
  periodEnd?: string;
}

/**
 * Recording a payment, with the parts that make it count filled in.
 *
 * The period a payment buys used to be two empty date boxes, so it was mostly
 * left blank — and with no period nothing could tell when a student's pack
 * ran out, or spread twelve weeks of fees across the twelve weeks. Picking a
 * student now fills in their fee, their class, and a period that starts where
 * their last one ended and runs one billing cycle. Everything stays editable.
 */
export default function RecordPaymentDialog({
  open,
  onClose,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: PaymentPrefill;
}) {
  const qc = useQueryClient();
  const { data } = useFinanceDataset();
  const students = useMemo(
    () => (data?.students ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );
  const batches = data?.batches ?? [];
  const byStudent = useMemo(() => activeBatchesByStudent(data?.enrollments ?? []), [data]);

  const today = toLocalIso();
  const [studentId, setStudentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [ps, setPs] = useState("");
  const [pe, setPe] = useState("");
  const [method, setMethod] = useState("upi");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  /** The next period for this student: from the end of their last one, else today. */
  const suggestPeriod = (id: string) => {
    const s = students.find((x) => x.id === id);
    if (!s) return null;
    const ends = (data?.payments ?? [])
      .filter((p) => p.studentId === id && p.status === "paid" && hasPeriod(p))
      .map((p) => p.periodEnd!)
      .sort();
    const last = ends[ends.length - 1];
    const start = last && last >= today ? addDays(last, 1) : today;
    return periodFrom(start, s.feeCycle);
  };

  const pickStudent = (id: string, keep: PaymentPrefill = {}) => {
    setStudentId(id);
    const s = students.find((x) => x.id === id);
    const classes = byStudent.get(id) ?? [];
    setBatchId(keep.batchId ?? (classes.length === 1 ? classes[0] : ""));
    setAmount(keep.amount != null ? String(keep.amount) : s ? String(s.feeAmount || "") : "");
    const period = keep.periodStart && keep.periodEnd ? { start: keep.periodStart, end: keep.periodEnd } : suggestPeriod(id);
    setPs(period?.start ?? "");
    setPe(period?.end ?? "");
  };

  // Opening from a renewal arrives with everything already decided.
  useEffect(() => {
    if (!open) return;
    setPaidOn(today);
    setNotes("");
    if (prefill?.studentId) pickStudent(prefill.studentId, prefill);
    else {
      setStudentId("");
      setBatchId("");
      setAmount("");
      setPs("");
      setPe("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.studentId, data]);

  // Moving the start moves the end with it, by the student's cycle.
  const onStart = (value: string) => {
    setPs(value);
    const s = students.find((x) => x.id === studentId);
    if (value && s) setPe(periodFrom(value, s.feeCycle).end);
  };

  const student = students.find((x) => x.id === studentId);
  const classes = byStudent.get(studentId) ?? [];

  const save = async () => {
    if (!studentId || !amount) return toast.error("A student and an amount are needed");
    if (ps && pe && pe < ps) return toast.error("The period ends before it starts");
    setSaving(true);
    const row: Record<string, unknown> = {
      student_id: studentId,
      batch_id: batchId || null,
      amount: Number(amount),
      paid_on: paidOn,
      period_start: ps || null,
      period_end: pe || null,
      method,
      status: "paid",
      notes: notes || null,
    };
    let { error } = await supabase.from("payments").insert(row as any);
    // The batch column arrives by migration. Until it has, record the payment
    // without it rather than refuse to take the money.
    if (error && /batch_id/i.test(error.message)) {
      delete row.batch_id;
      ({ error } = await supabase.from("payments").insert(row as any));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${student?.name ?? "Payment"} recorded`);
    for (const key of ["payments", "finance-dataset", "finance-overview", "pnl", "revenue-trend", "revenue-years"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <select
            className="w-full border rounded-md p-2 bg-background"
            value={studentId}
            onChange={(e) => pickStudent(e.target.value)}
          >
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>

          <div>
            <label className="text-xs text-muted-foreground">Class</label>
            <select
              className="w-full border rounded-md p-2 bg-background"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">Not tied to a class</option>
              {batches
                .filter((b) => b.isActive || b.id === batchId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                    {b.teacherName ? ` · ${b.teacherName}` : ""}
                    {classes.includes(b.id) ? " ✓" : ""}
                  </option>
                ))}
            </select>
            {studentId && classes.length > 1 && !batchId && (
              <p className="text-xs text-amber-600 mt-1">
                In {classes.length} classes — pick the one this pays for, or it can't be counted towards either.
              </p>
            )}
          </div>

          <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Paid on</label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Covers from</label>
              <Input type="date" value={ps} onChange={(e) => onStart(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Until</label>
              <Input type="date" value={pe} onChange={(e) => setPe(e.target.value)} />
            </div>
          </div>
          {student && (
            <p className="text-xs text-muted-foreground -mt-1">
              Billed {student.feeCycle} ({CYCLE_MONTHS[student.feeCycle]} mo) — the period runs one cycle from where the last one ended.
            </p>
          )}

          <select className="w-full border rounded-md p-2 bg-background" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="upi">upi</option>
            <option value="cash">cash</option>
            <option value="bank">bank</option>
            <option value="card">card</option>
          </select>
          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
