import { useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTeacherStudents, useSessionCounts, standings } from "@/hooks/useTeacherStudents";
import { classWhen } from "@/lib/classLabel";
import { toInstrument } from "@/hooks/useBatchCoursework";
import { StudentRow, StudentDetail } from "@/components/teacher/StudentRoster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import PausePlanCard from "@/components/teacher/PausePlanCard";
import ClassPhotoCard from "@/components/teacher/ClassPhotoCard";
import ExtraSongsCard from "@/components/teacher/ExtraSongsCard";
import FullCourse from "@/components/teacher/FullCourse";
import BatchStatsStrip from "@/components/teacher/BatchStatsStrip";
import { useBatchStats } from "@/hooks/useBatchStats";
import { useBatchWeek, weekLabel } from "@/hooks/useBatchWeek";

/**
 * The course for this class: where it is, and the whole of it.
 *
 * Read-only. The plan is written once by admins in Course work and every
 * class follows it, so there is nothing to edit here — but all of it is open:
 * every week, every note and every clip, with the week this class is on
 * marked. Students get it a week at a time; their teacher shouldn't have to.
 */
function CoursePanel({ batch }: { batch: any }) {
  const w = useBatchWeek(batch);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="font-medium text-sm">{weekLabel(w)}</div>
        <p className="text-sm text-muted-foreground mt-1">
          {!w.start
            ? "An admin sets this class's start date in Schedule → Classes."
            : w.currentWeek && w.totalWeeks && w.currentWeek > w.totalWeeks
            ? "Students get generated practice until the plan is extended."
            : `Started ${w.start}${w.paused > 0 ? ` · paused ${w.paused} week${w.paused === 1 ? "" : "s"}` : ""}`}
        </p>
      </div>
      <FullCourse instrument={w.instrument} currentWeek={w.currentWeek} />
    </div>
  );
}

/** "Week 3 of 12" for a class, wherever it needs saying. */
export function BatchWeekLabel({ batch }: { batch: any }) {
  return <>{weekLabel(useBatchWeek(batch))}</>;
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
  const statBatches = useMemo(() => (group ? [{ ...group.batch, students: group.students }] : []), [group]);
  const { stats, loading: statsLoading } = useBatchStats(statBatches);

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
            {classWhen(batch)} · {group.students.length} student{group.students.length === 1 ? "" : "s"} ·{" "}
            <BatchWeekLabel batch={batch} />
          </p>
        </header>

        <div className="rounded-xl border overflow-hidden mb-4 [&>div]:border-b-0">
          <BatchStatsStrip stats={stats.get(batch.id)} loading={statsLoading} />
        </div>

        <Tabs defaultValue="students">
          <TabsList>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="course">Course</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>

          {/* The class side by side, most sessions first. Tap a student for
              their practice and songs. */}
          <TabsContent value="students" className="pt-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-[1.25rem_1fr_auto_auto] sm:grid-cols-[1.25rem_1.4fr_auto_1fr_auto] gap-3 sm:gap-4 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <div></div>
                <div>Student</div>
                <div className="w-8 text-right">Sessions</div>
                <div className="hidden sm:block">Last 14 days</div>
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

          <TabsContent value="course" className="pt-4">
            <CoursePanel batch={batch} />
          </TabsContent>

          {/* The things a teacher sets for this class, kept apart from the
              course they read. */}
          <TabsContent value="manage" className="pt-4 space-y-4">
            <ClassPhotoCard batch={batch} />
            <PausePlanCard batchId={batch.id} />
            <ExtraSongsCard batchId={batch.id} instrument={toInstrument(batch.instruments?.name)} />
          </TabsContent>
        </Tabs>
      </div>

      <StudentDetail student={openStudent} batch={batch} onClose={() => setOpenStudent(null)} />
    </section>
  );
}
