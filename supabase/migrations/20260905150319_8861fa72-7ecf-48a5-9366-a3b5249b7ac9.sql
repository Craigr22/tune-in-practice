ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.mark_app_open()
RETURNS VOID
LANGUAGE SQL
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_profiles (user_id, email, last_seen_at, updated_at)
  SELECT auth.uid(), u.email, now(), now()
  FROM auth.users u
  WHERE u.id = auth.uid()
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at,
        updated_at = EXCLUDED.updated_at
$$;

CREATE OR REPLACE FUNCTION public.get_student_last_seen(_student_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_teacher_of_student(auth.uid(), _student_id)
    THEN (
      SELECT up.last_seen_at
      FROM public.students st
      LEFT JOIN public.user_profiles up ON up.user_id = st.user_id
      WHERE st.id = _student_id
    )
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public.mark_app_open() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_student_last_seen(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_app_open() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_last_seen(UUID) TO authenticated;