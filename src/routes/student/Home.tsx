import { useMemo, useState } from "react";
import { useStudentMe } from "@/hooks/useStudentMe";
import { useStudentSongs, useStudentClassConfig } from "@/hooks/useBatchCoursework";
import { useEnsureWeeklyPlan, useTodaysSession, useNextSession, useStudentBatchDay, useCompleteSegment, classWeekStart, addWeeks } from "@/hooks/useWeeklyPlan";
import { toast } from "sonner";
import { usePracticeLogs, computeStreak } from "@/hooks/useStudentProgress";
import WeeklyCalendarStrip from "@/components/student/WeeklyCalendarStrip";
import { useDayLessons } from "@/hooks/useDayLessons";
import LessonVideo from "@/components/student/LessonVideo";
import { SESSION_TEMPLATES } from "@/lib/sessionTemplates";
import { todayLocalIso, addDaysIso, onOrAfterDayOfWeek, dayLabel, timeLabel } from "@/lib/date";

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
  const { data: logs = [] } = usePracticeLogs();
  const streak = useMemo(() => computeStreak(logs), [logs]);

  const { data: batch } = useStudentBatchDay();

  useEnsureWeeklyPlan();
  // Also build the week after this one, so that on a rest day there is a "next
  // practice" to point at rather than a gap until the next lesson.
  useEnsureWeeklyPlan(batch ? addWeeks(classWeekStart(batch.day_of_week), 1) : undefined);
  const session = useTodaysSession();
  const nextSession = useNextSession();

  /**
   * Today's clips, and only today's.
   *
   * The page used to show the next session's material on a rest day, and let
   * a student tap any day in the week strip to read its lessons. That put the
   * course in front of them before it was taught; the day's work is the day's
   * work.
   */
  const todayLessons = useDayLessons(session);

  /**
   * Finishing the day.
   *
   * The session is still stored in three parts, so this ticks all three. The
   * server completes the session and writes the practice log the teacher's
   * roster reads in the same breath as the last one, and every call is
   * idempotent — a half-finished save is put right by tapping again.
   */
  const markDayDone = async () => {
    if (!session) return;
    try {
      for (const segment of ["warmup", "focus", "bonus"] as const) {
        await completeSeg.mutateAsync({ id: session.id, segment });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save that — try again");
    }
  };

  /**
   * The class that is today, if there is one.
   *
   * "What's next" deliberately starts from tomorrow, so on the class day
   * itself the header skipped straight past it to next week's — the one day
   * a student actually has to turn up was the one day the page didn't say so.
   */
  const classToday = useMemo(() => {
    if (batch?.day_of_week == null) return null;
    const today = todayLocalIso();
    if (new Date(`${today}T00:00:00`).getDay() !== batch.day_of_week) return null;
    // Not before the course begins.
    if (batch.semester_start && today < batch.semester_start) return null;
    return { at: timeLabel(batch.start_time) };
  }, [batch]);

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
  const focusSong = session
    ? catalog.find((s) => s.id === session.focus_song_id)?.title ?? null
    : null;
  // The session is still three parts underneath; the page treats it as one day.
  const dayDone = !!session && session.warmup_completed && session.focus_completed && session.bonus_completed;
  const tpl = session ? SESSION_TEMPLATES[session.session_type] : null;
  const totalMins = session
    ? session.warmup_target_min + session.focus_target_min + session.bonus_target_min
    : 0;

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
                {[
                  // The lesson comes first: day 1 of the week is the class
                  // itself, and its material sits underneath.
                  classToday && `🎓 Class today${classToday.at ? ` at ${classToday.at}` : ""}`,
                  session && tpl
                    ? `${tpl.emoji} ${tpl.label} · ${totalMins} min`
                    : classToday
                    ? null
                    : nextUp
                    ? `No practice today · ${nextUp.emoji} ${nextUp.label.toLowerCase()} ${dayLabel(nextUp.date).toLowerCase()}${nextUp.at ? ` at ${nextUp.at}` : ""}`
                    : "No practice today · enjoy the day off",
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
            <WeeklyCalendarStrip embedded />
          </div>
        </section>

        {session && (
          /* The day itself: what the admin planned for it, in the order they
             put it in. The warm-up / focus / bonus split has come off — a
             student reads the page and plays, rather than working through
             three labelled boxes. */
          <div
            className="rounded-2xl p-5"
            style={{
              background: dayDone ? "rgba(16,185,129,0.07)" : "var(--card)",
              border: `1px solid ${dayDone ? "rgba(16,185,129,0.35)" : "var(--border)"}`,
            }}
          >
            {focusSong && (
              <div className="text-sm font-semibold" style={{ color: "var(--navy)" }}>{focusSong}</div>
            )}

            {todayLessons.videos.length > 0 ? (
              <div className="mt-3 flex flex-col gap-7">
                {todayLessons.videos.map((v) => (
                  <LessonVideo
                    key={v.id}
                    src={todayLessons.urls[v.storage_path]}
                    path={v.storage_path}
                    title={v.title}
                    above={todayLessons.notes[v.id]?.above}
                    below={todayLessons.notes[v.id]?.below}
                    maxHeight={220}
                  />
                ))}
              </div>
            ) : (
              /* Nothing planned for this day yet — the generated instruction
                 is all there is to go on, so it stands in. */
              session.focus_instruction && (
                <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {session.focus_instruction}
                </p>
              )
            )}

            {dayDone ? (
              <div className="mt-5 text-sm font-bold" style={{ color: "#10b981" }}>
                ✓ Done for today
              </div>
            ) : (
              <button
                onClick={markDayDone}
                disabled={completeSeg.isPending}
                className="mt-5 rounded-xl px-4 py-2.5 text-sm font-bold transition-transform active:scale-95 disabled:opacity-60"
                style={{ background: "var(--navy)", color: "#fff" }}
              >
                {completeSeg.isPending ? "Saving…" : "I've practised today"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default Home;
