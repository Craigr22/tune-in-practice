CREATE TABLE IF NOT EXISTS public.pending_roles (
  email      TEXT PRIMARY KEY,
  role       public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_roles TO authenticated;
GRANT ALL ON public.pending_roles TO service_role;

DROP POLICY IF EXISTS "admin manage pending_roles" ON public.pending_roles;
CREATE POLICY "admin manage pending_roles" ON public.pending_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

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

REVOKE ALL ON FUNCTION public.link_new_user() FROM anon, authenticated;