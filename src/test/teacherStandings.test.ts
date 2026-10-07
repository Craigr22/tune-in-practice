import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ supabase: {} }));
vi.mock("@/hooks/useTeacherMe", () => ({ useTeacherMe: () => ({ data: null }) }));

import { sessionCounts, standings } from "@/hooks/useTeacherStudents";
import { classWhen } from "@/lib/classLabel";

const log = (student_id: string, played_on: string) => ({ student_id, played_on });

describe("sessionCounts", () => {
  it("counts a day once however many logs it has", () => {
    const counts = sessionCounts([log("a", "2026-10-04"), log("a", "2026-10-04"), log("a", "2026-10-06"), log("b", "2026-10-04")]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(counts.get("c")).toBeUndefined();
  });
});

describe("standings", () => {
  const students = [
    { id: "a", name: "Amit" },
    { id: "b", name: "Renuka" },
    { id: "c", name: "Elroy" },
    { id: "d", name: "Payal" },
  ];

  it("lists every student, most sessions first, including those on none", () => {
    const rows = standings(students, new Map([["b", 5], ["a", 2]]));
    expect(rows.map((r) => [r.name, r.sessions])).toEqual([["Renuka", 5], ["Amit", 2], ["Elroy", 0], ["Payal", 0]]);
  });

  it("gives tied students the same place and skips the next", () => {
    const rows = standings(students, new Map([["a", 4], ["b", 4], ["c", 1]]));
    expect(rows.map((r) => r.place)).toEqual([1, 1, 3, 4]);
  });
});

describe("classWhen", () => {
  it("reads as a day and a clock time", () => {
    expect(classWhen({ day_of_week: 6, start_time: "10:00:00" })).toBe("Saturday · 10:00 AM");
    expect(classWhen({ day_of_week: 0, start_time: "17:30:00" })).toBe("Sunday · 5:30 PM");
    expect(classWhen({ day_of_week: 0, start_time: null })).toBe("Sunday");
  });
});
