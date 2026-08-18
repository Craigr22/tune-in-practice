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

export function videoPublicUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
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
