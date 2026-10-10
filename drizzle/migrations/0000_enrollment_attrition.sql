ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS left_on date,
  ADD COLUMN IF NOT EXISTS leave_reason text;