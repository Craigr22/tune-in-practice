import { describe, it, expect } from "vitest";
import { HIGH_G, LOW_G, nearestString, centsBetween } from "./tuner";

/**
 * A ukulele tuner answers one question: which of the four strings is this,
 * and which way do I turn the peg? It never reports a chromatic note like
 * F# — there is no F# string to tune.
 */
describe("nearestString", () => {
  it("names each string when it's exactly in tune", () => {
    for (const s of HIGH_G) {
      const m = nearestString(s.freq, HIGH_G)!;
      expect(m.string.name).toBe(s.name);
      expect(Math.round(m.cents)).toBe(0);
    }
  });

  it("still names the string when it's a long way out", () => {
    // A slack C string sitting a whole tone flat (~233 Hz) is still the C.
    const m = nearestString(233.08, HIGH_G)!;
    expect(m.string.name).toBe("C");
    expect(m.cents).toBeLessThan(-100);
  });

  it("tells flat from sharp by sign", () => {
    expect(nearestString(430, HIGH_G)!.cents).toBeLessThan(0); // below A440 → tighten
    expect(nearestString(450, HIGH_G)!.cents).toBeGreaterThan(0); // above → loosen
  });

  it("never returns a note that isn't a string", () => {
    const names = new Set(HIGH_G.map((s) => s.name));
    // Sweep the ukulele's range in 5 Hz steps; every reading is G, C, E or A.
    for (let f = 180; f <= 500; f += 5) {
      expect(names.has(nearestString(f, HIGH_G)!.string.name)).toBe(true);
    }
  });

  it("picks the truly nearest string, not merely a close one", () => {
    // 300 Hz sits between C4 (261.63) and E4 (329.63); E is nearer in cents.
    const m = nearestString(300, HIGH_G)!;
    const toC = Math.abs(centsBetween(300, 261.63));
    const toE = Math.abs(centsBetween(300, 329.63));
    expect(toE).toBeLessThan(toC);
    expect(m.string.name).toBe("E");
  });

  it("follows the low-G tuning when that's selected", () => {
    // 196 Hz is the low G; under high-G tuning nothing sits near it.
    expect(nearestString(196, LOW_G)!.string.name).toBe("G");
    expect(Math.round(nearestString(196, LOW_G)!.cents)).toBe(0);
  });
});
