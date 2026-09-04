import { useState } from "react";

/**
 * A lesson clip.
 *
 * Two things used to make these read as broken: while the signed URL was
 * being minted there was a black rectangle, and once it arrived the player
 * stayed black because `preload="none"` never fetches a frame to show.
 *
 * So: a soft shimmering placeholder covers the player until it can paint,
 * and the source carries a `#t=0.1` media fragment, which asks the browser
 * to seek just past the start — enough that the first frame of the video
 * stands in as its own thumbnail. Only metadata is preloaded, so this
 * costs a fraction of the file rather than the whole clip.
 */
export default function LessonVideo({
  src,
  radius = 14,
  maxHeight,
}: {
  /** Signed URL, or undefined while it's still being minted. */
  src?: string;
  radius?: number;
  maxHeight?: number;
}) {
  const [ready, setReady] = useState(false);
  const showPlaceholder = !src || !ready;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: radius,
        overflow: "hidden",
        background: "var(--paper-cool)",
        // Hold the space before the video knows its own shape, so the page
        // doesn't jump when it loads.
        aspectRatio: showPlaceholder ? "16 / 9" : undefined,
        maxHeight,
      }}
    >
      {src && (
        <video
          controls
          preload="metadata"
          playsInline
          src={`${src}#t=0.1`}
          onLoadedData={() => setReady(true)}
          onError={() => setReady(true)}
          style={{
            display: "block",
            width: "100%",
            maxHeight,
            borderRadius: radius,
            background: "var(--paper-cool)",
          }}
        />
      )}

      {showPlaceholder && (
        <div
          className="video-skeleton"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: radius,
          }}
        >
          <div
            className="bounce-soft"
            style={{ fontSize: 22, opacity: 0.55 }}
            aria-hidden
          >
            🎬
          </div>
          <span className="sr-only">Loading video</span>
        </div>
      )}
    </div>
  );
}
