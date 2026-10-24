/**
 * The reason a server function gave for failing, in its own words.
 *
 * When a function answers with an error status, the client library reports
 * only "Edge Function returned a non-2xx status code" and tucks the actual
 * answer (`{ error: "..." }`) inside the raw response. Read it from there so
 * the admin sees, say, "This person already has a login".
 */
export async function functionErrorMessage(error: unknown, data?: unknown): Promise<string | null> {
  const fromData = (data as { error?: unknown } | null | undefined)?.error;
  if (!error) return typeof fromData === "string" ? fromData : null;

  const context = (error as { context?: unknown }).context;
  if (context && typeof (context as Response).clone === "function") {
    try {
      const body = await (context as Response).clone().json();
      if (body && typeof body.error === "string" && body.error) return body.error;
    } catch {
      /* not JSON — fall through */
    }
  }
  if (typeof fromData === "string" && fromData) return fromData;
  return (error as { message?: string }).message ?? "Something went wrong";
}
