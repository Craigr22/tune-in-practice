import { useState } from "react";
import { SONGS } from "@/data/songs";
import { SONG_AUDIO } from "@/data/audio";
import { FOUNDATIONS } from "@/data/foundations";
import type { WeeklyPlanSession } from "@/hooks/useWeeklyPlan";
import { useCompleteSegment } from "@/hooks/useWeeklyPlan";

type Segment = "warmup" | "focus" | "bonus";

interface Props {
  session: WeeklyPlanSession;
  onAllDone: () => void;
  focusContent: React.ReactNode; // existing tab content for focus
}

const BONUS_LABELS: Record<WeeklyPlanSession["bonus_type"], { emoji: string; label: string }> = {
  callback_song: { emoji: "🎁", label: "Callback song" },
  mini_challenge: { emoji: "🎯", label: "Mini challenge" },
  jam: { emoji: "🎸", label: "Jam" },
  foundation_refresh: { emoji: "📚", label: "Foundation refresh" },
};

export default function SegmentedPracticeView({ session, onAllDone, focusContent }: Props) {
  const completeSeg = useCompleteSegment();
  const [open, setOpen] = useState<Segment>(
    session.warmup_completed ? (session.focus_completed ? "bonus" : "focus") : "warmup"
  );
  const [skipped, setSkipped] = useState<Record<Segment, boolean>>({
    warmup: false, focus: false, bonus: false,
  });

  const warmupSong = session.warmup_song_id ? SONGS.find((s) => s.id === session.warmup_song_id) : null;
  const bonusSong = session.bonus_song_id ? SONGS.find((s) => s.id === session.bonus_song_id) : null;
  const foundation = session.bonus_type === "foundation_refresh"
    ? FOUNDATIONS[0] // pulled in instruction text; show first foundation as inline embed
    : null;

  const done = (seg: Segment) => {
    if (seg !== "focus") completeSeg.mutate({ id: session.id, segment: seg });
    advance(seg);
  };
  const skip = (seg: Segment) => {
    setSkipped((s) => ({ ...s, [seg]: true }));
    advance(seg);
  };
  const advance = (seg: Segment) => {
    if (seg === "warmup") setOpen("focus");
    else if (seg === "focus") setOpen("bonus");
    else onAllDone();
  };

  const segments: { key: Segment; emoji: string; label: string; mins: number; done: boolean }[] = [
    { key: "warmup", emoji: "♪", label: "Warm-up", mins: session.warmup_target_min, done: session.warmup_completed || skipped.warmup },
    { key: "focus", emoji: "🎯", label: "Focus", mins: session.focus_target_min, done: session.focus_completed || skipped.focus },
    { key: "bonus", emoji: BONUS_LABELS[session.bonus_type].emoji, label: "Bonus", mins: session.bonus_target_min, done: session.bonus_completed || skipped.bonus },
  ];

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Progress bar */}
      <div className="flex gap-1">
        {segments.map((s) => (
          <div
            key={s.key}
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: 8, background: "var(--paper-cool)" }}
            title={`${s.label} · ${s.mins} min`}
          >
            <div
              style={{
                height: "100%",
                width: s.done ? "100%" : open === s.key ? "30%" : "0%",
                background: s.done ? "var(--olive)" : "var(--navy)",
                transition: "width .3s",
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
        {segments.map((s) => (
          <span key={s.key} style={{ color: open === s.key ? "var(--navy)" : undefined }}>
            {s.emoji} {s.label} · {s.mins}m
          </span>
        ))}
      </div>

      {/* WARM-UP CARD */}
      {open === "warmup" && (
        <SegmentCard
          title="Warm-up"
          emoji="♪"
          mins={session.warmup_target_min}
          onDone={() => done("warmup")}
          onSkip={() => skip("warmup")}
        >
          <p className="text-sm" style={{ color: "var(--ink)" }}>{session.warmup_instruction}</p>
          {warmupSong && SONG_AUDIO[warmupSong.id] && (
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-soft)" }}>
                {warmupSong.title} · {warmupSong.artist}
              </div>
              <audio controls preload="none" style={{ width: "100%" }} src={SONG_AUDIO[warmupSong.id].src} />
            </div>
          )}
        </SegmentCard>
      )}

      {/* FOCUS CARD — embeds existing tab content */}
      {open === "focus" && (
        <SegmentCard
          title="Today's focus"
          emoji="🎯"
          mins={session.focus_target_min}
          onDone={() => done("focus")}
          onSkip={() => skip("focus")}
        >
          <p className="text-sm mb-3" style={{ color: "var(--ink)" }}>{session.focus_instruction}</p>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {focusContent}
          </div>
        </SegmentCard>
      )}

      {/* BONUS CARD */}
      {open === "bonus" && (
        <SegmentCard
          title={BONUS_LABELS[session.bonus_type].label}
          emoji={BONUS_LABELS[session.bonus_type].emoji}
          mins={session.bonus_target_min}
          onDone={() => done("bonus")}
          onSkip={() => skip("bonus")}
        >
          <p className="text-sm" style={{ color: "var(--ink)" }}>{session.bonus_instruction}</p>
          {(session.bonus_type === "callback_song" || session.bonus_type === "jam") && bonusSong && SONG_AUDIO[bonusSong.id] && (
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-soft)" }}>
                {bonusSong.title} · {bonusSong.artist}
              </div>
              <audio controls preload="none" style={{ width: "100%" }} src={SONG_AUDIO[bonusSong.id].src} />
            </div>
          )}
          {session.bonus_type === "foundation_refresh" && foundation && (
            <div
              className="mt-3 rounded-xl p-3 text-xs max-h-64 overflow-auto"
              style={{ background: "var(--paper-warm)", border: "1px dashed var(--border-strong)" }}
              dangerouslySetInnerHTML={{ __html: foundation.body }}
            />
          )}
        </SegmentCard>
      )}
    </div>
  );
}

function SegmentCard({
  title, emoji, mins, children, onDone, onSkip,
}: { title: string; emoji: string; mins: number; children: React.ReactNode; onDone: () => void; onSkip: () => void }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-sm flex items-center gap-2">
          <span className="text-lg">{emoji}</span> {title}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full" style={{ background: "var(--paper-cool)", color: "var(--ink-soft)" }}>
          {mins} min
        </span>
      </div>
      <div>{children}</div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={onDone}
          className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-transform hover:scale-[1.01]"
          style={{ background: "var(--navy)", color: "#fff" }}
        >
          Done ✓
        </button>
        <button
          onClick={onSkip}
          className="rounded-xl px-4 py-2.5 text-sm font-medium"
          style={{ background: "var(--paper-cool)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
