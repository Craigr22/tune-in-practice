-- =============== PER-CLASS COURSE START ===============
-- The course plan is a template. Each class starts it on its own date, so a
-- new batch runs the same weeks shifted to when that class began — week 1 of
-- the plan lands on the class's first practice week.
--
-- Falls back to course_plan_settings.week_one_start when a class hasn't set
-- its own date.

ALTER TABLE public.batch_settings
  ADD COLUMN IF NOT EXISTS course_start_date DATE;

COMMENT ON COLUMN public.batch_settings.course_start_date IS
  'Monday of this class''s curriculum week 1. Null = use the course default.';
