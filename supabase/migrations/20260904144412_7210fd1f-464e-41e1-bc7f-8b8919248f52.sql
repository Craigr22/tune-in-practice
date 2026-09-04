ALTER TABLE public.batch_settings
  ADD COLUMN IF NOT EXISTS course_start_date DATE;