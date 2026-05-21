import { useMemo } from "react";
import { useStudentBatchDay, useWeeklyPlan, isoMonday, practiceDaysForWeek } from "@/hooks/useWeeklyPlan";
import { usePracticeLogs } from "@/hooks/useStudentProgress";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeeklyCalendarStrip() {
  const { data: batch } = useStudentBatchDay();
  const { data: plan = [] } = useWeeklyPlan();
  const { data: logs = [] } = usePracticeLogs();

  const weekStart = isoMonday();
  const classDow = batch?.day_of_week ?? 6;
  // class as Monday-offset (0=Mon..6=Sun)
  const classOffset = (classDow + 6) % 7;
  const practiceDates = useMemo(
    () => practiceDaysForWeek(weekStart, classDow),
    [weekStart, classDow]
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const practicedDays = useMemo(() => new Set(logs.map((l) => l.played_on)), [logs]);

  const days = useMemo(() => {
    const arr: { iso: string; offset: number; isClass: boolean; isPractice: boolean; isToday: boolean; isPast: boolean; sessionCompleted: boolean }[] = [];
    for (let o = 0; o < 7; o++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + o);
      const iso = d.toISOString().slice(0, 10);
      const isPractice = practiceDates.includes(iso);
      const planEntry = plan.find((p) => p.scheduled_date === iso);
      arr.push({
        iso,
        offset: o,
        isClass: o === classOffset,
        isPractice,
        isToday: iso === todayIso,
        isPast: iso < todayIso,
        sessionCompleted: !!planEntry?.completed_at || practicedDays.has(iso),
      });
    }
    return arr;
  }, [weekStart, classOffset, practiceDates, plan, todayIso, practicedDays]);

  return (
    <section
      className="rounded-2xl p-4 md:p-5 mb-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
          This week
        </div>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--ink-faint)" }}>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} />Practice</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />Class</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const ring = d.isToday ? "0 0 0 2px var(--navy)" : undefined;
          const bg = d.isPast && !d.sessionCompleted
            ? "var(--paper-cool)"
            : d.sessionCompleted
            ? "rgba(16,185,129,0.10)"
            : "var(--paper-warm)";
          return (
            <div
              key={d.iso}
              className="rounded-xl py-2.5 px-1 flex flex-col items-center gap-1.5 transition-all"
              style={{
                background: bg,
                border: "1px solid var(--border)",
                boxShadow: ring,
                opacity: d.isPast && !d.sessionCompleted && !d.isToday ? 0.5 : 1,
              }}
              title={DAY_FULL[d.offset]}
            >
              <div className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-soft)" }}>
                {DAY_LETTERS[d.offset]}
              </div>
              <div className="text-base font-bold" style={{ color: "var(--ink)" }}>
                {new Date(d.iso).getDate()}
              </div>
              <div className="h-3 flex items-center justify-center">
                {d.sessionCompleted ? (
                  <span style={{ color: "#10b981", fontSize: 13, lineHeight: 1 }}>✓</span>
                ) : d.isClass ? (
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
                ) : d.isPractice ? (
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
