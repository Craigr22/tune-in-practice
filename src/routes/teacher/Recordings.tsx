import { useState } from "react";
import { usePendingRecordings, useSubmitRecordingFeedback } from "@/hooks/useRecordings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BADGE_LIST } from "@/lib/badges";
import { SONGS } from "@/data/songs";
import { toast } from "sonner";

interface DraftState { comment: string; badge: number; song: string }

export default function Recordings() {
  const { data: items = [], isLoading } = usePendingRecordings();
  const submit = useSubmitRecordingFeedback();
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});

  const draft = (id: string, initialSong: string) =>
    drafts[id] ?? { comment: "", badge: 3, song: initialSong };

  const update = (id: string, partial: Partial<DraftState>, initial: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...draft(id, initial), ...partial } }));

  return (
    <section className="view view-teacher active">
      <div className="teacher-view">
        <header className="teacher-header">
          <h1 className="teacher-title">Recordings to review</h1>
          <div className="teacher-eyebrow">{items.length} pending · oldest first</div>
        </header>

        {isLoading && <div className="p-4 text-sm">Loading…</div>}
        {!isLoading && items.length === 0 && (
          <div className="teacher-class p-6 text-center text-sm text-muted-foreground">
            Nothing in the queue. 🎉
          </div>
        )}

        <div className="space-y-4">
          {items.map((it: any) => {
            const d = draft(it.id, it.song_id ?? SONGS[0].id);
            return (
              <div key={it.id} className="teacher-class p-4 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold">{it.students?.name ?? "Student"}</div>
                    <div className="text-xs text-muted-foreground">
                      Submitted {it.submitted_at ? new Date(it.submitted_at).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <select
                    className="border rounded-md p-1 text-sm bg-background"
                    value={d.song}
                    onChange={(e) => update(it.id, { song: e.target.value }, it.song_id ?? SONGS[0].id)}
                  >
                    {SONGS.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>
                <audio controls src={it.recording_url} className="w-full" />
                <Textarea
                  placeholder="Comment for the student…"
                  value={d.comment}
                  onChange={(e) => update(it.id, { comment: e.target.value }, it.song_id ?? SONGS[0].id)}
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex gap-1">
                    {BADGE_LIST.map((b) => (
                      <button
                        key={b.level}
                        onClick={() => update(it.id, { badge: b.level }, it.song_id ?? SONGS[0].id)}
                        className={`px-2 py-1 rounded-md border text-sm ${d.badge === b.level ? "border-primary bg-primary/10" : ""}`}
                        title={b.name}
                      >
                        {b.emoji}
                      </button>
                    ))}
                  </div>
                  <Button
                    disabled={submit.isPending}
                    onClick={async () => {
                      try {
                        await submit.mutateAsync({
                          attendanceId: it.id,
                          studentId: it.student_id,
                          songId: d.song,
                          comment: d.comment,
                          teacherBadge: d.badge,
                        });
                        toast.success("Feedback sent");
                      } catch (e: any) {
                        toast.error(e?.message ?? "Failed");
                      }
                    }}
                  >
                    Send feedback
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
