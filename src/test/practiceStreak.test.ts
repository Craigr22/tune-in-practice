import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeStreak } from "@/hooks/useStudentProgress";
import { practiceDatesUpTo } from "@/lib/practiceWeek";
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

describe("practiceDatesUpTo", () => {
  it("is the two days after each lesson, newest first", () => {
    expect(practiceDatesUpTo("2026-09-17", schedule)).toEqual([
      "2026-09-17", // Thu, week of Sun 13th
      "2026-09-15", // Tue
      "2026-09-10", // Thu, week of Sun 6th
      "2026-09-08", // Tue
    ]);
  });

  it("never reaches back before the first lesson", () => {
    expect(practiceDatesUpTo("2026-09-09", schedule)).toEqual(["2026-09-08"]);
  });

  it("skips a day the week has not reached yet", () => {
    // Wednesday: Tuesday has been and gone, Thursday has not.
    expect(practiceDatesUpTo("2026-09-09", schedule)).not.toContain("2026-09-10");
  });
});

describe("computeStreak", () => {
  it("counts sessions in a row across the rest day between them", () => {
    on("2026-09-17");
    const logs = ["2026-09-08", "2026-09-10", "2026-09-15", "2026-09-17"].map(log);

    // Four sessions, none missed — the day off in between is not a gap.
    expect(computeStreak(logs, schedule)).toBe(4);
  });

  it("used to be capped at 1 by the rest day", () => {
    on("2026-09-17");
    const logs = ["2026-09-08", "2026-09-10", "2026-09-15", "2026-09-17"].map(log);

    // Without a schedule it falls back to consecutive calendar days, which is
    // what made the counter useless for a three-day-a-week plan.
    expect(computeStreak(logs)).toBe(1);
  });

  it("breaks on a session that was missed", () => {
    on("2026-09-17");
    const logs = ["2026-09-08", "2026-09-10", "2026-09-17"].map(log); // missed the 15th

    expect(computeStreak(logs, schedule)).toBe(1);
  });

  it("does not count today's session as missed before the day is out", () => {
    on("2026-09-17"); // a practice day, not yet done
    const logs = ["2026-09-08", "2026-09-10", "2026-09-15"].map(log);

    expect(computeStreak(logs, schedule)).toBe(3);
  });

  it("ignores the lesson day, which asks for no practice", () => {
    on("2026-09-13"); // a Sunday — class, no practice expected
    const logs = ["2026-09-08", "2026-09-10"].map(log);

    expect(computeStreak(logs, schedule)).toBe(2);
  });

  it("is zero with nothing logged", () => {
    on("2026-09-17");
    expect(computeStreak([], schedule)).toBe(0);
  });
});
