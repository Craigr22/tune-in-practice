import { useMemo, useState } from "react";
import { useTeacherPayoutsForMonth } from "@/hooks/useFinance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/db";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatINR, iso, monthBounds } from "@/lib/finance";
import { toast } from "sonner";

export default function Payouts() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const date = useMemo(() => new Date(`${month}-01T00:00:00`), [month]);
  const { data: rows = [], isLoading } = useTeacherPayoutsForMonth(date);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payouts</h1>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && rows.length === 0 && (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No teachers.</div>
      )}

      <div className="grid gap-3">
        {rows.map((r: any) => (
          <PayoutCard key={r.teacher.id} row={r} month={date} />
        ))}
      </div>
    </div>
  );
}

function PayoutCard({ row, month }: { row: any; month: Date }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adjustment, setAdjustment] = useState<string>(row.recorded?.adjustment?.toString() ?? "0");
  const [saving, setSaving] = useState(false);
  const adjNum = Number(adjustment || 0);
  const final = (row.calculated ?? 0) + adjNum;
  const { startISO } = monthBounds(month);

  const markPaid = async () => {
    setSaving(true);
    const payload = {
      teacher_id: row.teacher.id,
      month: startISO,
      sessions: row.sessions,
      hours: row.hours,
      calculated: row.calculated,
      adjustment: adjNum,
      final,
      paid_on: iso(new Date()),
      marked_paid_by: user?.id ?? null,
    };
    // Upsert by (teacher_id, month)
    if (row.recorded) {
      const { error } = await supabase.from("teacher_payouts").update(payload).eq("id", row.recorded.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("teacher_payouts").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success("Payout recorded");
    qc.invalidateQueries({ queryKey: ["teacher-payouts"] });
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-semibold">{row.teacher.name}</div>
          <div className="text-xs text-muted-foreground">{row.teacher.payment_type} · {formatINR(Number(row.teacher.rate ?? 0))}</div>
        </div>
        {row.recorded?.paid_on && (
          <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-700">Paid {row.recorded.paid_on}</span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 text-sm">
        <div><div className="text-xs text-muted-foreground">Sessions</div><div>{row.sessions}</div></div>
        <div><div className="text-xs text-muted-foreground">Hours</div><div>{row.hours.toFixed(1)}</div></div>
        <div><div className="text-xs text-muted-foreground">Calculated</div><div>{formatINR(row.calculated)}</div></div>
        <div>
          <div className="text-xs text-muted-foreground">Adjustment</div>
          <Input type="number" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} className="h-8" />
        </div>
        <div><div className="text-xs text-muted-foreground">Final</div><div className="font-semibold">{formatINR(final)}</div></div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={markPaid} disabled={saving}>{row.recorded ? "Update" : "Mark paid"}</Button>
      </div>
    </div>
  );
}
