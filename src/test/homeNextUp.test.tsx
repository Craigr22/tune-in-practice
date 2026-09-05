import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { todayLocalIso, addDaysIso } from "@/lib/date";

/**
 * The rest-day state on the student home.
 *
 * Practice runs three days a week, so on the other four the page has nothing
 * to show — including the day before class. It used to say only "no practice
 * planned", which read as broken. These cover what it says instead.
 *
 * Mocked at the hook boundary: the page's own logic (what's next, in what
 * order, how it's worded) is what's under test, not Supabase.
 */

const today = todayLocalIso();

let nextSession: any = null;
let batch: any = null;

vi.mock("@/hooks/useStudentMe", () => ({
  useStudentMe: () => ({ data: { id: "s1", name: "Elroy Rodrigues", joined_on: "2026-09-01" } }),
}));
vi.mock("@/hooks/useBatchCoursework", () => ({
  useStudentSongs: () => [{ id: "song1", title: "You Are My Sunshine", track: 1, order: 1 }],
  useStudentClassConfig: () => ({ instrument: "ukulele", courseStartDate: "2026-09-06", songsPerSession: 3 }),
}));
vi.mock("@/hooks/useCoursePlan", () => ({
  useStudentCoursePlan: () => ({ weekOneStart: null, days: [] }),
  planWeekNumberFor: () => null,
  daysForWeek: () => [],
}));
vi.mock("@/hooks/useCourseVideos", () => ({
  useCourseVideos: () => ({ data: [] }),
  useSignedVideoUrls: () => ({ data: {} }),
}));
vi.mock("@/hooks/useStudentProgress", () => ({
  useLogPractice: () => ({ mutate: vi.fn() }),
  usePracticeLogs: () => ({ data: [] }),
  computeStreak: () => 0,
}));
vi.mock("@/components/student/WeeklyCalendarStrip", () => ({ default: () => null }));
vi.mock("@/hooks/useWeeklyPlan", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useWeeklyPlan")>("@/hooks/useWeeklyPlan");
  return {
    ...actual,
    useEnsureWeeklyPlan: () => {},
    useTodaysSession: () => undefined, // a rest day
    useNextSession: () => nextSession,
    useStudentBatchDay: () => ({ data: batch }),
    useCompleteSegment: () => ({ mutate: vi.fn(), isPending: false }),
    useMarkSessionComplete: () => ({ mutate: vi.fn() }),
  };
});

import Home from "@/routes/student/Home";

beforeEach(() => {
  nextSession = null;
  batch = null;
});
afterEach(cleanup);

describe("student home on a rest day", () => {
  const classTomorrow = () => ({
    day_of_week: new Date(`${addDaysIso(today, 1)}T00:00:00`).getDay(),
    start_time: "15:00:00",
    semester_start: "2026-09-06",
  });

  it("says what's next in the header, not in a card of its own", () => {
    nextSession = { scheduled_date: addDaysIso(today, 2), focus_song_id: "song1" };
    batch = classTomorrow();

    const { container } = render(<Home />);

    expect(screen.getByText(/no practice today/i)).toBeTruthy();
    // The week strip already shows practice and class days, so the header card
    // is the whole page on a rest day — no second card, and nothing to press.
    expect(container.querySelector(".home")!.children.length).toBe(1);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the nearer of the two, with its time", () => {
    nextSession = { scheduled_date: addDaysIso(today, 3), focus_song_id: "song1" };
    batch = classTomorrow();

    render(<Home />);

    expect(screen.getByText(/class tomorrow at .*3[:.]00/i)).toBeTruthy();
  });

  it("names practice when practice comes first", () => {
    nextSession = { scheduled_date: addDaysIso(today, 1), focus_song_id: "song1" };
    batch = { ...classTomorrow(), day_of_week: new Date(`${addDaysIso(today, 4)}T00:00:00`).getDay() };

    render(<Home />);

    expect(screen.getByText(/practice tomorrow/i)).toBeTruthy();
  });

  it("falls back to a plain day off when there is nothing ahead at all", () => {
    render(<Home />);

    expect(screen.getByText(/enjoy the day off/i)).toBeTruthy();
  });

  it("does not offer a class before the course has started", () => {
    // Class day is tomorrow, but the course does not begin for another month.
    batch = { ...classTomorrow(), semester_start: addDaysIso(today, 30) };

    render(<Home />);

    expect(screen.queryByText(/tomorrow/i)).toBeNull();
    expect(screen.getByText(/class/i)).toBeTruthy();
  });
});
