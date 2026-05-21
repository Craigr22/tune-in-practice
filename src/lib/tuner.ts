/* ============================================================
   Ukulele tuner — pure pitch / note helpers (no React)
   Autocorrelation with parabolic interpolation.
============================================================ */

export type StringDef = { name: string; freq: number; octaveLabel: string };

export const HIGH_G: StringDef[] = [
  { name: "G", freq: 392.0,  octaveLabel: "G4" },
  { name: "C", freq: 261.63, octaveLabel: "C4" },
  { name: "E", freq: 329.63, octaveLabel: "E4" },
  { name: "A", freq: 440.0,  octaveLabel: "A4" },
];

export const LOW_G: StringDef[] = [
  { name: "G", freq: 196.0,  octaveLabel: "G3" },
  { name: "C", freq: 261.63, octaveLabel: "C4" },
  { name: "E", freq: 329.63, octaveLabel: "E4" },
  { name: "A", freq: 440.0,  octaveLabel: "A4" },
];

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

export function freqToMidi(f: number) { return 69 + 12 * Math.log2(f / 440); }
export function midiToFreq(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }

export function midiToNote(midi: number) {
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { name, octave, midi: rounded };
}

export function centsBetween(freq: number, targetHz: number): number {
  return 1200 * Math.log2(freq / targetHz);
}

export function nearestString(
  freq: number,
  strings: StringDef[]
): { string: StringDef; cents: number } | null {
  let best: { string: StringDef; cents: number } | null = null;
  for (const s of strings) {
    const cents = centsBetween(freq, s.freq);
    if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { string: s, cents };
  }
  return best;
}

/** Autocorrelation pitch detection. Returns Hz or -1 if no confident pitch. */
export function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

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

  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos <= 0) return -1;

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
