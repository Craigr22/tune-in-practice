import { useMemo, useState } from "react";
import { useStudentMe } from "@/hooks/useStudentMe";
import { useStudentSongs, useStudentClassConfig } from "@/hooks/useBatchCoursework";
import { useEnsureWeeklyPlan, useTodaysSession, useNextSession, useStudentBatchDay, useCompleteSegment, useMarkSessionComplete, isoMonday, addWeeks, planWeekOneMonday } from "@/hooks/useWeeklyPlan";
import { useLogPractice, usePracticeLogs, computeStreak } from "@/hooks/useStudentProgress";
import WeeklyCalendarStrip from "@/components/student/WeeklyCalendarStrip";
import { useDayLessons, type LessonDay } from "@/hooks/useDayLessons";
import LessonVideo from "@/components/student/LessonVideo";
import { SESSION_TEMPLATES, BONUS_EMOJI } from "@/lib/sessionTemplates";
import type { CourseVideo } from "@/hooks/useCourseVideos";
import { todayLocalIso, addDaysIso, onOrAfterDayOfWeek, dayLabel, timeLabel } from "@/lib/date";

const NO_VIDEOS: CourseVideo[] = [];

/**
 * Today, on one page, in the order a student needs it: where they are in the
 * week, what to do, then the material to do it with. Nothing opens or
 * navigates away.
 */
const Home = () => {
  const { data: student } = useStudentMe();
  const catalog = useStudentSongs();
  const { instrument, courseStartDate } = useStudentClassConfig();
  const completeSeg = useCompleteSegment();
  const markComplete = useMarkSessionComplete();
  const logPractice = useLogPractice();
  const { data: logs = [] } = usePracticeLogs();
  const streak = useMemo(() => computeStreak(logs), [logs]);

  useEnsureWeeklyPlan();
  // Also build next week, so that on a rest day there is a "next practice"
  // to point at rather than a gap until Monday.
  useEnsureWeeklyPlan(addWeeks(isoMonday(), 1));
  const session = useTodaysSession();
  const nextSession = useNextSession();
  const [peek, setPeek] = useState<LessonDay | null>(null);
  const { data: batch } = useStudentBatchDay();

  // Today's clips belong to today's Focus step and stay there.
  const todayLessons = useDayLessons(session);

  /**
   * The day the student is looking at away from today's work: one they tapped
   * in the week strip, or — on a rest day — the next session, since the clips
   * are worth watching ahead of a session rather than only during it.
   */
  const viewingDay = peek ?? (session ? null : nextSession);
  const viewing = useDayLessons(viewingDay);

  /**
   * Ticking off a segment. When the last one lands, the session is marked
   * complete and a practice log is written — that log is what the teacher's
   * roster draws its practice history and retention flags from, so without it
   * finishing a session would leave no trace.
   */
  const markSegmentDone = (segment: "warmup" | "focus" | "bonus") => {
    if (!session) return;
    completeSeg.mutate({ id: session.id, segment });

    const doneAfter = {
      warmup: segment === "warmup" || session.warmup_completed,
      focus: segment === "focus" || session.focus_completed,
      bonus: segment === "bonus" || session.bonus_completed,
    };
    if (!(doneAfter.warmup && doneAfter.focus && doneAfter.bonus)) return;
    if (session.completed_at) return; // already counted

    markComplete.mutate(session.id);
    logPractice.mutate({
      songId: session.focus_song_id,
      durationMin:
        session.warmup_target_min + session.focus_target_min + session.bonus_target_min,
      selfBadge: null,
      tuningCheckCompleted: false,
      checkIn: null,
      sharedWithTeacher: true,
    });
  };

  /**
   * On a rest day, the single next thing due — the nearer of the next planned
   * practice and the next class. It goes in the header's status line rather
   * than a card of its own: the week strip below already shows both, so a
   * second block would say the same thing twice.
   */
  const nextUp = useMemo(() => {
    const today = todayLocalIso();
    const items: { emoji: string; label: string; date: string; at: string | null }[] = [];

    if (nextSession) {
      items.push({ emoji: "🎸", label: "Practice", date: nextSession.scheduled_date, at: null });
    }

    if (batch?.day_of_week != null) {
      // From tomorrow at the earliest — today's class isn't "next up" — and
      // never before the class has started at all.
      const tomorrow = addDaysIso(today, 1);
      const earliest =
        batch.semester_start && batch.semester_start > tomorrow ? batch.semester_start : tomorrow;
      items.push({
        emoji: "🎓",
        label: "Class",
        date: onOrAfterDayOfWeek(earliest, batch.day_of_week),
        at: timeLabel(batch.start_time),
      });
    }

    return items.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }, [nextSession, batch]);

  const firstName = (student?.name || "").split(" ")[0] || "there";
  const title = (id: string | null) => (id ? catalog.find((s) => s.id === id)?.title ?? null : null);
  const tpl = session ? SESSION_TEMPLATES[session.session_type] : null;
  const totalMins = session
    ? session.warmup_target_min + session.focus_target_min + session.bonus_target_min
    : 0;

  const sections = session
    ? [
        {
          key: "warmup" as const,
          emoji: "♪",
          label: "Warm-up",
          mins: session.warmup_target_min,
          song: title(session.warmup_song_id),
          text: session.warmup_instruction,
          done: session.warmup_completed,
          videos: NO_VIDEOS,
        },
        {
          key: "focus" as const,
          emoji: "🎯",
          label: "Focus",
          mins: session.focus_target_min,
          song: title(session.focus_song_id),
          text: session.focus_instruction,
          done: session.focus_completed,
          // The day's videos are planned per day, not per segment, so they
          // belong to the step that actually works on the material.
          videos: todayLessons.videos,
        },
        {
          key: "bonus" as const,
          emoji: BONUS_EMOJI[session.bonus_type],
          label: "Bonus",
          mins: session.bonus_target_min,
          song: title(session.bonus_song_id),
          text: session.bonus_instruction,
          done: session.bonus_completed,
          videos: NO_VIDEOS,
        },
      ]
    : [];

  return (
    <section className="view view-home active">
      <div className="home" style={{ paddingBottom: 60, maxWidth: 640, margin: "0 auto" }}>
        {/* One header: who they are, where they are in the week, and how
            they're doing — these belong together, not stacked as separate
            cards. */}
        <section
          className="rounded-2xl mb-4 overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-end justify-between gap-3 px-4 pt-4 md:px-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--gold-deep)" }}>
                Today · {new Date().toLocaleDateString(undefined, { weekday: "long" })}
              </div>
              <h1 className="mt-1 text-2xl md:text-3xl font-bold" style={{ color: "var(--ink)" }}>
                Hi {firstName}
              </h1>
              {/* One status line, whatever the day holds: today's session, or
                  — on a rest day — the next thing due. */}
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                {session && tpl
                  ? `${tpl.emoji} ${tpl.label} · ${totalMins} min`
                  : nextUp
                  ? `No practice today · ${nextUp.emoji} ${nextUp.label.toLowerCase()} ${dayLabel(nextUp.date).toLowerCase()}${nextUp.at ? ` at ${nextUp.at}` : ""}`
                  : "No practice today · enjoy the day off"}
              </p>
            </div>
            <div
              className="shrink-0 text-center"
              title={streak === 0 ? "Practise today to start a streak" : `${streak}-day streak`}
            >
              <div className="text-2xl font-bold leading-none" style={{ color: "var(--ink)" }}>
                <span className="bounce-soft">🔥</span> {streak}
              </div>
              <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--ink-faint)" }}>
                day{streak === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="px-4 pb-4 pt-3 md:px-5">
            <WeeklyCalendarStrip embedded onSelectDay={setPeek} />
          </div>
        </section>

        {/* Clips for the day being looked at: one tapped in the week strip, or
            the next session on a rest day. Same page, no card of its own. */}
        {viewingDay && viewing.videos.length > 0 && (
          <div className={session ? "mb-4" : ""}>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--ink-soft)" }}>
              {peek
                ? `Lessons · ${dayLabel(peek.scheduled_date)}`
                : `Watch ahead · ${dayLabel(viewingDay.scheduled_date).toLowerCase()}`}
            </div>
            <div className="flex flex-col gap-7">
              {viewing.videos.map((v) => (
                <div key={v.id}>
                  <LessonVideo
                    src={viewing.urls[v.storage_path]}
                    path={v.storage_path}
                    title={v.title}
                    caption={v.description}
                    maxHeight={220}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {session && (
          /* Today's three steps, in order. The lesson videos live inside the
             step that refers to them rather than in a section of their own —
             the focus instruction usually says to watch and then play, so
             the two belong in the same place. */
          <div className="flex flex-col gap-3">
            {sections.map((s, i) => (
              <div
                key={s.key}
                className="rounded-2xl p-5"
                style={{
                  background: s.done ? "rgba(16,185,129,0.07)" : "var(--card)",
                  border: `1px solid ${s.done ? "rgba(16,185,129,0.35)" : "var(--border)"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full grid place-items-center text-xs font-bold"
                    style={{
                      background: s.done ? "#10b981" : "var(--paper-cool)",
                      color: s.done ? "#fff" : "var(--ink-soft)",
                    }}
                    aria-hidden
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  <span className="text-lg" aria-hidden>{s.emoji}</span>
                  <span className="font-bold" style={{ color: "var(--ink)" }}>{s.label}</span>
                  <span className="text-xs tabular-nums" style={{ color: "var(--ink-faint)" }}>{s.mins} min</span>
                  {s.done && <span className="ml-auto text-sm" style={{ color: "#10b981" }}>Done</span>}
                </div>

                {s.song && (
                  <div className="text-sm font-semibold mt-2" style={{ color: "var(--navy)" }}>{s.song}</div>
                )}
                {s.text && (
                  <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.text}</p>
                )}

                {s.videos.length > 0 && (
                  <div className="mt-4 flex flex-col gap-7">
                    {s.videos.map((v) => (
                      <div key={v.id}>
                        <LessonVideo
                          src={todayLessons.urls[v.storage_path]}
                          path={v.storage_path}
                          title={v.title}
                          caption={v.description}
                          maxHeight={220}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {!s.done && (
                  <button
                    onClick={() => markSegmentDone(s.key)}
                    disabled={completeSeg.isPending}
                    className="mt-3 rounded-xl px-4 py-2 text-sm font-bold transition-transform active:scale-95 disabled:opacity-60"
                    style={{ background: "var(--navy)", color: "#fff" }}
                  >
                    Mark {s.label.toLowerCase()} done
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Home;
