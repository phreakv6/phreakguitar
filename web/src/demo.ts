// The demo guitar: a dry, straight-from-the-pickup guitar part to play
// through the rig when no guitar is plugged in. Nothing is recorded: each
// string is a Karplus-Strong loop (a delay line one period long, fed back
// through a gentle lowpass), plucked with a burst of noise shaped by where
// the pick strikes. Rendered once, at the rig's sample rate, and looped.
//
// No DOM or Node APIs, so the Node tools can render it too.

export type DemoKind = 'rhythm' | 'lead';
export const demoNames: Record<DemoKind, string> = { rhythm: 'Rhythm', lead: 'Lead' };

/** Peak level of the rendered part: about what a humbucker gives an
    interface set with some headroom. */
const peakLevel: Record<DemoKind, number> = { rhythm: 0.4, lead: 0.28 };

interface Note {
  t: number;      // start, in beats
  dur: number;    // beats until the string is damped
  midi: number[]; // low string first; strummed in this order
  vel?: number;   // 0..1
  pm?: boolean;   // palm mute
  /** Lead only. Start this many semitones away and bend to pitch. */
  bend?: number;
  vib?: boolean;
  /** Lead only: no new pick stroke (hammer-on / pull-off / release). */
  legato?: boolean;
}

interface Part { bpm: number; beats: number; notes: Note[] }

// --- the parts ------------------------------------------------------------------

const fifth = (root: number) => [root, root + 7, root + 12];
const E2 = 40, G2 = 43, A2 = 45, C3 = 48, D3 = 50;

/** One bar of a chugging power-chord figure on `root`, starting at `t`. */
function chug(t: number, root: number): Note[] {
  const stab = (at: number, dur: number): Note => ({ t: t + at, dur, midi: fifth(root), vel: 1 });
  const mute = (at: number): Note => ({ t: t + at, dur: 0.45, midi: [root], vel: 0.8, pm: true });
  return [stab(0, 1), mute(1), mute(1.5), stab(2, 0.5), mute(2.5), stab(3, 0.5), mute(3.5)];
}

/** One bar of strummed open chord: down on the beats, lighter up-strokes
    (high strings first) between. */
function strum(t: number, chord: number[]): Note[] {
  const down = (at: number, dur: number, vel = 0.9): Note => ({ t: t + at, dur, midi: chord, vel });
  const up = (at: number): Note => ({ t: t + at, dur: 0.5, midi: chord.slice(-4).reverse(), vel: 0.55 });
  return [down(0, 1), down(1, 0.5, 0.75), up(1.5), down(2, 0.5), up(2.5), down(3, 0.5, 0.75), up(3.5)];
}

const Em = [40, 47, 52, 55, 59, 64];
const G = [43, 47, 50, 55, 59, 67];
const D = [50, 57, 62, 66];
const Asus2 = [45, 52, 57, 59, 64];

// Four bars of power chords for the driven sounds, four of open chords
// for the clean ones.
const rhythm: Part = {
  bpm: 104,
  beats: 32,
  notes: [
    ...chug(0, E2), ...chug(4, G2), ...chug(8, A2),
    { t: 12, dur: 1.5, midi: fifth(C3), vel: 1 },
    { t: 13.5, dur: 0.45, midi: [C3], vel: 0.8, pm: true },
    { t: 14, dur: 1.5, midi: fifth(D3), vel: 1 },
    { t: 15.5, dur: 0.45, midi: [D3], vel: 0.8, pm: true },
    ...strum(16, Em), ...strum(20, G), ...strum(24, D), ...strum(28, Asus2),
  ],
};

// E minor pentatonic around the 12th fret: bends, vibrato, a run up.
const n = (t: number, dur: number, midi: number, more: Partial<Note> = {}): Note => ({ t, dur, midi: [midi], ...more });
const lead: Part = {
  bpm: 92,
  beats: 32,
  notes: [
    n(0, 1.5, 71, { bend: -2, vib: true }), n(1.5, 0.5, 69), n(2, 0.5, 67), n(2.5, 0.5, 64),
    n(3, 0.25, 67), n(3.25, 0.75, 69, { legato: true }),
    n(4, 3, 64, { vib: true }),

    n(8, 0.5, 76), n(8.5, 0.5, 74), n(9, 0.5, 71), n(9.5, 1.5, 76, { bend: -2, vib: true }),
    n(11, 0.5, 74), n(11.5, 0.5, 71),
    n(12, 0.5, 69), n(12.5, 0.5, 67), n(13, 2, 71, { bend: -2, vib: true }),

    n(16, 0.5, 64, { vel: 0.8 }), n(16.5, 0.5, 67, { vel: 0.8 }), n(17, 0.5, 69, { vel: 0.85 }),
    n(17.5, 0.5, 71, { vel: 0.9 }), n(18, 0.5, 74), n(18.5, 0.5, 76),
    n(19, 1, 79, { bend: -1, vib: true }),
    n(20, 0.5, 76), n(20.5, 0.5, 74), n(21, 1, 71, { vib: true }),
    n(22, 0.5, 69), n(22.5, 0.5, 67), n(23, 1, 64),

    n(24, 0.5, 62), n(24.5, 0.5, 64), n(25, 1, 67, { vib: true }),
    n(26, 1, 71, { bend: -2 }), n(27, 0.5, 69, { legato: true }), n(27.5, 0.5, 67),
    n(28, 3.5, 64, { vib: true }),
  ],
};

const parts: Record<DemoKind, Part> = { rhythm, lead };

// --- the string -----------------------------------------------------------------

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Deterministic noise (mulberry32): the part renders the same every time. */
function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
  };
}

class PluckedString {
  private readonly buf: Float32Array;
  private readonly mask: number;
  private w = 0;
  private last = 0;
  private readonly sampleRate: number;
  private readonly rand: () => number;

  constructor(sampleRate: number, seed: number) {
    this.sampleRate = sampleRate;
    this.rand = noise(seed);
    let size = 1024;
    while (size < sampleRate / 60) size *= 2; // one period of anything above 60 Hz
    this.buf = new Float32Array(size);
    this.mask = size - 1;
  }

  /** A pick stroke: one period of noise, darker for a softer stroke, with
      the notch a pick an eighth of the way along the string leaves. */
  pluck(freq: number, vel: number, muted: boolean): void {
    const period = Math.round(this.sampleRate / freq);
    const shape = new Float32Array(period);
    const smooth = muted ? 0.8 : 0.62 - 0.3 * vel;
    let lp = 0;
    for (let i = 0; i < period; i++) {
      lp += (1 - smooth) * (this.rand() - lp);
      shape[i] = lp;
    }
    const pick = Math.max(1, Math.round(period * 0.13));
    const out = new Float32Array(period);
    let peak = 1e-9;
    for (let i = 0; i < period; i++) {
      out[i] = shape[i] - shape[(i - pick + period) % period];
      peak = Math.max(peak, Math.abs(out[i]));
    }
    for (let i = 0; i < period; i++) this.buf[(this.w - period + i) & this.mask] = (out[i] / peak) * vel;
    this.last = 0;
  }

  /** One sample. `t60` is how long the note takes to die away (s);
      `damping` 0..0.5 is how fast the highs go (0.5: a palm on the bridge). */
  tick(freq: number, t60: number, damping: number): number {
    // The loop is the delay plus the lowpass's own `damping` samples.
    const delay = this.sampleRate / freq - damping;
    const whole = Math.floor(delay), frac = delay - whole;
    const a = this.buf[(this.w - whole) & this.mask];
    const b = this.buf[(this.w - whole - 1) & this.mask];
    const x = a + frac * (b - a);
    const keep = 10 ** (-3 / (freq * t60));
    const y = keep * ((1 - damping) * x + damping * this.last);
    this.last = x;
    this.buf[this.w] = y;
    this.w = (this.w + 1) & this.mask;
    return y;
  }
}

// --- rendering ------------------------------------------------------------------

const ringT60 = 5, mutedT60 = 0.3, releaseT60 = 0.05;
const strumGap = 0.011; // s between strings

/** Renders one pass of the part: mono, `sampleRate`, made to loop. */
export function renderDemo(kind: DemoKind, sampleRate: number): Float32Array {
  const part = parts[kind];
  const beat = (60 / part.bpm) * sampleRate;
  const length = Math.round(part.beats * beat);
  const out = new Float32Array(length);
  if (kind === 'lead') renderLead(part, beat, sampleRate, out);
  else renderChords(part, beat, sampleRate, out);
  finish(out, sampleRate, peakLevel[kind]);
  return out;
}

/** Each chord voice gets a string of its own; a string rings until its
    note ends or the next stroke on it. */
function renderChords(part: Part, beat: number, sampleRate: number, out: Float32Array): void {
  const voices = Math.max(...part.notes.map((nt) => nt.midi.length));
  for (let v = 0; v < voices; v++) {
    const string = new PluckedString(sampleRate, 1000 + v);
    const strokes = part.notes
      .filter((nt) => nt.midi[v] !== undefined)
      .map((nt) => ({
        at: Math.round(nt.t * beat + v * strumGap * sampleRate),
        end: Math.round((nt.t + nt.dur) * beat),
        freq: hz(nt.midi[v]), vel: nt.vel ?? 0.9, pm: !!nt.pm,
      }));
    let next = 0, cur: (typeof strokes)[number] | null = null;
    for (let i = 0; i < out.length; i++) {
      if (next < strokes.length && i >= strokes[next].at) {
        cur = strokes[next++];
        string.pluck(cur.freq, cur.vel, cur.pm);
      }
      if (!cur) continue;
      const held = i < cur.end;
      out[i] += string.tick(cur.freq, held ? (cur.pm ? mutedT60 : ringT60) : releaseT60, cur.pm ? 0.5 : 0.12);
    }
  }
}

/** One string, fretted and bent: the pitch glides, so hammer-ons and bends
    keep the string ringing. */
function renderLead(part: Part, beat: number, sampleRate: number, out: Float32Array): void {
  const string = new PluckedString(sampleRate, 7);
  const bendTime = 0.16 * sampleRate, vibDelay = 0.3 * sampleRate;
  const vibRate = (2 * Math.PI * 5.4) / sampleRate, vibDepth = 0.28; // semitones
  let next = 0, cur: Note | null = null, start = 0, end = 0;
  for (let i = 0; i < out.length; i++) {
    if (next < part.notes.length && i >= Math.round(part.notes[next].t * beat)) {
      cur = part.notes[next++];
      start = i;
      end = Math.round((cur.t + cur.dur) * beat);
      const from = cur.midi[0] + (cur.bend ?? 0);
      if (!cur.legato) string.pluck(hz(from), cur.vel ?? 1, false);
    }
    if (!cur) continue;
    const age = i - start;
    let semis = cur.midi[0];
    if (cur.bend) {
      const p = Math.min(1, age / bendTime);
      semis += cur.bend * (1 - p * p * (3 - 2 * p));
    }
    if (cur.vib && age > vibDelay) {
      const depth = vibDepth * Math.min(1, (age - vibDelay) / (0.25 * sampleRate));
      semis += depth * Math.sin(vibRate * (age - vibDelay));
    }
    out[i] = string.tick(hz(semis), i < end ? ringT60 : releaseT60, 0.1);
  }
}

/** The pickup (a resonant lowpass near 4 kHz), a DC blocker, the level,
    and a short fade at the loop point. */
function finish(x: Float32Array, sampleRate: number, peak: number): void {
  const w0 = (2 * Math.PI * 4000) / sampleRate, alpha = Math.sin(w0) / (2 * 1.3), c = Math.cos(w0);
  const a0 = 1 + alpha, b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, a1 = (-2 * c) / a0, a2 = (1 - alpha) / a0;
  const dc = 1 - (2 * Math.PI * 30) / sampleRate;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, hpIn = 0, hpOut = 0, max = 1e-9;
  for (let i = 0; i < x.length; i++) {
    const lp = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = lp;
    hpOut = lp - hpIn + dc * hpOut;
    hpIn = lp;
    x[i] = hpOut;
    max = Math.max(max, Math.abs(hpOut));
  }
  const fade = Math.round(0.01 * sampleRate), gain = peak / max;
  for (let i = 0; i < x.length; i++) x[i] *= gain * Math.min(1, (x.length - 1 - i) / fade);
}
