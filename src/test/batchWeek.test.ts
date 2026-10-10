import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ supabase: {} }));

import { weekLabel } from "@/hooks/useBatchWeek";

describe("weekLabel", () => {
  it("says the week a class is on, out of the plan", () => {
    expect(weekLabel({ start: "2026-09-06", currentWeek: 3, totalWeeks: 12 })).toBe("Week 3 of 12");
  });
  it("says so when a class hasn't a start date, or hasn't begun", () => {
    expect(weekLabel({ start: null, currentWeek: null, totalWeeks: 12 })).toBe("Not started");
    expect(weekLabel({ start: "2026-11-01", currentWeek: null, totalWeeks: 12 })).toBe("Starts 2026-11-01");
  });
  it("says so when a class has run past the end of the plan", () => {
    expect(weekLabel({ start: "2026-01-04", currentWeek: 14, totalWeeks: 12 })).toBe("Past the 12-week plan");
  });
  it("still gives the week when no plan is written", () => {
    expect(weekLabel({ start: "2026-09-06", currentWeek: 3, totalWeeks: 0 })).toBe("Week 3");
  });
});
