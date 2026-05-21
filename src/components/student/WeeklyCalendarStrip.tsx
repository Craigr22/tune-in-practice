import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStudentBatchDay, useWeeklyPlan, useEnsureWeeklyPlan, isoMonday, addWeeks, practiceDaysForWeek } from "@/hooks/useWeeklyPlan";
import { usePracticeLogs } from "@/hooks/useStudentProgress";
import { SONGS } from "@/data/songs";
import { SESSION_TEMPLATES } from "@/lib/sessionTemplates";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

export default function WeeklyCalendarStrip() {
  const navigate = useNavigate();
  const currentWeek = isoMonday();
  const [weekStart, setWeekStart] = useState(currentWeek);

  const { data: batch } = useStudentBatchDay();
  // Ensure a plan exists for whatever week the user is viewing (generates future weeks on demand)
  useEnsureWeeklyPlan(weekStart);
  const { data: plan = [] } = useWeeklyPlan(weekStart);
  const { data: logs = [] } = usePracticeLogs();

  const classDow = batch?.day_of_week ?? 6;
  const classOffset = (classDow + 6) % 7;
  const practiceDates = useMemo(
    () => practiceDaysForWeek(weekStart, classDow),
    [weekStart, classDow]
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const practicedDays = useMemo(() => new Set(logs.map((l) => l.played_on)), [logs]);

  const days = useMemo(() => {
    const arr: {
      iso: string;
      offset: number;
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
      const iso = d.toISOString().slice(0, 10);
      const isPractice = practiceDates.includes(iso);
      const session = plan.find((p) => p.scheduled_date === iso);
      arr.push({
        iso,
        offset: o,
        isClass: o === classOffset,
        isPractice,
        isToday: iso === todayIso,
        isPast: iso < todayIso,
        sessionCompleted: !!session?.completed_at || practicedDays.has(iso),
        session,
      });
    }
    return arr;
  }, [weekStart, classOffset, practiceDates, plan, todayIso, practicedDays]);

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const selected = days.find((d) => d.iso === selectedIso);
  const selectedSong = selected?.session ? SONGS.find((s) => s.id === selected.session!.focus_song_id) : null;
  const selectedTpl = selected?.session ? SESSION_TEMPLATES[selected.session.session_type] : null;

  const openSession = (s: NonNullable<typeof selected>["session"]) => {
    if (!s) return;
    const song = SONGS.find((x) => x.id === s.focus_song_id);
    if (!song) return;
    navigate(`/student/song/${song.id}`, { state: { planSessionId: s.id } });
  };

  const weekLabel =
    weekStart === currentWeek ? "This week" :
    weekStart === addWeeks(currentWeek, 1) ? "Next week" :
    weekStart === addWeeks(currentWeek, -1) ? "Last week" :
    fmtRange(weekStart);

  return (
    <section
      className="rounded-2xl p-4 md:p-5 mb-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setWeekStart(addWeeks(weekStart, -1)); setSelectedIso(null); }}
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
            onClick={() => { setWeekStart(addWeeks(weekStart, 1)); setSelectedIso(null); }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold hover:opacity-80"
            style={{ background: "var(--paper-cool)", color: "var(--ink)" }}
            aria-label="Next week"
          >›</button>
          {weekStart !== currentWeek && (
            <button
              onClick={() => { setWeekStart(currentWeek); setSelectedIso(null); }}
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
              onClick={() => clickable && setSelectedIso(isSelected ? null : d.iso)}
              disabled={!clickable}
              className="rounded-xl py-2.5 px-1 flex flex-col items-center gap-1.5 transition-all disabled:cursor-default"
              style={{
                background: bg,
                border: "1px solid var(--border)",
                boxShadow: ring,
                opacity: d.isPast && !d.sessionCompleted && !d.isToday ? 0.5 : 1,
                cursor: clickable ? "pointer" : "default",
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
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="mt-3 rounded-xl p-3 flex items-center justify-between gap-3"
          style={{ background: "var(--paper-cool)", border: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
              {DAY_FULL[selected.offset]} {new Date(selected.iso).getDate()} {MONTHS[new Date(selected.iso).getMonth()]}
            </div>
            {selected.isClass ? (
              <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                In-person class day
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
          {selected.session && (
            <button
              onClick={() => openSession(selected.session)}
              className="shrink-0 rounded-full px-4 py-2 text-xs font-bold"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {selected.sessionCompleted ? "Review" : selected.isPast ? "Catch up" : "Open"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
