-- 1. Restrict teacher PII: only admins and the teacher themselves may read teacher rows
DROP POLICY IF EXISTS "any auth read teachers basic" ON public.teachers;

-- 2. Fix student recordings storage ownership check (use the object path, not student's name)
DROP POLICY IF EXISTS "students manage own recordings" ON storage.objects;
CREATE POLICY "students manage own recordings"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'recordings' AND EXISTS (
    SELECT 1 FROM public.students st
    WHERE st.user_id = auth.uid()
      AND st.id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'recordings' AND EXISTS (
    SELECT 1 FROM public.students st
    WHERE st.user_id = auth.uid()
      AND st.id::text = (storage.foldername(name))[1]
  )
);

-- 3. Revoke EXECUTE on SECURITY DEFINER functions not needed by clients
REVOKE ALL ON FUNCTION public.generate_sessions_for_batch(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_generate_sessions() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_role() FROM anon, authenticated;

-- Policy helper functions: needed by signed-in users only (RLS evaluation), never by anon
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.is_student_in_batch(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_student_in_session(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_teacher_of_batch(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_teacher_of_session(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_teacher_of_student(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.teaches_batch(uuid) FROM anon;