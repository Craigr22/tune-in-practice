-- The class board, visible to the people who need to look at it.
--
-- The first version worked out whose board to build from auth.uid() alone.
-- That is right for a student, but it leaves out everyone else who opens a
-- student's page: "view as" is a client-side lens, so an admin looking through
-- a student is still the admin to the database, and the board came back empty.
-- A teacher had no way to see it at all.
--
-- The board is now asked for by student, and the caller has to be entitled to
-- that student: the student themselves, their teacher, or an admin. Anyone
-- else gets nothing — not an error, simply no rows, which the page already
-- treats as "no board".

DROP FUNCTION IF EXISTS public.class_session_counts();

CREATE OR REPLACE FUNCTION public.class_session_counts(_student_id uuid DEFAULT NULL)
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
  WITH subject AS (
    -- Whose board this is: the one asked for, or the caller's own.
    SELECT s.id
    FROM public.students s
    WHERE s.id = COALESCE(_student_id, (
           SELECT s2.id FROM public.students s2 WHERE s2.user_id = auth.uid()
         ))
      AND (
        -- Their own board.
        s.user_id = auth.uid()
        -- Staff looking at one of their students.
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (
          public.has_role(auth.uid(), 'teacher'::public.app_role)
          AND public.is_teacher_of_student(auth.uid(), s.id)
        )
      )
  ),
  their_classes AS (
    SELECT e.batch_id
    FROM public.enrollments e
    JOIN subject ON subject.id = e.student_id
    WHERE e.status = 'active'
  ),
  classmates AS (
    SELECT DISTINCT e.student_id
    FROM public.enrollments e
    JOIN their_classes c ON c.batch_id = e.batch_id
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
    -- "you" marks the student whose board this is, which is who the reader is
    -- standing in for.
    s.id = (SELECT id FROM subject) AS is_me
  FROM classmates cm
  JOIN public.students s ON s.id = cm.student_id
  WHERE s.is_active
  ORDER BY sessions DESC, display_name;
$$;

REVOKE ALL ON FUNCTION public.class_session_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_session_counts(uuid) TO authenticated;
