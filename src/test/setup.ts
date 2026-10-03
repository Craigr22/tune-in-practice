import { vi } from "vitest";
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// The chick's animation player draws to a canvas while loading, which jsdom
// doesn't have. Tests get the emoji that stands in for it instead.
vi.mock("lottie-web/build/player/lottie_light", () => ({
  default: { loadAnimation: () => ({ destroy: () => {} }) },
}));
