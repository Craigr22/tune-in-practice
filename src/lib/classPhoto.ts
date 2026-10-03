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
  // "from-image": a phone stores a landscape shot as sideways sensor data plus
  // a note saying which way up it goes. Without honouring that note the class
  // would be uploaded lying on its side.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
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

/* ---------------- keeping and sharing ---------------- */

/** "bam-class-2026-09-06.jpg" — a name that still means something in a camera roll. */
export function photoFileName(takenOn: string | null) {
  return `bam-class${takenOn ? `-${takenOn}` : ""}.jpg`;
}

/** The picture as a file, which is what saving and sharing both need. */
export async function fetchPhotoFile(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load the photo");
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

/**
 * Whether this device can hand the picture to other apps.
 *
 * A web page can't post an image to Instagram, WhatsApp Status or LinkedIn
 * itself — their web links take text or a public address, never a file, and
 * this file is private. What does work is the phone's own share sheet, which
 * lists all three. Desktop browsers mostly can't share files, so there the
 * button is left out rather than shown and broken.
 */
export function canSharePhoto(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function sharePhoto(file: File, text: string): Promise<void> {
  try {
    await navigator.share({ files: [file], title: "BAM Academy of Music", text });
  } catch (e) {
    // Closing the share sheet without choosing isn't a failure.
    if ((e as Error)?.name !== "AbortError") throw e;
  }
}

/** Save the picture to the device. */
export function savePhoto(file: File) {
  const href = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = href;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

