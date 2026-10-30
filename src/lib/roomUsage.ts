/**
 * How much of BAM's teaching capacity is in use.
 *
 * Capacity is every seat in every room for every hour BAM is open: a class of
 * CLASS_CAPACITY is a full class, whatever a class's own max_students says.
 * Efficiency is the seat-hours filled against that. It is also room time used
 * multiplied by class fill, so a low score always comes from one of those two.
 */
export const CLASS_CAPACITY = 5;
export const OPEN_HOUR = 7;
export const CLOSE_HOUR = 22;
const DAYS_OPEN = 7;

export const OPEN_HOURS_PER_ROOM = (CLOSE_HOUR - OPEN_HOUR) * DAYS_OPEN;

export type UsageClass = {
  id: string;
  locationId: string;
  dayOfWeek: number; // 0 = Sunday, as batches.day_of_week
  startTime: string; // "HH:MM:SS"
  durationMin: number;
  enrolled: number;
};

export type UsageRoom = { id: string; name: string };

export type UsageTotals = {
  classes: number;
  enrolled: number;
  bookedHours: number;
  openHours: number;
  seatHoursFilled: number;
  seatHoursOpen: number;
  roomUse: number;
  classFill: number;
  efficiency: number;
  overlaps: number;
};

export type RoomUsage = UsageTotals & { room: UsageRoom; classIds: string[] };

export const startMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const overlap = (a: UsageClass, b: UsageClass) =>
  a.dayOfWeek === b.dayOfWeek &&
  startMinutes(a.startTime) < startMinutes(b.startTime) + b.durationMin &&
  startMinutes(b.startTime) < startMinutes(a.startTime) + a.durationMin;

/** The classes that share room time with another class in the same room. */
export function overlappingIds(classes: UsageClass[]): Set<string> {
  const ids = new Set<string>();
  classes.forEach((a, i) =>
    classes.slice(i + 1).forEach((b) => {
      if (a.locationId === b.locationId && overlap(a, b)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }),
  );
  return ids;
}

function totals(classes: UsageClass[], rooms: number): UsageTotals {
  const openHours = rooms * OPEN_HOURS_PER_ROOM;
  const seatHoursOpen = openHours * CLASS_CAPACITY;
  const bookedHours = classes.reduce((sum, c) => sum + c.durationMin / 60, 0);
  const seatHoursFilled = classes.reduce((sum, c) => sum + (c.enrolled * c.durationMin) / 60, 0);
  const seatHoursBooked = bookedHours * CLASS_CAPACITY;
  let overlaps = 0;
  classes.forEach((a, i) =>
    classes.slice(i + 1).forEach((b) => {
      if (a.locationId === b.locationId && overlap(a, b)) overlaps += 1;
    }),
  );
  return {
    classes: classes.length,
    enrolled: classes.reduce((sum, c) => sum + c.enrolled, 0),
    bookedHours,
    openHours,
    seatHoursFilled,
    seatHoursOpen,
    roomUse: openHours ? bookedHours / openHours : 0,
    classFill: seatHoursBooked ? seatHoursFilled / seatHoursBooked : 0,
    efficiency: seatHoursOpen ? seatHoursFilled / seatHoursOpen : 0,
    overlaps,
  };
}

/** Overall and per-room usage. Classes in a room not listed are left out. */
export function computeRoomUsage(classes: UsageClass[], rooms: UsageRoom[]) {
  const roomIds = new Set(rooms.map((r) => r.id));
  const counted = classes.filter((c) => roomIds.has(c.locationId));
  return {
    overall: totals(counted, rooms.length),
    rooms: rooms.map((room): RoomUsage => {
      const here = counted.filter((c) => c.locationId === room.id);
      return { ...totals(here, 1), room, classIds: here.map((c) => c.id) };
    }),
  };
}

export type SavedMonth = {
  month: string; // "YYYY-MM-01"
  scope: string; // "all", or the room's location id
  room_name: string;
  seat_hours_filled: number | string;
  seat_hours_open: number | string;
};

export type TrendPoint = {
  month: string;
  bam: number | null;
  cumulative: number | null;
  rooms: Record<string, number | null>;
};

/** BAM's year runs April to March, so the running total restarts in April. */
const financialYear = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m >= 4 ? y : y - 1;
};

/**
 * Each saved month's efficiency, by room and for BAM, oldest first. Cumulative
 * adds up seat-hours rather than averaging percentages, so a month with more
 * rooms open carries its proper weight.
 */
export function buildTrend(saved: SavedMonth[]) {
  const share = (r?: SavedMonth) =>
    r && Number(r.seat_hours_open) ? Number(r.seat_hours_filled) / Number(r.seat_hours_open) : null;

  // A room's latest name, in case it was renamed along the way.
  const names = new Map<string, string>();
  [...saved]
    .sort((a, b) => a.month.localeCompare(b.month))
    .forEach((r) => { if (r.scope !== "all") names.set(r.scope, r.room_name); });
  const rooms = [...names]
    .map(([scope, name]) => ({ scope, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const months = [...new Set(saved.map((r) => r.month))].sort();
  let year: number | null = null;
  let filled = 0;
  let open = 0;
  const points = months.map((month): TrendPoint => {
    if (financialYear(month) !== year) {
      year = financialYear(month);
      filled = 0;
      open = 0;
    }
    const here = saved.filter((r) => r.month === month);
    const all = here.find((r) => r.scope === "all");
    filled += Number(all?.seat_hours_filled ?? 0);
    open += Number(all?.seat_hours_open ?? 0);
    return {
      month,
      bam: share(all),
      cumulative: open ? filled / open : null,
      rooms: Object.fromEntries(rooms.map((r) => [r.scope, share(here.find((h) => h.scope === r.scope))])),
    };
  });
  return { rooms, points };
}
