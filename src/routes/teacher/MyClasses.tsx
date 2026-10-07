import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Music, ChevronRight } from "lucide-react";
import { useTeacherStudents, useSessionCounts, standings } from "@/hooks/useTeacherStudents";
import ClassStandings from "@/components/teacher/ClassStandings";
import { classWhen } from "@/lib/classLabel";

/**
 * A teacher's first page: their classes, and in each one every student with
 * the sessions they have finished. Who is keeping up is the thing a teacher
 * wants before a lesson, so it is here without opening anything.
 */
export default function MyClasses() {
  const { data: groups = [], isLoading } = useTeacherStudents();
  const navigate = useNavigate();
  const allIds = useMemo(() => groups.flatMap((g: any) => g.students.map((s: any) => s.id)), [groups]);
  const { data: counts, isLoading: counting } = useSessionCounts(allIds);

  return (
    <section className="view view-teacher active">
      <div className="teacher-view max-w-3xl mx-auto px-4 py-6">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold">My classes</h1>
          <p className="text-sm text-muted-foreground">Practice sessions each student has finished so far.</p>
        </header>

        {isLoading && <div className="text-sm">Loading…</div>}

        {!isLoading && groups.length === 0 && (
          <div className="border rounded-lg p-12 text-center text-muted-foreground">
            <Music className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-foreground">No active classes</p>
            <p className="text-sm mt-1">You aren’t assigned to any active classes yet.</p>
          </div>
        )}

        <div className="space-y-4">
          {groups.map((g: any) => {
            const open = (student?: string) =>
              navigate(`/teacher/class/${g.batch.id}${student ? `?student=${student}` : ""}`);
            return (
              <div key={g.batch.id} className="rounded-xl border bg-card overflow-hidden">
                <button
                  onClick={() => open()}
                  className="w-full text-left px-4 py-3 border-b bg-muted/30 hover:bg-muted/50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {g.batch.code && (
                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--paper-cool)", color: "var(--navy)" }}>
                          {g.batch.code}
                        </span>
                      )}
                      <span className="font-semibold truncate">
                        {g.batch.locations?.name} · {g.batch.instruments?.name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {classWhen(g.batch)} · {g.students.length} student{g.students.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium flex items-center gap-0.5" style={{ color: "var(--navy)" }}>
                    Open <ChevronRight className="w-4 h-4" />
                  </span>
                </button>
                <ClassStandings
                  rows={standings(g.students, counts ?? new Map())}
                  loading={counting || !counts}
                  onOpen={(id) => open(id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
