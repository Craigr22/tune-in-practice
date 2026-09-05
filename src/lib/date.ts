/**
 * Local calendar dates as YYYY-MM-DD.
 *
 * Date.toISOString() converts to UTC first, so east of UTC a local midnight
 * becomes the previous evening and the date comes out a day early. In IST
 * (UTC+5:30) that shifted every practice day back one — plans landed on
 * Sun/Tue/Thu instead of Mon/Wed/Fri, and "today" could miss entirely.
 *
 * These read the local components instead, which is what a school calendar
 * actually means by a date.
 */
export function toLocalIso(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today, in the viewer's own timezone. */
export const todayLocalIso = () => toLocalIso(new Date());

/** The Monday of the week containing `d` (ISO weeks: Monday–Sunday). */
export function isoMondayOf(d: Date | string = new Date()): string {
  const x = typeof d === "string" ? new Date(`${d}T00:00:00`) : new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return toLocalIso(x);
}

/** `iso` shifted by n days, still as a local date string. */
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toLocalIso(d);
}

/**
 * The first `dayOfWeek` (0=Sun..6=Sat) falling on or after `iso`.
 *
 * A class starts when it first meets. Picking a Wednesday for a class that
 * runs on Sundays used to store the Wednesday, so the course was treated as
 * begun days before anyone had attended a lesson — practice appeared first
 * and the calendar's first class sat later. Snapping forward keeps the start
 * date and the first class the same day.
 */
export function onOrAfterDayOfWeek(iso: string, dayOfWeek: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return addDaysIso(iso, (dayOfWeek - d.getDay() + 7) % 7);
}

/** "Today" / "Tomorrow" / "Sunday 6 Sep" — how a student would say the date. */
export function dayLabel(iso: string, today: string = todayLocalIso()): string {
  if (iso === today) return "Today";
  if (iso === addDaysIso(today, 1)) return "Tomorrow";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

/** "3:00 pm" from a stored "15:00:00". */
export function timeLabel(hhmmss: string | null | undefined): string | null {
  if (!hhmmss) return null;
  const [h, m] = hhmmss.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
