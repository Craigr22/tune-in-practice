import { describe, it, expect } from "vitest";
import { videoKind } from "@/lib/videoKind";

/** Titles taken verbatim from the uploaded library. */
describe("videoKind", () => {
  it("reads tutorials as lessons", () => {
    for (const t of [
      "Piyu Bole Tutorial",
      "Photograph Tutorial",
      "You are my Sunshine",
      "Completed: You are my Sunshine",
      "Tuning the Ukulele",
      "Your First Lesson",
      "Kho Gaye Hum Kahan Tutorial",
    ]) expect(videoKind(t)).toBe("lesson");
  });

  it("reads play-alongs and tempo tracks as backing tracks", () => {
    for (const t of [
      "Piyu Bole Slow",
      "Piyu Bole Playalong normal",
      "Photograph slow playalong",
      "Photograph normal playalong",
      "You are my Sunshine CF Slow",
      "You are my sunshine cfg slow",
      "Im yours normal playalong",
      "kho gaye slow strumming",
      "Kho Gaye Normal Plucking",
      "Kho gaye slow picking",
      "Rainbow normal playalong",
      "Sham normal playalong",
      "50 bpm",
      "70 bpm",
    ]) expect(videoKind(t)).toBe("track");
  });

  it("reads numbered drills as exercises", () => {
    for (const t of [
      "1. Technical C",
      "2. Technical C and G",
      "3. Technical cfag",
      "4. arpegios chord clarity",
      "9. techincal e minor",
    ]) expect(videoKind(t)).toBe("exercise");
  });

  it("treats a numbered drill as an exercise even when it names a technique", () => {
    // "5. Strumming Im yours" would otherwise read as a backing track.
    expect(videoKind("5. Strumming Im yours")).toBe("exercise");
  });
});
