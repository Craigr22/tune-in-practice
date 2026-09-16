import { describe, it, expect } from "vitest";
import { sessionsDone } from "@/hooks/useStudentProgress";
import type { PracticeLog } from "@/hooks/useStudentProgress";

/**
 * The number on the student's home page.
 *
 * It began as a run of consecutive days — which a plan with a rest day between
 * sessions can never keep — and then a run of consecutive sessions, which one
 * missed lesson wiped back to nothing. It is a plain total now: finishing a
 * session adds one, and nothing takes it away.
 */

const log = (played_on: string) => ({ played_on }) as PracticeLog;

describe("sessionsDone", () => {
  it("counts every session finished", () => {
    expect(sessionsDone(["2026-09-06", "2026-09-08", "2026-09-10"].map(log))).toBe(3);
  });

  it("is nothing before the first one", () => {
    expect(sessionsDone([])).toBe(0);
  });

  it("does not care about gaps", () => {
    // Weeks apart, and a lesson missed in between: the total still stands.
    expect(sessionsDone(["2026-09-06", "2026-10-15", "2026-12-01"].map(log))).toBe(3);
  });

  it("counts a day once, however many rows it has", () => {
    expect(sessionsDone(["2026-09-06", "2026-09-06", "2026-09-08"].map(log))).toBe(2);
  });
});
