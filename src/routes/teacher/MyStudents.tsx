import { useMemo, useState } from "react";
import { useTeacherStudents, useStudentDetail } from "@/hooks/useTeacherStudents";
import { computeRetention } from "@/lib/retention";
import { getBadge } from "@/lib/badges";
import { CHECK_IN_COLOR, type CheckIn } from "@/hooks/useStudentProgress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { SONGS } from "@/data/songs";

/* ---------- helpers ---------- */
function dailyMinutes(practice: { played_on: string; duration_min: number }[], days: number) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const arr = Array(days).fill(0);
  for (const p of practice) {
    const d = new Date(p.played_on); d.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < days) arr[days - 1 - diff] += p.duration_min;
  }
  return arr;
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-6">
      {values.map((v, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm ${v > 0 ? "bg-primary" : "bg-muted"}`}
          style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
          title={`${v}m`}
        />
      ))}
    </div>
  );
}

/* ---------- row ---------- */
function StudentRow({ student, onOpen }: { student: any; onOpen: () => void }) {
  const { data } = useStudentDetail(student.id);
  const bars = useMemo(() => (data ? dailyMinutes(data.practice, 14) : []), [data]);
  const retention = useMemo(
    () => (data ? computeRetention(data.practice, data.attendance as any, null) : null),
    [data]
  );
  const totalAtt = data?.attendance.length ?? 0;
  const presents = (data?.attendance ?? []).filter((a: any) => a.status === "present" || a.status === "late").length;
  const attPct = totalAtt ? Math.round((presents / totalAtt) * 100) : 0;
  const activeProgress = (data?.progress ?? [])
    .slice()
    .sort((a: any, b: any) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())[0];
  const badge = getBadge(activeProgress?.teacher_badge);
  const flag = retention?.flag ?? "amber";
  const flagClass = flag === "green" ? "bg-emerald-500" : flag === "amber" ? "bg-amber-500" : "bg-red-500";

  return (
    <div
      onClick={onOpen}
      className="grid grid-cols-[1.4fr_1fr_0.6fr_0.7fr_auto] items-center gap-4 px-4 py-3 border-b cursor-pointer hover:bg-muted/40"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-sm font-semibold">
          {student.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="font-medium truncate">{student.name}</div>
      </div>
      <MiniBars values={bars} />
      <div className="text-sm tabular-nums">{attPct}%</div>
      <div className="text-sm">{badge ? <span title={badge.name}>{badge.emoji}</span> : <span className="text-muted-foreground">—</span>}</div>
      <span className={`w-2.5 h-2.5 rounded-full ${flagClass}`} title={`Retention: ${flag}`} />
    </div>
  );
}

/* ---------- detail drawer ---------- */
function StudentDetail({ student, onClose }: { student: any | null; onClose: () => void }) {
  const { data } = useStudentDetail(student?.id);
  if (!student) return null;

  const progressBySong = new Map((data?.progress ?? []).map((p: any) => [p.song_id, p]));
  const semSongs = SONGS.filter((s) => !s.fingerstyle).slice(0, 8);

  // 12-week dot grid
  const weeks = 12;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayCells: { date: string; status: "present" | "late" | "absent" | null }[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const a = (data?.attendance ?? []).find((x: any) => x.session_date === iso);
    dayCells.push({ date: iso, status: a?.status ?? null });
  }

  const recentPractice = (data?.practice ?? []).slice().reverse().slice(0, 30);

  return (
    <Sheet open={!!student} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{student.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-6 text-sm">
          <div className="text-muted-foreground space-y-0.5">
            {student.parent_name && <div>Parent: {student.parent_name}</div>}
            {student.phone && (
              <div>
                Phone: <a className="text-primary underline" href={`tel:${student.phone}`}>{student.phone}</a>
              </div>
            )}
          </div>

          <section>
            <h3 className="font-semibold mb-2">Songs</h3>
            <div className="border rounded-md divide-y">
              {semSongs.map((s) => {
                const p: any = progressBySong.get(s.id);
                const tb = getBadge(p?.teacher_badge);
                const sb = getBadge(p?.self_badge);
                return (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2">
                    <div className="truncate">{s.title}</div>
                    <div className="flex items-center gap-3 text-xs">
                      <span title="Teacher badge">T: {tb ? `${tb.emoji} ${tb.name}` : "—"}</span>
                      <span className="text-muted-foreground" title="Self badge">S: {sb ? sb.emoji : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Practice — last 30 days</h3>
            {recentPractice.length === 0 ? (
              <div className="text-muted-foreground">No practice logs.</div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {recentPractice.map((p: any) => {
                  const song = SONGS.find((s) => s.id === p.song_id);
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs border-b py-1">
                      <span className="flex items-center gap-2">
                        {p.check_in && (
                          <span className={`inline-block w-2 h-2 rounded-full ${CHECK_IN_COLOR[p.check_in as CheckIn]}`} />
                        )}
                        <span>{p.played_on}</span>
                        <span className="text-muted-foreground">· {song?.title ?? p.song_id}</span>
                      </span>
                      <span className="tabular-nums">{p.duration_min}m</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="font-semibold mb-2">Attendance — last 12 weeks</h3>
            <div className="grid grid-cols-12 gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
              {Array.from({ length: weeks }).map((_, w) => (
                <div key={w} className="flex flex-col gap-1">
                  {Array.from({ length: 7 }).map((_, d) => {
                    const cell = dayCells[w * 7 + d];
                    const cls =
                      cell?.status === "present" ? "bg-emerald-500" :
                      cell?.status === "late" ? "bg-amber-500" :
                      cell?.status === "absent" ? "bg-red-500" :
                      "bg-muted";
                    return <span key={d} className={`block w-3 h-3 rounded-sm ${cls}`} title={cell?.date} />;
                  })}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> present</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500" /> late</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> absent</span>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- screen ---------- */
export default function MyStudents() {
  const { data: groups = [], isLoading } = useTeacherStudents();
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [openStudent, setOpenStudent] = useState<any | null>(null);

  const visibleGroups = useMemo(() => {
    return groups
      .filter((g: any) => batchFilter === "all" || g.batch.id === batchFilter)
      .map((g: any) => ({
        ...g,
        students: g.students.filter((s: any) =>
          search.trim() === "" ? true : s.name.toLowerCase().includes(search.toLowerCase())
        ),
      }));
  }, [groups, batchFilter, search]);

  return (
    <section className="view view-teacher active">
      <div className="teacher-view max-w-4xl mx-auto px-4 py-6">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold">My students</h1>
        </header>

        <div className="flex flex-wrap gap-3 mb-4">
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            className="border rounded-md px-3 py-2 bg-background text-sm"
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
          >
            <option value="all">All batches</option>
            {groups.map((g: any) => (
              <option key={g.batch.id} value={g.batch.id}>
                {g.batch.locations?.name} · {g.batch.instruments?.name}
              </option>
            ))}
          </select>
        </div>

        {isLoading && <div className="text-sm">Loading…</div>}

        {visibleGroups.map((g: any) => (
          <div key={g.batch.id} className="rounded-xl border bg-card mb-5">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
              <div>
                <div className="font-semibold">{g.batch.locations?.name} · {g.batch.instruments?.name}</div>
                <div className="text-xs text-muted-foreground">{g.students.length} student{g.students.length === 1 ? "" : "s"}</div>
              </div>
            </div>
            <div className="grid grid-cols-[1.4fr_1fr_0.6fr_0.7fr_auto] gap-4 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
              <div>Student</div>
              <div>Practice 14d</div>
              <div>Attend</div>
              <div>Badge</div>
              <div></div>
            </div>
            {g.students.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">No matching students.</div>
            ) : (
              g.students.map((s: any) => (
                <StudentRow key={s.id} student={s} onOpen={() => setOpenStudent(s)} />
              ))
            )}
          </div>
        ))}
      </div>

      <StudentDetail student={openStudent} onClose={() => setOpenStudent(null)} />
    </section>
  );
}
