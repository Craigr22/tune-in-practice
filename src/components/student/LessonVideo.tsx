import { useRef, useState } from "react";
import { isAudioPath } from "@/hooks/useCourseVideos";

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
  path,
  title,
  above,
  below,
  radius = 14,
  maxHeight,
}: {
  /** Signed URL, or undefined while it's still being minted. */
  src?: string;
  /** Storage path — says whether this is sound or picture. */
  path?: string;
  /** The clip's name. */
  title?: string | null;
  /** What a student reads before the clip, set per day in the course plan. */
  above?: string | null;
  /** And after it. */
  below?: string | null;
  radius?: number;
  maxHeight?: number;
}) {
  const [ready, setReady] = useState(false);
  // A clip that won't load has to say so. Clearing the placeholder on error
  // left a black rectangle with no controls and no explanation — which reads
  // as the app being broken rather than one file failing.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  // An mp3 backing track has no picture: it needs a player, not a thumbnail.
  const isAudio = !!path && isAudioPath(path);
  const showPlaceholder = !isAudio && (!src || !ready);

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
      {(title || above) && (
        <div className="mb-3 mt-1.5">
          {title && (
            <div
              className="text-base font-bold leading-snug tracking-tight"
              style={{ color: "var(--blue-deep)" }}
            >
              {title}
            </div>
          )}
          {above && <Note text={above} className="mt-2.5 mb-4" />}
        </div>
      )}

      {isAudio ? (
        <div
          className="rounded-xl px-3 py-3"
          style={{ background: "var(--paper-cool)", border: "1px solid var(--border)" }}
        >
          {src ? (
            <audio src={src} controls preload="metadata" style={{ width: "100%" }} />
          ) : (
            <div className="text-xs py-2 text-center" style={{ color: "var(--ink-soft)" }}>
              Loading track…
            </div>
          )}
        </div>
      ) : (
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
            onError={() => { setFailed(true); setReady(true); }}
            style={{
              display: "block",
              width: "100%",
              maxHeight,
              borderRadius: radius,
              background: "var(--paper-cool)",
            }}
          />
        )}

        {failed && (
          <div
            className="absolute inset-0 grid place-items-center rounded-xl px-4 text-center"
            style={{ background: "var(--paper-cool)", borderRadius: radius }}
          >
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                This video wouldn't load
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                Often a slow connection — it's a large file.
              </div>
              <button
                onClick={() => { setFailed(false); setReady(false); setAttempt((n) => n + 1); }}
                className="mt-3 rounded-full px-4 py-1.5 text-xs font-bold"
                style={{ background: "var(--navy)", color: "#fff" }}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!failed && showPlaceholder && (
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
      )}

      {below && <Note text={below} className="mt-4" />}
    </div>
  );
}

/**
 * A line of the teacher's writing around a clip. Black text on a tinted panel
 * with a blue rule — the note is the thing to read, so the colour stays on the
 * edge, and line breaks are kept exactly as they were typed.
 */
function Note({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div
      className={`text-sm leading-relaxed rounded-xl px-4 py-3.5 ${className}`}
      style={{
        color: "var(--ink)",
        background: "var(--paper-cool)",
        borderLeft: "3px solid var(--blue-bright)",
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
}
