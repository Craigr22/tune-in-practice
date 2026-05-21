import { useEffect, useRef, useState } from "react";

export const DrillCard = ({ title, beatCount, meta }: { title: string; beatCount: number; meta: React.ReactNode }) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, []);

  const toggle = () => {
    if (playing) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      setPlaying(false);
      setActiveIdx(null);
      return;
    }
    setPlaying(true);
    let i = 0;
    intervalRef.current = window.setInterval(() => {
      setActiveIdx(i);
      i = (i + 1) % beatCount;
    }, 375);
  };

  return (
    <div className="drill">
      <div className="drill-head">
        <div className="drill-title">{title}</div>
        <button className={`drill-play ${playing ? "playing" : ""}`} onClick={toggle} aria-label="Toggle drill">
          {playing ? "■" : "▶"}
        </button>
      </div>
      <div className="beat-row">
        {Array.from({ length: beatCount }, (_, i) => (
          <div key={i} className={`beat ${i % 4 === 0 ? "down" : ""} ${activeIdx === i ? "active" : ""}`}></div>
        ))}
      </div>
      <div className="drill-meta">{meta}</div>
    </div>
  );
};

export const BpmPills = ({ bpms, activeBpm }: { bpms: number[]; activeBpm: number }) => {
  const [active, setActive] = useState(activeBpm);
  return (
    <div className="bpm-pills">
      {bpms.map((b) => (
        <div key={b} className={`bpm-pill ${active === b ? "active" : ""}`} onClick={() => setActive(b)}>{b}</div>
      ))}
    </div>
  );
};

export default DrillCard;
