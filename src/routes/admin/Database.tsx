import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { COURSES, ENQUIRY_STATUSES, KIND_LABEL, isDue, statusLabel, type Person } from "@/lib/people";
import { toLocalIso } from "@/lib/date";
import { usePeopleDatabase } from "@/hooks/usePeopleDatabase";
import PersonPanel from "@/components/admin/database/PersonPanel";
import ImportDialog from "@/components/admin/database/ImportDialog";
import AddEnquiryDialog from "@/components/admin/database/AddEnquiryDialog";

type View = "all" | "students" | "enquiries" | "due" | "former";
const SHOW = 100;

const pill: Record<string, string> = {
  student: "bg-emerald-500/15 text-emerald-700",
  unplaced: "bg-amber-500/15 text-amber-700",
  former: "bg-muted text-muted-foreground",
  new: "bg-blue-500/15 text-blue-700",
  contacted: "bg-violet-500/15 text-violet-700",
  trial: "bg-amber-500/15 text-amber-700",
  not_interested: "bg-muted text-muted-foreground",
};

/**
 * Everyone BAM knows: every student, past and present, and every person who
 * has asked about lessons — one list, searchable, with each enquiry's
 * follow-up kept where it can be seen. Admins only.
 */
export default function Database() {
  const { people, loading, ready, students, enquiries } = usePeopleDatabase();
  const [view, setView] = useState<View>("all");
  const [status, setStatus] = useState<string>("");
  const [course, setCourse] = useState<string>("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(SHOW);
  const [open, setOpen] = useState<Person | null>(null);
  const today = toLocalIso();

  const counts = useMemo(() => ({
    all: people.length,
    students: people.filter((p) => p.kind === "student" || p.kind === "unplaced").length,
    enquiries: people.filter((p) => p.kind === "enquiry").length,
    due: people.filter((p) => isDue(p, today)).length,
    former: people.filter((p) => p.kind === "former").length,
  }), [people, today]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return people.filter((p) => {
      if (view === "students" && p.kind !== "student" && p.kind !== "unplaced") return false;
      if (view === "enquiries" && p.kind !== "enquiry") return false;
      if (view === "former" && p.kind !== "former") return false;
      if (view === "due" && !isDue(p, today)) return false;
      if (status && p.status !== status) return false;
      if (course && !(p.what + " " + (p.enquiry?.course ?? "")).toLowerCase().includes(course.toLowerCase())) return false;
      if (term && !p.name.toLowerCase().includes(term) && !(digits.length >= 3 && (p.phone ?? "").replace(/\D/g, "").includes(digits))) return false;
      return true;
    });
  }, [people, view, status, course, q, today]);

  // Keep the panel showing the latest version of the person after a change.
  const current = open ? people.find((p) => p.key === open.key || (open.enquiry && p.enquiry?.id === open.enquiry.id)) ?? open : null;

  const tab = (v: View, label: string, n: number) => (
    <button
      key={v}
      onClick={() => { setView(v); setLimit(SHOW); }}
      className={`px-3 py-1.5 text-sm rounded-md ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      {label} <span className="opacity-70 tabular-nums">{n.toLocaleString()}</span>
    </button>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Database</h1>
          <p className="text-sm text-muted-foreground">Every student, and everyone who has asked about lessons.</p>
        </div>
        {ready && (
          <div className="flex gap-2">
            <ImportDialog enquiries={enquiries} students={students} />
            <AddEnquiryDialog />
          </div>
        )}
      </div>

      {!ready && !loading && (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Showing students only — the enquiries part of the database hasn't been switched on yet (its database update
          hasn't been applied).
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b pb-3">
        {tab("all", "Everyone", counts.all)}
        {tab("students", "Students", counts.students)}
        {tab("enquiries", "Enquiries", counts.enquiries)}
        {tab("due", "Follow up due", counts.due)}
        {tab("former", "Former students", counts.former)}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search name or phone" value={q} onChange={(e) => { setQ(e.target.value); setLimit(SHOW); }} className="max-w-xs" />
        <select value={course} onChange={(e) => setCourse(e.target.value)} className="border rounded-md h-10 px-2 bg-background text-sm">
          <option value="">All courses</option>
          {COURSES.map((c) => <option key={c}>{c}</option>)}
        </select>
        {(view === "enquiries" || view === "all" || view === "due") && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-md h-10 px-2 bg-background text-sm">
            <option value="">Any status</option>
            {ENQUIRY_STATUSES.filter((s) => s.key !== "joined").map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
        <span className="self-center text-sm text-muted-foreground">{shown.length.toLocaleString()} shown</span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Who</th>
              <th className="text-left p-3">Class / interest</th>
              <th className="text-left p-3">Category</th>
              <th className="text-left p-3">Follow up</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {shown.slice(0, limit).map((p) => {
              const tag = p.kind === "enquiry" ? p.status ?? "new" : p.kind;
              const label = p.kind === "enquiry" ? statusLabel(p.status) : KIND_LABEL[p.kind];
              return (
                <tr key={p.key} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => setOpen(p)}>
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-muted-foreground tabular-nums whitespace-nowrap">{p.phone ?? "—"}</td>
                  <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${pill[tag] ?? ""}`}>{label}</span></td>
                  <td className="p-3 text-muted-foreground">{p.what || "—"}</td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {p.category ?? (p.kind === "enquiry" ? <span className="text-amber-600">not set</span> : "—")}
                    {p.kidAge ? ` · ${p.kidAge}` : ""}
                  </td>
                  <td className={`p-3 whitespace-nowrap ${isDue(p, today) ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {p.followUpOn ?? ""}
                  </td>
                </tr>
              );
            })}
            {!loading && shown.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nobody matches.</td></tr>}
          </tbody>
        </table>
      </div>
      {shown.length > limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + 200)}>Show more ({(shown.length - limit).toLocaleString()} left)</Button>
        </div>
      )}

      <PersonPanel person={current} onClose={() => setOpen(null)} />
    </div>
  );
}
