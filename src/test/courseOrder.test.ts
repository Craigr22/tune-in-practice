import { describe, it, expect } from "vitest";
import { courseOrder, visibleStops, type CoursePlanDay } from "@/hooks/useCoursePlan";
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

describe("visibleStops", () => {
  const stops = courseOrder(plan, BEGINNER_ORDER);
  const shown = (week: number | null) => visibleStops(stops, week).map((s) => s.songId);

  it("shows two weeks ahead and no further", () => {
    expect(shown(3)).toEqual(["sunshine", "piyu-bole", "photograph", "im-yours", "kaisi-paheli"]);
  });

  it("shows weeks 1 and 2 before the course starts", () => {
    expect(shown(null)).toEqual(["sunshine", "piyu-bole"]);
  });

  it("never shows a song more than two weeks out", () => {
    for (let week = 0; week <= 12; week++) {
      for (const s of visibleStops(stops, week)) {
        expect(s.week).toBeLessThanOrEqual(week + 2);
      }
    }
  });

  it("reveals one more song as each week passes", () => {
    expect(shown(1).length).toBeLessThan(shown(2).length);
    expect(shown(2).length).toBeLessThan(shown(3).length);
  });
});
