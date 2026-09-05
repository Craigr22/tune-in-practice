import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStudentSongs, useStudentClassConfig } from "@/hooks/useBatchCoursework";
import { useStudentCoursePlan, shiftedPlanWeek } from "@/hooks/useCoursePlan";
import { isoMonday, useStudentBatchDay, planWeekOneMonday } from "@/hooks/useWeeklyPlan";
import {
  usePracticeLogs,
  useSongProgress,
  avgCourseBadge,
  tuningRate,
} from "@/hooks/useStudentProgress";
import BadgeDisplay from "@/components/shared/BadgeDisplay";
import { getBadge, nextBadge } from "@/lib/badges";
import SongVideos from "@/components/student/SongVideos";
import { TIERS, getTier, tierForTrack, type TierKey } from "@/lib/tiers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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


const Journey = () => {
  const navigate = useNavigate();
  const { data: logs = [] } = usePracticeLogs();
  const { data: progress = [] } = useSongProgress();
  const catalog = useStudentSongs();
  const [selected, setSelected] = useState<string | null>(null);

  // Where this student sits in the admin's course plan, expressed in the same
  // stages the song map below uses.
  const { instrument, courseStartDate, shiftWeeks } = useStudentClassConfig();
  const { days: planDays } = useStudentCoursePlan(instrument);
  const { data: batch } = useStudentBatchDay();
  const currentPlanWeek = courseStartDate
    ? shiftedPlanWeek(planWeekOneMonday(courseStartDate, batch?.day_of_week ?? 6), isoMonday(), shiftWeeks)
    : null;
  const currentTier = useMemo(() => {
    if (!currentPlanWeek) return null;
    const day = planDays.find((d) => d.week_number === currentPlanWeek);
    return day ? getTier(day.tier) : null;
  }, [planDays, currentPlanWeek]);
  const planWeeksByTier = useMemo(() => {
    const map: Partial<Record<TierKey, number[]>> = {};
    for (const d of planDays) {
      const key = getTier(d.tier).key;
      if (!map[key]) map[key] = [];
      if (!map[key]!.includes(d.week_number)) map[key]!.push(d.week_number);
    }
    return map;
  }, [planDays]);

  const nodes: MapNode[] = useMemo(() => {
    const ordered = [...catalog].sort((a, b) => {
      if (a.track !== b.track) return (a.track === "fs" ? 99 : a.track) - (b.track === "fs" ? 99 : b.track);
      return a.order - b.order;
    });

    let foundCurrent = false;
    return ordered.map((s) => {
      const p = progress.find((x) => x.song_id === s.id);
      const songLogs = logs.filter((l) => l.song_id === s.id);
      const tb = p?.teacher_badge ?? null;
      // Mastery belongs to this student's persisted teacher assessment. The
      // song catalog may contain curriculum defaults, never student progress.
      const isMastered = (tb ?? 0) >= 5;
      const hasProgress = songLogs.length > 0 || (tb ?? 0) > 0;

      let state: NodeState;
      // FOR NOW: nothing locks — every song is open to explore and play.
      if (isMastered) state = "mastered";
      else if (hasProgress) { state = "current"; foundCurrent = true; }
      else state = "next";
      void foundCurrent;

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
        track: s.track,
        fingerstyle: s.fingerstyle,
      };
    });
  }, [logs, progress, catalog]);

  const avg = avgCourseBadge(progress);
  const course = getBadge(avg);
  const courseNext = nextBadge(avg);
  const masteredCount = nodes.filter((n) => n.state === "mastered").length;
  const totalCount = nodes.length;
  const overallPct = Math.round((masteredCount / Math.max(1, totalCount)) * 100);

  const selectedNode = nodes.find((n) => n.songId === selected) || null;

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

        {/* Where the student is in the course, in the same stages as the map. */}
        {currentPlanWeek && currentTier && (
          <section className="rounded-2xl p-4 md:p-5 mb-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--ink-soft)" }}>
              Your course
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {TIERS.map((t) => {
                const weeksIn = planWeeksByTier[t.key] ?? [];
                if (!weeksIn.length) return null;
                const done = weeksIn.every((w) => w < currentPlanWeek);
                const active = t.key === currentTier.key;
                return (
                  <span
                    key={t.key}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={
                      active
                        ? { background: t.accent, color: "#fff" }
                        : { background: t.accentSoft, color: "var(--ink)", opacity: done ? 1 : 0.6 }
                    }
                  >
                    {t.emoji} {t.name}{done && !active ? " ✓" : ""}
                  </span>
                );
              })}
            </div>
            <div className="text-sm mt-2" style={{ color: "var(--ink-soft)" }}>
              You're on <strong style={{ color: "var(--ink)" }}>week {currentPlanWeek}</strong> of{" "}
              {currentTier.name} — {currentTier.tagline.toLowerCase()}.
            </div>
          </section>
        )}

        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: "var(--ink)" }}>Song map</h2>
          <div className="text-xs flex items-center gap-3" style={{ color: "var(--ink-soft)" }}>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--gold-deep)" }} />Mastered</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "var(--navy)" }} />Current</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border-strong)" }} />Up next</span>
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

          <div className="relative space-y-10">
            {TIERS.map((tier) => {
              const tierNodes = nodes.filter((n) => tierForTrack(n.track) === tier.key);
              if (tierNodes.length === 0) return null;
              const tierMastered = tierNodes.filter((n) => n.state === "mastered").length;
              const tierPct = Math.round((tierMastered / tierNodes.length) * 100);
              const tierActive = tierNodes.some((n) => n.state === "current" || n.state === "next");
              const tierComplete = tierMastered === tierNodes.length;
              const tierLocked = !tierActive && !tierComplete && tierMastered === 0;

              return (
                <div key={tier.key} className="relative">
                  {/* Tier banner */}
                  <div
                    className="rounded-2xl px-5 py-4 mb-5 flex items-center gap-4 flex-wrap"
                    style={{
                      background: `linear-gradient(90deg, ${tier.accentSoft}, transparent)`,
                      borderLeft: `4px solid ${tier.accent}`,
                      opacity: tierLocked ? 0.65 : 1,
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{ background: "#fff", border: `2px solid ${tier.accent}`, boxShadow: "var(--shadow-sm)" }}
                    >
                      {tier.emoji}
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg md:text-xl font-bold" style={{ color: "var(--ink)" }}>{tier.name}</h3>
                        {tierComplete && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: tier.accent, color: "#fff" }}>Complete ✓</span>
                        )}
                        {tierActive && !tierComplete && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full animate-pulse" style={{ background: tier.accent, color: "#fff" }}>In progress</span>
                        )}
                        {tierLocked && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: "var(--border-strong)", color: "#fff" }}>🔒 Locked</span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>{tier.tagline}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold" style={{ color: tier.accent }}>{tierMastered}/{tierNodes.length} mastered</div>
                      <div className="w-28 h-1.5 mt-1 rounded-full overflow-hidden" style={{ background: tier.accentSoft }}>
                        <div className="h-full transition-all" style={{ width: `${tierPct}%`, background: tier.accent }} />
                      </div>
                    </div>
                  </div>

                  {/* Tier stops */}
                  <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                    {tierNodes.map((n, i) => {
                      const globalIndex = nodes.indexOf(n);
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
                      const offsetY = i % 2 === 0 ? 0 : 18;

                      return (
                        <button
                          key={n.songId}
                          onClick={() => setSelected(isOpen ? null : n.songId)}
                          className={`relative rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 cursor-pointer ${n.state === "locked" ? "opacity-80" : ""}`}
                          style={{ background: bg, border: `2px solid ${border}`, boxShadow: ring, transform: `translateY(${offsetY}px)` }}
                        >
                          <div
                            className="absolute -top-3 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              background: n.state === "mastered" ? "var(--gold-deep)" : n.state === "current" ? "var(--navy)" : n.state === "locked" ? "var(--border-strong)" : "var(--ink)",
                              color: "#fff",
                              boxShadow: "var(--shadow-sm)",
                            }}
                          >
                            {n.state === "locked" ? "🔒" : globalIndex + 1}
                          </div>

                          {/* Tier accent stripe */}
                          <div className="absolute top-0 right-0 w-1.5 h-8 rounded-bl-md" style={{ background: tier.accent, opacity: n.state === "locked" ? 0.4 : 1 }} />

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
                              {n.title}
                            </div>
                            <div className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "var(--ink-soft)" }}>{n.artist}</div>
                            {n.state === "current" && (
                              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--navy)" }}>In progress</div>
                            )}
                            {n.state === "next" && (
                              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--gold-deep)" }}>Up next</div>
                            )}
                            {n.state === "locked" && (
                              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>Peek ahead</div>
                            )}
                          </div>

                          {n.fingerstyle && n.state !== "locked" && (
                            <div className="absolute top-2 right-3 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: "var(--paper-cool)", color: "var(--ink-soft)" }}>FS</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected song — opens as a dialog so it's always in view, however
            far down the map the student tapped. */}
        <Dialog open={!!selectedNode} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedNode && (
          <>
            <DialogHeader>
              <DialogTitle style={{ color: "var(--ink)" }}>{selectedNode.title}</DialogTitle>
            </DialogHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{selectedNode.artist}</div>
                <div className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>
                  {selectedNode.sessions > 0
                    ? <>{selectedNode.firstDate} → {selectedNode.lastDate} · {selectedNode.sessions} sessions · {selectedNode.totalMin} min</>
                    : "Not started yet"}
                </div>
              </div>
              <BadgeDisplay level={selectedNode.teacherBadge} size="md" />
            </div>

            {/* The song's clips: tutorial and backing tracks. Nothing opens
                out of here — what a student needs is the video itself. */}
            <SongVideos songId={selectedNode.songId} inset={false} />
          </>
          )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default Journey;
