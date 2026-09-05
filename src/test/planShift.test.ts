import { describe, it, expect } from "vitest";
import { shiftedPlanWeek, planWeekNumberFor } from "@/hooks/useCoursePlan";
import { totalShiftWeeks, type BatchPlanShift } from "@/hooks/useBatchPlanShift";

/**
 * A class that loses a lesson falls a week behind the calendar, and should be
 * shown the week it hasn't done yet — not the one the calendar says.
 */
const weekOne = "2026-09-07"; // Monday of course week 1

describe("shiftedPlanWeek", () => {
  it("matches the plain week number when nothing has been missed", () => {
    for (const wk of ["2026-09-07", "2026-09-14", "2026-09-21"]) {
      expect(shiftedPlanWeek(weekOne, wk, 0)).toBe(planWeekNumberFor(weekOne, wk));
    }
  });

  it("repeats last week's material after one cancelled class", () => {
    // Calendar says week 3; with one week lost the class is due week 2.
    expect(planWeekNumberFor(weekOne, "2026-09-21")).toBe(3);
    expect(shiftedPlanWeek(weekOne, "2026-09-21", 1)).toBe(2);
  });

  it("stacks, so two cancellations put a class two weeks behind", () => {
    expect(shiftedPlanWeek(weekOne, "2026-09-21", 2)).toBe(1);
  });

  it("gives nothing rather than a week before the course began", () => {
    // Three weeks lost in a three-week-old course: week 1 hasn't happened yet.
    expect(shiftedPlanWeek(weekOne, "2026-09-21", 3)).toBeNull();
    expect(shiftedPlanWeek(weekOne, "2026-09-07", 1)).toBeNull();
  });

  it("still refuses dates before the course starts", () => {
    expect(shiftedPlanWeek(weekOne, "2026-08-31", 0)).toBeNull();
  });

  it("can be pulled forward again, which is how a mistake is undone", () => {
    expect(shiftedPlanWeek(weekOne, "2026-09-21", -1)).toBe(4);
  });
});

describe("totalShiftWeeks", () => {
  const shift = (weeks: number): BatchPlanShift => ({
    id: String(Math.random()), batch_id: "b1", weeks, reason: null, created_at: "2026-09-01",
  });

  it("is zero for a class that has missed nothing", () => {
    expect(totalShiftWeeks([])).toBe(0);
  });

  it("adds each disruption up", () => {
    expect(totalShiftWeeks([shift(1), shift(1), shift(1)])).toBe(3);
  });

  it("nets off a correction", () => {
    expect(totalShiftWeeks([shift(2), shift(-1)])).toBe(1);
  });
});
