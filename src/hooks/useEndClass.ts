import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { rpcError } from "@/lib/rpc";

export interface AttendanceEntry {
  student_id: string;
  status: "present" | "late" | "absent";
}

export interface BadgeUpdate {
  student_id: string;
  song_id: string;
  teacher_badge: number;
}

export function useEndClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      batchId: string;
      sessionId?: string | null;
      scheduledDate: string;
      teacherNotes: string;
      attendance: AttendanceEntry[];
      badgeUpdates: BadgeUpdate[];
    }): Promise<string> => {
      // One call, one transaction. As separate writes this could complete the
      // session and then fail part-way through attendance, leaving a class
      // marked done with only some of the register filled in — and no way for
      // the teacher to tell which.
      const { data, error } = await (supabase as any).rpc("end_class", {
        p_batch_id: args.batchId,
        p_session_id: args.sessionId ?? null,
        p_scheduled_date: args.scheduledDate,
        p_teacher_notes: args.teacherNotes,
        p_attendance: args.attendance,
        p_badges: args.badgeUpdates,
      });
      if (error) throw rpcError(error, "Ending the class");
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-today"] });
      qc.invalidateQueries({ queryKey: ["teacher-students"] });
      qc.invalidateQueries({ queryKey: ["teacher-sessions"] });
      qc.invalidateQueries({ queryKey: ["student-detail"] });
    },
  });
}
