import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";

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
    }) => {
      let sessionId = args.sessionId;
      if (!sessionId) {
        const { data, error } = await supabase
          .from("sessions")
          .insert({
            batch_id: args.batchId,
            scheduled_date: args.scheduledDate,
            status: "completed",
            teacher_notes: args.teacherNotes,
            completed_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        sessionId = data.id;
      } else {
        const { error } = await supabase
          .from("sessions")
          .update({
            status: "completed",
            teacher_notes: args.teacherNotes,
            completed_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
        if (error) throw error;
      }

      if (args.attendance.length) {
        const rows = args.attendance.map((a) => ({
          session_id: sessionId!,
          student_id: a.student_id,
          status: a.status,
        }));
        const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "session_id,student_id" });
        if (error) {
          // Fallback: insert without conflict target
          const { error: e2 } = await supabase.from("attendance").insert(rows);
          if (e2) throw e2;
        }
      }

      for (const u of args.badgeUpdates) {
        const { data: existing } = await supabase
          .from("song_progress")
          .select("id")
          .eq("student_id", u.student_id)
          .eq("song_id", u.song_id)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("song_progress")
            .update({ teacher_badge: u.teacher_badge, last_updated: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("song_progress")
            .insert({ student_id: u.student_id, song_id: u.song_id, teacher_badge: u.teacher_badge });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-today"] });
      qc.invalidateQueries({ queryKey: ["teacher-students"] });
    },
  });
}
