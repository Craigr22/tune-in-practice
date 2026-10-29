import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { toLocalIso } from "@/lib/date";
import { mergePeople, phoneKey, type EnquiryInput, type EnquiryRow, type EnquiryStatus, type StudentRow } from "@/lib/people";

const PAGE = 1000;

/** Every row, a thousand at a time: the API won't hand back more in one go. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** The enquiries tables arrive by migration; before then the page says so. */
const notMigrated = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /enquir/i.test(e.message ?? ""));

export function usePeopleDatabase() {
  const students = useQuery({
    queryKey: ["db-students"],
    queryFn: () =>
      readAll<StudentRow>((a, b) =>
        (supabase as any)
          .from("students")
          .select("id, name, phone, email, parent_name, is_active, joined_on, enrollments(status, batches(code, instruments(name)))")
          .order("name")
          .range(a, b),
      ),
  });
  const enquiries = useQuery({
    queryKey: ["db-enquiries"],
    queryFn: async (): Promise<EnquiryRow[] | null> => {
      try {
        return await readAll<EnquiryRow>((a, b) => (supabase as any).from("enquiries").select("*").order("name").range(a, b));
      } catch (e: any) {
        if (notMigrated(e)) return null;
        throw e;
      }
    },
  });
  const people = useMemo(
    () => mergePeople(students.data ?? [], enquiries.data ?? []),
    [students.data, enquiries.data],
  );
  return {
    people,
    loading: students.isLoading || enquiries.isLoading,
    error: students.error ?? enquiries.error,
    /** False until the database update has been applied. */
    ready: enquiries.data !== null,
    students: students.data ?? [],
    enquiries: enquiries.data ?? [],
  };
}

export function useEnquiryActivity(enquiryId: string | null | undefined) {
  return useQuery({
    queryKey: ["db-activity", enquiryId],
    enabled: !!enquiryId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("enquiry_activity")
        .select("*")
        .eq("enquiry_id", enquiryId)
        .order("at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; at: string; kind: string; body: string | null }[];
    },
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["db-enquiries"] });
    qc.invalidateQueries({ queryKey: ["db-students"] });
    qc.invalidateQueries({ queryKey: ["db-activity"] });
  };
}

/** Change an enquiry, and note what changed in its history. */
export function useUpdateEnquiry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, patch, log }: { id: string; patch: Partial<EnquiryRow>; log?: { kind: string; body?: string } }) => {
      const { error } = await (supabase as any).from("enquiries").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      if (log) await (supabase as any).from("enquiry_activity").insert({ enquiry_id: id, kind: log.kind, body: log.body ?? null });
    },
    onSuccess: refresh,
  });
}

/** Record a call, a message or a note — and that this person was contacted. */
export function useLogContact() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ enquiry, kind, body }: { enquiry: EnquiryRow; kind: "call" | "whatsapp" | "note"; body?: string }) => {
      const { error } = await (supabase as any).from("enquiry_activity").insert({ enquiry_id: enquiry.id, kind, body: body ?? null });
      if (error) throw error;
      if (kind !== "note") {
        await (supabase as any)
          .from("enquiries")
          .update({
            last_contact_at: new Date().toISOString(),
            // Reaching out moves a new enquiry on; it doesn't undo a later stage.
            ...(enquiry.status === "new" ? { status: "contacted" } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", enquiry.id);
      }
    },
    onSuccess: refresh,
  });
}

export function useAddEnquiry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (e: EnquiryInput & { status?: EnquiryStatus }) => {
      const { error } = await (supabase as any).from("enquiries").insert(e);
      if (error) {
        if (/enquiries_phone_key_idx|duplicate key/i.test(error.message)) throw new Error("Someone with that phone number is already in the database.");
        throw error;
      }
    },
    onSuccess: refresh,
  });
}

/**
 * Add a spreadsheet's worth of enquiries. A number already in the database is
 * left as it is, so running the same import twice adds nothing the second
 * time. Anyone who is already a student is linked to them and marked joined.
 */
export function useImportEnquiries() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ rows, students, onProgress }: { rows: EnquiryInput[]; students: StudentRow[]; onProgress?: (done: number) => void }) => {
      const studentByPhone = new Map(students.map((s) => [phoneKey(s.phone), s.id] as const).filter(([k]) => !!k));
      const payload = rows.map((r) => {
        const sid = studentByPhone.get(phoneKey(r.phone));
        return { ...r, ...(sid ? { student_id: sid, status: "joined" } : {}) };
      });
      let done = 0;
      for (let i = 0; i < payload.length; i += 500) {
        const chunk = payload.slice(i, i + 500);
        const { error } = await (supabase as any).from("enquiries").upsert(chunk, { onConflict: "phone_key", ignoreDuplicates: true });
        if (error) throw error;
        done += chunk.length;
        onProgress?.(done);
      }
      return done;
    },
    onSuccess: refresh,
  });
}

/**
 * An enquiry becomes a student: the student record is made from what the
 * enquiry already holds, and the two are linked. Putting them in a class is
 * the next step, in Schedule → Classes.
 */
export function useMakeStudent() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (e: EnquiryRow) => {
      const { data, error } = await supabase
        .from("students")
        .insert({ name: e.name, phone: e.phone, joined_on: toLocalIso(), is_active: true })
        .select("id")
        .single();
      if (error) throw error;
      const { error: linkErr } = await (supabase as any)
        .from("enquiries")
        .update({ student_id: data.id, status: "joined", updated_at: new Date().toISOString() })
        .eq("id", e.id);
      if (linkErr) throw linkErr;
      await (supabase as any).from("enquiry_activity").insert({ enquiry_id: e.id, kind: "status", body: "Joined: made a student" });
      return data.id as string;
    },
    onSuccess: refresh,
  });
}
