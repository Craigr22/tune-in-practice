import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeacherStudents } from "@/hooks/useTeacherStudents";
import { useCatalogSongs } from "@/hooks/useSongCatalog";
import {
  useBatchCourseworkRows,
  useBatchSettings,
  useSaveCoursework,
  useSaveSongsPerDay,
  useSaveCourseStart,
  normalizeSongsPerDay,
  effectiveClassSongs,
  toInstrument,
} from "@/hooks/useBatchCoursework";
import { StudentRow, StudentDetail } from "@/components/teacher/StudentRoster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronUp, ChevronDown, Lock, Unlock } from "lucide-react";
import { SESSION_ORDER, SESSION_TEMPLATES } from "@/lib/sessionTemplates";
import { useStudentCoursePlan, planWeekNumberFor } from "@/hooks/useCoursePlan";
import { isoMonday } from "@/hooks/useWeeklyPlan";
import { toast } from "sonner";

type EditRow = { song_id: string; title: string; artist: string; is_unlocked: boolean };

function CourseworkPanel({ batchId, instrumentName }: { batchId: string; instrumentName?: string }) {
  const instrument = toInstrument(instrumentName);
  const catalog = useCatalogSongs(instrument, { showInactive: false });
  const { data: rows = [], isLoading } = useBatchCourseworkRows(batchId);
  const { data: settings } = useBatchSettings(batchId);
  const saveCoursework = useSaveCoursework(batchId);
  const saveSongsPerDay = useSaveSongsPerDay(batchId);
  const saveCourseStart = useSaveCourseStart(batchId);
  const { days: planDays } = useStudentCoursePlan(instrument);
  const [courseStart, setCourseStart] = useState("");
  useEffect(() => setCourseStart(settings?.course_start_date ?? ""), [settings?.course_start_date]);

  const totalPlanWeeks = new Set(planDays.map((d) => d.week_number)).size;
  const effectiveStart = settings?.course_start_date ?? null;
  const currentPlanWeek = planWeekNumberFor(effectiveStart, isoMonday());

  const [list, setList] = useState<EditRow[]>([]);
  const [perDay, setPerDay] = useState<number[]>(() => normalizeSongsPerDay(null));

  // Sync local editable state when the effective list loads/changes.
  const effective = useMemo(() => effectiveClassSongs(catalog, rows, { showLocked: true }), [catalog, rows]);
  useEffect(() => {
    setList(
      effective.map((s) => ({
        song_id: s.id,
        title: s.title,
        artist: s.artist ?? "",
        is_unlocked: s.unlocked,
      })),
    );
  }, [effective]);
  useEffect(() => {
    if (settings) setPerDay(settings.songs_per_day);
  }, [settings]);

  // Reordering is batched behind the Save button; locking saves immediately.
  const [dirtyOrder, setDirtyOrder] = useState(false);

  const payloadFor = (rows_: EditRow[]) =>
    rows_.map((r, i) => ({ song_id: r.song_id, is_unlocked: r.is_unlocked, sort_order: (i + 1) * 100 }));

  const move = (i: number, dir: -1 | 1) => {
    setList((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirtyOrder(true);
  };

  /** Lock/unlock persists straight away — a switch that silently didn't save
      was the easiest way to think students had been given a song. */
  const toggle = async (i: number) => {
    const before = list;
    const next = list.map((r, idx) => (idx === i ? { ...r, is_unlocked: !r.is_unlocked } : r));
    setList(next);
    try {
      await saveCoursework.mutateAsync(payloadFor(next));
      setDirtyOrder(false); // the write above also committed any pending order
      toast.success(`${next[i].is_unlocked ? "Unlocked" : "Locked"} “${next[i].title}”`);
    } catch (e: any) {
      setList(before);
      toast.error(e.message ?? "Failed to save");
    }
  };

  const saveOrder = async () => {
    try {
      await saveCoursework.mutateAsync(payloadFor(list));
      setDirtyOrder(false);
      toast.success("Song order saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    }
  };

  const setDayCount = async (dayIndex: number, n: number) => {
    const next = perDay.map((v, i) => (i === dayIndex ? n : v));
    setPerDay(next);
    try {
      await saveSongsPerDay.mutateAsync(next);
      toast.success(`Day ${dayIndex + 1} set to ${n} song${n === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
      if (settings) setPerDay(settings.songs_per_day); // roll back on failure
    }
  };

  if (isLoading) return <div className="text-sm">Loading coursework…</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4">
        <div className="font-medium text-sm">Course start</div>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          The week this class begins the course. Set it when a new batch starts and they get
          week 1 from that date — the same course, shifted to when they began.
        </p>
        <div className="mt-3 flex items-end gap-2 flex-wrap">
          <Input
            type="date"
            value={courseStart}
            onChange={(e) => setCourseStart(e.target.value)}
            className="w-44"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={saveCourseStart.isPending}
            onClick={async () => {
              try {
                await saveCourseStart.mutateAsync(courseStart || null);
                toast.success(courseStart ? "Course start saved" : "Using the course default");
              } catch (e: any) {
                toast.error(e.message ?? "Failed to save");
              }
            }}
          >
            Save
          </Button>
          <span className="text-xs text-muted-foreground">
            {!effectiveStart
              ? "Not started — set a date and this class begins week 1 of the course."
              : currentPlanWeek && currentPlanWeek <= totalPlanWeeks
              ? `On week ${currentPlanWeek} of ${totalPlanWeeks} this week.`
              : currentPlanWeek
              ? `Past the ${totalPlanWeeks}-week plan — students get generated practice.`
              : `Starts ${effectiveStart}.`}
          </span>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="font-medium text-sm">Weekly practice plan</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          How many of the unlocked songs fill each 30-minute practice day. Ramp it up across the
          week — e.g. 1 song on day 1, 2 on day 2 — or keep it steady.
        </p>

        <div className="mt-3 space-y-2">
          {SESSION_ORDER.map((kind, i) => {
            const tpl = SESSION_TEMPLATES[kind];
            return (
              <div key={kind} className="flex items-center gap-3 flex-wrap">
                <div className="w-40 shrink-0">
                  <div className="text-sm font-medium">Day {i + 1}</div>
                  <div className="text-xs text-muted-foreground">{tpl.emoji} {tpl.label}</div>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => setDayCount(i, n)}
                      disabled={saveSongsPerDay.isPending}
                      className={`px-3 py-1.5 rounded-md text-sm border disabled:opacity-60 ${
                        perDay[i] === n ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      {n} song{n === 1 ? "" : "s"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          {perDay.reduce((a, b) => a + b, 0)} song slots across the week · songs are picked from this
          class's unlocked list, in the order below.
        </p>
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div>
            <div className="font-medium text-sm">Course songs</div>
            <p className="text-xs text-muted-foreground">
              From the school's course catalog. Unlocking saves straight away; reordering needs the Save button.
            </p>
            <p className="text-xs mt-0.5 font-medium text-emerald-700">
              Students in this class see {list.filter((r) => r.is_unlocked).length} of {list.length} songs
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirtyOrder && (
              <span className="text-xs font-medium text-amber-600">Unsaved order</span>
            )}
            <Button size="sm" onClick={saveOrder} disabled={saveCoursework.isPending || !dirtyOrder}>
              {saveCoursework.isPending ? "Saving…" : "Save order"}
            </Button>
          </div>
        </div>
        <div className="divide-y">
          {list.map((r, i) => (
            <div key={r.song_id} className={`flex items-center gap-3 px-4 py-2 ${!r.is_unlocked ? "opacity-60" : ""}`}>
              <div className="flex flex-col">
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === list.length - 1}
                  onClick={() => move(i, 1)}
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="w-6 text-xs tabular-nums text-muted-foreground">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                {r.artist && <div className="text-xs text-muted-foreground truncate">{r.artist}</div>}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {r.is_unlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <Switch checked={r.is_unlocked} onCheckedChange={() => toggle(i)} />
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="px-4 py-6 text-sm text-muted-foreground">No songs in this course yet.</div>}
        </div>
      </div>
    </div>
  );
}

export default function ClassDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { data: groups = [], isLoading } = useTeacherStudents();
  const [openStudent, setOpenStudent] = useState<any | null>(null);

  const group = useMemo(() => groups.find((g: any) => g.batch.id === batchId), [groups, batchId]);

  if (isLoading) {
    return (
      <section className="view view-teacher active">
        <div className="teacher-view max-w-4xl mx-auto px-4 py-6 text-sm">Loading…</div>
      </section>
    );
  }

  if (!group) {
    return (
      <section className="view view-teacher active">
        <div className="teacher-view max-w-4xl mx-auto px-4 py-6">
          <button className="text-sm text-muted-foreground flex items-center gap-1" onClick={() => navigate("/teacher/classes")}>
            <ArrowLeft className="w-4 h-4" /> Back to classes
          </button>
          <div className="mt-6 text-sm text-muted-foreground">Class not found.</div>
        </div>
      </section>
    );
  }

  const batch = group.batch;

  return (
    <section className="view view-teacher active">
      <div className="teacher-view max-w-4xl mx-auto px-4 py-6">
        <button
          className="text-sm text-muted-foreground flex items-center gap-1 mb-3 hover:text-foreground"
          onClick={() => navigate("/teacher/classes")}
        >
          <ArrowLeft className="w-4 h-4" /> Back to classes
        </button>
        <header className="mb-4">
          <h1 className="text-2xl font-semibold">
            {batch.code ? `${batch.code} · ` : ""}{batch.locations?.name} · {batch.instruments?.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {group.students.length} student{group.students.length === 1 ? "" : "s"} ·{" "}
            {batch.semester_start ?? "—"} → {batch.semester_end ?? "ongoing"}
          </p>
        </header>

        <Tabs defaultValue="coursework">
          <TabsList>
            <TabsTrigger value="coursework">Coursework</TabsTrigger>
            <TabsTrigger value="roster">Roster</TabsTrigger>
          </TabsList>

          <TabsContent value="coursework" className="pt-4">
            <CourseworkPanel batchId={batch.id} instrumentName={batch.instruments?.name} />
          </TabsContent>

          <TabsContent value="roster" className="pt-4">
            <div className="rounded-xl border bg-card">
              <div className="grid grid-cols-[1.4fr_1fr_0.6fr_0.7fr_auto] gap-4 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <div>Student</div>
                <div>Practice 14d</div>
                <div>Attend</div>
                <div>Badge</div>
                <div></div>
              </div>
              {group.students.length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">No students enrolled.</div>
              ) : (
                group.students.map((s: any) => (
                  <StudentRow key={s.id} student={s} onOpen={() => setOpenStudent(s)} />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <StudentDetail student={openStudent} batch={batch} onClose={() => setOpenStudent(null)} />
    </section>
  );
}
