import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { ClassPhoto as Photo } from "@/hooks/useClassPhoto";
import {
  canSharePhoto,
  fetchPhotoFile,
  hasSeenPhoto,
  markPhotoSeen,
  photoFileName,
  savePhoto,
  sharePhoto,
} from "@/lib/classPhoto";

const dayOf = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : null;

const SHARE_TEXT = "Day one with my class at BAM Academy of Music 🎶";

/**
 * The photo, whole.
 *
 * It used to be capped in height and cropped to fill, which for a landscape
 * group shot cuts off the top and bottom — the back row's heads. The picture
 * now keeps its own shape: a landscape phone photo runs the full width at its
 * natural height, and a portrait one is held to the screen with space either
 * side rather than being trimmed. Tapping it opens it full-screen.
 */
export function ClassPhotoImage({ photo }: { photo: Photo }) {
  const [open, setOpen] = useState(false);
  const taken = dayOf(photo.takenOn);
  return (
    <figure className="m-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the class photo"
        className="block w-full p-0 border-0 bg-transparent"
        style={{ cursor: "zoom-in" }}
      >
        <img
          src={photo.url}
          alt="Your class"
          className="block w-full rounded-xl"
          style={{
            height: "auto",
            maxHeight: "70vh",
            objectFit: "contain",
            background: "var(--paper-cool)",
            border: "1px solid var(--border)",
          }}
        />
      </button>
      {taken && (
        <figcaption className="mt-1.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>
          Day one · {taken} · tap to open
        </figcaption>
      )}
      {open && <ClassPhotoViewer photo={photo} onClose={() => setOpen(false)} />}
    </figure>
  );
}

/**
 * The photo full-screen, with a way to keep it and a way to pass it on.
 *
 * Sharing goes through the phone's own share sheet — the one route by which a
 * web page can put a picture into Instagram, a WhatsApp status or LinkedIn.
 * Where a device can't share files (most desktops), only Save is offered.
 *
 * The file is fetched as the viewer opens rather than on the tap: a share
 * has to follow the tap immediately, and a download in between loses it.
 */
function ClassPhotoViewer({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let live = true;
    fetchPhotoFile(photo.url, photoFileName(photo.takenOn))
      .then((f) => live && setFile(f))
      .catch(() => live && setFile(null));
    return () => {
      live = false;
    };
  }, [photo.url, photo.takenOn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shareable = !!file && canSharePhoto(file);

  const share = async () => {
    if (!file) return;
    try {
      await sharePhoto(file, SHARE_TEXT);
    } catch {
      toast.error("Couldn't open sharing — save the photo and share it from your gallery");
    }
  };

  const button = "rounded-full px-5 py-2.5 text-sm font-bold transition-transform active:scale-95 disabled:opacity-50";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Class photo"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "rgba(8,12,24,0.94)" }}
    >
      <div className="flex justify-end p-3">
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-10 h-10 rounded-full text-xl"
          style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
        >
          ×
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-2">
        <img
          src={photo.url}
          alt="Your class"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
        />
      </div>

      <div className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => file && savePhoto(file)}
            disabled={!file}
            className={button}
            style={{ background: "#fff", color: "#0b1530" }}
          >
            Save photo
          </button>
          {shareable && (
            <button onClick={share} className={button} style={{ background: "var(--blue-bright, #3b82f6)", color: "#fff" }}>
              Share
            </button>
          )}
        </div>
        <p className="mt-2.5 text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
          {shareable
            ? "Share opens Instagram, WhatsApp, LinkedIn and your other apps."
            : "On a phone, Share sends it to Instagram, WhatsApp or LinkedIn."}
        </p>
      </div>
    </div>,
    document.body,
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
      <ClassPhotoImage photo={photo} />
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
