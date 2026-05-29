import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonatedStudentId } from "@/hooks/useStudentImpersonation";

export interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  joined_on: string;
  user_id: string | null;
}

export function useStudentMe() {
  const { user, actualRole, role } = useAuth();
  const impersonatedId = useImpersonatedStudentId();
  const useImpersonation = actualRole === "admin" && role === "student" && !!impersonatedId;

  return useQuery({
    queryKey: ["student-me", user?.id, useImpersonation ? impersonatedId : null],
    enabled: !!user?.id,
    queryFn: async (): Promise<StudentRow | null> => {
      const query = supabase.from("students").select("id, name, email, joined_on, user_id");
      const { data, error } = useImpersonation
        ? await query.eq("id", impersonatedId!).maybeSingle()
        : await query.eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
