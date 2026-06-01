import { useMemo, useState } from "react";
import { useExpenses, useSaveExpense, useDeleteExpense, ExpenseRow } from "@/hooks/useExpenses";
import { useLocations } from "@/hooks/useLocations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatINR, iso, monthBounds } from "@/lib/finance";
import { toast } from "sonner";

export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "salary", label: "Salary" },
  { value: "utilities", label: "Utilities" },
  { value: "gst", label: "GST" },
  { value: "marketing", label: "Marketing / Ads" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "equipment", label: "Equipment" },
  { value: "instrument_purchase", label: "Instrument purchase" },
  { value: "misc", label: "Misc" },
];

const catLabel = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export default function Expenses() {
  const { data: expenses = [], isLoading } = useExpenses();
  const { data: locations = [] } = useLocations();
  const saveExpense = useSaveExpense();
  const deleteExpense = useDeleteExpense();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const rows = useMemo(() => {
    return (expenses as ExpenseRow[])
      .filter((e) => (!from || e.incurred_on >= from) && (!to || e.incurred_on <= to))
      .filter((e) => !categoryFilter || e.category === categoryFilter)
      .filter((e) => {
        if (!officeFilter) return true;
        if (officeFilter === "shared") return !e.location_id;
        return e.location_id === officeFilter;
      });
  }, [expenses, from, to, categoryFilter, officeFilter]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount ?? 0), 0), [rows]);

  const openAdd = () => { setEditing(null); setOpen(true); };
  const openEdit = (e: ExpenseRow) => { setEditing(e); setOpen(true); };

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await deleteExpense.mutateAsync(id);
      toast.success("Expense deleted");
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    }
  };

  const copyLastMonth = async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const { start, end } = monthBounds(lastMonth);
    const startISO = iso(start);
    const endISO = iso(end);
    const recurring = (expenses as ExpenseRow[]).filter(
      (e) => ["rent", "salary", "utilities", "subscriptions"].includes(e.category) && e.incurred_on >= startISO && e.incurred_on < endISO
    );
    if (!recurring.length) { toast.error("No recurring expenses found last month"); return; }
    const thisMonth = monthBounds(new Date());
    const offset = thisMonth.startISO;
    try {
      for (const e of recurring) {
        const day = e.incurred_on.slice(8, 10);
        await saveExpense.mutateAsync({
          category: e.category,
          amount: Number(e.amount),
          incurred_on: `${offset.slice(0, 8)}${day}`,
          location_id: e.location_id,
          notes: e.notes,
        });
      }
      toast.success(`Copied ${recurring.length} recurring expense(s) into this month`);
    } catch (err: any) {
      toast.error(err.message ?? "Copy failed");
    }
  };

  const exportCSV = () => {
    const headers = ["incurred_on", "category", "office", "amount", "notes"];
    const lines = [headers.join(",")].concat(
      rows.map((r) => [
        r.incurred_on,
        catLabel(r.category),
        (r.locations?.name ?? "Shared").replace(/,/g, " "),
        r.amount,
        (r.notes ?? "").replace(/,/g, " "),
      ].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expenses-${iso(new Date())}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyLastMonth}>Copy last month</Button>
          <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
          <Button onClick={openAdd}>Add expense</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        <select className="border rounded-md p-2 bg-background text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className="border rounded-md p-2 bg-background text-sm" value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)}>
          <option value="">All offices</option>
          <option value="shared">Shared (business-wide)</option>
          {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Category</th>
              <th className="text-left p-3">Office</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Notes</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No expenses.</td></tr>}
            {rows.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="p-3">{e.incurred_on}</td>
                <td className="p-3">{catLabel(e.category)}</td>
                <td className="p-3">{e.locations?.name ?? <span className="text-muted-foreground">Shared</span>}</td>
                <td className="p-3 text-right">{formatINR(Number(e.amount))}</td>
                <td className="p-3 text-muted-foreground">{e.notes ?? "—"}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button className="text-xs text-primary hover:underline mr-3" onClick={() => openEdit(e)}>Edit</button>
                  <button className="text-xs text-red-600 hover:underline" onClick={() => onDelete(e.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="p-3" colSpan={3}>Total ({rows.length})</td>
                <td className="p-3 text-right">{formatINR(total)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ExpenseDialog
        open={open}
        onClose={() => setOpen(false)}
        locations={locations}
        editing={editing}
        save={saveExpense.mutateAsync}
      />
    </div>
  );
}

function ExpenseDialog({
  open,
  onClose,
  locations,
  editing,
  save,
}: {
  open: boolean;
  onClose: () => void;
  locations: any[];
  editing: ExpenseRow | null;
  save: (v: any) => Promise<unknown>;
}) {
  const [category, setCategory] = useState(editing?.category ?? "rent");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [incurredOn, setIncurredOn] = useState(editing?.incurred_on ?? iso(new Date()));
  const [locationId, setLocationId] = useState(editing?.location_id ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Re-seed fields whenever the dialog opens for a different row.
  const seedKey = `${open}-${editing?.id ?? "new"}`;
  const [lastSeed, setLastSeed] = useState(seedKey);
  if (seedKey !== lastSeed) {
    setLastSeed(seedKey);
    setCategory(editing?.category ?? "rent");
    setAmount(editing ? String(editing.amount) : "");
    setIncurredOn(editing?.incurred_on ?? iso(new Date()));
    setLocationId(editing?.location_id ?? "");
    setNotes(editing?.notes ?? "");
  }

  const onSave = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Amount required"); return; }
    setSaving(true);
    try {
      await save({
        id: editing?.id,
        category,
        amount: Number(amount),
        incurred_on: incurredOn,
        location_id: locationId || null,
        notes: notes || null,
      });
      toast.success(editing ? "Expense updated" : "Expense added");
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs">Category</label>
            <select className="w-full border rounded-md p-2 bg-background" value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs">Amount (₹)</label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><label className="text-xs">Date</label><Input type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} /></div>
          </div>
          <div>
            <label className="text-xs">Office</label>
            <select className="w-full border rounded-md p-2 bg-background" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Shared (business-wide)</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
