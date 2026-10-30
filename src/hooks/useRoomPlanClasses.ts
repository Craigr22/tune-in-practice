import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

/**
 * Weekly classes kept only for room efficiency (loaded from the class and
 * teacher workbook). They are not portal classes and have no student records.
 */
export function useRoomPlanClasses() {
  return useQuery({
    queryKey: ["room-plan-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_plan_classes")
        .select("*")
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });
}
