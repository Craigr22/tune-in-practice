import type { Song } from "@/lib/types";

export const SongHeader = ({ song, close }: { song: Song; close: () => void }) => {
  const dayBadge =
    song.state === "mastered" ? <div className="bam-day-badge" style={{ background: "var(--olive)", color: "var(--paper)" }}>✓ Done</div> :
    song.state === "in-progress" ? <div className="bam-day-badge">{song.playsToday}/{song.dailyTarget} today</div> :
    <div className="bam-day-badge" style={{ background: "var(--paper-warm)", color: "var(--ink-soft)" }}>New</div>;

  const subline = song.fingerstyle
    ? `${song.difficulty} · Fingerstyle`
    : `${song.difficulty} · ${song.chords.length} chord${song.chords.length === 1 ? "" : "s"} · ${song.targetApprovals || 7} approved days to master`;

  const progressPct = song.state === "mastered"
    ? 100
    : song.targetApprovals ? Math.min(100, Math.round(((song.approvedDays || 0) / song.targetApprovals) * 100)) : 0;

  return (
    <div className="bam-header">
      <div className="bam-header-row">
        <div className="bam-back" onClick={close}>←</div>
        <div>
          <div className="bam-song-title">{song.title}</div>
          <div className="bam-song-meta">{subline}</div>
        </div>
        {dayBadge}
      </div>
      <div className="bam-progress-bar"><div className="bam-progress-fill" style={{ width: `${progressPct}%` }}></div></div>
      <div className="bam-progress-label">
        {song.state === "mastered" ? <><span>Mastered</span><span>🔥 12-day streak</span></> :
         song.state === "in-progress" ? <><span>{song.approvedDays} of {song.targetApprovals} approved days</span><span>🔥 12-day streak</span></> :
         <><span>Not started</span><span>🔥 12-day streak</span></>}
      </div>
    </div>
  );
};

export const getChordState = (song: Song, chord: string, idx: number): { cls: string; stat: string } => {
  if (song.state === "mastered") return { cls: "ok", stat: "✓ clean" };
  if (song.state === "in-progress") {
    if (chord === song.newChord) return { cls: "work", stat: "getting there" };
    return idx === 0 ? { cls: "ok", stat: "✓ clean" } : { cls: "ok", stat: "✓ clean" };
  }
  if (chord === song.newChord || (song.newChord && song.newChord.includes(chord))) {
    return { cls: "new", stat: "new chord" };
  }
  return { cls: "ok", stat: "✓ ready" };
};

export default SongHeader;
