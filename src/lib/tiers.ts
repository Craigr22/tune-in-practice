// The four stages of a student's journey. Shared so the admin course plan,
// the Journey map and anything else all use one set of names and colours.

export type TierKey = "beginner" | "adv-beginner" | "casual" | "fingerstyle";

export interface Tier {
  key: TierKey;
  name: string;
  tagline: string;
  emoji: string;
  accent: string;
  accentSoft: string;
}

export const TIERS: Tier[] = [
  { key: "beginner",     name: "Beginner",          tagline: "First chords · steady strumming",    emoji: "🌱", accent: "#10b981", accentSoft: "#d1fae5" },
  { key: "adv-beginner", name: "Advanced Beginner", tagline: "New shapes · richer progressions",   emoji: "🌿", accent: "#3b82f6", accentSoft: "#dbeafe" },
  { key: "casual",       name: "Casual Ukulelist",  tagline: "Full songs · confident performance", emoji: "🎤", accent: "#a855f7", accentSoft: "#f3e8ff" },
  { key: "fingerstyle",  name: "Fingerstyle Path",  tagline: "Melody picking · tab reading",       emoji: "🎼", accent: "#f59e0b", accentSoft: "#fef3c7" },
];

export const getTier = (key: string | null | undefined): Tier =>
  TIERS.find((t) => t.key === key) ?? TIERS[0];

/** Which tier a catalog song sits in, from its track number. */
export const tierForTrack = (track: number | "fs"): TierKey => {
  if (track === "fs") return "fingerstyle";
  if (track <= 4) return "beginner";
  if (track <= 8) return "adv-beginner";
  return "casual";
};
