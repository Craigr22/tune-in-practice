import { useMemo } from "react";
import { useSongVideos, useSignedVideoUrls, type CourseVideo } from "@/hooks/useCourseVideos";
import LessonVideo from "@/components/student/LessonVideo";

/**
 * A song's two clips: the backing track to play along to, then the tutorial
 * that teaches it — in that order, because a student opening a song they
 * already know wants to play, not to be taught again.
 *
 * A song can have several of each (slow and normal play-alongs, a tutorial
 * and a completed version). Showing them all made the panel a wall of
 * players, so this takes the first of each in the admin's own order.
 */
function pickTwo(videos: CourseVideo[]): CourseVideo[] {
  const first = (kind: CourseVideo["kind"]) =>
    videos.filter((v) => v.kind === kind).sort((a, b) => a.sort_order - b.sort_order)[0];
  return [first("track"), first("lesson")].filter(Boolean) as CourseVideo[];
}

export default function SongVideos({ songId, inset = true }: { songId: string; inset?: boolean }) {
  const { data: all = [] } = useSongVideos(songId);
  const videos = useMemo(() => pickTwo(all), [all]);
  const { data: urls = {} } = useSignedVideoUrls(videos.map((v) => v.storage_path));

  if (!videos.length) return null;

  return (
    <div style={{ padding: inset ? "12px 16px 0" : "12px 0 0", display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink-soft)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        📺 Watch & learn
      </div>
      {videos.map((v) => (
        <div key={v.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <LessonVideo src={urls[v.storage_path]} path={v.storage_path} title={v.title} radius={12} />
        </div>
      ))}
    </div>
  );
}
