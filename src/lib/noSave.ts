/**
 * Keeping the lessons and photos on the site.
 *
 * A browser offers several ways to walk off with what it is showing: a
 * "Download" entry in a video's own menu, "Save image as…" on a right-click,
 * dragging a picture to the desktop, a long press on a phone. These close
 * those doors.
 *
 * It is a deterrent, not a lock. Anything a screen can show can be recorded
 * or photographed, and someone determined can still pull a file out with a
 * browser's developer tools. What this stops is the casual, one-tap save.
 */

/** For every <video> and <audio>: no Download entry in the player's menu. */
export const noSaveMedia = { controlsList: "nodownload" } as const;

const SAVEABLE = new Set(["IMG", "VIDEO", "AUDIO", "IMAGE", "CANVAS"]);

/** Site-wide: no right-click menu on media, and no dragging pictures out. */
export function blockMediaSaving(doc: Document = document) {
  const onMedia = (e: Event) => {
    const el = e.target as Element | null;
    return !!el && SAVEABLE.has(el.tagName.toUpperCase());
  };
  doc.addEventListener("contextmenu", (e) => {
    if (onMedia(e)) e.preventDefault();
  });
  doc.addEventListener("dragstart", (e) => {
    if (onMedia(e)) e.preventDefault();
  });
}
