import type { GameEvent } from "@qludo/engine";

/**
 * Sound effects, synthesised with the Web Audio API: no audio files, so they work offline
 * and add nothing to the download. `cuesFor` (pure, tested) decides what to play and when;
 * `Sfx` turns cues into sound.
 */

export type SoundName =
  | "dice"
  | "hop"
  | "enter"
  | "capture"
  | "coin"
  | "miss"
  | "split"
  | "link"
  | "unlink"
  | "ghost"
  | "force"
  | "collapse"
  | "hold"
  | "node"
  | "knockback"
  | "home"
  | "fanfare"
  | "pass"
  | "forfeit"
  | "yourTurn";

export interface Cue {
  sound: SoundName;
  /** Seconds after the action. */
  at: number;
  /** Step number for hops, so each step climbs in pitch. */
  step?: number;
}

const HOP_GAP = 0.05;

/** Maps the events of one action to a timeline of sounds. */
export function cuesFor(events: GameEvent[], humanSeats: ReadonlySet<number> = new Set()): Cue[] {
  const cues: Cue[] = [];
  let t = 0;
  const add = (sound: SoundName, advance: number, extra: Partial<Cue> = {}) => {
    cues.push({ sound, at: +t.toFixed(3), ...extra });
    t += advance;
  };
  const finished = events.some((e) => e.type === "playerFinished");

  for (const e of events) {
    switch (e.type) {
      case "rolled":
        add("dice", 0);
        break;
      case "forfeit":
        add("forfeit", 0.3);
        break;
      case "entered":
        add("enter", 0.15);
        break;
      case "moved": {
        if (e.via === "ghost") {
          add("ghost", 0.35);
          break;
        }
        const steps = Math.min(Math.max(e.to - e.from, 1), 6);
        for (let i = 0; i < steps; i++) cues.push({ sound: "hop", at: +(t + i * HOP_GAP).toFixed(3), step: i });
        t += steps * HOP_GAP + 0.04;
        break;
      }
      case "captured":
        add("capture", 0.3);
        break;
      case "hit":
        add("coin", 0.28);
        if (!e.success) add("miss", 0.2);
        break;
      case "superposed":
        add("split", 0.3);
        break;
      case "entangled":
        add("link", 0.3);
        break;
      case "observed":
        add("force", 0.3);
        break;
      case "collapsed":
        if (e.cause === "owner") add("collapse", 0.12);
        break;
      case "held":
        add("hold", 0.2);
        break;
      case "decoupled":
        if (e.reason === "choice") add("unlink", 0.15);
        break;
      case "knockback":
        add("knockback", 0.25);
        break;
      case "qGained":
        if (e.reason === "node") add("node", 0.15);
        break;
      case "tokenHome":
        add("home", 0.3);
        break;
      case "playerFinished":
        add("fanfare", 0.6);
        break;
      case "gameOver":
        if (!finished) add("fanfare", 0.6);
        break;
      case "passed":
        add("pass", 0.1);
        break;
      case "turnStart":
        if (!e.bonus && humanSeats.has(e.seat)) add("yourTurn", 0, { at: +(t + 0.1).toFixed(3) });
        break;
      default:
        break;
    }
  }
  return cues;
}

interface ToneOpts {
  freq: number;
  to?: number;
  type?: OscillatorType;
  dur: number;
  gain?: number;
  at?: number;
  attack?: number;
  lowpass?: number;
  vibrato?: number;
}

interface NoiseOpts {
  dur: number;
  gain?: number;
  at?: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
}

const STORAGE_KEY = "qludo.sound.v1";

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private on: boolean;

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage may be unavailable; default to on.
    }
    this.on = saved !== "off";
  }

  get enabled(): boolean {
    return this.on;
  }

  set enabled(v: boolean) {
    this.on = v;
    try {
      localStorage.setItem(STORAGE_KEY, v ? "on" : "off");
    } catch {
      // Not critical.
    }
    if (v) this.unlock();
  }

  /** Browsers only allow audio after a user gesture; call this from one. */
  unlock(): void {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  playCues(cues: Cue[]): void {
    for (const c of cues) this.play(c.sound, c.at, c.step);
  }

  play(name: SoundName, at = 0, step = 0): void {
    if (!this.on || !this.ctx || this.ctx.state !== "running") return;
    const s = (o: ToneOpts) => this.tone({ ...o, at: at + (o.at ?? 0) });
    const n = (o: NoiseOpts) => this.noise({ ...o, at: at + (o.at ?? 0) });
    switch (name) {
      case "dice":
        // Rattle of the die hitting the board, then a final clack.
        for (let i = 0; i < 7; i++)
          n({
            dur: 0.03,
            at: i * 0.055 + Math.random() * 0.015,
            filter: "bandpass",
            freq: 1800 + Math.random() * 1600,
            q: 3,
            gain: 0.55,
          });
        n({ dur: 0.05, at: 0.42, filter: "bandpass", freq: 1100, q: 2, gain: 0.7 });
        s({ freq: 190, type: "triangle", dur: 0.07, at: 0.42, gain: 0.35 });
        break;
      case "hop":
        s({ freq: 480 + step * 45, to: 560 + step * 55, type: "sine", dur: 0.07, gain: 0.22 });
        break;
      case "enter":
        s({ freq: 280, to: 720, type: "triangle", dur: 0.16, gain: 0.3 });
        break;
      case "capture":
        s({ freq: 240, to: 55, type: "square", dur: 0.32, gain: 0.22, lowpass: 900 });
        n({ dur: 0.18, filter: "lowpass", freq: 700, gain: 0.5 });
        break;
      case "coin":
        s({ freq: 2400, type: "sine", dur: 0.18, gain: 0.14 });
        s({ freq: 3600, type: "sine", dur: 0.14, gain: 0.08 });
        s({ freq: 2600, type: "sine", dur: 0.16, gain: 0.1, at: 0.11 });
        break;
      case "miss":
        n({ dur: 0.22, filter: "bandpass", freq: 1600, to: 300, q: 1.5, gain: 0.35 });
        break;
      case "split":
        // One tone that splits into two diverging tones, with a shimmer on top.
        s({ freq: 620, to: 440, type: "sine", dur: 0.45, gain: 0.18 });
        s({ freq: 620, to: 880, type: "sine", dur: 0.45, gain: 0.18 });
        s({ freq: 1760, type: "sine", dur: 0.25, gain: 0.05, vibrato: 30 });
        break;
      case "link":
        // Two tones converging on one, then a lock-in ping.
        s({ freq: 300, to: 660, type: "sine", dur: 0.28, gain: 0.18 });
        s({ freq: 1320, to: 660, type: "sine", dur: 0.28, gain: 0.12 });
        s({ freq: 660, type: "triangle", dur: 0.18, gain: 0.22, at: 0.27 });
        break;
      case "unlink":
        s({ freq: 660, to: 330, type: "sine", dur: 0.16, gain: 0.16 });
        break;
      case "ghost":
        // Airy whoosh with a hollow tone underneath.
        n({ dur: 0.5, filter: "bandpass", freq: 400, to: 2200, q: 4, gain: 0.3 });
        s({ freq: 220, to: 330, type: "sine", dur: 0.5, gain: 0.12, vibrato: 6 });
        break;
      case "force":
        // A pull downwards that snaps into place.
        s({ freq: 1100, to: 160, type: "sawtooth", dur: 0.24, gain: 0.12, lowpass: 2400 });
        n({ dur: 0.03, filter: "highpass", freq: 3000, gain: 0.5, at: 0.24 });
        s({ freq: 130, type: "square", dur: 0.06, gain: 0.18, at: 0.24, lowpass: 800 });
        break;
      case "collapse":
        s({ freq: 760, to: 520, type: "sine", dur: 0.12, gain: 0.18 });
        break;
      case "hold":
        s({ freq: 600, type: "sine", dur: 0.4, gain: 0.12, vibrato: 18 });
        break;
      case "node":
        [1320, 1760, 2093].forEach((f, i) => s({ freq: f, type: "sine", dur: 0.12, gain: 0.12, at: i * 0.05 }));
        break;
      case "knockback":
        s({ freq: 520, to: 140, type: "triangle", dur: 0.3, gain: 0.22 });
        break;
      case "home":
        [523, 659, 784, 1047].forEach((f, i) => s({ freq: f, type: "sine", dur: 0.26, gain: 0.16, at: i * 0.08 }));
        break;
      case "fanfare":
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          s({ freq: f, type: "triangle", dur: 0.4, gain: 0.16, at: i * 0.11 }),
        );
        break;
      case "pass":
        s({ freq: 180, type: "sine", dur: 0.14, gain: 0.18 });
        break;
      case "forfeit":
        s({ freq: 150, type: "square", dur: 0.12, gain: 0.14, lowpass: 900 });
        s({ freq: 120, type: "square", dur: 0.18, gain: 0.14, lowpass: 900, at: 0.15 });
        break;
      case "yourTurn":
        s({ freq: 880, type: "sine", dur: 0.08, gain: 0.1 });
        s({ freq: 1320, type: "sine", dur: 0.1, gain: 0.1, at: 0.08 });
        break;
    }
  }

  private tone({ freq, to, type = "sine", dur, gain = 0.2, at = 0, attack = 0.005, lowpass, vibrato }: ToneOpts): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 7;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur);
    }
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = osc.connect(env);
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lowpass;
      node = node.connect(f);
    }
    node.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise({ dur, gain = 0.3, at = 0, filter = "bandpass", freq = 1000, to, q = 1 }: NoiseOpts): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(env).connect(this.master!);
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + dur + 0.02);
  }
}

export const sfx = new Sfx();
