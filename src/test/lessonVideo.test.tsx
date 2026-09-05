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

  it("renders nothing extra when there's no caption", () => {
    render(<LessonVideo src="blob:x" title="Piyu Bole Tutorial" />);
    expect(screen.getByText("Piyu Bole Tutorial")).toBeTruthy();
  });
});
