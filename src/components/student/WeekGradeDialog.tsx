import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStudentSongs } from "@/hooks/useBatchCoursework";
import { useGradeSongs, useSongProgress } from "@/hooks/useStudentProgress";
import { takeLaterPrompt, useGradePrompt } from "@/hooks/useGradePrompt";
import { MASTERED_AT, songGrade } from "@/lib/grading";
import GradePicker from "@/components/student/GradePicker";

/**
 * "How did your songs go this week?"
 *
 * Opens when the student ticks the last session before their next class, and
 * asks only about the songs they practised. It never has to be answered:
 * "Later" puts it off once, and after that it is dropped.
 */
export default function WeekGradeDialog() {
  const { prompt, raise, close } = useGradePrompt();
  const catalog = useStudentSongs();
  const { data: progress = [] } = useSongProgress();
  const grade = useGradeSongs();
  const [picked, setPicked] = useState<Record<string, number>>({});

  // A prompt put off last time comes back once, on the next visit.
  useEffect(() => {
    const later = takeLaterPrompt();
    if (later?.songIds.length) raise(later, { second: true });
    // Once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setPicked({}), [prompt?.weekStart]);

  const songs = (prompt?.songIds ?? []).flatMap((id) => {
    const song = catalog.find((c) => c.id === id);
    return song ? [song] : [];
  });
  const open = !!prompt && songs.length > 0;
  const valueFor = (id: string) => picked[id] ?? songGrade(progress.find((p) => p.song_id === id));
  const chosen = songs.filter((s) => picked[s.id] != null);

  const save = async () => {
    try {
      await grade.mutateAsync(chosen.map((s) => ({ songId: s.id, grade: picked[s.id] })));
      const mastered = chosen.filter((s) => picked[s.id] >= MASTERED_AT).length;
      toast.success(mastered ? `Saved — ${mastered === 1 ? "that's a song" : `${mastered} songs`} mastered 🎉` : "Saved");
      close("saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save your grades");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close("later")}>
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: "var(--ink)" }}>That's the week done 🎉</DialogTitle>
          <DialogDescription>
            How {songs.length === 1 ? "is this song" : "are these songs"} going? Pick the line that sounds most like
            your playing right now — you can change it any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {songs.map((s) => (
            <div key={s.id}>
              <div className="mb-2 text-sm font-bold" style={{ color: "var(--ink)" }}>
                {s.title}
                <span className="ml-1.5 font-normal text-xs" style={{ color: "var(--ink-soft)" }}>{s.artist}</span>
              </div>
              <GradePicker
                value={valueFor(s.id)}
                disabled={grade.isPending}
                onChange={(level) => setPicked((p) => ({ ...p, [s.id]: level }))}
              />
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-end gap-3">
          <button onClick={() => close("later")} className="text-sm underline" style={{ color: "var(--ink-soft)" }}>
            Later
          </button>
          <button
            onClick={save}
            disabled={!chosen.length || grade.isPending}
            className="rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ background: "var(--navy)", color: "#fff" }}
          >
            {grade.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
