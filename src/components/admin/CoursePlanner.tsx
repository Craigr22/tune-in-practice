import { useEffect, useMemo, useState } from "react";
import {
  useCoursePlanDays,
  useCoursePlanSettings,
  useSaveCoursePlanDay,
  useSaveCoursePlanSettings,
  useAddPlanWeek,
  useDeletePlanWeek,
  daysForWeek,
  type CoursePlanDay,
} from "@/hooks/useCoursePlan";
import { useCourseVideos } from "@/hooks/useCourseVideos";
import { useCatalogSongs, type Instrument } from "@/hooks/useSongCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarDays, Plus, Trash2, Film, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const NO_SONG = "__none__";
const DAY_LABELS = ["Day 1", "Day 2", "Day 3"];

/** Editor for one practice day: song, three instructions, and its videos. */
function DayEditor({
  instrument,
  weekNumber,
  dayNumber,
  day,
}: {
  instrument: Instrument;
  weekNumber: number;
  dayNumber: number;
  day: CoursePlanDay | undefined;
}) {
  const songs = useCatalogSongs(instrument);
  const { data: videos = [] } = useCourseVideos(instrument);
  const save = useSaveCoursePlanDay(instrument);

  const [draft, setDraft] = useState({
    focus_song_id: day?.focus_song_id ?? "",
    warmup_instruction: day?.warmup_instruction ?? "",
    focus_instruction: day?.focus_instruction ?? "",
    bonus_instruction: day?.bonus_instruction ?? "",
    video_ids: day?.video_ids ?? ([] as string[]),
  });
  const [dirty, setDirty] = useState(false);

  // Re-sync when the row loads or changes underneath us.
  useEffect(() => {
    setDraft({
      focus_song_id: day?.focus_song_id ?? "",
      warmup_instruction: day?.warmup_instruction ?? "",
      focus_instruction: day?.focus_instruction ?? "",
      bonus_instruction: day?.bonus_instruction ?? "",
      video_ids: day?.video_ids ?? [],
    });
    setDirty(false);
  }, [day?.id, day?.updated_at]);

  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setDirty(true);
  };

  const toggleVideo = (id: string) => {
    const next = draft.video_ids.includes(id)
      ? draft.video_ids.filter((v) => v !== id)
      : [...draft.video_ids, id];
    set("video_ids", next);
  };

  const submit = async () => {
    try {
      await save.mutateAsync({
        week_number: weekNumber,
        day_number: dayNumber,
        focus_song_id: draft.focus_song_id || null,
        warmup_instruction: draft.warmup_instruction,
        focus_instruction: draft.focus_instruction,
        bonus_instruction: draft.bonus_instruction,
        video_ids: draft.video_ids,
      });
      setDirty(false);
      toast.success(`Week ${weekNumber} · ${DAY_LABELS[dayNumber - 1]} saved`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-sm">{DAY_LABELS[dayNumber - 1]}</div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs font-medium text-amber-600">Unsaved</span>}
          <Button size="sm" onClick={submit} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save day"}
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-xs">Focus song</Label>
        <Select
          value={draft.focus_song_id || NO_SONG}
          onValueChange={(v) => set("focus_song_id", v === NO_SONG ? "" : v)}
        >
          <SelectTrigger className="h-9"><SelectValue placeholder="Pick a song" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SONG}>— No specific song</SelectItem>
            {songs.filter((s) => s.id).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label className="text-xs">♪ Warm-up</Label>
          <Textarea
            rows={3}
            value={draft.warmup_instruction}
            onChange={(e) => set("warmup_instruction", e.target.value)}
            placeholder="Tune up, then…"
          />
        </div>
        <div>
          <Label className="text-xs">🎯 Focus</Label>
          <Textarea
            rows={3}
            value={draft.focus_instruction}
            onChange={(e) => set("focus_instruction", e.target.value)}
            placeholder="What they practise today"
          />
        </div>
        <div>
          <Label className="text-xs">🎁 Bonus</Label>
          <Textarea
            rows={3}
            value={draft.bonus_instruction}
            onChange={(e) => set("bonus_instruction", e.target.value)}
            placeholder="Something fun to finish"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs flex items-center gap-1">
          <Film className="w-3 h-3" /> Lessons shown this day
          {draft.video_ids.length > 0 && (
            <span className="ml-1 text-muted-foreground">({draft.video_ids.length} selected)</span>
          )}
        </Label>
        {videos.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-1">
            No videos uploaded yet — add them in Course videos below.
          </p>
        ) : (
          <div className="mt-1 max-h-44 overflow-y-auto rounded-md border divide-y">
            {videos.map((v) => {
              const on = draft.video_ids.includes(v.id);
              const order = draft.video_ids.indexOf(v.id) + 1;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggleVideo(v.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 ${on ? "bg-primary/5" : ""}`}
                >
                  <span
                    className="shrink-0 grid place-items-center rounded border text-[10px] font-bold"
                    style={{ width: 20, height: 20, background: on ? "var(--navy)" : "transparent", color: on ? "#fff" : "var(--ink-faint)" }}
                  >
                    {on ? order : ""}
                  </span>
                  <span className="truncate">{v.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function WeekBlock({
  instrument,
  weekNumber,
  days,
  startDate,
}: {
  instrument: Instrument;
  weekNumber: number;
  days: CoursePlanDay[];
  startDate: string | null;
}) {
  const [open, setOpen] = useState(weekNumber === 1);
  const [confirmDel, setConfirmDel] = useState(false);
  const save = useSaveCoursePlanDay(instrument);
  const delWeek = useDeletePlanWeek(instrument);
  const day1 = days.find((d) => d.day_number === 1);
  const [topic, setTopic] = useState(day1?.class_topic ?? "");

  useEffect(() => setTopic(day1?.class_topic ?? ""), [day1?.id, day1?.class_topic]);

  const weekDates = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate);
    start.setDate(start.getDate() + (weekNumber - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    return `${f(start)} – ${f(end)}`;
  }, [startDate, weekNumber]);

  const saveTopic = async () => {
    try {
      await save.mutateAsync({ week_number: weekNumber, day_number: 1, class_topic: topic });
      toast.success("Class topic saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    }
  };

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-medium text-sm">Week {weekNumber}</span>
          {weekDates && <span className="text-xs text-muted-foreground">{weekDates}</span>}
        </button>
        <Button variant="ghost" size="icon" title="Delete week" onClick={() => setConfirmDel(true)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          <div>
            <Label className="text-xs">What class covered this week</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. C and F chords, how to tune"
              />
              <Button variant="outline" onClick={saveTopic} disabled={save.isPending}>Save</Button>
            </div>
          </div>

          {[1, 2, 3].map((n) => (
            <DayEditor
              key={n}
              instrument={instrument}
              weekNumber={weekNumber}
              dayNumber={n}
              day={days.find((d) => d.day_number === n)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete week {weekNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes all three planned days. Students whose plans were already generated for that
              week keep them until those plans are cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={async () => {
                try {
                  await delWeek.mutateAsync(weekNumber);
                  toast.success(`Week ${weekNumber} deleted`);
                } catch (e: any) {
                  toast.error(e.message ?? "Failed to delete");
                }
                setConfirmDel(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CoursePlanner({ instrument }: { instrument: Instrument }) {
  const { data: days = [], isLoading } = useCoursePlanDays(instrument);
  const { data: settings } = useCoursePlanSettings(instrument);
  const saveSettings = useSaveCoursePlanSettings(instrument);
  const addWeek = useAddPlanWeek(instrument);

  const [startDate, setStartDate] = useState("");
  useEffect(() => setStartDate(settings?.week_one_start ?? ""), [settings?.week_one_start]);

  const weeks = useMemo(
    () => [...new Set(days.map((d) => d.week_number))].sort((a, b) => a - b),
    [days],
  );

  const saveStart = async () => {
    try {
      await saveSettings.mutateAsync({ week_one_start: startDate || null });
      toast.success("Course start saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    }
  };

  if (isLoading) return <div className="text-sm">Loading course plan…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="font-medium text-sm flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> Course plan
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Plan each week's three practice days — the instructions students follow and the lessons
          they see that day. Students' weekly plans are built from this.
        </p>
        <div className="mt-3 flex items-end gap-2 flex-wrap">
          <div>
            <Label className="text-xs">Week 1 starts (Monday)</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Button variant="outline" onClick={saveStart} disabled={saveSettings.isPending}>
            Save start date
          </Button>
          <span className="text-xs text-muted-foreground ml-1">
            {settings?.week_one_start
              ? `Plan runs from ${settings.week_one_start} for ${weeks.length} week${weeks.length === 1 ? "" : "s"}.`
              : "Set a start date so the plan reaches students."}
          </span>
        </div>
      </div>

      {weeks.map((w) => (
        <WeekBlock
          key={w}
          instrument={instrument}
          weekNumber={w}
          days={daysForWeek(days, w)}
          startDate={settings?.week_one_start ?? null}
        />
      ))}

      <Button
        variant="outline"
        onClick={async () => {
          const next = (weeks[weeks.length - 1] ?? 0) + 1;
          try {
            await addWeek.mutateAsync(next);
            toast.success(`Week ${next} added`);
          } catch (e: any) {
            toast.error(e.message ?? "Failed to add week");
          }
        }}
        disabled={addWeek.isPending}
      >
        <Plus className="w-4 h-4 mr-1" /> Add week {(weeks[weeks.length - 1] ?? 0) + 1}
      </Button>
    </div>
  );
}
