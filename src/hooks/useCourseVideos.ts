import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import type { Instrument } from "@/hooks/useSongCatalog";

/** Lessons and drills are video; a backing track may be video or an mp3. */
export type MediaKind = "lesson" | "track" | "exercise";

export type CourseVideo = {
  id: string;
  instrument: Instrument;
  song_id: string | null;
  title: string;
  description: string | null;
  storage_path: string;
  kind: MediaKind;
  /** Position within its library, lowest first. */
  sort_order: number;
  created_at: string;
};

/** Whether a stored file plays as sound rather than picture. */
export function isAudioPath(path: string): boolean {
  return /\.(mp3|m4a|aac|wav|ogg|oga|flac)$/i.test(path);
}

const BUCKET = "videos";

/** How long a playback link stays valid. Refreshed well before it lapses. */
const SIGNED_URL_TTL_SEC = 60 * 60;

/**
 * Mint short-lived playback URLs for private videos. The bucket is private,
 * so only signed-in users can sign a URL — anonymous visitors get nothing.
 */
export function useSignedVideoUrls(paths: string[]) {
  const key = [...paths].sort().join("|");
  return useQuery({
    queryKey: ["video-urls", key],
    enabled: paths.length > 0,
    staleTime: (SIGNED_URL_TTL_SEC - 300) * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SEC);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
      }
      return map;
    },
  });
}

export function useCourseVideos(instrument: Instrument) {
  return useQuery({
    queryKey: ["course-videos", instrument],
    queryFn: async (): Promise<CourseVideo[]> => {
      const { data, error } = await (supabase as any)
        .from("course_videos")
        .select("*")
        .eq("instrument", instrument)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Sorted here rather than in the query: the admin's order is a column
      // added by migration, and ordering by it in SQL would break the whole
      // library until that migration lands. Newest-first is the tiebreak, so
      // an unmigrated database still reads exactly as it did before.
      return [...((data ?? []) as CourseVideo[])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      );
    },
  });
}

/**
 * Write a library's running order.
 *
 * Takes the list as it should now read and gives each row its position, but
 * only touches rows whose position actually changed — a move usually writes
 * two. Positions rather than a swap, because a fresh upload starts at 0 and
 * swapping two rows that share a rank would do nothing at all.
 */
export function useSetVideoOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { instrument: Instrument; ordered: CourseVideo[] }) => {
      const writes = args.ordered
        .map((v, i) => ({ id: v.id, sort_order: i + 1 }))
        .filter((row, i) => args.ordered[i].sort_order !== row.sort_order);
      for (const row of writes) {
        const { error } = await (supabase as any)
          .from("course_videos")
          .update({ sort_order: row.sort_order })
          .eq("id", row.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, args) =>
      qc.invalidateQueries({ queryKey: ["course-videos", args.instrument] }),
  });
}

/** Course-wide videos with no song attached (tuning, first lesson, theory…). */
export function useGeneralVideos(instrument: Instrument) {
  return useQuery({
    queryKey: ["general-videos", instrument],
    queryFn: async (): Promise<CourseVideo[]> => {
      const { data, error } = await (supabase as any)
        .from("course_videos")
        .select("*")
        .eq("instrument", instrument)
        .is("song_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CourseVideo[];
    },
  });
}

/** Videos an admin attached to one song — shown to students on the song page. */
export function useSongVideos(songId?: string) {
  return useQuery({
    queryKey: ["song-videos", songId],
    enabled: !!songId,
    queryFn: async (): Promise<CourseVideo[]> => {
      const { data, error } = await (supabase as any)
        .from("course_videos")
        .select("*")
        .eq("song_id", songId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CourseVideo[];
    },
  });
}

/**
 * PUT a file with real progress events. The Supabase SDK's upload() gives no
 * progress, which is unusable for the large files this bucket now accepts,
 * so we sign an upload URL (RLS still decides who may create one) and send
 * the bytes ourselves.
 */
function putWithProgress(
  url: string,
  file: File,
  opts: { contentType: string; onProgress?: (pct: number) => void; signal?: AbortSignal },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", opts.contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}). ${xhr.responseText?.slice(0, 200) ?? ""}`.trim()));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

export function useUploadCourseVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      instrument: Instrument;
      file: File;
      title: string;
      description?: string;
      song_id?: string | null;
      kind?: MediaKind;
      onProgress?: (pct: number) => void;
      signal?: AbortSignal;
    }) => {
      const safeName = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${args.instrument}/${crypto.randomUUID()}-${safeName}`;
      const contentType =
        args.file.type || (isAudioPath(args.file.name) ? "audio/mpeg" : "video/mp4");

      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);

      if (signErr || !signed?.signedUrl) {
        // Fall back to the plain SDK upload (no progress) rather than failing.
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, args.file, { contentType, upsert: false });
        if (upErr) throw upErr;
      } else {
        const url = signed.signedUrl.startsWith("http")
          ? signed.signedUrl
          : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${signed.signedUrl}`;
        try {
          await putWithProgress(url, args.file, { contentType, onProgress: args.onProgress, signal: args.signal });
        } catch (e) {
          // A cancelled or failed transfer can still leave a partial object.
          await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
          throw e;
        }
      }

      const { error: rowErr } = await (supabase as any).from("course_videos").insert({
        instrument: args.instrument,
        song_id: args.song_id || null,
        title: args.title,
        description: args.description?.trim() || null,
        storage_path: path,
        kind: args.kind ?? "lesson",
      });
      if (rowErr) {
        // Don't leave an orphaned file if the metadata write failed.
        await supabase.storage.from(BUCKET).remove([path]);
        throw rowErr;
      }
    },
    onSuccess: (_d, args) =>
      qc.invalidateQueries({ queryKey: ["course-videos", args.instrument] }),
  });
}

export function useUpdateCourseVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      instrument: Instrument;
      title: string;
      /** The caption shown over the clip wherever it plays. */
      description?: string | null;
    }) => {
      const patch: { title: string; description?: string | null } = { title: args.title.trim() };
      if (args.description !== undefined) {
        // Keep the line breaks, but normalise the ones Windows and some
        // editors paste in so they render as single breaks.
        const caption = args.description?.replace(/\r\n?/g, "\n").trim();
        patch.description = caption || null;
      }
      const { error } = await (supabase as any)
        .from("course_videos")
        .update(patch)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_d, args) =>
      qc.invalidateQueries({ queryKey: ["course-videos", args.instrument] }),
  });
}

export function useDeleteCourseVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (video: CourseVideo) => {
      const { error } = await (supabase as any).from("course_videos").delete().eq("id", video.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([video.storage_path]);
    },
    onSuccess: (_d, video) =>
      qc.invalidateQueries({ queryKey: ["course-videos", video.instrument] }),
  });
}
