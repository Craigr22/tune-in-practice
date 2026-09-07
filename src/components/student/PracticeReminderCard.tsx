import { Bell, BellOff, Check } from "lucide-react";
import { toast } from "sonner";
import { usePracticeNotifications } from "@/hooks/usePracticeNotifications";

export default function PracticeReminderCard() {
  const { status, busy, enable, disable } = usePracticeNotifications();

  if (status === "checking" || status === "unsupported" || status === "unavailable") return null;

  const run = async (action: () => Promise<void>, fallback: string) => {
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallback);
    }
  };

  if (status === "blocked") {
    return (
      <aside
        className="mb-4 flex items-start gap-3 rounded-2xl px-4 py-3"
        style={{ background: "var(--paper-warm)", border: "1px solid var(--border)" }}
      >
        <BellOff className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ink-soft)" }} />
        <div>
          <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>Practice reminders are blocked</div>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Allow notifications in your browser settings to get the 9 AM and 9 PM reminders.
          </p>
        </div>
      </aside>
    );
  }

  const enabled = status === "on";
  return (
    <aside
      className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{
        background: enabled ? "rgba(16,185,129,0.07)" : "var(--paper-warm)",
        border: `1px solid ${enabled ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
      }}
    >
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{ background: enabled ? "rgba(16,185,129,0.14)" : "rgba(0,133,199,0.1)" }}
      >
        {enabled
          ? <Check className="h-4 w-4" style={{ color: "#059669" }} />
          : <Bell className="h-4 w-4" style={{ color: "var(--navy)" }} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>
          {enabled ? "Practice reminders are on" : "A gentle nudge, right on time"}
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--ink-soft)" }}>
          {enabled ? "9 AM when your session is ready · 9 PM only if it’s still waiting" : "Get a note at 9 AM and, if needed, again at 9 PM."}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(enabled ? disable : enable, "Couldn’t update reminders.")}
        className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-60"
        style={{
          color: enabled ? "var(--ink-soft)" : "#fff",
          background: enabled ? "transparent" : "var(--navy)",
          border: enabled ? "1px solid var(--border-strong)" : "1px solid var(--navy)",
        }}
      >
        {busy ? "Working…" : enabled ? "Turn off" : "Remind me"}
      </button>
    </aside>
  );
}
