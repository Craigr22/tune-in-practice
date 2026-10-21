// Records "this person opened the app" (user_profiles.last_seen_at).
//
// A database call from the client is lazy: building it sends nothing until
// something awaits it or calls .then(). The old `void supabase.rpc(...)`
// therefore never left the browser, and last_seen_at stayed empty for
// everyone. This always calls .then().
//
// Students keep the app open on their phone for days, so a single mark on
// load would also miss most visits — it is marked again when the app comes
// back to the screen, at most once per MIN_GAP_MS.

export const MIN_GAP_MS = 10 * 60 * 1000;

type Rpc = (fn: "mark_app_open") => PromiseLike<unknown>;

export function createAppOpenMarker(rpc: Rpc, now: () => number = Date.now) {
  let last = -Infinity;
  return function markAppOpen(force = false): boolean {
    const t = now();
    if (!force && t - last < MIN_GAP_MS) return false;
    last = t;
    // Best-effort: activity tracking must never break sign-in.
    rpc("mark_app_open").then(undefined, () => { last = -Infinity; });
    return true;
  };
}
