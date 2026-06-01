import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useTeachers } from "@/hooks/useTeachers";
import { useSaveBatch, findTeacherClashes, type BatchInput } from "@/hooks/useBatches";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type BatchRow = {
  id: string;
  teacher_id: string | null;
  instrument_id: string;
  location_id: string;
  day_of_week: number;
  start_time: string;
  duration_min: number;
  max_students: number | null;
  semester_start: string | null;
  semester_end: string | null;
};

const blank = {
  teacher_id: "",
  instrument_id: "",
  location_id: "",
  day_of_week: "1",
  start_time: "17:00",
  duration_min: "60",
  max_students: "8",
  semester_start: new Date().toISOString().slice(0, 10),
  semester_end: "",
};

export default function BatchFormDialog({
  open,
  onClose,
  batch,
}: {
  open: boolean;
  onClose: () => void;
  batch?: BatchRow | null;
}) {
  const editing = !!batch;
  const save = useSaveBatch();
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

  const [form, setForm] = useState(blank);
  const [clashes, setClashes] = useState<any[]>([]);
  const syncKey = useRef<string | null>(null);

  // Populate form when the dialog opens (or the target batch changes).
  if (open) {
    const key = batch?.id ?? "new";
    if (syncKey.current !== key) {
      syncKey.current = key;
      setClashes([]);
      setForm(
        batch
          ? {
              teacher_id: batch.teacher_id ?? "",
              instrument_id: batch.instrument_id,
              location_id: batch.location_id,
              day_of_week: String(batch.day_of_week),
              start_time: (batch.start_time || "17:00:00").slice(0, 5),
              duration_min: String(batch.duration_min ?? 60),
              max_students: String(batch.max_students ?? 8),
              semester_start: batch.semester_start ?? new Date().toISOString().slice(0, 10),
              semester_end: batch.semester_end ?? "",
            }
          : blank,
      );
    }
  } else if (syncKey.current !== null) {
    syncKey.current = null;
  }

  // Re-check teacher double-booking whenever the relevant fields change.
  useEffect(() => {
    if (!open || !form.teacher_id) {
      setClashes([]);
      return;
    }
    let cancelled = false;
    findTeacherClashes(
      form.teacher_id,
      Number(form.day_of_week),
      form.start_time + ":00",
      Number(form.duration_min || 60),
      batch?.id,
    )
      .then((c) => !cancelled && setClashes(c))
      .catch(() => !cancelled && setClashes([]));
    return () => {
      cancelled = true;
    };
  }, [open, form.teacher_id, form.day_of_week, form.start_time, form.duration_min, batch?.id]);

  const submit = async () => {
    if (!form.teacher_id || !form.instrument_id || !form.location_id) {
      return toast.error("Teacher, instrument, and location are required");
    }
    const payload: BatchInput & { id?: string } = {
      id: batch?.id,
      teacher_id: form.teacher_id,
      instrument_id: form.instrument_id,
      location_id: form.location_id,
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time + ":00",
      duration_min: Number(form.duration_min),
      max_students: Number(form.max_students || 0),
      semester_start: form.semester_start,
      semester_end: form.semester_end || null,
    };
    try {
      await save.mutateAsync(payload);
      toast.success(editing ? "Class updated" : "Class created and sessions generated");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save class");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit class" : "New class"}</DialogTitle>
        </DialogHeader>
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
            <Label>Capacity (max students)</Label>
            <Input type="number" min="1" value={form.max_students} onChange={(e) => setForm({ ...form, max_students: e.target.value })} />
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

        {clashes.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              This teacher already has {clashes.length === 1 ? "a class" : `${clashes.length} classes`} that overlap
              {" "}{DOW[Number(form.day_of_week)]} at this time
              {clashes.map((c) => ` · ${c.instruments?.name ?? "Class"}${c.locations?.name ? ` (${c.locations.name})` : ""}`).join("")}.
              You can still save if this is intentional.
            </div>
          </div>
        )}

        {editing && (
          <p className="text-xs text-muted-foreground">
            Changing the day or time updates the class details and the calendar, but won’t move sessions that were
            already generated.
          </p>
        )}

        <DialogFooter>
          <button className="px-3 py-2 text-sm rounded-md border hover:bg-muted" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button
            className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            onClick={submit}
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Create class"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
