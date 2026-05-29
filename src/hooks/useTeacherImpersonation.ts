import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";

const KEY = "viewAsTeacherId";
const EVT = "viewAsTeacherIdChange";

export function getImpersonatedTeacherId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setImpersonatedTeacherId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}

export function useImpersonatedTeacherId(): string | null {
  const [id, setId] = useState<string | null>(() => getImpersonatedTeacherId());
  useEffect(() => {
    const handler = () => setId(getImpersonatedTeacherId());
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return id;
}

export function useTeacherList(enabled: boolean) {
  return useQuery({
    queryKey: ["teacher-list-basic"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Returns true if the current authed admin is impersonating a teacher.
 */
export function useIsImpersonating() {
  const { actualRole, role } = useAuth();
  const id = useImpersonatedTeacherId();
  return actualRole === "admin" && role === "teacher" && !!id;
}
