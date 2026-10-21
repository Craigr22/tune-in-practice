import { describe, it, expect, vi } from "vitest";
import { createAppOpenMarker, MIN_GAP_MS } from "@/lib/appOpen";

/** Is "last opened" actually sent, and not on every tap? */
describe("createAppOpenMarker", () => {
  const setup = () => {
    let t = 1_000_000;
    const then = vi.fn();
    const rpc = vi.fn(() => ({ then }));
    const mark = createAppOpenMarker(rpc as any, () => t);
    return { rpc, then, mark, advance: (ms: number) => { t += ms; } };
  };

  it("actually sends the call, not just builds it", () => {
    const { rpc, then, mark } = setup();
    mark(true);
    expect(rpc).toHaveBeenCalledWith("mark_app_open");
    expect(then).toHaveBeenCalledTimes(1);
  });

  it("sends once per 10 minutes when the app keeps coming back", () => {
    const { rpc, mark, advance } = setup();
    mark(true);
    advance(MIN_GAP_MS - 1);
    expect(mark()).toBe(false);
    advance(1);
    expect(mark()).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("always sends on sign-in or load", () => {
    const { rpc, mark } = setup();
    mark(true);
    mark(true);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
