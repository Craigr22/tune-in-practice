import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SONGS } from "@/data/songs";
import { FOUNDATIONS } from "@/data/foundations";
import type { Song } from "@/lib/types";

interface SongsContextValue {
  songs: Song[];
  foundationsState: { id: string; done: boolean }[];
  openSong: (id: string) => void;
  closeSong: () => void;
  logPlay: (id: string) => void;
  markFoundationsComplete: () => void;
  getSong: (id: string) => Song | undefined;
}

const SongsContext = createContext<SongsContextValue | null>(null);

export function SongsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>(() => SONGS.map((s) => ({ ...s })));
  const [foundationsState, setFoundationsState] = useState(() =>
    FOUNDATIONS.map((f) => ({ id: f.id, done: f.done }))
  );

  const getSong = useCallback((id: string) => songs.find((s) => s.id === id), [songs]);

  const openSong = useCallback(
    (id: string) => {
      const song = songs.find((s) => s.id === id);
      if (!song) return;
      if (song.state === "locked") {
        alert(`🔒 ${song.title} is locked. Finish the previous track first — it builds the chords you need.`);
        return;
      }
      navigate(`/student/song/${id}`);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    },
    [songs, navigate]
  );

  const closeSong = useCallback(() => {
    navigate("/student");
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [navigate]);

  const logPlay = useCallback((songId: string) => {
    setSongs((prev) => {
      const next = prev.map((s) => ({ ...s, history: s.history ? [...s.history] : [] }));
      const song = next.find((s) => s.id === songId);
      if (!song) return prev;
      song.playsToday = (song.playsToday || 0) + 1;
      if (song.history && song.history.length) {
        song.history[song.history.length - 1] = song.playsToday;
      }
      const justApproved = song.playsToday === song.dailyTarget;
      if (justApproved) {
        song.approvedDays = (song.approvedDays || 0) + 1;
        if (song.targetApprovals && song.approvedDays >= song.targetApprovals) {
          song.state = "mastered";
        }
        setTimeout(() => {
          const msg =
            song.state === "mastered"
              ? `🎉 You mastered ${song.title}! ${song.targetApprovals} approved days complete.`
              : `✓ Day approved! ${song.approvedDays} of ${song.targetApprovals} approved days for ${song.title}.`;
          alert(msg);
        }, 200);
      }
      return next;
    });
  }, []);

  const markFoundationsComplete = useCallback(() => {
    setFoundationsState((s) => s.map((f) => (f.id === "transitions" ? { ...f, done: true } : f)));
    alert("Foundations complete. You're ready for Song 1: Piyu Bole.");
    navigate("/student");
  }, [navigate]);

  // Esc to close song
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && window.location.pathname.startsWith("/student/song/")) {
        closeSong();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSong]);

  const value = useMemo(
    () => ({ songs, foundationsState, openSong, closeSong, logPlay, markFoundationsComplete, getSong }),
    [songs, foundationsState, openSong, closeSong, logPlay, markFoundationsComplete, getSong]
  );

  return <SongsContext.Provider value={value}>{children}</SongsContext.Provider>;
}

export function useSongs() {
  const ctx = useContext(SongsContext);
  if (!ctx) throw new Error("useSongs must be used inside SongsProvider");
  return ctx;
}
