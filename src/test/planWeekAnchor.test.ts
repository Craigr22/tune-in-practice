import { describe, it, expect } from "vitest";
import { planWeekOneMonday, practiceDaysForWeek } from "@/hooks/useWeeklyPlan";
import { planWeekNumberFor } from "@/hooks/useCoursePlan";

/**
 * Which calendar week is course week 1.
 *
 * Practice never runs before the class's start date, so anchoring on the
 * calendar week that merely *contains* the start date can burn week 1 with no
 * sessions in it — the student then gets week 2's material (and week 2's
 * videos) in their first real week of practice.
 */
describe("planWeekOneMonday", () => {
  // Sunday class: practice falls Mon/Wed/Fri, all before a Sunday start.
  it("skips a week that has no practice left in it", () => {
    // 2026-09-06 is a Sunday; its week begins Mon 2026-08-31.
    expect(planWeekOneMonday("2026-09-06", 0)).toBe("2026-09-07");
  });

  it("keeps the start's own week when practice still falls in it", () => {
    // Monday start, Sunday class: Mon 7th is itself a practice day.
    expect(planWeekOneMonday("2026-09-07", 0)).toBe("2026-09-07");
  });

  it("makes the first practice day land in week 1, for every class day", () => {
    for (let classDow = 0; classDow < 7; classDow++) {
      for (let i = 0; i < 14; i++) {
        const start = new Date(2026, 8, 1 + i);
        const iso = `${start.getFullYear()}-09-${String(start.getDate()).padStart(2, "0")}`;
        if (start.getMonth() !== 8) continue;

        const weekOne = planWeekOneMonday(iso, classDow);
        const inWeekOne = practiceDaysForWeek(weekOne, classDow).filter((d) => d >= iso);

        // Week 1 always contains at least one real practice day...
        expect(inWeekOne.length).toBeGreaterThan(0);
        // ...and it is numbered 1, not 2.
        expect(planWeekNumberFor(weekOne, weekOne)).toBe(1);
      }
    }
  });

  it("numbers the following week 2", () => {
    const weekOne = planWeekOneMonday("2026-09-06", 0);
    expect(planWeekNumberFor(weekOne, "2026-09-14")).toBe(2);
  });
});
