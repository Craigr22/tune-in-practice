import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useBatchSettings, useSaveCourseStart } from "@/hooks/useBatchCoursework";

export default function BatchDetailDialog({ batchId, onClose }: { batchId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState("");
  const { data: settings } = useBatchSettings(batchId ?? undefined);
  const saveCourseStart = useSaveCourseStart(batchId ?? "");
  const [courseStart, setCourseStart] = useState("");
  useEffect(() => setCourseStart(settings?.course_start_date ?? ""), [settings?.course_start_date]);

  const { data: batch } = useQuery({
    queryKey: ["batch", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select("*, teachers(name), instruments(name), locations(name)")
        .eq("id", batchId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["batch-enrollments", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, student_id, students(id, name, email)")
        .eq("batch_id", batchId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-all"],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const enrolledIds = new Set(enrollments.map((e: any) => e.student_id));
  const available = students.filter((s: any) => !enrolledIds.has(s.id));

  const cap = (batch as any)?.max_students ?? 0;
  const atCapacity = cap > 0 && enrollments.length >= cap;

  const enroll = async (studentId: string) => {
    const { error } = await supabase.from("enrollments").insert({ batch_id: batchId!, student_id: studentId });
    if (error) return toast.error(error.message);
    toast.success(atCapacity ? "Enrolled (class is now over capacity)" : "Student enrolled");
    setAdding("");
    qc.invalidateQueries({ queryKey: ["batch-enrollments", batchId] });
    qc.invalidateQueries({ queryKey: ["batch-list"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("enrollments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["batch-enrollments", batchId] });
  };

  return (
    <Dialog open={!!batchId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Batch details</DialogTitle></DialogHeader>
        {batch && (
          <div className="space-y-4 text-sm">
            <div className="text-muted-foreground">
              {(batch as any).code ? `${(batch as any).code} · ` : ""}{(batch as any).instruments?.name} · {(batch as any).teachers?.name} · {(batch as any).locations?.name}
            </div>

            {/* Starting a class on the course is an admin decision — it sets
                which week of the plan its students are on. */}
            <div className="rounded-md border p-3">
              <div className="font-medium">Course start</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                The week this class begins the course. Students get week 1 from this date.
              </p>
              <div className="flex items-end gap-2 mt-2">
                <Input
                  type="date"
                  value={courseStart}
                  onChange={(e) => setCourseStart(e.target.value)}
                  className="w-44"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saveCourseStart.isPending}
                  onClick={async () => {
                    try {
                      await saveCourseStart.mutateAsync(courseStart || null);
                      toast.success(courseStart ? "Course start saved" : "Course start cleared");
                    } catch (e: any) {
                      toast.error(e.message ?? "Failed to save");
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
            <div>
              <div className="font-medium mb-2">
                Enrolled students ({enrollments.length}{cap > 0 ? ` / ${cap}` : ""})
                {atCapacity && <span className="ml-2 text-xs text-amber-600">at capacity</span>}
              </div>
              <div className="space-y-1">
                {enrollments.length === 0 && <div className="text-muted-foreground">No students yet.</div>}
                {enrollments.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between border rounded px-3 py-2">
                    <div>
                      <div>{e.students?.name}</div>
                      <div className="text-xs text-muted-foreground">{e.students?.email}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove(e.id)}><X className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium mb-2">Enroll student</div>
              <Select value={adding} onValueChange={(v) => { setAdding(v); enroll(v); }}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {available.length === 0 && <div className="px-2 py-1 text-sm text-muted-foreground">All enrolled</div>}
                  {available.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
