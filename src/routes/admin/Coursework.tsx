import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  INSTRUMENTS,
  useCatalogSongs,
  useDeleteSong,
  type CatalogSong,
  type Instrument,
} from "@/hooks/useSongCatalog";
import { Button } from "@/components/ui/button";
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
import { Plus, Pencil, Trash2, Music, Film } from "lucide-react";
import { useCourseVideos } from "@/hooks/useCourseVideos";
import { toast } from "sonner";
import SongFormDialog from "@/components/admin/SongFormDialog";
import VideoManager from "@/components/admin/VideoManager";
import CoursePlanner from "@/components/admin/CoursePlanner";

function UkuleleManager() {
  const songs = useCatalogSongs("ukulele", { showInactive: true });
  const { data: videos = [] } = useCourseVideos("ukulele");
  const del = useDeleteSong();

  // How many clips each song has, so admins can see coverage at a glance.
  const videoCount = new Map<string, number>();
  for (const v of videos) {
    if (v.song_id) videoCount.set(v.song_id, (videoCount.get(v.song_id) ?? 0) + 1);
  }
  const [form, setForm] = useState<CatalogSong | null | undefined>(undefined); // undefined = closed
  const [confirmDel, setConfirmDel] = useState<CatalogSong | null>(null);

  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await del.mutateAsync({ id: confirmDel.id, instrument: "ukulele" });
      toast.success("Song removed");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove");
    }
    setConfirmDel(null);
  };

  const dbCount = songs.filter((s) => s.source === "db").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          {songs.length} songs in the ukulele course
          {dbCount > 0 ? ` · ${dbCount} added by you` : ""}. This is the master list — each teacher then
          chooses which of these are unlocked, and in what order, for their own class.
        </p>
        <Button onClick={() => setForm(null)}><Plus className="w-4 h-4 mr-1" />Add song</Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 w-16">Track</th>
              <th className="text-left p-3">Song</th>
              <th className="text-left p-3">Chords</th>
              <th className="text-left p-3 w-28">Difficulty</th>
              <th className="text-left p-3 w-20">Video</th>
              <th className="text-right p-3 w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((s) => (
              <tr key={s.id} className={`border-t ${!s.isActive ? "opacity-50" : ""}`}>
                <td className="p-3 font-medium">{s.track === "fs" ? "FS" : s.track}.{s.order}</td>
                <td className="p-3">
                  <div className="font-medium flex items-center gap-2">
                    {s.title}
                    {s.source === "builtin" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">built-in</span>
                    )}
                    {!s.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">hidden</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.artist}</div>
                </td>
                <td className="p-3 text-muted-foreground">{(s.chords ?? []).join(" · ") || "—"}</td>
                <td className="p-3 text-muted-foreground">{s.difficulty}</td>
                <td className="p-3">
                  {videoCount.get(s.id) ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"
                      title={`${videoCount.get(s.id)} video${videoCount.get(s.id) === 1 ? "" : "s"} attached`}
                    >
                      <Film className="w-3 h-3" />
                      {videoCount.get(s.id)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground" title="No video attached">—</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={s.source === "builtin" ? "Customize this built-in song" : "Edit song"}
                      onClick={() => setForm(s)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={s.source === "builtin" ? "Built-in songs can't be deleted" : "Delete song"}
                      disabled={s.source === "builtin"}
                      onClick={() => setConfirmDel(s)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SongFormDialog
        open={form !== undefined}
        instrument="ukulele"
        song={form ?? null}
        onClose={() => setForm(undefined)}
      />

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{confirmDel?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the song from the ukulele course and students’ pages. Practice history that students
              already logged is kept but will no longer link to a song.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="border rounded-lg p-12 text-center text-muted-foreground">
      <Music className="w-8 h-8 mx-auto mb-3 opacity-50" />
      <p className="font-medium text-foreground">No {label} coursework yet</p>
      <p className="text-sm mt-1">The {label.toLowerCase()} course catalog hasn’t been set up. Ukulele is live today.</p>
    </div>
  );
}

export default function AdminCoursework() {
  const { role } = useAuth();
  const [instrument, setInstrument] = useState<Instrument>("ukulele");

  if (role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Course work</h1>

      <div className="flex rounded-md border overflow-hidden w-fit">
        {INSTRUMENTS.map((i) => (
          <button
            key={i.value}
            onClick={() => setInstrument(i.value)}
            className={`px-4 py-1.5 text-sm ${instrument === i.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {i.emoji} {i.label}
          </button>
        ))}
      </div>

      {instrument === "ukulele" ? <UkuleleManager /> : <ComingSoon label={instrument === "guitar" ? "Guitar" : "Violin"} />}

      <CoursePlanner instrument={instrument} />

      <VideoManager instrument={instrument} />
    </div>
  );
}
