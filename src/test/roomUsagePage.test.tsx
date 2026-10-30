import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const st = vi.hoisted(() => ({
  batches: [] as any[],
  locations: [] as any[],
}));

vi.mock("@/hooks/useBatches", () => ({ useBatchList: () => ({ data: st.batches, isLoading: false, error: null }) }));
vi.mock("@/hooks/useLocations", () => ({ useLocations: () => ({ data: st.locations, isLoading: false, error: null }) }));

vi.mock("@/hooks/useRoomUsageMonths", () => ({
  useRoomUsageMonths: () => ({
    data: [{ month: "2026-10-01", scope: "all", room_name: "BAM", seat_hours_filled: "129", seat_hours_open: "1050" }],
    isLoading: false,
    error: null,
  }),
}));
vi.mock("recharts", async (original) => ({
  ...(await original<typeof import("recharts")>()),
  ResponsiveContainer: () => <div />,
}));
vi.mock("@/components/admin/BatchDetailDialog", () => ({
  default: ({ batchId }: { batchId: string | null }) => (batchId ? <div>students of class {batchId}</div> : null),
}));

import RoomUsagePage from "@/routes/admin/RoomUsage";

const batch = (id: string, over: any = {}) => ({
  id,
  code: null,
  is_active: true,
  location_id: "r1",
  day_of_week: 0,
  start_time: "10:45:00",
  duration_min: 60,
  enrolled: 4,
  teachers: { name: "Brendan" },
  instruments: { name: "Violin" },
  ...over,
});

afterEach(cleanup);

describe("room efficiency usage page", () => {
  it("shows each room's week and leaves out archived classes and rooms", () => {
    st.locations = [
      { id: "r1", name: "Room 205", is_active: true },
      { id: "r2", name: "Room 404", is_active: true },
      { id: "r3", name: "Old room", is_active: false },
    ];
    st.batches = [batch("1"), batch("2", { is_active: false, enrolled: 5, teachers: { name: "Gone" } })];
    render(<RoomUsagePage />);
    expect(screen.getByText("Room efficiency usage")).toBeTruthy();
    expect(screen.getByText("Room 205")).toBeTruthy();
    expect(screen.getByText("Room 404")).toBeTruthy();
    expect(screen.queryByText("Old room")).toBeNull();
    expect(screen.queryByText("Gone")).toBeNull();
    expect(screen.getByText("4/5")).toBeTruthy();
    expect(screen.getByText("10:45 am")).toBeTruthy();
    // 4 seat-hours of 1,050, with two rooms open 105 hours each.
    expect(screen.getByText(/4 of 1,050 seat-hours/)).toBeTruthy();
  });

  it("opens a class's students when it is clicked", () => {
    st.locations = [{ id: "r1", name: "Room 205", is_active: true }];
    st.batches = [batch("1")];
    render(<RoomUsagePage />);
    expect(screen.queryByText("students of class 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Brendan/ }));
    expect(screen.getByText("students of class 1")).toBeTruthy();
  });

  it("shows the saved months on the trend tab", () => {
    st.locations = [];
    st.batches = [];
    render(<RoomUsagePage />);
    const tab = screen.getByRole("tab", { name: "Monthly trend" });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
    expect(screen.getByText("Efficiency by month")).toBeTruthy();
    expect(screen.getAllByText("12.3%").length).toBe(2); // BAM and cumulative
  });

  it("says so when there are no rooms", () => {
    st.locations = [];
    st.batches = [];
    render(<RoomUsagePage />);
    expect(screen.getByText(/No active rooms yet/)).toBeTruthy();
  });
});
