import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarOff, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  useBatchPlanShifts,
  usePlanShiftsAvailable,
  useAddPlanShift,
  useUndoPlanShift,
  totalShiftWeeks,
} from "@/hooks/useBatchPlanShift";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * When a lesson doesn't happen, the course waits.
 *
 * Teachers can't change the plan — that's the admin's — but they're the ones
 * who know a class was cancelled, and until now the app carried on regardless:
 * students were shown next week's material for a lesson they never had.
 *
 * Pausing pushes this class's course back a week without touching its start
 * date, so past practice stays as it was and only what's ahead moves.
 */
export default function PausePlanCard({ batchId }: { batchId: string }) {
  const { data: shifts = [] } = useBatchPlanShifts(batchId);
  const available = usePlanShiftsAvailable(batchId);
  const add = useAddPlanShift(batchId);
  const undo = useUndoPlanShift(batchId);
  const [reason, setReason] = useState("");
  const behind = totalShiftWeeks(shifts);

  const pause = async () => {
    try {
      await add.mutateAsync({ weeks: 1, reason });
      setReason("");
      toast.success("Course pushed back a week for this class");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't pause the course");
    }
  };

  return (
    <div className="rounded-lg border">
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="font-medium text-sm flex items-center gap-2">
          <CalendarOff className="w-4 h-4" /> A class didn't happen
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Push this class's course back a week. Its start date doesn't change, and practice
          already done stays as it was — only what's ahead moves.
        </p>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? e.g. Diwali, I was unwell"
            disabled={!available}
            className="h-9 text-sm flex-1 min-w-[200px]"
            onKeyDown={(e) => e.key === "Enter" && pause()}
          />
          <Button size="sm" onClick={pause} disabled={add.isPending || !available}>
            Push back a week
          </Button>
        </div>

        {!available && (
          <p className="text-xs text-muted-foreground">
            Available once the class-pause update has been applied to the database.
          </p>
        )}

        {behind > 0 && (
          <p className="text-sm">
            This class is{" "}
            <strong>
              {behind} week{behind === 1 ? "" : "s"}
            </strong>{" "}
            behind the calendar — which is right, if it has had {behind} fewer{" "}
            {behind === 1 ? "lesson" : "lessons"}.
          </p>
        )}

        {shifts.length > 0 && (
          <ul className="divide-y rounded-md border text-sm">
            {shifts.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 min-w-0 truncate">
                  {s.reason || "No reason given"}
                  <span className="text-muted-foreground"> · {fmt(s.created_at)}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {s.weeks > 0 ? `+${s.weeks}` : s.weeks} wk
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  title="Undo — the class did happen after all"
                  disabled={undo.isPending}
                  onClick={async () => {
                    try {
                      await undo.mutateAsync(s.id);
                      toast.success("Course moved back up");
                    } catch (e: any) {
                      toast.error(e.message ?? "Couldn't undo");
                    }
                  }}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
