import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTeachers } from "@/hooks/useTeachers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/finance";

// Add-teacher flow lives in the Users tab.

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

function TeacherDetail({ teacher, onClose, instrumentsMap }: { teacher: any | null; onClose: () => void; instrumentsMap: Map<string, string> }) {
  const { data } = useTeacherDetail(teacher?.id);
  if (!teacher) return null;

  const instrumentNames = (teacher.instruments ?? [])
    .map((id: string) => instrumentsMap.get(id))
    .filter(Boolean)
    .join(", ");

  return (
    <Sheet open={!!teacher} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{teacher.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-5 text-sm">
          <section className="space-y-1 text-muted-foreground">
            {teacher.email && <div>Email: {teacher.email}</div>}
            {teacher.phone && <div>Phone: <a className="text-primary underline" href={`tel:${teacher.phone}`}>{teacher.phone}</a></div>}
            <div>Instruments: {instrumentNames || "—"}</div>
            <div>Payment: {formatINR(Number(teacher.rate ?? 0))} ({teacher.payment_type?.replace("_", " ")})</div>
            <div>Payout cycle: {teacher.payout_cycle}</div>
            <div>Status: {teacher.is_active ? "Active" : "Inactive"}</div>
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
            <h3 className="font-semibold mb-2">Batches</h3>
            <div className="border rounded-md divide-y">
              {(data?.batches ?? []).map((b: any) => (
                <div key={b.id} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{b.locations?.name} · {b.instruments?.name}</div>
                    <div className="text-xs text-muted-foreground">Day {b.day_of_week} · {b.start_time} · {b.duration_min}m</div>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminTeachers() {
  const { data: teachers = [], isLoading } = useTeachers();
  const { data: instrumentsMap = new Map() } = useInstrumentsMap();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<any | null>(null);

  const filtered = useMemo(
    () => teachers.filter((t: any) => t.name.toLowerCase().includes(search.toLowerCase())),
    [teachers, search]
  );

  return (
    <section className="p-6 max-w-6xl mx-auto">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My Teachers</h1>
          <p className="text-sm text-muted-foreground">{teachers.length} total</p>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/admin/users">Add via Users</Link></Button>
      </header>

      <div className="mb-4">
        <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
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

      <TeacherDetail teacher={open} onClose={() => setOpen(null)} instrumentsMap={instrumentsMap} />
    </section>
  );
}
