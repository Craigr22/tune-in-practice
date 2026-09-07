import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeStreak } from "@/hooks/useStudentProgress";
import { sessionDatesUpTo } from "@/lib/practiceWeek";
import type { PracticeLog } from "@/hooks/useStudentProgress";

/**
 * A streak over practice sessions, not calendar days.
 *
 * The plan puts a rest day between sessions on purpose, so counting
 * consecutive days meant the day off always broke the run: a student who did
 * every session they were given still saw a streak of 1.
 */

// A Sunday class: lessons on Sundays, practice on Tuesdays and Thursdays.
const SUNDAY = 0;
const schedule = { classDayOfWeek: SUNDAY, courseStart: "2026-09-06" };

const log = (played_on: string) => ({ played_on }) as PracticeLog;

/** Freeze "today" — computeStreak reads the clock. */
const on = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${iso}T09:00:00`));
};

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.useRealTimers());

describe("sessionDatesUpTo", () => {
  it("is the lesson and the two days after it, newest first", () => {
    expect(sessionDatesUpTo("2026-09-17", schedule)).toEqual([
      "2026-09-17", // Thu, week of Sun 13th
      "2026-09-15", // Tue
      "2026-09-13", // the lesson
      "2026-09-10", // Thu, week of Sun 6th
      "2026-09-08", // Tue
      "2026-09-06", // the first lesson
    ]);
  });

  it("never reaches back before the first lesson", () => {
    expect(sessionDatesUpTo("2026-09-09", schedule)).toEqual(["2026-09-08", "2026-09-06"]);
  });

  it("skips a day the week has not reached yet", () => {
    // Wednesday: Tuesday has been and gone, Thursday has not.
    expect(sessionDatesUpTo("2026-09-09", schedule)).not.toContain("2026-09-10");
  });
});

describe("computeStreak", () => {
  it("counts sessions in a row across the rest day between them", () => {
    on("2026-09-17");
    const logs = ["2026-09-06", "2026-09-08", "2026-09-10", "2026-09-13", "2026-09-15", "2026-09-17"].map(log);

    // Six sessions — two lessons and four practice days — none missed. The
    // days off in between are not gaps.
    expect(computeStreak(logs, schedule)).toBe(6);
  });

  it("used to be capped at 1 by the rest day", () => {
    on("2026-09-17");
    const logs = ["2026-09-06", "2026-09-08", "2026-09-10", "2026-09-13", "2026-09-15", "2026-09-17"].map(log);

    // Without a schedule it falls back to consecutive calendar days, which is
    // what made the counter useless for a three-day-a-week plan.
    expect(computeStreak(logs)).toBe(1);
  });

  it("breaks on a session that was missed", () => {
    on("2026-09-17");
    const logs = ["2026-09-08", "2026-09-10", "2026-09-13", "2026-09-17"].map(log); // missed the 15th

    expect(computeStreak(logs, schedule)).toBe(1);
  });

  it("does not count today's session as missed before the day is out", () => {
    on("2026-09-17"); // a practice day, not yet ticked
    const logs = ["2026-09-06", "2026-09-08", "2026-09-10", "2026-09-13", "2026-09-15"].map(log);

    expect(computeStreak(logs, schedule)).toBe(5);
  });

  it("counts the lesson, so being there keeps the run going", () => {
    on("2026-09-15"); // Tuesday, not yet ticked
    const logs = ["2026-09-08", "2026-09-10", "2026-09-13"].map(log);

    // The Sunday lesson is the week's first session, not a gap in the middle.
    expect(computeStreak(logs, schedule)).toBe(3);
  });

  it("breaks when a lesson was missed", () => {
    on("2026-09-15");
    const logs = ["2026-09-08", "2026-09-10"].map(log); // did not turn up on the 13th

    expect(computeStreak(logs, schedule)).toBe(0);
  });

  it("is zero with nothing logged", () => {
    on("2026-09-17");
    expect(computeStreak([], schedule)).toBe(0);
  });
});
