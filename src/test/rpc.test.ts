import { describe, it, expect } from "vitest";
import { isMissingFunction, rpcError } from "@/lib/rpc";

/**
 * These workflows now run as database functions so they land whole. Those
 * functions arrive by migration, so a deploy can briefly run ahead of one —
 * and the failure a teacher sees then should say so, not quote Postgres.
 */
describe("rpc error handling", () => {
  // Verbatim from PostgREST against the live database before the migration.
  const missing = {
    message:
      "Could not find the function public.end_class(p_batch_id, p_scheduled_date) in the schema cache",
    code: "PGRST202",
  };

  it("recognises a function that hasn't been migrated in", () => {
    expect(isMissingFunction(missing)).toBe(true);
    expect(isMissingFunction({ message: "function public.set_user_role does not exist" })).toBe(true);
  });

  it("does not mistake a real failure for a missing one", () => {
    expect(isMissingFunction({ message: "Not your class" })).toBe(false);
    expect(isMissingFunction({ message: "Cannot remove the only admin" })).toBe(false);
    expect(isMissingFunction(null)).toBe(false);
  });

  it("says nothing was changed, which is the point of a transaction", () => {
    const e = rpcError(missing, "Ending the class");
    expect(e.message).toMatch(/Ending the class/);
    expect(e.message).toMatch(/nothing was changed/i);
    expect(e.message).not.toMatch(/schema cache/);
  });

  it("passes a real error through untouched", () => {
    expect(rpcError({ message: "Cannot remove the only admin" }, "Changing the role").message)
      .toBe("Cannot remove the only admin");
  });
});
