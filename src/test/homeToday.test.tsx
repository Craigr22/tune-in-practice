import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { todayLocalIso } from "@/lib/date";

/**
 * The student home on a practice day.
 *
 * The day used to be split into several numbered boxes, each with its own
 * "mark done". The page now shows what the admin
 * planned for the day and one way to say it was practised.
 */

const today = todayLocalIso();

const st = vi.hoisted(() => ({
  session: null as any,
  batch: null as any,
  finish: vi.fn(),
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
  useStudentCoursePlan: () => ({ weekOneStart: null, days: [] }),
  planWeekNumberFor: () => 1,
  shiftedPlanWeek: () => 1,
  daysForWeek: () => [],
}));
vi.mock("@/hooks/useCourseVideos", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCourseVideos")>("@/hooks/useCourseVideos");
  return { ...actual, useCourseVideos: () => ({ data: [] }), useSignedVideoUrls: () => ({ data: {} }) };
});
vi.mock("@/hooks/useStudentProgress", () => ({
  usePracticeLogs: () => ({ data: [] }),
  computeStreak: () => 0,
}));
vi.mock("@/components/student/WeeklyCalendarStrip", () => ({ default: () => null }));

vi.mock("@/hooks/useWeeklyPlan", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useWeeklyPlan")>("@/hooks/useWeeklyPlan");
  return {
    ...actual,
    useEnsureWeeklyPlan: () => {},
    useTodaysSession: () => st.session,
    useNextSession: () => undefined,
    useStudentBatchDay: () => ({ data: st.batch }),
    useFinishDay: () => ({ finish: st.finish, isPending: false }),
  };
});

import Home from "@/routes/student/Home";

const session = (over: Record<string, unknown> = {}) => ({
  id: "sess1",
  scheduled_date: today,
  session_type: "build",
  song_id: "song1",
  instruction: "Slow C to F changes, ten clean ones.",
  target_min: 30,
  completed: false,
  completed_at: null,
  ...over,
});

/** A class that meets today, and started a while ago. */
const classToday = () => ({
  day_of_week: new Date(`${today}T00:00:00`).getDay(),
  start_time: "15:00:00",
  semester_start: "2026-09-06",
});

beforeEach(() => {
  st.session = session();
  st.batch = null;
  st.finish = vi.fn().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("student home on a practice day", () => {
  it("shows the day as one continuous session", () => {
    render(<Home />);

    // The clips carry their own titles, so the day isn't headed by a song name.
    expect(screen.queryByText("You Are My Sunshine")).toBeNull();
    expect(screen.getByText(/slow c to f changes/i)).toBeTruthy();
  });

  it("finishes the whole day in one tap", async () => {
    render(<Home />);

    fireEvent.click(screen.getByText(/i've practised today/i));

    await waitFor(() => expect(st.finish).toHaveBeenCalledWith("sess1"));
  });

  it("stays on the page once it is done, and says so", () => {
    st.session = session({ completed: true });

    render(<Home />);

    expect(screen.getByText(/done for today/i)).toBeTruthy();
    expect(screen.queryByText(/i've practised today/i)).toBeNull();
    // The material is still there to go over again.
    expect(screen.getByText(/slow c to f changes/i)).toBeTruthy();
  });

  it("asks about the class, not practice, on the day of the lesson", () => {
    st.batch = classToday();

    render(<Home />);

    // The student was in the class, so they are not asked to claim practice —
    // but being there is the week's first session and counts, so there is
    // still something to tick.
    expect(screen.queryByText(/i've practised today/i)).toBeNull();
    expect(screen.getByText(/i was at class today/i)).toBeTruthy();
    expect(screen.getByText(/class today at .*3[:.]00/i)).toBeTruthy();
    // And the day is not billed as a practice session.
    expect(screen.queryByText(/30 min/i)).toBeNull();
    // What the class covers is still on the page.
    expect(screen.getByText(/slow c to f changes/i)).toBeTruthy();
  });

  it("ticks the lesson off the same way, so the streak counts it", async () => {
    st.batch = classToday();

    render(<Home />);
    fireEvent.click(screen.getByText(/i was at class today/i));

    await waitFor(() => expect(st.finish).toHaveBeenCalledWith("sess1"));
  });
});
