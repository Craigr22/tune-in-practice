import type { Song } from "@/lib/types";

export const SongCard = ({ song, onOpen }: { song: Song; onOpen: () => void }) => {
  const stateClass = song.state || "";
  const lockBadge =
    song.state === "mastered" ? <span className="song-status-badge mastered">✓ Mastered</span> :
    song.state === "in-progress" ? <span className="song-status-badge progress">In progress</span> :
    song.state === "next" ? <span className="song-status-badge next">Up next</span> :
    song.state === "locked" ? <span className="song-status-badge locked">🔒 Locked</span> :
    song.state === "stretch" ? <span className="song-status-badge locked">Stretch</span> : null;

  if (song.fingerstyle) {
    return (
      <div className={`song-card ${stateClass}`} onClick={onOpen}>
        <div className="fingerstyle-tag">{song.isLesson ? "Lesson" : "Fingerstyle"}</div>
        <div className="song-card-head">
          <div className="song-num">{song.order || "·"}</div>
          <div className="song-info">
            <div className="song-title">{song.title}</div>
            <div className="song-artist">{song.artist}</div>
          </div>
        </div>
        {lockBadge}
        <div className="song-card-meta" style={{ marginTop: 14 }}>
          <span>{song.difficulty}</span>
          <span className="dot">·</span>
          <span>Tab notation</span>
        </div>
      </div>
    );
  }

  const dayInfo =
    song.state === "in-progress" ? <span><strong style={{ color: "var(--ink)" }}>{song.playsToday}/{song.dailyTarget}</strong> today</span> :
    song.state === "mastered" ? <span style={{ color: "var(--olive)", fontWeight: 600 }}>✓ {song.approvedDays} approved days</span> :
    <span>{song.difficulty}</span>;

  const progressPct = song.targetApprovals
    ? Math.min(100, Math.round(((song.approvedDays || 0) / song.targetApprovals) * 100))
    : 0;

  const progressMini =
    song.state === "in-progress" ? (
      <span className="progress-mini">
        <span className="song-progress-bar"><span className="song-progress-fill" style={{ width: `${progressPct}%` }}></span></span>
        {song.approvedDays}/{song.targetApprovals}
      </span>
    ) : song.state === "mastered" ? (
      <span className="progress-mini" style={{ color: "var(--olive)" }}>✓ Mastered</span>
    ) : null;

  return (
    <div className={`song-card ${stateClass}`} onClick={onOpen}>
      {lockBadge}
      <div className="song-card-head">
        <div className="song-num">{String(song.order).padStart(2, "0")}</div>
        <div className="song-info">
          <div className="song-title">{song.title}</div>
          <div className="song-artist">{song.artist}</div>
        </div>
      </div>
      <div className="chord-pills">
        {song.chords.map((c) => {
          let cls = "";
          if (song.newChord && (c === song.newChord || song.newChord.includes(c))) cls = "new";
          if (c === "Bb" || c === "Fm") cls = "hard";
          return <span key={c} className={`chord-pill ${cls}`}>{c}</span>;
        })}
      </div>
      <div className="song-card-meta">
        {dayInfo}
        <span className="dot">·</span>
        <span>{song.chords.length} chords</span>
        {progressMini}
      </div>
    </div>
  );
};

export default SongCard;
