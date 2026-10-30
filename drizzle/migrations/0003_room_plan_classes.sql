-- Weekly classes kept only for room efficiency (from the class & teacher
-- workbook). They are not portal classes: no students, sessions or teachers
-- are created for them, and Schedule, People and teacher pages never read them.
CREATE TABLE public.room_plan_classes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  teacher_name  text NOT NULL,
  instrument    text,
  day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    time NOT NULL,
  duration_min  integer NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  student_names text[] NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  source        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_plan_classes TO authenticated;
GRANT ALL ON public.room_plan_classes TO service_role;

ALTER TABLE public.room_plan_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage room plan classes" ON public.room_plan_classes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- The admin page reads the saved months too, so give it access.
GRANT SELECT ON public.room_usage_months TO authenticated;
GRANT ALL ON public.room_usage_months TO service_role;

-- Same as before, plus the workbook-only classes.
CREATE OR REPLACE FUNCTION public.save_room_usage_month(
  p_month date DEFAULT date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')::date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seats       CONSTANT integer := 5;
  room_hours  CONSTANT integer := 105;
BEGIN
  WITH rooms AS (
    SELECT id, name FROM public.locations WHERE is_active
  ),
  running AS (
    SELECT b.id, b.location_id, b.duration_min,
      (SELECT count(*) FROM public.enrollments e
        WHERE e.batch_id = b.id AND e.status = 'active') AS enrolled
    FROM public.batches b
    JOIN rooms r ON r.id = b.location_id
    WHERE b.is_active
    UNION ALL
    SELECT p.id, p.location_id, p.duration_min, cardinality(p.student_names)::bigint
    FROM public.room_plan_classes p
    JOIN rooms r ON r.id = p.location_id
    WHERE p.is_active
  ),
  by_room AS (
    SELECT r.id::text AS scope, r.name AS room_name,
      count(c.id)::integer AS classes,
      coalesce(sum(c.enrolled), 0)::integer AS students,
      coalesce(sum(c.enrolled * c.duration_min / 60.0), 0) AS seat_hours_filled,
      (room_hours * seats)::numeric AS seat_hours_open
    FROM rooms r
    LEFT JOIN running c ON c.location_id = r.id
    GROUP BY r.id, r.name
  ),
  combined AS (
    SELECT * FROM by_room
    UNION ALL
    SELECT 'all', 'BAM', sum(classes)::integer, sum(students)::integer,
      sum(seat_hours_filled), sum(seat_hours_open)
    FROM by_room
    HAVING count(*) > 0
  )
  INSERT INTO public.room_usage_months
    (month, scope, room_name, classes, students, seat_hours_filled, seat_hours_open, saved_at)
  SELECT p_month, scope, room_name, classes, students, seat_hours_filled, seat_hours_open, now()
  FROM combined
  ON CONFLICT (month, scope) DO UPDATE SET
    room_name = EXCLUDED.room_name,
    classes = EXCLUDED.classes,
    students = EXCLUDED.students,
    seat_hours_filled = EXCLUDED.seat_hours_filled,
    seat_hours_open = EXCLUDED.seat_hours_open,
    saved_at = EXCLUDED.saved_at;
END;
$$;

REVOKE ALL ON FUNCTION public.save_room_usage_month(date) FROM PUBLIC, anon, authenticated;