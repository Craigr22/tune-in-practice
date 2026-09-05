import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { todayLocalIso, addDaysIso } from "@/lib/date";

/**
 * The student home away from a practice session: what it says on a rest day,
 * and how it follows the day the student is looking at in the week strip.
 *
 * Practice runs three days a week, so on the other four the page has nothing
 * of today's to show — it used to say only "no practice planned", which read
 * as broken.
 *
 * Mocked at the hook boundary: the page's own logic — what's next, in what
 * order, which day's clips — is what's under test, not Supabase.
 */

const today = todayLocalIso();

/** Mutable fixture state. Hoisted so the vi.mock factories can reach it. */
const st = vi.hoisted(() => ({
  nextSession: null as any,
  batch: null as any,
  courseVideos: [] as any[],
  planDays: [] as any[],
}));

vi.mock("@/hooks/useStudentMe", () => ({
  useStudentMe: () => ({ data: { id: "s1", name: "Elroy Rodrigues", joined_on: "2026-09-01" } }),
}));
vi.mock("@/hooks/useBatchCoursework", () => ({
  useStudentSongs: () => [{ id: "song1", title: "You Are My Sunshine", track: 1, order: 1 }],
  useStudentClassConfig: () => ({
    instrument: "ukulele",
    courseStartDate: "2026-09-06",
    songsPerSession: 3,
    shiftWeeks: 0,
  }),
}));
vi.mock("@/hooks/useCoursePlan", () => ({
  useStudentCoursePlan: () => ({ weekOneStart: null, days: st.planDays }),
  planWeekNumberFor: () => (st.planDays.length ? 1 : null),
  shiftedPlanWeek: () => (st.planDays.length ? 1 : null),
  daysForWeek: () => st.planDays,
}));
vi.mock("@/hooks/useCourseVideos", async () => {
  // Keep isAudioPath real — it decides sound versus picture.
  const actual = await vi.importActual<typeof import("@/hooks/useCourseVideos")>("@/hooks/useCourseVideos");
  return {
    ...actual,
    useCourseVideos: () => ({ data: st.courseVideos }),
    useSignedVideoUrls: () => ({
      data: Object.fromEntries(st.courseVideos.map((v) => [v.storage_path, `blob:${v.id}`])),
    }),
  };
});
vi.mock("@/hooks/useStudentProgress", () => ({
  usePracticeLogs: () => ({ data: [] }),
  computeStreak: () => 0,
}));

/** Stands in for the week strip, exposing the day-picking it reports upward. */
vi.mock("@/components/student/WeeklyCalendarStrip", () => ({
  default: ({ onSelectDay }: { onSelectDay?: (d: any) => void }) => (
    <button onClick={() => onSelectDay?.({ scheduled_date: "2026-09-16", session_index: 1 })}>
      pick a later day
    </button>
  ),
}));

vi.mock("@/hooks/useWeeklyPlan", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useWeeklyPlan")>("@/hooks/useWeeklyPlan");
  return {
    ...actual,
    useEnsureWeeklyPlan: () => {},
    useTodaysSession: () => undefined, // a rest day
    useNextSession: () => st.nextSession,
    useStudentBatchDay: () => ({ data: st.batch }),
    useCompleteSegment: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

import Home from "@/routes/student/Home";

beforeEach(() => {
  st.nextSession = null;
  st.batch = null;
  st.courseVideos = [];
  st.planDays = [];
});
afterEach(cleanup);

describe("student home on a rest day", () => {
  const classTomorrow = () => ({
    day_of_week: new Date(`${addDaysIso(today, 1)}T00:00:00`).getDay(),
    start_time: "15:00:00",
    semester_start: "2026-09-06",
  });

  /** Two plan days, each with its own clip, so the two can be told apart. */
  const withLessons = () => {
    st.courseVideos = [
      { id: "v1", title: "Piyu Bole Tutorial", storage_path: "p/v1.mp4" },
      { id: "v2", title: "Photograph Tutorial", storage_path: "p/v2.mp4" },
    ];
    st.planDays = [
      { week_number: 1, day_number: 1, video_ids: ["v1"], tier: "beginner" },
      { week_number: 1, day_number: 2, video_ids: ["v2"], tier: "beginner" },
    ];
  };

  it("shows the next session's clips on a rest day", () => {
    st.nextSession = { scheduled_date: addDaysIso(today, 2), focus_song_id: "song1", session_index: 0 };
    st.batch = classTomorrow();
    withLessons();

    const { container } = render(<Home />);

    expect(container.querySelector("video")).toBeTruthy();
    expect(screen.getByText("Piyu Bole Tutorial")).toBeTruthy();
    expect(screen.getByText(/watch ahead/i)).toBeTruthy();
  });

  it("follows the day picked in the week strip", () => {
    st.nextSession = { scheduled_date: addDaysIso(today, 2), focus_song_id: "song1", session_index: 0 };
    st.batch = classTomorrow();
    withLessons();

    render(<Home />);
    expect(screen.getByText("Piyu Bole Tutorial")).toBeTruthy();

    fireEvent.click(screen.getByText("pick a later day"));

    // Day 2's clip replaces day 1's, and the heading names the day.
    expect(screen.getByText("Photograph Tutorial")).toBeTruthy();
    expect(screen.queryByText("Piyu Bole Tutorial")).toBeNull();
    expect(screen.getByText(/lessons ·/i)).toBeTruthy();
  });

  it("says what's next in the header, not in a card of its own", () => {
    st.nextSession = { scheduled_date: addDaysIso(today, 2), focus_song_id: "song1" };
    st.batch = classTomorrow();

    const { container } = render(<Home />);

    expect(screen.getByText(/no practice today/i)).toBeTruthy();
    // The week strip already shows practice and class days, so with no clips
    // to watch the header card is the whole page.
    expect(container.querySelector(".home")!.children.length).toBe(1);
  });

  it("names the nearer of the two, with its time", () => {
    st.nextSession = { scheduled_date: addDaysIso(today, 3), focus_song_id: "song1" };
    st.batch = classTomorrow();

    render(<Home />);

    expect(screen.getByText(/class tomorrow at .*3[:.]00/i)).toBeTruthy();
  });

  it("names practice when practice comes first", () => {
    st.nextSession = { scheduled_date: addDaysIso(today, 1), focus_song_id: "song1" };
    st.batch = { ...classTomorrow(), day_of_week: new Date(`${addDaysIso(today, 4)}T00:00:00`).getDay() };

    render(<Home />);

    expect(screen.getByText(/practice tomorrow/i)).toBeTruthy();
  });

  it("falls back to a plain day off when there is nothing ahead at all", () => {
    render(<Home />);

    expect(screen.getByText(/enjoy the day off/i)).toBeTruthy();
  });

  it("does not offer a class before the course has started", () => {
    // Class day is tomorrow, but the course does not begin for another month.
    st.batch = { ...classTomorrow(), semester_start: addDaysIso(today, 30) };

    render(<Home />);

    expect(screen.queryByText(/tomorrow/i)).toBeNull();
    expect(screen.getByText(/class/i)).toBeTruthy();
  });
});
