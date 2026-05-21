import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/db";

export type AppRole = "admin" | "teacher" | "student";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** Effective role used for navigation and UI gating. For admins, this reflects the current "View as" selection. */
  role: AppRole | null;
  /** The user's real role from the database. */
  actualRole: AppRole | null;
  /** Admins only: switch which role the UI behaves as. Pass null to reset to actual role. */
  setViewAs: (r: AppRole | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const VIEW_AS_KEY = "bam:viewAs";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [actualRole, setActualRole] = useState<AppRole | null>(null);
  const [viewAs, setViewAsState] = useState<AppRole | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(VIEW_AS_KEY);
    return v === "admin" || v === "teacher" || v === "student" ? v : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setActualRole(null);
        setViewAsState(null);
        try { window.localStorage.removeItem(VIEW_AS_KEY); } catch {}
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      setActualRole(resolved);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const setViewAs = (r: AppRole | null) => {
    setViewAsState(r);
    try {
      if (r) window.localStorage.setItem(VIEW_AS_KEY, r);
      else window.localStorage.removeItem(VIEW_AS_KEY);
    } catch {}
  };

  // Only admins may override.
  const effectiveRole: AppRole | null =
    actualRole === "admin" && viewAs ? viewAs : actualRole;

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    role: effectiveRole,
    actualRole,
    setViewAs,
    loading,
    signOut: async () => { await supabase.auth.signOut(); },
  }), [session, effectiveRole, actualRole, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
