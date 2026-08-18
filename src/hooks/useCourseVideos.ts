import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import type { Instrument } from "@/hooks/useSongCatalog";

export type CourseVideo = {
  id: string;
  instrument: Instrument;
  song_id: string | null;
  title: string;
  description: string | null;
  storage_path: string;
  created_at: string;
};

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

export function useUploadCourseVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      instrument: Instrument;
      file: File;
      title: string;
      description?: string;
      song_id?: string | null;
    }) => {
      const safeName = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${args.instrument}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, args.file, { contentType: args.file.type || "video/mp4", upsert: false });
      if (upErr) throw upErr;

      const { error: rowErr } = await (supabase as any).from("course_videos").insert({
        instrument: args.instrument,
        song_id: args.song_id || null,
        title: args.title,
        description: args.description?.trim() || null,
        storage_path: path,
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
