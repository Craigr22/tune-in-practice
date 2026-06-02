import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Calendar, dateFnsLocalizer, Views, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar.css";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { useBatchList, useSetBatchActive } from "@/hooks/useBatches";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Users, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import BatchDetailDialog from "@/components/admin/BatchDetailDialog";
import BatchFormDialog from "@/components/admin/BatchFormDialog";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// Nicer, less cluttered labels than the rbc defaults.
const calendarFormats = {
  timeGutterFormat: (date: Date, _c: any, loc: any) => loc.format(date, "h a", _c),
  dayFormat: (date: Date, _c: any, loc: any) => loc.format(date, "EEE d", _c),
  weekdayFormat: (date: Date, _c: any, loc: any) => loc.format(date, "EEE", _c),
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }, _c: any, loc: any) =>
    `${loc.format(start, "h:mm", _c)}–${loc.format(end, "h:mm a", _c)}`,
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Row = {
  id: string;
  batch_id: string;
  scheduled_date: string;
  status: string;
  batches: {
    id: string;
    start_time: string;
    duration_min: number;
    teacher_id: string | null;
    instrument_id: string;
    teachers: { name: string } | null;
    instruments: { name: string } | null;
  } | null;
};

export default function AdminSchedule() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"calendar" | "classes">("calendar");
  const [formBatch, setFormBatch] = useState<any | null | undefined>(undefined); // undefined = closed
  const [selectedSession, setSelectedSession] = useState<Row | null>(null);
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const setActive = useSetBatchActive();

  const { data: sessions = [] } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, batch_id, scheduled_date, status, batches!inner(id, start_time, duration_min, teacher_id, instrument_id, teachers(name), instruments(name))")
        .order("scheduled_date");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    enabled: role === "admin",
  });

  const { data: classes = [] } = useBatchList();

  const events: Event[] = useMemo(() => sessions.map((s) => {
    const b = s.batches!;
    const [h, m] = (b.start_time || "00:00:00").split(":").map(Number);
    const start = new Date(s.scheduled_date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + (b.duration_min || 60) * 60000);
    const title = `${b.instruments?.name ?? "Class"} · ${b.teachers?.name ?? "TBA"}`;
    return { title, start, end, resource: s };
  }), [sessions]);

  if (role !== "admin") return <Navigate to="/" replace />;

  const cancelSession = async (id: string) => {
    const { error } = await supabase.from("sessions").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Session cancelled");
    qc.invalidateQueries({ queryKey: ["admin-sessions"] });
    setSelectedSession(null);
  };

  const toggleArchive = (b: any) => {
    setActive.mutate(
      { id: b.id, is_active: !b.is_active },
      { onSuccess: () => toast.success(b.is_active ? "Class archived" : "Class restored") },
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-1.5 text-sm ${view === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView("classes")}
              className={`px-3 py-1.5 text-sm ${view === "classes" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Classes
            </button>
          </div>
          <Button onClick={() => setFormBatch(null)}><Plus className="w-4 h-4 mr-1" />New class</Button>
        </div>
      </div>

      {view === "calendar" && (
        <div className="bg-card rounded-lg p-3 border" style={{ height: 720 }}>
          <Calendar
            localizer={localizer}
            events={events}
            defaultView={Views.WEEK}
            views={[Views.WEEK, Views.MONTH, Views.DAY]}
            formats={calendarFormats}
            min={new Date(0, 0, 0, 9, 0, 0)}
            max={new Date(0, 0, 0, 22, 0, 0)}
            scrollToTime={new Date(0, 0, 0, 10, 0, 0)}
            step={30}
            timeslots={2}
            dayLayoutAlgorithm="no-overlap"
            popup
            onSelectEvent={(ev) => setSelectedSession((ev as any).resource)}
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
      )}

      {view === "classes" && (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Instrument</th>
                <th className="text-left p-3">Teacher</th>
                <th className="text-left p-3">Location</th>
                <th className="text-left p-3 w-44">Enrolled</th>
                <th className="text-right p-3 w-44">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((b: any) => {
                const cap = b.max_students ?? 0;
                const full = cap > 0 && b.enrolled >= cap;
                const over = cap > 0 && b.enrolled > cap;
                const pct = cap > 0 ? Math.min(100, Math.round((b.enrolled / cap) * 100)) : 0;
                return (
                  <tr key={b.id} className={`border-t ${!b.is_active ? "opacity-50" : ""}`}>
                    <td className="p-3">
                      <div className="font-medium">{DOW[b.day_of_week]} · {(b.start_time || "").slice(0, 5)}</div>
                      <div className="text-xs text-muted-foreground">{b.duration_min} min</div>
                    </td>
                    <td className="p-3">{b.instruments?.name ?? "—"}</td>
                    <td className="p-3">{b.teachers?.name ?? "TBA"}</td>
                    <td className="p-3 text-muted-foreground">{b.locations?.name ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${over ? "text-red-600" : full ? "text-amber-600" : ""}`}>
                          {b.enrolled}{cap > 0 ? ` / ${cap}` : ""}
                        </span>
                        {!b.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">archived</span>
                        )}
                      </div>
                      {cap > 0 && (
                        <div className="mt-1 h-1.5 w-28 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${over ? "bg-red-500" : full ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Manage students" onClick={() => setOpenBatch(b.id)}>
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Edit class" onClick={() => setFormBatch(b)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={b.is_active ? "Archive class" : "Restore class"}
                          onClick={() => toggleArchive(b)}
                        >
                          {b.is_active ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {classes.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No classes yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selectedSession} onOpenChange={(o) => !o && setSelectedSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-3 text-sm">
              <div>{selectedSession.batches?.instruments?.name} · {selectedSession.batches?.teachers?.name}</div>
              <div className="text-muted-foreground">
                {selectedSession.scheduled_date} · {selectedSession.batches?.start_time?.slice(0,5)}
              </div>
              <div>Status: <span className="font-medium">{selectedSession.status}</span></div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => { setOpenBatch(selectedSession.batch_id); setSelectedSession(null); }}>
                  Manage batch
                </Button>
                {selectedSession.status !== "cancelled" && (
                  <Button variant="destructive" onClick={() => cancelSession(selectedSession.id)}>
                    Cancel this session
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BatchFormDialog
        open={formBatch !== undefined}
        batch={formBatch ?? null}
        onClose={() => setFormBatch(undefined)}
      />

      <BatchDetailDialog batchId={openBatch} onClose={() => setOpenBatch(null)} />
    </div>
  );
}
