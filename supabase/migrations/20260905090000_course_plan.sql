-- =============== ADMIN-EDITABLE COURSE PLAN ===============
-- Moves the first-month curriculum out of code and into the database so
-- admins can plan each week: the day's practice instructions, its focus
-- song, and which uploaded videos students see that day.
--
-- Students' weekly plans are generated from these rows, and the day's
-- videos are shown on Home instead of one flat list of every upload.

CREATE TABLE public.course_plan_settings (
  instrument     TEXT PRIMARY KEY DEFAULT 'ukulele',
  title          TEXT NOT NULL DEFAULT 'Course 1',
  -- Monday of curriculum week 1. Null = plan not scheduled yet.
  week_one_start DATE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.course_plan_days (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument          TEXT NOT NULL DEFAULT 'ukulele',
  week_number         INTEGER NOT NULL CHECK (week_number >= 1),
  day_number          INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 3),
  -- What the in-person class covered that week (shown on day 1).
  class_topic         TEXT,
  focus_song_id       TEXT,
  warmup_instruction  TEXT NOT NULL DEFAULT '',
  focus_instruction   TEXT NOT NULL DEFAULT '',
  bonus_instruction   TEXT NOT NULL DEFAULT '',
  -- course_videos.id values to show on this day, in order.
  video_ids           UUID[] NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instrument, week_number, day_number)
);
CREATE INDEX course_plan_days_idx ON public.course_plan_days (instrument, week_number, day_number);

ALTER TABLE public.course_plan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_plan_days ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_plan_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_plan_days TO authenticated;
GRANT ALL ON public.course_plan_settings TO service_role;
GRANT ALL ON public.course_plan_days TO service_role;

CREATE POLICY "auth read course_plan_settings" ON public.course_plan_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write course_plan_settings" ON public.course_plan_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "auth read course_plan_days" ON public.course_plan_days
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write course_plan_days" ON public.course_plan_days
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed with the authored Course 1 month (first class Sep 6th, so curriculum
-- week 1 is the practice week starting Mon Sep 7th).
INSERT INTO public.course_plan_settings (instrument, title, week_one_start)
VALUES ('ukulele', 'Course 1 · First month', '2026-09-07')
ON CONFLICT (instrument) DO NOTHING;

INSERT INTO public.course_plan_days
  (instrument, week_number, day_number, class_topic, focus_song_id, warmup_instruction, focus_instruction, bonus_instruction)
VALUES
  ('ukulele', 1, 1, 'Class 1 — C and half F, full F · how to tune · You Are My Sunshine (no G chord yet)', 'sunshine',
   'Watch “Tuning your ukulele”, then tune each string — G C E A.',
   'Watch the first lesson, then play along: C and F (half and full). No G chord yet.',
   'Slow C → F changes. Ten clean ones, no rushing.'),
  ('ukulele', 1, 2, NULL, 'sunshine',
   'Tune up, then strum open strings to loosen your hand.',
   'Exercise 1: shifting between C and F. Slow and clean beats fast and messy.',
   'Try the first line of You Are My Sunshine using just C and F.'),
  ('ukulele', 1, 3, NULL, 'sunshine',
   'Tune up, then run a few C → F changes.',
   'Watch the You Are My Sunshine tutorial, then play it through.',
   'Play-throughs — as many relaxed runs as fit in the time.'),

  ('ukulele', 2, 1, 'Class 2 — Piyu Bole · the G chord · Sunshine with G · sharps & flats theory', 'piyu-bole',
   'Tune up, then revise C, F and your new G chord.',
   'Watch the Piyu Bole summary and learn the chord shapes.',
   'Loop the trickiest change in Piyu Bole a few times.'),
  ('ukulele', 2, 2, NULL, 'sunshine',
   'Tune up.',
   'Exercise 2: changes between C and G. Then watch the completed Sunshine summary and add the G chord.',
   'One full Sunshine run with the G chord in.'),
  ('ukulele', 2, 3, NULL, 'piyu-bole',
   'Tune up, then one gentle Sunshine run.',
   'Piyu Bole play-throughs.',
   'Finish with your favourite section, just for fun.'),

  ('ukulele', 3, 1, 'Class 3 — Photograph · chord progressions · major scale', 'photograph',
   'Tune up, then revise C, F, G changes.',
   'Watch the Photograph summary and learn the shapes.',
   'Slow-motion run of Photograph''s chord loop.'),
  ('ukulele', 3, 2, NULL, 'photograph',
   'Tune up.',
   'Arpeggiate each Photograph chord 3 times — one string at a time, slow and even.',
   'Put two chords together, still arpeggiated.'),
  ('ukulele', 3, 3, NULL, 'photograph',
   'Tune up, then a C–F–G warm run.',
   'Photograph play-along with the track.',
   'One more run — this time don''t stop for mistakes.'),

  ('ukulele', 4, 1, 'Class 4 — finish Photograph, revise · all three songs with tracks', 'photograph',
   'Tune up.',
   'Photograph play-through — everything in tempo.',
   'The Photograph motif, three relaxed repeats.'),
  ('ukulele', 4, 2, NULL, 'sunshine',
   'Tune up.',
   'You Are My Sunshine completed play-through. Then Exercise 3, progression changes: C F G Am · F G C Am · Am G C F.',
   'Pick the progression that trips you up and loop it.'),
  ('ukulele', 4, 3, NULL, 'piyu-bole',
   'Tune up, then one Sunshine chorus.',
   'Piyu Bole full play-through.',
   'Celebrate — play any song from the month, your choice.')
ON CONFLICT (instrument, week_number, day_number) DO NOTHING;
