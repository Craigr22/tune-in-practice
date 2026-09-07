-- Accounts are provisioned or invited by admins. The original bootstrap trigger
-- assigned every unmatched self-signup a student role, which conflicts with the
-- later link_new_user trigger and can create a role with no student record.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Keep the function out of the signup path. It remains defined so deployments
-- that still reference it can migrate safely; clients cannot execute it.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
