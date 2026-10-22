// Rotary knob: drag up/down (shift for fine), wheel, arrow keys,
// double-click to reset. 270° sweep like an amp-panel pot.

export interface KnobSpec {
  label: string;
  min: number;
  max: number;
  value: number;
  defaultValue: number;
  step?: number;
  format?: (v: number) => string;
  /** Knob cap: 'disc' (default), 'goldcap' (black skirt, gold cap: the
      British plexi look), 'chicken' (chicken-head pointer), 'skirted' (black-panel:
      black knurled cap on a numbered silver skirt). */
  cap?: 'disc' | 'goldcap' | 'chicken' | 'skirted';
}

// Each cap is drawn pointing up and rotated as a whole.
const CAPS: Record<string, string> = {
  disc: `<circle class="knob-body" r="30" /><line class="knob-pointer" x1="0" y1="-12" x2="0" y2="-27" />`,
  goldcap: `<circle class="knob-skirt" r="31" /><circle class="knob-gold" r="20" />
             <line class="knob-gold-line" x1="0" y1="-6" x2="0" y2="-19" /><line class="knob-skirt-line" x1="0" y1="-22" x2="0" y2="-30" />`,
  chicken: `<path class="knob-chicken" d="M0 -34 C 8 -24 15 -10 16 4 A 16 16 0 1 1 -16 4 C -15 -10 -8 -24 0 -34 Z" />
            <line class="knob-chicken-line" x1="0" y1="-30" x2="0" y2="-12" />`,
  skirted: `<circle class="knob-skirt" r="31" /><circle class="knob-knurl" r="19" />
            <line class="knob-skirt-line" x1="0" y1="-21" x2="0" y2="-30" />`,
};

const sweep = 270;
const startAngle = -135;

export class Knob {
  readonly el: HTMLElement;
  onChange: (v: number) => void = () => {};
  private v: number;
  private readonly spec: KnobSpec;
  private readonly cap: SVGGElement;
  private readonly arc: SVGPathElement;
  private readonly readout: HTMLElement;

  constructor(spec: KnobSpec) {
    this.spec = spec;
    this.v = spec.value;

    this.el = document.createElement('div');
    this.el.className = `knob knob-${spec.cap ?? 'disc'}`;
    this.el.innerHTML = `
      <svg viewBox="-50 -50 100 100" aria-hidden="true">
        <path class="knob-track" d="${arcPath(startAngle, startAngle + sweep)}" />
        <path class="knob-arc" />
        <g class="knob-cap">${CAPS[spec.cap ?? 'disc']}</g>
      </svg>
      <div class="knob-label"></div>
      <div class="knob-value"></div>`;
    this.el.querySelector('.knob-label')!.textContent = spec.label;
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'slider');
    this.el.setAttribute('aria-label', spec.label);
    this.el.setAttribute('aria-valuemin', String(spec.min));
    this.el.setAttribute('aria-valuemax', String(spec.max));

    this.cap = this.el.querySelector('.knob-cap')!;
    this.arc = this.el.querySelector('.knob-arc')!;
    this.readout = this.el.querySelector('.knob-value')!;

    this.bind();
    this.render();
  }

  get value(): number { return this.v; }

  set(v: number, notify = true): void {
    const step = this.spec.step ?? 0;
    let next = Math.min(this.spec.max, Math.max(this.spec.min, v));
    if (step > 0) next = Math.round(next / step) * step;
    if (next === this.v) return;
    this.v = next;
    this.render();
    if (notify) this.onChange(this.v);
  }

  private get range(): number { return this.spec.max - this.spec.min; }

  private bind(): void {
    let lastY = 0;
    this.el.addEventListener('pointerdown', (e) => {
      this.el.setPointerCapture(e.pointerId);
      lastY = e.clientY;
      this.el.focus();
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!this.el.hasPointerCapture(e.pointerId)) return;
      const pixelsForFullSweep = e.shiftKey ? 800 : 200;
      this.set(this.v + ((lastY - e.clientY) / pixelsForFullSweep) * this.range);
      lastY = e.clientY;
    });
    this.el.addEventListener('dblclick', () => this.set(this.spec.defaultValue));
    this.el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.set(this.v - Math.sign(e.deltaY) * this.range * (e.shiftKey ? 0.005 : 0.02));
    }, { passive: false });
    this.el.addEventListener('keydown', (e) => {
      const fine = e.shiftKey ? 0.01 : 0.05;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') this.set(this.v + this.range * fine);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') this.set(this.v - this.range * fine);
      else if (e.key === 'Home') this.set(this.spec.min);
      else if (e.key === 'End') this.set(this.spec.max);
      else return;
      e.preventDefault();
    });
  }

  private render(): void {
    const t = (this.v - this.spec.min) / this.range;
    const angle = startAngle + t * sweep;
    this.cap.setAttribute('transform', `rotate(${angle})`);
    this.arc.setAttribute('d', t > 0.001 ? arcPath(startAngle, angle) : '');
    const text = this.spec.format ? this.spec.format(this.v) : this.v.toFixed(1);
    this.readout.textContent = text;
    this.el.setAttribute('aria-valuenow', String(this.v));
    this.el.setAttribute('aria-valuetext', text);
  }
}

function arcPath(fromDeg: number, toDeg: number): string {
  const r = 40;
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${p(fromDeg)} A ${r} ${r} 0 ${large} 1 ${p(toDeg)}`;
}
