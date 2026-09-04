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
