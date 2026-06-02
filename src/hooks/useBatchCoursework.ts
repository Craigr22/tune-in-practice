import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";
import { useCatalogSongs, type CatalogSong, type Instrument } from "@/hooks/useSongCatalog";

export const DEFAULT_SONGS_PER_SESSION = 3;

export function toInstrument(name?: string | null): Instrument {
  const n = (name ?? "").toLowerCase();
  if (n.includes("guitar")) return "guitar";
  if (n.includes("violin")) return "violin";
  return "ukulele";
}

export type BatchCourseworkRow = {
  id: string;
  batch_id: string;
  song_id: string;
  is_unlocked: boolean;
  sort_order: number;
};

/** A catalog song annotated with this class's unlock state + ordering. */
export type ClassSong = CatalogSong & { unlocked: boolean; classOrder: number };

/** Merge the instrument catalog with a class's per-song overrides. */
export function effectiveClassSongs(
  catalog: CatalogSong[],
  rows: BatchCourseworkRow[],
  opts?: { showLocked?: boolean },
): ClassSong[] {
  const byId = new Map(rows.map((r) => [r.song_id, r]));
  const merged = catalog.map((s, i) => {
    const r = byId.get(s.id);
    return {
      ...s,
      unlocked: r ? r.is_unlocked : true,
      // Overridden order wins; otherwise keep catalog order (spaced so new songs append).
      classOrder: r ? r.sort_order : (i + 1) * 100,
    };
  });
  return merged
    .filter((s) => opts?.showLocked || s.unlocked)
    .sort((a, b) => a.classOrder - b.classOrder);
}

export function useBatchCourseworkRows(batchId?: string) {
  return useQuery({
    queryKey: ["batch-coursework", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<BatchCourseworkRow[]> => {
      const { data, error } = await (supabase as any)
        .from("batch_coursework")
        .select("id, batch_id, song_id, is_unlocked, sort_order")
        .eq("batch_id", batchId!)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as BatchCourseworkRow[];
    },
  });
}

export function useBatchSettings(batchId?: string) {
  return useQuery({
    queryKey: ["batch-settings", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<{ songs_per_session: number }> => {
      const { data, error } = await (supabase as any)
        .from("batch_settings")
        .select("songs_per_session")
        .eq("batch_id", batchId!)
        .maybeSingle();
      if (error) throw error;
      return { songs_per_session: data?.songs_per_session ?? DEFAULT_SONGS_PER_SESSION };
    },
  });
}

/** Bulk-persist the whole ordered list for a class (unlock + order in one write). */
export function useSaveCoursework(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (songs: { song_id: string; is_unlocked: boolean; sort_order: number }[]) => {
      const payload = songs.map((s) => ({ batch_id: batchId, ...s, updated_at: new Date().toISOString() }));
      const { error } = await (supabase as any)
        .from("batch_coursework")
        .upsert(payload, { onConflict: "batch_id,song_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batch-coursework", batchId] }),
  });
}

export function useSaveSongsPerSession(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (n: number) => {
      const { error } = await (supabase as any)
        .from("batch_settings")
        .upsert({ batch_id: batchId, songs_per_session: n, updated_at: new Date().toISOString() }, { onConflict: "batch_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batch-settings", batchId] }),
  });
}

/* ---------------- student side ---------------- */

export type StudentClassConfig = {
  batchId: string | null;
  instrument: Instrument;
  dayOfWeek: number | null;
  songsPerSession: number;
  rows: BatchCourseworkRow[];
};

/** The enrolled student's class + its coursework config (for driving their songs/plan). */
export function useStudentClassConfig(): StudentClassConfig {
  const { data: student } = useStudentMe();

  const { data: enrollment } = useQuery({
    queryKey: ["student-class", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("batch_id, batches:batch_id(day_of_week, instruments(name))")
        .eq("student_id", student!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const b = (data as any)?.batches;
      return {
        batchId: (data as any)?.batch_id ?? null,
        dayOfWeek: b?.day_of_week ?? null,
        instrument: toInstrument(b?.instruments?.name),
      };
    },
  });

  const batchId = enrollment?.batchId ?? undefined;
  const { data: rows = [] } = useBatchCourseworkRows(batchId);
  const { data: settings } = useBatchSettings(batchId);

  return {
    batchId: enrollment?.batchId ?? null,
    instrument: enrollment?.instrument ?? "ukulele",
    dayOfWeek: enrollment?.dayOfWeek ?? null,
    songsPerSession: settings?.songs_per_session ?? DEFAULT_SONGS_PER_SESSION,
    rows,
  };
}

/**
 * The songs a student should see/practice — their class's unlocked songs in
 * the teacher's order, falling back to the full instrument catalog when the
 * class hasn't been configured.
 */
export function useStudentSongs(): ClassSong[] {
  const cfg = useStudentClassConfig();
  const catalog = useCatalogSongs(cfg.instrument);
  return useMemo(
    () => effectiveClassSongs(catalog, cfg.rows),
    [catalog, cfg.rows],
  );
}
