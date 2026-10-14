-- Booking from the public website.
--
-- A visitor picks a class, pays for it online, and becomes a student: the
-- student record, their place in the class, the payment and their login are
-- all made by the server once the payment is confirmed. These are the pieces
-- the website reads and the record each booking leaves behind.

-- What a place in a class costs, per instrument. The website shows it and
-- the server charges it; the amount is never taken from the browser.
CREATE TABLE IF NOT EXISTS public.website_fees (
  instrument_id    uuid PRIMARY KEY REFERENCES public.instruments(id) ON DELETE CASCADE,
  amount           numeric(10,2) NOT NULL CHECK (amount > 0),
  fee_cycle        public.fee_cycle NOT NULL DEFAULT 'monthly',
  -- A one-off charge added to the first payment, if there is one.
  registration_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (registration_fee >= 0),
  is_active        boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads website fees" ON public.website_fees;
CREATE POLICY "anyone reads website fees" ON public.website_fees
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "admin manages website fees" ON public.website_fees;
CREATE POLICY "admin manages website fees" ON public.website_fees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.website_fees TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.website_fees TO authenticated;

-- One row per attempt to book. Written only by the server; admins can read
-- it to see who joined from the website, and to sort out anything that went
-- wrong between a payment and an account.
CREATE TABLE IF NOT EXISTS public.website_bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  batch_id            uuid NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  student_name        text NOT NULL,
  parent_name         text,
  phone               text NOT NULL,
  email               text,
  age_group           text,
  amount              numeric(10,2) NOT NULL,
  currency            text NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'paid', 'error')),
  razorpay_order_id   text UNIQUE,
  razorpay_payment_id text,
  paid_at             timestamptz,
  student_id          uuid REFERENCES public.students(id) ON DELETE SET NULL,
  username            text,
  -- Held only until the new student has been shown it on the website, then
  -- cleared. Never readable by the public.
  initial_password    text,
  notes               text
);

CREATE INDEX IF NOT EXISTS website_bookings_created_idx ON public.website_bookings (created_at DESC);

ALTER TABLE public.website_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads website bookings" ON public.website_bookings;
CREATE POLICY "admin reads website bookings" ON public.website_bookings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.website_bookings TO authenticated;

-- The timetable the website shows: running classes, when they meet, what
-- they cost and how many places are left. Only these fields — no student is
-- ever named, and nothing private about a class leaves the database.
CREATE OR REPLACE FUNCTION public.website_timetable()
RETURNS TABLE (
  batch_id         uuid,
  code             text,
  instrument       text,
  location         text,
  address          text,
  day_of_week      integer,
  start_time       time,
  duration_min     integer,
  starts_on        date,
  teacher          text,
  seats_left       integer,
  fee              numeric,
  fee_cycle        public.fee_cycle,
  registration_fee numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.code,
    i.name,
    l.name,
    l.address,
    b.day_of_week::integer,
    b.start_time,
    b.duration_min::integer,
    b.semester_start,
    t.name,
    CASE WHEN COALESCE(b.max_students, 0) > 0
      THEN GREATEST(b.max_students - (
        SELECT count(*) FROM public.enrollments e WHERE e.batch_id = b.id AND e.status = 'active'
      ), 0)::integer
    END,
    f.amount,
    f.fee_cycle,
    f.registration_fee
  FROM public.batches b
  JOIN public.instruments i ON i.id = b.instrument_id
  LEFT JOIN public.locations l ON l.id = b.location_id
  LEFT JOIN public.teachers t ON t.id = b.teacher_id
  LEFT JOIN public.website_fees f ON f.instrument_id = b.instrument_id AND f.is_active
  WHERE b.is_active
    AND (b.semester_end IS NULL OR b.semester_end >= current_date)
  ORDER BY i.name, b.day_of_week, b.start_time;
$$;

REVOKE ALL ON FUNCTION public.website_timetable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.website_timetable() TO anon, authenticated;

-- The teachers of running classes, by name and what they teach.
CREATE OR REPLACE FUNCTION public.website_teachers()
RETURNS TABLE (name text, instruments text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.name, array_agg(DISTINCT i.name ORDER BY i.name)
  FROM public.teachers t
  JOIN public.batches b ON b.teacher_id = t.id AND b.is_active
  JOIN public.instruments i ON i.id = b.instrument_id
  WHERE t.is_active
  GROUP BY t.id, t.name
  ORDER BY t.name;
$$;

REVOKE ALL ON FUNCTION public.website_teachers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.website_teachers() TO anon, authenticated;
