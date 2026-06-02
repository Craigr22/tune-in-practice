import { useRef, useState } from "react";
import { useSaveSong, type CatalogSong, type Instrument, type SongInput } from "@/hooks/useSongCatalog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const STATES = [
  { value: "next", label: "Up next" },
  { value: "in-progress", label: "In progress" },
  { value: "mastered", label: "Mastered" },
  { value: "stretch", label: "Stretch goal" },
  { value: "locked", label: "Locked" },
];
const DIFFICULTIES = ["Beginner", "Advanced Beginner", "Intermediate", "Advanced"];

const blank = {
  title: "",
  artist: "",
  track_num: "1",
  is_fingerstyle: false,
  sort_order: "1",
  difficulty: "Beginner",
  chords: "",
  new_chord: "",
  strum: "",
  strum_note: "",
  bpm: "",
  state: "next",
  daily_target: "4",
  target_approvals: "7",
  is_active: true,
};

export default function SongFormDialog({
  open,
  onClose,
  instrument,
  song,
}: {
  open: boolean;
  onClose: () => void;
  instrument: Instrument;
  song?: CatalogSong | null;
}) {
  const editing = !!song;
  const save = useSaveSong();
  const [form, setForm] = useState(blank);
  const syncKey = useRef<string | null>(null);

  if (open) {
    const key = song?.id ?? "new";
    if (syncKey.current !== key) {
      syncKey.current = key;
      setForm(
        song
          ? {
              title: song.title,
              artist: song.artist ?? "",
              track_num: song.track === "fs" ? "" : String(song.track),
              is_fingerstyle: song.track === "fs" || !!song.fingerstyle,
              sort_order: String(song.order ?? 1),
              difficulty: song.difficulty ?? "Beginner",
              chords: (song.chords ?? []).join(", "),
              new_chord: song.newChord ?? "",
              strum: song.strum ?? "",
              strum_note: song.strumNote ?? "",
              bpm: song.bpm ? String(song.bpm) : "",
              state: song.state ?? "next",
              daily_target: String(song.dailyTarget ?? 4),
              target_approvals: String(song.targetApprovals ?? 7),
              is_active: song.isActive ?? true,
            }
          : blank,
      );
    }
  } else if (syncKey.current !== null) {
    syncKey.current = null;
  }

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    const payload: SongInput = {
      id: song?.source === "db" ? song.id : undefined,
      instrument,
      title: form.title.trim(),
      artist: form.artist.trim(),
      track_num: form.is_fingerstyle ? null : Number(form.track_num || 0),
      is_fingerstyle: form.is_fingerstyle,
      sort_order: Number(form.sort_order || 0),
      difficulty: form.difficulty,
      chords: form.chords.split(",").map((c) => c.trim()).filter(Boolean),
      new_chord: form.new_chord.trim() || null,
      strum: form.strum.trim() || null,
      strum_note: form.strum_note.trim() || null,
      bpm: form.bpm ? Number(form.bpm) : null,
      state: form.state,
      daily_target: Number(form.daily_target || 4),
      target_approvals: Number(form.target_approvals || 7),
      is_active: form.is_active,
    };
    try {
      await save.mutateAsync(payload);
      toast.success(editing ? "Song updated" : "Song added");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save song");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit song" : "Add song"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Count on Me" />
          </div>
          <div className="col-span-2">
            <Label>Artist</Label>
            <Input value={form.artist} onChange={(e) => set("artist", e.target.value)} placeholder="e.g. Bruno Mars" />
          </div>
          <div>
            <Label>Track</Label>
            <Input
              type="number"
              min="1"
              value={form.track_num}
              disabled={form.is_fingerstyle}
              onChange={(e) => set("track_num", e.target.value)}
            />
          </div>
          <div>
            <Label>Order within track</Label>
            <Input type="number" min="1" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Switch checked={form.is_fingerstyle} onCheckedChange={(v) => set("is_fingerstyle", v)} id="fs" />
            <Label htmlFor="fs" className="cursor-pointer">Fingerstyle song (separate track)</Label>
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Starting state</Label>
            <Select value={form.state} onValueChange={(v) => set("state", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Chords (comma separated)</Label>
            <Input value={form.chords} onChange={(e) => set("chords", e.target.value)} placeholder="C, G, Am, F" />
          </div>
          <div>
            <Label>New chord (optional)</Label>
            <Input value={form.new_chord} onChange={(e) => set("new_chord", e.target.value)} placeholder="F" />
          </div>
          <div>
            <Label>BPM (optional)</Label>
            <Input type="number" value={form.bpm} onChange={(e) => set("bpm", e.target.value)} />
          </div>
          <div>
            <Label>Strum pattern</Label>
            <Input value={form.strum} onChange={(e) => set("strum", e.target.value)} placeholder="D D U U D U" />
          </div>
          <div>
            <Label>Strum note</Label>
            <Input value={form.strum_note} onChange={(e) => set("strum_note", e.target.value)} placeholder="Island strum" />
          </div>
          <div>
            <Label>Daily target (plays)</Label>
            <Input type="number" min="1" value={form.daily_target} onChange={(e) => set("daily_target", e.target.value)} />
          </div>
          <div>
            <Label>Approved days to master</Label>
            <Input type="number" min="1" value={form.target_approvals} onChange={(e) => set("target_approvals", e.target.value)} />
          </div>
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} id="active" />
            <Label htmlFor="active" className="cursor-pointer">Visible to students</Label>
          </div>
        </div>

        <DialogFooter>
          <button className="px-3 py-2 text-sm rounded-md border hover:bg-muted" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button
            className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            onClick={submit}
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add song"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
