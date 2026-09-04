import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { useViewAs } from "@/hooks/useViewAs";

export interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  joined_on: string;
  user_id: string | null;
}

/** The student record for the signed-in user — or the one an admin is viewing. */
export function useStudentMe() {
  const { user, actualRole } = useAuth();
  const viewAs = useViewAs();
  const viewing = actualRole === "admin" && viewAs?.role === "student" ? viewAs.id : null;

  return useQuery({
    queryKey: ["student-me", user?.id, viewing],
    enabled: !!user?.id,
    queryFn: async (): Promise<StudentRow | null> => {
      const q = supabase.from("students").select("id, name, email, joined_on, user_id");
      const { data, error } = viewing
        ? await q.eq("id", viewing).maybeSingle()
        : await q.eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
