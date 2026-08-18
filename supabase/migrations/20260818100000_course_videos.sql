-- =============== COURSE VIDEOS ===============
-- Admin-uploaded tutorial/demo videos, optionally attached to a song.
-- Files live in the public `videos` storage bucket; this table holds the
-- metadata students/teachers read.

-- Storage bucket (public read so <video> tags can stream directly).
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

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
  instrument   TEXT NOT NULL DEFAULT 'ukulele',   -- ukulele | guitar | violin
  song_id      TEXT,                              -- optional link to a catalog song
  title        TEXT NOT NULL,
  description  TEXT,
  storage_path TEXT NOT NULL,                     -- path inside the videos bucket
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX course_videos_instrument_idx ON public.course_videos (instrument, created_at DESC);

ALTER TABLE public.course_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read course_videos" ON public.course_videos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin write course_videos" ON public.course_videos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
