import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserMinus, RotateCcw } from "lucide-react";
import { LEAVE_REASONS } from "@/lib/attrition";
import { useDeregister, useReenrol, useRemoveEnrolment } from "@/hooks/useAttrition";
import { toLocalIso } from "@/lib/date";

const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function BatchDetailDialog({ batchId, onClose }: { batchId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState("");
  // The student being de-registered, and the reason being chosen for it.
  const [leaving, setLeaving] = useState<any | null>(null);
  const [reason, setReason] = useState<string>(LEAVE_REASONS[0]);
  const [leftOn, setLeftOn] = useState(toLocalIso());
  const deregister = useDeregister();
  const reenrol = useReenrol();
  const removeEnrolment = useRemoveEnrolment();

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
        .select("*, students(id, name, email)")
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

  // In the class now, and those who have left it. A de-registered student
  // keeps their enrolment — that is the record of them having been here.
  const current = enrollments.filter((e: any) => e.status !== "dropped");
  const gone = enrollments.filter((e: any) => e.status === "dropped");
  const enrolledIds = new Set(enrollments.map((e: any) => e.student_id));
  const available = students.filter((s: any) => !enrolledIds.has(s.id));

  const cap = (batch as any)?.max_students ?? 0;
  const atCapacity = cap > 0 && current.length >= cap;

  const enroll = async (studentId: string) => {
    const { error } = await supabase.from("enrollments").insert({ batch_id: batchId!, student_id: studentId });
    if (error) return toast.error(error.message);
    toast.success(atCapacity ? "Enrolled (class is now over capacity)" : "Student enrolled");
    setAdding("");
    qc.invalidateQueries({ queryKey: ["batch-enrollments", batchId] });
    qc.invalidateQueries({ queryKey: ["batch-list"] });
  };

  const startLeaving = (e: any) => {
    setLeaving(e);
    setReason(LEAVE_REASONS[0]);
    setLeftOn(toLocalIso());
  };

  const confirmLeaving = async () => {
    if (!leaving) return;
    try {
      await deregister.mutateAsync({ enrolmentId: leaving.id, reason, leftOn });
      toast.success(`${leaving.students?.name ?? "Student"} de-registered — they no longer see this course`);
      setLeaving(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't de-register");
    }
  };

  // For someone added by mistake: no enrolment is kept, so nothing is counted.
  const removeMistake = async () => {
    if (!leaving) return;
    try {
      await removeEnrolment.mutateAsync(leaving.id);
      toast.success("Removed — not counted as having left");
      setLeaving(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove");
    }
  };

  const bringBack = async (e: any) => {
    try {
      await reenrol.mutateAsync(e.id);
      toast.success(`${e.students?.name ?? "Student"} is back in the class`);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't re-enrol");
    }
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
            <div className="text-xs text-muted-foreground -mt-2">
              {DOW_FULL[(batch as any).day_of_week] ?? "—"}s at {((batch as any).start_time ?? "").slice(0, 5)} ·
              starts {(batch as any).semester_start ?? "—"} — edit the class to change either.
            </div>

            <div>
              <div className="font-medium mb-2">
                Enrolled students ({current.length}{cap > 0 ? ` / ${cap}` : ""})
                {atCapacity && <span className="ml-2 text-xs text-amber-600">at capacity</span>}
              </div>
              <div className="space-y-1">
                {current.length === 0 && <div className="text-muted-foreground">No students yet.</div>}
                {current.map((e: any) => (
                  <div key={e.id} className="border rounded px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate">{e.students?.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{e.students?.email}</div>
                      </div>
                      {leaving?.id !== e.id && (
                        <Button variant="ghost" size="sm" onClick={() => startLeaving(e)} title="De-register from this class">
                          <UserMinus className="w-4 h-4 mr-1" /> De-register
                        </Button>
                      )}
                    </div>

                    {leaving?.id === e.id && (
                      <div className="mt-2 pt-2 border-t space-y-2">
                        <p className="text-xs text-muted-foreground">
                          They stop seeing this course straight away, and the class records that they left.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs">
                            <span className="text-muted-foreground">Why</span>
                            <select
                              value={reason}
                              onChange={(ev) => setReason(ev.target.value)}
                              className="mt-1 w-full border rounded-md h-9 px-2 bg-background text-sm"
                            >
                              {LEAVE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </label>
                          <label className="text-xs">
                            <span className="text-muted-foreground">Left on</span>
                            <input
                              type="date"
                              value={leftOn}
                              max={toLocalIso()}
                              onChange={(ev) => setLeftOn(ev.target.value)}
                              className="mt-1 w-full border rounded-md h-9 px-2 bg-background text-sm"
                            />
                          </label>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" onClick={confirmLeaving} disabled={deregister.isPending}>
                            {deregister.isPending ? "Saving…" : "De-register"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setLeaving(null)}>Cancel</Button>
                          <button
                            type="button"
                            onClick={removeMistake}
                            disabled={removeEnrolment.isPending}
                            className="ml-auto text-xs underline text-muted-foreground"
                          >
                            Added by mistake — remove without counting
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {gone.length > 0 && (
              <div>
                <div className="font-medium mb-2">
                  Left this class ({gone.length})
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {Math.round((gone.length / (gone.length + current.length)) * 100)}% attrition
                  </span>
                </div>
                <div className="space-y-1">
                  {gone.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 border rounded px-3 py-2 bg-muted/30">
                      <div className="min-w-0">
                        <div className="truncate text-muted-foreground">{e.students?.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[e.left_on ? `Left ${e.left_on}` : null, e.leave_reason].filter(Boolean).join(" · ") || "No date or reason recorded"}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => bringBack(e)} disabled={reenrol.isPending} title="Put them back in this class">
                        <RotateCcw className="w-4 h-4 mr-1" /> Re-enrol
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
