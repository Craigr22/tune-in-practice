import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
};

type LocalTime = { date: string; hour: number; minute: number };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function localTime(now: Date, timeZone: string): LocalTime | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const value = (kind: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === kind)?.value ?? "";
    return {
      date: `${value("year")}-${value("month")}-${value("day")}`,
      hour: Number(value("hour")),
      minute: Number(value("minute")),
    };
  } catch {
    return null;
  }
}

function isComplete(session: Record<string, unknown>) {
  return Boolean(session.completed_at) || (
    Boolean(session.warmup_completed) &&
    Boolean(session.focus_completed) &&
    Boolean(session.bonus_completed)
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("PRACTICE_NOTIFICATION_CRON_SECRET") ?? "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "Not authorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@bammusic.in";
  if (!vapidPublicKey || !vapidPrivateKey) {
    return json({ error: "VAPID keys are not configured" }, 503);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const now = new Date();

  const { data: subscriptions, error: subscriptionError } = await admin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,timezone")
    .eq("enabled", true);
  if (subscriptionError) return json({ error: subscriptionError.message }, 500);
  if (!subscriptions?.length) return json({ checked: 0, sent: 0 });

  const due = (subscriptions as Subscription[])
    .map((subscription) => ({ subscription, local: localTime(now, subscription.timezone) }))
    .filter(({ local }) => local && (local.hour === 9 || local.hour === 21) && local.minute < 10) as {
      subscription: Subscription;
      local: LocalTime;
    }[];
  if (!due.length) return json({ checked: subscriptions.length, sent: 0 });

  const userIds = [...new Set(due.map(({ subscription }) => subscription.user_id))];
  const { data: students, error: studentError } = await admin
    .from("students")
    .select("id,user_id")
    .in("user_id", userIds);
  if (studentError) return json({ error: studentError.message }, 500);

  const studentByUser = new Map((students ?? []).map((student) => [student.user_id, student.id]));
  const studentIds = [...new Set([...studentByUser.values()])];
  if (!studentIds.length) return json({ checked: subscriptions.length, due: due.length, sent: 0 });
  const localDates = [...new Set(due.map(({ local }) => local.date))];
  const { data: sessions, error: sessionError } = await admin
    .from("weekly_plan_sessions")
    .select("id,student_id,scheduled_date,completed_at,warmup_completed,focus_completed,bonus_completed")
    .in("student_id", studentIds)
    .in("scheduled_date", localDates);
  if (sessionError) return json({ error: sessionError.message }, 500);

  const sessionByStudentAndDate = new Map(
    (sessions ?? []).map((session) => [`${session.student_id}:${session.scheduled_date}`, session]),
  );
  let sent = 0;
  let removed = 0;
  let failed = 0;

  for (const { subscription, local } of due) {
    const studentId = studentByUser.get(subscription.user_id);
    const session = studentId
      ? sessionByStudentAndDate.get(`${studentId}:${local.date}`)
      : null;
    if (!session || isComplete(session)) continue;

    const morning = local.hour === 9;
    const kind = morning ? "session_live" : "evening_reminder";
    const { data: delivery, error: claimError } = await admin
      .from("practice_notification_deliveries")
      .insert({
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        session_id: session.id,
        kind,
        local_date: local.date,
      })
      .select("id")
      .maybeSingle();

    // The unique constraint is the lock: another invocation already handled it.
    if (claimError || !delivery) continue;

    const message = morning
      ? {
          title: "Today’s practice is ready 🎵",
          body: "Your new session is live. Tune your ukulele, press play, and enjoy the music.",
          tag: `practice-live-${session.id}`,
          url: "/student",
        }
      : {
          title: "A little music before the day ends? 🌙",
          body: "Today’s practice is still waiting. Even a few minutes counts.",
          tag: `practice-reminder-${session.id}`,
          url: "/student",
        };

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(message),
        { TTL: morning ? 43_200 : 10_800 },
      );
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      await admin.from("practice_notification_deliveries").delete().eq("id", delivery.id);
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        removed += 1;
      } else {
        failed += 1;
        console.error("[practice-notifications] send failed", statusCode, error);
      }
    }
  }

  return json({ checked: subscriptions.length, due: due.length, sent, removed, failed });
});
