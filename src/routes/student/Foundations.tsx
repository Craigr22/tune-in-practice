import { useMemo } from "react";
import { useSongs } from "@/hooks/useSongs";
import { useStudentMe } from "@/hooks/useStudentMe";
import {
  usePracticeLogs,
  useSongProgress,
  computeStreak,
  minutesThisWeek,
  songsInProgress,
} from "@/hooks/useStudentProgress";
import { SONGS } from "@/data/songs";
import { getBadge } from "@/lib/badges";
import WeeklyCalendarStrip from "@/components/student/WeeklyCalendarStrip";
import { useEnsureWeeklyPlan, useTodaysSession } from "@/hooks/useWeeklyPlan";
import { SESSION_TEMPLATES } from "@/lib/sessionTemplates";

const Home = () => {
  const { openSong } = useSongs();
  const { data: student } = useStudentMe();
  const { data: logs = [] } = usePracticeLogs();
  const { data: progress = [] } = useSongProgress();
  useEnsureWeeklyPlan();
  const todaysSession = useTodaysSession();

  const streak = useMemo(() => computeStreak(logs), [logs]);
  const minsWeek = useMemo(() => minutesThisWeek(logs), [logs]);
  const inProgress = useMemo(() => songsInProgress(progress), [progress]);

  // All songs the student is working on, sorted by most recently practiced
  const mySongs = useMemo(() => {
    const candidates = SONGS.filter((s) => s.state === "in-progress" || s.state === "next");
    return candidates.sort((a, b) => {
      const pa = progress.find((p) => p.song_id === a.id)?.last_practiced || "";
      const pb = progress.find((p) => p.song_id === b.id)?.last_practiced || "";
      if (pa && !pb) return -1;
      if (!pa && pb) return 1;
      return pb.localeCompare(pa); // most recent first
    });
  }, [progress]);

  const firstName = (student?.name || "").split(" ")[0] || "there";
  const sessionSong = todaysSession ? SONGS.find((s) => s.id === todaysSession.focus_song_id) : null;
  const sessionTpl = todaysSession ? SESSION_TEMPLATES[todaysSession.session_type] : null;
  const totalMins = todaysSession
    ? todaysSession.warmup_target_min + todaysSession.focus_target_min + todaysSession.bonus_target_min
    : 0;

  return (
    <section className="view view-home active">
      <div className="home" style={{ paddingBottom: 100 }}>
        {/* ===== WEEKLY CALENDAR (kept interactive) ===== */}
        <WeeklyCalendarStrip />

        {/* ===== ONE UNIFIED CARD ===== */}
        <section
          className="rounded-3xl p-7 md:p-10 mb-5"
          style={{
            background: "linear-gradient(135deg, #0b2a3f 0%, #0085C7 60%, #36A2D9 100%)",
            color: "#fff",
            boxShadow: "0 24px 60px -20px rgba(0,133,199,0.45)",
          }}
        >
          {/* Top: greeting + session message + streak panel */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#FBE48A" }}>
                Today · {new Date().toLocaleDateString(undefined, { weekday: "long" })}
              </div>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold leading-tight">
                Hi {firstName},{" "}
                {todaysSession && sessionTpl ? `today's ${sessionTpl.label} session` : "your next 10 minutes"}
              </h1>
              <p className="mt-3 text-white/85 text-sm md:text-base max-w-lg">
                {todaysSession && sessionSong && sessionTpl ? (
                  <>
                    {sessionTpl.emoji} <span className="font-semibold text-white">{sessionTpl.label}</span> ·{" "}
                    {totalMins} min · focus on <span className="font-semibold text-white">{sessionSong.title}</span>.
                  </>
                ) : (
                  "Pick a song below and start with 10 minutes."
                )}
              </p>
            </div>

            <div className="md:text-right shrink-0">
              <div
                className="inline-flex flex-col items-start md:items-end rounded-2xl px-5 py-4"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div className="text-[11px] uppercase tracking-wider text-white/70">Streak</div>
                <div className="text-3xl font-bold mt-1">🔥 {streak}</div>
                <div className="text-xs text-white/85 mt-1 max-w-[220px] md:text-right">
                  {streak === 0
                    ? "Practice today to start a streak."
                    : streak === 1
                      ? "Day 1 — practice again tomorrow to grow it."
                      : `Practice today to keep your ${streak}-day streak 🔥`}
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-7 border-t border-white/15" />

          {/* Middle: list of songs, each with its own play button */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: "#FBE48A" }}>
              Your songs
            </div>

            {mySongs.length === 0 ? (
              <div className="text-sm text-white/75">No songs in progress yet. Your teacher will assign some soon.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {mySongs.map((song) => {
                  const sp = progress.find((p) => p.song_id === song.id);
                  const badge = getBadge(sp?.teacher_badge);
                  const sessionsCount = logs.filter((l) => l.song_id === song.id).length;
                  const isToday = sessionSong?.id === song.id;
                  return (
                    <div
                      key={song.id}
                      className="flex items-center gap-4 rounded-2xl px-4 py-3"
                      style={{
                        background: isToday ? "rgba(251, 228, 138, 0.15)" : "rgba(255,255,255,0.08)",
                        border: isToday ? "1px solid rgba(251, 228, 138, 0.4)" : "1px solid transparent",
                      }}
                    >
                      {/* Badge icon */}
                      <div
                        className="shrink-0 inline-flex items-center justify-center rounded-full text-xl"
                        style={{
                          width: 40,
                          height: 40,
                          background: "rgba(255,255,255,0.1)",
                        }}
                        aria-label={badge?.name || "Not graded"}
                      >
                        {badge ? badge.emoji : "🎵"}
                      </div>

                      {/* Song info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-bold text-white truncate">{song.title}</div>
                          {isToday && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{
                                background: "#FBE48A",
                                color: "#1A2332",
                              }}
                            >
                              Today
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/70 mt-0.5 truncate">
                          {song.artist} · {sessionsCount} {sessionsCount === 1 ? "session" : "sessions"}
                          {sp?.last_practiced && ` · last ${sp.last_practiced}`}
                        </div>
                      </div>

                      {/* Play button */}
                      <button
                        onClick={() => openSong(song.id)}
                        aria-label={`Play ${song.title}`}
                        className="shrink-0 inline-flex items-center justify-center rounded-full transition-transform hover:scale-[1.05] active:scale-95"
                        style={{
                          width: 44,
                          height: 44,
                          background: "var(--gold)",
                          color: "#1A2332",
                          boxShadow: "0 6px 16px -4px rgba(244,208,63,0.5)",
                          fontSize: 16,
                        }}
                      >
                        ▶
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-7 border-t border-white/15" />

          {/* Bottom: weekly stats */}
          <div className="flex items-center gap-10 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/65">This week</div>
              <div className="text-lg font-bold text-white">{minsWeek} min</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/65">In progress</div>
              <div className="text-lg font-bold text-white">
                {inProgress} {inProgress === 1 ? "song" : "songs"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};

export default Home;
