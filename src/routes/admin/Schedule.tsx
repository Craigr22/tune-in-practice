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
import { useTeachers } from "@/hooks/useTeachers";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import BatchDetailDialog from "@/components/admin/BatchDetailDialog";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

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
  const [openNew, setOpenNew] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Row | null>(null);
  const [openBatch, setOpenBatch] = useState<string | null>(null);

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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" />New Batch</Button>
          </DialogTrigger>
          <NewBatchDialog onClose={() => setOpenNew(false)} />
        </Dialog>
      </div>

      <div className="bg-card rounded-lg p-3 border" style={{ height: 720 }}>
        <Calendar
          localizer={localizer}
          events={events}
          defaultView={Views.MONTH}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          min={new Date(0, 0, 0, 9, 0, 0)}
          max={new Date(0, 0, 0, 23, 0, 0)}
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

      <BatchDetailDialog batchId={openBatch} onClose={() => setOpenBatch(null)} />
    </div>
  );
}

function NewBatchDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: teachers = [] } = useTeachers();
  const { data: instruments = [] } = useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("instruments").select("*").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    teacher_id: "",
    instrument_id: "",
    location_id: "",
    day_of_week: "1",
    start_time: "17:00",
    duration_min: "60",
    semester_start: new Date().toISOString().slice(0, 10),
    semester_end: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.teacher_id || !form.instrument_id || !form.location_id) {
      return toast.error("Teacher, instrument, and location are required");
    }
    setSaving(true);
    const { error } = await supabase.from("batches").insert({
      teacher_id: form.teacher_id,
      instrument_id: form.instrument_id,
      location_id: form.location_id,
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time + ":00",
      duration_min: Number(form.duration_min),
      semester_start: form.semester_start,
      semester_end: form.semester_end || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Batch created and sessions generated");
    qc.invalidateQueries({ queryKey: ["admin-sessions"] });
    qc.invalidateQueries({ queryKey: ["batches"] });
    onClose();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New batch</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Teacher</Label>
          <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
            <SelectContent>
              {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Instrument</Label>
          <Select value={form.instrument_id} onValueChange={(v) => setForm({ ...form, instrument_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {instruments.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Location</Label>
          <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Day of week</Label>
          <Select value={form.day_of_week} onValueChange={(v) => setForm({ ...form, day_of_week: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOW.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Start time</Label>
          <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
        </div>
        <div>
          <Label>Duration (min)</Label>
          <Input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
        </div>
        <div>
          <Label>Start date</Label>
          <Input type="date" value={form.semester_start} onChange={(e) => setForm({ ...form, semester_start: e.target.value })} />
        </div>
        <div>
          <Label>End date (optional)</Label>
          <Input type="date" value={form.semester_end} onChange={(e) => setForm({ ...form, semester_end: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create batch"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
