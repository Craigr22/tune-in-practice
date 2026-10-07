const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Saturday · 10:00 AM" — how a teacher actually identifies a class. */
export function classWhen(batch: { day_of_week?: number | null; start_time?: string | null } | null | undefined): string {
  const day = DAYS[batch?.day_of_week ?? -1] ?? "";
  const t = (batch?.start_time ?? "").slice(0, 5);
  if (!t) return day;
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${day} · ${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}
