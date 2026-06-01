import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

export interface ExpenseRow {
  id: string;
  location_id: string | null;
  category: string;
  amount: number;
  incurred_on: string;
  notes: string | null;
  locations?: { name: string } | null;
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, locations(name)")
        .order("incurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
  });
}

type ExpenseInput = {
  category: string;
  amount: number;
  incurred_on: string;
  location_id: string | null;
  notes: string | null;
};

export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: ExpenseInput & { id?: string }) => {
      if (id) {
        const { error } = await supabase.from("expenses").update(values as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(values as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}
