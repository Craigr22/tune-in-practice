-- =============== COURSE VIDEOS ===============
-- Admin-uploaded tutorial/demo videos, optionally attached to a song.
-- Files live in the public `videos` storage bucket; this table holds the
-- metadata students/teachers read.

-- Storage policies (bucket created separately because storage.buckets SQL is rejected).
CREATE POLICY "public read videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "admin insert videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "admin update videos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'videos' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "admin delete videos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND public.has_role(auth.uid(),'admin'));

-- Metadata table.
CREATE TABLE public.course_videos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument   TEXT NOT NULL DEFAULT 'ukulele',
  song_id      TEXT,
  title        TEXT NOT NULL,
  description  TEXT,
  storage_path TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX course_videos_instrument_idx ON public.course_videos (instrument, created_at DESC);

GRANT SELECT ON public.course_videos TO authenticated;
GRANT ALL ON public.course_videos TO service_role;

ALTER TABLE public.course_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read course_videos" ON public.course_videos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin write course_videos" ON public.course_videos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));