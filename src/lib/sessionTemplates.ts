// Static session templates. Focus instruction is the template content; warmup + bonus
// are generated per-session by src/lib/sessionSegments.ts.

export type SessionKind = "build" | "flow" | "stretch";

export interface SessionTemplate {
  kind: SessionKind;
  label: string;
  emoji: string;
  warmup_target_min: number;
  focus_target_min: number;
  bonus_target_min: number;
  /** Default focus instruction if the song has no week-specific drill text. */
  focus_instruction: string;
}

export const SESSION_TEMPLATES: Record<SessionKind, SessionTemplate> = {
  build: {
    kind: "build",
    label: "Learn it",
    emoji: "🧱",
    warmup_target_min: 5,
    focus_target_min: 20,
    bonus_target_min: 5,
    focus_instruction:
      "Work the hardest chord change in this song. 4 clean reps, then loop the bar that breaks down. No strum patterns yet.",
  },
  flow: {
    kind: "flow",
    label: "Play it through",
    emoji: "🌊",
    warmup_target_min: 5,
    focus_target_min: 15,
    bonus_target_min: 10,
    focus_instruction:
      "Full play-throughs at performance tempo. Don't stop for mistakes; mark where it breaks and come back to it.",
  },
  stretch: {
    kind: "stretch",
    label: "Push yourself",
    emoji: "🎯",
    warmup_target_min: 5,
    focus_target_min: 15,
    bonus_target_min: 10,
    focus_instruction:
      "Go 10% faster than you think you can, or try the song in a new strum pattern. Push the edge a bit.",
  },
};

export const SESSION_ORDER: SessionKind[] = ["build", "flow", "stretch"];

/** Icons for the bonus segment types generated in sessionSegments.ts. */
export const BONUS_EMOJI = {
  callback_song: "🎁",
  mini_challenge: "🎯",
  jam: "🎸",
  foundation_refresh: "📚",
} as const;
