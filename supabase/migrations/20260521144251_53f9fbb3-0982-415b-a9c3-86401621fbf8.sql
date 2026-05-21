ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS song_id text,
  ADD COLUMN IF NOT EXISTS teacher_comment text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;