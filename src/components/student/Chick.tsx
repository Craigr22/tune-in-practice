import { useEffect, useRef, useState } from "react";
import { CHICK_EMOJI, CHICK_LABEL, type ChickStage } from "@/lib/chick";

/** Each stage's animation is fetched only when it is the one on screen. */
const ANIMATIONS: Record<ChickStage, () => Promise<{ default: unknown }>> = {
  egg: () => import("@/assets/chick/egg.json"),
  cracked: () => import("@/assets/chick/cracked.json"),
  hatching: () => import("@/assets/chick/hatching.json"),
  chick: () => import("@/assets/chick/chick.json"),
  graduate: () => import("@/assets/chick/graduate.json"),
};

/**
 * The part of each 512-square drawing that has anything in it. The art sits
 * small in the middle of its canvas; cropping to it is what lets a 40px chick
 * on the home page still read as a chick.
 */
const FRAME: Record<ChickStage, string> = {
  egg: "126 138 260 260",
  cracked: "126 138 260 260",
  hatching: "51 66 410 410",
  chick: "51 66 410 410",
  graduate: "51 66 410 410",
};

/**
 * The chick, animated.
 *
 * The player is loaded on demand so it costs nothing on pages without a
 * chick. Until it arrives — or if it never does — an emoji of the same stage
 * holds the space, so nothing jumps and nothing is ever blank. Anyone who has
 * asked their device for less motion gets the first frame, still.
 *
 * The files in assets/chick are the designer's pack with its shapes regrouped:
 * as delivered, every shape shared one list with the fills, which a Lottie
 * player reads as "paint everything the first colour, back to front".
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
          ANIMATIONS[stage](),
        ]);
        if (!live || !box.current) return;
        const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        anim = lottie.loadAnimation({
          container: box.current,
          renderer: "svg",
          loop: !still,
          autoplay: !still,
          animationData,
          rendererSettings: { viewBoxSize: FRAME[stage] },
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
  }, [stage]);

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
