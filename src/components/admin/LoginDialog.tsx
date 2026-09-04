import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { suggestPassword } from "@/lib/studentLogin";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export interface LoginTarget {
  role: "student" | "teacher" | "admin";
  name: string;
  /** students/teachers: their record id. */
  recordId?: string | null;
  /** teachers/admins: the address they'll sign in with. */
  email?: string | null;
  /** Set when they already have an account. */
  userId?: string | null;
  /** Students: their existing username, if provisioned. */
  username?: string | null;
}

/**
 * Creates or resets a login for anyone.
 *
 * The account is made server-side by the provision-user edge function, which
 * holds the service role key. The password is shown here once so it can be
 * handed over; it isn't stored anywhere readable.
 */
export default function LoginDialog({
  target,
  onClose,
}: {
  target: LoginTarget | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const hasLogin = !!(target?.username || target?.userId);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ signInWith: string; password: string } | null>(null);

  useEffect(() => {
    setPassword(suggestPassword());
    setDone(null);
  }, [target?.recordId, target?.userId, target?.email]);

  const submit = async () => {
    if (!target) return;
    if (password.trim().length < 6) return toast.error("Password must be at least 6 characters");
    if (target.role !== "student" && !target.email) {
      return toast.error(`This ${target.role} needs an email address first.`);
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("provision-user", {
      body: {
        action: hasLogin ? "reset" : "create",
        role: target.role,
        recordId: target.recordId ?? null,
        email: target.email ?? null,
        userId: target.userId ?? null,
        password: password.trim(),
      },
    });
    setBusy(false);

    const failure = error?.message ?? (data as any)?.error;
    if (failure) {
      toast.error(
        /Failed to fetch|404|not found/i.test(failure)
          ? "The provision-user function isn't deployed yet — ask Lovable to deploy it."
          : failure,
      );
      return;
    }

    const signInWith =
      (data as any)?.signInWith ?? target.username ?? target.email ?? "";
    setDone({ signInWith, password: password.trim() });
    toast.success(hasLogin ? "Password reset" : `Login created for ${target.name}`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["teachers"] });
  };

  const copy = () => {
    if (!done) return;
    navigator.clipboard?.writeText(`Sign in with: ${done.signInWith}\nPassword: ${done.password}`);
    toast.success("Copied");
  };

  const label = target?.role === "student" ? "Username" : "Email";

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            {hasLogin ? `Reset password · ${target?.name}` : `Create login · ${target?.name}`}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Give these to {target?.name}. The password isn't stored anywhere you can read again —
              if it's lost, just reset it.
            </p>
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">{label}</span> <strong>{done.signInWith}</strong></div>
              <div><span className="text-muted-foreground">Password</span> <strong>{done.password}</strong></div>
            </div>
            <Button variant="outline" onClick={copy} className="w-full">
              <Copy className="w-4 h-4 mr-1" /> Copy both
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {hasLogin ? (
                <>They keep signing in with <strong>{target?.username ?? target?.email}</strong>, using this new password.</>
              ) : target?.role === "student" ? (
                <>A username is made from their name. They sign in with that and this password — no email needed.</>
              ) : (
                <>They sign in with <strong>{target?.email}</strong> and this password straight away — no invite email required.</>
              )}
            </p>
            <div>
              <Label className="text-xs">Password</Label>
              <div className="flex gap-2 mt-1">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button variant="outline" size="icon" title="Suggest another" onClick={() => setPassword(suggestPassword())}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? "Working…" : hasLogin ? "Reset password" : "Create login"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
