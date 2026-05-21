import { useState } from "react";
import { supabase } from "@/lib/db";

const Login = () => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMsg("Account created — you can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const magic = async () => {
    if (!email) { setErr("Enter your email first."); return; }
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
        <div className="brand" style={{ marginBottom: 18 }}>
          <span className="dot"></span>bam <span className="uku">Ukulele · Sem 1</span>
        </div>
        <h2 style={{ marginBottom: 4 }}>{mode === "signup" ? "Create account" : "Sign in"}</h2>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 18 }}>
          BAM Academy of Music
        </p>

        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-strong)", borderRadius: 8, marginBottom: 12, fontSize: 14 }}
        />

        <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Password</label>
        <input
          type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-strong)", borderRadius: 8, marginBottom: 14, fontSize: 14 }}
        />

        {err && <div style={{ color: "var(--terracotta)", fontSize: 12, marginBottom: 10 }}>{err}</div>}
        {msg && <div style={{ color: "var(--olive)", fontSize: 12, marginBottom: 10 }}>{msg}</div>}

        <button type="submit" disabled={busy} className="bam-cta" style={{ width: "100%", marginBottom: 8 }}>
          {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button type="button" onClick={magic} disabled={busy} className="bam-cta bam-cta-gold" style={{ width: "100%", marginBottom: 12 }}>
          Email me a magic link
        </button>

        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); setMsg(null); }}
          style={{ background: "none", border: 0, color: "var(--ink-soft)", fontSize: 12, cursor: "pointer", width: "100%" }}>
          {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
        </button>

        <p style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 14, lineHeight: 1.5, textAlign: "center" }}>
          The first account created automatically becomes the admin.
        </p>
      </form>
    </div>
  );
};

export default Login;
