-- =============== MOVE A SINGLE SESSION ===============
-- A session only had a date; its time came from the class it belongs to, so
-- one week's lesson could never be shifted without moving every week's.
--
-- These optional overrides let an admin drag one session to a different time
-- or lengthen it. Null means "use the class's usual time", which is the case
-- for every existing row.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS duration_min INTEGER;

COMMENT ON COLUMN public.sessions.start_time IS
  'Overrides batches.start_time for this session only. Null = the class''s usual time.';
COMMENT ON COLUMN public.sessions.duration_min IS
  'Overrides batches.duration_min for this session only. Null = the class''s usual length.';
