import type { Song } from "@/lib/types";

export const PlanTab = ({ song, logPlay }: { song: Song; logPlay: (id: string) => void }) => {
  if (song.fingerstyle) {
    return (
      <>
        <div className="bam-card streak-card">
          <div className="streak-row">
            <div className="streak-num">🎼</div>
            <div className="streak-lbl">
              <strong style={{ color: "var(--ink)" }}>Fingerstyle pace</strong><br />
              1 play per day = approved. Practice when you want a break from strumming.
            </div>
          </div>
        </div>
        <div className="bam-card">
          <div className="bam-card-title">Suggested approach</div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            <strong>Phase 1:</strong> Right-hand pattern only<br />
            <strong>Phase 2:</strong> First 4 bars clean<br />
            <strong>Phase 3:</strong> Full piece at 50% speed<br />
            <strong>Phase 4:</strong> Full speed + record
          </div>
        </div>
      </>
    );
  }

  const target = song.dailyTarget || 4;
  const playsToday = song.playsToday || 0;
  const approved = song.approvedDays || 0;
  const totalToMaster = song.targetApprovals || 7;
  const history = song.history || [];

  const isApprovedToday = playsToday >= target;
  const playsToGo = Math.max(0, target - playsToday);

  return (
    <>
      <div className={`today-card ${isApprovedToday ? "approved" : ""}`}>
        <div className="today-card-head">
          <div className="lbl">Today</div>
          {isApprovedToday
            ? <span className="approved-tag">✓ Approved</span>
            : <span className="togo-tag">{playsToGo} to go</span>}
        </div>
        <div className="play-dots-row">
          {Array.from({ length: target }, (_, i) => {
            const done = i < playsToday;
            return (
              <div key={i} className={`play-dot ${done ? "done" : ""}`}>
                <span className="num">{i + 1}</span>
              </div>
            );
          })}
        </div>
        <div className="today-count-text">
          {isApprovedToday
            ? <><span className="big">{playsToday}</span> / {target} plays · target met</>
            : <><span className="big">{playsToday}</span> of {target} plays today</>}
        </div>
        {song.state === "mastered" ? (
          <button className="log-play-btn" disabled><span className="plus">✓</span>Mastered — practice anytime</button>
        ) : isApprovedToday ? (
          <button className="log-play-btn" onClick={() => logPlay(song.id)}><span className="plus">+</span>Log a bonus play</button>
        ) : (
          <button className="log-play-btn" onClick={() => logPlay(song.id)}><span className="plus">+</span>Log a play</button>
        )}
      </div>

      {song.state === "mastered" ? (
        <div className="bam-card streak-card">
          <div className="streak-row">
            <div className="streak-num">✓</div>
            <div className="streak-lbl">
              <strong style={{ color: "var(--ink)" }}>Mastered</strong><br />
              {approved} approved days. This song is in your library.
            </div>
          </div>
        </div>
      ) : (
        <div className="bam-card">
          <div className="bam-card-title">Approval streak <span className="pill">{approved}/{totalToMaster}</span></div>
          <div className="approval-dots">
            {Array.from({ length: totalToMaster }, (_, i) => {
              const done = i < approved;
              return <div key={i} className={`approval-dot ${done ? "done" : ""}`}><span className="num">{i + 1}</span></div>;
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", textAlign: "center", lineHeight: 1.5 }}>
            {approved === 0
              ? `Hit your daily target ${totalToMaster} days to master this song.`
              : approved >= totalToMaster - 1
              ? "One more approved day and this song is yours."
              : `${totalToMaster - approved} more approved days to mastery.`}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bam-card">
          <div className="bam-card-title">Last 14 days</div>
          <div className="history-grid">
            {history.map((plays, i) => {
              const isToday = i === history.length - 1;
              let cls = "missed";
              if (plays >= target) cls = "approved";
              else if (plays > 0) cls = "partial";
              return <div key={i} className={`history-cell ${cls} ${isToday ? "today" : ""}`} title={`${plays} plays`}></div>;
            })}
          </div>
          <div className="history-legend">
            <span><span className="history-legend-swatch" style={{ background: "var(--gold)" }}></span>Approved</span>
            <span><span className="history-legend-swatch" style={{ background: "var(--gold-soft)" }}></span>Partial</span>
            <span><span className="history-legend-swatch" style={{ background: "var(--paper-cool)", border: "1px dashed var(--border-strong)" }}></span>No practice</span>
          </div>
        </div>
      )}

      {approved >= 1 && approved <= 3 && song.state === "in-progress" && (
        <div className="bam-card">
          <div className="bam-card-title">Sore fingers? <span className="pill">normal</span></div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            Early days are when fingertips hurt most. This passes by approved-day 5 as your skin toughens. Take 5-min breaks, keep practicing — pain here is a sign you're doing it <em>right</em>.
          </div>
        </div>
      )}

      <div className="bam-card" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
        <div className="bam-card-title">📚 Saturday class preview</div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.55 }}>
          Your teacher sees today's plays before class.{" "}
          {song.newChord
            ? <>Bring questions about <strong>{song.newChord}</strong> — it's the new chord here.</>
            : "You have time for revision questions."}
        </div>
      </div>
    </>
  );
};

export default PlanTab;
