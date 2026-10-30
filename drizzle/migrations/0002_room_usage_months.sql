-- BAM's room efficiency, month by month.
--
-- Past months can't be worked out later: classes are archived without a date
-- and students move, so a month has to be written down while it is happening.
-- A job saves the current month every night, so the row left standing when
-- the month turns over is that month's closing figure. It reads the running
-- classes each time, so a new class counts from the night it is added.
--
-- The figures match src/lib/roomUsage.ts: five seats a class, open 7am to 10pm
-- seven days a week, which is 105 hours a room.

CREATE TABLE IF NOT EXISTS public.room_usage_months (
  month             date NOT NULL CHECK (extract(day FROM month) = 1),
  scope             text NOT NULL, -- 'all', or the room's location id
  room_name         text NOT NULL,
  classes           integer NOT NULL,
  students          integer NOT NULL,
  seat_hours_filled numeric NOT NULL,
  seat_hours_open   numeric NOT NULL,
  saved_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (month, scope)
);

ALTER TABLE public.room_usage_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read room usage months" ON public.room_usage_months
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

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

-- 23:55 in Mumbai every night.
DO $schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'save-room-usage-month') THEN
    PERFORM cron.unschedule('save-room-usage-month');
  END IF;
  PERFORM cron.schedule(
    'save-room-usage-month',
    '25 18 * * *',
    'SELECT public.save_room_usage_month();'
  );
END;
$schedule$;

-- The first point on the trend, without waiting for tonight.
SELECT public.save_room_usage_month();
