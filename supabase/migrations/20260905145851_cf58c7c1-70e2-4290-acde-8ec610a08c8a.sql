DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;