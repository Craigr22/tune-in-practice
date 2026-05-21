import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/db";

export type AppRole = "admin" | "teacher" | "student";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener first, then initial getSession (per auth pattern).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch role whenever user changes.
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .order("role", { ascending: true });
      if (cancelled) return;
      const roles = (data || []).map((r) => r.role as AppRole);
      const resolved: AppRole | null =
        roles.includes("admin") ? "admin" :
        roles.includes("teacher") ? "teacher" :
        roles.includes("student") ? "student" : null;
      setRole(resolved);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    role,
    loading,
    signOut: async () => { await supabase.auth.signOut(); },
  }), [session, role, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
