import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useSongs } from "@/hooks/useSongs";
import { useLogPractice } from "@/hooks/useStudentProgress";
import { SONG_AUDIO } from "@/data/audio";
import type { SongTab as TabKey } from "@/lib/types";
import SongHeader from "@/components/shared/song/SongHeader";
import WarmupTab from "@/components/shared/song/WarmupTab";
import DrillsTab from "@/components/shared/song/DrillsTab";
import SongTab from "@/components/shared/song/SongTab";
import PlanTab from "@/components/shared/song/PlanTab";
import SidePanel from "@/components/shared/song/SidePanel";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BADGE_LIST } from "@/lib/badges";
import { toast } from "@/hooks/use-toast";

const SongDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { getSong, closeSong, logPlay } = useSongs();
  const song = id ? getSong(id) : undefined;
  const [tab, setTab] = useState<TabKey>("warmup");
  const [prompt, setPrompt] = useState(false);
  const [duration, setDuration] = useState(10);
  const logPractice = useLogPractice();

  useEffect(() => { setTab("warmup"); }, [id]);

  if (!song) return <Navigate to="/student" replace />;

  const handleLogPlay = (sid: string) => {
    logPlay(sid);
    setPrompt(true);
  };

  const submit = async (badge: number | null) => {
    try {
      await logPractice.mutateAsync({ songId: song.id, durationMin: duration, selfBadge: badge });
      toast({ title: "Practice logged", description: `${duration} min · saved to your journey.` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save practice log.";
      toast({ title: "Couldn't save", description: msg, variant: "destructive" });
    } finally {
      setPrompt(false);
    }
  };

  return (
    <div className="song-page" id="songOverlay">
      <div className="song-page-content">
        <div className="bam-phone bam-phone--page">
          <SongHeader song={song} close={closeSong} />
          {SONG_AUDIO[song.id] && (
            <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Reference track
              </div>
              <audio controls preload="none" style={{ width: "100%" }} src={SONG_AUDIO[song.id].src} />
              {SONG_AUDIO[song.id].fullSrc && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Full audio
                  </div>
                  <audio controls preload="none" style={{ width: "100%" }} src={SONG_AUDIO[song.id].fullSrc} />
                </>
              )}
            </div>
          )}
          <div className="bam-tabs">
            {(["warmup", "drills", "song", "plan"] as TabKey[]).map((t) => (
              <div key={t} className={`bam-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                <span className="ic">{ { warmup: "🎯", drills: "🔁", song: "🎵", plan: "📅" }[t] }</span>
                {{ warmup: "Warm Up", drills: "Drills", song: "Song", plan: "Plan" }[t]}
              </div>
            ))}
          </div>
          <div className="bam-content bam-content--page">
            {tab === "warmup" && <WarmupTab song={song} setTab={setTab} />}
            {tab === "drills" && <DrillsTab song={song} />}
            {tab === "song" && <SongTab song={song} />}
            {tab === "plan" && <PlanTab song={song} logPlay={handleLogPlay} />}
          </div>
        </div>
        <SidePanel song={song} />
      </div>

      <Dialog open={prompt} onOpenChange={setPrompt}>
        <DialogContent className="max-w-md">
          <DialogTitle>How did that feel?</DialogTitle>
          <DialogDescription>Rate this run-through. We'll save it to your journey.</DialogDescription>

          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>Duration</label>
            <input
              type="number"
              min={1}
              max={120}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 px-2 py-1 rounded border text-sm"
              style={{ borderColor: "var(--border-strong)" }}
            />
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>min</span>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-3">
            {BADGE_LIST.map((b) => (
              <button
                key={b.level}
                onClick={() => submit(b.level)}
                disabled={logPractice.isPending}
                className="flex flex-col items-center gap-1 p-3 rounded-xl border transition-all hover:-translate-y-0.5"
                style={{ borderColor: "var(--border)", background: "var(--paper-warm)" }}
                title={b.blurb}
              >
                <span className="text-3xl">{b.emoji}</span>
                <span className="text-[10px] font-semibold" style={{ color: "var(--ink)" }}>{b.name}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => submit(null)}
            disabled={logPractice.isPending}
            className="mt-2 text-xs font-semibold self-start"
            style={{ color: "var(--ink-soft)" }}
          >
            Skip rating
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SongDetail;
