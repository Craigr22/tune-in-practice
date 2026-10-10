import { describe, expect, it } from "vitest";
import { batchStats, sessionDatesBetween } from "@/lib/batchStats";

// A Sunday class that began on Sunday 4 October 2026.
const base = { classDow: 0, courseStart: "2026-10-04", grades: [] as { student_id: string; self_badge: number | null }[] };
const log = (student_id: string, played_on: string, tickedOn = played_on) => ({
  student_id,
  played_on,
  created_at: `${tickedOn}T10:00:00`,
});

describe("sessionDatesBetween", () => {
  it("is the class day and the practice two and four days after, up to today", () => {
    expect(sessionDatesBetween("2026-10-04", "2026-10-12")).toEqual([
      "2026-10-04", "2026-10-06", "2026-10-08", "2026-10-11",
    ]);
  });
});

describe("batchStats", () => {
  const students = [{ id: "a" }, { id: "b" }];

  it("measures sessions done against the calendar, not against rows that exist", () => {
    // Three sessions due each by the 8th. A has done all three; B, who has
    // never opened the app, none — and still counts as owing three.
    const s = batchStats({
      ...base, students, today: "2026-10-08",
      logs: [log("a", "2026-10-04"), log("a", "2026-10-06"), log("a", "2026-10-08")],
    });
    expect(s.done).toBe(50);
    expect(s.active).toBe(50);
  });

  it("reads this week separately from the whole course", () => {
    // Week two has one session due (the class on the 11th). A did it.
    const s = batchStats({
      ...base, students: [{ id: "a" }], today: "2026-10-11",
      logs: [log("a", "2026-10-11")],
    });
    expect(s.thisWeek).toBe(100);
    expect(s.done).toBe(25);
  });

  it("counts a session ticked days later as done but not on time", () => {
    const s = batchStats({
      ...base, students: [{ id: "a" }], today: "2026-10-10",
      logs: [log("a", "2026-10-04"), log("a", "2026-10-06", "2026-10-10")],
    });
    expect(s.done).toBe(67);
    expect(s.onTime).toBe(50);
  });

  it("allows the day after as on time", () => {
    const s = batchStats({ ...base, students: [{ id: "a" }], today: "2026-10-08", logs: [log("a", "2026-10-06", "2026-10-07")] });
    expect(s.onTime).toBe(100);
  });

  it("owes a late joiner only the sessions since they joined", () => {
    const s = batchStats({
      ...base, students: [{ id: "a", joined_on: "2026-10-08" }], today: "2026-10-08",
      logs: [log("a", "2026-10-08")],
    });
    expect(s.done).toBe(100);
  });

  it("turns students' own grades into a share of the top grade", () => {
    const s = batchStats({
      ...base, students, today: "2026-10-08", logs: [],
      grades: [{ student_id: "a", self_badge: 4 }, { student_id: "b", self_badge: 2 }, { student_id: "z", self_badge: 5 }],
    });
    expect(s.confidence).toBe(60);
  });

  it("says nothing rather than zero where there is nothing to measure", () => {
    const none = batchStats({ ...base, students, today: "2026-10-08", logs: [] });
    expect(none.done).toBe(0);
    expect(none.onTime).toBeNull();
    expect(none.confidence).toBeNull();

    const notStarted = batchStats({ ...base, courseStart: "2026-11-01", students, today: "2026-10-08", logs: [] });
    expect(notStarted.done).toBeNull();
    const empty = batchStats({ ...base, students: [], today: "2026-10-08", logs: [] });
    expect(empty.done).toBeNull();
  });

  it("ignores practice by students who aren't in the class", () => {
    const s = batchStats({ ...base, students: [{ id: "a" }], today: "2026-10-04", logs: [log("z", "2026-10-04")] });
    expect(s.done).toBe(0);
  });
});
