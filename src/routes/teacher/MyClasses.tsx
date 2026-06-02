import { useTeacherStudents } from "@/hooks/useTeacherStudents";
import { useNavigate } from "react-router-dom";
import { Music, ChevronRight, Users } from "lucide-react";

export default function MyClasses() {
  const { data: groups = [], isLoading } = useTeacherStudents();
  const navigate = useNavigate();

  return (
    <section className="view view-teacher active">
      <div className="teacher-view max-w-4xl mx-auto px-4 py-6">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold">My classes</h1>
          <p className="text-sm text-muted-foreground">
            Open a class to manage its coursework, ordering, and weekly practice load.
          </p>
        </header>

        {isLoading && <div className="text-sm">Loading…</div>}

        {!isLoading && groups.length === 0 && (
          <div className="border rounded-lg p-12 text-center text-muted-foreground">
            <Music className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-foreground">No active classes</p>
            <p className="text-sm mt-1">You aren’t assigned to any active classes yet.</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g: any) => (
            <button
              key={g.batch.id}
              onClick={() => navigate(`/teacher/class/${g.batch.id}`)}
              className="text-left rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors flex items-start justify-between gap-3"
            >
              <div>
                <div className="font-semibold">
                  {g.batch.locations?.name} · {g.batch.instruments?.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {g.students.length} student{g.students.length === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {g.batch.semester_start ?? "—"} → {g.batch.semester_end ?? "ongoing"}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
