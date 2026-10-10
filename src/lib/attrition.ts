import { planWeekOneStart } from "@/lib/practiceWeek";

/**
 * Attrition: of everyone who has been in a class, how many left.
 *
 * A student who is de-registered keeps their enrolment, marked as dropped
 * with the day and the reason. A student removed because they were added by
 * mistake has no enrolment at all, and so never counts.
 */
export const LEAVE_REASONS = [
  "Schedule clash",
  "Moved away",
  "Lost interest",
  "Fees",
  "Health or family",
  "Moved to another class",
  "Other",
] as const;

export interface EnrolmentRow {
  batch_id: string;
  student_id: string;
  status: string;
  enrolled_on?: string | null;
  left_on?: string | null;
  leave_reason?: string | null;
}

export interface Attrition {
  /** In the class now. */
  active: number;
  /** De-registered. */
  left: number;
  /** Left, as a share of everyone who has been in the class. Null with nobody. */
  pct: number | null;
  /** Reasons given, most common first. */
  reasons: { reason: string; count: number }[];
  /** The course week each leaver left in, where it is known. */
  weeks: number[];
}

/** Which week of the class's course a date falls in; null before it began. */
export function courseWeekOf(date: string, courseStart: string | null, classDow: number | null): number | null {
  if (!courseStart) return null;
  const weekOne = planWeekOneStart(courseStart, classDow ?? 6);
  if (date < weekOne) return null;
  const days = Math.floor((new Date(`${date}T00:00:00`).getTime() - new Date(`${weekOne}T00:00:00`).getTime()) / 86_400_000);
  return Math.floor(days / 7) + 1;
}

export function attritionFor(
  rows: EnrolmentRow[],
  batch: { id: string; semester_start?: string | null; day_of_week?: number | null },
): Attrition {
  const mine = rows.filter((r) => r.batch_id === batch.id);
  const active = mine.filter((r) => r.status === "active").length;
  const gone = mine.filter((r) => r.status === "dropped");
  const total = active + gone.length;
  const counts = new Map<string, number>();
  for (const r of gone) {
    const reason = r.leave_reason?.trim() || "Not given";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return {
    active,
    left: gone.length,
    pct: total > 0 ? Math.round((gone.length / total) * 100) : null,
    reasons: [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    weeks: gone
      .map((r) => (r.left_on ? courseWeekOf(r.left_on, batch.semester_start ?? null, batch.day_of_week ?? null) : null))
      .filter((w): w is number => w != null)
      .sort((a, b) => a - b),
  };
}

/** "17% · 2 left (Schedule clash, Fees)" — one line for a list of classes. */
export function attritionLine(a: Attrition): string {
  if (a.pct == null) return "—";
  if (!a.left) return "0%";
  const why = a.reasons.filter((r) => r.reason !== "Not given").map((r) => r.reason).slice(0, 2).join(", ");
  return `${a.pct}% · ${a.left} left${why ? ` (${why})` : ""}`;
}
