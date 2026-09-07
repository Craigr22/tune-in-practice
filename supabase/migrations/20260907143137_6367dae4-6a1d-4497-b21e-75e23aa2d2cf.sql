-- lovable-cron-fallback-reviewed: 288 runs/day; per-subscriber local 9 AM / 9 PM windows across arbitrary time zones require sub-hourly resolution
-- Browser push subscriptions and once-only delivery records for practice days.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id) WHERE enabled;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS "users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_role(auth.uid(), 'student'::public.app_role)
  );

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.practice_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.weekly_plan_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('session_live', 'evening_reminder')),
  local_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, session_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_practice_notification_deliveries_user
  ON public.practice_notification_deliveries(user_id, sent_at DESC);

ALTER TABLE public.practice_notification_deliveries ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.practice_notification_deliveries TO authenticated;
GRANT ALL ON public.practice_notification_deliveries TO service_role;

DROP POLICY IF EXISTS "users read own notification deliveries" ON public.practice_notification_deliveries;
CREATE POLICY "users read own notification deliveries"
  ON public.practice_notification_deliveries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_practice_notification_sender()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $function$
DECLARE
  function_url TEXT;
  cron_secret TEXT;
  request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO function_url
  FROM vault.decrypted_secrets
  WHERE name = 'practice_notification_url'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'practice_notification_cron_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF function_url IS NULL OR cron_secret IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) INTO request_id;

  RETURN request_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.invoke_practice_notification_sender() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_practice_notification_sender() FROM anon, authenticated;

DO $schedule$
DECLARE
  existing_job BIGINT;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'send-practice-notifications'
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;

  PERFORM cron.schedule(
    'send-practice-notifications',
    '*/5 * * * *',
    'SELECT public.invoke_practice_notification_sender();'
  );
END;
$schedule$;