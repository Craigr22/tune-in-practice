import { useState } from "react";
import { Link } from "react-router-dom";
import type { ClassPhoto as Photo } from "@/hooks/useClassPhoto";
import { hasSeenPhoto, markPhotoSeen } from "@/lib/classPhoto";

const dayOf = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : null;

/** The photo itself, with the day it was taken. */
export function ClassPhotoImage({ photo, maxHeight = 260 }: { photo: Photo; maxHeight?: number }) {
  const taken = dayOf(photo.takenOn);
  return (
    <figure className="m-0">
      <img
        src={photo.url}
        alt="Your class"
        className="w-full object-cover rounded-xl"
        style={{ maxHeight, border: "1px solid var(--border)" }}
      />
      {taken && (
        <figcaption className="mt-1.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>
          Day one · {taken}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * "Your class photo is in" — shown on the home page until it has been seen.
 *
 * The photo lives on Journey. This is only the moment it arrives: it appears
 * the first time a student opens the app after their teacher adds it, and
 * steps aside for good once they have looked.
 */
export function ClassPhotoArrived({ photo }: { photo: Photo }) {
  const [seen, setSeen] = useState(() => hasSeenPhoto(photo.path));
  if (seen) return null;
  const dismiss = () => {
    markPhotoSeen(photo.path);
    setSeen(true);
  };
  return (
    <section
      className="rounded-2xl p-4 mb-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>
          Your class photo is in 📸
        </div>
        <button onClick={dismiss} className="text-xs underline" style={{ color: "var(--ink-soft)" }}>
          Got it
        </button>
      </div>
      <ClassPhotoImage photo={photo} maxHeight={220} />
      <Link
        to="/student/journey"
        onClick={dismiss}
        className="inline-block mt-2 text-xs font-semibold"
        style={{ color: "var(--navy)" }}
      >
        It lives on your Journey →
      </Link>
    </section>
  );
}

/** A small round cut of the photo, for beside "Class today". */
export function ClassPhotoThumb({ photo }: { photo: Photo }) {
  return (
    <img
      src={photo.url}
      alt=""
      aria-hidden
      className="shrink-0 rounded-full object-cover"
      style={{ width: 44, height: 44, border: "2px solid var(--card)", boxShadow: "var(--shadow-sm)" }}
    />
  );
}
