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
import { useNavigate } from "react-router-dom";
import { calendarQueryRange, sessionDateTimes } from "@/lib/calendar";

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
  start_time: string | null;
  duration_min: number | null;
  batches: {
    id: string;
    code?: string | null;
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
  useEffect(() => { setCalView(isPhone ? Views.AGENDA : Views.WEEK); }, [isPhone]);

  const navigate = useNavigate();
  const { data: teacher } = useTeacherMe();
  const teacherId = teacher?.id;
  const [queryRange, setQueryRange] = useState(() => calendarQueryRange(null));

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["teacher-sessions", teacherId, queryRange.start, queryRange.end],
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
        .select("id, batch_id, scheduled_date, status, start_time, duration_min, batches!inner(id, code, start_time, duration_min, semester_start, semester_end, teacher_id, instruments(name), locations(name))")
        .in("batch_id", ids)
        .gte("scheduled_date", queryRange.start)
        .lte("scheduled_date", queryRange.end)
        .order("scheduled_date");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const events: Event[] = useMemo(() => sessions.map((s) => {
    const b = s.batches!;
    const { start, end } = sessionDateTimes(
      s.scheduled_date,
      s.start_time ?? b.start_time,
      s.duration_min ?? b.duration_min,
    );
    const title = [b.code, b.instruments?.name ?? "Class", b.locations?.name].filter(Boolean).join(" · ");
    return { title, start, end, resource: s };
  }), [sessions]);

  return (
    <section className="view view-teacher active">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <div className="text-xs text-muted-foreground">Tap a lesson to open its class.</div>
        </header>

        {isLoading && <div className="text-sm">Loading…</div>}

        <div className="bg-card rounded-lg p-3 border" style={{ height: isPhone ? 560 : 720 }}>
          <Calendar
            localizer={dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { "en-US": enUS } })}
            events={events}
            view={calView}
            onView={(v: any) => setCalView(v)}
            onRangeChange={(range: any) => setQueryRange(calendarQueryRange(range))}
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
            // A lesson opens its class — the same page as Open on My classes.
            onSelectEvent={(ev) => navigate(`/teacher/class/${((ev as any).resource as Row).batch_id}`)}
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
      </div>
    </section>
  );
}
