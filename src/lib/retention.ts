// Retention scoring per student.
export type RetentionFlag = "green" | "amber" | "red";

export interface RetentionSignals {
  practiceDrop: boolean; // last 14d vs prior 14d < -30%
  attendanceTrend: boolean; // > 1 absence in last 4 weeks
  staleApp: boolean; // > 7 days since last app open
  recentMinutes: number;
  priorMinutes: number;
  recentAbsences: number;
  daysSinceLastOpen: number | null;
}

export interface RetentionResult {
  flag: RetentionFlag;
  badCount: number;
  signals: RetentionSignals;
}

interface PracticeRow { played_on: string; duration_min: number; created_at?: string }
interface AttendanceRow { status: string; session_date?: string }

function daysAgo(d: string | Date) {
  const now = Date.now();
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  return Math.floor((now - t) / 86400000);
}

export function computeRetention(
  practice: PracticeRow[],
  attendance: AttendanceRow[],
  lastOpen: string | null
): RetentionResult {
  // Signal 1: practice frequency last 14d vs prior 14d
  let recentMinutes = 0;
  let priorMinutes = 0;
  for (const p of practice) {
    const age = daysAgo(p.played_on);
    if (age < 14) recentMinutes += p.duration_min;
    else if (age < 28) priorMinutes += p.duration_min;
  }
  const practiceDrop =
    priorMinutes > 0 ? (recentMinutes - priorMinutes) / priorMinutes < -0.3 : recentMinutes === 0;

  // Signal 2: attendance trend last 4 weeks
  const recentAbsences = attendance.filter((a) => {
    if (a.status !== "absent") return false;
    if (!a.session_date) return true;
    return daysAgo(a.session_date) <= 28;
  }).length;
  const attendanceTrend = recentAbsences > 1;

  // Signal 3: days since last app open
  const daysSinceLastOpen = lastOpen ? daysAgo(lastOpen) : null;
  const staleApp = daysSinceLastOpen === null || daysSinceLastOpen > 7;

  const badCount = [practiceDrop, attendanceTrend, staleApp].filter(Boolean).length;
  const flag: RetentionFlag = badCount === 0 ? "green" : badCount === 1 ? "amber" : "red";

  return {
    flag,
    badCount,
    signals: { practiceDrop, attendanceTrend, staleApp, recentMinutes, priorMinutes, recentAbsences, daysSinceLastOpen },
  };
}
