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

export interface StudentLoginTarget {
  id: string;
  name: string;
  /** Existing username, if they already have a login. */
  username: string | null;
}

/**
 * Creates or resets a student's username + password login.
 *
 * The account itself is made server-side by the provision-student edge
 * function, which holds the service role key. Nothing secret is in the app;
 * the password is shown here once so it can be handed to the student.
 */
export default function StudentLoginDialog({
  student,
  onClose,
}: {
  student: StudentLoginTarget | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isReset = !!student?.username;
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ username: string; password: string } | null>(null);

  useEffect(() => {
    setPassword(suggestPassword());
    setDone(null);
  }, [student?.id]);

  const submit = async () => {
    if (!student) return;
    if (password.trim().length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("provision-student", {
      body: {
        action: isReset ? "reset" : "create",
        studentId: student.id,
        password: password.trim(),
      },
    });
    setBusy(false);

    const failure = error?.message ?? (data as any)?.error;
    if (failure) {
      toast.error(
        failure.includes("Failed to fetch") || failure.includes("404")
          ? "The provision-student function isn't deployed yet — ask Lovable to deploy it."
          : failure,
      );
      return;
    }

    const username = (data as any)?.username ?? student.username ?? "";
    setDone({ username, password: password.trim() });
    toast.success(isReset ? "Password reset" : `Login created for ${student.name}`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const copy = () => {
    if (!done) return;
    navigator.clipboard?.writeText(`Username: ${done.username}\nPassword: ${done.password}`);
    toast.success("Copied");
  };

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            {isReset ? `Reset password · ${student?.name}` : `Create login · ${student?.name}`}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Give these to {student?.name}. The password isn't stored anywhere you can read it
              again — if it's lost, just reset it.
            </p>
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Username</span> <strong>{done.username}</strong></div>
              <div><span className="text-muted-foreground">Password</span> <strong>{done.password}</strong></div>
            </div>
            <Button variant="outline" onClick={copy} className="w-full">
              <Copy className="w-4 h-4 mr-1" /> Copy both
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isReset
                ? <>They'll keep the username <strong>{student?.username}</strong> and sign in with this new password.</>
                : <>A username is made from their name. They sign in with that and this password — no email needed.</>}
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
                {busy ? "Working…" : isReset ? "Reset password" : "Create login"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
