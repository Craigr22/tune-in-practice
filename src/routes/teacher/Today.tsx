import { useState } from "react";
import { useTeacherToday } from "@/hooks/useTeacherToday";
import { Button } from "@/components/ui/button";
import StartClassDialog from "@/components/teacher/StartClassDialog";

export default function Today() {
  const { data: batches = [], isLoading } = useTeacherToday();
  const [active, setActive] = useState<{ batchId: string; sessionId: string | null } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="view view-teacher active">
      <div className="teacher-view">
        <header className="teacher-header">
          <div>
            <div className="teacher-eyebrow">Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
            <h1 className="teacher-title">Today's classes</h1>
          </div>
        </header>

        <div className="teacher-class">
          {isLoading && <div className="p-4 text-sm">Loading…</div>}
          {!isLoading && batches.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No classes scheduled for today.</div>
          )}
          <div className="divide-y">
            {batches.map((b: any) => {
              const completed = b.session?.status === "completed";
              return (
                <div key={b.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="font-semibold">{b.start_time?.slice(0, 5)} · {b.locations?.name ?? "—"}</div>
                    <div className="text-sm text-muted-foreground">
                      {b.instruments?.name} · {b.studentCount} student{b.studentCount === 1 ? "" : "s"} · {b.duration_min}min
                    </div>
                  </div>
                  <Button
                    disabled={completed}
                    onClick={() => setActive({ batchId: b.id, sessionId: b.session?.id ?? null })}
                  >
                    {completed ? "Completed ✓" : "Start class"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {active && (
        <StartClassDialog
          open
          onOpenChange={(o) => !o && setActive(null)}
          batchId={active.batchId}
          sessionId={active.sessionId}
          scheduledDate={today}
        />
      )}
    </section>
  );
}
