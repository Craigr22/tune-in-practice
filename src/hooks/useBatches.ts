import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

export function useBatches() {
  return useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("batches").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}
