import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSongs } from "@/hooks/useSongs";
import { useStudentMe } from "@/hooks/useStudentMe";
import { usePracticeLogs, useSongProgress, computeStreak, minutesThisWeek, songsInProgress } from "@/hooks/useStudentProgress";
import { SONGS } from "@/data/songs";
import BadgeDisplay from "@/components/shared/BadgeDisplay";
import { getBadge, nextBadge } from "@/lib/badges";
import WeeklyCalendarStrip from "@/components/student/WeeklyCalendarStrip";
import { useEnsureWeeklyPlan, useTodaysSession } from "@/hooks/useWeeklyPlan";
import { SESSION_TEMPLATES } from "@/lib/sessionTemplates";

function pickFocusSong() {
  const ordered = [...SONGS].filter((s) => !s.fingerstyle).sort((a, b) => (a.track as number) - (b.track as number) || a.order - b.order);
  return ordered.find((s) => s.state === "in-progress" || s.state === "next") || ordered[0];
}

const Home = () => {
  const navigate = useNavigate();
  const { openSong } = useSongs();
  const { data: student } = useStudentMe();
  const { data: logs = [] } = usePracticeLogs();
  const { data: progress = [] } = useSongProgress();
  useEnsureWeeklyPlan();
  const todaysSession = useTodaysSession();

  const focusSong = useMemo(pickFocusSong, []);
  const streak = useMemo(() => computeStreak(logs), [logs]);
  const minsWeek = useMemo(() => minutesThisWeek(logs), [logs]);
  const inProgress = useMemo(() => songsInProgress(progress), [progress]);

  const lastLog = logs[0];
  const currentSong = useMemo(() => {
    if (lastLog) return SONGS.find((s) => s.id === lastLog.song_id) || focusSong;
    return focusSong;
  }, [lastLog, focusSong]);
  const currentProgress = currentSong ? progress.find((p) => p.song_id === currentSong.id) : undefined;
  const currentBadge = getBadge(currentProgress?.teacher_badge);
  const nextGoal = nextBadge(currentProgress?.teacher_badge);

  const firstName = (student?.name || "").split(" ")[0] || "there";
  const sessionSong = todaysSession ? SONGS.find((s) => s.id === todaysSession.focus_song_id) : null;
  const sessionTpl = todaysSession ? SESSION_TEMPLATES[todaysSession.session_type] : null;
  const totalMins = todaysSession ? (todaysSession.warmup_target_min + todaysSession.focus_target_min + todaysSession.bonus_target_min) : 0;

  const startSession = () => {
    if (todaysSession && sessionSong) {
      navigate(`/student/song/${sessionSong.id}`, { state: { planSessionId: todaysSession.id } });
    } else if (focusSong) {
      openSong(focusSong.id);
    }
  };

  return (
    <section className="view view-home active">
      <div className="home" style={{ paddingBottom: 100 }}>
        {/* ===== WEEKLY CALENDAR ===== */}
        <WeeklyCalendarStrip />

        {/* ===== TODAY CARD ===== */}
        <section
          className="rounded-3xl p-7 md:p-10 mb-5"
          style={{
            background: "linear-gradient(135deg, #0b2a3f 0%, #0085C7 60%, #36A2D9 100%)",
            color: "#fff",
            boxShadow: "0 24px 60px -20px rgba(0,133,199,0.45)",
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#FBE48A" }}>
                Today · {new Date().toLocaleDateString(undefined, { weekday: "long" })}
              </div>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold leading-tight">
                Hi {firstName}, {todaysSession && sessionTpl ? `today's ${sessionTpl.label} session` : "your next 10 minutes"}
              </h1>
              <p className="mt-3 text-white/85 text-sm md:text-base max-w-lg">
                {todaysSession && sessionSong && sessionTpl ? (
                  <>{sessionTpl.emoji} <span className="font-semibold text-white">{sessionTpl.label}</span> · {totalMins} min · focus on <span className="font-semibold text-white">{sessionSong.title}</span> — warm-up, focus, bonus.</>
                ) : focusSong ? (
                  <>Practice <span className="font-semibold text-white">{focusSong.title}</span> for 10 minutes — small reps, big difference by Saturday.</>
                ) : (
                  "Pick any song below and log a 10-minute session."
                )}
              </p>
              <div className="mt-5 flex items-center gap-3 flex-wrap">
                <button
                  onClick={startSession}
                  className="inline-flex items-center gap-3 rounded-full px-5 py-3 font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-95"
                  style={{ background: "var(--gold)", color: "#1A2332", boxShadow: "0 10px 24px -8px rgba(244,208,63,0.6)" }}
                >
                  <span className="inline-flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: "#1A2332", color: "var(--gold)" }}>▶</span>
                  {todaysSession ? "Do now" : "Start practice"}
                </button>
                <button
                  onClick={() => focusSong && openSong(focusSong.id)}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium border border-white/30 hover:bg-white/10"
                >
                  Free practice →
                </button>
              </div>

            </div>
            <div className="md:text-right">
              <div
                className="inline-flex flex-col items-start md:items-end rounded-2xl px-5 py-4"
                style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)" }}
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
        </section>

        {/* ===== CURRENT SONG CARD ===== */}
        {currentSong && (
          <section
            className="rounded-3xl p-6 md:p-8 mb-5 cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => openSong(currentSong.id)}
            style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
          >
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--gold-deep)" }}>
                  Current song
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mt-1" style={{ color: "var(--ink)" }}>{currentSong.title}</h2>
                <div className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>{currentSong.artist}</div>
                <div className="mt-4 flex items-center gap-3 text-xs" style={{ color: "var(--ink-soft)" }}>
                  <span className="px-2 py-1 rounded-md" style={{ background: "var(--paper-cool)" }}>
                    {logs.filter((l) => l.song_id === currentSong.id).length} sessions logged
                  </span>
                  {currentProgress?.last_practiced && (
                    <span>Last practiced {currentProgress.last_practiced}</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-center" style={{ minWidth: 180 }}>
                <BadgeDisplay level={currentProgress?.teacher_badge ?? null} size="hero" showLabel={false} animate />
                <div className="mt-2 text-sm font-bold" style={{ color: "var(--ink)" }}>
                  {currentBadge ? `${currentBadge.name}` : "Not graded yet"}
                </div>
                {nextGoal && currentBadge && (
                  <div className="mt-1 text-[11px] text-center max-w-[180px]" style={{ color: "var(--ink-soft)" }}>
                    Next: <span className="font-semibold" style={{ color: "var(--ink)" }}>{nextGoal.emoji} {nextGoal.name}</span> — {nextGoal.blurb.toLowerCase()}
                  </div>
                )}
                {!currentBadge && (
                  <div className="mt-1 text-[11px] text-center max-w-[180px]" style={{ color: "var(--ink-soft)" }}>
                    Log a session to earn your first 🦥 badge.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ===== STREAK STRIP ===== */}
        <button
          onClick={() => navigate("/student/journey")}
          className="w-full rounded-2xl px-5 py-4 flex items-center justify-between gap-4 text-left"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>Streak</div>
              <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>🔥 {streak} {streak === 1 ? "day" : "days"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>This week</div>
              <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{minsWeek} min</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>In progress</div>
              <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{inProgress} {inProgress === 1 ? "song" : "songs"}</div>
            </div>
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--navy)" }}>See journey →</span>
        </button>
      </div>
    </section>
  );
};

export default Home;
