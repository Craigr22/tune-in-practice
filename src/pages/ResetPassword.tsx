import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/db";

/**
 * Where the "forgot password" email lands. Supabase turns the link into a
 * recovery session, so the person can set a new password here.
 *
 * It doubles as "set a password" for anyone who joined by magic link and
 * never had one — if they're signed in, they can set it from here too.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The recovery token arrives in the URL and is exchanged for a session,
    // which can land just after mount — so listen as well as check.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (password.length < 6) { setErr("Use at least 6 characters."); return; }
    if (password !== confirm) { setErr("Those two passwords don't match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg("Password saved. Taking you in…");
      setTimeout(() => navigate("/"), 1200);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not save the password");
    } finally {
      setBusy(false);
    }
  };

  const label: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: ".08em", marginBottom: 6,
  };
  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1px solid var(--border-strong)",
    borderRadius: 8, marginBottom: 12, fontSize: 14,
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--paper)", padding: 24 }}>
      <div className="bam-card" style={{ width: "100%", maxWidth: 380, padding: 28 }}>
        <div className="brand text-center" style={{ marginBottom: 18 }}>
          <span className="dot"></span>bam <span className="uku">​</span>
        </div>

        {!ready ? (
          <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>Checking your link…</p>
        ) : !hasSession ? (
          <>
            <h2 style={{ marginBottom: 4 }}>This link has expired</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 18 }}>
              Reset links can only be used once, and they don't last long. Head back and request a
              fresh one.
            </p>
            <button onClick={() => navigate("/")} className="bam-cta" style={{ width: "100%" }}>
              Back to sign in
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 style={{ marginBottom: 4 }}>Choose a password</h2>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 18 }}>
              You'll use this with your email to sign in from now on.
            </p>

            <label style={label}>New password</label>
            <input
              type="password" required minLength={6} autoFocus value={password}
              onChange={(e) => setPassword(e.target.value)} style={input}
            />

            <label style={label}>Confirm password</label>
            <input
              type="password" required minLength={6} value={confirm}
              onChange={(e) => setConfirm(e.target.value)} style={input}
            />

            {err && <div style={{ color: "var(--terracotta)", fontSize: 12, marginBottom: 10 }}>{err}</div>}
            {msg && <div style={{ color: "var(--olive)", fontSize: 12, marginBottom: 10 }}>{msg}</div>}

            <button type="submit" disabled={busy} className="bam-cta" style={{ width: "100%" }}>
              {busy ? "Saving…" : "Save password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
