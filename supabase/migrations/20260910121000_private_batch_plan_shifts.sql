-- Pause reasons and creator ids are staff records. Students only need the
-- resulting week offset, so do not expose the underlying rows to every user.
DROP POLICY IF EXISTS "auth read batch_plan_shifts"
  ON public.batch_plan_shifts;

CREATE POLICY "teacher reads own batch_plan_shifts"
  ON public.batch_plan_shifts FOR SELECT TO authenticated
  USING (public.is_teacher_of_batch(auth.uid(), batch_id));

-- Return only the effective shift, and only for a class the caller is allowed
-- to see. SECURITY DEFINER keeps the private rows behind this narrow result.
CREATE OR REPLACE FUNCTION public.get_batch_shift_weeks(_batch_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_teacher_of_batch(auth.uid(), _batch_id)
      OR EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.students st ON st.id = e.student_id
        WHERE e.batch_id = _batch_id
          AND e.status = 'active'
          AND st.user_id = auth.uid()
      )
    THEN COALESCE((
      SELECT SUM(s.weeks)::INTEGER
      FROM public.batch_plan_shifts s
      WHERE s.batch_id = _batch_id
    ), 0)
    ELSE 0
  END
$$;

REVOKE ALL ON FUNCTION public.get_batch_shift_weeks(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_batch_shift_weeks(UUID) TO authenticated;
