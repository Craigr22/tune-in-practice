import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeacherStudents } from "@/hooks/useTeacherStudents";
import { useCatalogSongs } from "@/hooks/useSongCatalog";
import { toInstrument } from "@/hooks/useBatchCoursework";
import { StudentRow, StudentDetail } from "@/components/teacher/StudentRoster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { useStudentCoursePlan, planWeekNumberFor, daysForWeek } from "@/hooks/useCoursePlan";
import { isoMonday } from "@/hooks/useWeeklyPlan";

/**
 * What this class is working through — read-only.
 *
 * The course itself (weeks, days, songs, videos, instructions) is owned by
 * admins in Course work, and a planned week is used verbatim, so editing it
 * per class here only created a second source of truth that the plan then
 * ignored. Teachers see the plan and grade against it.
 */
function CoursePanel({ startDate, instrumentName }: { startDate: string | null; instrumentName?: string }) {
  const instrument = toInstrument(instrumentName);
  const catalog = useCatalogSongs(instrument, { showInactive: false });
  const { days: planDays } = useStudentCoursePlan(instrument);

  const start = startDate;
  const totalWeeks = new Set(planDays.map((d) => d.week_number)).size;
  const currentWeek = planWeekNumberFor(start, isoMonday());
  const thisWeek = currentWeek ? daysForWeek(planDays, currentWeek) : [];
  const songTitle = (id: string | null) => (id ? catalog.find((c) => c.id === id)?.title ?? id : null);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="font-medium text-sm">Course</div>
        {!start ? (
          <p className="text-sm text-muted-foreground mt-1">
            This class hasn't been started on the course yet. An admin sets its start date on the
            class in Schedule → Classes.
          </p>
        ) : currentWeek && currentWeek <= totalWeeks ? (
          <p className="text-sm text-muted-foreground mt-1">
            Week <strong className="text-foreground">{currentWeek}</strong> of {totalWeeks} · started {start}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">
            {currentWeek ? `Past the ${totalWeeks}-week plan` : `Starts ${start}`} · students get
            generated practice until the plan is extended.
          </p>
        )}
      </div>

      {thisWeek.length > 0 && (
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b bg-muted/30">
            <div className="font-medium text-sm">This week's practice</div>
            <p className="text-xs text-muted-foreground">
              Set by admins in Course work — the same three days every student in this class sees.
            </p>
          </div>
          <div className="divide-y">
            {thisWeek.map((d) => (
              <div key={d.id} className="px-4 py-3">
                <div className="text-sm font-medium">
                  Day {d.day_number}
                  {songTitle(d.focus_song_id) && (
                    <span className="text-muted-foreground font-normal"> · {songTitle(d.focus_song_id)}</span>
                  )}
                </div>
                {d.focus_instruction && (
                  <p className="text-xs text-muted-foreground mt-0.5">{d.focus_instruction}</p>
                )}
                {(d.video_ids?.length ?? 0) > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    🎬 {d.video_ids.length} lesson{d.video_ids.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
            <TabsTrigger value="coursework">Course</TabsTrigger>
            <TabsTrigger value="roster">Roster</TabsTrigger>
          </TabsList>

          <TabsContent value="coursework" className="pt-4">
            <CoursePanel startDate={batch.semester_start ?? null} instrumentName={batch.instruments?.name} />
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
