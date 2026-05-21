import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBatchRoster } from "@/hooks/useTeacherToday";
import { useEndClass, type AttendanceEntry, type BadgeUpdate } from "@/hooks/useEndClass";
import { BADGE_LIST } from "@/lib/badges";
import { SONGS } from "@/data/songs";
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
  const [badgeUpdates, setBadgeUpdates] = useState<Record<string, BadgeUpdate>>({});
  const [pickerStudent, setPickerStudent] = useState<string | null>(null);
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
        badgeUpdates: Object.values(badgeUpdates),
      });
      toast.success("Class wrapped up");
      onOpenChange(false);
      setMode("attendance");
      setAttendance({});
      setNotes("");
      setBadgeUpdates({});
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
            <div>
              <div className="text-sm font-medium mb-2">Per-student badge update (optional)</div>
              <div className="space-y-2">
                {roster.map((s: any) => {
                  const upd = badgeUpdates[s.id];
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-md border p-2">
                      <div className="text-sm">{s.name}</div>
                      <div className="flex items-center gap-2">
                        {upd && (
                          <span className="text-xs text-muted-foreground">
                            {SONGS.find((g) => g.id === upd.song_id)?.title} · {BADGE_LIST[upd.teacher_badge - 1].emoji}
                          </span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setPickerStudent(s.id)}>
                          {upd ? "Edit" : "Set badge"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
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

        {/* Badge picker sub-dialog */}
        <Dialog open={!!pickerStudent} onOpenChange={(o) => !o && setPickerStudent(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pick song & badge</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <select
                className="w-full border rounded-md p-2 bg-background"
                value={pickerStudent ? badgeUpdates[pickerStudent]?.song_id ?? "" : ""}
                onChange={(e) => {
                  if (!pickerStudent) return;
                  setBadgeUpdates((b) => ({
                    ...b,
                    [pickerStudent]: {
                      student_id: pickerStudent,
                      song_id: e.target.value,
                      teacher_badge: b[pickerStudent]?.teacher_badge ?? 1,
                    },
                  }));
                }}
              >
                <option value="">Select song…</option>
                {SONGS.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <div className="grid grid-cols-5 gap-2">
                {BADGE_LIST.map((b) => {
                  const current = pickerStudent ? badgeUpdates[pickerStudent] : undefined;
                  const selected = current?.teacher_badge === b.level;
                  return (
                    <button
                      key={b.level}
                      className={`flex flex-col items-center rounded-md border p-2 text-xs ${selected ? "border-primary bg-primary/10" : ""}`}
                      onClick={() => {
                        if (!pickerStudent) return;
                        const cur = badgeUpdates[pickerStudent];
                        if (!cur?.song_id) { toast.error("Pick a song first"); return; }
                        setBadgeUpdates((bs) => ({
                          ...bs,
                          [pickerStudent]: { ...cur, teacher_badge: b.level },
                        }));
                      }}
                    >
                      <span className="text-2xl">{b.emoji}</span>
                      <span>{b.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setPickerStudent(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
