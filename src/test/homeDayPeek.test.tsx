import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { todayLocalIso, addDaysIso } from "@/lib/date";

/**
 * The today card versus the week strip's day panel, in every combination.
 *
 * Twice this went wrong in opposite directions: first the card stayed up
 * under a panel about the 22nd, so every day looked like it held the 20th's
 * lesson; then it hid even when the student tapped today itself, taking the
 * class recap button with it. The rule that survives both: the card is
 * today's — it stays for today, and tucks away for any other day, ahead or
 * behind.
 */

const today = todayLocalIso();

/** Mutable fixtures, hoisted so the mock factories can reach them. */
const st = vi.hoisted(() => ({
  session: null as any,
  nextSession: null as any,
  batch: null as any,
}));

vi.mock("@/hooks/useStudentMe", () => ({
  useStudentMe: () => ({ data: { id: "s1", name: "Payal Malviya", joined_on: "2026-09-01" } }),
}));
vi.mock("@/hooks/useBatchCoursework", () => ({
  useStudentSongs: () => [],
  useStudentClassConfig: () => ({ instrument: "ukulele", courseStartDate: "2026-09-06", songsPerSession: 3, shiftWeeks: 0 }),
}));
vi.mock("@/hooks/useCoursePlan", () => ({
  useStudentCoursePlan: () => ({ weekOneStart: null, days: [] }),
  planWeekNumberFor: () => null,
  shiftedPlanWeek: () => null,
  daysForWeek: () => [],
}));
vi.mock("@/hooks/useCourseVideos", () => ({
  useCourseVideos: () => ({ data: [] }),
  useSignedVideoUrls: () => ({ data: {} }),
  isAudioPath: () => false,
}));
vi.mock("@/hooks/useStudentProgress", () => ({
  usePracticeLogs: () => ({ data: [] }),
  sessionsDone: () => 6,
}));
vi.mock("@/hooks/useWeeklyPlan", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useWeeklyPlan")>("@/hooks/useWeeklyPlan");
  return {
    ...actual,
    useEnsureWeeklyPlan: () => {},
    useTodaysSession: () => st.session,
    useNextSession: () => st.nextSession,
    useStudentBatchDay: () => ({ data: st.batch }),
    useFinishDay: () => ({ finish: vi.fn(), isPending: false }),
  };
});

/**
 * A stand-in strip that simply forwards taps, so the test can put any day
 * into Home's hands the way the real strip would.
 */
vi.mock("@/components/student/WeeklyCalendarStrip", () => ({
  default: ({ onSelectDay }: any) => (
    <div>
      <button onClick={() => onSelectDay?.({ scheduled_date: addDaysIso(today, -2), session_index: 0 })}>pick-past</button>
      <button onClick={() => onSelectDay?.({ scheduled_date: today, session_index: 0 })}>pick-today</button>
      <button onClick={() => onSelectDay?.({ scheduled_date: addDaysIso(today, 2), session_index: 1 })}>pick-future</button>
      <button onClick={() => onSelectDay?.(null)}>pick-none</button>
    </div>
  ),
}));

import Home from "@/routes/student/Home";

const CLASS_DAY = {
  day_of_week: new Date(`${today}T00:00:00`).getDay(),
  start_time: "15:00:00",
  semester_start: "2026-09-06",
};

beforeEach(() => {
  // Today is the class day with its recap session — the case that went missing.
  st.session = { id: "w1", scheduled_date: today, session_index: 0, session_type: "build", target_min: 20, completed: false, instruction: "Recap" };
  st.nextSession = { scheduled_date: addDaysIso(today, 2), session_index: 1 };
  st.batch = CLASS_DAY;
});
afterEach(cleanup);

const cardGone = () => screen.queryByText(/class recap/i) === null;
const cardHere = () => screen.queryByText(/class recap/i) !== null;

describe("the today card while browsing the week", () => {
  it("is there on an ordinary load, before anything is tapped", () => {
    render(<Home />);
    expect(cardHere()).toBe(true);
  });

  it("hides for a day ahead — its panel says the day is not here yet", () => {
    render(<Home />);
    fireEvent.click(screen.getByText("pick-future"));
    expect(cardGone()).toBe(true);
  });

  it("hides for a day behind — the panel carries that day's own material", () => {
    render(<Home />);
    fireEvent.click(screen.getByText("pick-past"));
    expect(cardGone()).toBe(true);
  });

  it("stays when today itself is tapped — the class still has to be marked", () => {
    render(<Home />);
    fireEvent.click(screen.getByText("pick-today"));
    expect(cardHere()).toBe(true);
  });

  it("comes back when the day is closed again", () => {
    render(<Home />);
    fireEvent.click(screen.getByText("pick-future"));
    expect(cardGone()).toBe(true);
    fireEvent.click(screen.getByText("pick-none"));
    expect(cardHere()).toBe(true);
  });

  it("survives a wander: future, then today, then past, then closed", () => {
    render(<Home />);
    fireEvent.click(screen.getByText("pick-future"));
    expect(cardGone()).toBe(true);
    fireEvent.click(screen.getByText("pick-today"));
    expect(cardHere()).toBe(true);
    fireEvent.click(screen.getByText("pick-past"));
    expect(cardGone()).toBe(true);
    fireEvent.click(screen.getByText("pick-none"));
    expect(cardHere()).toBe(true);
  });
});
