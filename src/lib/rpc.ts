/**
 * A workflow that must land whole runs as a database function, so the whole
 * thing commits or none of it does. Those functions arrive by migration, and
 * a deploy that gets ahead of one would otherwise surface Postgres' own
 * wording — "function public.end_class(...) does not exist" — to a teacher
 * halfway through ending a class.
 */
const MISSING = /does not exist|could not find the function|PGRST202/i;

export function isMissingFunction(error: unknown): boolean {
  const e = error as { message?: string; code?: string } | null;
  return !!e && (MISSING.test(e.message ?? "") || e.code === "PGRST202");
}

/** Turns a missing-function failure into something worth reading. */
export function rpcError(error: unknown, action: string): Error {
  const message = (error as { message?: string })?.message ?? "Something went wrong";
  return new Error(
    isMissingFunction(error)
      ? `${action} needs a database update that hasn't been applied yet. Nothing was changed.`
      : message,
  );
}
