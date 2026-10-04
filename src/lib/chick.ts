import type { TierKey } from "@/lib/tiers";

/**
 * The chick: a student's place in the course, as something that grows.
 *
 * It follows the class, not the student's own tally — everyone in a class
 * hatches on the same Sunday, which is the point: it is something to turn up
 * for together.
 *
 *   class 1                    a plain egg
 *   classes 2 and 3            the egg cracks
 *   class 4, and on through
 *   Advanced Beginner          it hatches
 *   the stages after that      the full chick
 *   the last month             the graduate
 */
export type ChickStage = "egg" | "cracked" | "hatching" | "chick" | "graduate";

export const CHICK_STAGES: ChickStage[] = ["egg", "cracked", "hatching", "chick", "graduate"];

/** How many weeks before the end the cap goes on. */
export const GRADUATE_WEEKS = 4;

const TIER_RANK: Record<TierKey, number> = { beginner: 0, "adv-beginner": 1, casual: 2, fingerstyle: 3 };

export interface ChickInput {
  /** The course week the class is on; null before the course has started. */
  week: number | null;
  /** The stage that week belongs to on the course plan. */
  tier: TierKey | null;
  /** The last week the course plan runs to, if it is planned that far. */
  lastWeek: number | null;
}

export function chickStage({ week, tier, lastWeek }: ChickInput): ChickStage {
  if (!week || week <= 1) return "egg";
  if (week <= 3) return "cracked";
  // Past Advanced Beginner. The cap needs this too: a plan only written up to
  // week six would otherwise "graduate" a class in its first month.
  if (TIER_RANK[tier ?? "beginner"] < TIER_RANK.casual) return "hatching";
  if (lastWeek && week > lastWeek - GRADUATE_WEEKS) return "graduate";
  return "chick";
}

/**
 * The stage a week belongs to. A week the plan hasn't reached yet carries on
 * in the stage of the last week that was planned before it.
 */
export function tierForWeek(days: { week_number: number; tier: TierKey }[], week: number | null): TierKey | null {
  if (!week) return null;
  let best: { week_number: number; tier: TierKey } | null = null;
  for (const d of days) {
    if (d.week_number <= week && (!best || d.week_number > best.week_number)) best = d;
  }
  return best?.tier ?? null;
}

export const CHICK_LABEL: Record<ChickStage, string> = {
  egg: "An egg",
  cracked: "An egg starting to crack",
  hatching: "A chick hatching",
  chick: "A chick playing the ukulele",
  graduate: "A chick in a graduation cap",
};

/** What stands in until the animation has loaded, and where it can't play. */
export const CHICK_EMOJI: Record<ChickStage, string> = {
  egg: "🥚",
  cracked: "🥚",
  hatching: "🐣",
  chick: "🐥",
  graduate: "🎓",
};

/** The Journey heading for each stage. */
export const CHICK_HEADING: Record<ChickStage, string> = {
  egg: "Your journey begins",
  cracked: "Something's stirring…",
  hatching: "You're making progress",
  chick: "You're finding your voice",
  graduate: "Almost a graduate",
};
