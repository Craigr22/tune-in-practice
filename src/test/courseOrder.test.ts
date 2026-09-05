import { describe, it, expect } from "vitest";
import { courseOrder, withHorizon, type CoursePlanDay } from "@/hooks/useCoursePlan";
import { BEGINNER_ORDER } from "@/data/courseOrder";

const day = (week: number, dayNo: number, songId: string | null, tier = "beginner"): CoursePlanDay =>
  ({
    id: `${week}-${dayNo}`, instrument: "ukulele", week_number: week, day_number: dayNo,
    class_topic: null, focus_song_id: songId, warmup_instruction: "", focus_instruction: "",
    bonus_instruction: "", video_ids: [], video_notes: {}, tier,
  } as CoursePlanDay);

// The plan as it stands: three weeks, one song each.
const plan = [
  day(1, 1, "sunshine"), day(1, 2, "sunshine"),
  day(2, 1, "piyu-bole"), day(2, 3, "piyu-bole"),
  day(3, 1, "photograph"),
];

describe("courseOrder", () => {
  it("follows the plan for the weeks that have one", () => {
    const planned = courseOrder(plan, BEGINNER_ORDER).filter((s) => s.planned);
    expect(planned.map((s) => s.songId)).toEqual(["sunshine", "piyu-bole", "photograph"]);
    expect(planned.map((s) => s.week)).toEqual([1, 2, 3]);
  });

  it("places a song at the first week teaching it, not a later revisit", () => {
    const withRevisit = [...plan, day(4, 1, "sunshine")];
    expect(courseOrder(withRevisit, BEGINNER_ORDER).find((s) => s.songId === "sunshine")!.week).toBe(1);
  });

  it("carries on in the beginner order once the plan runs out", () => {
    const after = courseOrder(plan, BEGINNER_ORDER).filter((s) => !s.planned);
    expect(after.map((s) => s.songId)).toEqual([
      "im-yours", "kaisi-paheli", "kho-gaye", "over-rainbow", "jab-koi-baat", "riptide", "sham",
    ]);
  });

  it("projects a week each for the unplanned ones, continuing from the plan", () => {
    const after = courseOrder(plan, BEGINNER_ORDER).filter((s) => !s.planned);
    expect(after.map((s) => s.week)).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });

  it("never lists a song twice", () => {
    const ids = courseOrder(plan, BEGINNER_ORDER).map((s) => s.songId);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("falls back to the beginner order alone when nothing is planned", () => {
    expect(courseOrder([], BEGINNER_ORDER).map((s) => s.songId)).toEqual([
      "sunshine", "piyu-bole", "photograph", "im-yours", "kaisi-paheli",
      "kho-gaye", "over-rainbow", "jab-koi-baat", "riptide", "sham",
    ]);
  });
});

describe("withHorizon", () => {
  const stops = courseOrder(plan, BEGINNER_ORDER);
  const at = (week: number | null) => withHorizon(stops, week);
  const inReach = (week: number | null) => at(week).filter((s) => !s.upcoming).map((s) => s.songId);

  it("keeps every song on the map, however far out it is", () => {
    for (const week of [null, 0, 1, 5, 99]) {
      expect(at(week)).toHaveLength(stops.length);
    }
  });

  it("greys out anything more than two weeks ahead", () => {
    const upcoming = at(3).filter((s) => s.upcoming);
    expect(upcoming.every((s) => s.week > 5)).toBe(true);
  });

  it("has weeks 1 and 2 in reach before the course starts", () => {
    expect(inReach(null)).toEqual(["sunshine", "piyu-bole"]);
  });

  it("brings one more song into reach as each week passes", () => {
    expect(inReach(1).length).toBeLessThan(inReach(2).length);
    expect(inReach(2).length).toBeLessThan(inReach(3).length);
  });

  it("never puts a song out of reach that is within two weeks", () => {
    for (let week = 0; week <= 12; week++) {
      for (const s of at(week)) {
        expect(s.upcoming).toBe(s.week > week + 2);
      }
    }
  });
});

describe("courseOrder with the rest of the catalogue", () => {
  it("appends everything else after the beginner course, in order", () => {
    const rest = [
      { songId: "yellow", tier: "casual" as const },
      { songId: "riptide", tier: "casual" as const }, // already in BEGINNER_ORDER
    ];
    const stops = courseOrder(plan, BEGINNER_ORDER, { rest });
    const ids = stops.map((s) => s.songId);
    expect(ids).toContain("yellow");
    expect(ids.filter((i) => i === "riptide")).toHaveLength(1);
    expect(ids.indexOf("yellow")).toBeGreaterThan(ids.indexOf("sham"));
  });

  it("gives every song its own week, none shared", () => {
    const stops = courseOrder(plan, BEGINNER_ORDER, {
      rest: [{ songId: "yellow", tier: "casual" as const }],
    });
    const later = stops.filter((s) => !s.planned).map((s) => s.week);
    expect(new Set(later).size).toBe(later.length);
  });
});

describe("hiding an upcoming song's name", () => {
  // Mirrors maskTitle in Journey: the shape of the name, not the name.
  const maskTitle = (title: string) =>
    title.split(/\s+/).map((w) => "▪".repeat(Math.min(w.length, 8))).join(" ");

  it("gives nothing of the name away", () => {
    for (const t of ["Piyu Bole", "You Are My Sunshine", "Riptide"]) {
      expect(maskTitle(t)).not.toMatch(/[a-z]/i);
    }
  });

  it("keeps the word count, so the card doesn't reflow when it opens up", () => {
    expect(maskTitle("You Are My Sunshine").split(" ")).toHaveLength(4);
    expect(maskTitle("Riptide").split(" ")).toHaveLength(1);
  });

  it("caps a long word so one title can't stretch the card", () => {
    expect(maskTitle("Supercalifragilistic")).toBe("▪".repeat(8));
  });
});
