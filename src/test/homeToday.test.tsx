import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { todayLocalIso } from "@/lib/date";

/**
 * The student home on a practice day.
 *
 * The day used to be split into warm-up, focus and bonus — three numbered
 * boxes, each with its own "mark done". The page now shows what the admin
 * planned for the day and one way to say it was practised.
 */

const today = todayLocalIso();

const st = vi.hoisted(() => ({
  session: null as any,
  batch: null as any,
  complete: vi.fn(),
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
    useCompleteSegment: () => ({ mutateAsync: st.complete, isPending: false }),
  };
});

import Home from "@/routes/student/Home";

const session = (over: Record<string, unknown> = {}) => ({
  id: "sess1",
  scheduled_date: today,
  session_type: "build",
  focus_song_id: "song1",
  focus_instruction: "Slow C to F changes, ten clean ones.",
  warmup_target_min: 5,
  focus_target_min: 20,
  bonus_target_min: 5,
  warmup_completed: false,
  focus_completed: false,
  bonus_completed: false,
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
  st.complete = vi.fn().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("student home on a practice day", () => {
  it("shows the day without splitting it into warm-up, focus and bonus", () => {
    render(<Home />);

    expect(screen.queryByText(/warm-up/i)).toBeNull();
    expect(screen.queryByText(/^bonus$/i)).toBeNull();
    expect(screen.queryByText(/mark focus done/i)).toBeNull();
    // The clips carry their own titles, so the day isn't headed by a song name.
    expect(screen.queryByText("You Are My Sunshine")).toBeNull();
    expect(screen.getByText(/slow c to f changes/i)).toBeTruthy();
  });

  it("finishes the whole day in one tap", async () => {
    render(<Home />);

    fireEvent.click(screen.getByText(/i've practised today/i));

    // Three parts underneath, so all three are ticked — the last one is what
    // writes the practice log the teacher's roster reads.
    await waitFor(() => expect(st.complete).toHaveBeenCalledTimes(3));
    expect(st.complete.mock.calls.map((c: any[]) => c[0].segment)).toEqual([
      "warmup",
      "focus",
      "bonus",
    ]);
  });

  it("stays on the page once it is done, and says so", () => {
    st.session = session({ warmup_completed: true, focus_completed: true, bonus_completed: true });

    render(<Home />);

    expect(screen.getByText(/done for today/i)).toBeTruthy();
    expect(screen.queryByText(/i've practised today/i)).toBeNull();
    // The material is still there to go over again.
    expect(screen.getByText(/slow c to f changes/i)).toBeTruthy();
  });

  it("asks for no practice on the day of the lesson", () => {
    st.batch = classToday();

    render(<Home />);

    // The student was in the class; there is nothing to claim as practice.
    expect(screen.queryByText(/i've practised today/i)).toBeNull();
    expect(screen.getByText(/class today at .*3[:.]00/i)).toBeTruthy();
    // And the day is not billed as a practice session either.
    expect(screen.queryByText(/30 min/i)).toBeNull();
    // What the class covers is still on the page.
    expect(screen.getByText(/slow c to f changes/i)).toBeTruthy();
  });
});
