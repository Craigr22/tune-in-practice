REVOKE EXECUTE ON FUNCTION public.set_batch_code() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.set_batch_code() TO service_role;