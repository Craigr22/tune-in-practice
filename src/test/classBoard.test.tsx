import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { withPlaces, type ClassBoardRow } from "@/hooks/useClassBoard";

/**
 * The class board: where a student stands among the people they sit next to.
 *
 * Shown to children, so two things matter as much as the ordering — that it
 * cannot appear before the database function exists, and that it is not shown
 * to someone with nobody to be ranked against.
 */

const st = vi.hoisted(() => ({ data: null as ClassBoardRow[] | null }));
vi.mock("@/hooks/useClassBoard", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useClassBoard")>("@/hooks/useClassBoard");
  return { ...actual, useClassBoard: () => ({ data: st.data }) };
});

import ClassBoard from "@/components/student/ClassBoard";

const row = (display_name: string, sessions: number, is_me = false): ClassBoardRow => ({
  student_id: display_name,
  display_name,
  sessions,
  is_me,
});

beforeEach(() => { st.data = null; });
afterEach(cleanup);

describe("withPlaces", () => {
  it("numbers the list", () => {
    const places = withPlaces([row("Payal M.", 9), row("Amit A.", 6), row("Renuka", 2)]);
    expect(places.map((r) => r.place)).toEqual([1, 2, 3]);
  });

  it("lets a tie share a place, and skips the one it used up", () => {
    // Two on six are both second; the next is fourth, not third.
    const places = withPlaces([row("Payal M.", 9), row("Amit A.", 6), row("Hetvi M.", 6), row("Renuka", 2)]);
    expect(places.map((r) => r.place)).toEqual([1, 2, 2, 4]);
  });
});

describe("ClassBoard", () => {
  it("shows nothing at all before the function is migrated in", () => {
    st.data = null;
    const { container } = render(<ClassBoard />);
    expect(container.firstChild).toBeNull();
  });

  it("shows nothing to a student with no classmates", () => {
    // A board of one is a ranking of nobody.
    st.data = [row("Renuka", 4, true)];
    const { container } = render(<ClassBoard />);
    expect(container.firstChild).toBeNull();
  });

  it("lists the class in the order given, and marks the reader", () => {
    st.data = [row("Payal M.", 9), row("Amit A.", 6, true), row("Renuka", 2)];

    render(<ClassBoard />);

    const names = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(names[0]).toContain("Payal M.");
    expect(names[1]).toContain("Amit A.");
    expect(names[2]).toContain("Renuka");
    // The reader can find themselves without counting.
    expect(names[1]).toContain("you");
    expect(names.filter((n) => n?.includes("you"))).toHaveLength(1);
  });

  it("keeps a student on nothing in the list rather than hiding them", () => {
    st.data = [row("Payal M.", 9), row("Amit A.", 0, true)];

    render(<ClassBoard />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/amit a\./i)).toBeTruthy();
  });
});
