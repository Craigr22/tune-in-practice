import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/db";

export type PracticeNotificationStatus =
  | "checking"
  | "unsupported"
  | "unavailable"
  | "blocked"
  | "off"
  | "on";

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

function supportsPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function applicationServerKey(value: string): ArrayBuffer {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function currentTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() ?? null;
}

/** Browser push opt-in for the signed-in student. Permission is never asked automatically. */
export function usePracticeNotifications() {
  const [status, setStatus] = useState<PracticeNotificationStatus>("checking");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!supportsPush()) return setStatus("unsupported");
    if (!PUBLIC_KEY) return setStatus("unavailable");
    if (Notification.permission === "denied") return setStatus("blocked");

    try {
      setStatus((await currentSubscription()) ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const enable = async () => {
    if (!supportsPush() || !PUBLIC_KEY) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again to turn on reminders.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const ready = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await ready.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(PUBLIC_KEY),
        }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("The browser returned an incomplete notification subscription.");
      }

      const { error } = await (supabase as any).from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          timezone: currentTimeZone(),
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
      if (error) {
        await subscription.unsubscribe();
        throw error;
      }
      setStatus("on");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!supportsPush()) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again to change reminders.");
      const subscription = await currentSubscription();
      if (subscription) {
        const { error } = await (supabase as any)
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  };

  return { status, busy, enable, disable };
}
