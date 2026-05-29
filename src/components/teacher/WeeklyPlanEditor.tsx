import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { isoMonday } from "@/hooks/useWeeklyPlan";
import { SONGS } from "@/data/songs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

function addWeeks(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

const TYPE_LABELS = { build: "Build", flow: "Flow", stretch: "Stretch" } as const;

export default function WeeklyPlanEditor({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(isoMonday());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["wp-edit", studentId, weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_plan_sessions")
        .select("*")
        .eq("student_id", studentId)
        .eq("week_start", weekStart)
        .order("session_index");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [draft, setDraft] = useState<Record<string, any>>({});
  useEffect(() => {
    const d: Record<string, any> = {};
    for (const r of rows) d[r.id] = { ...r };
    setDraft(d);
  }, [rows]);

  const update = (id: string, patch: any) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const save = async (id: string) => {
    const r = draft[id];
    const { error } = await supabase
      .from("weekly_plan_sessions")
      .update({
        focus_song_id: r.focus_song_id,
        focus_instruction: r.focus_instruction,
        focus_target_min: Number(r.focus_target_min) || 0,
        warmup_song_id: r.warmup_song_id || null,
        warmup_instruction: r.warmup_instruction,
        warmup_target_min: Number(r.warmup_target_min) || 0,
        bonus_song_id: r.bonus_song_id || null,
        bonus_instruction: r.bonus_instruction,
        bonus_target_min: Number(r.bonus_target_min) || 0,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["wp-edit", studentId, weekStart] });
    qc.invalidateQueries({ queryKey: ["weekly-plan", studentId, weekStart] });
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Weekly plan</h3>
        <div className="flex items-center gap-2 text-xs">
          <Button size="icon" variant="ghost" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="tabular-nums">Week of {weekStart}</span>
          <Button size="icon" variant="ghost" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
      {!isLoading && rows.length === 0 && (
        <div className="text-xs text-muted-foreground border rounded p-3">
          No plan generated for this week yet. Plans auto-generate when the student opens the app.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r: any) => {
          const d = draft[r.id] ?? r;
          return (
            <div key={r.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-xs uppercase text-muted-foreground">
                  {TYPE_LABELS[r.session_type as keyof typeof TYPE_LABELS]} · {r.scheduled_date}
                </div>
                <Button size="sm" variant="outline" onClick={() => save(r.id)}>Save</Button>
              </div>

              {(["warmup", "focus", "bonus"] as const).map((seg) => (
                <div key={seg} className="grid grid-cols-[80px_1fr_70px] gap-2 items-end">
                  <div>
                    <Label className="text-[10px] uppercase">{seg}</Label>
                    <Select
                      value={d[`${seg}_song_id`] ?? ""}
                      onValueChange={(v) => update(r.id, { [`${seg}_song_id`]: v })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Song" /></SelectTrigger>
                      <SelectContent>
                        {seg !== "focus" && <SelectItem value="">—</SelectItem>}
                        {SONGS.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Instruction"
                    value={d[`${seg}_instruction`] ?? ""}
                    onChange={(e) => update(r.id, { [`${seg}_instruction`]: e.target.value })}
                  />
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    placeholder="min"
                    value={d[`${seg}_target_min`] ?? 0}
                    onChange={(e) => update(r.id, { [`${seg}_target_min`]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
