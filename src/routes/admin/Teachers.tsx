import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useTeachers,
  useSaveTeacher,
  useSetTeacherActive,
  useInstruments,
  type TeacherInput,
} from "@/hooks/useTeachers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/finance";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PaymentType = "per_hour" | "per_session" | "fixed_monthly";

const emptyForm: TeacherInput = {
  name: "",
  email: "",
  phone: "",
  rate: 0,
  payment_type: "per_session",
  payout_cycle: "monthly",
  instruments: [],
  is_active: true,
};

function useInstrumentsMap() {
  return useQuery({
    queryKey: ["instruments-map"],
    queryFn: async () => {
      const { data } = await supabase.from("instruments").select("id, name");
      return new Map((data ?? []).map((i: any) => [i.id, i.name]));
    },
  });
}

function useTeacherDetail(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["admin-teacher-detail", teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const [{ data: batches }, { data: payouts }] = await Promise.all([
        supabase.from("batches").select("*, locations(name), instruments(name)").eq("teacher_id", teacherId!),
        supabase.from("teacher_payouts").select("*").eq("teacher_id", teacherId!).order("month", { ascending: false }).limit(6),
      ]);
      const batchIds = (batches ?? []).map((b: any) => b.id);
      let studentCount = 0;
      if (batchIds.length) {
        const { count } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .in("batch_id", batchIds)
          .eq("status", "active");
        studentCount = count ?? 0;
      }
      return { batches: batches ?? [], payouts: payouts ?? [], studentCount };
    },
  });
}

function TeacherFormDialog({ open, teacher, onClose }: { open: boolean; teacher: any | null; onClose: () => void }) {
  const save = useSaveTeacher();
  const { data: instruments = [] } = useInstruments();
  const [form, setForm] = useState<TeacherInput>(emptyForm);
  const [syncKey, setSyncKey] = useState<string>("");

  const key = teacher?.id ?? "new";
  if (open && key !== syncKey) {
    setSyncKey(key);
    setForm(
      teacher
        ? {
            name: teacher.name ?? "",
            email: teacher.email ?? "",
            phone: teacher.phone ?? "",
            rate: Number(teacher.rate ?? 0),
            payment_type: (teacher.payment_type ?? "per_session") as PaymentType,
            payout_cycle: teacher.payout_cycle ?? "monthly",
            instruments: teacher.instruments ?? [],
            is_active: teacher.is_active ?? true,
          }
        : emptyForm
    );
  }

  const toggleInstrument = (id: string) =>
    setForm((f) => ({
      ...f,
      instruments: f.instruments.includes(id) ? f.instruments.filter((x) => x !== id) : [...f.instruments, id],
    }));

  const submit = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    save.mutate(
      {
        id: teacher?.id,
        ...form,
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        rate: Number(form.rate || 0),
      },
      {
        onSuccess: () => { toast.success(teacher ? "Teacher updated" : "Teacher added"); onClose(); },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{teacher ? "Edit teacher" : "Add teacher"}</DialogTitle></DialogHeader>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Rate (₹)</Label>
              <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Payment type</Label>
              <Select value={form.payment_type} onValueChange={(v) => setForm({ ...form, payment_type: v as PaymentType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_session">Per session</SelectItem>
                  <SelectItem value="per_hour">Per hour</SelectItem>
                  <SelectItem value="fixed_monthly">Fixed monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Payout cycle</Label>
            <Select value={form.payout_cycle} onValueChange={(v) => setForm({ ...form, payout_cycle: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {instruments.length > 0 && (
            <div className="space-y-1">
              <Label>Instruments</Label>
              <div className="flex flex-wrap gap-2">
                {instruments.map((i: any) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => toggleInstrument(i.id)}
                    className={`text-xs px-2 py-1 rounded-full border ${form.instruments.includes(i.id) ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    {i.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeacherDetail({ teacher, onClose, onEdit, instrumentsMap }: { teacher: any | null; onClose: () => void; onEdit: (t: any) => void; instrumentsMap: Map<string, string> }) {
  const { data } = useTeacherDetail(teacher?.id);
  const setActive = useSetTeacherActive();
  if (!teacher) return null;

  const instrumentNames = (teacher.instruments ?? [])
    .map((id: string) => instrumentsMap.get(id))
    .filter(Boolean)
    .join(", ");

  const toggleActive = () =>
    setActive.mutate(
      { id: teacher.id, is_active: !teacher.is_active },
      {
        onSuccess: () => toast.success(teacher.is_active ? "Teacher deactivated" : "Teacher reactivated"),
        onError: (e: any) => toast.error(e.message),
      }
    );

  return (
    <Sheet open={!!teacher} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <span>{teacher.name}</span>
            <Button size="sm" variant="outline" onClick={() => onEdit(teacher)}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-5 text-sm">
          <section className="space-y-1 text-muted-foreground">
            {teacher.email && <div>Email: {teacher.email}</div>}
            {teacher.phone && <div>Phone: <a className="text-primary underline" href={`tel:${teacher.phone}`}>{teacher.phone}</a></div>}
            <div>Instruments: {instrumentNames || "—"}</div>
            <div>Payment: {formatINR(Number(teacher.rate ?? 0))} ({teacher.payment_type?.replace("_", " ")})</div>
            <div>Payout cycle: {teacher.payout_cycle}</div>
            <div>
              Status:{" "}
              <span className={teacher.is_active ? "text-emerald-600" : "text-muted-foreground"}>
                {teacher.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <div className="rounded-md border p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Active batches</div>
              <div className="text-lg font-semibold">{data?.batches.filter((b: any) => b.is_active).length ?? 0}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Active students</div>
              <div className="text-lg font-semibold">{data?.studentCount ?? 0}</div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Batches</h3>
              <Button asChild size="sm" variant="ghost"><Link to="/admin/schedule">View schedule</Link></Button>
            </div>
            <div className="border rounded-md divide-y">
              {(data?.batches ?? []).map((b: any) => (
                <div key={b.id} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{b.locations?.name} · {b.instruments?.name}</div>
                    <div className="text-xs text-muted-foreground">{DOW[b.day_of_week ?? 0]} · {b.start_time?.slice(0, 5)} · {b.duration_min}m</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                    {b.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
              {(data?.batches.length ?? 0) === 0 && <div className="px-3 py-3 text-muted-foreground">No batches.</div>}
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Recent payouts</h3>
            <div className="border rounded-md divide-y">
              {(data?.payouts ?? []).map((p: any) => (
                <div key={p.id} className="px-3 py-2 flex items-center justify-between text-xs">
                  <span>{p.month}</span>
                  <span className="text-muted-foreground">{p.sessions} sessions · {p.hours}h</span>
                  <span className="tabular-nums font-medium">{formatINR(Number(p.final ?? 0))}</span>
                  <span className={p.paid_on ? "text-emerald-600" : "text-amber-600"}>{p.paid_on ? "Paid" : "Pending"}</span>
                </div>
              ))}
              {(data?.payouts.length ?? 0) === 0 && <div className="px-3 py-3 text-muted-foreground text-xs">No payouts yet.</div>}
            </div>
          </section>

          <section className="pt-2 border-t">
            <Button
              variant={teacher.is_active ? "outline" : "default"}
              size="sm"
              onClick={toggleActive}
              disabled={setActive.isPending}
            >
              {teacher.is_active ? "Deactivate teacher" : "Reactivate teacher"}
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type TStatus = "active" | "inactive" | "all";
type TSort = "name" | "rate_desc" | "rate_asc";

function exportTeachersCsv(rows: any[], instrumentsMap: Map<string, string>) {
  const headers = ["Name", "Email", "Phone", "Instruments", "Rate", "Payment type", "Payout cycle", "Status"];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((t) =>
      [
        t.name,
        t.email,
        t.phone,
        (t.instruments ?? []).map((id: string) => instrumentsMap.get(id)).filter(Boolean).join("; "),
        t.rate,
        t.payment_type,
        t.payout_cycle,
        t.is_active ? "Active" : "Inactive",
      ].map(esc).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `teachers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminTeachers() {
  const { data: teachers = [], isLoading } = useTeachers();
  const { data: instrumentsMap = new Map() } = useInstrumentsMap();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TStatus>("active");
  const [sort, setSort] = useState<TSort>("name");
  const [open, setOpen] = useState<any | null>(null);
  const [formTeacher, setFormTeacher] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const counts = useMemo(() => ({
    all: teachers.length,
    active: teachers.filter((t: any) => t.is_active).length,
    inactive: teachers.filter((t: any) => !t.is_active).length,
  }), [teachers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const out = teachers.filter((t: any) => {
      if (status === "active" && !t.is_active) return false;
      if (status === "inactive" && t.is_active) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.email ?? "").toLowerCase().includes(q) ||
        (t.phone ?? "").toLowerCase().includes(q)
      );
    });
    out.sort((a: any, b: any) => {
      switch (sort) {
        case "rate_desc": return Number(b.rate ?? 0) - Number(a.rate ?? 0);
        case "rate_asc": return Number(a.rate ?? 0) - Number(b.rate ?? 0);
        default: return a.name.localeCompare(b.name);
      }
    });
    return out;
  }, [teachers, search, status, sort]);

  const openAdd = () => { setFormTeacher(null); setFormOpen(true); };
  const openEdit = (t: any) => { setFormTeacher(t); setFormOpen(true); setOpen(null); };

  const tabs: { value: TStatus; label: string }[] = [
    { value: "active", label: `Active (${counts.active})` },
    { value: "inactive", label: `Inactive (${counts.inactive})` },
    { value: "all", label: `All (${counts.all})` },
  ];

  return (
    <section className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My Teachers</h1>
          <p className="text-sm text-muted-foreground">{counts.all} total · {counts.active} active</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportTeachersCsv(filtered, instrumentsMap)}>Export CSV</Button>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Add teacher</Button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex rounded-md border overflow-hidden">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={`px-3 py-1.5 text-sm ${status === t.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as TSort)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="rate_desc">Rate (high → low)</SelectItem>
            <SelectItem value="rate_asc">Rate (low → high)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="text-sm">Loading…</div>}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1fr_1.2fr_0.8fr_0.6fr] gap-4 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
          <div>Name</div>
          <div>Contact</div>
          <div>Instruments</div>
          <div>Rate</div>
          <div>Status</div>
        </div>
        {filtered.map((t: any) => {
          const names = (t.instruments ?? []).map((id: string) => instrumentsMap.get(id)).filter(Boolean).join(", ");
          return (
            <div
              key={t.id}
              onClick={() => setOpen(t)}
              className="grid grid-cols-[1.4fr_1fr_1.2fr_0.8fr_0.6fr] gap-4 items-center px-4 py-3 border-b cursor-pointer hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-sm font-semibold">
                  {t.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="font-medium truncate">{t.name}</div>
              </div>
              <div className="text-sm text-muted-foreground truncate">{t.phone || t.email || "—"}</div>
              <div className="text-sm text-muted-foreground truncate">{names || "—"}</div>
              <div className="text-sm tabular-nums">{formatINR(Number(t.rate ?? 0))}</div>
              <div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {t.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground">No teachers found.</div>
        )}
      </div>

      <TeacherDetail teacher={open} onClose={() => setOpen(null)} onEdit={openEdit} instrumentsMap={instrumentsMap} />
      <TeacherFormDialog open={formOpen} teacher={formTeacher} onClose={() => setFormOpen(false)} />
    </section>
  );
}
