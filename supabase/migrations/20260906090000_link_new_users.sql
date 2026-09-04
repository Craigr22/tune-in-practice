-- =============== AUTO-LINK INVITED USERS ===============
-- When someone signs in for the first time, match their email to the teacher
-- or student record an admin already created, attach the account to it, and
-- give them the right role.
--
-- Without this an admin had to wait for the person to sign up and then link
-- them by hand, which is the "Awaiting signup" limbo on the Access page.

CREATE OR REPLACE FUNCTION public.link_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(NEW.email);
  v_linked BOOLEAN := false;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  -- Teachers first: a teacher who also appears as a student should get the
  -- more capable role.
  UPDATE public.teachers
     SET user_id = NEW.id
   WHERE user_id IS NULL AND lower(email) = v_email;
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'teacher')
    ON CONFLICT DO NOTHING;
    v_linked := true;
  END IF;

  IF NOT v_linked THEN
    UPDATE public.students
       SET user_id = NEW.id
     WHERE user_id IS NULL AND lower(email) = v_email;
    IF FOUND THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'student')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- No match: the account is left without a role, and the app shows the
  -- "your account isn't set up yet" screen until an admin assigns one.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_link ON auth.users;
CREATE TRIGGER on_auth_user_created_link
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_new_user();
