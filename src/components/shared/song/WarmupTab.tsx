import type { Song, SongTab as TabKey } from "@/lib/types";
import { getChordState } from "./SongHeader";

export const WarmupTab = ({ song, setTab }: { song: Song; setTab: (t: TabKey) => void }) => {
  if (song.fingerstyle) {
    return (
      <>
        <div className="bam-card">
          <div className="bam-card-title">Hands warm? <span className="pill">2 min</span></div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            Fingerstyle uses individual fingers (thumb, index, middle, ring) instead of a strum. Run through finger exercises 1–3 from the foundations module before starting.
          </div>
        </div>
        <div className="bam-card">
          <div className="bam-card-title">Tab refresher <span className="pill">if needed</span></div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            Numbers on lines = which fret to press. Top line = A string, bottom line = G string.
          </div>
        </div>
        <button className="bam-cta" onClick={() => setTab("drills")}>Open the tab →</button>
      </>
    );
  }

  return (
    <>
      <div className="bam-card">
        <div className="bam-card-title">Tuner check <span className="pill">30 sec</span></div>
        <div className="mini-tuner-row">
          <div className="mini-tuner-cell ok"><div className="note">G</div><div className="stat">in tune</div></div>
          <div className="mini-tuner-cell ok"><div className="note">C</div><div className="stat">in tune</div></div>
          <div className={`mini-tuner-cell ${song.id === "sunshine" ? "warn" : "ok"}`}>
            <div className="note">E</div><div className="stat">{song.id === "sunshine" ? "flat -8¢" : "in tune"}</div>
          </div>
          <div className="mini-tuner-cell ok"><div className="note">A</div><div className="stat">in tune</div></div>
        </div>
      </div>

      <div className="bam-card">
        <div className="bam-card-title">Chord check <span className="pill">{song.chords.length} chord{song.chords.length === 1 ? "" : "s"}</span></div>
        <div className="chord-row">
          {song.chords.map((c, i) => {
            const s = getChordState(song, c, i);
            return (
              <div key={c} className={`chord-mini ${s.cls}`}>
                <div className="lbl">{c}</div>
                <div className="stat">{s.stat}</div>
              </div>
            );
          })}
        </div>
        {song.newChord && (
          <div style={{ fontSize: 11, color: "var(--terracotta)", marginTop: 10, fontWeight: 600 }}>
            ⚡ New: {song.newChord} — tap it for the fingering video.
          </div>
        )}
      </div>

      <button className="bam-cta" onClick={() => setTab("drills")}>Start today's drills →</button>
    </>
  );
};

export default WarmupTab;
