import { useMemo } from "react";
import { Music } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useCatalogSongs, type Instrument } from "@/hooks/useSongCatalog";
import { useStudentCoursePlan, courseOrder } from "@/hooks/useCoursePlan";
import { useBatchCourseworkRows, useSaveCoursework } from "@/hooks/useBatchCoursework";
import { BEGINNER_CORE, BEGINNER_ORDER, activatedSongs, isBeginnerExtra } from "@/data/courseOrder";
import { tierForTrack } from "@/lib/tiers";

/**
 * The Beginner songs a class can take on top of the core three.
 *
 * Every class learns the same three. Whether there is room for a fourth is
 * the teacher's call, class by class — so the extras sit here, off, until
 * the teacher switches one on. It then appears on that class's Journey map
 * and nowhere else.
 */
export default function ExtraSongsCard({ batchId, instrument }: { batchId: string; instrument: Instrument }) {
  const catalog = useCatalogSongs(instrument, { showInactive: false });
  const { days } = useStudentCoursePlan(instrument);
  const { data: rows = [] } = useBatchCourseworkRows(batchId);
  const save = useSaveCoursework(batchId);

  const extras = useMemo(() => {
    const rest = catalog.map((c) => ({ songId: c.id, tier: tierForTrack(c.track) }));
    return courseOrder(days, BEGINNER_ORDER, { rest })
      .filter(isBeginnerExtra)
      .flatMap((s) => {
        const song = catalog.find((c) => c.id === s.songId);
        return song ? [song] : [];
      });
  }, [catalog, days]);
  const on = useMemo(() => activatedSongs(rows), [rows]);

  if (!extras.length) return null;

  const toggle = async (songId: string, title: string, next: boolean) => {
    // Keep the song where it already sits in the class's order.
    const sort_order =
      rows.find((r) => r.song_id === songId)?.sort_order ?? (catalog.findIndex((c) => c.id === songId) + 1) * 100;
    try {
      await save.mutateAsync([{ song_id: songId, is_unlocked: next, sort_order }]);
      toast.success(next ? `${title} added to this class's Journey` : `${title} taken off this class's Journey`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save that");
    }
  };

  const picked = extras.filter((s) => on.has(s.id)).length;

  return (
    <div className="rounded-lg border">
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="font-medium text-sm flex items-center gap-2">
          <Music className="w-4 h-4" /> Extra Beginner songs
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {BEGINNER_CORE.length + picked}/{BEGINNER_CORE.length} songs
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every class learns the core {BEGINNER_CORE.length}. Switch one of these on if this class has room for
          more — it then shows on your students' Journey as a bonus song.
        </p>
      </div>
      <ul className="divide-y">
        {extras.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{s.title}</div>
              <div className="text-xs text-muted-foreground truncate">{s.artist}</div>
            </div>
            <Switch
              checked={on.has(s.id)}
              disabled={save.isPending}
              onCheckedChange={(v) => toggle(s.id, s.title, v)}
              aria-label={`${s.title} for this class`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
