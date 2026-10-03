import { describe, expect, it } from "vitest";
import { chickStage, tierForWeek } from "@/lib/chick";

const at = (week: number | null, tier: any = "beginner", lastWeek: number | null = 24) =>
  chickStage({ week, tier, lastWeek });

describe("chickStage", () => {
  it("is a plain egg before the course and for the first class", () => {
    expect(at(null)).toBe("egg");
    expect(at(1)).toBe("egg");
  });

  it("cracks for the second and third classes", () => {
    expect(at(2)).toBe("cracked");
    expect(at(3)).toBe("cracked");
  });

  it("hatches at the fourth class and stays hatching through Advanced Beginner", () => {
    expect(at(4)).toBe("hatching");
    expect(at(7, "beginner")).toBe("hatching");
    expect(at(12, "adv-beginner")).toBe("hatching");
  });

  it("is the full chick after Advanced Beginner", () => {
    expect(at(14, "casual")).toBe("chick");
    expect(at(18, "fingerstyle")).toBe("chick");
  });

  it("graduates in the last four weeks", () => {
    expect(at(20, "casual")).toBe("chick");
    expect(at(21, "casual")).toBe("graduate");
    expect(at(24, "fingerstyle")).toBe("graduate");
    expect(at(26, "fingerstyle")).toBe("graduate");
  });

  it("doesn't graduate a class because the plan is only written a few weeks out", () => {
    expect(at(5, "beginner", 6)).toBe("hatching");
    expect(at(3, "beginner", 4)).toBe("cracked");
  });
});

describe("tierForWeek", () => {
  const days = [
    { week_number: 1, tier: "beginner" as const },
    { week_number: 5, tier: "adv-beginner" as const },
  ];
  it("uses the week's own stage, or the last planned one before it", () => {
    expect(tierForWeek(days, 1)).toBe("beginner");
    expect(tierForWeek(days, 3)).toBe("beginner");
    expect(tierForWeek(days, 9)).toBe("adv-beginner");
    expect(tierForWeek([], 3)).toBeNull();
    expect(tierForWeek(days, null)).toBeNull();
  });
});
