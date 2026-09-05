import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LessonVideo from "@/components/student/LessonVideo";

afterEach(cleanup);

describe("LessonVideo caption", () => {
  const multiline = "Watch the left hand.\nKeep the strum steady.\n\nSlow it down if it slips.";

  it("keeps the line breaks an admin pasted in", () => {
    render(<LessonVideo src="blob:x" title="Piyu Bole Tutorial" caption={multiline} />);

    const el = screen.getByText(/Watch the left hand/);
    // The text is one node, breaks intact — not collapsed into a paragraph.
    expect(el.textContent).toBe(multiline);
    expect(el).toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  it("shows the title and caption above the player", () => {
    const { container } = render(
      <LessonVideo src="blob:x" title="Piyu Bole Tutorial" caption="Watch the left hand." />,
    );
    const video = container.querySelector("video")!;
    const caption = screen.getByText("Watch the left hand.");
    // Node order: caption precedes the video in the document.
    expect(caption.compareDocumentPosition(video) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("plays an mp3 backing track as audio, not as a blank video", () => {
    const { container } = render(
      <LessonVideo src="blob:x" path="ukulele/abc-piyu-bole.mp3" title="Piyu Bole Slow" />,
    );
    expect(container.querySelector("audio")).toBeTruthy();
    expect(container.querySelector("video")).toBeNull();
    // No thumbnail shimmer either — there is no picture to wait for.
    expect(container.querySelector(".video-skeleton")).toBeNull();
  });

  it("still renders a video file as video", () => {
    const { container } = render(
      <LessonVideo src="blob:x" path="ukulele/abc-tutorial.mp4" title="Piyu Bole Tutorial" />,
    );
    expect(container.querySelector("video")).toBeTruthy();
    expect(container.querySelector("audio")).toBeNull();
  });

  it("renders nothing extra when there's no caption", () => {
    render(<LessonVideo src="blob:x" title="Piyu Bole Tutorial" />);
    expect(screen.getByText("Piyu Bole Tutorial")).toBeTruthy();
  });
});
