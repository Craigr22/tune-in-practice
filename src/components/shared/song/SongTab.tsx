import { useState } from "react";
import type { Song } from "@/lib/types";

export const SongTab = ({ song }: { song: Song }) => {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<"50%" | "75%" | "100%">("75%");
  const [loop, setLoop] = useState("Whole song");

  if (song.fingerstyle) {
    return (
      <>
        <div className="song-player">
          <div className="player-controls">
            <button className="player-btn" onClick={() => setPlaying((p) => !p)}>{playing ? "■" : "▶"}</button>
            <div className="player-info">
              <div className="nm">{song.title}</div>
              <div className="sub">Tab notation · play-along reference</div>
            </div>
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>SPEED</div>
          <div className="speed-row">
            {(["50%", "75%", "100%"] as const).map((s) => (
              <div key={s} className={`speed-pill ${speed === s ? "active" : ""}`} onClick={() => setSpeed(s)}>{s}</div>
            ))}
          </div>
          <div className="progression">
            <div className="progression-label">Bar 1 · current</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 6, lineHeight: 1.7 }}>
              A|—0—3—2—0———7—5———<br />
              E|—0—————————————<br />
              C|———————————————<br />
              G|———————————————
            </div>
          </div>
        </div>
        <div className="bam-card" style={{ marginTop: 10 }}>
          <div className="bam-card-title">Today's goal</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            Play first 4 bars cleanly at 75% speed. Don't worry about timing yet — clean notes first, rhythm later.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="song-player">
        <div className="player-controls">
          <button className="player-btn" onClick={() => setPlaying((p) => !p)}>{playing ? "■" : "▶"}</button>
          <div className="player-info">
            <div className="nm">{song.title}</div>
            <div className="sub">{song.artist} · {song.bpm || 80} BPM</div>
          </div>
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>SPEED</div>
        <div className="speed-row">
          {(["50%", "75%", "100%"] as const).map((s) => (
            <div key={s} className={`speed-pill ${speed === s ? "active" : ""}`} onClick={() => setSpeed(s)}>{s}</div>
          ))}
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>LOOP</div>
        <div className="loop-row">
          <div className={`loop-pill ${loop === "Whole song" ? "active" : ""}`} onClick={() => setLoop("Whole song")}>Whole song</div>
          {(song.sections || []).map((s) => (
            <div key={s.name} className={`loop-pill ${loop === s.name ? "active" : ""}`} onClick={() => setLoop(s.name)}>{s.name}</div>
          ))}
        </div>
        <div className="progression">
          <div className="progression-label">Chord progression · timeline</div>
          {(song.sections || []).map((sec, secIdx) => {
            const isCurrent = secIdx === 0 && song.state === "in-progress";
            return (
              <div key={sec.name}>
                <div className="bar-section">{sec.name}</div>
                <div className="bar-row">
                  {sec.bars.map((b, i) => {
                    const isCurrentBar = isCurrent && i === 2;
                    const cls = isCurrentBar ? "current" : b === "—" ? "muted" : "";
                    return <div key={i} className={`bar ${cls}`}>{b === "—" ? "·" : b}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        className="stuck-btn"
        onClick={() => alert("Common issues:\n\n• Chord buzzing? Press just behind the fret.\n• Strum feels rushed? Drop to 50% speed.\n• Lost the count? Watch the rhythm video.\n• Sore fingertips? See Day 3 note in Plan.")}
      >
        🤔 I'm stuck — show me what's wrong
      </button>

      <div className="bam-card" style={{ marginTop: 10 }}>
        <div className="bam-card-title">Today's goal</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
          {song.state === "in-progress"
            ? "Play Verse 1 at 75% speed without stopping. Record it when ready — your teacher sees it before Saturday."
            : "Get familiar with the chord progression. Don't try to play along yet."}
        </div>
        <button className="bam-cta bam-cta-gold" style={{ marginTop: 10 }}>🎤 Record my attempt</button>
      </div>
    </>
  );
};

export default SongTab;
