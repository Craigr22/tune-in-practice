import type { Song } from "@/lib/types";
import { DrillCard, BpmPills } from "./DrillCard";

export const DrillsTab = ({ song }: { song: Song }) => {
  if (song.fingerstyle) {
    return (
      <>
        <div className="bam-card" style={{ background: "var(--gold-bg)", borderColor: "var(--gold)" }}>
          <div style={{ fontSize: 11, color: "var(--gold-deep)", fontWeight: 700, lineHeight: 1.5 }}>
            <strong>Fingerstyle drill:</strong> right-hand pattern first, then add notes. The rhythm is harder than the fingering.
          </div>
        </div>
        <div className="bam-card">
          <div className="bam-card-title">Right-hand pattern <span className="pill">5 min</span></div>
          <DrillCard
            title="Thumb · Index · Middle · Ring"
            beatCount={4}
            meta={<>
              <span>One finger per string · slow & even</span>
              <BpmPills bpms={[60, 76, 90]} activeBpm={60} />
            </>}
          />
        </div>
      </>
    );
  }

  const why = (song.state === "in-progress" || song.state === "next") && (
    <div className="bam-card" style={{ background: "var(--gold-bg)", borderColor: "var(--gold-soft)" }}>
      <div style={{ fontSize: 11, color: "var(--gold-deep)", fontWeight: 600, lineHeight: 1.5 }}>
        <strong>Why drills?</strong> The hardest part isn't forming the chords — it's switching in time. 5 minutes of this beats 30 minutes of song attempts.
      </div>
    </div>
  );

  const strumBeats = (song.strum || "").replace(/[\s\-·•]/g, "").split("");

  return (
    <>
      {why}
      <div className="bam-card">
        <div className="bam-card-title">Chord transitions <span className="pill">5 min</span></div>
        {(song.keyDrills || []).map((d, i) => {
          const score = d.score > 0
            ? <><span>Yesterday: {d.score}/{d.total}</span><span style={{ color: "var(--olive)", fontWeight: 700 }}>+{Math.floor(d.total * 0.2)} today</span></>
            : <><span>First time today</span><span style={{ color: "var(--ink-faint)" }}>starting</span></>;
          return (
            <DrillCard
              key={i}
              title={`${d.name} · ${d.desc}`}
              beatCount={8}
              meta={<>
                {score}
                <BpmPills bpms={[60, 80, 100]} activeBpm={d.bpm} />
              </>}
            />
          );
        })}
      </div>
      <div className="bam-card">
        <div className="bam-card-title">Strum pattern <span className="pill">{song.strum}</span></div>
        <div className="beat-row" style={{ height: 36 }}>
          {strumBeats.map((s, i) => (
            <div key={i} className={`beat ${s === "D" ? "down" : ""}`} style={{ height: 30, borderRadius: 5 }}></div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.5 }}>
          {song.strumNote || "Steady downstrums."}
        </div>
      </div>
    </>
  );
};

export default DrillsTab;
