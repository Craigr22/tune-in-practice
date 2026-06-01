import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

export function useTeachers() {
  return useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teachers").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type TeacherInput = {
  name: string;
  email: string | null;
  phone: string | null;
  rate: number;
  payment_type: "per_hour" | "per_session" | "fixed_monthly";
  payout_cycle: string;
  instruments: string[];
  is_active?: boolean;
};

export function useSaveTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: TeacherInput & { id?: string }) => {
      if (id) {
        const { error } = await supabase.from("teachers").update(values as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teachers").insert(values as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useSetTeacherActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("teachers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });
}

export function useInstruments() {
  return useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("instruments").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
