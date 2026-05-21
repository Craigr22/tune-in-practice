import type { Song } from "@/lib/types";
import { SONG_REASONING } from "@/data/songs";

export const SidePanel = ({ song }: { song: Song }) => (
  <div className="song-side-panel">
    <div className="side-eyebrow">{song.fingerstyle ? "Fingerstyle bonus" : `Track ${song.track} · #${song.order}`}</div>
    <div className="side-title">{song.title}</div>
    <div className="side-artist">{song.artist}</div>

    <div className="side-section">
      <h4>At a glance</h4>
      <div className="side-detail-row"><span className="label">Difficulty</span><span className="value">{song.difficulty}</span></div>
      {song.chords.length > 0 && (
        <div className="side-detail-row"><span className="label">Chords</span><span className="value">{song.chords.join(" · ")}</span></div>
      )}
      {song.newChord && (
        <div className="side-detail-row"><span className="label">New chord</span><span className="value" style={{ color: "var(--terracotta)" }}>{song.newChord}</span></div>
      )}
      {song.strum && (
        <div className="side-detail-row"><span className="label">Strum</span><span className="value" style={{ fontFamily: "var(--font-body)", fontSize: 12 }}>{song.strum}</span></div>
      )}
      {song.bpm && (
        <div className="side-detail-row"><span className="label">Tempo</span><span className="value">{song.bpm} BPM</span></div>
      )}
      <div className="side-detail-row">
        <span className="label">{song.fingerstyle ? "Pace" : "Daily target"}</span>
        <span className="value">{song.fingerstyle ? "1 play/day" : `${song.dailyTarget || 4} plays/day`}</span>
      </div>
      {song.targetApprovals && (
        <div className="side-detail-row"><span className="label">Mastery</span><span className="value">{song.targetApprovals} approved days</span></div>
      )}
    </div>

    {song.sections && (
      <div className="side-section">
        <h4>Structure</h4>
        {song.sections.map((s) => (
          <div key={s.name} className="side-detail-row">
            <span className="label">{s.name}</span><span className="value">{s.bars.length} bars</span>
          </div>
        ))}
      </div>
    )}

    <div className="side-section">
      <h4>Why this song here</h4>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, fontFamily: "var(--font-display)", fontWeight: 400 }}>
        {SONG_REASONING[song.id] || ""}
      </p>
    </div>

    <div className="side-close">Use the back arrow to return to the course.</div>
  </div>
);

export default SidePanel;
