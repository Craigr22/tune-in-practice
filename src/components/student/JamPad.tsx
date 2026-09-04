import { useCallback, useEffect, useRef, useState } from "react";

/**
 * JamPad — a tiny playable ukulele. Swipe across the strings to strum, or tap
 * a chord to hear it. Sound is synthesized in the browser (Karplus–Strong
 * plucked-string), so there are no audio files and it works offline.
 */

/* ---------- sound engine ---------- */
let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/** Karplus–Strong pluck: a noise burst fed through a decaying delay line. */
function pluck(freq: number, delaySec = 0, gain = 0.45) {
  const ac = getCtx();
  const sr = ac.sampleRate;
  const dur = 1.6;
  const buf = ac.createBuffer(1, Math.floor(sr * dur), sr);
  const data = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < data.length; i++) {
    const next = (idx + 1) % period;
    ring[idx] = 0.996 * 0.5 * (ring[idx] + ring[next]);
    data[i] = ring[idx];
    idx = next;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g).connect(ac.destination);
  src.start(ac.currentTime + delaySec);
}

/* ---------- tuning & chords (standard uke G C E A) ---------- */
const STRINGS = [
  { name: "G", freq: 392.0 },
  { name: "C", freq: 261.63 },
  { name: "E", freq: 329.63 },
  { name: "A", freq: 440.0 },
];

const CHORDS: { name: string; freqs: number[] }[] = [
  { name: "C", freqs: [392.0, 261.63, 329.63, 523.25] },
  { name: "Am", freqs: [440.0, 261.63, 329.63, 440.0] },
  { name: "F", freqs: [440.0, 261.63, 349.23, 440.0] },
  { name: "G", freqs: [392.0, 293.66, 392.0, 493.88] },
];

const NOTE_EMOJI = ["🎵", "🎶", "♪", "♫"];

type FloatNote = { id: number; x: number; y: number; emoji: string };

export default function JamPad({ embedded = false }: { embedded?: boolean } = {}) {
  const [wiggling, setWiggling] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState<FloatNote[]>([]);
  const strummingRef = useRef(false);
  const noteId = useRef(0);
  const padRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const up = () => { strummingRef.current = false; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const spawnNote = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current?.getBoundingClientRect();
    if (!pad) return;
    const id = ++noteId.current;
    setNotes((n) => [
      ...n,
      {
        id,
        x: clientX - pad.left + (Math.random() * 24 - 12),
        y: clientY - pad.top,
        emoji: NOTE_EMOJI[id % NOTE_EMOJI.length],
      },
    ]);
    setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 1300);
  }, []);

  const playString = useCallback((i: number, clientX: number, clientY: number) => {
    pluck(STRINGS[i].freq);
    setWiggling((w) => ({ ...w, [i]: true }));
    setTimeout(() => setWiggling((w) => ({ ...w, [i]: false })), 450);
    spawnNote(clientX, clientY);
  }, [spawnNote]);

  const strumChord = useCallback((freqs: number[]) => {
    freqs.forEach((f, i) => pluck(f, i * 0.045));
    // Wiggle everything + a little shower of notes
    setWiggling({ 0: true, 1: true, 2: true, 3: true });
    setTimeout(() => setWiggling({}), 450);
    const pad = padRef.current?.getBoundingClientRect();
    if (pad) {
      for (let i = 0; i < 3; i++) {
        const id = ++noteId.current;
        setNotes((n) => [
          ...n,
          { id, x: 30 + Math.random() * (pad.width - 60), y: 30 + Math.random() * 40, emoji: NOTE_EMOJI[id % NOTE_EMOJI.length] },
        ]);
        setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 1300);
      }
    }
  }, []);

  return (
    <section
      className={embedded ? "px-5 pt-4 pb-5 select-none" : "rounded-3xl p-5 md:p-6 mb-5 select-none"}
      style={
        embedded
          // Sits inside another panel: no card of its own, just a section.
          ? { background: "transparent", overflow: "hidden" }
          : {
              background: "linear-gradient(135deg, var(--gold-bg), #fff 70%)",
              border: "1px solid var(--gold-soft)",
              boxShadow: "var(--shadow-sm)",
              overflow: "hidden",
            }
      }
    >
      <style>{`
        @keyframes jam-float {
          0%   { transform: translateY(0) scale(0.8) rotate(-8deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(-70px) scale(1.25) rotate(10deg); opacity: 0; }
        }
        @keyframes jam-wiggle {
          0%, 100% { transform: scaleY(1); }
          25% { transform: scaleY(3) translateY(-1px); }
          50% { transform: scaleY(1.5) translateY(1px); }
          75% { transform: scaleY(2.2); }
        }
        .jam-string { transition: background 0.2s; }
        .jam-string.wiggle > div { animation: jam-wiggle 0.45s ease-out; }
        .jam-note { animation: jam-float 1.3s ease-out forwards; pointer-events: none; position: absolute; font-size: 18px; }
        .jam-chord:active { transform: scale(0.92); }
      `}</style>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--gold-deep)" }}>
            🎸 Jam corner
          </div>
          <div className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Swipe the strings or tap a chord — just for fun.
          </div>
        </div>
        <div className="flex gap-2">
          {CHORDS.map((c) => (
            <button
              key={c.name}
              onClick={() => strumChord(c.freqs)}
              className="jam-chord rounded-full px-4 py-2 text-sm font-bold transition-transform"
              style={{ background: "var(--navy)", color: "#fff", boxShadow: "var(--shadow-sm)" }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={padRef}
        className="relative rounded-2xl px-5 py-4"
        style={{ background: "linear-gradient(180deg, #8b5a2b, #6f4518)", touchAction: "none" }}
        onPointerDown={() => { strummingRef.current = true; }}
      >
        {/* sound hole decoration */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 64, height: 64, right: 28, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.35)", border: "4px solid rgba(255,220,150,0.35)" }}
        />
        {STRINGS.map((s, i) => (
          <div
            key={s.name}
            className={`jam-string flex items-center gap-3 py-2.5 cursor-pointer ${wiggling[i] ? "wiggle" : ""}`}
            onPointerDown={(e) => { strummingRef.current = true; playString(i, e.clientX, e.clientY); }}
            onPointerEnter={(e) => { if (strummingRef.current) playString(i, e.clientX, e.clientY); }}
          >
            <span className="text-[10px] font-bold w-4 text-center" style={{ color: "rgba(255,235,190,0.9)" }}>{s.name}</span>
            <div
              className="flex-1 rounded-full"
              style={{
                height: i === 1 ? 3 : 2, // C string is the fattest
                background: "linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0.55))",
                boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
              }}
            />
          </div>
        ))}
        {notes.map((n) => (
          <span key={n.id} className="jam-note" style={{ left: n.x, top: n.y }}>{n.emoji}</span>
        ))}
      </div>
    </section>
  );
}
