import { describe, it, expect } from "vitest";
import { planSongOrder, weekProgress, visibleStops, type CoursePlanDay } from "@/hooks/useCoursePlan";

const day = (week: number, dayNo: number, songId: string | null, tier = "beginner"): CoursePlanDay =>
  ({
    id: `${week}-${dayNo}`, instrument: "ukulele", week_number: week, day_number: dayNo,
    class_topic: null, focus_song_id: songId, warmup_instruction: "", focus_instruction: "",
    bonus_instruction: "", video_ids: [], video_notes: {}, tier,
  } as CoursePlanDay);

/**
 * The map follows the admin's plan and nothing else. It used to sort by the
 * song catalogue, which opened with Piyu Bole while the course opened with
 * You Are My Sunshine.
 */
describe("planSongOrder", () => {
  const plan = [
    day(1, 1, "sunshine"), day(1, 2, "sunshine"), day(1, 3, "sunshine"),
    day(2, 1, "piyu-bole"), day(2, 2, "sunshine"), day(2, 3, "piyu-bole"),
    day(3, 1, "photograph"),
  ];

  it("follows the weeks, whatever order the rows arrive in", () => {
    const shuffled = [plan[6], plan[3], plan[0], plan[4], plan[1]];
    expect(planSongOrder(shuffled).map((s) => s.songId)).toEqual([
      "sunshine", "piyu-bole", "photograph",
    ]);
  });

  it("places a song at the first week that teaches it, not a later revisit", () => {
    // Sunshine returns in week 2; it still belongs to week 1.
    expect(planSongOrder(plan).find((s) => s.songId === "sunshine")!.week).toBe(1);
  });

  it("lists each song once", () => {
    const ids = planSongOrder(plan).map((s) => s.songId);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("ignores days with no focus song set", () => {
    expect(planSongOrder([day(1, 1, null), day(1, 2, "sunshine")]).map((s) => s.songId))
      .toEqual(["sunshine"]);
  });

  it("carries the week's tier, so the map groups the way the plan does", () => {
    const stops = planSongOrder([day(1, 1, "sunshine", "beginner"), day(5, 1, "riptide", "casual")]);
    expect(stops.map((s) => s.tier)).toEqual(["beginner", "casual"]);
  });
});

describe("weekProgress", () => {
  const on = (isoDate: string) => weekProgress(new Date(`${isoDate}T12:00:00`));

  it("opens a little on Monday and nearly fully by Sunday", () => {
    expect(on("2026-09-07")).toBeLessThan(0.15);   // Monday
    expect(on("2026-09-13")).toBeGreaterThan(0.85); // Sunday
  });

  it("scratches open steadily across the week", () => {
    const week = ["2026-09-07","2026-09-08","2026-09-09","2026-09-10","2026-09-11","2026-09-12","2026-09-13"];
    const vals = week.map(on);
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThan(vals[i - 1]);
  });

  it("never gives it away and never seals it shut", () => {
    for (const d of ["2026-09-07","2026-09-10","2026-09-13"]) {
      expect(on(d)).toBeGreaterThan(0);
      expect(on(d)).toBeLessThan(1);
    }
  });
});

describe("visibleStops", () => {
  const stops = [
    { songId: "sunshine", week: 1, tier: "beginner" as const },
    { songId: "piyu-bole", week: 2, tier: "beginner" as const },
    { songId: "photograph", week: 3, tier: "beginner" as const },
    { songId: "kho-gaye", week: 4, tier: "beginner" as const },
  ];
  const shown = (week: number | null) =>
    visibleStops(stops, week).map((v) => `${v.stop.songId}${v.teaser ? "?" : ""}`);

  it("shows what has been taught, plus next week covered over", () => {
    expect(shown(2)).toEqual(["sunshine", "piyu-bole", "photograph?"]);
  });

  it("hides everything beyond next week", () => {
    expect(shown(1)).not.toContain("photograph?");
    expect(shown(1)).toEqual(["sunshine", "piyu-bole?"]);
  });

  it("teases week 1 before the course has started", () => {
    expect(shown(null)).toEqual(["sunshine?"]);
  });

  it("has nothing left covered once the plan runs out", () => {
    expect(shown(4)).toEqual(["sunshine", "piyu-bole", "photograph", "kho-gaye"]);
    expect(shown(9)).toHaveLength(4);
  });

  it("never reveals a song before its week", () => {
    for (let week = 0; week <= 5; week++) {
      for (const v of visibleStops(stops, week)) {
        if (!v.teaser) expect(v.stop.week).toBeLessThanOrEqual(week);
      }
    }
  });
});
