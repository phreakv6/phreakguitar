// The tuner: reads the dry guitar ~15 times a second (pitch.ts), shows the
// nearest note and a cents needle. Mutes the rig while open, like a stomp
// tuner, unless told not to.
import { detectPitch, noteOf } from './pitch.ts';

export interface TunerOptions {
  /** The dry input to read, or null when the rig is off. */
  input: () => AnalyserNode | null;
  /** Called when muting starts / stops. */
  mute: (on: boolean) => void;
  sampleRate: () => number;
}

const inTuneCents = 3;
const holdMs = 1500; // keep the last note up this long after the string stops

export class Tuner {
  readonly el: HTMLElement;
  private timer = 0;
  private buf = new Float32Array(4096);
  private shown: { midi: number; cents: number; hz: number } | null = null;
  private candidate = { midi: -1, count: 0 };
  private lastHeard = 0;
  private muted = false;
  private readonly opts: TunerOptions;

  constructor(opts: TunerOptions) {
    this.opts = opts;
    this.el = document.createElement('section');
    this.el.className = 'tuner';
    this.el.hidden = true;
    this.el.setAttribute('aria-label', 'Tuner');
    this.el.innerHTML = `
      <div class="tuner-note" aria-live="polite"><b>–</b><sub></sub></div>
      <div class="tuner-meter" aria-hidden="true">
        <div class="tuner-zone"></div>
        <div class="tuner-ticks"><span>−50</span><span>−25</span><span>0</span><span>+25</span><span>+50</span></div>
        <div class="tuner-needle"></div>
      </div>
      <div class="tuner-read">Play a single string</div>
      <label class="tuner-mute"><input type="checkbox" checked /> Mute while tuning</label>
      <button class="tuner-done">Done</button>`;
    this.el.querySelector('.tuner-done')!.addEventListener('click', () => this.close());
    this.el.querySelector<HTMLInputElement>('.tuner-mute input')!.addEventListener('change', (e) => {
      this.setMuted((e.target as HTMLInputElement).checked);
    });
  }

  get isOpen(): boolean { return !this.el.hidden; }

  open(): void {
    if (this.isOpen) return;
    this.el.hidden = false;
    this.shown = null;
    this.render();
    this.setMuted(this.el.querySelector<HTMLInputElement>('.tuner-mute input')!.checked);
    this.timer = window.setInterval(() => this.tick(), 1000 / 15);
  }

  close(): void {
    if (!this.isOpen) return;
    this.el.hidden = true;
    clearInterval(this.timer);
    this.setMuted(false);
    this.el.dispatchEvent(new Event('close'));
  }

  private setMuted(on: boolean): void {
    if (on === this.muted) return;
    this.muted = on;
    this.opts.mute(on);
  }

  private tick(): void {
    const input = this.opts.input();
    if (!input) return;
    input.getFloatTimeDomainData(this.buf);
    const p = detectPitch(this.buf, this.opts.sampleRate());
    const now = performance.now();
    if (p) {
      const n = noteOf(p.hz);
      this.lastHeard = now;
      if (this.shown && n.midi === this.shown.midi) {
        // Same note: settle the needle (light smoothing, still responsive).
        this.shown.cents += (n.cents - this.shown.cents) * 0.4;
        this.shown.hz = p.hz;
      } else {
        // A new note must read twice in a row before it replaces the old
        // one: the pick attack often reads a stray harmonic for a moment.
        this.candidate = n.midi === this.candidate.midi ? { midi: n.midi, count: this.candidate.count + 1 } : { midi: n.midi, count: 1 };
        if (!this.shown || this.candidate.count >= 2) this.shown = { midi: n.midi, cents: n.cents, hz: p.hz };
      }
    }
    this.el.classList.toggle('stale', !!this.shown && now - this.lastHeard > holdMs);
    this.render();
  }

  private render(): void {
    const s = this.shown;
    const note = this.el.querySelector('.tuner-note')!;
    const needle = this.el.querySelector<HTMLElement>('.tuner-needle')!;
    if (!s) {
      note.innerHTML = '<b>–</b><sub></sub>';
      needle.style.setProperty('--pos', '0');
      this.el.classList.remove('in-tune', 'flat', 'sharp');
      return;
    }
    const n = noteOf(s.hz);
    note.innerHTML = `<b>${n.name}</b><sub>${n.octave}</sub>`;
    const c = Math.max(-50, Math.min(50, s.cents));
    needle.style.setProperty('--pos', String(c / 50));
    const inTune = Math.abs(s.cents) <= inTuneCents;
    this.el.classList.toggle('in-tune', inTune);
    this.el.classList.toggle('flat', !inTune && s.cents < 0);
    this.el.classList.toggle('sharp', !inTune && s.cents > 0);
    const cents = Math.round(s.cents);
    this.el.querySelector('.tuner-read')!.textContent =
      `${s.hz.toFixed(1)} Hz · ${inTune ? 'in tune' : `${cents > 0 ? '+' : ''}${cents} cents ${cents > 0 ? '(sharp)' : '(flat)'}`}`;
  }
}
