CREATE OR REPLACE FUNCTION public.teaches_batch(_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.batches b
    JOIN public.teachers t ON t.id = b.teacher_id
    WHERE b.id = _batch_id AND t.user_id = auth.uid()
  );
$$;

-- Per-song overrides for a class.
CREATE TABLE public.batch_coursework (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  song_id     TEXT NOT NULL,
  is_unlocked BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, song_id)
);

CREATE INDEX batch_coursework_batch_idx ON public.batch_coursework (batch_id, sort_order);

GRANT SELECT ON public.batch_coursework TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_coursework TO authenticated;
GRANT ALL ON public.batch_coursework TO service_role;

ALTER TABLE public.batch_coursework ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read batch_coursework" ON public.batch_coursework
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "manage batch_coursework" ON public.batch_coursework
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.teaches_batch(batch_id))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.teaches_batch(batch_id));

-- Class-level settings (one row per batch).
CREATE TABLE public.batch_settings (
  batch_id          UUID PRIMARY KEY REFERENCES public.batches(id) ON DELETE CASCADE,
  songs_per_session INTEGER NOT NULL DEFAULT 3,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.batch_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_settings TO authenticated;
GRANT ALL ON public.batch_settings TO service_role;

ALTER TABLE public.batch_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read batch_settings" ON public.batch_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "manage batch_settings" ON public.batch_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.teaches_batch(batch_id))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.teaches_batch(batch_id));