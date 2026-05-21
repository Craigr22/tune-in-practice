import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";

export interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  joined_on: string;
  user_id: string | null;
}

export function useStudentMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student-me", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<StudentRow | null> => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, email, joined_on, user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
