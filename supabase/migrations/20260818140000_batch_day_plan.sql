-- =============== DAY-WISE PRACTICE PLANNING ===============
-- Teachers can ramp the load across the week's three practice days instead
-- of one flat number, e.g. day 1 = 1 song, day 2 = 2 songs, day 3 = 3.
-- One entry per practice session, in order.

ALTER TABLE public.batch_settings
  ADD COLUMN IF NOT EXISTS songs_per_day INTEGER[];

-- Carry existing classes over from the single flat setting.
UPDATE public.batch_settings
SET songs_per_day = ARRAY[songs_per_session, songs_per_session, songs_per_session]
WHERE songs_per_day IS NULL;

ALTER TABLE public.batch_settings
  ALTER COLUMN songs_per_day SET DEFAULT '{3,3,3}';
