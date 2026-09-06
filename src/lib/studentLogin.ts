// Students are children and mostly have no email address, so they sign in
// with a username. Supabase needs an email under every account, so a username
// maps to "<username>@students.bam.invalid" — .invalid is reserved by RFC 2606
// and can never receive mail. Nothing is ever sent there.
//
// Kept in one place because the sign-in page, the admin UI and the
// provision-user edge function must all agree on it.

export const STUDENT_EMAIL_DOMAIN = "students.bam.invalid";

/**
 * A person's name → the username provisioning makes from it.
 *
 * Must match the rule in supabase/functions/provision-user: lower case,
 * accents dropped, anything that isn't a letter or digit becomes a dot. Kept
 * identical so that a student typing their own name — "Payal Malviya", which
 * is what a child will try first — lands on the username they were given.
 */
export function toUsername(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
}

/**
 * The addresses to try for what someone typed, in the order to try them.
 *
 * There is more than one, because a student is often handed the wrong thing.
 * Their record carries an email column that has nothing to do with signing in,
 * and it has been given out in place of the username — so an address that
 * fails is worth one more attempt as a username before giving up. Both
 * attempts use the password the same person just typed for their own account.
 */
export function loginCandidates(input: string): string[] {
  const v = input.trim();
  if (!v) return [];
  const at = v.indexOf("@");
  if (at < 1) {
    const username = toUsername(v);
    return username ? [`${username}@${STUDENT_EMAIL_DOMAIN}`] : [];
  }
  const out = [v.toLowerCase()];
  const asUsername = toUsername(v.slice(0, at));
  if (asUsername) {
    const fallback = `${asUsername}@${STUDENT_EMAIL_DOMAIN}`;
    if (fallback !== out[0]) out.push(fallback);
  }
  return out;
}

/** What the user typed → the address to authenticate with first. */
export function toLoginEmail(input: string): string {
  return loginCandidates(input)[0] ?? input.trim();
}

/** True for the synthetic addresses, so the UI can show the username instead. */
export function isStudentLoginEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${STUDENT_EMAIL_DOMAIN}`);
}

/** A short password that's easy to read out to a child. */
export function suggestPassword(): string {
  const words = ["uku", "strum", "chord", "tune", "song", "beat"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
}
