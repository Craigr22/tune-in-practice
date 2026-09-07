# Practice notification deployment

The application code, service worker, database migration, scheduled job, and
Edge Function are ready. Lovable should complete these deployment steps:

1. Generate one VAPID key pair. Configure the public key as the frontend
   environment variable `VITE_VAPID_PUBLIC_KEY`.
2. Configure these Supabase Edge Function secrets:
   - `VAPID_PUBLIC_KEY` — the same public key
   - `VAPID_PRIVATE_KEY` — the private half of the pair
   - `VAPID_SUBJECT` — a monitored `mailto:` address for BAM
   - `PRACTICE_NOTIFICATION_CRON_SECRET` — a new random secret
3. Apply `supabase/migrations/20260910160000_practice_push_notifications.sql`.
4. Deploy the `send-practice-notifications` Edge Function.
5. Add two Supabase Vault secrets:
   - `practice_notification_url` =
     `https://utjyntenlpopnxpjvwkh.supabase.co/functions/v1/send-practice-notifications`
   - `practice_notification_cron_secret` = the same value as
     `PRACTICE_NOTIFICATION_CRON_SECRET`
6. Deploy the frontend with the new public environment variable.

The sender runs every five minutes and uses each subscribed browser's time
zone. It sends only for a session scheduled on that local date, once around
9 AM, and once around 9 PM only while that session remains incomplete.
