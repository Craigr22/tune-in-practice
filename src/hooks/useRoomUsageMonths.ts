import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

export function useRoomUsageMonths() {
  return useQuery({
    queryKey: ["room-usage-months"],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_usage_months").select("*").order("month");
      if (error) throw error;
      return data ?? [];
    },
  });
}
