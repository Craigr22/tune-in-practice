import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useSongs } from "@/hooks/useSongs";
import { useLogPractice, CHECK_IN_LABEL, CHECK_IN_EMOJI, type CheckIn } from "@/hooks/useStudentProgress";
import { useTuner, useLowG } from "@/hooks/useTuner";
import { SONG_AUDIO } from "@/data/audio";
import type { SongTab as TabKey } from "@/lib/types";
import SongHeader from "@/components/shared/song/SongHeader";
import WarmupTab from "@/components/shared/song/WarmupTab";
import DrillsTab from "@/components/shared/song/DrillsTab";
import SongTab from "@/components/shared/song/SongTab";
import PlanTab from "@/components/shared/song/PlanTab";
import SidePanel from "@/components/shared/song/SidePanel";
import TuneCheck from "@/components/shared/TuneCheck";
import AudioClipRecorder from "@/components/shared/AudioClipRecorder";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BADGE_LIST } from "@/lib/badges";
import { toast } from "@/hooks/use-toast";

type Phase = "intro" | "tune" | "practice";

const TunerPill = ({ lowG, active, onClick }: { lowG: boolean; active: boolean; onClick: () => void }) => {
  const { drifted } = useTuner({ mode: "passive-monitor", active, lowG });
  const inTune = !drifted;
  return (
    <button
      onClick={onClick}
      className="absolute top-3 right-3 z-10 rounded-full px-3 py-1.5 text-xs font-bold shadow-md transition-colors"
      style={{
        background: inTune ? "rgba(107,122,45,0.12)" : "rgba(184,148,31,0.18)",
        color: inTune ? "var(--olive)" : "var(--gold-deep)",
        border: `1px solid ${inTune ? "var(--olive)" : "var(--gold-deep)"}`,
      }}
      title="Tap to open mini tuner"
    >
      {inTune ? "🎵 In tune" : `🎵 ${drifted!.name} ${drifted!.cents < 0 ? "flat" : "sharp"}`}
    </button>
  );
};

const SongDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { getSong, closeSong, logPlay } = useSongs();
  const song = id ? getSong(id) : undefined;
  const [tab, setTab] = useState<TabKey>("warmup");
  const [phase, setPhase] = useState<Phase>("intro");
  const [tuningChecked, setTuningChecked] = useState(false);
  const [inlineTunerOpen, setInlineTunerOpen] = useState(false);
  const [lowG] = useLowG();

  const [prompt, setPrompt] = useState(false);
  const [duration, setDuration] = useState(10);
  const [badge, setBadge] = useState<number | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const logPractice = useLogPractice();

  useEffect(() => { setTab("warmup"); setPhase("intro"); setTuningChecked(false); }, [id]);

  if (!song) return <Navigate to="/student" replace />;

  const beginTuning = () => setPhase("tune");
  const onTuneSubmit = (completed: boolean) => {
    setTuningChecked(completed);
    setPhase("practice");
  };

  const handleLogPlay = (sid: string) => {
    logPlay(sid);
    setPrompt(true);
    setBadge(null);
    setCheckIn(null);
    setShowRecorder(false);
  };

  const finalize = async (recordingBlob: Blob | null) => {
    if (!checkIn) return;
    try {
      await logPractice.mutateAsync({
        songId: song.id,
        durationMin: duration,
        selfBadge: badge,
        tuningCheckCompleted: tuningChecked,
        checkIn,
        sharedWithTeacher: true,
        recordingBlob,
      });
      toast({
        title: "Practice logged",
        description: `${CHECK_IN_EMOJI[checkIn]} ${CHECK_IN_LABEL[checkIn]} · ${duration} min`,
      });
      setPrompt(false);
      setShowRecorder(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save practice log.";
      toast({ title: "Couldn't save", description: msg, variant: "destructive" });
    }
  };

  const submitWithoutRecording = () => finalize(null);

  return (
    <div className="song-page" id="songOverlay">
      <div className="song-page-content">
        <div className="bam-phone bam-phone--page" style={{ position: "relative" }}>
          <SongHeader song={song} close={closeSong} />

          {phase === "intro" && (
            <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={beginTuning}
                className="w-full rounded-xl py-3 font-bold text-sm transition-transform hover:scale-[1.01]"
                style={{
                  background: "linear-gradient(135deg, var(--navy), var(--blue-deep))",
                  color: "#fff",
                  boxShadow: "0 10px 24px -8px rgba(0,133,199,0.5)",
                }}
              >
                ▶ Start practice session
              </button>
              <div className="text-[11px] mt-2 text-center" style={{ color: "var(--ink-soft)" }}>
                We'll tune your ukulele first, then jump into the song.
              </div>
            </div>
          )}

          {phase === "tune" && (
            <div className="p-3">
              <TuneCheck variant="gate" onSubmit={onTuneSubmit} />
            </div>
          )}

          {phase === "practice" && (
            <>
              <TunerPill
                lowG={lowG}
                active={!inlineTunerOpen}
                onClick={() => setInlineTunerOpen((o) => !o)}
              />
              {inlineTunerOpen && (
                <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <TuneCheck variant="compact" onClose={() => setInlineTunerOpen(false)} />
                </div>
              )}
              {SONG_AUDIO[song.id] && (
                <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Reference track
                  </div>
                  <audio controls preload="none" style={{ width: "100%" }} src={SONG_AUDIO[song.id].src} />
                  {SONG_AUDIO[song.id].fullSrc && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Full audio
                      </div>
                      <audio controls preload="none" style={{ width: "100%" }} src={SONG_AUDIO[song.id].fullSrc} />
                    </>
                  )}
                </div>
              )}
              <div className="bam-tabs">
                {(["warmup", "drills", "song", "plan"] as TabKey[]).map((t) => (
                  <div key={t} className={`bam-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                    <span className="ic">{ { warmup: "🎯", drills: "🔁", song: "🎵", plan: "📅" }[t] }</span>
                    {{ warmup: "Warm Up", drills: "Drills", song: "Song", plan: "Plan" }[t]}
                  </div>
                ))}
              </div>
              <div className="bam-content bam-content--page">
                {tab === "warmup" && <WarmupTab song={song} setTab={setTab} />}
                {tab === "drills" && <DrillsTab song={song} />}
                {tab === "song" && <SongTab song={song} />}
                {tab === "plan" && <PlanTab song={song} logPlay={handleLogPlay} />}
              </div>
            </>
          )}
        </div>
        <SidePanel song={song} />
      </div>

      <Dialog open={prompt} onOpenChange={(o) => { if (!o) setShowRecorder(false); setPrompt(o); }}>
        <DialogContent className="max-w-md">
          <DialogTitle>How did that feel?</DialogTitle>
          <DialogDescription>Rate this run-through. We'll save it to your journey.</DialogDescription>

          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>Duration</label>
            <input
              type="number"
              min={1}
              max={120}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 px-2 py-1 rounded border text-sm"
              style={{ borderColor: "var(--border-strong)" }}
            />
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>min</span>
            <span className="ml-auto text-[11px]" style={{ color: tuningChecked ? "var(--olive)" : "var(--ink-faint)" }}>
              {tuningChecked ? "🎵 Tuned" : "Tuning skipped"}
            </span>
          </div>

          {/* Optional self-rating badge */}
          <div className="mt-3">
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-soft)" }}>
              Self-rating (optional)
            </div>
            <div className="grid grid-cols-5 gap-2">
              {BADGE_LIST.map((b) => (
                <button
                  key={b.level}
                  onClick={() => setBadge((cur) => (cur === b.level ? null : b.level))}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl border transition-all hover:-translate-y-0.5"
                  style={{
                    borderColor: badge === b.level ? "var(--navy)" : "var(--border)",
                    background: badge === b.level ? "rgba(0,133,199,0.08)" : "var(--paper-warm)",
                  }}
                  title={b.blurb}
                >
                  <span className="text-2xl">{b.emoji}</span>
                  <span className="text-[10px] font-semibold">{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Required check-in */}
          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-soft)" }}>
              Quick check-in <span className="text-red-500">*</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["nailed", "got_through", "need_help"] as CheckIn[]).map((c) => {
                const active = checkIn === c;
                const colors: Record<CheckIn, string> = {
                  nailed: active ? "border-emerald-500 bg-emerald-50" : "",
                  got_through: active ? "border-amber-500 bg-amber-50" : "",
                  need_help: active ? "border-red-500 bg-red-50" : "",
                };
                return (
                  <button
                    key={c}
                    onClick={() => setCheckIn(c)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${colors[c]}`}
                    style={{ borderColor: active ? undefined : "var(--border)" }}
                  >
                    <span className="text-2xl">{CHECK_IN_EMOJI[c]}</span>
                    <span className="text-[11px] font-semibold text-center">{CHECK_IN_LABEL[c]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          {!showRecorder && (
            <div className="mt-4 flex flex-col gap-2">
              {checkIn === "nailed" ? (
                <>
                  <div className="text-xs text-center" style={{ color: "var(--ink-soft)" }}>
                    Want to show your teacher? (optional)
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={submitWithoutRecording} disabled={logPractice.isPending} className="flex-1">
                      Skip
                    </Button>
                    <Button variant="outline" onClick={() => setShowRecorder(true)} className="flex-1">
                      🎤 Record clip
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  onClick={submitWithoutRecording}
                  disabled={!checkIn || logPractice.isPending}
                  className="w-full"
                >
                  {logPractice.isPending ? "Saving…" : "Save check-in"}
                </Button>
              )}
            </div>
          )}

          {showRecorder && (
            <div className="mt-4">
              <AudioClipRecorder
                onUse={(blob) => finalize(blob)}
                onSkip={submitWithoutRecording}
                uploading={logPractice.isPending}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SongDetail;
