import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonatedTeacherId } from "@/hooks/useTeacherImpersonation";

export function useTeacherMe() {
  const { user, actualRole, role } = useAuth();
  const impersonatedId = useImpersonatedTeacherId();
  const useImpersonation = actualRole === "admin" && role === "teacher" && !!impersonatedId;

  return useQuery({
    queryKey: ["teacher-me", user?.id, useImpersonation ? impersonatedId : null],
    enabled: !!user,
    queryFn: async () => {
      if (useImpersonation) {
        const { data, error } = await supabase
          .from("teachers")
          .select("*")
          .eq("id", impersonatedId!)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
