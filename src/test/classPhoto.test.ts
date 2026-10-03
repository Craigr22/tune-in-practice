import { describe, it, expect } from "vitest";
import { classPhotoPath, fitWithin } from "@/lib/classPhoto";

/**
 * The class photo's plumbing: how big it's allowed to be, and where it's kept.
 */
describe("fitWithin", () => {
  it("brings a phone camera's picture down to size, keeping its shape", () => {
    // 12 megapixels, landscape.
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    // And portrait: the long edge is the one that's capped.
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a picture that is already small", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900)).toEqual({ width: 1600, height: 900 });
  });
});

describe("classPhotoPath", () => {
  it("files the photo under its class, which is what decides who may see it", () => {
    const batch = "168a8bde-d5c9-40f0-8d22-ef9f603bcd17";
    expect(classPhotoPath(batch, 1700000000000)).toBe(`${batch}/1700000000000.jpg`);
  });

  it("gives a replacement its own name, so an old link can't show the new picture", () => {
    expect(classPhotoPath("b", 1)).not.toBe(classPhotoPath("b", 2));
  });
});
