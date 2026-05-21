CREATE TYPE public.practice_check_in AS ENUM ('nailed', 'got_through', 'need_help');

ALTER TABLE public.practice_logs
  ADD COLUMN check_in public.practice_check_in,
  ADD COLUMN shared_with_teacher boolean NOT NULL DEFAULT true,
  ADD COLUMN recording_url text,
  ADD COLUMN acknowledged_at timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: derive student id from object path "{student_id}/..."
CREATE POLICY "students manage own recordings"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'recordings'
    AND EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.user_id = auth.uid()
        AND st.id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'recordings'
    AND EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.user_id = auth.uid()
        AND st.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "teachers read student recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'recordings'
    AND public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND public.is_teacher_of_student(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY "admins manage recordings"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'recordings' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'recordings' AND public.has_role(auth.uid(), 'admin'::public.app_role));