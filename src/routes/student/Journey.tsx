import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SONGS } from "@/data/songs";
import {
  usePracticeLogs,
  useSongProgress,
  avgCourseBadge,
  tuningRate,
  sentimentStrip,
  CHECK_IN_COLOR,
  CHECK_IN_EMOJI,
  type CheckIn,
} from "@/hooks/useStudentProgress";
import BadgeDisplay from "@/components/shared/BadgeDisplay";
import { getBadge, nextBadge } from "@/lib/badges";

type NodeState = "mastered" | "current" | "next" | "locked";

interface MapNode {
  songId: string;
  title: string;
  artist: string;
  order: number;
  track: number | "fs";
  state: NodeState;
  teacherBadge: number | null;
  selfBadge: number | null;
  sessions: number;
  totalMin: number;
  firstDate?: string;
  lastDate?: string;
  fingerstyle?: boolean;
}

type TierKey = "beginner" | "adv-beginner" | "casual" | "fingerstyle";
interface Tier {
  key: TierKey;
  name: string;
  tagline: string;
  emoji: string;
  accent: string; // css var
  accentSoft: string;
}
const TIERS: Tier[] = [
  { key: "beginner",      name: "Beginner",          tagline: "First chords · steady strumming",     emoji: "🌱", accent: "#10b981", accentSoft: "#d1fae5" },
  { key: "adv-beginner",  name: "Advanced Beginner", tagline: "New shapes · richer progressions",    emoji: "🌿", accent: "#3b82f6", accentSoft: "#dbeafe" },
  { key: "casual",        name: "Casual Ukulelist",  tagline: "Full songs · confident performance", emoji: "🎤", accent: "#a855f7", accentSoft: "#f3e8ff" },
  { key: "fingerstyle",   name: "Fingerstyle Path",  tagline: "Melody picking · tab reading",        emoji: "🎼", accent: "#f59e0b", accentSoft: "#fef3c7" },
];
const tierFor = (track: number | "fs"): TierKey => {
  if (track === "fs") return "fingerstyle";
  if (track <= 4) return "beginner";
  if (track <= 8) return "adv-beginner";
  return "casual";
};

const Journey = () => {
  const navigate = useNavigate();
  const { data: logs = [] } = usePracticeLogs();
  const { data: progress = [] } = useSongProgress();
  const [selected, setSelected] = useState<string | null>(null);

  const nodes: MapNode[] = useMemo(() => {
    const ordered = [...SONGS].sort((a, b) => {
      if (a.track !== b.track) return (a.track === "fs" ? 99 : a.track) - (b.track === "fs" ? 99 : b.track);
      return a.order - b.order;
    });

    let foundCurrent = false;
    return ordered.map((s) => {
      const p = progress.find((x) => x.song_id === s.id);
      const songLogs = logs.filter((l) => l.song_id === s.id);
      const tb = p?.teacher_badge ?? null;
      const isMastered = (tb ?? 0) >= 5 || s.state === "mastered";
      const hasProgress = songLogs.length > 0 || (tb ?? 0) > 0;

      let state: NodeState;
      if (isMastered) state = "mastered";
      else if (hasProgress) { state = "current"; foundCurrent = true; }
      else if (!foundCurrent) { state = "next"; foundCurrent = true; }
      else state = "locked";

      const firstDate = songLogs.length ? songLogs.reduce((a, l) => (l.played_on < a ? l.played_on : a), songLogs[0].played_on) : undefined;
      const lastDate = songLogs.length ? songLogs.reduce((a, l) => (l.played_on > a ? l.played_on : a), songLogs[0].played_on) : undefined;

      return {
        songId: s.id,
        title: s.title,
        artist: s.artist,
        order: s.order,
        state,
        teacherBadge: tb,
        selfBadge: p?.self_badge ?? null,
        sessions: songLogs.length,
        totalMin: songLogs.reduce((a, l) => a + (l.duration_min || 0), 0),
        firstDate,
        lastDate,
        fingerstyle: s.fingerstyle,
      };
    });
  }, [logs, progress]);

  const avg = avgCourseBadge(progress);
  const course = getBadge(avg);
  const courseNext = nextBadge(avg);
  const masteredCount = nodes.filter((n) => n.state === "mastered").length;
  const totalCount = nodes.length;
  const overallPct = Math.round((masteredCount / Math.max(1, totalCount)) * 100);

  const selectedNode = nodes.find((n) => n.songId === selected) || null;
  const selectedLogs = selectedNode ? logs.filter((l) => l.song_id === selectedNode.songId).slice(0, 6) : [];

  return (
    <section className="view view-journey active">
      <div className="home" style={{ paddingBottom: 100 }}>
        <button onClick={() => navigate("/student")} className="back-link" style={{ marginBottom: 16 }}>← Back home</button>

        {/* Course-level badge / quest header */}
        <section
          className="rounded-3xl p-6 md:p-8 mb-6 flex items-center gap-6 flex-wrap"
          style={{ background: "linear-gradient(135deg, var(--gold-bg), #fff)", border: "1px solid var(--gold-soft)" }}
        >
          <BadgeDisplay level={avg} size="hero" showLabel={false} animate />
          <div className="flex-1 min-w-[220px]">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--gold-deep)" }}>Your quest</div>
            <h1 className="text-2xl md:text-3xl font-bold mt-1" style={{ color: "var(--ink)" }}>
              {course ? <>You're a <span style={{ color: "var(--gold-deep)" }}>{course.name} {course.emoji}</span></> : "Begin your journey"}
            </h1>
            <div className="mt-3 max-w-md">
              <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--ink-soft)" }}>
                <span>{masteredCount} of {totalCount} songs mastered</span>
                <span>{overallPct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--gold-soft)" }}>
                <div className="h-full transition-all" style={{ width: `${overallPct}%`, background: "var(--gold-deep)" }} />
              </div>
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--ink-soft)" }}>
              {courseNext && <>Next rank: <strong style={{ color: "var(--ink)" }}>{courseNext.name} {courseNext.emoji}</strong> · </>}
              🎵 Tuned <strong style={{ color: "var(--ink)" }}>{tuningRate(logs).pct}%</strong> of practices
            </p>
          </div>
        </section>

        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: "var(--ink)" }}>Song map</h2>
          <div className="text-xs flex items-center gap-3" style={{ color: "var(--ink-soft)" }}>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--gold-deep)" }} />Mastered</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "var(--navy)" }} />Current</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border-strong)" }} />Locked</span>
          </div>
        </div>

        {/* Game map */}
        <div
          className="relative rounded-3xl p-6 md:p-10 overflow-hidden"
          style={{
            background: "radial-gradient(circle at 20% 10%, hsl(var(--accent) / 0.15), transparent 50%), radial-gradient(circle at 80% 90%, hsl(var(--primary) / 0.12), transparent 50%), linear-gradient(180deg, var(--paper-cool), var(--paper))",
            border: "1px solid var(--border)",
          }}
        >
          {/* Decorative dotted path SVG */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <pattern id="dots" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.5" fill="hsl(var(--muted-foreground) / 0.25)" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#dots)" opacity="0.4" />
          </svg>

          <div className="relative grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            {nodes.map((n, i) => {
              const isOpen = selected === n.songId;
              const bg =
                n.state === "mastered" ? "linear-gradient(135deg, var(--gold-bg), #fffaf0)" :
                n.state === "current" ? "linear-gradient(135deg, #fff, var(--paper-cool))" :
                n.state === "next" ? "#fff" :
                "var(--paper-cool)";
              const border =
                n.state === "mastered" ? "var(--gold-soft)" :
                n.state === "current" ? "var(--navy)" :
                n.state === "next" ? "var(--border-strong)" :
                "var(--border)";
              const ring =
                n.state === "current" ? "0 0 0 4px hsl(var(--primary) / 0.15), var(--shadow-md)" :
                n.state === "mastered" ? "var(--shadow-sm)" : "none";
              const offsetY = i % 2 === 0 ? 0 : 18; // zigzag stagger

              return (
                <button
                  key={n.songId}
                  onClick={() => n.state !== "locked" && setSelected(isOpen ? null : n.songId)}
                  disabled={n.state === "locked"}
                  className={`relative rounded-2xl p-4 text-left transition-all ${n.state !== "locked" ? "hover:-translate-y-0.5 cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                  style={{ background: bg, border: `2px solid ${border}`, boxShadow: ring, transform: `translateY(${offsetY}px)` }}
                >
                  {/* Stop number */}
                  <div
                    className="absolute -top-3 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: n.state === "mastered" ? "var(--gold-deep)" : n.state === "current" ? "var(--navy)" : n.state === "locked" ? "var(--border-strong)" : "var(--ink)",
                      color: "#fff",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {n.state === "locked" ? "🔒" : i + 1}
                  </div>

                  {/* Badge / state icon */}
                  <div className="flex justify-center mb-2 mt-1" style={{ minHeight: 56 }}>
                    {n.state === "mastered" || (n.teacherBadge ?? 0) > 0 ? (
                      <BadgeDisplay level={n.teacherBadge ?? (n.state === "mastered" ? 5 : null)} size="md" showLabel={false} />
                    ) : n.state === "current" ? (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl animate-pulse" style={{ background: "hsl(var(--primary) / 0.1)" }}>⭐</div>
                    ) : n.state === "next" ? (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background: "var(--paper-cool)" }}>✨</div>
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ background: "var(--card)", opacity: 0.5 }}>🎵</div>
                    )}
                  </div>

                  <div className="text-center">
                    <div className="text-sm font-bold leading-tight line-clamp-2" style={{ color: n.state === "locked" ? "var(--ink-faint)" : "var(--ink)" }}>
                      {n.state === "locked" ? "???" : n.title}
                    </div>
                    {n.state !== "locked" && (
                      <div className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "var(--ink-soft)" }}>{n.artist}</div>
                    )}
                    {n.state === "current" && (
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--navy)" }}>In progress</div>
                    )}
                    {n.state === "next" && (
                      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--gold-deep)" }}>Up next</div>
                    )}
                  </div>

                  {n.fingerstyle && n.state !== "locked" && (
                    <div className="absolute top-2 right-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "var(--paper-cool)", color: "var(--ink-soft)" }}>FS</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected song detail */}
        {selectedNode && (
          <div className="mt-6 rounded-2xl p-5 animate-fade-in" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg" style={{ color: "var(--ink)" }}>{selectedNode.title}</h3>
                <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{selectedNode.artist}</div>
                <div className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>
                  {selectedNode.sessions > 0
                    ? <>{selectedNode.firstDate} → {selectedNode.lastDate} · {selectedNode.sessions} sessions · {selectedNode.totalMin} min</>
                    : "Not started yet"}
                </div>
              </div>
              <BadgeDisplay level={selectedNode.teacherBadge} size="md" />
            </div>

            {selectedNode.sessions > 0 && (
              <>
                <div className="mt-3 flex items-center gap-1" title="Last 7 days check-ins">
                  {sentimentStrip(logs.filter((l) => l.song_id === selectedNode.songId), 7).map((d) => (
                    <span key={d.date} className={`w-2.5 h-2.5 rounded-full ${CHECK_IN_COLOR[d.checkIn ?? "none"]}`} />
                  ))}
                </div>
                <ul className="mt-3 space-y-2">
                  {selectedLogs.map((l) => (
                    <li key={l.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: "var(--paper-cool)" }}>
                      <span style={{ color: "var(--ink)" }}>
                        {l.tuning_check_completed && <span title="Tuned" style={{ marginRight: 6 }}>🎵</span>}
                        {l.played_on}
                      </span>
                      <span style={{ color: "var(--ink-soft)" }}>{l.duration_min} min</span>
                      <span>
                        {l.check_in && <span className={`inline-block w-2 h-2 rounded-full mr-1 align-middle ${CHECK_IN_COLOR[l.check_in as CheckIn]}`} />}
                        {l.check_in ? CHECK_IN_EMOJI[l.check_in as CheckIn] : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {selectedNode.state !== "locked" && (
              <button
                onClick={() => navigate(`/student/song/${selectedNode.songId}`)}
                className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors"
                style={{ background: "var(--navy)", color: "#fff" }}
              >
                {selectedNode.sessions > 0 ? "Continue practicing →" : "Start this song →"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default Journey;
