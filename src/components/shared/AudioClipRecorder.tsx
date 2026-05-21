import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Button } from "@/components/ui/button";

interface Props {
  onUse: (blob: Blob, durationSec: number) => void;
  onSkip: () => void;
  uploading?: boolean;
}

export default function AudioClipRecorder({ onUse, onSkip, uploading }: Props) {
  const r = useAudioRecorder();
  const previewUrl = r.result ? URL.createObjectURL(r.result.blob) : null;

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border-strong)" }}>
      <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
        🎤 30-second clip (audio only)
      </div>

      {r.state === "idle" && (
        <Button type="button" onClick={r.start} variant="outline" className="w-full">
          Start recording
        </Button>
      )}

      {r.state === "recording" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-red-600 font-medium">● Recording…</span>
            <span className="tabular-nums">{r.elapsed}s / {r.max}s</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-muted">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${(r.elapsed / r.max) * 100}%` }} />
          </div>
          <Button type="button" onClick={r.stop} variant="default" className="w-full">Stop</Button>
        </div>
      )}

      {r.state === "stopped" && previewUrl && (
        <div className="space-y-2">
          <audio controls src={previewUrl} className="w-full" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={r.reset} className="flex-1">Re-record</Button>
            <Button
              type="button"
              onClick={() => r.result && onUse(r.result.blob, r.result.durationSec)}
              disabled={uploading}
              className="flex-1"
            >
              {uploading ? "Uploading…" : "Send to teacher"}
            </Button>
          </div>
        </div>
      )}

      {r.state === "error" && (
        <div className="text-xs text-red-600">{r.error ?? "Microphone error"}</div>
      )}

      <button type="button" onClick={onSkip} className="text-xs underline text-muted-foreground">
        Skip — don't send a clip
      </button>
    </div>
  );
}
