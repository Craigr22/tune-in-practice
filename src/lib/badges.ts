export type BadgeLevel = 1 | 2 | 3 | 4 | 5;

export interface BadgeMeta {
  level: BadgeLevel;
  emoji: string;
  name: string;
  blurb: string;
}

export const BADGES: Record<BadgeLevel, BadgeMeta> = {
  1: { level: 1, emoji: "🦥", name: "Sloth",    blurb: "Learning chord shapes" },
  2: { level: 2, emoji: "🐢", name: "Tortoise", blurb: "Plays through with stops" },
  3: { level: 3, emoji: "🐬", name: "Dolphin",  blurb: "Smooth transitions, decent tempo" },
  4: { level: 4, emoji: "🐆", name: "Cheetah",  blurb: "Full speed, clean strumming" },
  5: { level: 5, emoji: "🦅", name: "Eagle",    blurb: "Performance-ready" },
};

export const BADGE_LIST: BadgeMeta[] = [1, 2, 3, 4, 5].map((l) => BADGES[l as BadgeLevel]);

export function getBadge(level: number | null | undefined): BadgeMeta | null {
  if (!level) return null;
  const rounded = Math.max(1, Math.min(5, Math.round(level))) as BadgeLevel;
  return BADGES[rounded];
}

export function nextBadge(level: number | null | undefined): BadgeMeta | null {
  if (!level || level >= 5) return null;
  const next = (Math.max(1, Math.min(4, Math.round(level))) + 1) as BadgeLevel;
  return BADGES[next];
}
