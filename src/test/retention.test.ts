import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeRetention } from "@/lib/retention";

describe("computeRetention", () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-09-10T12:00:00Z")));
  afterEach(() => vi.useRealTimers());

  it("does not treat a missing last-seen value as a negative signal", () => {
    const result = computeRetention(
      [{ played_on: "2026-09-09", duration_min: 20 }],
      [],
      null,
    );
    expect(result.signals.staleApp).toBe(false);
    expect(result.flag).toBe("green");
  });

  it("flags a genuinely stale app visit", () => {
    const result = computeRetention(
      [{ played_on: "2026-09-09", duration_min: 20 }],
      [],
      "2026-08-30T12:00:00Z",
    );
    expect(result.signals.daysSinceLastOpen).toBe(11);
    expect(result.signals.staleApp).toBe(true);
    expect(result.flag).toBe("amber");
  });
});
