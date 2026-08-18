-- =============== PRIVATE VIDEO ACCESS ===============
-- The videos bucket stays PRIVATE. Playback is served through short-lived
-- signed URLs that only signed-in users can mint, so clips are never
-- readable by anonymous visitors or by anyone with a bare file path.

UPDATE storage.buckets SET public = false WHERE id = 'videos';

-- Replace the anonymous-readable policy with an authenticated-only one.
-- (Signing a URL requires SELECT on the object, so this is what gates playback.)
DROP POLICY IF EXISTS "public read videos" ON storage.objects;

DROP POLICY IF EXISTS "auth read videos" ON storage.objects;
CREATE POLICY "auth read videos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'videos');

-- Data API grants for the metadata table (RLS still decides row visibility).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_videos TO authenticated;
