import { addDays, format, parse } from "date-fns";

export interface CalendarQueryRange {
  start: string;
  end: string;
}

const isoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** Convert every range shape emitted by react-big-calendar into DB bounds. */
export function calendarQueryRange(
  value: Date[] | { start: Date; end: Date } | null | undefined,
  anchor = new Date(),
): CalendarQueryRange {
  if (Array.isArray(value) && value.length) {
    return { start: isoDate(value[0]), end: isoDate(value[value.length - 1]) };
  }
  if (value && "start" in value && "end" in value) {
    return { start: isoDate(value.start), end: isoDate(value.end) };
  }
  // Covers the initial render and gives agenda/month navigation enough room.
  return { start: isoDate(addDays(anchor, -45)), end: isoDate(addDays(anchor, 45)) };
}

/** Build local calendar times without parsing a date-only value as UTC. */
export function sessionDateTimes(
  scheduledDate: string,
  startTime: string | null | undefined,
  durationMin: number | null | undefined,
) {
  const start = parse(scheduledDate, "yyyy-MM-dd", new Date());
  const [hours, minutes] = (startTime || "00:00:00").split(":").map(Number);
  start.setHours(hours, minutes, 0, 0);
  return {
    start,
    end: new Date(start.getTime() + (durationMin ?? 60) * 60_000),
  };
}
