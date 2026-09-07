import { describe, expect, it } from "vitest";
import { calendarQueryRange, sessionDateTimes } from "@/lib/calendar";

describe("calendar helpers", () => {
  it("normalizes week and month range shapes", () => {
    expect(calendarQueryRange([
      new Date(2026, 8, 7),
      new Date(2026, 8, 13),
    ])).toEqual({ start: "2026-09-07", end: "2026-09-13" });

    expect(calendarQueryRange({
      start: new Date(2026, 8, 1),
      end: new Date(2026, 8, 30),
    })).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });

  it("uses session overrides and local date-only parsing", () => {
    const { start, end } = sessionDateTimes("2026-09-10", "18:30:00", 45);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(10);
    expect(start.getHours()).toBe(18);
    expect(start.getMinutes()).toBe(30);
    expect(end.getTime() - start.getTime()).toBe(45 * 60_000);
  });
});
