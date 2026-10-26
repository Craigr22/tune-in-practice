import { describe, expect, it } from "vitest";
import { HIGH_G, LOW_G, centsBetween, inAppBrowser, isRemoteMic, median, micErrorMessage, mpmPitch, nearestString, rms } from "@/lib/tuner";

const SR = 48000;
const N = 2048;

/** A plucked string: a fundamental with strong overtones, decaying. */
function pluck(freq: number, { amp = 0.3, harmonics = [1, 0.8, 0.6, 0.4, 0.25], noise = 0, offset = 0 } = {}) {
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = (i + offset) / SR;
    let v = 0;
    harmonics.forEach((h, k) => (v += h * Math.sin(2 * Math.PI * freq * (k + 1) * t + k)));
    b[i] = amp * v * Math.exp(-t * 2) + noise * (Math.random() * 2 - 1);
  }
  return b;
}

const within = (got: number | undefined, want: number, cents = 3) =>
  got != null && Math.abs(centsBetween(got, want)) <= cents;

describe("mpmPitch", () => {
  it("finds each ukulele string from a pure tone", () => {
    for (const s of [...HIGH_G, ...LOW_G]) {
      const r = mpmPitch(pluck(s.freq, { harmonics: [1] }), SR);
      expect(within(r?.freq, s.freq)).toBe(true);
    }
  });

  it("finds the fundamental of a plucked string, not an overtone", () => {
    for (const s of [...HIGH_G, ...LOW_G]) {
      const r = mpmPitch(pluck(s.freq), SR);
      expect(within(r?.freq, s.freq), `${s.octaveLabel} read as ${r?.freq}`).toBe(true);
    }
  });

  it("even when the second harmonic is louder than the fundamental", () => {
    const r = mpmPitch(pluck(196, { harmonics: [0.5, 1, 0.7, 0.3] }), SR);
    expect(within(r?.freq, 196)).toBe(true);
  });

  it("hears a very quiet string just as well as a loud one", () => {
    const r = mpmPitch(pluck(261.63, { amp: 0.002 }), SR);
    expect(within(r?.freq, 261.63)).toBe(true);
  });

  it("copes with a noisy room", () => {
    const r = mpmPitch(pluck(329.63, { amp: 0.2, noise: 0.05 }), SR);
    expect(within(r?.freq, 329.63, 6)).toBe(true);
  });

  it("reads a slightly flat string as flat by the right amount", () => {
    const flat = 440 * Math.pow(2, -20 / 1200); // 20 cents flat
    const r = mpmPitch(pluck(flat), SR);
    expect(Math.round(centsBetween(r!.freq, 440))).toBeGreaterThanOrEqual(-22);
    expect(Math.round(centsBetween(r!.freq, 440))).toBeLessThanOrEqual(-18);
    expect(nearestString(r!.freq, HIGH_G)?.string.name).toBe("A");
  });

  it("works at 44.1 kHz as well as 48 kHz", () => {
    const b = new Float32Array(N);
    for (let i = 0; i < N; i++) b[i] = 0.3 * Math.sin((2 * Math.PI * 392 * i) / 44100);
    expect(within(mpmPitch(b, 44100)?.freq, 392)).toBe(true);
  });

  it("says nothing for noise or silence", () => {
    const noise = new Float32Array(N).map(() => Math.random() * 2 - 1);
    expect(mpmPitch(noise, SR)).toBeNull();
    expect(mpmPitch(new Float32Array(N), SR)).toBeNull();
  });
});

describe("helpers", () => {
  it("measures level", () => {
    expect(rms(new Float32Array(100))).toBe(0);
    expect(rms(new Float32Array(100).fill(0.5))).toBeCloseTo(0.5);
  });
  it("takes the middle reading so one stray jump doesn't move the needle", () => {
    expect(median([440, 441, 880, 439, 440])).toBe(440);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("spots the in-app browsers that block the microphone", () => {
    expect(inAppBrowser("Mozilla/5.0 (iPhone) Instagram 300.0")).toBe("Instagram");
    expect(inAppBrowser("Mozilla/5.0 [FBAN/FBIOS;FBAV/400]")).toBe("Facebook");
    expect(inAppBrowser("Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1")).toBeNull();
  });
  it("recognises earbud and headset microphones", () => {
    expect(isRemoteMic("AirPods Pro")).toBe(true);
    expect(isRemoteMic("Bluetooth headset")).toBe(true);
    expect(isRemoteMic("iPhone Microphone")).toBe(false);
    expect(isRemoteMic("Default - MacBook Air Microphone (Built-in)")).toBe(false);
  });
  it("explains each way the microphone can fail", () => {
    const safari = "Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1";
    expect(micErrorMessage({ name: "NotAllowedError" }, safari)).toMatch(/blocked/);
    expect(micErrorMessage({ name: "NotReadableError" }, safari)).toMatch(/Another app/);
    expect(micErrorMessage({ name: "NotFoundError" }, safari)).toMatch(/No microphone/);
    expect(micErrorMessage({ name: "NotAllowedError" }, "Instagram 300")).toMatch(/inside Instagram/);
  });
});
