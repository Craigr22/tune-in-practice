import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useSongs } from "@/hooks/useSongs";
import { SONG_AUDIO } from "@/data/audio";
import type { SongTab as TabKey } from "@/lib/types";
import SongHeader from "@/components/shared/song/SongHeader";
import WarmupTab from "@/components/shared/song/WarmupTab";
import DrillsTab from "@/components/shared/song/DrillsTab";
import SongTab from "@/components/shared/song/SongTab";
import PlanTab from "@/components/shared/song/PlanTab";
import SidePanel from "@/components/shared/song/SidePanel";

const SongDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { getSong, closeSong, logPlay } = useSongs();
  const song = id ? getSong(id) : undefined;
  const [tab, setTab] = useState<TabKey>("warmup");

  useEffect(() => { setTab("warmup"); }, [id]);

  if (!song) return <Navigate to="/student" replace />;

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
            {tab === "plan" && <PlanTab song={song} logPlay={logPlay} />}
          </div>
        </div>
        <SidePanel song={song} />
      </div>
    </div>
  );
};

export default SongDetail;
