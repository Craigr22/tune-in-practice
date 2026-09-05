import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, Views, type Event } from "react-big-calendar";
import { useIsPhone } from "@/hooks/useIsPhone";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar.css";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useTeacherMe } from "@/hooks/useTeacherMe";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";
import StartClassDialog from "@/components/teacher/StartClassDialog";

const calendarFormats = {
  timeGutterFormat: (date: Date, _c: any, loc: any) => loc.format(date, "h a", _c),
  dayFormat: (date: Date, _c: any, loc: any) => loc.format(date, "EEE d", _c),
  weekdayFormat: (date: Date, _c: any, loc: any) => loc.format(date, "EEE", _c),
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }, _c: any, loc: any) =>
    `${loc.format(start, "h:mm", _c)}–${loc.format(end, "h:mm a", _c)}`,
};

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
  // A seven-column grid is unreadable on a phone; agenda lists the same
  // sessions as a scrollable list of days.
  const isPhone = useIsPhone();
  const [calView, setCalView] = useState<any>(isPhone ? Views.AGENDA : Views.WEEK);
  const isAgenda = calView === Views.AGENDA;
  useEffect(() => { setCalView(isPhone ? Views.AGENDA : Views.WEEK); }, [isPhone]);

  const { data: teacher } = useTeacherMe();
  const teacherId = teacher?.id;
  const [selected, setSelected] = useState<Row | null>(null);
  const [wrapSession, setWrapSession] = useState<Row | null>(null);

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
          <div className="text-xs text-muted-foreground">Your active classes — click a session to take attendance</div>
        </header>

        {isLoading && <div className="text-sm">Loading…</div>}

        <div className="bg-card rounded-lg p-3 border" style={{ height: isPhone ? 560 : 720 }}>
          <Calendar
            localizer={dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { "en-US": enUS } })}
            events={events}
            view={calView}
            onView={(v: any) => setCalView(v)}
            views={isPhone ? [Views.AGENDA, Views.DAY, Views.MONTH] : [Views.WEEK, Views.MONTH, Views.DAY]}
            length={30}
            formats={calendarFormats}
            min={new Date(0, 0, 0, 9, 0, 0)}
            max={new Date(0, 0, 0, 22, 0, 0)}
            scrollToTime={new Date(0, 0, 0, 10, 0, 0)}
            step={30}
            timeslots={2}
            dayLayoutAlgorithm="no-overlap"
            popup
            onSelectEvent={(ev) => setSelected((ev as any).resource)}
            eventPropGetter={(ev) => {
              const s = (ev as any).resource as Row;
              if (s.status === "cancelled") {
                return { style: { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", textDecoration: "line-through", border: "none" } };
              }
              if (s.status === "completed") {
                return { style: { background: "#10b981", color: "#fff", border: "none" } };
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
            {selected && selected.status !== "cancelled" && (
              <DialogFooter>
                <Button onClick={() => { setWrapSession(selected); setSelected(null); }}>
                  <ClipboardCheck className="w-4 h-4 mr-1" />
                  {selected.status === "completed" ? "Update attendance" : "Take attendance"}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {wrapSession && (
          <StartClassDialog
            open={!!wrapSession}
            onOpenChange={(o) => !o && setWrapSession(null)}
            batchId={wrapSession.batch_id}
            sessionId={wrapSession.id}
            scheduledDate={wrapSession.scheduled_date}
          />
        )}
      </div>
    </section>
  );
}
