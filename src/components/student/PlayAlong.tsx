import { useEffect, useRef, useState } from "react";

/** Practice speeds. Slow to learn it, half speed to untangle a hard bar. */
const SPEEDS = [
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 1, label: "Full" },
] as const;

const BEATS_PER_BAR = 4;

export interface PlayAlongSection {
  name: string;
  bars: string[];
}

/**
 * Play along to the backing track, with the chords going past as you play.
 *
 * The chord follower is worked out from the song's bpm rather than from any
 * timing baked into the track, so it can start on the wrong beat if the
 * recording has a count-in. Hence Sync: tap it as the first chord lands and
 * the bars line up from there.
 */
export default function PlayAlong({
  src,
  title,
  bpm,
  sections,
  strum,
}: {
  src?: string;
  title?: string | null;
  bpm?: number;
  sections?: PlayAlongSection[];
  strum?: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [bar, setBar] = useState(-1);
  const [offset, setOffset] = useState(0);

  const barSeconds = (BEATS_PER_BAR * 60) / (bpm && bpm > 0 ? bpm : 80);
  const flat = (sections ?? []).flatMap((s) => s.bars.map((b) => ({ ...{ bar: b }, section: s.name })));

  /**
   * Slower without dropping the key. Without preservesPitch a half-speed track
   * falls an octave and the chords a student is holding stop matching what
   * they hear. Safari and older WebKit still need the prefixed names.
   */
  const applyRate = (value: number) => {
    const a = ref.current as (HTMLAudioElement & Record<string, unknown>) | null;
    if (!a) return;
    a.preservesPitch = true;
    a.webkitPreservesPitch = true;
    a.mozPreservesPitch = true;
    a.playbackRate = value;
  };

  useEffect(() => applyRate(rate), [rate, src]);

  // Follow the bars while it plays. Media time, not wall-clock, so the count
  // stays right at any speed.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const a = ref.current;
      if (!a) return;
      const elapsed = a.currentTime - offset;
      setBar(elapsed < 0 ? -1 : Math.floor(elapsed / barSeconds));
    }, 120);
    return () => window.clearInterval(id);
  }, [playing, offset, barSeconds]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) { applyRate(rate); void a.play(); } else { a.pause(); }
  };

  const stop = () => {
    const a = ref.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setBar(-1);
  };

  if (!src) return null;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--paper-cool)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--blue-bright)",
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-bold" style={{ color: "var(--blue-deep)" }}>
            Play along
          </div>
          {title && (
            <div className="text-[11px] truncate" style={{ color: "var(--ink-soft)" }}>{title}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="rounded-full px-4 py-2 text-xs font-bold"
            style={{ background: "var(--navy)", color: "#fff" }}
          >
            {playing ? "❚❚ Pause" : "▶ Play"}
          </button>
          <button
            onClick={stop}
            className="rounded-full px-3 py-2 text-xs font-bold"
            style={{ background: "var(--card)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          >
            ■ Stop
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
          Speed
        </span>
        {SPEEDS.map((s) => {
          const on = rate === s.value;
          return (
            <button
              key={s.value}
              onClick={() => setRate(s.value)}
              aria-pressed={on}
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: on ? "var(--navy)" : "var(--card)",
                color: on ? "#fff" : "var(--ink-soft)",
                border: `1px solid ${on ? "var(--navy)" : "var(--border)"}`,
              }}
            >
              {s.label}
            </button>
          );
        })}
        {flat.length > 0 && (
          <button
            onClick={() => { const a = ref.current; if (a) { setOffset(a.currentTime); setBar(0); } }}
            title="Tap as the first chord lands, if the chords drift"
            className="ml-auto rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: "var(--card)", color: "var(--blue-deep)", border: "1px solid var(--border)" }}
          >
            Sync
          </button>
        )}
      </div>

      {strum && (
        <div className="mt-3 text-xs" style={{ color: "var(--ink-soft)" }}>
          Strum <span className="font-bold tracking-widest" style={{ color: "var(--ink)" }}>{strum}</span>
        </div>
      )}

      {flat.length > 0 && (
        <div className="mt-3">
          {(sections ?? []).map((section, si) => {
            const before = (sections ?? []).slice(0, si).reduce((n, s) => n + s.bars.length, 0);
            return (
              <div key={section.name + si} className="mb-2 last:mb-0">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--ink-faint)" }}>
                  {section.name}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {section.bars.map((b, bi) => {
                    const index = before + bi;
                    const now = index === bar;
                    return (
                      <span
                        key={bi}
                        className="rounded-md px-2.5 py-1.5 text-xs font-bold tabular-nums transition-colors"
                        style={{
                          minWidth: 42,
                          textAlign: "center",
                          background: now ? "var(--navy)" : "var(--card)",
                          color: now ? "#fff" : b === "—" ? "var(--ink-faint)" : "var(--blue-deep)",
                          border: `1px solid ${now ? "var(--navy)" : "var(--border)"}`,
                        }}
                      >
                        {b === "—" ? "·" : b}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setBar(-1); }}
        onLoadedMetadata={() => applyRate(rate)}
        className="sr-only"
      />
    </div>
  );
}
