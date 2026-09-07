// Static templates for one continuous practice session.

export type SessionKind = "build" | "flow" | "stretch";

export interface SessionTemplate {
  kind: SessionKind;
  label: string;
  emoji: string;
  targetMin: number;
  instruction: string;
}

export const SESSION_TEMPLATES: Record<SessionKind, SessionTemplate> = {
  build: {
    kind: "build",
    label: "Learn it",
    emoji: "🧱",
    targetMin: 20,
    instruction:
      "Work the hardest chord change in this song. 4 clean reps, then loop the bar that breaks down. No strum patterns yet.",
  },
  flow: {
    kind: "flow",
    label: "Play it through",
    emoji: "🌊",
    targetMin: 20,
    instruction:
      "Full play-throughs at performance tempo. Don't stop for mistakes; mark where it breaks and come back to it.",
  },
  stretch: {
    kind: "stretch",
    label: "Push yourself",
    emoji: "🎯",
    targetMin: 20,
    instruction:
      "Go 10% faster than you think you can, or try the song in a new strum pattern. Push the edge a bit.",
  },
};

export const SESSION_ORDER: SessionKind[] = ["build", "flow", "stretch"];
