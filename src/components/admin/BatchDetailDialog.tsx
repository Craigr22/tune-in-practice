import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { X } from "lucide-react";

export default function BatchDetailDialog({ batchId, onClose }: { batchId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState("");

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

  const enroll = async (studentId: string) => {
    const { error } = await supabase.from("enrollments").insert({ batch_id: batchId!, student_id: studentId });
    if (error) return toast.error(error.message);
    toast.success("Student enrolled");
    setAdding("");
    qc.invalidateQueries({ queryKey: ["batch-enrollments", batchId] });
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
              {(batch as any).instruments?.name} · {(batch as any).teachers?.name} · {(batch as any).locations?.name}
            </div>
            <div>
              <div className="font-medium mb-2">Enrolled students ({enrollments.length})</div>
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
