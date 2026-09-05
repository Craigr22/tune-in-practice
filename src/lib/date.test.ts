import { describe, it, expect } from "vitest";
import { onOrAfterDayOfWeek, toLocalIso, isoMondayOf, addDaysIso } from "./date";

describe("onOrAfterDayOfWeek", () => {
  // 2026-09-02 is a Wednesday; 2026-09-06 the Sunday after it.
  it("moves a Wednesday forward to the class's Sunday", () => {
    expect(onOrAfterDayOfWeek("2026-09-02", 0)).toBe("2026-09-06");
  });

  it("leaves a date that already falls on the class day", () => {
    expect(onOrAfterDayOfWeek("2026-09-06", 0)).toBe("2026-09-06");
  });

  it("never moves back a week — Monday class, Sunday pick", () => {
    // 2026-09-06 Sun -> next Mon is the 7th, not the 31st.
    expect(onOrAfterDayOfWeek("2026-09-06", 1)).toBe("2026-09-07");
  });

  it("crosses a month boundary", () => {
    // 2026-09-30 is a Wednesday; the next Friday is in October.
    expect(onOrAfterDayOfWeek("2026-09-30", 5)).toBe("2026-10-02");
  });

  it("lands on the right weekday for every possible pick", () => {
    for (let dow = 0; dow < 7; dow++) {
      for (let i = 0; i < 14; i++) {
        const from = addDaysIso("2026-09-01", i);
        const got = onOrAfterDayOfWeek(from, dow);
        expect(new Date(`${got}T00:00:00`).getDay()).toBe(dow);
        expect(got >= from).toBe(true);
        // Always the *first* such day, so never more than a week away.
        expect(new Date(`${got}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime())
          .toBeLessThan(7 * 86_400_000);
      }
    }
  });

  it("passes an unparseable date through untouched", () => {
    expect(onOrAfterDayOfWeek("", 0)).toBe("");
  });
});

describe("local dates", () => {
  it("uses local components, not UTC", () => {
    // Late-evening local time is already the next day in UTC east of Greenwich;
    // toISOString() would report the wrong calendar day.
    expect(toLocalIso(new Date(2026, 8, 4, 23, 30))).toBe("2026-09-04");
  });

  it("finds the Monday of a week, and is stable on Monday itself", () => {
    expect(isoMondayOf("2026-09-06")).toBe("2026-08-31"); // Sunday -> that week's Monday
    expect(isoMondayOf("2026-08-31")).toBe("2026-08-31");
  });
});
