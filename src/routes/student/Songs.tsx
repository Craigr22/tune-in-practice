import { useMemo } from "react";
import { SONGS } from "@/data/songs";
import { useSongs } from "@/hooks/useSongs";
import { usePracticeLogs, useSongProgress } from "@/hooks/useStudentProgress";
import BadgeDisplay from "@/components/shared/BadgeDisplay";

const Songs = () => {
  const { openSong } = useSongs();
  const { data: logs = [] } = usePracticeLogs();
  const { data: progress = [] } = useSongProgress();

  const semesterSongs = useMemo(
    () => SONGS.filter((s) => !s.fingerstyle).sort((a, b) => (a.track as number) - (b.track as number) || a.order - b.order),
    []
  );

  const playCount = (id: string) => logs.filter((l) => l.song_id === id).length;
  const badge = (id: string) => progress.find((p) => p.song_id === id)?.teacher_badge ?? null;

  return (
    <section className="view view-songs active">
      <div className="home" style={{ paddingBottom: 100 }}>
        <div className="mb-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--gold-deep)" }}>Semester 1</div>
          <h1 className="text-3xl font-bold mt-1" style={{ color: "var(--ink)" }}>All songs</h1>
          <p className="mt-2 text-sm max-w-xl" style={{ color: "var(--ink-soft)" }}>
            Locked songs unlock as your cohort progresses. Tap any active song to open it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {semesterSongs.map((s) => {
            const locked = s.state === "locked";
            const count = playCount(s.id);
            const b = badge(s.id);
            return (
              <button
                key={s.id}
                onClick={() => openSong(s.id)}
                disabled={locked}
                className={`text-left rounded-2xl p-5 transition-all ${locked ? "cursor-not-allowed" : "hover:-translate-y-0.5 hover:shadow-md"}`}
                style={{
                  background: locked ? "var(--paper-cool)" : "var(--card)",
                  border: "1px solid var(--border)",
                  filter: locked ? "grayscale(1)" : "none",
                  opacity: locked ? 0.55 : 1,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
                      Track {s.track}
                    </div>
                    <h3 className="font-bold text-lg mt-1 leading-tight" style={{ color: "var(--ink)" }}>
                      {locked ? "▒▒▒▒▒▒▒▒" : s.title}
                    </h3>
                    <div className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                      {locked ? "Unlocks soon" : s.artist}
                    </div>
                  </div>
                  {locked ? (
                    <span style={{ fontSize: 22 }}>🔒</span>
                  ) : (
                    <BadgeDisplay level={b} size="sm" showLabel={false} emptyLabel="" />
                  )}
                </div>
                {!locked && (
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span style={{ color: "var(--ink-soft)" }}>
                      {b ? <>Badge: <span className="font-semibold" style={{ color: "var(--ink)" }}>{getName(b)}</span></> : "Not started"}
                    </span>
                    <span style={{ color: "var(--ink-faint)" }}>{count} {count === 1 ? "play" : "plays"}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

function getName(level: number) {
  return ["", "Sloth", "Tortoise", "Dolphin", "Cheetah", "Eagle"][Math.max(1, Math.min(5, Math.round(level)))];
}

export default Songs;
