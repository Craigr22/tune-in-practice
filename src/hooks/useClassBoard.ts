import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";

export interface ClassBoardRow {
  student_id: string;
  display_name: string;
  sessions: number;
  is_me: boolean;
}

/**
 * How the student's own class is doing, most sessions first.
 *
 * A student can read only their own row and their own practice, so none of
 * this can be queried from the page: it comes from one function that returns
 * a display name and a count for the classes the caller is in, and nothing
 * else. Surnames never leave the server.
 */
export function useClassBoard() {
  const { data: student } = useStudentMe();
  return useQuery({
    queryKey: ["class-board", student?.id],
    enabled: !!student?.id,
    queryFn: async (): Promise<ClassBoardRow[] | null> => {
      const { data, error } = await (supabase as any).rpc("class_session_counts");
      // The function arrives by migration. Until then the board simply isn't
      // there, rather than the page showing an error a student can do nothing
      // about. Real failures still surface.
      if (error) {
        if (error.code === "PGRST202" || /class_session_counts|schema cache/i.test(error.message)) {
          return null;
        }
        throw error;
      }
      return (data ?? []) as ClassBoardRow[];
    },
  });
}

/**
 * Standings, with ties sharing a place.
 *
 * Two students on four sessions are both second; the next is fourth. Giving
 * one of them third for being earlier in the alphabet would be inventing a
 * difference that isn't there.
 */
export function withPlaces(rows: ClassBoardRow[]): (ClassBoardRow & { place: number })[] {
  let place = 0;
  let previous: number | null = null;
  return rows.map((row, i) => {
    if (previous === null || row.sessions !== previous) place = i + 1;
    previous = row.sessions;
    return { ...row, place };
  });
}
