import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ClassPhotoImage } from "@/components/student/ClassPhoto";
import { photoFileName } from "@/lib/classPhoto";

/**
 * Looking at the class photo: all of it, full-screen, and out of the portal.
 */

const photo = { batchId: "b1", path: "b1/1.jpg", url: "https://files.test/photo.jpg", takenOn: "2026-09-06" };

const setShare = (can: boolean | undefined, share = vi.fn().mockResolvedValue(undefined)) => {
  Object.defineProperty(navigator, "canShare", { configurable: true, value: can === undefined ? undefined : () => can });
  Object.defineProperty(navigator, "share", { configurable: true, value: can === undefined ? undefined : share });
  return share;
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["jpeg"], { type: "image/jpeg" }) }),
  );
  (URL as any).createObjectURL = vi.fn(() => "blob:saved");
  (URL as any).revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the class photo", () => {
  it("is shown whole, not cropped to fill a box", () => {
    setShare(undefined);
    const { container } = render(<ClassPhotoImage photo={photo} />);
    const img = container.querySelector("img")!;

    // A landscape group shot keeps its own shape: cropping to fill cut the
    // back row's heads off.
    expect(img.style.objectFit).toBe("contain");
    expect(img.style.height).toBe("auto");
    expect(img.className).not.toMatch(/object-cover/);
  });

  it("opens full-screen when tapped, and closes again", () => {
    setShare(undefined);
    render(<ClassPhotoImage photo={photo} />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByLabelText(/open the class photo/i));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("zooms in when the open photo is tapped, and back out on the next tap", () => {
    setShare(undefined);
    render(<ClassPhotoImage photo={photo} />);
    fireEvent.click(screen.getByLabelText(/open the class photo/i));
    const big = screen.getByRole("dialog").querySelector("img")!;

    // Full-screen alone barely enlarges it on an upright phone — it was
    // already as wide as the screen.
    expect(big.style.maxWidth).toBe("100%");
    expect(screen.getByText(/tap the photo to zoom in/i)).toBeTruthy();

    fireEvent.click(big);
    expect(big.style.width).toBe("250%");
    expect(screen.getByText(/drag to move around/i)).toBeTruthy();
    // Zooming is not closing.
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(big);
    expect(big.style.width).toBe("");
    expect(big.style.maxWidth).toBe("100%");
  });

  it("offers no way to save it, and no link that would download it", async () => {
    setShare(undefined);
    render(<ClassPhotoImage photo={photo} />);
    fireEvent.click(screen.getByLabelText(/open the class photo/i));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText(/save/i)).toBeNull();
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("offers Share on a phone, handing the picture itself to the share sheet", async () => {
    const share = setShare(true);
    render(<ClassPhotoImage photo={photo} />);
    fireEvent.click(screen.getByLabelText(/open the class photo/i));

    const button = await screen.findByText(/^share$/i);
    fireEvent.click(button);

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const sent = share.mock.calls[0][0];
    // The file, not a link: the photo is private, and a link to it would be
    // dead within the hour for anyone it was sent to.
    expect(sent.files).toHaveLength(1);
    expect(sent.files[0].name).toBe("bam-class-2026-09-06.jpg");
    expect(sent.url).toBeUndefined();
  });

  it("leaves Share out where the device can't share a file", async () => {
    setShare(false);
    render(<ClassPhotoImage photo={photo} />);
    fireEvent.click(screen.getByLabelText(/open the class photo/i));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    // A button that can't work is worse than no button.
    expect(screen.queryByText(/^share$/i)).toBeNull();
  });
});

describe("photoFileName", () => {
  it("carries the day it was taken, or does without", () => {
    expect(photoFileName("2026-09-06")).toBe("bam-class-2026-09-06.jpg");
    expect(photoFileName(null)).toBe("bam-class.jpg");
  });
});
