-- Function to generate sessions for a batch
CREATE OR REPLACE FUNCTION public.generate_sessions_for_batch(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  d date;
  end_d date;
BEGIN
  SELECT * INTO b FROM public.batches WHERE id = _batch_id;
  IF b IS NULL THEN RETURN; END IF;
  IF b.semester_start IS NULL THEN RETURN; END IF;
  end_d := COALESCE(b.semester_end, b.semester_start + INTERVAL '12 weeks');
  d := b.semester_start;
  -- advance to first matching day_of_week (Postgres dow: 0=Sun..6=Sat)
  WHILE EXTRACT(DOW FROM d)::int <> b.day_of_week LOOP
    d := d + 1;
  END LOOP;
  WHILE d <= end_d LOOP
    INSERT INTO public.sessions (batch_id, scheduled_date, status)
    VALUES (_batch_id, d, 'upcoming')
    ON CONFLICT DO NOTHING;
    d := d + 7;
  END LOOP;
END;
$$;

-- Trigger to auto-generate sessions on new batch
CREATE OR REPLACE FUNCTION public.trg_generate_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.generate_sessions_for_batch(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS batches_generate_sessions ON public.batches;
CREATE TRIGGER batches_generate_sessions
AFTER INSERT ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.trg_generate_sessions();

-- Unique constraint for enrollments (student + batch)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_student_batch_unique'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_student_batch_unique UNIQUE (student_id, batch_id);
  END IF;
END $$;