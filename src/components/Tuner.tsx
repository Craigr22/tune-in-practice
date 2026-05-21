import { useEffect, useRef, useState, useCallback } from "react";

/* ============================================================
   Ukulele Tuner — autocorrelation pitch detection
============================================================ */

type StringDef = { name: string; freq: number; octaveLabel: string };

const HIGH_G: StringDef[] = [
  { name: "G", freq: 392.0, octaveLabel: "G4" },
  { name: "C", freq: 261.63, octaveLabel: "C4" },
  { name: "E", freq: 329.63, octaveLabel: "E4" },
  { name: "A", freq: 440.0, octaveLabel: "A4" },
];
const LOW_G: StringDef[] = [
  { name: "G", freq: 196.0, octaveLabel: "G3" },
  { name: "C", freq: 261.63, octaveLabel: "C4" },
  { name: "E", freq: 329.63, octaveLabel: "E4" },
  { name: "A", freq: 440.0, octaveLabel: "A4" },
];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function freqToMidi(f: number) {
  return 69 + 12 * Math.log2(f / 440);
}
function midiToNote(midi: number) {
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { name, octave, midi: rounded };
}
function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* Autocorrelation with parabolic interpolation */
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  // RMS gate
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  // Trim silence from edges
  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  const trimmed = buf.subarray(r1, r2);
  const N = trimmed.length;
  if (N < 16) return -1;

  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    c[lag] = sum;
  }

  // first dip
  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;

  // peak after dip
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }
  if (maxPos <= 0) return -1;

  // parabolic interpolation
  let T0 = maxPos;
  const x1 = c[maxPos - 1] ?? 0;
  const x2 = c[maxPos];
  const x3 = c[maxPos + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a !== 0) T0 = maxPos - b / (2 * a);

  const freq = sampleRate / T0;
  if (freq < 50 || freq > 2000) return -1;
  return freq;
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
  const bufRef = useRef<Float32Array | null>(null);
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
      bufRef.current = new Float32Array(analyser.fftSize);
      setRunning(true);

      const loop = () => {
        const a = analyserRef.current;
        const b = bufRef.current;
        const c = audioCtxRef.current;
        if (!a || !b || !c) return;
        a.getFloatTimeDomainData(b as unknown as Float32Array);
        const f = autoCorrelate(b as unknown as Float32Array, c.sampleRate);
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
  const needleColor = absCents <= 5 ? "bg-emerald-500" : absCents <= 15 ? "bg-amber-400" : "bg-rose-500";
  const needlePct = Math.max(-50, Math.min(50, cents)); // -50..50 cents range

  const matchedString = targetString && absCents <= 8 ? targetString.name : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 font-sans text-neutral-900">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ukulele tuner</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {lowG ? "Low-G tuning · G3 C4 E4 A4" : "Standard re-entrant · G4 C4 E4 A4"}
        </p>
      </header>

      {/* String reference buttons */}
      <div className="grid grid-cols-4 gap-3">
        {STRINGS.map((s) => {
          const isPlaying = tonePlaying === s.name;
          const isMatched = matchedString === s.name;
          const base = "rounded-2xl border py-5 text-2xl font-semibold transition-colors select-none";
          const tone = isMatched
            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
            : isPlaying
              ? "border-sky-500 bg-sky-50 text-sky-700"
              : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400";
          return (
            <button
              key={s.name}
              className={`${base} ${tone}`}
              onClick={() => (isPlaying ? stopTone() : playTone(s))}
              aria-label={`Play reference tone ${s.octaveLabel}`}
            >
              {s.name}
              <div className="mt-1 text-[11px] font-normal uppercase tracking-wider text-neutral-500">
                {s.octaveLabel}
              </div>
            </button>
          );
        })}
      </div>

      {/* Note display */}
      <div className="mt-10 text-center">
        <div className="inline-flex items-baseline justify-center">
          <span className="text-[7rem] font-bold leading-none tracking-tight">{displayNote}</span>
          {displayOctave && (
            <span className="ml-1 text-2xl font-medium text-neutral-400">{displayOctave}</span>
          )}
        </div>
        <div className="mt-2 text-sm text-neutral-500">
          {freq ? `${freq.toFixed(2)} Hz` : running ? "Listening…" : "Mic off"}
        </div>
      </div>

      {/* Meter */}
      <div className="mt-8">
        <div className="relative h-12 rounded-full bg-neutral-100">
          {/* tick marks */}
          <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] text-neutral-400">
            {[-50, -25, 0, 25, 50].map((t) => (
              <span key={t} className="flex flex-col items-center">
                <span className="h-3 w-px bg-neutral-300" />
              </span>
            ))}
          </div>
          {/* center line */}
          <div className="pointer-events-none absolute left-1/2 top-1 h-10 w-0.5 -translate-x-1/2 bg-neutral-300" />
          {/* needle */}
          {freq && (
            <div
              className={`absolute top-1 h-10 w-1 rounded-full ${needleColor}`}
              style={{
                left: `calc(50% + ${needlePct}%)`,
                transform: "translateX(-50%)",
                transition: "left 80ms linear, background-color 120ms linear",
              }}
            />
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs text-neutral-500">
          <span>flat</span>
          <span>in tune</span>
          <span>sharp</span>
        </div>
        <div className="mt-3 text-center text-sm">
          {freq ? (
            <span className={absCents <= 5 ? "text-emerald-600 font-medium" : "text-neutral-600"}>
              {cents > 0 ? `+${cents}` : cents} cents
              {absCents > 5 && (
                <span className="ml-2 text-neutral-500">
                  {cents > 0 ? "Tune down ↓" : "Tune up ↑"}
                </span>
              )}
              {absCents <= 5 && <span className="ml-2">· in tune</span>}
            </span>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={running ? stopMic : startMic}
          className={`rounded-full px-6 py-2.5 text-sm font-medium transition-colors ${
            running
              ? "bg-rose-500 text-white hover:bg-rose-600"
              : "bg-neutral-900 text-white hover:bg-neutral-700"
          }`}
        >
          {running ? "Stop mic" : "Start mic"}
        </button>
        {tonePlaying && (
          <button
            onClick={stopTone}
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Stop tone
          </button>
        )}
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={lowG}
            onChange={(e) => setLowG(e.target.checked)}
            className="h-4 w-4 accent-neutral-900"
          />
          Low-G
        </label>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-neutral-400">
        Pluck one string at a time. Hold still and let the note ring.
      </p>
    </div>
  );
}
