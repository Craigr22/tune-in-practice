-- =============== PROFILES FOR ACCOUNTS WITH NO RECORD ===============
-- Teachers and students have their own rows, so admins can edit them. Admins
-- have neither, so they showed as "—" on the Access page with nothing to
-- change. This gives every account a small editable profile.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  email      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

DROP POLICY IF EXISTS "admin manage user_profiles" ON public.user_profiles;
CREATE POLICY "admin manage user_profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "read own profile" ON public.user_profiles;
CREATE POLICY "read own profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "update own profile" ON public.user_profiles;
CREATE POLICY "update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Give the accounts that already exist a profile (this runs server-side, so
-- it can read auth.users, which the app cannot).
INSERT INTO public.user_profiles (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Record a profile as part of first sign-in, alongside role assignment.
CREATE OR REPLACE FUNCTION public.link_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   TEXT := lower(NEW.email);
  v_pending public.app_role;
  v_linked  BOOLEAN := false;
BEGIN
  INSERT INTO public.user_profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_pending FROM public.pending_roles WHERE lower(email) = v_email;
  IF v_pending IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_pending)
    ON CONFLICT DO NOTHING;
    DELETE FROM public.pending_roles WHERE lower(email) = v_email;
    v_linked := (v_pending = 'admin');
  END IF;

  IF NOT v_linked THEN
    UPDATE public.teachers SET user_id = NEW.id
     WHERE user_id IS NULL AND lower(email) = v_email;
    IF FOUND THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher')
      ON CONFLICT DO NOTHING;
      v_linked := true;
    END IF;
  END IF;

  IF NOT v_linked THEN
    UPDATE public.students SET user_id = NEW.id
     WHERE user_id IS NULL AND lower(email) = v_email;
    IF FOUND THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;