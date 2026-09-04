// Students are children and mostly have no email address, so they sign in
// with a username. Supabase needs an email under every account, so a username
// maps to "<username>@students.bam.invalid" — .invalid is reserved by RFC 2606
// and can never receive mail. Nothing is ever sent there.
//
// Kept in one place because the sign-in page, the admin UI and the
// provision-user edge function must all agree on it.

export const STUDENT_EMAIL_DOMAIN = "students.bam.invalid";

/** What the user typed → the address to authenticate with. */
export function toLoginEmail(input: string): string {
  const v = input.trim();
  return v.includes("@") ? v : `${v.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
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
