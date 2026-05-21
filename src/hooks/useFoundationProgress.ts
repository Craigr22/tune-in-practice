import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";

export interface FoundationProgressRow {
  id: string;
  student_id: string;
  foundation_id: string;
  completed_at: string;
}

export function useFoundationProgress() {
  const { data: student } = useStudentMe();
  return useQuery({
    queryKey: ["foundation-progress", student?.id],
    enabled: !!student?.id,
    queryFn: async (): Promise<FoundationProgressRow[]> => {
      const { data, error } = await supabase
        .from("foundation_progress")
        .select("*")
        .eq("student_id", student!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMarkFoundationComplete() {
  const qc = useQueryClient();
  const { data: student } = useStudentMe();
  return useMutation({
    mutationFn: async ({ foundationId }: { foundationId: string }) => {
      if (!student?.id) throw new Error("Not linked to a student record yet");
      const { error } = await supabase
        .from("foundation_progress")
        .upsert(
          { student_id: student.id, foundation_id: foundationId },
          { onConflict: "student_id,foundation_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["foundation-progress"] }),
  });
}
