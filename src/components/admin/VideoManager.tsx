import { useMemo, useRef, useState } from "react";
import {
  useCourseVideos,
  useUploadCourseVideo,
  useUpdateCourseVideo,
  useDeleteCourseVideo,
  useSetVideoOrder,
  useSignedVideoUrls,
  type CourseVideo,
} from "@/hooks/useCourseVideos";
import { useCatalogSongs, type Instrument } from "@/hooks/useSongCatalog";
import { isAudioPath, type MediaKind } from "@/hooks/useCourseVideos";
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
import { Film, Upload, Trash2, ExternalLink, Pencil, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const MAX_MB = 1024;

export default function VideoManager({
  instrument,
  kind = "lesson",
}: {
  instrument: Instrument;
  /** Which library this is. Backing tracks also take mp3s. */
  kind?: MediaKind;
}) {
  const isTracks = kind === "track";
  const noun = isTracks ? "backing track" : "video";
  const { data: allMedia = [], isLoading } = useCourseVideos(instrument);
  // Backing tracks are their own library; the video library is everything else.
  const videos = useMemo(
    () => allMedia.filter((v) => (isTracks ? v.kind === "track" : v.kind !== "track")),
    [allMedia, isTracks],
  );
  const { data: urls = {} } = useSignedVideoUrls(videos.map((v) => v.storage_path));
  const songs = useCatalogSongs(instrument);
  const upload = useUploadCourseVideo();
  const update = useUpdateCourseVideo();
  const del = useDeleteCourseVideo();
  const setOrder = useSetVideoOrder();
  // Positions live in a column added by migration; until it lands there is
  // nothing to swap, so don't offer a control that can't work.
  const canReorder = videos.length > 1 && videos.every((v) => typeof v.sort_order === "number");

  /** Move a clip within its library. Positions are stored, so this sticks. */
  const move = async (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= videos.length) return;
    const ordered = [...videos];
    [ordered[index], ordered[to]] = [ordered[to], ordered[index]];
    try {
      await setOrder.mutateAsync({ instrument, ordered });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't reorder");
    }
  };

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [songId, setSongId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const [confirmDel, setConfirmDel] = useState<CourseVideo | null>(null);
  const [preview, setPreview] = useState<CourseVideo | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const songTitle = (id: string | null) => songs.find((s) => s.id === id)?.title;

  const resetForm = () => {
    setTitle("");
    setSongId("none");
    setFile(null);
    setProgress(null);
    abortRef.current = null;
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
      return toast.error(`That ${noun} is too large — keep it under ${MAX_MB} MB`);
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    try {
      await upload.mutateAsync({
        kind,
        instrument,
        file,
        title: title.trim(),
        song_id: songId === "none" ? null : songId,
        onProgress: setProgress,
        signal: controller.signal,
      });
      toast.success("Video uploaded");
      setFormOpen(false);
      resetForm();
    } catch (e: any) {
      const msg = e?.message ?? "Upload failed";
      if (msg === "Upload cancelled") toast("Upload cancelled");
      else toast.error(msg);
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  };

  const cancelUpload = () => abortRef.current?.abort();

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
            <Film className="w-4 h-4" /> {isTracks ? "Backing tracks" : "Course videos"}
          </div>
          <p className="text-xs text-muted-foreground">
            {isTracks
              ? "Play-alongs students practise to — mp3 or video"
              : "Tutorial & demo clips for this course"}
            {videos.length ? ` · ${videos.length} uploaded` : ""}.
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Upload className="w-4 h-4 mr-1" /> Upload {noun}
        </Button>
      </div>

      {isLoading ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
      ) : videos.length === 0 ? (
        <div className="px-4 py-8 text-center text-muted-foreground text-sm">
          {isTracks ? "No backing tracks yet. Upload an mp3 to get started." : "No videos yet. Upload a tutorial to get started."}
        </div>
      ) : (
        <div className="divide-y">
          {videos.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
              <button
                onClick={() => setPreview(v)}
                className="w-24 h-14 rounded-md bg-black/80 grid place-items-center shrink-0 hover:opacity-80"
                title="Preview"
              >
                <span className="text-white text-lg">{isAudioPath(v.storage_path) ? "♪" : "▶"}</span>
              </button>
              <div className="flex-1 min-w-0">
                {editingId === v.id ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Title"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <Button size="icon" className="h-8 w-8" onClick={saveEdit} disabled={update.isPending}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={cancelEdit} disabled={update.isPending}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium truncate">{v.title}</div>
                  </>
                )}
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
              <Button
                variant="ghost" size="icon" title="Move up"
                disabled={!canReorder || i === 0 || setOrder.isPending}
                onClick={() => move(i, -1)}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost" size="icon" title="Move down"
                disabled={!canReorder || i === videos.length - 1 || setOrder.isPending}
                onClick={() => move(i, 1)}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Edit title" onClick={() => startEdit(v)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Delete video" onClick={() => setConfirmDel(v)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      {/* Don't let a stray click outside dismiss the dialog mid-transfer. */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => { if (!o && !upload.isPending) { setFormOpen(false); resetForm(); } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload {noun}</DialogTitle>
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
              <Label>
                {isTracks ? "Audio or video file" : "Video file"} (max {MAX_MB >= 1024 ? `${MAX_MB / 1024} GB` : `${MAX_MB} MB`})
              </Label>
              <Input
                ref={fileRef}
                type="file"
                accept={isTracks ? "audio/*,video/*" : "video/*"}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              )}
            </div>

            {/* Progress — large files over school wifi need to show they're alive. */}
            {upload.isPending && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">
                    {progress === null || progress < 100 ? "Uploading…" : "Finishing up…"}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {progress ?? 0}%
                    {file ? ` · ${(((progress ?? 0) / 100) * (file.size / (1024 * 1024))).toFixed(0)}/${(file.size / (1024 * 1024)).toFixed(0)} MB` : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${progress ?? 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Keep this tab open until it finishes.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            {upload.isPending ? (
              <Button variant="outline" onClick={cancelUpload}>Cancel upload</Button>
            ) : (
              <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>
                Cancel
              </Button>
            )}
            <Button onClick={doUpload} disabled={upload.isPending}>
              {upload.isPending ? `Uploading… ${progress ?? 0}%` : "Upload"}
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
              // An mp3 has no picture to show, so it gets an audio player.
              isAudioPath(preview.storage_path) ? (
                <audio src={urls[preview.storage_path]} controls autoPlay className="w-full" />
              ) : (
                <video
                  src={urls[preview.storage_path]}
                  controls
                  autoPlay
                  className="w-full rounded-md bg-black"
                />
              )
            ) : (
              <div className="w-full aspect-video rounded-md bg-black/80 grid place-items-center text-white text-sm">
                Preparing…
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
