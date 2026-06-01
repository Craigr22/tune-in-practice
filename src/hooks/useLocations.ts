import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
