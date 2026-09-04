import { useRef, useState } from "react";
import {
  useCourseVideos,
  useUploadCourseVideo,
  useUpdateCourseVideo,
  useDeleteCourseVideo,
  useSignedVideoUrls,
  type CourseVideo,
} from "@/hooks/useCourseVideos";
import { useCatalogSongs, type Instrument } from "@/hooks/useSongCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Film, Upload, Trash2, ExternalLink, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

const MAX_MB = 1024;

export default function VideoManager({ instrument }: { instrument: Instrument }) {
  const { data: videos = [], isLoading } = useCourseVideos(instrument);
  const { data: urls = {} } = useSignedVideoUrls(videos.map((v) => v.storage_path));
  const songs = useCatalogSongs(instrument);
  const upload = useUploadCourseVideo();
  const update = useUpdateCourseVideo();
  const del = useDeleteCourseVideo();

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [songId, setSongId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const [confirmDel, setConfirmDel] = useState<CourseVideo | null>(null);
  const [preview, setPreview] = useState<CourseVideo | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const songTitle = (id: string | null) => songs.find((s) => s.id === id)?.title;

  const resetForm = () => {
    setTitle("");
    setSongId("none");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEdit = (video: CourseVideo) => {
    setEditingId(video.id);
    setEditTitle(video.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    try {
      await update.mutateAsync({ id: editingId, instrument, title: editTitle.trim() });
      toast.success("Title updated");
      cancelEdit();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update title");
    }
  };

  const doUpload = async () => {
    if (!file) return toast.error("Pick a video file");
    if (!title.trim()) return toast.error("Title is required");
    if (file.size > MAX_MB * 1024 * 1024)
      return toast.error(`Video is too large — keep it under ${MAX_MB} MB`);
    try {
      await upload.mutateAsync({
        instrument,
        file,
        title: title.trim(),
        song_id: songId === "none" ? null : songId,
      });
      toast.success("Video uploaded");
      setFormOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await del.mutateAsync(confirmDel);
      toast.success("Video removed");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove");
    }
    setConfirmDel(null);
  };

  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
        <div>
          <div className="font-medium text-sm flex items-center gap-2">
            <Film className="w-4 h-4" /> Course videos
          </div>
          <p className="text-xs text-muted-foreground">
            Tutorial & demo clips for this course{videos.length ? ` · ${videos.length} uploaded` : ""}.
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Upload className="w-4 h-4 mr-1" /> Upload video
        </Button>
      </div>

      {isLoading ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
      ) : videos.length === 0 ? (
        <div className="px-4 py-8 text-center text-muted-foreground text-sm">
          No videos yet. Upload a tutorial to get started.
        </div>
      ) : (
        <div className="divide-y">
          {videos.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
              <button
                onClick={() => setPreview(v)}
                className="w-24 h-14 rounded-md bg-black/80 grid place-items-center shrink-0 hover:opacity-80"
                title="Preview"
              >
                <span className="text-white text-lg">▶</span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{v.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {songTitle(v.song_id) ? `🎵 ${songTitle(v.song_id)} · ` : ""}
                  {new Date(v.created_at).toLocaleDateString()}
                </div>
              </div>
              {urls[v.storage_path] && (
                <a
                  href={urls[v.storage_path]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <Button variant="ghost" size="icon" title="Delete video" onClick={() => setConfirmDel(v)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload video</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Island strum walkthrough" />
            </div>
            <div>
              <Label>Attach to song (optional)</Label>
              <Select value={songId} onValueChange={setSongId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— General (no song)</SelectItem>
                  {songs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Video file (max {MAX_MB} MB)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }} disabled={upload.isPending}>
              Cancel
            </Button>
            <Button onClick={doUpload} disabled={upload.isPending}>
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview && (
            urls[preview.storage_path] ? (
              <video
                src={urls[preview.storage_path]}
                controls
                autoPlay
                className="w-full rounded-md bg-black"
              />
            ) : (
              <div className="w-full aspect-video rounded-md bg-black/80 grid place-items-center text-white text-sm">
                Preparing video…
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDel?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the video file and its entry. Students will no longer see it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
