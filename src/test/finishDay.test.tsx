import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Finishing a day's practice.
 *
 * A session is three parts in the database and one thing to a student. The
 * last tick is what writes the practice log — the row the streak and the
 * teacher's roster both read — so all three have to land.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ supabase: { rpc, auth: {} } }));

import { useFinishDay } from "@/hooks/useWeeklyPlan";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => rpc.mockReset().mockResolvedValue({ error: null }));

describe("useFinishDay", () => {
  it("ticks all three parts, in order", async () => {
    const { result } = renderHook(() => useFinishDay(), { wrapper });

    await act(() => result.current.finish("sess1"));

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));
    expect(rpc.mock.calls.map((c: any[]) => c[1].p_segment)).toEqual([
      "warmup",
      "focus",
      "bonus",
    ]);
    expect(rpc.mock.calls.every((c: any[]) => c[1].p_session_id === "sess1")).toBe(true);
    expect(rpc.mock.calls[0][0]).toBe("complete_practice_segment");
  });

  it("stops on a failure rather than reporting a day that wasn't saved", async () => {
    rpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "nope" } });
    const { result } = renderHook(() => useFinishDay(), { wrapper });

    let thrown: unknown = null;
    await act(async () => {
      try {
        await result.current.finish("sess1");
      } catch (e) {
        thrown = e;
      }
    });

    expect(thrown).toBeTruthy();
    // The third is never sent: the caller shows the error and the student can
    // tap again, which is safe because each tick is idempotent.
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
