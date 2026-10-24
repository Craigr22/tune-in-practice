import { describe, it, expect } from "vitest";
import { functionErrorMessage } from "@/lib/functionError";

const httpError = (status: number, body: unknown) => ({
  message: "Edge Function returned a non-2xx status code",
  context: new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
});

describe("the reason a server function failed", () => {
  it("shows the server's own words, not the generic status message", async () => {
    const msg = await functionErrorMessage(httpError(400, { error: "This person already has a login" }));
    expect(msg).toBe("This person already has a login");
  });

  it("falls back to the generic message when the answer carries no reason", async () => {
    const msg = await functionErrorMessage({ message: "Failed to fetch" });
    expect(msg).toBe("Failed to fetch");
  });

  it("is nothing when the call worked", async () => {
    expect(await functionErrorMessage(null, { ok: true })).toBeNull();
  });
});
