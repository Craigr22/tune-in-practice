import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/db";

/**
 * Admin-only "view as": look at the app as a particular teacher or student.
 *
 * This is a client-side lens, not a security boundary — the database still
 * sees the signed-in admin, who can read this data anyway. It exists so an
 * admin can check what a real person actually sees.
 */
export type ViewAs = { role: "teacher" | "student"; id: string; name: string } | null;

const KEY = "bam:viewAsUser";
const listeners = new Set<() => void>();
let cached: ViewAs | undefined;

function read(): ViewAs {
  if (cached !== undefined) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as ViewAs) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function setViewAs(v: ViewAs) {
  cached = v;
  try {
    if (v) window.localStorage.setItem(KEY, JSON.stringify(v));
    else window.localStorage.removeItem(KEY);
  } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export function useViewAs(): ViewAs {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => null,
  );
}

/** Everyone an admin can look through: teachers first, then students. */
export function useViewableAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ["viewable-accounts"],
    enabled,
    queryFn: async () => {
      const [{ data: teachers }, { data: students }] = await Promise.all([
        supabase.from("teachers").select("id, name").order("name"),
        supabase.from("students").select("id, name").order("name"),
      ]);
      return [
        ...(teachers ?? []).map((t) => ({ role: "teacher" as const, id: t.id, name: t.name })),
        ...(students ?? []).map((s) => ({ role: "student" as const, id: s.id, name: s.name })),
      ];
    },
  });
}
