DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- Re-grant only the helpers required to evaluate row-level security for signed-in users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_in_batch(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_in_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_batch(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teaches_batch(uuid) TO authenticated;