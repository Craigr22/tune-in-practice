-- =============== PLAN WEEKS BELONG TO A JOURNEY TIER ===============
-- Ties the course plan to the same four stages students see on their Journey
-- map, so a week of practice sits under Beginner, Advanced Beginner, Casual
-- Ukulelist or Fingerstyle Path rather than being a loose number.

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

-- The seeded first month is the Beginner stage.
UPDATE public.course_plan_days SET tier = 'beginner' WHERE week_number <= 4;
