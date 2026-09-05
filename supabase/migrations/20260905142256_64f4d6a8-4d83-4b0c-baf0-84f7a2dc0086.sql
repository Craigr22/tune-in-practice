REVOKE EXECUTE ON FUNCTION public.complete_practice_segment(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.end_class(UUID, DATE, TEXT, JSONB, JSONB, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) FROM anon;