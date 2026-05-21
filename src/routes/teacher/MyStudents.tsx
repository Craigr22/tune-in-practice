import { useMemo, useState } from "react";
import { useTeacherStudents, useStudentDetail } from "@/hooks/useTeacherStudents";
import { computeRetention } from "@/lib/retention";
import { getBadge } from "@/lib/badges";
import { sentimentStrip, CHECK_IN_COLOR, type CheckIn } from "@/hooks/useStudentProgress";
import { useSignedRecordingUrl } from "@/hooks/useSignedRecordingUrl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SONGS } from "@/data/songs";

function Sparkline({ values }: { values: number[] }) {
  const w = 80, h = 24;
  if (!values.length) return <svg width={w} height={h}><line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke="currentColor" opacity="0.2" /></svg>;
  const max = Math.max(...values, 1);
  const step = w / Math.max(values.length - 1, 1);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join(" ");
  return <svg width={w} height={h}><path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

function dailyMinutes(practice: { played_on: string; duration_min: number }[]) {
  const days = 30;
  const today = new Date();
  const arr = Array(days).fill(0);
  for (const p of practice) {
    const d = new Date(p.played_on);
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < days) arr[days - 1 - diff] += p.duration_min;
  }
  return arr;
}

function SentimentDots({ logs }: { logs: { played_on: string; check_in: CheckIn | null }[] }) {
  const strip = sentimentStrip(logs, 7);
  return (
    <div className="flex items-center gap-1">
      {strip.map((d) => (
        <span
          key={d.date}
          title={`${d.date} · ${d.checkIn ?? "no practice"}`}
          className={`w-2.5 h-2.5 rounded-full ${CHECK_IN_COLOR[d.checkIn ?? "none"]}`}
        />
      ))}
    </div>
  );
}

function RecordingItem({ path, log }: { path: string; log: any }) {
  const url = useSignedRecordingUrl(path);
  const song = SONGS.find((s) => s.id === log.song_id);
  if (!url) return null;
  return (
    <div className="border rounded p-2 mb-2">
      <div className="text-xs text-muted-foreground">{log.played_on} · {song?.title ?? log.song_id}</div>
      <audio controls src={url} className="w-full mt-1" />
    </div>
  );
}

function StudentRow({ student, onNeedHelpChange }: { student: any; onNeedHelpChange: (id: string, flagged: boolean) => void }) {
  const [openDetail, setOpenDetail] = useState(false);
  const [openFlag, setOpenFlag] = useState(false);
  const { data } = useStudentDetail(student.id);
  const spark = useMemo(() => (data ? dailyMinutes(data.practice) : []), [data]);
  const retention = useMemo(
    () => (data ? computeRetention(data.practice, data.attendance as any, null) : null),
    [data]
  );
  const totalAttendance = data?.attendance.length ?? 0;
  const presents = (data?.attendance ?? []).filter((a: any) => a.status === "present" || a.status === "late").length;
  const attendancePct = totalAttendance ? Math.round((presents / totalAttendance) * 100) : 0;
  const activeProgress = (data?.progress ?? []).slice().sort((a: any, b: any) =>
    new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  )[0];
  const badge = getBadge(activeProgress?.teacher_badge);

  const last7 = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    return (data?.practice ?? []).filter((p: any) => new Date(p.played_on) >= cutoff);
  }, [data]);
  const flaggedNeedHelp = last7.some((p: any) => p.check_in === "need_help");

  useMemo(() => onNeedHelpChange(student.id, flaggedNeedHelp), [flaggedNeedHelp, student.id]);

  const recordings = (data?.practice ?? []).filter((p: any) => p.recording_url);

  return (
    <>
      <div
        className="grid grid-cols-[1.4fr_0.9fr_0.8fr_0.9fr_0.9fr_auto] items-center gap-3 p-3 border-b cursor-pointer hover:bg-muted/30"
        onClick={() => setOpenDetail(true)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-sm font-semibold">
            {student.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-medium">{student.name} {flaggedNeedHelp && <span className="text-red-500" title="Flagged need help">●</span>}</div>
            <div className="text-xs text-muted-foreground">Joined {student.joined_on}</div>
          </div>
        </div>
        <div className="text-muted-foreground"><Sparkline values={spark} /></div>
        <div className="text-sm">{attendancePct}%</div>
        <div onClick={(e) => e.stopPropagation()}>
          <SentimentDots logs={data?.practice ?? []} />
        </div>
        <div className="text-sm">
          {badge ? <>{badge.emoji} {badge.name}</> : <span className="text-muted-foreground">—</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setOpenFlag(true); }}
          className={`w-3 h-3 rounded-full ${retention?.flag === "green" ? "bg-emerald-500" : retention?.flag === "amber" ? "bg-amber-500" : "bg-red-500"}`}
          title={retention?.flag ?? ""}
        />
      </div>

      <Dialog open={openFlag} onOpenChange={setOpenFlag}>
        <DialogContent>
          <DialogHeader><DialogTitle>Retention signals · {student.name}</DialogTitle></DialogHeader>
          {retention && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Practice last 14d vs prior 14d</span>
                <span>{retention.signals.recentMinutes}m vs {retention.signals.priorMinutes}m {retention.signals.practiceDrop ? "⚠️" : "✓"}</span>
              </div>
              <div className="flex justify-between"><span>Absences last 4 weeks</span>
                <span>{retention.signals.recentAbsences} {retention.signals.attendanceTrend ? "⚠️" : "✓"}</span>
              </div>
              <div className="flex justify-between"><span>Days since last app open</span>
                <span>{retention.signals.daysSinceLastOpen ?? "—"} {retention.signals.staleApp ? "⚠️" : "✓"}</span>
              </div>
              <div className="pt-2 border-t font-medium">Overall: {retention.flag.toUpperCase()} ({retention.badCount} bad signals)</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={openDetail} onOpenChange={setOpenDetail}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{student.name}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-6 text-sm">
            <section>
              <h3 className="font-semibold mb-2">Songs & badges</h3>
              {(data?.progress ?? []).map((p: any) => {
                const b = getBadge(p.teacher_badge);
                const song = SONGS.find((s) => s.id === p.song_id);
                return (
                  <div key={p.id} className="flex justify-between border-b py-1.5">
                    <span>{song?.title ?? p.song_id}</span>
                    <span>{b ? `${b.emoji} ${b.name}` : "—"}</span>
                  </div>
                );
              })}
              {!data?.progress?.length && <div className="text-muted-foreground">No song progress yet.</div>}
            </section>
            <section>
              <h3 className="font-semibold mb-2">Practice history (last 60 days)</h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {(data?.practice ?? []).slice().reverse().map((p: any) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span>
                      {p.played_on} · {SONGS.find((s) => s.id === p.song_id)?.title ?? p.song_id}
                      {p.check_in && <span className={`ml-2 inline-block w-2 h-2 rounded-full ${CHECK_IN_COLOR[p.check_in as CheckIn]}`} />}
                    </span>
                    <span>{p.duration_min}m {p.tuning_check_completed ? "🎵" : ""}</span>
                  </div>
                ))}
                {!data?.practice?.length && <div className="text-muted-foreground">No practice logs.</div>}
              </div>
            </section>
            <section>
              <h3 className="font-semibold mb-2">Optional clips</h3>
              {recordings.length === 0 && <div className="text-muted-foreground">No clips submitted.</div>}
              {recordings.map((p: any) => (
                <RecordingItem key={p.id} path={p.recording_url} log={p} />
              ))}
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function MyStudents() {
  const { data: groups = [], isLoading } = useTeacherStudents();
  const [onlyNeedHelp, setOnlyNeedHelp] = useState(false);
  const [needHelpMap, setNeedHelpMap] = useState<Record<string, boolean>>({});
  const onNeedHelpChange = (id: string, v: boolean) =>
    setNeedHelpMap((m) => (m[id] === v ? m : { ...m, [id]: v }));

  return (
    <section className="view view-teacher active">
      <div className="teacher-view">
        <header className="teacher-header flex justify-between items-center">
          <h1 className="teacher-title">My students</h1>
          <label className="text-xs flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={onlyNeedHelp} onChange={(e) => setOnlyNeedHelp(e.target.checked)} />
            Only "Need help" (last 7d)
          </label>
        </header>
        {isLoading && <div className="p-4 text-sm">Loading…</div>}
        {groups.map((g: any) => {
          const filtered = onlyNeedHelp ? g.students.filter((s: any) => needHelpMap[s.id]) : g.students;
          return (
            <div key={g.batch.id} className="teacher-class mb-6">
              <div className="p-3 border-b bg-muted/30">
                <div className="font-semibold">{g.batch.locations?.name} · {g.batch.instruments?.name}</div>
                <div className="text-xs text-muted-foreground">{filtered.length} of {g.students.length} students</div>
              </div>
              <div className="grid grid-cols-[1.4fr_0.9fr_0.8fr_0.9fr_0.9fr_auto] gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <div>Student</div><div>Practice 30d</div><div>Attended</div><div>Recent check-ins</div><div>Badge</div><div></div>
              </div>
              {filtered.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No matching students.</div>
              )}
              {g.students.map((s: any) => (
                <div key={s.id} style={{ display: onlyNeedHelp && !needHelpMap[s.id] ? "none" : undefined }}>
                  <StudentRow student={s} onNeedHelpChange={onNeedHelpChange} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
