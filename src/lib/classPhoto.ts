/**
 * The class photo: the parts that need no database.
 */

export const CLASS_PHOTO_MAX_EDGE = 1600;

/**
 * The size to shrink a picture to, keeping its shape.
 *
 * A phone camera hands over twelve megapixels — eight megabytes for something
 * shown a few hundred pixels wide to students on mobile data. The longest edge
 * comes down to `max`; a picture already smaller is left as it is, never
 * enlarged.
 */
export function fitWithin(width: number, height: number, max = CLASS_PHOTO_MAX_EDGE) {
  const longest = Math.max(width, height);
  if (!longest || longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Where a class's photo is kept: under the class's own id, which is what protects it. */
export function classPhotoPath(batchId: string, now = Date.now()) {
  return `${batchId}/${now}.jpg`;
}

/** Shrink an image file to a JPEG no longer than CLASS_PHOTO_MAX_EDGE on its long side. */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't resize the picture");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare the picture"))), "image/jpeg", 0.85),
  );
}

const SEEN_PREFIX = "bam.classPhotoSeen:";

/**
 * Whether this student has already been shown that a photo arrived.
 *
 * Kept in the browser: it is only a convenience — worst case, on a new phone,
 * they are told once more about a photo of their own class.
 */
export function hasSeenPhoto(path: string): boolean {
  try {
    return window.localStorage.getItem(SEEN_PREFIX + path) === "1";
  } catch {
    return true; // storage blocked: don't nag on every visit
  }
}

export function markPhotoSeen(path: string) {
  try {
    window.localStorage.setItem(SEEN_PREFIX + path, "1");
  } catch {
    /* private mode */
  }
}
