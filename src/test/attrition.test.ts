import { describe, expect, it } from "vitest";
import { attritionFor, attritionLine, courseWeekOf } from "@/lib/attrition";

const batch = { id: "b1", semester_start: "2026-10-04", day_of_week: 0 };
const row = (student_id: string, status: string, extra: object = {}) => ({ batch_id: "b1", student_id, status, ...extra });

describe("courseWeekOf", () => {
  it("counts weeks from the class's first lesson", () => {
    expect(courseWeekOf("2026-10-04", "2026-10-04", 0)).toBe(1);
    expect(courseWeekOf("2026-10-10", "2026-10-04", 0)).toBe(1);
    expect(courseWeekOf("2026-10-11", "2026-10-04", 0)).toBe(2);
    expect(courseWeekOf("2026-10-25", "2026-10-04", 0)).toBe(4);
  });
  it("has no week before the course, or without a start date", () => {
    expect(courseWeekOf("2026-09-30", "2026-10-04", 0)).toBeNull();
    expect(courseWeekOf("2026-10-11", null, 0)).toBeNull();
  });
});

describe("attritionFor", () => {
  it("is those who left, of everyone who has been in the class", () => {
    const a = attritionFor(
      [
        row("a", "active"), row("b", "active"), row("c", "active"),
        row("d", "dropped", { left_on: "2026-10-12", leave_reason: "Fees" }),
      ],
      batch,
    );
    expect(a.active).toBe(3);
    expect(a.left).toBe(1);
    expect(a.pct).toBe(25);
    expect(a.weeks).toEqual([2]);
  });

  it("lists the reasons, most common first", () => {
    const a = attritionFor(
      [
        row("a", "dropped", { leave_reason: "Fees" }),
        row("b", "dropped", { leave_reason: "Schedule clash" }),
        row("c", "dropped", { leave_reason: "Schedule clash" }),
        row("d", "dropped"),
      ],
      batch,
    );
    expect(a.reasons).toEqual([
      { reason: "Schedule clash", count: 2 },
      { reason: "Fees", count: 1 },
      { reason: "Not given", count: 1 },
    ]);
    expect(a.pct).toBe(100);
  });

  it("counts only its own class", () => {
    const a = attritionFor([row("a", "active"), { batch_id: "other", student_id: "z", status: "dropped" }], batch);
    expect(a.left).toBe(0);
    expect(a.pct).toBe(0);
  });

  it("doesn't count a paused student as having left", () => {
    const a = attritionFor([row("a", "active"), row("b", "paused")], batch);
    expect(a.left).toBe(0);
  });

  it("has no percentage for a class nobody has been in", () => {
    expect(attritionFor([], batch).pct).toBeNull();
  });
});

describe("attritionLine", () => {
  it("reads as a share, a count and the main reasons", () => {
    const a = attritionFor(
      [row("a", "active"), row("b", "active"), row("c", "dropped", { leave_reason: "Fees" })],
      batch,
    );
    expect(attritionLine(a)).toBe("33% · 1 left (Fees)");
    expect(attritionLine(attritionFor([row("a", "active")], batch))).toBe("0%");
    expect(attritionLine(attritionFor([], batch))).toBe("—");
  });
});
