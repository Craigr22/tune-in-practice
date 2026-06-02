import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { SONGS } from "@/data/songs";
import type { Song, SongState } from "@/lib/types";

export type Instrument = "ukulele" | "guitar" | "violin";
export const INSTRUMENTS: { value: Instrument; label: string; emoji: string }[] = [
  { value: "ukulele", label: "Ukulele", emoji: "🎶" },
  { value: "guitar", label: "Guitar", emoji: "🎸" },
  { value: "violin", label: "Violin", emoji: "🎻" },
];

// Raw DB row shape (the generated supabase types don't know this table yet).
export type SongRow = {
  id: string;
  instrument: Instrument;
  title: string;
  artist: string | null;
  track_num: number | null;
  is_fingerstyle: boolean;
  sort_order: number;
  difficulty: string;
  chords: string[] | null;
  new_chord: string | null;
  strum: string | null;
  strum_note: string | null;
  bpm: number | null;
  state: string;
  daily_target: number;
  target_approvals: number;
  is_active: boolean;
};

// A DB-backed song flagged so the UI can tell it apart from the built-in catalog.
export type CatalogSong = Song & { source: "db" | "builtin"; isActive: boolean };

export function rowToSong(r: SongRow): CatalogSong {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist ?? "",
    track: r.is_fingerstyle ? "fs" : (r.track_num ?? 99),
    order: r.sort_order,
    difficulty: r.difficulty,
    chords: r.chords ?? [],
    newChord: r.new_chord ?? null,
    strum: r.strum ?? undefined,
    strumNote: r.strum_note ?? undefined,
    bpm: r.bpm ?? undefined,
    state: (r.state as SongState) ?? "next",
    dailyTarget: r.daily_target,
    targetApprovals: r.target_approvals,
    fingerstyle: r.is_fingerstyle,
    source: "db",
    isActive: r.is_active,
  };
}

// The built-in code catalog is ukulele-only today.
function builtinFor(instrument: Instrument): CatalogSong[] {
  if (instrument !== "ukulele") return [];
  return SONGS.map((s) => ({ ...s, source: "builtin" as const, isActive: true }));
}

const sortSongs = (a: CatalogSong, b: CatalogSong) => {
  const ta = a.track === "fs" ? 99 : (a.track as number);
  const tb = b.track === "fs" ? 99 : (b.track as number);
  return ta - tb || a.order - b.order;
};

/** Raw DB rows for one instrument (admin view — includes inactive). */
export function useSongRows(instrument: Instrument) {
  return useQuery({
    queryKey: ["songs", instrument],
    queryFn: async (): Promise<SongRow[]> => {
      const { data, error } = await (supabase as any)
        .from("songs")
        .select("*")
        .eq("instrument", instrument)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as SongRow[];
    },
  });
}

/**
 * Combined built-in + DB songs for an instrument, sorted by track/order.
 * Used by the admin manager (showInactive=true) and student pages (false).
 */
export function useCatalogSongs(instrument: Instrument, opts?: { showInactive?: boolean }): CatalogSong[] {
  const { data: rows = [] } = useSongRows(instrument);
  return useMemo(() => {
    const db = rows.map(rowToSong).filter((s) => opts?.showInactive || s.isActive);
    const builtinIds = new Set(builtinFor(instrument).map((s) => s.id));
    // DB rows win over a built-in with the same id (lets admins override).
    const dbIds = new Set(db.map((s) => s.id));
    const builtin = builtinFor(instrument).filter((s) => !dbIds.has(s.id) && builtinIds.has(s.id));
    return [...builtin, ...db].sort(sortSongs);
  }, [rows, instrument, opts?.showInactive]);
}

export type SongInput = {
  id?: string;
  instrument: Instrument;
  title: string;
  artist: string;
  track_num: number | null;
  is_fingerstyle: boolean;
  sort_order: number;
  difficulty: string;
  chords: string[];
  new_chord: string | null;
  strum: string | null;
  strum_note: string | null;
  bpm: number | null;
  state: string;
  daily_target: number;
  target_approvals: number;
  is_active: boolean;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "song";

export function useSaveSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SongInput) => {
      const { id, ...fields } = input;
      if (id) {
        const { error } = await (supabase as any).from("songs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        return id;
      }
      const newId = `${slugify(input.title)}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await (supabase as any).from("songs").insert({ id: newId, ...fields });
      if (error) throw error;
      return newId;
    },
    onSuccess: (_id, input) => {
      qc.invalidateQueries({ queryKey: ["songs", input.instrument] });
    },
  });
}

export function useDeleteSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; instrument: Instrument }) => {
      const { error } = await (supabase as any).from("songs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { instrument }) => qc.invalidateQueries({ queryKey: ["songs", instrument] }),
  });
}
