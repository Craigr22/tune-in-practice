import { useSongVideos, useSignedVideoUrls } from "@/hooks/useCourseVideos";

/**
 * Teacher-uploaded clips for this song. Renders nothing when there are none,
 * so the practice page stays uncluttered. Videos are private — the src is a
 * short-lived signed URL minted for the signed-in student.
 */
export default function SongVideos({ songId, inset = true }: { songId: string; inset?: boolean }) {
  const { data: videos = [] } = useSongVideos(songId);
  const { data: urls = {} } = useSignedVideoUrls(videos.map((v) => v.storage_path));

  if (!videos.length) return null;

  return (
    <div style={{ padding: inset ? "12px 16px 0" : "12px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
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
          {urls[v.storage_path] ? (
            <video
              controls
              preload="none"
              playsInline
              src={urls[v.storage_path]}
              style={{ width: "100%", borderRadius: 12, background: "#000" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                borderRadius: 12,
                background: "rgba(0,0,0,0.8)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 13,
              }}
            >
              Loading video…
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{v.title}</div>
          {v.description && (
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{v.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}
