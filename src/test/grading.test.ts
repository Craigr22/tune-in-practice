import { describe, expect, it } from "vitest";
import { isMastered, songGrade, songsToGrade } from "@/lib/grading";

const week = (done: boolean[]) => [
  { id: "class", scheduled_date: "2026-10-04", song_id: "sunshine", completed: done[0] },
  { id: "p1", scheduled_date: "2026-10-06", song_id: "sunshine", completed: done[1] },
  { id: "p2", scheduled_date: "2026-10-08", song_id: "piyu-bole", completed: done[2] },
];

describe("songsToGrade", () => {
  it("asks only on the last session before the next class", () => {
    expect(songsToGrade(week([true, false, false]), "class")).toEqual([]);
    expect(songsToGrade(week([true, true, false]), "p1")).toEqual([]);
    expect(songsToGrade(week([true, true, true]), "p2")).toEqual(["sunshine", "piyu-bole"]);
  });

  it("counts the session just ticked even before the list has caught up", () => {
    expect(songsToGrade(week([true, true, false]), "p2")).toEqual(["sunshine", "piyu-bole"]);
  });

  it("leaves out a song whose sessions were skipped", () => {
    expect(songsToGrade(week([false, false, false]), "p2")).toEqual(["piyu-bole"]);
  });

  it("asks about each song once", () => {
    expect(songsToGrade(week([true, true, true]), "p2").filter((s) => s === "sunshine")).toHaveLength(1);
  });

  it("has nothing to ask about an empty week", () => {
    expect(songsToGrade([], "p2")).toEqual([]);
  });
});

describe("mastery", () => {
  it("is the student's own grade, at Cheetah or Eagle", () => {
    expect(isMastered({ self_badge: 3 })).toBe(false);
    expect(isMastered({ self_badge: 4 })).toBe(true);
    expect(isMastered({ self_badge: 5 })).toBe(true);
    expect(isMastered({ self_badge: null })).toBe(false);
    expect(isMastered(undefined)).toBe(false);
  });

  it("goes away when a song is graded back down", () => {
    const row = { self_badge: 5 as number | null };
    expect(isMastered(row)).toBe(true);
    row.self_badge = 3;
    expect(isMastered(row)).toBe(false);
  });

  it("ignores a teacher's old rating", () => {
    expect(isMastered({ self_badge: null, teacher_badge: 5 } as any)).toBe(false);
    expect(songGrade({ self_badge: 2, teacher_badge: 5 } as any)).toBe(2);
  });
});
