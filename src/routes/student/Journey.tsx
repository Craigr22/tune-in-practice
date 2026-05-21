import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SONGS } from "@/data/songs";
import { usePracticeLogs, useSongProgress, avgCourseBadge, tuningRate, sentimentStrip, CHECK_IN_COLOR, CHECK_IN_EMOJI, type CheckIn } from "@/hooks/useStudentProgress";
import BadgeDisplay from "@/components/shared/BadgeDisplay";
import { getBadge, nextBadge } from "@/lib/badges";

interface JourneyEntry {
  songId: string;
  title: string;
  artist: string;
  firstDate: string;
  lastDate: string;
  totalMin: number;
  sessions: number;
  teacherBadge: number | null;
  selfBadge: number | null;
}

const Journey = () => {
  const navigate = useNavigate();
  const { data: logs = [] } = usePracticeLogs();
  const { data: progress = [] } = useSongProgress();
  const [expanded, setExpanded] = useState<string | null>(null);

  const entries: JourneyEntry[] = useMemo(() => {
    const bySong = new Map<string, JourneyEntry>();
    for (const log of logs) {
      const song = SONGS.find((s) => s.id === log.song_id);
      const existing = bySong.get(log.song_id);
      if (existing) {
        existing.totalMin += log.duration_min || 0;
        existing.sessions += 1;
        if (log.played_on < existing.firstDate) existing.firstDate = log.played_on;
        if (log.played_on > existing.lastDate) existing.lastDate = log.played_on;
      } else {
        const p = progress.find((x) => x.song_id === log.song_id);
        bySong.set(log.song_id, {
          songId: log.song_id,
          title: song?.title || log.song_id,
          artist: song?.artist || "",
          firstDate: log.played_on,
          lastDate: log.played_on,
          totalMin: log.duration_min || 0,
          sessions: 1,
          teacherBadge: p?.teacher_badge ?? null,
          selfBadge: p?.self_badge ?? null,
        });
      }
    }
    return [...bySong.values()].sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
  }, [logs, progress]);

  const avg = avgCourseBadge(progress);
  const course = getBadge(avg);
  const courseNext = nextBadge(avg);
  const songsToNext = courseNext
    ? Math.max(1, progress.filter((p) => (p.teacher_badge ?? 0) < courseNext.level).length)
    : 0;

  return (
    <section className="view view-journey active">
      <div className="home" style={{ paddingBottom: 100 }}>
        <button onClick={() => navigate("/student")} className="back-link" style={{ marginBottom: 16 }}>← Back home</button>

        {/* Course-level badge */}
        <section
          className="rounded-3xl p-6 md:p-8 mb-6 flex items-center gap-6 flex-wrap"
          style={{ background: "linear-gradient(135deg, var(--gold-bg), #fff)", border: "1px solid var(--gold-soft)" }}
        >
          <BadgeDisplay level={avg} size="hero" showLabel={false} animate />
          <div className="flex-1 min-w-[200px]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--gold-deep)" }}>Course badge</div>
            <h1 className="text-2xl md:text-3xl font-bold mt-1" style={{ color: "var(--ink)" }}>
              {course ? <>You're a <span style={{ color: "var(--gold-deep)" }}>{course.name} {course.emoji}</span> overall</> : "No badge yet — log your first practice"}
            </h1>
            {course && courseNext && (
              <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
                {songsToNext} {songsToNext === 1 ? "song" : "songs"} to {courseNext.name} {courseNext.emoji}
              </p>
            )}
            <p className="mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>
              🎵 Tuned before <strong style={{ color: "var(--ink)" }}>{tuningRate(logs).pct}%</strong> of practices this semester
            </p>
          </div>
        </section>

        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--ink)" }}>Your journey</h2>

        {entries.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: "var(--card)", border: "1px dashed var(--border-strong)", color: "var(--ink-soft)" }}>
            No practice sessions yet. Open a song and log your first run-through.
          </div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[10px] top-2 bottom-2 w-0.5" style={{ background: "var(--border-strong)" }} />
            {entries.map((entry) => {
              const songLogs = logs.filter((l) => l.song_id === entry.songId);
              const isOpen = expanded === entry.songId;
              return (
                <div key={entry.songId} className="relative mb-5">
                  <div className="absolute -left-6 top-5 w-5 h-5 rounded-full" style={{ background: "var(--navy)", boxShadow: "0 0 0 4px var(--paper)" }} />
                  <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg" style={{ color: "var(--ink)" }}>{entry.title}</h3>
                        <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{entry.artist}</div>
                        <div className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>
                          {entry.firstDate} → {entry.lastDate} · {entry.sessions} sessions · {entry.totalMin} min
                        </div>
                      </div>
                      <BadgeDisplay level={entry.teacherBadge} size="md" />
                    </div>
                    <div className="mt-3 flex items-center gap-1" title="Last 7 days check-ins">
                      {sentimentStrip(songLogs, 7).map((d) => (
                        <span key={d.date} className={`w-2.5 h-2.5 rounded-full ${CHECK_IN_COLOR[d.checkIn ?? "none"]}`} />
                      ))}
                    </div>
                    <button
                      onClick={() => setExpanded(isOpen ? null : entry.songId)}
                      className="mt-3 text-xs font-semibold"
                      style={{ color: "var(--navy)" }}
                    >
                      {isOpen ? "Hide" : "Show"} {songLogs.length} practice {songLogs.length === 1 ? "entry" : "entries"}
                    </button>
                    {isOpen && (
                      <ul className="mt-3 space-y-2">
                        {songLogs.map((l) => (
                          <li
                            key={l.id}
                            className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
                            style={{ background: "var(--paper-cool)" }}
                          >
                            <span style={{ color: "var(--ink)" }}>
                              {l.tuning_check_completed && <span title="Tuned before practice" style={{ marginRight: 6 }}>🎵</span>}
                              {l.played_on}
                            </span>
                            <span style={{ color: "var(--ink-soft)" }}>{l.duration_min} min</span>
                            <span>
                              {l.check_in && <span title={l.check_in} className={`inline-block w-2 h-2 rounded-full mr-1 align-middle ${CHECK_IN_COLOR[l.check_in as CheckIn]}`} />}
                              {l.check_in ? CHECK_IN_EMOJI[l.check_in as CheckIn] : (l.self_rated_badge ? "•" : "—")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Journey;
