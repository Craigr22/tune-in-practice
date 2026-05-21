import { useMemo } from "react";
import { useWeeklyPlan } from "@/hooks/useWeeklyPlan";
import { SESSION_TEMPLATES } from "@/lib/sessionTemplates";
import { SONGS } from "@/data/songs";

const BONUS_EMOJI = { callback_song: "🎁", mini_challenge: "🎯", jam: "🎸", foundation_refresh: "📚" } as const;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PracticeDiary() {
  const { data: plan = [] } = useWeeklyPlan();
  const songTitle = useMemo(() => Object.fromEntries(SONGS.map((s) => [s.id, s.title])), []);

  if (!plan.length) return null;

  return (
    <section
      className="rounded-2xl p-5 mb-5"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--ink-soft)" }}>
        This week's practice
      </div>
      <div className="space-y-3">
        {plan.map((s) => {
          const tpl = SESSION_TEMPLATES[s.session_type];
          const totalMin = s.warmup_target_min + s.focus_target_min + s.bonus_target_min;
          const dow = DOW[new Date(s.scheduled_date).getDay()];
          const focusTitle = songTitle[s.focus_song_id] || s.focus_song_id;
          const warmupTitle = s.warmup_song_id ? songTitle[s.warmup_song_id] : null;
          const bonusTitle = s.bonus_song_id ? songTitle[s.bonus_song_id] : null;
          const done = !!s.completed_at;
          return (
            <div
              key={s.id}
              className="rounded-xl p-4"
              style={{
                background: done ? "rgba(16,185,129,0.06)" : "var(--paper-warm)",
                border: `1px solid ${done ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm" style={{ color: "var(--ink)" }}>
                  {dow} · {tpl.emoji} {tpl.label} · {totalMin} min {done && <span className="ml-1" style={{ color: "#10b981" }}>✓</span>}
                </div>
              </div>
              <ul className="text-xs space-y-1" style={{ color: "var(--ink-soft)" }}>
                <li>
                  ♪ Warm-up{warmupTitle ? `: ${warmupTitle}` : ""}
                  {s.warmup_completed && <span className="ml-1" style={{ color: "#10b981" }}>✓</span>}
                </li>
                <li>
                  🎯 Focus: {focusTitle}
                  {s.focus_completed && <span className="ml-1" style={{ color: "#10b981" }}>✓</span>}
                </li>
                <li>
                  {BONUS_EMOJI[s.bonus_type]} Bonus{bonusTitle ? `: ${bonusTitle}` : ""}
                  {s.bonus_completed && <span className="ml-1" style={{ color: "#10b981" }}>✓</span>}
                </li>
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
