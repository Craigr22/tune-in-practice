import { useState } from "react";
import { supabase } from "@/lib/db";
import { loginCandidates } from "@/lib/studentLogin";

/** Supabase's way of saying the identity or the password was wrong. */
function isBadCredentials(error: unknown): boolean {
  const e = error as { code?: string; status?: number; message?: string };
  return e?.code === "invalid_credentials" || e?.status === 400;
}

/**
 * "Invalid login credentials" tells a ten-year-old nothing, and it is the one
 * message they are most likely to meet. It says what to check instead.
 */
function signInMessage(error: unknown): string {
  if (isBadCredentials(error)) {
    return "That doesn't match an account. Students sign in with a username — usually first.last, like payal.malviya — not an email. Ask your teacher if you're not sure.";
  }
  // Anything else — rate limited, network down, account disabled — says what
  // it says; swallowing it into "Authentication failed" hides the one detail
  // that would tell someone whether to wait or to ask for help.
  const message = (error as { message?: string } | null)?.message;
  return message || "Authentication failed";
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      // Accounts are provisioned by an admin. Students sign in with a username;
      // the account behind it uses a synthetic address that never receives mail.
      // What a student types is turned into a username the same way the
      // provisioning function makes one, so typing their own name works, and a
      // record email that no account answers to gets one more try as a
      // username before they are told they got it wrong.
      const candidates = loginCandidates(email);
      if (!candidates.length) throw new Error("Enter your username or email.");

      let lastError: unknown = null;
      for (const address of candidates) {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (!error) return;
        lastError = error;
        // Only a rejected identity is worth another attempt — a rate limit or
        // a network failure means stop, not try again immediately.
        if (!isBadCredentials(error)) break;
      }
      throw lastError ?? new Error("Authentication failed");
    } catch (e: unknown) {
      setErr(signInMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** Emails a recovery link that lands on /reset-password. */
  const forgotPassword = async () => {
    if (!email) { setErr("Enter your email first, then tap this again."); return; }
    if (!email.includes("@")) {
      setErr("Usernames can't be reset by email — ask your teacher to set a new password for you.");
      return;
    }
    setErr(null); setMsg(null); setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMsg("Password reset link sent — check your inbox.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not send the reset link");
    } finally {
      setBusy(false);
    }
  };

  const magic = async () => {
    if (!email) { setErr("Enter your email first."); return; }
    if (!email.includes("@")) {
      setErr("Magic links need an email address. Sign in with your username and password instead.");
      return;
    }
    setErr(null); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setMsg("Magic link sent — check your inbox.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not send magic link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--paper)", padding: 24,
    }}>
      <form onSubmit={submit} className="bam-card" style={{ width: "100%", maxWidth: 380, padding: 28 }}>
        <div className="brand text-center" style={{ marginBottom: 18 }}>
          <span className="dot"></span>bam
        </div>
        <h2 style={{ marginBottom: 4 }}>Sign in</h2>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 18 }}>
          BAM Academy of Music
        </p>

        <label
          htmlFor="login-id"
          style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}
        >
          Username or email
        </label>
        <input
          // Students type a username, so this can't be type="email".
          id="login-id"
          type="text"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your username, or your email"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-strong)", borderRadius: 8, marginBottom: 12, fontSize: 14 }}
        />

        <label
          htmlFor="login-password"
          style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}
        >
          Password
        </label>
        <input
          id="login-password"
          type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-strong)", borderRadius: 8, marginBottom: 14, fontSize: 14 }}
        />

        {err && <div style={{ color: "var(--terracotta)", fontSize: 12, marginBottom: 10 }}>{err}</div>}
        {msg && <div style={{ color: "var(--olive)", fontSize: 12, marginBottom: 10 }}>{msg}</div>}

        <button type="submit" disabled={busy} className="bam-cta" style={{ width: "100%", marginBottom: 8 }}>
          {busy ? "…" : "Sign in"}
        </button>
        <button type="button" onClick={magic} disabled={busy} className="bam-cta bam-cta-gold" style={{ width: "100%", marginBottom: 12 }}>
          Email me a magic link
        </button>

        <button type="button" onClick={forgotPassword} disabled={busy}
          style={{ background: "none", border: 0, color: "var(--navy)", fontSize: 12, cursor: "pointer", width: "100%", marginBottom: 8, textDecoration: "underline" }}>
          Forgot your password?
        </button>

        <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 14, lineHeight: 1.5, textAlign: "center" }}>
          Need an account? Ask your BAM administrator.
        </p>
      </form>
    </div>
  );
};

export default Login;
