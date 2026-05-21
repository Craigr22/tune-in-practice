import { useState } from "react";
import { useTeacherToday } from "@/hooks/useTeacherToday";
import { useNeedHelpItems, useAcknowledgeNeedHelp } from "@/hooks/useNeedHelp";
import { useSignedRecordingUrl } from "@/hooks/useSignedRecordingUrl";
import { Button } from "@/components/ui/button";
import StartClassDialog from "@/components/teacher/StartClassDialog";
import { SONGS } from "@/data/songs";

function NeedHelpRow({ item, onAck }: { item: any; onAck: () => void }) {
  const url = useSignedRecordingUrl(item.recording_url);
  const song = SONGS.find((s) => s.id === item.song_id);
  return (
    <div className="flex items-start gap-3 p-3 border-t first:border-t-0">
      <div className="flex-1">
        <div className="text-sm">
          <span className="font-semibold">{item.student_name}</span> · {song?.title ?? item.song_id}
        </div>
        <div className="text-xs text-muted-foreground">Practiced {item.played_on}</div>
        {url && <audio controls src={url} className="w-full mt-2" />}
      </div>
      <Button size="sm" variant="outline" onClick={onAck}>Acknowledge</Button>
    </div>
  );
}

export default function Today() {
  const { data: batches = [], isLoading } = useTeacherToday();
  const { data: needHelp = [] } = useNeedHelpItems();
  const ack = useAcknowledgeNeedHelp();
  const [active, setActive] = useState<{ batchId: string; sessionId: string | null } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="view view-teacher active">
      <div className="teacher-view">
        <header className="teacher-header">
          <div>
            <div className="teacher-eyebrow">Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
            <h1 className="teacher-title">Today's classes</h1>
          </div>
        </header>

        {needHelp.length > 0 && (
          <div className="rounded-xl border-2 border-red-500/40 bg-red-50/60 mb-4">
            <div className="p-3 flex items-center justify-between">
              <div className="font-semibold text-red-700">
                😅 Needs attention · {needHelp.length} student{needHelp.length === 1 ? "" : "s"} flagged "Need help"
              </div>
            </div>
            <div>
              {needHelp.map((it: any) => (
                <NeedHelpRow key={it.id} item={it} onAck={() => ack.mutate(it.id)} />
              ))}
            </div>
          </div>
        )}

        <div className="teacher-class">
          {isLoading && <div className="p-4 text-sm">Loading…</div>}
          {!isLoading && batches.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No classes scheduled for today.</div>
          )}
          <div className="divide-y">
            {batches.map((b: any) => {
              const completed = b.session?.status === "completed";
              return (
                <div key={b.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="font-semibold">{b.start_time?.slice(0, 5)} · {b.locations?.name ?? "—"}</div>
                    <div className="text-sm text-muted-foreground">
                      {b.instruments?.name} · {b.studentCount} student{b.studentCount === 1 ? "" : "s"} · {b.duration_min}min
                    </div>
                  </div>
                  <Button
                    disabled={completed}
                    onClick={() => setActive({ batchId: b.id, sessionId: b.session?.id ?? null })}
                  >
                    {completed ? "Completed ✓" : "Start class"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {active && (
        <StartClassDialog
          open
          onOpenChange={(o) => !o && setActive(null)}
          batchId={active.batchId}
          sessionId={active.sessionId}
          scheduledDate={today}
        />
      )}
    </section>
  );
}
