import { describe, it, expect } from "vitest";
import {
  CLASS_CAPACITY,
  OPEN_HOURS_PER_ROOM,
  buildTrend,
  computeRoomUsage,
  overlappingIds,
  type UsageClass,
} from "@/lib/roomUsage";

const rooms = [
  { id: "a", name: "Room A" },
  { id: "b", name: "Room B" },
];

const cls = (id: string, over: Partial<UsageClass> = {}): UsageClass => ({
  id,
  locationId: "a",
  dayOfWeek: 1,
  startTime: "17:00:00",
  durationMin: 60,
  enrolled: 5,
  ...over,
});

const saved = (month: string, scope: string, filled: number, open: number, room_name = scope) => ({
  month,
  scope,
  room_name,
  seat_hours_filled: String(filled), // numeric columns arrive as text
  seat_hours_open: String(open),
});

describe("the monthly trend", () => {
  it("gives each room and BAM their month's efficiency, oldest first", () => {
    const { rooms, points } = buildTrend([
      saved("2026-11-01", "all", 200, 1000),
      saved("2026-10-01", "all", 100, 1000),
      saved("2026-10-01", "r2", 40, 500, "Room 404"),
      saved("2026-10-01", "r1", 60, 500, "Room 205"),
    ]);
    expect(rooms.map((r) => r.name)).toEqual(["Room 205", "Room 404"]);
    expect(points.map((p) => p.month)).toEqual(["2026-10-01", "2026-11-01"]);
    expect(points[0].rooms.r1).toBeCloseTo(0.12);
    expect(points[0].bam).toBeCloseTo(0.1);
    expect(points[1].rooms.r1).toBeNull();
  });

  it("adds up seat-hours for the cumulative figure", () => {
    const { points } = buildTrend([saved("2026-10-01", "all", 100, 1000), saved("2026-11-01", "all", 300, 500)]);
    expect(points[1].cumulative).toBeCloseTo(400 / 1500); // not the 35% an average gives
  });

  it("restarts the cumulative figure in April", () => {
    const { points } = buildTrend([
      saved("2027-03-01", "all", 100, 1000),
      saved("2027-04-01", "all", 300, 1000),
    ]);
    expect(points[1].cumulative).toBeCloseTo(0.3);
  });
});

describe("room usage", () => {
  it("opens 7am to 10pm every day and fills a class at five", () => {
    expect(OPEN_HOURS_PER_ROOM).toBe(105);
    expect(CLASS_CAPACITY).toBe(5);
  });

  it("measures seats filled against every seat in every room for every open hour", () => {
    const { overall } = computeRoomUsage([cls("1"), cls("2", { startTime: "18:00:00", enrolled: 3 })], rooms);
    expect(overall.seatHoursOpen).toBe(1050);
    expect(overall.seatHoursFilled).toBe(8);
    expect(overall.efficiency).toBeCloseTo(8 / 1050);
    expect(overall.roomUse).toBeCloseTo(2 / 210);
    expect(overall.classFill).toBeCloseTo(0.8);
  });

  it("is room time used multiplied by class fill", () => {
    const { overall } = computeRoomUsage(
      [cls("1", { durationMin: 45, enrolled: 2 }), cls("2", { startTime: "19:00:00", durationMin: 90 })],
      rooms,
    );
    expect(overall.efficiency).toBeCloseTo(overall.roomUse * overall.classFill);
  });

  it("gives a long class more weight than a short one", () => {
    const { overall } = computeRoomUsage([cls("1", { durationMin: 120, enrolled: 1 })], rooms);
    expect(overall.seatHoursFilled).toBe(2);
  });

  it("splits by room, and an empty room still counts against the whole", () => {
    const usage = computeRoomUsage([cls("1")], rooms);
    expect(usage.rooms[0].efficiency).toBeCloseTo(5 / 525);
    expect(usage.rooms[1].classes).toBe(0);
    expect(usage.rooms[1].efficiency).toBe(0);
    expect(usage.overall.efficiency).toBeCloseTo(5 / 1050);
  });

  it("lets an over-full class read above 100%", () => {
    expect(computeRoomUsage([cls("1", { enrolled: 7 })], rooms).overall.classFill).toBeCloseTo(1.4);
  });

  it("leaves out a class in a room that is not listed", () => {
    expect(computeRoomUsage([cls("1", { locationId: "gone" })], rooms).overall.classes).toBe(0);
  });

  it("gives zero, not NaN, with no rooms or classes", () => {
    expect(computeRoomUsage([], []).overall.efficiency).toBe(0);
    expect(computeRoomUsage([], rooms).overall.classFill).toBe(0);
  });

  it("finds overlaps in one room on one day only", () => {
    const list = [
      cls("1"),
      cls("2", { startTime: "17:30:00" }),
      cls("3", { startTime: "18:00:00", durationMin: 15 }), // starts as 1 ends
      cls("4", { locationId: "b" }),
      cls("5", { dayOfWeek: 2 }),
    ];
    expect([...overlappingIds(list)].sort()).toEqual(["1", "2", "3"]);
    expect(computeRoomUsage(list, rooms).overall.overlaps).toBe(2);
  });
});
