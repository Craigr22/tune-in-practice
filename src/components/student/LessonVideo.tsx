import { useRef, useState } from "react";

/**
 * A lesson clip: what it is, what to watch for, then the picture.
 *
 * The heading lives here rather than at each call site so a clip looks the
 * same wherever it appears — today's practice, the day being looked at, and
 * the song panel in Journey.
 *
 * Two things used to make the player itself read as broken: while the signed
 * URL was being minted there was a black rectangle, and once it arrived the
 * player stayed black because nothing had fetched a frame to show. So a soft
 * shimmering placeholder covers it until it can paint, and the first frame of
 * the clip stands in as its own thumbnail.
 */
export default function LessonVideo({
  src,
  title,
  caption,
  radius = 14,
  maxHeight,
}: {
  /** Signed URL, or undefined while it's still being minted. */
  src?: string;
  /** The clip's name. */
  title?: string | null;
  /** What to watch for, set per clip by an admin in Course Work → Videos. */
  caption?: string | null;
  radius?: number;
  maxHeight?: number;
}) {
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const showPlaceholder = !src || !ready;

  /**
   * Metadata alone doesn't paint anything — the browser knows the clip's shape
   * but has fetched no pictures, so the player stays blank. Seeking a hair past
   * the start makes it fetch and decode exactly one frame, which is a byte
   * range rather than the file, so this buffers a little and no more.
   */
  const primeFirstFrame = () => {
    const v = ref.current;
    if (!v || v.readyState >= 2) return;
    try {
      v.currentTime = 0.1;
    } catch {
      // Not seekable yet; onLoadedData still clears the placeholder.
    }
  };

  return (
    <div>
      {(title || caption) && (
        <div className="mb-3 mt-1.5">
          {title && (
            <div
              className="text-base font-bold leading-snug tracking-tight"
              style={{ color: "var(--blue-deep)" }}
            >
              {title}
            </div>
          )}
          {caption && (
            // Black text on the tinted panel — the note is the thing to read,
            // so the blue stays on the rule and the title around it.
            <div
              className="text-sm leading-relaxed mt-2.5 mb-4 rounded-xl px-4 py-3.5"
              style={{
                color: "var(--ink)",
                background: "var(--paper-cool)",
                // Keep the line breaks an admin typed or pasted in.
                whiteSpace: "pre-wrap",
                borderLeft: "3px solid var(--blue-bright)",
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
              }}
            >
              {caption}
            </div>
          )}
        </div>
      )}

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
            ref={ref}
            controls
            preload="metadata"
            playsInline
            src={`${src}#t=0.1`}
            onLoadedMetadata={primeFirstFrame}
            onLoadedData={() => setReady(true)}
            onSeeked={() => setReady(true)}
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
            <div className="bounce-soft" style={{ fontSize: 22, opacity: 0.55 }} aria-hidden>
              🎬
            </div>
            <span className="sr-only">Loading video</span>
          </div>
        )}
      </div>
    </div>
  );
}
