import { useMemo, useState } from "react";
import { useStudentBatchDay, useWeeklyPlan, useEnsureWeeklyPlan, classWeekStart, addWeeks, sessionDatesForWeek, planWeekOneStart } from "@/hooks/useWeeklyPlan";
import { usePracticeLogs } from "@/hooks/useStudentProgress";
import { useStudentClassConfig } from "@/hooks/useBatchCoursework";
import { useSongs } from "@/hooks/useSongs";
import { SESSION_TEMPLATES } from "@/lib/sessionTemplates";
import { toLocalIso } from "@/lib/date";

/** Indexed by JS day (0=Sun..6=Sat) — the week starts at the class, not Monday. */
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtRange(weekStart: string) {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const sm = MONTHS[start.getMonth()];
  const em = MONTHS[end.getMonth()];
  return sm === em
    ? `${sm} ${start.getDate()}–${end.getDate()}`
    : `${sm} ${start.getDate()} – ${em} ${end.getDate()}`;
}

export default function WeeklyCalendarStrip({
  embedded = false,
  onSelectDay,
}: {
  embedded?: boolean;
  /** Told which day the student is looking at, so the page can follow along. */
  onSelectDay?: (day: { scheduled_date: string; session_index: number } | null) => void;
} = {}) {
  const { songs } = useSongs();
  const { data: batch } = useStudentBatchDay();
  const classDow = batch?.day_of_week ?? 6;
  /**
   * A practice week runs lesson to lesson: it opens on the class day and the
   * two practice days follow it, so the strip reads in the order it happens.
   *
   * Which weekday that is arrives with the batch, a moment after the first
   * render. Holding the week in state meant the first render's guess — a
   * Saturday — could stick: the strip stayed anchored a day early, so the
   * class cell sat on the wrong date and the real one was an inert square
   * that opened nothing. Paging moves an offset instead, so the anchor
   * follows the class day as soon as it is known, whatever the student is
   * looking at.
   */
  const currentWeek = classWeekStart(classDow);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = addWeeks(currentWeek, weekOffset);
  // Ensure a plan exists for whatever week the user is viewing (generates future weeks on demand)
  useEnsureWeeklyPlan(weekStart);
  const { data: plan = [] } = useWeeklyPlan(weekStart);
  const { data: logs = [] } = usePracticeLogs();

  const { courseStartDate } = useStudentClassConfig();
  /**
   * The course begins at its first lesson, not at the date typed into the
   * settings. Marking practice from the raw start date put blue dots on days
   * in the run-up to week one — days no session can ever exist for, because
   * the plan starts at the first class. They opened on "generating your
   * session…" and stayed there.
   */
  const startsOn = useMemo(() => {
    const raw = courseStartDate ?? batch?.semester_start ?? null;
    return raw ? planWeekOneStart(raw, classDow) : null;
  }, [courseStartDate, batch?.semester_start, classDow]);
  // Nothing is marked until the class day is known, so no day is labelled from
  // a guess and then relabelled.
  const beforeStart = (iso: string) => !batch || !startsOn || iso < startsOn;

  // Day 1 is the class itself; the practice days are the two that follow.
  const practiceDates = useMemo(() => sessionDatesForWeek(weekStart).slice(1), [weekStart]);

  const todayIso = toLocalIso();
  const practicedDays = useMemo(() => new Set(logs.map((l) => l.played_on)), [logs]);

  const days = useMemo(() => {
    const arr: {
      iso: string;
      /** JS day, 0=Sun..6=Sat — used only to name the day. */
      dow: number;
      isClass: boolean;
      isPractice: boolean;
      isToday: boolean;
      isPast: boolean;
      sessionCompleted: boolean;
      session: typeof plan[number] | undefined;
    }[] = [];
    for (let o = 0; o < 7; o++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + o);
      const iso = toLocalIso(d);
      const isPractice = practiceDates.includes(iso) && !beforeStart(iso);
      // A session left over from before the course began isn't a day to open:
      // it has no dot, so a cell that responded to a tap looked like a bug.
      const session = beforeStart(iso) ? undefined : plan.find((p) => p.scheduled_date === iso);
      arr.push({
        iso,
        dow: d.getDay(),
        isClass: o === 0 && !beforeStart(iso),
        isPractice,
        isToday: iso === todayIso,
        isPast: iso < todayIso,
        sessionCompleted: !!session?.completed_at || practicedDays.has(iso),
        session,
      });
    }
    return arr;
  }, [weekStart, practiceDates, plan, todayIso, practicedDays, startsOn]);

  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const select = (iso: string | null) => {
    setSelectedIso(iso);
    const s = iso ? days.find((d) => d.iso === iso)?.session : undefined;
    onSelectDay?.(s ? { scheduled_date: s.scheduled_date, session_index: s.session_index } : null);
  };
  const selected = days.find((d) => d.iso === selectedIso);
  const selectedSong = selected?.session ? songs.find((s) => s.id === selected.session!.focus_song_id) : null;
  const selectedTpl = selected?.session ? SESSION_TEMPLATES[selected.session.session_type] : null;

  const weekLabel =
    weekOffset === 0 ? "This week" :
    weekOffset === 1 ? "Next week" :
    weekOffset === -1 ? "Last week" :
    fmtRange(weekStart);

  return (
    <section
      className={embedded ? "" : "rounded-2xl p-4 md:p-5 mb-4"}
      style={
        embedded
          // Part of a larger header card — no card of its own.
          ? undefined
          : { background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }
      }
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setWeekOffset((n) => n - 1); select(null); }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold hover:opacity-80"
            style={{ background: "var(--paper-cool)", color: "var(--ink)" }}
            aria-label="Previous week"
          >‹</button>
          <div className="flex flex-col">
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
              {weekLabel}
            </div>
            <div className="text-[10px]" style={{ color: "var(--ink-faint)" }}>{fmtRange(weekStart)}</div>
          </div>
          <button
            onClick={() => { setWeekOffset((n) => n + 1); select(null); }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold hover:opacity-80"
            style={{ background: "var(--paper-cool)", color: "var(--ink)" }}
            aria-label="Next week"
          >›</button>
          {weekOffset !== 0 && (
            <button
              onClick={() => { setWeekOffset(0); select(null); }}
              className="ml-1 text-[11px] font-semibold underline"
              style={{ color: "var(--navy)" }}
            >Today</button>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--ink-faint)" }}>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} />Practice</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />Class</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isSelected = d.iso === selectedIso;
          const ring = isSelected
            ? "0 0 0 2px var(--gold-deep)"
            : d.isToday ? "0 0 0 2px var(--navy)" : undefined;
          const bg = d.isPast && !d.sessionCompleted
            ? "var(--paper-cool)"
            : d.sessionCompleted
            ? "rgba(16,185,129,0.10)"
            : "var(--paper-warm)";
          const clickable = !!d.session || d.isClass || d.isPractice;
          return (
            <button
              key={d.iso}
              onClick={() => clickable && select(isSelected ? null : d.iso)}
              disabled={!clickable}
              className="rounded-xl py-2.5 px-1 flex flex-col items-center gap-1.5 transition-all disabled:cursor-default"
              style={{
                background: bg,
                border: "1px solid var(--border)",
                boxShadow: ring,
                opacity: d.isPast && !d.sessionCompleted && !d.isToday ? 0.5 : 1,
                cursor: clickable ? "pointer" : "default",
              }}
              title={DAY_FULL[d.dow]}
            >
              <div className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-soft)" }}>
                {DAY_LETTERS[d.dow]}
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
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="mt-3 rounded-xl p-3"
          style={{ background: "var(--paper-cool)", border: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
              {DAY_FULL[selected.dow]} {new Date(selected.iso).getDate()} {MONTHS[new Date(selected.iso).getMonth()]}
              </div>
            {selected.isClass ? (
              <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                In-person class day
              </div>
            ) : selected.iso > todayIso ? (
                <div className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  Practice day — you'll see it on the day.
                </div>
            ) : selected.session && selectedSong && selectedTpl ? (
                <div className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                  {selectedTpl.emoji} {selectedTpl.label} · {selectedSong.title}
                  <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--ink-soft)" }}>
                    {selected.session.warmup_target_min + selected.session.focus_target_min + selected.session.bonus_target_min} min
                  </span>
                </div>
            ) : selected.isPractice ? (
                <div className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  Generating your session… give it a sec.
                </div>
            ) : (
              <div className="text-sm" style={{ color: "var(--ink-soft)" }}>No session scheduled.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
