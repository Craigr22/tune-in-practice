CREATE TABLE public.songs (
  id              TEXT PRIMARY KEY,
  instrument      TEXT NOT NULL DEFAULT 'ukulele',
  title           TEXT NOT NULL,
  artist          TEXT,
  track_num       INTEGER,
  is_fingerstyle  BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  difficulty      TEXT NOT NULL DEFAULT 'Beginner',
  chords          TEXT[] NOT NULL DEFAULT '{}',
  new_chord       TEXT,
  strum           TEXT,
  strum_note      TEXT,
  bpm             INTEGER,
  state           TEXT NOT NULL DEFAULT 'next',
  daily_target    INTEGER NOT NULL DEFAULT 4,
  target_approvals INTEGER NOT NULL DEFAULT 7,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX songs_instrument_idx ON public.songs (instrument, sort_order);

GRANT SELECT ON public.songs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.songs TO authenticated;
GRANT ALL ON public.songs TO service_role;

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read songs" ON public.songs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin write songs" ON public.songs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));