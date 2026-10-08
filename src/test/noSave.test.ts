import { describe, expect, it } from "vitest";
import { blockMediaSaving, noSaveMedia } from "@/lib/noSave";

describe("blockMediaSaving", () => {
  const doc = document.implementation.createHTMLDocument("t");
  blockMediaSaving(doc);
  const fire = (tag: string, type: string) => {
    const el = doc.createElement(tag);
    doc.body.appendChild(el);
    const ev = new Event(type, { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };

  it("takes the right-click menu off pictures, videos and audio", () => {
    expect(fire("img", "contextmenu")).toBe(true);
    expect(fire("video", "contextmenu")).toBe(true);
    expect(fire("audio", "contextmenu")).toBe(true);
  });

  it("stops a picture being dragged out of the page", () => {
    expect(fire("img", "dragstart")).toBe(true);
  });

  it("leaves everything else alone", () => {
    expect(fire("p", "contextmenu")).toBe(false);
    expect(fire("input", "contextmenu")).toBe(false);
    expect(fire("a", "dragstart")).toBe(false);
  });

  it("asks players to drop their Download entry", () => {
    expect(noSaveMedia.controlsList).toContain("nodownload");
  });
});
