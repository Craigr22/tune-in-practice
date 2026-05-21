// Deterministic per-session warm-up + bonus generation. No LLM.
// Pure functions — call with the data you already fetched in hooks.

import { SONGS, type Song } from "@/data/songs";
import { SONG_AUDIO } from "@/data/audio";
import { FOUNDATIONS } from "@/data/foundations";
import { MINI_CHALLENGES, challengesForWeek } from "@/data/miniChallenges";
import type { SongProgress, PracticeLog } from "@/hooks/useStudentProgress";

type BonusType = "callback_song" | "mini_challenge" | "jam" | "foundation_refresh";

export interface WarmupResult {
  song_id: string | null;
  instruction: string;
}

export interface BonusResult {
  bonus_type: BonusType;
  song_id: string | null;
  instruction: string;
}

interface GenContext {
  progress: SongProgress[];
  logs: PracticeLog[];
  currentSongId: string;
  /** Warm-up song ids used in this student's last 2 sessions (most recent first). */
  recentWarmupIds?: string[];
  /** Bonus types from the prior session (to enforce "never same type 2 in a row"). */
  previousBonusType?: BonusType | null;
  weekNumber: number;
  /** Foundation ids the student has been shown in class (or completed). */
  foundationsSeen?: string[];
  /** Override RNG for testing. Defaults to Math.random. */
  rand?: () => number;
}

const hasAudio = (id: string) => !!SONG_AUDIO[id];
const songOf = (id: string): Song | undefined => SONGS.find((s) => s.id === id);
const daysSince = (iso: string | null | undefined) => {
  if (!iso) return 999;
  const then = new Date(iso).getTime();
  return Math.floor((Date.now() - then) / 86_400_000);
};

function weightedPick<T>(items: T[], weights: number[], rand: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(rand() * items.length)];
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/* =============================== WARM-UP =============================== */

export function generateWarmup(ctx: GenContext): WarmupResult {
  const rand = ctx.rand ?? Math.random;
  const recent = new Set(ctx.recentWarmupIds ?? []);

  // Pool: progress rows with any badge >= 3, excluding focus + recent warmups.
  const pool = ctx.progress
    .filter((p) => Math.max(p.teacher_badge ?? 0, p.self_badge ?? 0) >= 3)
    .filter((p) => p.song_id !== ctx.currentSongId)
    .filter((p) => !recent.has(p.song_id))
    .filter((p) => hasAudio(p.song_id) && songOf(p.song_id));

  if (pool.length > 0) {
    const weights = pool.map((p) => (daysSince(p.last_practiced) > 10 ? 2 : 1));
    const picked = weightedPick(pool, weights, rand);
    const song = songOf(picked.song_id)!;
    const stale = daysSince(picked.last_practiced) > 10;
    const recent14 = daysSince(picked.last_practiced) <= 14;
    const blurb = stale
      ? "haven't played this in a while"
      : recent14
      ? "nailed this last week"
      : "you've got this one in the bank";
    const section = song.sections?.[0]?.name?.toLowerCase() || "the opening";
    return {
      song_id: song.id,
      instruction: `Warm up with the ${section} of ${song.title}. You ${blurb}.`,
    };
  }

  // Fallback 1: pick 2 known chords from any progress row, ask for clean reps.
  const knownChords = Array.from(
    new Set(
      ctx.progress
        .flatMap((p) => songOf(p.song_id)?.chords ?? [])
        .filter(Boolean)
    )
  );
  if (knownChords.length >= 2) {
    const a = knownChords[Math.floor(rand() * knownChords.length)];
    let b = knownChords[Math.floor(rand() * knownChords.length)];
    if (b === a) b = knownChords.find((c) => c !== a) || a;
    return {
      song_id: null,
      instruction: `Quick chord review — play ${a} cleanly 5 times, then ${b} cleanly 5 times. No strumming patterns.`,
    };
  }

  // Fallback 2: brand new student.
  return {
    song_id: null,
    instruction: "Play any chord you know — 30 seconds, just to wake up your fingers.",
  };
}

/* ================================ BONUS ================================ */

const BONUS_WEIGHTS: Record<BonusType, number> = {
  callback_song: 50,
  mini_challenge: 20,
  jam: 15,
  foundation_refresh: 15,
};

export function generateBonus(ctx: GenContext): BonusResult {
  const rand = ctx.rand ?? Math.random;
  const types: BonusType[] = ["callback_song", "mini_challenge", "jam", "foundation_refresh"];
  const weights = types.map((t) => (t === ctx.previousBonusType ? 0 : BONUS_WEIGHTS[t]));

  // Try types in weighted order, falling through if a type has no valid pick.
  const order: BonusType[] = [];
  const pool = types.map((t, i) => ({ t, w: weights[i] }));
  while (pool.length) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let r = rand() * Math.max(total, 1);
    let pickedIdx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w || 0.001;
      if (r <= 0) { pickedIdx = i; break; }
    }
    order.push(pool[pickedIdx].t);
    pool.splice(pickedIdx, 1);
  }

  for (const t of order) {
    const result = tryBonus(t, ctx, rand);
    if (result) return result;
  }

  // Last-resort fallback: a week-1 mini challenge.
  const fallback = MINI_CHALLENGES[0];
  return { bonus_type: "mini_challenge", song_id: null, instruction: fallback.instruction };
}

function tryBonus(type: BonusType, ctx: GenContext, rand: () => number): BonusResult | null {
  switch (type) {
    case "callback_song": {
      // Songs rated "nailed" in last 30 days, exclude focus, must have audio.
      const cutoff = Date.now() - 30 * 86_400_000;
      const nailed = new Set(
        ctx.logs
          .filter((l) => l.check_in === "nailed" && new Date(l.played_on).getTime() >= cutoff)
          .map((l) => l.song_id)
      );
      const candidates = Array.from(nailed)
        .filter((id) => id !== ctx.currentSongId && hasAudio(id) && songOf(id));
      if (!candidates.length) return null;
      const id = candidates[Math.floor(rand() * candidates.length)];
      const song = songOf(id)!;
      return {
        bonus_type: "callback_song",
        song_id: id,
        instruction: `Callback — play through ${song.title} for fun. You nailed this recently, enjoy it.`,
      };
    }
    case "mini_challenge": {
      const pool = challengesForWeek(ctx.weekNumber);
      if (!pool.length) return null;
      const pick = pool[Math.floor(rand() * pool.length)];
      return { bonus_type: "mini_challenge", song_id: null, instruction: `${pick.title} — ${pick.instruction}` };
    }
    case "jam": {
      const playable = ctx.progress
        .filter((p) => Math.max(p.teacher_badge ?? 0, p.self_badge ?? 0) >= 3)
        .filter((p) => hasAudio(p.song_id) && songOf(p.song_id));
      if (!playable.length) return null;
      const picked = playable[Math.floor(rand() * playable.length)];
      const song = songOf(picked.song_id)!;
      return {
        bonus_type: "jam",
        song_id: song.id,
        instruction: `Jam time — play along with the full audio of ${song.title} at full speed. No pressure, just ride it.`,
      };
    }
    case "foundation_refresh": {
      const seen = ctx.foundationsSeen?.length ? ctx.foundationsSeen : FOUNDATIONS.map((f) => f.id);
      const pool = FOUNDATIONS.filter((f) => seen.includes(f.id));
      if (!pool.length) return null;
      const pick = pool[Math.floor(rand() * pool.length)];
      return {
        bonus_type: "foundation_refresh",
        song_id: null,
        instruction: `Refresh — re-read "${pick.title}". 2 minutes, then close it.`,
      };
    }
  }
}
