import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useClassPhoto, useSetClassPhoto } from "@/hooks/useClassPhoto";
import { ClassPhotoImage } from "@/components/student/ClassPhoto";

/**
 * The class photo, from the teacher's side.
 *
 * Taken on day one and added from the phone it was taken on. The picture is
 * shrunk before it leaves the phone, kept private to the class, and can be
 * swapped or taken down with one tap — someone will ask, sooner or later.
 */
export default function ClassPhotoCard({ batch }: { batch: { id: string; day_of_week: number | null; code?: string | null } }) {
  const photo = useClassPhoto(batch.id);
  const { upload, remove } = useSetClassPhoto(batch);
  const input = useRef<HTMLInputElement>(null);
  const busy = upload.isPending || remove.isPending;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("That isn't a picture");
    try {
      await upload.mutateAsync({ file, replacing: photo?.path });
      toast.success("Class photo added — your students can see it now");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't add the photo");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const takeDown = async () => {
    if (!photo) return;
    try {
      await remove.mutateAsync(photo.path);
      toast.success("Class photo removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove the photo");
    }
  };

  return (
    <div className="rounded-lg border">
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="font-medium text-sm flex items-center gap-2">
          <Camera className="w-4 h-4" /> Class photo
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          A group photo from the first lesson, shown to this class, you and the admins. They can save and share it,
          so add one everyone is happy to see passed on.
        </p>
      </div>

      <div className="p-4 space-y-3">
        {/* The same view the class gets — whole, and opening full-screen with
            Save and Share — so the teacher sees exactly what they've put up. */}
        {photo && <ClassPhotoImage photo={photo} />}
        {/* No `capture`: the teacher chooses between the camera and a photo already taken. */}
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => input.current?.click()} disabled={busy}>
            <Camera className="w-3.5 h-3.5 mr-1.5" />
            {upload.isPending ? "Adding…" : photo ? "Replace photo" : "Add class photo"}
          </Button>
          {photo && (
            <Button size="sm" variant="outline" onClick={takeDown} disabled={busy}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
