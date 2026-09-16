CREATE OR REPLACE FUNCTION public.class_session_counts()
RETURNS TABLE (
  student_id uuid,
  display_name text,
  sessions int,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
  ),
  my_classes AS (
    SELECT e.batch_id
    FROM public.enrollments e
    JOIN me ON me.id = e.student_id
    WHERE e.status = 'active'
  ),
  classmates AS (
    SELECT DISTINCT e.student_id
    FROM public.enrollments e
    JOIN my_classes c ON c.batch_id = e.batch_id
    WHERE e.status = 'active'
  )
  SELECT
    s.id,
    -- First name, and an initial when there is a surname to take one from.
    trim(
      split_part(s.name, ' ', 1) ||
      CASE
        WHEN split_part(s.name, ' ', 2) <> ''
          THEN ' ' || upper(left(split_part(s.name, ' ', 2), 1)) || '.'
        ELSE ''
      END
    ) AS display_name,
    (
      SELECT count(DISTINCT l.played_on)
      FROM public.practice_logs l
      WHERE l.student_id = s.id
    )::int AS sessions,
    s.id = (SELECT id FROM me) AS is_me
  FROM classmates cm
  JOIN public.students s ON s.id = cm.student_id
  WHERE s.is_active
  ORDER BY sessions DESC, display_name;
$$;

-- Callable by a signed-in student only. Anonymous visitors get nothing, and
-- the function returns no rows to anyone without a student record of their
-- own — a teacher or admin sees their classes through the roster instead.
REVOKE ALL ON FUNCTION public.class_session_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_session_counts() TO authenticated;