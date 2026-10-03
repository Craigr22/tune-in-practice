-- A class photo, taken on day one and shown to that class.
--
-- The picture belongs to a class, so it hangs off the batch: where the file
-- is, and the day it was taken. The file itself goes in a private bucket under
-- the class's own id — "<batch id>/<file>" — and that first folder is what
-- decides who may see it: the students in that class, its teacher, and admins.
-- Nobody else, and never by a public link.

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS photo_taken_on date;

INSERT INTO storage.buckets (id, name, public)
VALUES ('class_photos', 'class_photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- The class a stored photo belongs to, from its path. NULL for anything not
-- filed under a class id, so a stray name is refused rather than raising.
CREATE OR REPLACE FUNCTION public.class_photo_batch(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN split_part(_name, '/', 1)::uuid
  END;
$$;

DROP POLICY IF EXISTS "class photo read" ON storage.objects;
CREATE POLICY "class photo read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'class_photos'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_teacher_of_batch(auth.uid(), public.class_photo_batch(name))
      OR public.is_student_in_batch(auth.uid(), public.class_photo_batch(name))
    )
  );

DROP POLICY IF EXISTS "class photo add" ON storage.objects;
CREATE POLICY "class photo add" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'class_photos'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_teacher_of_batch(auth.uid(), public.class_photo_batch(name))
    )
  );

DROP POLICY IF EXISTS "class photo remove" ON storage.objects;
CREATE POLICY "class photo remove" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'class_photos'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_teacher_of_batch(auth.uid(), public.class_photo_batch(name))
    )
  );

-- Pointing a class at its photo, or taking it down (a NULL path).
--
-- Teachers can't edit a class row — that is the admin's — so this is the one
-- thing about it they may change, and only for a class they teach. The path
-- has to sit under that class's own folder, so one class can't be pointed at
-- another's picture.
CREATE OR REPLACE FUNCTION public.set_class_photo(
  _batch_id uuid,
  _path text,
  _taken_on date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_teacher_of_batch(auth.uid(), _batch_id)
  ) THEN
    RAISE EXCEPTION 'Not your class';
  END IF;

  IF _path IS NOT NULL AND public.class_photo_batch(_path) IS DISTINCT FROM _batch_id THEN
    RAISE EXCEPTION 'A class photo must be stored under its own class';
  END IF;

  UPDATE public.batches
  SET photo_path = _path,
      photo_taken_on = CASE WHEN _path IS NULL THEN NULL ELSE COALESCE(_taken_on, current_date) END
  WHERE id = _batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_class_photo(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_class_photo(uuid, text, date) TO authenticated;
