import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

/**
 * The admin area is admin-only.
 *
 * Course work, People and Schedule had no role guard, so a signed-in teacher
 * who typed the URL reached the course planner and could try to edit the
 * curriculum — reordering a day's clips included. The database already
 * refused those writes; the screen just didn't say so.
 */
const st = vi.hoisted(() => ({ role: "admin" as string }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: st.role, user: { id: "u1" }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

import { RequireRole } from "@/App";

const Harness = () => (
  <MemoryRouter initialEntries={["/admin/coursework"]}>
    <Routes>
      <Route path="/" element={<div>sent home</div>} />
      <Route
        path="/admin/coursework"
        element={
          <RequireRole role="admin">
            <div>course planner</div>
          </RequireRole>
        }
      />
    </Routes>
  </MemoryRouter>
);

afterEach(cleanup);

describe("admin-only areas", () => {
  it("lets an admin in", () => {
    st.role = "admin";
    render(<Harness />);
    expect(screen.getByText("course planner")).toBeTruthy();
  });

  it("turns a teacher away", () => {
    st.role = "teacher";
    render(<Harness />);
    expect(screen.queryByText("course planner")).toBeNull();
    expect(screen.getByText("sent home")).toBeTruthy();
  });

  it("turns a student away", () => {
    st.role = "student";
    render(<Harness />);
    expect(screen.queryByText("course planner")).toBeNull();
  });

  it("still lets an admin into a teacher-only area", () => {
    st.role = "admin";
    render(
      <MemoryRouter initialEntries={["/t"]}>
        <Routes>
          <Route path="/t" element={<RequireRole role="teacher"><div>roster</div></RequireRole>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("roster")).toBeTruthy();
  });
});
