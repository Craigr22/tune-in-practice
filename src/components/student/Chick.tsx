import { useEffect, useRef, useState } from "react";
import { CHICK_EMOJI, CHICK_LABEL, type ChickStage } from "@/lib/chick";

type Loader = () => Promise<{ default: unknown }>;

/**
 * Two sets of the same five characters. Each is a shaded picture that sways,
 * so its weight is the picture: the large set is drawn for the Journey
 * header, the small one is the same art at icon size — a tenth of the
 * download, and framed to fill a 40px slot. Each is fetched only when it is
 * the one on screen.
 */
const LARGE: Record<ChickStage, Loader> = {
  egg: () => import("@/assets/chick/egg.json"),
  cracked: () => import("@/assets/chick/cracked.json"),
  hatching: () => import("@/assets/chick/hatching.json"),
  chick: () => import("@/assets/chick/chick.json"),
  graduate: () => import("@/assets/chick/graduate.json"),
};
const SMALL: Record<ChickStage, Loader> = {
  egg: () => import("@/assets/chick/home/egg.json"),
  cracked: () => import("@/assets/chick/home/cracked.json"),
  hatching: () => import("@/assets/chick/home/hatching.json"),
  chick: () => import("@/assets/chick/home/chick.json"),
  graduate: () => import("@/assets/chick/home/graduate.json"),
};

/** Above this many pixels the icon-sized art starts to look soft. */
const SMALL_UP_TO = 64;

/**
 * The chick, animated.
 *
 * The player is loaded on demand so it costs nothing on pages without a
 * chick. Until it arrives — or if it never does — an emoji of the same stage
 * holds the space, so nothing jumps and nothing is ever blank. Anyone who has
 * asked their device for less motion gets the first frame, still.
 *
 * The large files are the designer's with one change: each came carrying the
 * whole five-character sheet and hiding four of them, so each has been cut
 * down to the one character it shows.
 */
export default function Chick({ stage, size = 96 }: { stage: ChickStage; size?: number }) {
  const box = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    let anim: { destroy: () => void } | null = null;
    setReady(false);
    (async () => {
      try {
        const [{ default: lottie }, { default: animationData }] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          (size <= SMALL_UP_TO ? SMALL : LARGE)[stage](),
        ]);
        if (!live || !box.current) return;
        const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        anim = lottie.loadAnimation({
          container: box.current,
          renderer: "svg",
          loop: !still,
          autoplay: !still,
          animationData,
        });
        setReady(true);
      } catch {
        /* the emoji stays */
      }
    })();
    return () => {
      live = false;
      anim?.destroy();
    };
  }, [stage, size]);

  return (
    <span
      role="img"
      aria-label={CHICK_LABEL[stage]}
      data-chick={stage}
      className="relative inline-block shrink-0 align-middle"
      style={{ width: size, height: size }}
    >
      {!ready && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center leading-none"
          style={{ fontSize: size * 0.6 }}
        >
          {CHICK_EMOJI[stage]}
        </span>
      )}
      <span ref={box} aria-hidden className="absolute inset-0" />
    </span>
  );
}
