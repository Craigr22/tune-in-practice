import { useEffect, useRef, useState, useCallback } from "react";
import {
  HIGH_G, LOW_G, autoCorrelate, freqToMidi, midiToNote,
  type StringDef,
} from "@/lib/tuner";

/* ============================================================
   BAM Tuner — standalone page (mic + reference tones).
   Pitch primitives live in `src/lib/tuner.ts`; the new
   mode-aware hook in `src/hooks/useTuner.ts` reuses them.
============================================================ */

function TuningFork() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 2v8a4 4 0 0 0 8 0V2M12 14v8M9.5 22h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Tuner() {
  const [lowG, setLowG] = useState<boolean>(() => {
    try { return localStorage.getItem("bam.tuner.lowG") === "1"; } catch { return false; }
  });
  const STRINGS = lowG ? LOW_G : HIGH_G;

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freq, setFreq] = useState<number | null>(null);
  const [tonePlaying, setTonePlaying] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const oscRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

  useEffect(() => {
    try { localStorage.setItem("bam.tuner.lowG", lowG ? "1" : "0"); } catch { /* ignore */ }
  }, [lowG]);

  const stopTone = useCallback(() => {
    const ctx = audioCtxRef.current;
    const o = oscRef.current;
    if (o && ctx) {
      const now = ctx.currentTime;
      o.gain.gain.cancelScheduledValues(now);
      o.gain.gain.setValueAtTime(o.gain.gain.value, now);
      o.gain.gain.linearRampToValueAtTime(0, now + 0.08);
      o.osc.stop(now + 0.1);
    }
    oscRef.current = null;
    setTonePlaying(null);
  }, []);

  const playTone = useCallback((s: StringDef) => {
    stopTone();
    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = ctx;
    }
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = s.freq;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    oscRef.current = { osc, gain };
    setTonePlaying(s.name);
  }, [stopTone]);

  const stopMic = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    setRunning(false);
    setFreq(null);
  }, []);

  const startMic = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      let ctx = audioCtxRef.current;
      if (!ctx) {
        ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") await ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
      setRunning(true);

      const loop = () => {
        const a = analyserRef.current;
        const b = bufRef.current;
        const c = audioCtxRef.current;
        if (!a || !b || !c) return;
        a.getFloatTimeDomainData(b);
        const f = autoCorrelate(b as unknown as Float32Array<ArrayBuffer>, c.sampleRate);
        if (f > 0) setFreq(f);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not access microphone";
      setError(msg.includes("denied") || msg.includes("Permission") ? "Microphone permission denied. Please allow mic access and try again." : msg);
      stopMic();
    }
  }, [stopMic]);

  useEffect(() => () => {
    stopMic();
    stopTone();
    audioCtxRef.current?.close();
  }, [stopMic, stopTone]);

  // Compute readings
  let displayNote = "—";
  let displayOctave = "";
  let cents = 0;
  let targetString: StringDef | null = null;
  if (freq && freq > 0) {
    const midi = freqToMidi(freq);
    const { name, octave, midi: m } = midiToNote(midi);
    displayNote = name;
    displayOctave = String(octave);
    cents = Math.round((midi - m) * 100);
    // auto-detect closest ukulele string by cents distance
    let best: { s: StringDef; dist: number } | null = null;
    for (const s of STRINGS) {
      const dist = Math.abs(1200 * Math.log2(freq / s.freq));
      if (!best || dist < best.dist) best = { s, dist };
    }
    if (best && best.dist < 200) {
      targetString = best.s;
      // recalc cents relative to the actual string (more meaningful for tuning)
      cents = Math.round(1200 * Math.log2(freq / best.s.freq));
    }
  }

  const absCents = Math.abs(cents);
  const needlePct = Math.max(-50, Math.min(50, cents)); // -50..50 cents range

  const matchedString = targetString && absCents <= 8 ? targetString.name : null;

  // Brand state for color theming (drives CSS via data-state)
  const state = !freq ? "idle" : absCents <= 5 ? "tune" : absCents <= 15 ? "near" : "off";
  const inTune = state === "tune";

  return (
    <div className="bamt" data-state={state}>
      <header className="bamt-head">
        <div className="bamt-eyebrow">BAM Academy of Music</div>
        <div className="bamt-brand">
          <span className="bamt-fork"><TuningFork /></span>
          <div className="bamt-titlewrap">
            <h1 className="bamt-title"><span className="bam">BAM</span> Tuner</h1>
            <p className="bamt-mode">
              {lowG ? "Low-G tuning · G3 C4 E4 A4" : "Standard re-entrant · G4 C4 E4 A4"}
            </p>
          </div>
        </div>
      </header>

      <div className="bamt-body">
        {/* String reference */}
        <div className="bamt-strings">
          {STRINGS.map((s) => {
            const isPlaying = tonePlaying === s.name;
            const isMatched = matchedString === s.name;
            const cls = isMatched ? "is-matched" : isPlaying ? "is-playing" : "";
            return (
              <button
                key={s.name}
                className={`bamt-string ${cls}`}
                onClick={() => (isPlaying ? stopTone() : playTone(s))}
                aria-label={`Play reference tone ${s.octaveLabel}`}
              >
                <div className="bamt-string-note">{s.name}</div>
                <div className="bamt-string-label">{s.octaveLabel}</div>
              </button>
            );
          })}
        </div>

        {/* Note readout */}
        <div className="bamt-readout">
          <div className="bamt-note-line">
            <span className="bamt-note">{displayNote}</span>
            {displayOctave && <span className="bamt-octave">{displayOctave}</span>}
          </div>
          <div>
            <span className="bamt-hz">
              {freq && <span className="live-dot" />}
              {freq ? `${freq.toFixed(2)} Hz` : running ? "Listening…" : "Mic off"}
            </span>
          </div>
        </div>

        {/* Meter */}
        <div className="bamt-meter-wrap">
          <div className="bamt-meter">
            <div className="bamt-zone" />
            <div className="bamt-ticks">
              {[-50, -25, 0, 25, 50].map((t) => (
                <span key={t} className={`bamt-tick ${t === 0 ? "major" : ""}`} />
              ))}
            </div>
            <div className="bamt-center" />
            {freq && (
              <div
                className="bamt-needle"
                style={{ left: `calc(50% + ${needlePct}%)`, transform: "translateX(-50%)" }}
              />
            )}
          </div>
          <div className="bamt-scale">
            <span>Flat</span>
            <span>In tune</span>
            <span>Sharp</span>
          </div>
        </div>

        {/* Cents / status */}
        <div className="bamt-status">
          {!freq ? (
            <span className="bamt-cents idle">—</span>
          ) : inTune ? (
            <span className="bamt-intune">✓ In tune</span>
          ) : (
            <span className="bamt-cents">
              {cents > 0 ? `+${cents}` : cents} cents
              <span className="dir">{cents > 0 ? "Tune down ↓" : "Tune up ↑"}</span>
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="bamt-controls">
          <button
            onClick={running ? stopMic : startMic}
            className={`bamt-mic ${running ? "is-running" : ""}`}
          >
            <span className="ic">{running ? "■" : "●"}</span>
            {running ? "Stop mic" : "Start mic"}
          </button>
          {tonePlaying && (
            <button onClick={stopTone} className="bamt-stop-tone">
              Stop tone
            </button>
          )}
          <label className="bamt-lowg">
            <input
              type="checkbox"
              checked={lowG}
              onChange={(e) => setLowG(e.target.checked)}
            />
            <span className="bamt-switch" />
            Low-G
          </label>
        </div>

        {error && <div className="bamt-error">{error}</div>}

        <p className="bamt-hint">Pluck one string at a time. Hold still and let the note ring.</p>
      </div>
    </div>
  );
}
