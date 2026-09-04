import { useMemo } from "react";
import { useStudentMe } from "@/hooks/useStudentMe";
import { useStudentSongs, useStudentClassConfig } from "@/hooks/useBatchCoursework";
import { useStudentCoursePlan, planWeekNumberFor, daysForWeek } from "@/hooks/useCoursePlan";
import { useCourseVideos, useSignedVideoUrls } from "@/hooks/useCourseVideos";
import { useEnsureWeeklyPlan, useTodaysSession, useCompleteSegment, useMarkSessionComplete, isoMonday } from "@/hooks/useWeeklyPlan";
import { useLogPractice, usePracticeLogs, computeStreak } from "@/hooks/useStudentProgress";
import WeeklyCalendarStrip from "@/components/student/WeeklyCalendarStrip";
import { SESSION_TEMPLATES, BONUS_EMOJI } from "@/lib/sessionTemplates";

/**
 * Today, on one page, in the order a student needs it: where they are in the
 * week, what to do, then the material to do it with. Nothing opens or
 * navigates away.
 */
const Home = () => {
  const { data: student } = useStudentMe();
  const catalog = useStudentSongs();
  const { instrument, courseStartDate } = useStudentClassConfig();
  const { days: planDays } = useStudentCoursePlan(instrument);
  const { data: allVideos = [] } = useCourseVideos(instrument);
  const completeSeg = useCompleteSegment();
  const markComplete = useMarkSessionComplete();
  const logPractice = useLogPractice();
  const { data: logs = [] } = usePracticeLogs();
  const streak = useMemo(() => computeStreak(logs), [logs]);

  useEnsureWeeklyPlan();
  const session = useTodaysSession();

  const planDay = useMemo(() => {
    if (!session) return null;
    const wk = planWeekNumberFor(courseStartDate, isoMonday(new Date(session.scheduled_date)));
    if (!wk) return null;
    return daysForWeek(planDays, wk)[session.session_index] ?? null;
  }, [session, courseStartDate, planDays]);

  const videos = useMemo(() => {
    const ids = planDay?.video_ids ?? [];
    return ids.map((id) => allVideos.find((v) => v.id === id)).filter(Boolean) as typeof allVideos;
  }, [planDay, allVideos]);
  const { data: urls = {} } = useSignedVideoUrls(videos.map((v) => v.storage_path));

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
        },
        {
          key: "focus" as const,
          emoji: "🎯",
          label: "Focus",
          mins: session.focus_target_min,
          song: title(session.focus_song_id),
          text: session.focus_instruction,
          done: session.focus_completed,
        },
        {
          key: "bonus" as const,
          emoji: BONUS_EMOJI[session.bonus_type],
          label: "Bonus",
          mins: session.bonus_target_min,
          song: title(session.bonus_song_id),
          text: session.bonus_instruction,
          done: session.bonus_completed,
        },
      ]
    : [];

  return (
    <section className="view view-home active">
      <div className="home" style={{ paddingBottom: 60, maxWidth: 640, margin: "0 auto" }}>
        {/* Where they are in the week: practice days and the class day. */}
        <WeeklyCalendarStrip />

        <header className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--gold-deep)" }}>
              Today · {new Date().toLocaleDateString(undefined, { weekday: "long" })}
            </div>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold" style={{ color: "var(--ink)" }}>
              Hi {firstName}
            </h1>
            {session && tpl && (
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                {tpl.emoji} {tpl.label} · {totalMins} min
              </p>
            )}
          </div>
          <div
            className="shrink-0 rounded-2xl px-4 py-2 text-center"
            style={{ background: "var(--gold-bg)", border: "1px solid var(--gold-soft)" }}
            title={streak === 0 ? "Practise today to start a streak" : `${streak}-day streak`}
          >
            <div className="text-xl font-bold" style={{ color: "var(--ink)" }}>
              <span className="bounce-soft">🔥</span> {streak}
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
              day{streak === 1 ? "" : "s"}
            </div>
          </div>
        </header>

        {!session ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-3xl mb-2" aria-hidden>🌤️</div>
            <div className="font-semibold" style={{ color: "var(--ink)" }}>No practice planned today</div>
            <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
              Enjoy the day off — your next session will be here when it's due.
            </p>
          </div>
        ) : (
          <>
            {/* The three planned sections. */}
            <div className="flex flex-col gap-3">
              {sections.map((s) => (
                <div
                  key={s.key}
                  className="rounded-2xl p-5"
                  style={{
                    background: s.done ? "rgba(16,185,129,0.07)" : "var(--card)",
                    border: `1px solid ${s.done ? "rgba(16,185,129,0.35)" : "var(--border)"}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden>{s.emoji}</span>
                    <span className="font-bold" style={{ color: "var(--ink)" }}>{s.label}</span>
                    <span className="text-xs tabular-nums" style={{ color: "var(--ink-faint)" }}>{s.mins} min</span>
                    {s.done && <span className="ml-auto text-sm" style={{ color: "#10b981" }}>Done ✓</span>}
                  </div>

                  {s.song && (
                    <div className="text-sm font-semibold mt-2" style={{ color: "var(--navy)" }}>{s.song}</div>
                  )}
                  {s.text && (
                    <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.text}</p>
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
            {/* Material second: what to do comes before what to watch. */}
            {videos.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--ink-soft)" }}>
                  Today's lessons
                </div>
                <div className="flex flex-col gap-4">
                  {videos.map((v) => (
                    <div key={v.id}>
                      {urls[v.storage_path] ? (
                        <video
                          controls
                          preload="none"
                          playsInline
                          src={urls[v.storage_path]}
                          style={{ width: "100%", borderRadius: 14, background: "#000", maxHeight: 220 }}
                        />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "16 / 9", maxHeight: 220, borderRadius: 14, background: "rgba(0,0,0,0.85)", display: "grid", placeItems: "center", color: "#fff", fontSize: 13 }}>
                          Loading video…
                        </div>
                      )}
                      <div className="text-sm font-semibold mt-1.5" style={{ color: "var(--ink)" }}>{v.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default Home;
