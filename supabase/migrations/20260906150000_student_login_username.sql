-- =============== USERNAME LOGINS FOR STUDENTS ===============
-- Children mostly have no email address, so they sign in with a username and
-- password instead. Supabase requires an email underneath every account, so
-- each username is stored as "<username>@students.bam.invalid" — .invalid is
-- reserved by RFC 2606 and can never receive mail, which is the point.
--
-- This column holds the username so admins can see it and the sign-in page
-- can turn what a student types into the address behind it.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS login_username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS students_login_username_key
  ON public.students (login_username)
  WHERE login_username IS NOT NULL;

COMMENT ON COLUMN public.students.login_username IS
  'Username a student signs in with; the auth account uses <username>@students.bam.invalid.';
