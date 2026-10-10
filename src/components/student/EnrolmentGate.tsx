import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";

/**
 * A student who has been de-registered no longer gets the course.
 *
 * Only for someone whose every enrolment has ended. A student not yet put in
 * a class is left alone — they have nothing to lose access to, and locking
 * them out would greet a brand-new student with a closed door.
 */
export default function EnrolmentGate({ children }: { children: ReactNode }) {
  const { data: student } = useStudentMe();
  const { data: left } = useQuery({
    queryKey: ["student-enrolment", student?.id],
    enabled: !!student?.id,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from("enrollments").select("status").eq("student_id", student!.id);
      // If this can't be read, don't shut anyone out over it.
      if (error || !data?.length) return false;
      return !data.some((e) => e.status === "active") && data.some((e) => e.status === "dropped");
    },
  });

  if (!left) return <>{children}</>;
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>Your class has ended</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
        You're no longer registered for a class, so the lessons aren't available. If you'd like to
        come back, speak to BAM Academy of Music and we'll get you set up again.
      </p>
    </div>
  );
}
