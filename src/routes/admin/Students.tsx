import { useMemo, useState } from "react";
import { useStudents } from "@/hooks/useStudents";
import { useStudentDetail } from "@/hooks/useTeacherStudents";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { toast } from "sonner";
import { SONGS } from "@/data/songs";
import { getBadge } from "@/lib/badges";
import { formatINR } from "@/lib/finance";

function AddStudentDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", parent_name: "", fee_amount: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    const { error } = await supabase.from("students").insert({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      parent_name: form.parent_name.trim() || null,
      fee_amount: Number(form.fee_amount || 0),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Student added");
    qc.invalidateQueries({ queryKey: ["students"] });
    setForm({ name: "", email: "", phone: "", parent_name: "", fee_amount: "" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add student</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add student</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {[
            ["name", "Name *"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["parent_name", "Parent name"],
            ["fee_amount", "Fee amount"],
          ].map(([k, l]) => (
            <div key={k} className="space-y-1">
              <Label>{l}</Label>
              <Input
                type={k === "fee_amount" ? "number" : "text"}
                value={(form as any)[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentDetail({ student, onClose }: { student: any | null; onClose: () => void }) {
  const { data } = useStudentDetail(student?.id);
  if (!student) return null;
  const progressBySong = new Map((data?.progress ?? []).map((p: any) => [p.song_id, p]));
  const totalAtt = data?.attendance.length ?? 0;
  const presents = (data?.attendance ?? []).filter((a: any) => a.status === "present" || a.status === "late").length;
  const attPct = totalAtt ? Math.round((presents / totalAtt) * 100) : 0;
  const totalMinutes = (data?.practice ?? []).reduce((s: number, p: any) => s + (p.duration_min ?? 0), 0);

  return (
    <Sheet open={!!student} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{student.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-5 text-sm">
          <section className="space-y-1 text-muted-foreground">
            {student.email && <div>Email: {student.email}</div>}
            {student.phone && <div>Phone: <a className="text-primary underline" href={`tel:${student.phone}`}>{student.phone}</a></div>}
            {student.parent_name && <div>Parent: {student.parent_name}</div>}
            <div>Joined: {student.joined_on}</div>
            <div>Fee: {formatINR(Number(student.fee_amount ?? 0))} / {student.fee_cycle}</div>
            <div>Status: {student.is_active ? "Active" : "Inactive"}</div>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminStudents() {
  const { data: students = [], isLoading } = useStudents();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<any | null>(null);

  const filtered = useMemo(
    () => students.filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );

  return (
    <section className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My Students</h1>
          <p className="text-sm text-muted-foreground">{students.length} total</p>
        </div>
        <AddStudentDialog />
      </header>

      <div className="mb-4">
        <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      {isLoading && <div className="text-sm">Loading…</div>}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.6fr] gap-4 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
          <div>Name</div>
          <div>Contact</div>
          <div>Parent</div>
          <div>Fee</div>
          <div>Status</div>
        </div>
        {filtered.map((s: any) => (
          <div
            key={s.id}
            onClick={() => setOpen(s)}
            className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.6fr] gap-4 items-center px-4 py-3 border-b cursor-pointer hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-sm font-semibold">
                {s.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="font-medium truncate">{s.name}</div>
            </div>
            <div className="text-sm text-muted-foreground truncate">{s.phone || s.email || "—"}</div>
            <div className="text-sm text-muted-foreground truncate">{s.parent_name || "—"}</div>
            <div className="text-sm tabular-nums">{formatINR(Number(s.fee_amount ?? 0))}</div>
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

      <StudentDetail student={open} onClose={() => setOpen(null)} />
    </section>
  );
}
