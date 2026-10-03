import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useStudentMe } from "@/hooks/useStudentMe";
import { classPhotoPath, shrinkImage } from "@/lib/classPhoto";
import { onOrBeforeDayOfWeek, toLocalIso } from "@/lib/date";

export interface ClassPhoto {
  batchId: string;
  path: string;
  /** A link that works for an hour; the file itself is never public. */
  url: string;
  takenOn: string | null;
}

/** True when the class-photo migration hasn't reached the database yet. */
const notMigrated = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || e.code === "42703" || /photo_path|photo_taken_on|set_class_photo|schema cache|Bucket not found/i.test(e.message ?? ""));

async function loadPhoto(batchId: string): Promise<ClassPhoto | null> {
  const { data, error } = await (supabase as any)
    .from("batches")
    .select("id, photo_path, photo_taken_on")
    .eq("id", batchId)
    .maybeSingle();
  // The columns arrive by migration. Until then there is simply no photo.
  if (error) {
    if (notMigrated(error)) return null;
    throw error;
  }
  if (!data?.photo_path) return null;
  const { data: signed, error: signErr } = await supabase.storage
    .from("class_photos")
    .createSignedUrl(data.photo_path, 60 * 60);
  if (signErr || !signed?.signedUrl) return null;
  return { batchId, path: data.photo_path, url: signed.signedUrl, takenOn: data.photo_taken_on ?? null };
}

/**
 * A class's photo, for the people allowed to see it.
 *
 * Given a class, it loads that class's. Given none, it finds the signed-in
 * student's own class first. Either way the picture comes back as a link that
 * lasts an hour — the bucket is private, and who may read a file is decided by
 * the class id in its path.
 */
export function useClassPhoto(batchId?: string | null): ClassPhoto | null {
  const { data: student } = useStudentMe();
  const forStudent = batchId === undefined;
  const { data } = useQuery({
    queryKey: ["class-photo", forStudent ? `student:${student?.id}` : batchId],
    enabled: forStudent ? !!student?.id : !!batchId,
    // The signed link lasts an hour; refresh it well before that.
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<ClassPhoto | null> => {
      let id = batchId ?? null;
      if (forStudent) {
        const { data: enrol } = await supabase
          .from("enrollments")
          .select("batch_id")
          .eq("student_id", student!.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        id = (enrol as { batch_id: string } | null)?.batch_id ?? null;
      }
      return id ? loadPhoto(id) : null;
    },
  });
  return data ?? null;
}

/** Add, replace or take down a class's photo. For its teacher, or an admin. */
export function useSetClassPhoto(batch: { id: string; day_of_week: number | null }) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["class-photo"] });

  const upload = useMutation({
    mutationFn: async ({ file, replacing }: { file: File; replacing?: string | null }) => {
      const blob = await shrinkImage(file);
      const path = classPhotoPath(batch.id);
      const { error: upErr } = await supabase.storage
        .from("class_photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw notMigrated(upErr) ? new Error("Class photos aren't switched on yet — the database update hasn't been applied.") : upErr;

      // The day it was taken: the most recent class, so a photo added on the
      // Monday still belongs to Sunday's lesson.
      const today = toLocalIso();
      const takenOn = batch.day_of_week == null ? today : onOrBeforeDayOfWeek(today, batch.day_of_week);
      const { error } = await (supabase as any).rpc("set_class_photo", {
        _batch_id: batch.id,
        _path: path,
        _taken_on: takenOn,
      });
      if (error) {
        // Don't leave a file nothing points at.
        await supabase.storage.from("class_photos").remove([path]);
        throw notMigrated(error) ? new Error("Class photos aren't switched on yet — the database update hasn't been applied.") : error;
      }
      if (replacing && replacing !== path) await supabase.storage.from("class_photos").remove([replacing]);
    },
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: async (path: string) => {
      const { error } = await (supabase as any).rpc("set_class_photo", { _batch_id: batch.id, _path: null });
      if (error) throw error;
      await supabase.storage.from("class_photos").remove([path]);
    },
    onSuccess: done,
  });

  return { upload, remove };
}
