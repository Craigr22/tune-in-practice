import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useTeacherMe } from "./useTeacherMe";

// All students enrolled in batches taught by the current teacher, grouped by batch.
export function useTeacherStudents() {
  const { data: teacher } = useTeacherMe();
  const teacherId = teacher?.id;
  return useQuery({
    queryKey: ["teacher-students", teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const { data: batches, error: bErr } = await supabase
        .from("batches")
        .select("*, locations(name), instruments(name)")
        .eq("teacher_id", teacherId!)
        .eq("is_active", true);
      if (bErr) throw bErr;

      const batchIds = (batches ?? []).map((b) => b.id);
      if (!batchIds.length) return [];

      const { data: enrollments, error: eErr } = await supabase
        .from("enrollments")
        .select("batch_id, status, students(*)")
        .in("batch_id", batchIds)
        .eq("status", "active");
      if (eErr) throw eErr;

      return (batches ?? []).map((b: any) => ({
        batch: b,
        students: (enrollments ?? [])
          .filter((e: any) => e.batch_id === b.id)
          .map((e: any) => e.students)
          .filter(Boolean),
      }));
    },
  });
}

// Per-student practice + attendance + song_progress (for sparkline, retention, badges).
export function useStudentDetail(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-detail", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const [practiceResult, attendanceResult, progressResult, lastSeenResult] = await Promise.all([
        supabase
          .from("practice_logs")
          .select("*")
          .eq("student_id", studentId!)
          .gte("played_on", new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10))
          .order("played_on", { ascending: true }),
        supabase
          .from("attendance")
          .select("*, sessions(scheduled_date)")
          .eq("student_id", studentId!),
        supabase.from("song_progress").select("*").eq("student_id", studentId!),
        (supabase as any).rpc("get_student_last_seen", { _student_id: studentId! }),
      ]);
      const firstError =
        practiceResult.error ??
        attendanceResult.error ??
        progressResult.error ??
        lastSeenResult.error;
      if (firstError) throw firstError;

      const practice = practiceResult.data;
      const attendance = attendanceResult.data;
      const progress = progressResult.data;
      return {
        practice: practice ?? [],
        attendance: (attendance ?? []).map((a: any) => ({ ...a, session_date: a.sessions?.scheduled_date })),
        progress: progress ?? [],
        lastSeenAt: (lastSeenResult.data as string | null) ?? null,
      };
    },
  });
}

/**
 * Sessions finished, per student: the number a student sees beside their own
 * chick. One distinct day of practice is one session, and nothing takes one
 * away.
 */
export function sessionCounts(logs: { student_id: string; played_on: string }[]): Map<string, number> {
  const days = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!days.has(l.student_id)) days.set(l.student_id, new Set());
    days.get(l.student_id)!.add(l.played_on);
  }
  return new Map([...days].map(([id, set]) => [id, set.size]));
}

export interface Standing {
  id: string;
  name: string;
  sessions: number;
  /** Ties share a place: two students on four are both second. */
  place: number;
}

/** A class in order of sessions finished, most first; names break ties. */
export function standings(students: { id: string; name: string }[], counts: Map<string, number>): Standing[] {
  const rows = students
    .map((s) => ({ id: s.id, name: s.name, sessions: counts.get(s.id) ?? 0 }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  let place = 0;
  let previous: number | null = null;
  return rows.map((r, i) => {
    if (previous === null || r.sessions !== previous) place = i + 1;
    previous = r.sessions;
    return { ...r, place };
  });
}

/** Sessions finished by each of the given students, read in one go. */
export function useSessionCounts(studentIds: string[]) {
  const ids = [...studentIds].sort();
  return useQuery({
    queryKey: ["session-counts", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Map<string, number>> => {
      const logs: { student_id: string; played_on: string }[] = [];
      // The API hands back at most a thousand rows at a time.
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("practice_logs")
          .select("student_id, played_on")
          .in("student_id", ids)
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        logs.push(...((data ?? []) as { student_id: string; played_on: string }[]));
        if (!data || data.length < 1000) break;
      }
      return sessionCounts(logs);
    },
  });
}
