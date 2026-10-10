import { useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTeacherStudents, useSessionCounts, standings } from "@/hooks/useTeacherStudents";
import { classWhen } from "@/lib/classLabel";
import { useCatalogSongs } from "@/hooks/useSongCatalog";
import { toInstrument } from "@/hooks/useBatchCoursework";
import { StudentRow, StudentDetail } from "@/components/teacher/StudentRoster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { useStudentCoursePlan, shiftedPlanWeek, daysForWeek } from "@/hooks/useCoursePlan";
import { useBatchPlanShifts, totalShiftWeeks } from "@/hooks/useBatchPlanShift";
import PausePlanCard from "@/components/teacher/PausePlanCard";
import { classWeekStart, planWeekOneStart } from "@/hooks/useWeeklyPlan";
import ClassPhotoCard from "@/components/teacher/ClassPhotoCard";
import ExtraSongsCard from "@/components/teacher/ExtraSongsCard";
import FullCourse from "@/components/teacher/FullCourse";

/**
 * What this class is working through — read-only.
 *
 * The course itself (weeks, days, songs, videos, instructions) is owned by
 * admins in Course work, and a planned week is used verbatim, so editing it
 * per class here only created a second source of truth that the plan then
 * ignored. Teachers see the plan and grade against it.
 */
function CoursePanel({
  batchId,
  startDate,
  dayOfWeek,
  instrumentName,
}: {
  batchId: string;
  startDate: string | null;
  dayOfWeek: number | null;
  instrumentName?: string;
}) {
  const instrument = toInstrument(instrumentName);
  const catalog = useCatalogSongs(instrument, { showInactive: false });
  const { days: planDays } = useStudentCoursePlan(instrument);

  const start = startDate;
  const { data: shifts = [] } = useBatchPlanShifts(batchId);
  const behind = totalShiftWeeks(shifts);
  const totalWeeks = new Set(planDays.map((d) => d.week_number)).size;
  const classDow = dayOfWeek ?? 6;
  const currentWeek = start
    ? shiftedPlanWeek(planWeekOneStart(start, classDow), classWeekStart(classDow), behind)
    : null;
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
            {behind > 0 && ` · paused ${behind} week${behind === 1 ? "" : "s"}`}
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
                  {songTitle(d.song_id) && (
                    <span className="text-muted-foreground font-normal"> · {songTitle(d.song_id)}</span>
                  )}
                </div>
                {d.instruction && (
                  <p className="text-xs text-muted-foreground mt-0.5">{d.instruction}</p>
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

/** The whole course for this class, with the week it is on marked. */
function FullCoursePanel({ batch }: { batch: any }) {
  const { data: shifts = [] } = useBatchPlanShifts(batch.id);
  const classDow = batch.day_of_week ?? 6;
  const currentWeek = batch.semester_start
    ? shiftedPlanWeek(planWeekOneStart(batch.semester_start, classDow), classWeekStart(classDow), totalShiftWeeks(shifts))
    : null;
  return <FullCourse instrument={toInstrument(batch.instruments?.name)} currentWeek={currentWeek} />;
}

export default function ClassDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { data: groups = [], isLoading } = useTeacherStudents();
  // Which student's drawer is open lives in the address, so the first page
  // can link straight to a student and Back closes the drawer.
  const [params, setParams] = useSearchParams();
  const openId = params.get("student");
  const setOpenStudent = (id: string | null) =>
    setParams(id ? { student: id } : {}, { replace: !id });

  const group = useMemo(() => groups.find((g: any) => g.batch.id === batchId), [groups, batchId]);
  const ids = useMemo(() => (group?.students ?? []).map((s: any) => s.id), [group]);
  const { data: counts } = useSessionCounts(ids);

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
  const ranked = standings(group.students, counts ?? new Map());
  const openStudent = group.students.find((s: any) => s.id === openId) ?? null;

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
            {classWhen(batch)} · {group.students.length} student{group.students.length === 1 ? "" : "s"}
          </p>
        </header>

        <Tabs defaultValue="students">
          <TabsList>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="course">Course</TabsTrigger>
            <TabsTrigger value="full">Full course</TabsTrigger>
          </TabsList>

          {/* The class side by side, most sessions first. Tap a student for
              their practice, songs and attendance. */}
          <TabsContent value="students" className="pt-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-[1.25rem_1fr_auto_auto] sm:grid-cols-[1.25rem_1.4fr_auto_1fr_auto_auto] gap-3 sm:gap-4 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <div></div>
                <div>Student</div>
                <div className="w-8 text-right">Sessions</div>
                <div className="hidden sm:block">Last 14 days</div>
                <div className="hidden sm:block w-10 text-right">Attend</div>
                <div className="w-2.5"></div>
              </div>
              {ranked.length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">No students enrolled.</div>
              ) : (
                ranked.map((r) => (
                  <StudentRow
                    key={r.id}
                    student={group.students.find((s: any) => s.id === r.id)}
                    place={counts ? r.place : undefined}
                    sessions={counts ? r.sessions : undefined}
                    onOpen={() => setOpenStudent(r.id)}
                  />
                ))
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Sessions are the days each student has ticked as done, class days included. The dot is how
              settled they look: green, amber or red.
            </p>
          </TabsContent>

          <TabsContent value="course" className="pt-4 space-y-4">
            <CoursePanel batchId={batch.id} startDate={batch.semester_start ?? null} dayOfWeek={batch.day_of_week ?? null} instrumentName={batch.instruments?.name} />
            <ExtraSongsCard batchId={batch.id} instrument={toInstrument(batch.instruments?.name)} />
            <ClassPhotoCard batch={batch} />
            <PausePlanCard batchId={batch.id} />
          </TabsContent>

          {/* What the students are shown, all of it, nothing held back. */}
          <TabsContent value="full" className="pt-4">
            <FullCoursePanel batch={batch} />
          </TabsContent>
        </Tabs>
      </div>

      <StudentDetail student={openStudent} batch={batch} onClose={() => setOpenStudent(null)} />
    </section>
  );
}
