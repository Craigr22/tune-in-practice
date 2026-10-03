import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBatchRoster } from "@/hooks/useTeacherToday";
import { useEndClass, type AttendanceEntry } from "@/hooks/useEndClass";
import { toast } from "sonner";

type Mode = "attendance" | "wrap";

export default function StartClassDialog({
  open,
  onOpenChange,
  batchId,
  sessionId,
  scheduledDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  batchId: string;
  sessionId: string | null;
  scheduledDate: string;
}) {
  const { data: roster = [] } = useBatchRoster(open ? batchId : undefined);
  const [mode, setMode] = useState<Mode>("attendance");
  const [attendance, setAttendance] = useState<Record<string, AttendanceEntry["status"]>>({});
  const [notes, setNotes] = useState("");
  const endClass = useEndClass();

  const setStatus = (id: string, status: AttendanceEntry["status"]) =>
    setAttendance((a) => ({ ...a, [id]: status }));

  const submit = async () => {
    try {
      await endClass.mutateAsync({
        batchId,
        sessionId,
        scheduledDate,
        teacherNotes: notes,
        attendance: roster.map((s: any) => ({
          student_id: s.id,
          status: attendance[s.id] ?? "absent",
        })),
        // Students grade their own songs now; nothing is sent from here.
        badgeUpdates: [],
      });
      toast.success("Class wrapped up");
      onOpenChange(false);
      setMode("attendance");
      setAttendance({});
      setNotes("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "attendance" ? "Attendance" : "End class"}</DialogTitle>
        </DialogHeader>

        {mode === "attendance" ? (
          <div className="space-y-2">
            {roster.length === 0 && <div className="text-sm text-muted-foreground">No students enrolled.</div>}
            {roster.map((s: any) => {
              const cur = attendance[s.id];
              return (
                <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="flex gap-2">
                    {(["present", "late", "absent"] as const).map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant={cur === st ? "default" : "outline"}
                        onClick={() => setStatus(s.id, st)}
                      >
                        {st[0].toUpperCase() + st.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Session notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you cover?" />
            </div>
          </div>
        )}

        <DialogFooter>
          {mode === "attendance" ? (
            <Button onClick={() => setMode("wrap")}>Next: end class</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMode("attendance")}>Back</Button>
              <Button onClick={submit} disabled={endClass.isPending}>
                {endClass.isPending ? "Saving…" : "End class"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
