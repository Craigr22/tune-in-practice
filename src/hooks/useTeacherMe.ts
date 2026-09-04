import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { useViewAs } from "@/hooks/useViewAs";

/** The teacher record for the signed-in user — or the one an admin is viewing. */
export function useTeacherMe() {
  const { user, actualRole } = useAuth();
  const viewAs = useViewAs();
  const viewing = actualRole === "admin" && viewAs?.role === "teacher" ? viewAs.id : null;

  return useQuery({
    queryKey: ["teacher-me", user?.id, viewing],
    enabled: !!user,
    queryFn: async () => {
      const q = supabase.from("teachers").select("*");
      const { data, error } = viewing
        ? await q.eq("id", viewing).maybeSingle()
        : await q.eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
