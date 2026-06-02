-- =============== SONGS CATALOG ===============
-- Admin-managed coursework songs per instrument. The built-in ukulele
-- catalog still lives in code (src/data/songs.ts); rows added here are
-- merged on top of it on the student Home & Journey pages.

CREATE TABLE public.songs (
  id              TEXT PRIMARY KEY,                 -- slug, e.g. 'count-on-me'
  instrument      TEXT NOT NULL DEFAULT 'ukulele',  -- ukulele | guitar | violin
  title           TEXT NOT NULL,
  artist          TEXT,
  track_num       INTEGER,                          -- null when fingerstyle
  is_fingerstyle  BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  difficulty      TEXT NOT NULL DEFAULT 'Beginner',
  chords          TEXT[] NOT NULL DEFAULT '{}',
  new_chord       TEXT,
  strum           TEXT,
  strum_note      TEXT,
  bpm             INTEGER,
  state           TEXT NOT NULL DEFAULT 'next',     -- mastered|in-progress|next|locked|stretch
  daily_target    INTEGER NOT NULL DEFAULT 4,
  target_approvals INTEGER NOT NULL DEFAULT 7,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX songs_instrument_idx ON public.songs (instrument, sort_order);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read the catalog (students see it on their pages).
CREATE POLICY "auth read songs" ON public.songs
  FOR SELECT TO authenticated USING (true);

-- Only admins can add / edit / remove songs.
CREATE POLICY "admin write songs" ON public.songs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
