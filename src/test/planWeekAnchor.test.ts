import { describe, it, expect } from "vitest";
import { planWeekOneStart, sessionDatesForWeek, classWeekStart } from "@/hooks/useWeeklyPlan";
import { planWeekNumberFor } from "@/hooks/useCoursePlan";

/**
 * Where a practice week starts, and what falls in it.
 *
 * A week runs lesson to lesson: it opens on the class day, and the two
 * practice sessions follow two and four days later. Anchoring on the Monday
 * instead used to split a Sunday class from the practice that follows it —
 * the lesson sat at the end of one calendar week and its practice at the
 * start of the next.
 */
describe("planWeekOneStart", () => {
  it("starts the course at the first lesson, not the date typed in", () => {
    // Wednesday start date, Sunday class → the course begins Sun 6 Sep.
    expect(planWeekOneStart("2026-09-02", 0)).toBe("2026-09-06");
  });

  it("keeps a start date that is already a class day", () => {
    expect(planWeekOneStart("2026-09-06", 0)).toBe("2026-09-06");
  });

  it("numbers week one 1 and the next week 2, for every class day", () => {
    for (let classDow = 0; classDow < 7; classDow++) {
      for (let i = 1; i <= 14; i++) {
        const iso = `2026-09-${String(i).padStart(2, "0")}`;
        const weekOne = planWeekOneStart(iso, classDow);

        // The course starts on a class day, on or after the date given.
        expect(new Date(`${weekOne}T00:00:00`).getDay()).toBe(classDow);
        expect(weekOne >= iso).toBe(true);

        expect(planWeekNumberFor(weekOne, weekOne)).toBe(1);
        expect(planWeekNumberFor(weekOne, sessionDatesForWeek(weekOne)[0])).toBe(1);
        expect(planWeekNumberFor(weekOne, classWeekStart(classDow, `${weekOne}T00:00:00`.slice(0, 10)))).toBe(1);
      }
    }
  });
});

describe("sessionDatesForWeek", () => {
  it("is the class day, then two days later, then four", () => {
    expect(sessionDatesForWeek("2026-09-06")).toEqual(["2026-09-06", "2026-09-08", "2026-09-10"]);
  });

  it("keeps every day of the week inside the week it belongs to", () => {
    for (let classDow = 0; classDow < 7; classDow++) {
      const weekOne = planWeekOneStart("2026-09-01", classDow);
      for (const d of sessionDatesForWeek(weekOne)) {
        // Two and four days on is always still this week — which is what the
        // Monday anchor could not promise.
        expect(classWeekStart(classDow, d)).toBe(weekOne);
      }
    }
  });
});

describe("classWeekStart", () => {
  it("holds the week open until the next lesson", () => {
    // Sunday class: everything from Sun 6th to Sat 12th is that week.
    expect(classWeekStart(0, "2026-09-06")).toBe("2026-09-06");
    expect(classWeekStart(0, "2026-09-10")).toBe("2026-09-06");
    expect(classWeekStart(0, "2026-09-12")).toBe("2026-09-06");
    expect(classWeekStart(0, "2026-09-13")).toBe("2026-09-13");
  });
});
