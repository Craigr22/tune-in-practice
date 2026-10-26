import { isRemoteMic, median, micErrorMessage, mpmPitch, rms } from "@/lib/tuner";

/**
 * The microphone, shared by every tuner on the page.
 *
 * Each tuner used to open the microphone itself, so the floating tuner and
 * the tune check could fight over it, and none of them noticed when the
 * phone took it away. This keeps one microphone and one audio context, hands
 * readings to whoever is listening, and looks after the ways a phone silently
 * stops a web page hearing anything:
 *
 *  - An iPhone only lets audio run if it was started by a tap. `unlock()` is
 *    called inside the tap, before anything is awaited; when audio still
 *    isn't running the status says so and the screen offers a button.
 *  - A ukulele is quiet. The level the tuner ignores follows the room's own
 *    noise instead of being fixed, and the signal is boosted when the
 *    instrument is far from the phone.
 *  - A call, a voice note, locking the screen or switching apps can take the
 *    microphone. It is picked up again when the page comes back.
 *  - With earbuds connected, the phone may listen through the earbuds. The
 *    phone's own microphone is preferred when there is one.
 */

export type MicStatus = "off" | "starting" | "listening" | "needs-tap" | "error";

export interface MicState {
  status: MicStatus;
  /** The steadied pitch in Hz, held briefly after a note fades; null when nothing is sounding. */
  freq: number | null;
  /** 0–1, for a level meter. */
  level: number;
  /** True when it has been listening a while and heard nothing above the room. */
  quiet: boolean;
  error: string | null;
  /** For the diagnostics line. */
  diag: { ctx: string; sampleRate: number; gain: number; device: string; floor: number };
}

const TICK_MS = 40; // 25 readings a second: smooth enough, light on cheap phones
const HOLD_MS = 1200; // keep the last reading this long after a note fades
const QUIET_AFTER_MS = 4000;
const MAX_GAIN = 8;

type Listener = (s: MicState) => void;

class MicEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buf: Float32Array<ArrayBuffer> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private users = 0;
  private starting: Promise<void> | null = null;
  private listeners = new Set<Listener>();

  private history: number[] = [];
  private lastPitchAt = 0;
  private heardAt = 0;
  private startedAt = 0;
  private floor = 0.002;
  private gain = 1;
  private peaks: { at: number; level: number }[] = [];

  state: MicState = {
    status: "off",
    freq: null,
    level: 0,
    quiet: false,
    error: null,
    diag: { ctx: "none", sampleRate: 0, gain: 1, device: "", floor: 0 },
  };

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && this.users > 0) void this.recover();
      });
    }
  }

  /** The shared audio context — reference tones use it too. Created on demand. */
  context(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.ctx.onstatechange = () => this.onContextState();
    }
    return this.ctx;
  }

  /**
   * Call this first thing in a tap handler, before any await: it is what an
   * iPhone needs to let audio run.
   */
  unlock() {
    try {
      const ctx = this.context();
      if (ctx.state !== "running") void ctx.resume();
    } catch {
      /* no Web Audio: start() will say so */
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  acquire() {
    this.users++;
    if (this.users === 1) void this.start();
  }

  release() {
    this.users = Math.max(0, this.users - 1);
    if (this.users === 0) this.shutdown();
  }

  /** From a tap: wake the audio, and reopen the microphone if it has gone. */
  wake() {
    this.unlock();
    if (this.users === 0) return;
    if (!this.stream || this.trackEnded()) void this.start();
    else void this.checkRunning();
  }

  private set(patch: Partial<MicState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  private trackEnded() {
    const t = this.stream?.getAudioTracks()[0];
    return !t || t.readyState === "ended";
  }

  private async getStream(deviceId?: string): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        // Phones clean up speech by gating and levelling; for a tuner those
        // just eat the note.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  }

  private start(): Promise<void> {
    if (this.starting) return this.starting;
    this.starting = (async () => {
      this.set({ status: "starting", error: null });
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("unsupported"), { name: "Unsupported" });
        this.teardownStream();
        let stream = await this.getStream();

        // Earbuds: prefer the phone's own microphone, which is near the ukulele.
        const label = stream.getAudioTracks()[0]?.label ?? "";
        if (isRemoteMic(label)) {
          const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
          const builtIn = inputs.find((d) => d.label && !isRemoteMic(d.label) && d.deviceId !== "default" && d.deviceId !== "communications");
          if (builtIn) {
            stream.getTracks().forEach((t) => t.stop());
            stream = await this.getStream(builtIn.deviceId).catch(() => this.getStream());
          }
        }
        if (this.users === 0) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const ctx = this.context();
        this.stream = stream;
        const track = stream.getAudioTracks()[0];
        if (track) {
          track.onended = () => this.users > 0 && void this.recover();
          track.onmute = () => this.users > 0 && this.set({ status: "needs-tap" });
          track.onunmute = () => this.users > 0 && void this.checkRunning();
        }

        this.source = ctx.createMediaStreamSource(stream);
        // Cut the hum and rumble below a ukulele's lowest string.
        this.filter = ctx.createBiquadFilter();
        this.filter.type = "highpass";
        this.filter.frequency.value = 70;
        this.gainNode = ctx.createGain();
        this.gainNode.gain.value = this.gain;
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.source.connect(this.filter).connect(this.gainNode).connect(this.analyser);
        this.buf = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));

        this.startedAt = this.heardAt = Date.now();
        this.history = [];
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.tick(), TICK_MS);
        this.set({ diag: { ...this.state.diag, device: track?.label ?? "", sampleRate: ctx.sampleRate } });
        await this.checkRunning();
      } catch (e) {
        this.teardownStream();
        this.set({ status: "error", error: micErrorMessage(e), freq: null, level: 0 });
      } finally {
        this.starting = null;
      }
    })();
    return this.starting;
  }

  /** Audio is running, or the screen needs to ask for a tap. */
  private async checkRunning() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== "running") {
      // A resume outside a tap succeeds on most phones; give it a moment.
      await Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 400))]);
    }
    if (this.users === 0) return;
    this.set({ status: ctx.state === "running" ? "listening" : "needs-tap", diag: { ...this.state.diag, ctx: ctx.state } });
  }

  private onContextState() {
    const s = this.ctx?.state ?? "none";
    this.set({ diag: { ...this.state.diag, ctx: s } });
    if (this.users > 0 && this.state.status !== "starting" && this.state.status !== "error") {
      // Safari reports "interrupted" during a call.
      this.set({ status: s === "running" ? "listening" : "needs-tap" });
    }
  }

  /** The page came back, or the microphone was taken: pick it up again. */
  private async recover() {
    if (this.users === 0) return;
    if (!this.stream || this.trackEnded()) await this.start();
    else await this.checkRunning();
  }

  private tick() {
    const a = this.analyser;
    const b = this.buf;
    const ctx = this.ctx;
    if (!a || !b || !ctx) return;
    // Paused audio hands back the last thing it heard, over and over; that
    // isn't a note being played.
    if (ctx.state !== "running") {
      this.history = [];
      this.lastPitchAt = 0;
      if (this.state.freq !== null || this.state.level !== 0) this.set({ freq: null, level: 0 });
      return;
    }
    a.getFloatTimeDomainData(b);
    const now = Date.now();
    const level = rms(b);

    // Only sound clearly above the room counts. The room's level is learned
    // from the moments nothing is being played.
    const gate = Math.max(0.0006, this.floor * 2.5);
    const reading = level > gate ? mpmPitch(b, ctx.sampleRate) : null;

    if (reading) {
      this.lastPitchAt = this.heardAt = now;
      this.history.push(reading.freq);
      if (this.history.length > 5) this.history.shift();
      this.peaks.push({ at: now, level });
    } else {
      this.floor = this.floor * 0.97 + Math.min(level, 0.05) * 0.03;
    }

    // Far from the phone: turn the signal up. Too loud: turn it down.
    this.peaks = this.peaks.filter((p) => now - p.at < 2500);
    const loudest = this.peaks.reduce((m, p) => Math.max(m, p.level), level);
    let gain = this.gain;
    if (loudest > 0.5) gain = Math.max(1, gain / 1.5);
    else if (loudest < 0.015 && now - this.startedAt > 1500) gain = Math.min(MAX_GAIN, gain * 1.25);
    if (gain !== this.gain && this.gainNode) {
      this.gain = gain;
      this.gainNode.gain.setTargetAtTime(gain, ctx.currentTime, 0.1);
    }

    const holding = now - this.lastPitchAt < HOLD_MS;
    if (!holding) this.history = [];
    this.set({
      freq: holding && this.history.length ? median(this.history) : null,
      level: Math.min(1, level * 6),
      quiet: this.state.status === "listening" && now - this.heardAt > QUIET_AFTER_MS,
      diag: { ...this.state.diag, gain: Math.round(this.gain * 10) / 10, floor: Math.round(this.floor * 10000) / 10000, ctx: ctx.state },
    });
  }

  private teardownStream() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.source?.disconnect();
    this.filter?.disconnect();
    this.gainNode?.disconnect();
    this.analyser?.disconnect();
    this.source = this.filter = this.gainNode = this.analyser = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private shutdown() {
    this.teardownStream();
    this.history = [];
    this.set({ status: "off", freq: null, level: 0, quiet: false });
  }
}

export const mic = new MicEngine();
