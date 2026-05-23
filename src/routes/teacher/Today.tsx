import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useTeacherMe } from "@/hooks/useTeacherMe";
import { useBatchRoster } from "@/hooks/useTeacherToday";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BADGE_LIST, getBadge } from "@/lib/badges";
import { SONGS } from "@/data/songs";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";

const COVER_TAGS = [
  "New song",
  "Chord transitions",
  "Strumming",
  "Fingerstyle",
  "Review",
  "Performance prep",
];

type AttStatus = "present" | "late" | "absent";

/* ---------- next-class hook ---------- */
function useTeacherNextClass() {
  const { data: teacher } = useTeacherMe();
  return useQuery({
    queryKey: ["teacher-next-class", teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data: batches, error } = await supabase
        .from("batches")
        .select("*, locations(name, address), instruments(name)")
        .eq("teacher_id", teacher!.id)
        .eq("is_active", true);
      if (error) throw error;

      const now = new Date();
      let best: { batch: any; date: Date } | null = null;
      for (const b of batches ?? []) {
        for (let d = 0; d < 7; d++) {
          const cand = new Date(now);
          cand.setDate(cand.getDate() + d);
          if (cand.getDay() !== b.day_of_week) continue;
          const [h, m] = String(b.start_time).split(":").map(Number);
          cand.setHours(h, m, 0, 0);
          const endMs = cand.getTime() + (b.duration_min ?? 60) * 60000;
          if (endMs < now.getTime()) continue;
          if (!best || cand < best.date) best = { batch: b, date: cand };
          break;
        }
      }
      if (!best) return null;

      const dateISO = best.date.toISOString().slice(0, 10);
      const [{ data: enrollments }, { data: sessions }, { data: prev }] = await Promise.all([
        supabase.from("enrollments").select("id").eq("batch_id", best.batch.id).eq("status", "active"),
        supabase.from("sessions").select("*").eq("batch_id", best.batch.id).eq("scheduled_date", dateISO).maybeSingle(),
        supabase.from("sessions").select("*").eq("batch_id", best.batch.id).eq("status", "completed").order("scheduled_date", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return {
        batch: best.batch,
        scheduledDate: dateISO,
        scheduledAt: best.date.toISOString(),
        studentCount: enrollments?.length ?? 0,
        session: sessions ?? null,
        previousSession: prev ?? null,
      };
    },
  });
}

/* ---------- start/end mutations ---------- */
function useEnsureSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { batchId: string; sessionId: string | null; date: string }) => {
      if (args.sessionId) return args.sessionId;
      const { data, error } = await supabase
        .from("sessions")
        .insert({ batch_id: args.batchId, scheduled_date: args.date, status: "upcoming" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },

    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-next-class"] }),
  });
}

function useSubmitClassWrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      sessionId: string;
      teacherNotes: string;
      coveredTags: string[];
      attendance: { student_id: string; status: AttStatus }[];
      badgeUpdates: { student_id: string; song_id: string; teacher_badge: number }[];
    }) => {
      const { error: sErr } = await supabase
        .from("sessions")
        .update({
          status: "completed",
          teacher_notes: args.teacherNotes,
          covered_tags: args.coveredTags,
          completed_at: new Date().toISOString(),
        })
        .eq("id", args.sessionId);
      if (sErr) throw sErr;

      if (args.attendance.length) {
        const rows = args.attendance.map((a) => ({ session_id: args.sessionId, student_id: a.student_id, status: a.status }));
        const { error: aErr } = await supabase.from("attendance").upsert(rows, { onConflict: "session_id,student_id" });
        if (aErr) {
          const { error: a2 } = await supabase.from("attendance").insert(rows);
          if (a2) throw a2;
        }
      }

      for (const u of args.badgeUpdates) {
        const { data: existing } = await supabase
          .from("song_progress")
          .select("id")
          .eq("student_id", u.student_id)
          .eq("song_id", u.song_id)
          .maybeSingle();
        if (existing) {
          await supabase.from("song_progress").update({ teacher_badge: u.teacher_badge, last_updated: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await supabase.from("song_progress").insert({ student_id: u.student_id, song_id: u.song_id, teacher_badge: u.teacher_badge });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-next-class"] });
      qc.invalidateQueries({ queryKey: ["teacher-students"] });
    },
  });
}

/* ---------- helpers ---------- */
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function elapsed(startMs: number) {
  const s = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

/* ---------- screen ---------- */
type Phase = "before" | "during" | "after";

export default function Today() {
  const { data: next, isLoading } = useTeacherNextClass();
  const [phase, setPhase] = useState<Phase>("before");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [showPrev, setShowPrev] = useState(false);

  const ensureSession = useEnsureSession();
  const submit = useSubmitClassWrap();

  const batchId = next?.batch?.id;
  const { data: roster = [] } = useBatchRoster(phase !== "before" ? batchId : undefined);

  // attendance state
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({});
  // wrap-up state
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [badgeUpdates, setBadgeUpdates] = useState<Record<string, { song_id: string; teacher_badge: number }>>({});

  // tick timer
  const [, setTick] = useState(0);
  useEffect(() => {
    if (phase !== "during") return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [phase]);

  const canStart = useMemo(() => {
    if (!next) return false;
    const start = new Date(next.scheduledAt).getTime();
    const end = start + (next.batch.duration_min ?? 60) * 60000;
    const now = Date.now();
    return now >= start - 30 * 60000 && now <= end;
  }, [next]);

  const handleStart = async () => {
    if (!next) return;
    try {
      const id = await ensureSession.mutateAsync({
        batchId: next.batch.id,
        sessionId: next.session?.id ?? null,
        date: next.scheduledDate,
      });
      setActiveSessionId(id);
      setStartedAt(Date.now());
      setPhase("during");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start class");
    }
  };

  const handleEnd = () => setPhase("after");

  const handleSubmit = async () => {
    if (!activeSessionId) return;
    try {
      await submit.mutateAsync({
        sessionId: activeSessionId,
        teacherNotes: notes,
        coveredTags: tags,
        attendance: roster.map((s: any) => ({
          student_id: s.id,
          status: attendance[s.id] ?? "absent",
        })),
        badgeUpdates: Object.entries(badgeUpdates).map(([student_id, v]) => ({
          student_id,
          song_id: v.song_id,
          teacher_badge: v.teacher_badge,
        })),
      });
      toast.success("Class wrapped up");
      // reset
      setPhase("before");
      setActiveSessionId(null);
      setStartedAt(null);
      setAttendance({});
      setNotes("");
      setTags([]);
      setBadgeUpdates({});
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    }
  };

  return (
    <section className="view view-teacher active">
      <div className="teacher-view max-w-3xl mx-auto px-4 py-6">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Today</div>
          <h1 className="text-2xl font-semibold">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h1>
        </header>

        {isLoading && <div className="text-sm">Loading…</div>}

        {/* BEFORE */}
        {phase === "before" && !isLoading && (
          <>
            {!next && <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No upcoming classes.</div>}

            {next && (
              <div className="space-y-4">
                <div className="rounded-xl border p-5 bg-card shadow-sm">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Next class</div>
                  <div className="text-xl font-semibold">{fmtDay(next.scheduledAt)} · {fmtTime(next.scheduledAt)}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {next.batch.locations?.name ?? "—"} · {next.batch.instruments?.name ?? "—"} · {next.studentCount} student{next.studentCount === 1 ? "" : "s"}
                  </div>
                  <Button
                    className="mt-4 w-full"
                    onClick={handleStart}
                    disabled={!canStart || ensureSession.isPending}
                  >
                    {canStart ? "Start class" : "Available 30 min before start"}
                  </Button>
                </div>

                {next.previousSession && (
                  <div className="rounded-xl border bg-card">
                    <button
                      className="w-full flex items-center justify-between p-4 text-left"
                      onClick={() => setShowPrev((s) => !s)}
                    >
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Last class notes</div>
                        <div className="text-sm">{fmtDay(next.previousSession.scheduled_date)}</div>
                      </div>
                      {showPrev ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {showPrev && (
                      <div className="px-4 pb-4 space-y-3 border-t pt-3">
                        {next.previousSession.covered_tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {next.previousSession.covered_tags.map((t: string) => (
                              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted">{t}</span>
                            ))}
                          </div>
                        )}
                        <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                          {next.previousSession.teacher_notes || <em className="opacity-70">No notes.</em>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* DURING */}
        {phase === "during" && next && (
          <div className="space-y-4">
            <div className="rounded-xl border p-4 bg-card flex items-center justify-between">
              <div>
                <div className="font-semibold">{next.batch.locations?.name} · {next.batch.instruments?.name}</div>
                <div className="text-xs text-muted-foreground">In progress</div>
              </div>
              <div className="text-2xl font-mono tabular-nums">{startedAt ? elapsed(startedAt) : "0:00"}</div>
            </div>

            <div className="rounded-xl border bg-card divide-y">
              {roster.length === 0 && <div className="p-6 text-sm text-muted-foreground">No students enrolled.</div>}
              {roster.map((s: any) => {
                const cur = attendance[s.id];
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="flex gap-1.5">
                      {(["present", "late", "absent"] as const).map((st) => (
                        <Button
                          key={st}
                          size="sm"
                          variant={cur === st ? "default" : "outline"}
                          onClick={() => setAttendance((a) => ({ ...a, [s.id]: st }))}
                        >
                          {st[0].toUpperCase() + st.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button className="w-full" size="lg" onClick={handleEnd}>End class</Button>
          </div>
        )}

        {/* AFTER */}
        {phase === "after" && next && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium block mb-1.5">Session notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it go?" rows={4} />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">What did you cover today?</label>
              <div className="flex flex-wrap gap-2">
                {COVER_TAGS.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== t) : [...cur, t]))}
                      className={`text-sm px-3 py-1.5 rounded-full border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Badge updates <span className="text-xs text-muted-foreground font-normal">(optional)</span></label>
              <div className="rounded-xl border bg-card divide-y">
                {roster.map((s: any) => {
                  const upd = badgeUpdates[s.id];
                  const badge = upd ? getBadge(upd.teacher_badge) : null;
                  return (
                    <BadgeRow
                      key={s.id}
                      student={s}
                      update={upd}
                      onChange={(v) =>
                        setBadgeUpdates((b) => {
                          if (!v) {
                            const { [s.id]: _omit, ...rest } = b;
                            return rest;
                          }
                          return { ...b, [s.id]: v };
                        })
                      }
                    />
                  );
                })}
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submit.isPending}>
              {submit.isPending ? "Saving…" : "Submit"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function BadgeRow({
  student,
  update,
  onChange,
}: {
  student: any;
  update: { song_id: string; teacher_badge: number } | undefined;
  onChange: (v: { song_id: string; teacher_badge: number } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const song = update ? SONGS.find((s) => s.id === update.song_id) : null;
  const badge = update ? getBadge(update.teacher_badge) : null;
  return (
    <div className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-sm">{student.name}</div>
        <div className="flex items-center gap-2">
          {update && (
            <span className="text-xs text-muted-foreground">{song?.title} · {badge?.emoji} {badge?.name}</span>
          )}
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
            {update ? "Edit" : "Set"}
          </Button>
          {update && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Clear</Button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <select
            className="w-full border rounded-md p-2 bg-background text-sm"
            value={update?.song_id ?? ""}
            onChange={(e) =>
              onChange({
                song_id: e.target.value,
                teacher_badge: update?.teacher_badge ?? 1,
              })
            }
          >
            <option value="">Select song…</option>
            {SONGS.filter((s) => !s.fingerstyle).map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <div className="grid grid-cols-5 gap-1.5">
            {BADGE_LIST.map((b) => {
              const selected = update?.teacher_badge === b.level;
              return (
                <button
                  key={b.level}
                  className={`flex flex-col items-center rounded-md border p-2 text-xs transition ${selected ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
                  onClick={() => {
                    if (!update?.song_id) {
                      toast.error("Pick a song first");
                      return;
                    }
                    onChange({ song_id: update.song_id, teacher_badge: b.level });
                  }}
                >
                  <span className="text-xl">{b.emoji}</span>
                  <span>{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
