CREATE OR REPLACE FUNCTION public.link_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_teacher uuid;
  matched_student uuid;
BEGIN
  -- Match teachers first
  SELECT id INTO matched_teacher FROM public.teachers
    WHERE user_id IS NULL AND lower(email) = lower(NEW.email) LIMIT 1;
  IF matched_teacher IS NOT NULL THEN
    UPDATE public.teachers SET user_id = NEW.id WHERE id = matched_teacher;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher') ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT id INTO matched_student FROM public.students
    WHERE user_id IS NULL AND lower(email) = lower(NEW.email) LIMIT 1;
  IF matched_student IS NOT NULL THEN
    UPDATE public.students SET user_id = NEW.id WHERE id = matched_student;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_link
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_new_user();