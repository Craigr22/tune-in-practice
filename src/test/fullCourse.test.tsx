import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const day = (week: number, n: number, song: string, videos: string[] = []) => ({
  id: `w${week}d${n}`,
  instrument: "ukulele",
  week_number: week,
  day_number: n,
  class_topic: null,
  song_id: song,
  instruction: `Instruction ${week}.${n}`,
  video_ids: videos,
  video_notes: videos.length ? { [videos[0]]: { above: `Watch for ${week}.${n}` } } : {},
  tier: "beginner",
});

const signed = vi.fn((paths: string[]) => ({ data: Object.fromEntries(paths.map((p) => [p, `https://files.test/${p}`])) }));

vi.mock("@/hooks/useCoursePlan", () => ({
  useStudentCoursePlan: () => ({
    weekOneStart: null,
    days: [day(2, 1, "piyu-bole", ["v2"]), day(1, 1, "sunshine", ["v1"]), day(1, 2, "sunshine"), day(9, 1, "photograph", ["v9"])],
  }),
}));
vi.mock("@/hooks/useCourseVideos", () => ({
  useCourseVideos: () => ({
    data: [
      { id: "v1", title: "Clip one", storage_path: "a/1.mp4" },
      { id: "v2", title: "Clip two", storage_path: "a/2.mp4" },
      { id: "v9", title: "Clip nine", storage_path: "a/9.mp4" },
    ],
  }),
  useSignedVideoUrls: (paths: string[]) => signed(paths),
  isAudioPath: () => false,
}));
vi.mock("@/hooks/useSongCatalog", () => ({
  useCatalogSongs: () => [
    { id: "sunshine", title: "You Are My Sunshine" },
    { id: "piyu-bole", title: "Piyu Bole" },
    { id: "photograph", title: "Photograph" },
  ],
}));

import FullCourse from "@/components/teacher/FullCourse";

afterEach(() => {
  cleanup();
  signed.mockClear();
});

describe("the teacher's full course", () => {
  it("lists every week of the plan, including ones far ahead of the class", () => {
    render(<FullCourse instrument="ukulele" currentWeek={1} />);
    expect(screen.getByText("Week 1")).toBeTruthy();
    expect(screen.getByText("Week 2")).toBeTruthy();
    expect(screen.getByText("Week 9")).toBeTruthy();
  });

  it("opens on the week the class is on, and marks it", () => {
    render(<FullCourse instrument="ukulele" currentWeek={2} />);
    expect(screen.getByText(/class is here/i)).toBeTruthy();
    expect(screen.getByText("Clip two")).toBeTruthy();
    expect(screen.queryByText("Clip one")).toBeNull();
  });

  it("opens any other week on a tap — nothing is locked", () => {
    render(<FullCourse instrument="ukulele" currentWeek={1} />);
    expect(screen.queryByText("Clip nine")).toBeNull();
    fireEvent.click(screen.getByText("Week 9"));
    expect(screen.getByText("Clip nine")).toBeTruthy();
    expect(screen.getByText("Instruction 9.1")).toBeTruthy();
    expect(screen.getByText("Watch for 9.1")).toBeTruthy();
  });

  it("opens the whole course at once", () => {
    render(<FullCourse instrument="ukulele" currentWeek={1} />);
    fireEvent.click(screen.getByText(/open all/i));
    for (const t of ["Clip one", "Clip two", "Clip nine"]) expect(screen.getByText(t)).toBeTruthy();
  });

  it("only asks for a week's video links once that week is open", () => {
    render(<FullCourse instrument="ukulele" currentWeek={1} />);
    const asked = signed.mock.calls.flatMap((c) => c[0]);
    expect(asked).toContain("a/1.mp4");
    expect(asked).not.toContain("a/9.mp4");
  });
});
