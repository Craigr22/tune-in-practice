import { describe, it, expect } from "vitest";
import type { CourseVideo } from "@/hooks/useCourseVideos";

/** Mirrors pickTwo in SongVideos. */
function pickTwo(videos: CourseVideo[]): CourseVideo[] {
  const first = (kind: CourseVideo["kind"]) =>
    videos.filter((v) => v.kind === kind).sort((a, b) => a.sort_order - b.sort_order)[0];
  return [first("track"), first("lesson")].filter(Boolean) as CourseVideo[];
}

const v = (title: string, kind: CourseVideo["kind"], sort_order: number): CourseVideo =>
  ({ id: title, instrument: "ukulele", song_id: "sunshine", title, description: null,
     storage_path: `p/${title}`, kind, sort_order, created_at: "" } as CourseVideo);

/**
 * A song panel shows two things: the backing track to play along to, then
 * the tutorial. Sunshine alone has four clips linked to it.
 */
describe("a song's clips", () => {
  const sunshine = [
    v("You are my Sunshine", "lesson", 3),
    v("Completed: You are my Sunshine", "lesson", 7),
    v("Sunshine Normal Backing Track", "track", 1),
    v("You are my Sunshine CF Slow", "track", 4),
  ];

  it("shows two, never the whole pile", () => {
    expect(pickTwo(sunshine)).toHaveLength(2);
  });

  it("puts the backing track first and the tutorial second", () => {
    expect(pickTwo(sunshine).map((x) => x.kind)).toEqual(["track", "lesson"]);
  });

  it("takes the first of each in the admin's order", () => {
    expect(pickTwo(sunshine).map((x) => x.title)).toEqual([
      "Sunshine Normal Backing Track",
      "You are my Sunshine",
    ]);
  });

  it("shows whichever exists when a song has only one kind", () => {
    expect(pickTwo([v("Tutorial only", "lesson", 1)]).map((x) => x.kind)).toEqual(["lesson"]);
    expect(pickTwo([v("Track only", "track", 1)]).map((x) => x.kind)).toEqual(["track"]);
  });

  it("leaves drills out of the song panel", () => {
    expect(pickTwo([v("3. Technical cfag", "exercise", 1)])).toHaveLength(0);
  });

  it("shows nothing for a song with no clips", () => {
    expect(pickTwo([])).toHaveLength(0);
  });
});
