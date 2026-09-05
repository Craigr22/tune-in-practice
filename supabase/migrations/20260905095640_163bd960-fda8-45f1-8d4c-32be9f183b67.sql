ALTER TABLE public.course_plan_days
  ADD COLUMN IF NOT EXISTS video_notes JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.course_plan_days.video_notes IS 'Per-clip notes keyed by video id for this course day';