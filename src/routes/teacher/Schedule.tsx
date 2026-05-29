import { useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, Views, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar.css";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useTeacherMe } from "@/hooks/useTeacherMe";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Row = {
  id: string;
  batch_id: string;
  scheduled_date: string;
  status: string;
  batches: {
    id: string;
    start_time: string;
    duration_min: number;
    semester_start: string | null;
    semester_end: string | null;
    teacher_id: string | null;
    instruments: { name: string } | null;
    locations: { name: string } | null;
  } | null;
};

export default function TeacherSchedule() {
  const { data: teacher } = useTeacherMe();
  const teacherId = teacher?.id;
  const [selected, setSelected] = useState<Row | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["teacher-sessions", teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const { data: batches } = await supabase
        .from("batches")
        .select("id")
        .eq("teacher_id", teacherId!)
        .eq("is_active", true);
      const ids = (batches ?? []).map((b) => b.id);
      if (!ids.length) return [] as Row[];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, batch_id, scheduled_date, status, batches!inner(id, start_time, duration_min, semester_start, semester_end, teacher_id, instruments(name), locations(name))")
        .in("batch_id", ids)
        .order("scheduled_date");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const events: Event[] = useMemo(() => sessions.map((s) => {
    const b = s.batches!;
    const [h, m] = (b.start_time || "00:00:00").split(":").map(Number);
    const start = new Date(s.scheduled_date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + (b.duration_min || 60) * 60000);
    const title = `${b.instruments?.name ?? "Class"} · ${b.locations?.name ?? ""}`;
    return { title, start, end, resource: s };
  }), [sessions]);

  return (
    <section className="view view-teacher active">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <div className="text-xs text-muted-foreground">Your assigned classes</div>
        </header>

        {isLoading && <div className="text-sm">Loading…</div>}

        <div className="bg-card rounded-lg p-3 border" style={{ height: 720 }}>
          <Calendar
            localizer={dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { "en-US": enUS } })}
            events={events}
            defaultView={Views.MONTH}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            onSelectEvent={(ev) => setSelected((ev as any).resource)}
            eventPropGetter={(ev) => {
              const s = (ev as any).resource as Row;
              if (s.status === "cancelled") {
                return { style: { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", textDecoration: "line-through", border: "none" } };
              }
              return { style: { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", border: "none" } };
            }}
            style={{ height: "100%" }}
          />
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Session</DialogTitle></DialogHeader>
            {selected && (
              <div className="space-y-2 text-sm">
                <div className="font-medium">{selected.batches?.instruments?.name} · {selected.batches?.locations?.name}</div>
                <div className="text-muted-foreground">
                  {selected.scheduled_date} · {selected.batches?.start_time?.slice(0, 5)} · {selected.batches?.duration_min}min
                </div>
                <div>Status: <span className="font-medium">{selected.status}</span></div>
                <div className="text-xs text-muted-foreground pt-2">
                  Course: {selected.batches?.semester_start ?? "—"} → {selected.batches?.semester_end ?? "ongoing"} (admin-managed)
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
