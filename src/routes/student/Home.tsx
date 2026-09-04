import { useMemo } from "react";
import { useStudentMe } from "@/hooks/useStudentMe";
import { useStudentSongs, useStudentClassConfig } from "@/hooks/useBatchCoursework";
import { useStudentCoursePlan, planWeekNumberFor, daysForWeek } from "@/hooks/useCoursePlan";
import { useCourseVideos, useSignedVideoUrls } from "@/hooks/useCourseVideos";
import { useEnsureWeeklyPlan, useTodaysSession, useCompleteSegment, isoMonday } from "@/hooks/useWeeklyPlan";
import { SESSION_TEMPLATES, BONUS_EMOJI } from "@/lib/sessionTemplates";

/**
 * Today, on one page. The three sections the admin planned — warm-up, focus,
 * bonus — with their videos playing inline. Nothing opens, nothing floats,
 * nothing to navigate to.
 */
const Home = () => {
  const { data: student } = useStudentMe();
  const catalog = useStudentSongs();
  const { instrument, courseStartDate } = useStudentClassConfig();
  const { days: planDays } = useStudentCoursePlan(instrument);
  const { data: allVideos = [] } = useCourseVideos(instrument);
  const completeSeg = useCompleteSegment();

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
        <header className="mb-5">
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
            {/* Today's lessons, playing right here. */}
            {videos.length > 0 && (
              <div className="mb-5 flex flex-col gap-4">
                {videos.map((v) => (
                  <div key={v.id}>
                    {urls[v.storage_path] ? (
                      <video
                        controls
                        preload="none"
                        playsInline
                        src={urls[v.storage_path]}
                        style={{ width: "100%", borderRadius: 16, background: "#000" }}
                      />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 16, background: "rgba(0,0,0,0.85)", display: "grid", placeItems: "center", color: "#fff", fontSize: 13 }}>
                        Loading video…
                      </div>
                    )}
                    <div className="text-sm font-semibold mt-1.5" style={{ color: "var(--ink)" }}>{v.title}</div>
                  </div>
                ))}
              </div>
            )}

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
                      onClick={() => completeSeg.mutate({ id: session.id, segment: s.key })}
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
          </>
        )}
      </div>
    </section>
  );
};

export default Home;
