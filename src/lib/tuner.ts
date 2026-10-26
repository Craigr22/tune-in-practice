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

/* ============================================================
   McLeod pitch method — the detector the tuner uses now.

   Autocorrelation on its own picks whichever repeat is strongest, and on a
   plucked string that is often the second or third harmonic, so the reading
   jumped an octave or landed on the wrong string. The normalised version
   below scores every candidate period from -1 to 1 regardless of how loud
   the note is, and takes the first one that is nearly as good as the best —
   the fundamental, not a harmonic. It also only searches the range a
   ukulele can play, which makes it several times cheaper than before.
============================================================ */

export interface PitchReading {
  freq: number;
  /** 0–1: how sure the detector is that the sound has this pitch. */
  clarity: number;
}

export function mpmPitch(
  buf: Float32Array,
  sampleRate: number,
  { minHz = 80, maxHz = 1000, threshold = 0.9, minClarity = 0.75 } = {},
): PitchReading | null {
  const N = buf.length;
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(N - 1, Math.ceil(sampleRate / minHz));
  if (maxLag <= minLag + 2) return null;

  // Normalised square difference for each candidate period.
  const nsdf = new Float32Array(maxLag + 2);
  for (let tau = 0; tau <= maxLag + 1; tau++) {
    let acf = 0;
    let m = 0;
    for (let j = 0; j < N - tau; j++) {
      const a = buf[j];
      const b = buf[j + tau];
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }

  // The highest point of each stretch where the score is above zero.
  const peaks: number[] = [];
  let tau = minLag;
  while (tau < maxLag && nsdf[tau] > 0) tau++; // leave the zero-lag hump
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++;
    let best = -1;
    while (tau < maxLag && nsdf[tau] > 0) {
      if (best < 0 || nsdf[tau] > nsdf[best]) best = tau;
      tau++;
    }
    if (best > 0) peaks.push(best);
  }
  if (!peaks.length) return null;

  const highest = Math.max(...peaks.map((p) => nsdf[p]));
  if (highest < minClarity) return null;
  const chosen = peaks.find((p) => nsdf[p] >= threshold * highest) ?? peaks[0];

  // Between samples: fit a parabola through the peak and its neighbours.
  const x1 = nsdf[chosen - 1];
  const x2 = nsdf[chosen];
  const x3 = nsdf[chosen + 1];
  const denom = x1 - 2 * x2 + x3;
  const shift = denom !== 0 ? (0.5 * (x1 - x3)) / denom : 0;
  const period = chosen + Math.max(-1, Math.min(1, shift));
  const freq = sampleRate / period;
  if (freq < minHz || freq > maxHz) return null;
  return { freq, clarity: x2 };
}

/** Root-mean-square level of a buffer: how loud it is, 0 for silence. */
export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

/** The middle of a few recent readings: one stray jump doesn't move the needle. */
export function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Whether the page is inside an app's own browser — Instagram, Facebook,
 * LinkedIn and the like — which usually won't hand a web page the
 * microphone at all.
 */
export function inAppBrowser(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): string | null {
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  if (/\bLine\//i.test(ua)) return "Line";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/WhatsApp/i.test(ua)) return "WhatsApp";
  return null;
}

/** A microphone that isn't the phone's own: earbuds, a headset, a car. */
export const isRemoteMic = (label: string) => /bluetooth|airpods|buds|headset|hands-?free|bt\b|car/i.test(label);

/** What to tell a student when the browser won't give the tuner a microphone. */
export function micErrorMessage(e: unknown, ua?: string): string {
  const app = inAppBrowser(ua);
  if (app) return `The tuner can't use the microphone inside ${app}. Open this page in Chrome or Safari instead.`;
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || /denied|permission/i.test(String((e as Error)?.message ?? ""))) {
    return "The microphone is blocked. Allow it for this site in your browser settings, then tap Start again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found on this device.";
  if (name === "NotReadableError" || name === "AbortError") {
    return "Another app is using the microphone. Close it (a call, a voice note, another tuner) and tap Start again.";
  }
  if (name === "Unsupported") return "This browser can't use the microphone. Open this page in Chrome or Safari.";
  return "The tuner couldn't start the microphone. Tap Start to try again.";
}
