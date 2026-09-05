import { useMemo } from "react";
import { useSongVideos, useSignedVideoUrls, isAudioPath, type CourseVideo } from "@/hooks/useCourseVideos";
import LessonVideo from "@/components/student/LessonVideo";
import PlayAlong, { type PlayAlongSection } from "@/components/student/PlayAlong";

/**
 * What a song gives a student: one video to learn from, and a backing track
 * to play along to.
 *
 * A song can carry several of each — slow and normal play-alongs, a tutorial
 * and a completed version — and listing them all made this a wall of players.
 * The first of each kind in the admin's order is the one that shows.
 */
function pick(videos: CourseVideo[]) {
  const byOrder = (a: CourseVideo, b: CourseVideo) => a.sort_order - b.sort_order;
  const tracks = videos.filter((v) => v.kind === "track").sort(byOrder);
  return {
    lesson: videos.filter((v) => v.kind === "lesson").sort(byOrder)[0],
    // The play-along wants sound, not picture — prefer an mp3 where there is
    // one, and fall back to whatever backing track exists.
    track: tracks.find((v) => isAudioPath(v.storage_path)) ?? tracks[0],
  };
}

export default function SongVideos({
  songId,
  inset = true,
  bpm,
  sections,
  strum,
}: {
  songId: string;
  inset?: boolean;
  bpm?: number;
  sections?: PlayAlongSection[];
  strum?: string;
}) {
  const { data: all = [] } = useSongVideos(songId);
  const { lesson, track } = useMemo(() => pick(all), [all]);
  const paths = useMemo(
    () => [lesson, track].filter(Boolean).map((v) => (v as CourseVideo).storage_path),
    [lesson, track],
  );
  const { data: urls = {} } = useSignedVideoUrls(paths);

  if (!lesson && !track) return null;

  return (
    <div style={{ padding: inset ? "12px 16px 0" : "12px 0 0", display: "flex", flexDirection: "column", gap: 16 }}>
      {track && (
        <PlayAlong
          src={urls[track.storage_path]}
          title={track.title}
          bpm={bpm}
          sections={sections}
          strum={strum}
        />
      )}

      {lesson && (
        <LessonVideo
          src={urls[lesson.storage_path]}
          path={lesson.storage_path}
          title={lesson.title}
          radius={12}
        />
      )}
    </div>
  );
}
