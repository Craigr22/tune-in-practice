import { useMemo, useState } from "react";
import {
  useStudents,
  useSaveStudent,
  useSetStudentActive,
  useStudentEnrollments,
  useStudentPayments,
  useRecordPayment,
  type StudentInput,
} from "@/hooks/useStudents";
import { useStudentDetail } from "@/hooks/useTeacherStudents";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { SONGS } from "@/data/songs";
import { getBadge } from "@/lib/badges";
import { formatINR } from "@/lib/finance";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type FeeCycle = "monthly" | "quarterly" | "semester";

const emptyForm: StudentInput = {
  name: "",
  email: "",
  phone: "",
  parent_name: "",
  fee_amount: 0,
  fee_cycle: "monthly",
  is_active: true,
};

function StudentFormDialog({
  open,
  student,
  onClose,
}: {
  open: boolean;
  student: any | null; // null => add
  onClose: () => void;
}) {
  const save = useSaveStudent();
  const [form, setForm] = useState<StudentInput>(emptyForm);

  // Sync form when the target student changes (edit) or dialog opens (add).
  const [syncKey, setSyncKey] = useState<string>("");
  const key = student?.id ?? "new";
  if (open && key !== syncKey) {
    setSyncKey(key);
    setForm(
      student
        ? {
            name: student.name ?? "",
            email: student.email ?? "",
            phone: student.phone ?? "",
            parent_name: student.parent_name ?? "",
            fee_amount: Number(student.fee_amount ?? 0),
            fee_cycle: (student.fee_cycle ?? "monthly") as FeeCycle,
            is_active: student.is_active ?? true,
          }
        : emptyForm
    );
  }

  const submit = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    save.mutate(
      {
        id: student?.id,
        ...form,
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        parent_name: form.parent_name?.trim() || null,
        fee_amount: Number(form.fee_amount || 0),
      },
      {
        onSuccess: () => {
          toast.success(student ? "Student updated" : "Student added");
          onClose();
        },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{student ? "Edit student" : "Add student"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Parent name</Label>
            <Input value={form.parent_name ?? ""} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fee amount (₹)</Label>
              <Input type="number" value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Fee cycle</Label>
              <Select value={form.fee_cycle} onValueChange={(v) => setForm({ ...form, fee_cycle: v as FeeCycle })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semester">Semester</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({ studentId, open, onClose }: { studentId: string; open: boolean; onClose: () => void }) {
  const record = useRecordPayment();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const submit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    record.mutate(
      { student_id: studentId, amount: amt, paid_on: paidOn },
      {
        onSuccess: () => { toast.success("Payment recorded"); setAmount(""); onClose(); },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Paid on</Label>
            <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={record.isPending}>{record.isPending ? "Saving…" : "Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentDetail({ student, onClose, onEdit }: { student: any | null; onClose: () => void; onEdit: (s: any) => void }) {
  const { data } = useStudentDetail(student?.id);
  const { data: enrollments = [] } = useStudentEnrollments(student?.id);
  const { data: payments = [] } = useStudentPayments(student?.id);
  const setActive = useSetStudentActive();
  const [payOpen, setPayOpen] = useState(false);

  if (!student) return null;
  const progressBySong = new Map((data?.progress ?? []).map((p: any) => [p.song_id, p]));
  const totalAtt = data?.attendance.length ?? 0;
  const presents = (data?.attendance ?? []).filter((a: any) => a.status === "present" || a.status === "late").length;
  const attPct = totalAtt ? Math.round((presents / totalAtt) * 100) : 0;
  const totalMinutes = (data?.practice ?? []).reduce((s: number, p: any) => s + (p.duration_min ?? 0), 0);

  const toggleActive = () =>
    setActive.mutate(
      { id: student.id, is_active: !student.is_active },
      {
        onSuccess: () => toast.success(student.is_active ? "Student deactivated" : "Student reactivated"),
        onError: (e: any) => toast.error(e.message),
      }
    );

  return (
    <Sheet open={!!student} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <span>{student.name}</span>
            <Button size="sm" variant="outline" onClick={() => onEdit(student)}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-5 text-sm">
          <section className="space-y-1 text-muted-foreground">
            {student.email && <div>Email: {student.email}</div>}
            {student.phone && <div>Phone: <a className="text-primary underline" href={`tel:${student.phone}`}>{student.phone}</a></div>}
            {student.parent_name && <div>Parent: {student.parent_name}</div>}
            <div>Joined: {student.joined_on}</div>
            <div>Fee: {formatINR(Number(student.fee_amount ?? 0))} / {student.fee_cycle}</div>
            <div>
              Status:{" "}
              <span className={student.is_active ? "text-emerald-600" : "text-muted-foreground"}>
                {student.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-md border p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Attendance</div>
              <div className="text-lg font-semibold">{attPct}%</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Practice (60d)</div>
              <div className="text-lg font-semibold">{totalMinutes}m</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Sessions</div>
              <div className="text-lg font-semibold">{totalAtt}</div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Enrolled classes</h3>
            <div className="border rounded-md divide-y">
              {enrollments.length === 0 && <div className="px-3 py-2 text-muted-foreground">Not enrolled in any class.</div>}
              {enrollments.map((e: any) => {
                const b = e.batches;
                return (
                  <div key={e.id} className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{b?.instruments?.name ?? "Class"} · {b?.locations?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {DOW[b?.day_of_week ?? 0]} {b?.start_time?.slice(0, 5)} · {b?.teachers?.name ?? "TBA"}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{e.status}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Payments</h3>
              <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" />Record</Button>
            </div>
            <div className="border rounded-md divide-y">
              {payments.length === 0 && <div className="px-3 py-2 text-muted-foreground">No payments yet.</div>}
              {payments.map((p: any) => (
                <div key={p.id} className="px-3 py-2 flex items-center justify-between text-xs">
                  <span>{p.paid_on ?? "—"}</span>
                  <span className="tabular-nums font-medium">{formatINR(Number(p.amount ?? 0))}</span>
                  <span className="text-muted-foreground">{p.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Songs</h3>
            <div className="border rounded-md divide-y">
              {SONGS.slice(0, 8).map((s) => {
                const p: any = progressBySong.get(s.id);
                const tb = getBadge(p?.teacher_badge);
                const sb = getBadge(p?.self_badge);
                return (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2">
                    <div className="truncate">{s.title}</div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>T: {tb ? `${tb.emoji} ${tb.name}` : "—"}</span>
                      <span className="text-muted-foreground">S: {sb ? sb.emoji : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="pt-2 border-t">
            <Button
              variant={student.is_active ? "outline" : "default"}
              size="sm"
              onClick={toggleActive}
              disabled={setActive.isPending}
            >
              {student.is_active ? "Deactivate student" : "Reactivate student"}
            </Button>
          </section>
        </div>

        <RecordPaymentDialog studentId={student.id} open={payOpen} onClose={() => setPayOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

type StatusFilter = "active" | "inactive" | "all";
type SortKey = "name" | "fee_desc" | "fee_asc" | "recent";
const PAGE_SIZE = 50;

function exportStudentsCsv(rows: any[]) {
  const headers = ["Name", "Email", "Phone", "Parent", "Fee", "Fee cycle", "Status", "Joined"];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((s) =>
      [s.name, s.email, s.phone, s.parent_name, s.fee_amount, s.fee_cycle, s.is_active ? "Active" : "Inactive", s.joined_on]
        .map(esc)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminStudents() {
  const { data: students = [], isLoading } = useStudents();
  const setActive = useSetStudentActive();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<any | null>(null);
  const [formStudent, setFormStudent] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const counts = useMemo(() => ({
    all: students.length,
    active: students.filter((s: any) => s.is_active).length,
    inactive: students.filter((s: any) => !s.is_active).length,
  }), [students]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const out = students.filter((s: any) => {
      if (status === "active" && !s.is_active) return false;
      if (status === "inactive" && s.is_active) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.parent_name ?? "").toLowerCase().includes(q)
      );
    });
    out.sort((a: any, b: any) => {
      switch (sort) {
        case "fee_desc": return Number(b.fee_amount ?? 0) - Number(a.fee_amount ?? 0);
        case "fee_asc": return Number(a.fee_amount ?? 0) - Number(b.fee_amount ?? 0);
        case "recent": return String(b.joined_on ?? "").localeCompare(String(a.joined_on ?? ""));
        default: return a.name.localeCompare(b.name);
      }
    });
    return out;
  }, [students, search, status, sort]);

  // Reset paging when the result set changes; keep selection in sync with visible rows.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetPage = () => setPage(1);
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allVisibleSelected = visible.length > 0 && visible.every((s: any) => selected.has(s.id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) visible.forEach((s: any) => n.delete(s.id));
      else visible.forEach((s: any) => n.add(s.id));
      return n;
    });

  const bulkDeactivate = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => setActive.mutateAsync({ id, is_active: false })));
    toast.success(`Deactivated ${ids.length} student${ids.length > 1 ? "s" : ""}`);
    setSelected(new Set());
  };

  const openAdd = () => { setFormStudent(null); setFormOpen(true); };
  const openEdit = (s: any) => { setFormStudent(s); setFormOpen(true); setOpen(null); };

  const tabs: { value: StatusFilter; label: string }[] = [
    { value: "active", label: `Active (${counts.active})` },
    { value: "inactive", label: `Inactive (${counts.inactive})` },
    { value: "all", label: `All (${counts.all})` },
  ];

  return (
    <section className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My Students</h1>
          <p className="text-sm text-muted-foreground">{counts.all} total · {counts.active} active</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportStudentsCsv(filtered)}>Export CSV</Button>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Add student</Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name, email, phone, parent…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          className="max-w-xs"
        />
        <div className="flex rounded-md border overflow-hidden">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => { setStatus(t.value); resetPage(); }}
              className={`px-3 py-1.5 text-sm ${status === t.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Select value={sort} onValueChange={(v) => { setSort(v as SortKey); resetPage(); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="fee_desc">Fee (high → low)</SelectItem>
            <SelectItem value="fee_asc">Fee (low → high)</SelectItem>
            <SelectItem value="recent">Recently joined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={bulkDeactivate} disabled={setActive.isPending}>
            Deactivate selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {isLoading && <div className="text-sm">Loading…</div>}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[auto_1.4fr_1fr_1fr_0.8fr_0.6fr] gap-4 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30 items-center">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all" />
          <div>Name</div>
          <div>Contact</div>
          <div>Parent</div>
          <div>Fee</div>
          <div>Status</div>
        </div>
        {visible.map((s: any) => (
          <div
            key={s.id}
            className="grid grid-cols-[auto_1.4fr_1fr_1fr_0.8fr_0.6fr] gap-4 items-center px-4 py-3 border-b hover:bg-muted/40"
          >
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggleSelect(s.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${s.name}`}
            />
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(s)}>
              <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-sm font-semibold">
                {s.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="font-medium truncate">{s.name}</div>
            </div>
            <div className="text-sm text-muted-foreground truncate cursor-pointer" onClick={() => setOpen(s)}>{s.phone || s.email || "—"}</div>
            <div className="text-sm text-muted-foreground truncate cursor-pointer" onClick={() => setOpen(s)}>{s.parent_name || "—"}</div>
            <div className="text-sm tabular-nums cursor-pointer" onClick={() => setOpen(s)}>{formatINR(Number(s.fee_amount ?? 0))}</div>
            <div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                {s.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground">No students found.</div>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Prev</Button>
            <span className="text-muted-foreground">Page {safePage} / {pageCount}</span>
            <Button size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</Button>
          </div>
        </div>
      )}

      <StudentDetail student={open} onClose={() => setOpen(null)} onEdit={openEdit} />
      <StudentFormDialog open={formOpen} student={formStudent} onClose={() => setFormOpen(false)} />
    </section>
  );
}
