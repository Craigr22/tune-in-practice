import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";

const KEY = "viewAsStudentId";
const EVT = "viewAsStudentIdChange";

export function getImpersonatedStudentId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setImpersonatedStudentId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}

export function useImpersonatedStudentId(): string | null {
  const [id, setId] = useState<string | null>(() => getImpersonatedStudentId());
  useEffect(() => {
    const handler = () => setId(getImpersonatedStudentId());
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return id;
}

export function useStudentList(enabled: boolean) {
  return useQuery({
    queryKey: ["student-list-basic"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useIsImpersonatingStudent() {
  const { actualRole, role } = useAuth();
  const id = useImpersonatedStudentId();
  return actualRole === "admin" && role === "student" && !!id;
}
