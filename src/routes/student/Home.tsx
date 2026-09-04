import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStudentMe } from "@/hooks/useStudentMe";
import { useStudentSongs } from "@/hooks/useBatchCoursework";
import WeeklyCalendarStrip from "@/components/student/WeeklyCalendarStrip";
import SongVideos from "@/components/student/SongVideos";
import { useSongVideos, useGeneralVideos, useSignedVideoUrls } from "@/hooks/useCourseVideos";
import { useEnsureWeeklyPlan, useTodaysSession } from "@/hooks/useWeeklyPlan";
import { SESSION_TEMPLATES, BONUS_EMOJI } from "@/lib/sessionTemplates";

/** Course-wide clips (tuning, lessons, theory) that aren't tied to one song. */
const CourseMaterial = () => {
  const { data: videos = [] } = useGeneralVideos("ukulele");
  const { data: urls = {} } = useSignedVideoUrls(videos.map((v) => v.storage_path));
  if (!videos.length) return null;
  return (
    <section
      className="rounded-3xl mb-5 p-4 md:p-5"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--ink-soft)" }}>
        📺 Course lessons
      </div>
      <div className="flex flex-col gap-4">
        {videos.map((v) => (
          <div key={v.id} className="flex flex-col gap-1">
            {urls[v.storage_path] ? (
              <video
                controls
                preload="none"
                playsInline
                src={urls[v.storage_path]}
                style={{ width: "100%", borderRadius: 12, background: "#000" }}
              />
            ) : (
              <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 12, background: "rgba(0,0,0,0.8)", display: "grid", placeItems: "center", color: "#fff", fontSize: 13 }}>
                Loading video…
              </div>
            )}
            <div className="text-xs font-semibold" style={{ color: "var(--ink)" }}>{v.title}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

/** A card of teacher videos for one song — renders nothing when there are none. */
const TodaysMaterial = ({ songId }: { songId: string }) => {
  const { data: videos = [] } = useSongVideos(songId);
  if (!videos.length) return null;
  return (
    <section
      className="rounded-3xl mb-5 overflow-hidden pb-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <SongVideos songId={songId} />
    </section>
  );
};

/**
 * Deliberately minimal: the week strip, today's plan, and the teaching
 * material for today's songs. Streaks, badges and the jam pad live
 * elsewhere (Journey / the tuner) so this page stays calm.
 */
const Home = () => {
  const navigate = useNavigate();
  const { data: student } = useStudentMe();
  const catalog = useStudentSongs();
  useEnsureWeeklyPlan();
  const todaysSession = useTodaysSession();

  const focusSong = useMemo(() => {
    const ordered = [...catalog].filter((s) => !s.fingerstyle).sort((a, b) => (a.track as number) - (b.track as number) || a.order - b.order);
    return ordered.find((s) => s.state === "in-progress" || s.state === "next") || ordered[0];
  }, [catalog]);

  const firstName = (student?.name || "").split(" ")[0] || "there";
  const sessionSong = todaysSession ? catalog.find((s) => s.id === todaysSession.focus_song_id) : null;
  const sessionTpl = todaysSession ? SESSION_TEMPLATES[todaysSession.session_type] : null;
  const totalMins = todaysSession ? (todaysSession.warmup_target_min + todaysSession.focus_target_min + todaysSession.bonus_target_min) : 0;

  const titleOf = (id: string | null) => (id ? catalog.find((s) => s.id === id)?.title : null);

  /** Every entry point opens the same guided flow (tune check → segments). */
  const openPractice = () => {
    const target = todaysSession && sessionSong ? sessionSong.id : focusSong?.id;
    if (!target) return;
    const isPlanned = !!todaysSession && target === todaysSession.focus_song_id;
    navigate(`/student/song/${target}`, {
      state: isPlanned ? { planSessionId: todaysSession!.id } : undefined,
    });
  };

  // Today's teaching material: videos for every distinct song in the plan.
  const todaysSongIds = useMemo(() => {
    if (!todaysSession) return focusSong ? [focusSong.id] : [];
    return [...new Set(
      [todaysSession.warmup_song_id, todaysSession.focus_song_id, todaysSession.bonus_song_id].filter(Boolean) as string[],
    )];
  }, [todaysSession, focusSong]);

  const segments = todaysSession
    ? [
        { emoji: "♪", label: "Warm-up", title: titleOf(todaysSession.warmup_song_id), mins: todaysSession.warmup_target_min, done: todaysSession.warmup_completed },
        { emoji: "🎯", label: "Focus", title: titleOf(todaysSession.focus_song_id), mins: todaysSession.focus_target_min, done: todaysSession.focus_completed },
        { emoji: BONUS_EMOJI[todaysSession.bonus_type], label: "Bonus", title: titleOf(todaysSession.bonus_song_id), mins: todaysSession.bonus_target_min, done: todaysSession.bonus_completed },
      ]
    : [];

  return (
    <section className="view view-home active">
      <div className="home" style={{ paddingBottom: 100 }}>
        {/* ===== WEEKLY CALENDAR ===== */}
        <WeeklyCalendarStrip />

        {/* ===== TODAY'S PLAN ===== */}
        <section
          className="rounded-3xl p-6 md:p-8 mb-5"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--gold-deep)" }}>
            Today · {new Date().toLocaleDateString(undefined, { weekday: "long" })}
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold" style={{ color: "var(--ink)" }}>
            Hi {firstName}
          </h1>

          {todaysSession && sessionTpl ? (
            <>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                {sessionTpl.emoji} {sessionTpl.label} · {totalMins} min
              </p>
              <ul className="mt-4 space-y-2">
                {segments.map((seg, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: "var(--paper-cool)" }}
                  >
                    <span className="text-lg" aria-hidden>{seg.emoji}</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {seg.label}{seg.title ? `: ${seg.title}` : ""}
                    </span>
                    <span className="ml-auto text-xs tabular-nums" style={{ color: "var(--ink-faint)" }}>
                      {seg.mins}m {seg.done && <span style={{ color: "#10b981" }}>✓</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                onClick={openPractice}
                className="mt-4 w-full rounded-xl py-3 font-bold text-sm transition-transform hover:scale-[1.01] active:scale-95"
                style={{ background: "var(--navy)", color: "#fff" }}
              >
                ▶ Open today's practice
              </button>
            </>
          ) : focusSong ? (
            <>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                No planned session today. Your song is <span className="font-semibold" style={{ color: "var(--ink)" }}>{focusSong.title}</span>.
              </p>
              <button
                onClick={openPractice}
                className="mt-4 w-full rounded-xl py-3 font-bold text-sm transition-transform hover:scale-[1.01] active:scale-95"
                style={{ background: "var(--navy)", color: "#fff" }}
              >
                ▶ Practice {focusSong.title}
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
              No songs yet — check your <button className="font-semibold underline" onClick={() => navigate("/student/journey")}>Journey</button>.
            </p>
          )}
        </section>

        {/* ===== TEACHING MATERIAL FOR TODAY ===== */}
        {todaysSongIds.map((id) => (
          <TodaysMaterial key={id} songId={id} />
        ))}

        {/* ===== COURSE-WIDE LESSONS (tuning, first lesson, theory) ===== */}
        <CourseMaterial />
      </div>
    </section>
  );
};

export default Home;
