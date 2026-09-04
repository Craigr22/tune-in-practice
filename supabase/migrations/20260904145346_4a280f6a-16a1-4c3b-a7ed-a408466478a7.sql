-- =============== PER-CLASS COURSE START ===============
ALTER TABLE public.batch_settings
  ADD COLUMN IF NOT EXISTS course_start_date DATE;

COMMENT ON COLUMN public.batch_settings.course_start_date IS
  'Monday of this class''s curriculum week 1. Null = use the course default.';

-- =============== PLAN WEEKS BELONG TO A JOURNEY TIER ===============
ALTER TABLE public.course_plan_days
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'beginner';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_plan_days_tier_check'
  ) THEN
    ALTER TABLE public.course_plan_days
      ADD CONSTRAINT course_plan_days_tier_check
      CHECK (tier IN ('beginner', 'adv-beginner', 'casual', 'fingerstyle'));
  END IF;
END $$;

UPDATE public.course_plan_days SET tier = 'beginner' WHERE week_number <= 4;