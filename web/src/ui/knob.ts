// Rotary knob: drag up/down (shift for fine), wheel, arrow keys,
// double-click to reset. 270° sweep like an amp-panel pot.

const sweep = 270;
const startAngle = -135;

export interface KnobSpec {
  label: string;
  min: number;
  max: number;
  value: number;
  defaultValue: number;
  step?: number;
  format?: (v: number) => string;
  /** Knob cap: 'disc' (default), 'goldcap' (black skirt, metal cap: the
      Marshall look), 'chicken' (chicken-head pointer), 'skirted' (Fender
      blackface: black knurled knob with the numbers on its skirt). */
  cap?: 'disc' | 'goldcap' | 'chicken' | 'skirted';
  /** The numbers printed round the knob on an amp panel, first to last
      (on the skirt itself for a 'skirted' cap). */
  dial?: [number, number];
}

// Each cap is a still part (round bodies, lit from above) and a part that
// turns (pointers and numbers), drawn pointing up.
const CAPS: Record<string, { still: string; turns: string; shadow: number }> = {
  disc: {
    still: `<circle class="knob-body" r="30" />`,
    turns: `<line class="knob-pointer" x1="0" y1="-12" x2="0" y2="-27" />`,
    shadow: 30,
  },
  goldcap: {
    still: `<circle class="knob-skirt" r="31" /><circle class="knob-gold" r="20" />`,
    turns: `<line class="knob-gold-line" x1="0" y1="-6" x2="0" y2="-19" /><line class="knob-skirt-line" x1="0" y1="-22" x2="0" y2="-30" />`,
    shadow: 31,
  },
  chicken: {
    still: '',
    turns: `<path class="knob-chicken" d="M0 -34 C 8 -24 15 -10 16 4 A 16 16 0 1 1 -16 4 C -15 -10 -8 -24 0 -34 Z" />
            <line class="knob-chicken-line" x1="0" y1="-30" x2="0" y2="-12" />`,
    shadow: 17,
  },
  skirted: {
    still: `<circle class="knob-skirt" r="34" /><circle class="knob-knurl" r="19" /><circle class="knob-top" r="13" />`,
    turns: `<line class="knob-skirt-line" x1="0" y1="-7" x2="0" y2="-17" />`,
    shadow: 34,
  },
};

// Gradients the caps share (amp faces fill with them), added to the page once.
function shareGradients(): void {
  if (document.getElementById('knob-defs')) return;
  const stops = (list: string[]) => list.map((c, i) => `<stop offset="${i / (list.length - 1)}" stop-color="${c}" />`).join('');
  const lit = (id: string, list: string[]) =>
    `<radialGradient id="${id}" cx="0.36" cy="0.28" r="0.85">${stops(list)}</radialGradient>`;
  const brushed = (id: string, list: string[]) =>
    `<linearGradient id="${id}" x1="0.2" y1="0" x2="0.8" y2="1">${stops(list)}</linearGradient>`;
  document.body.insertAdjacentHTML('beforeend', `<svg id="knob-defs" width="0" height="0" aria-hidden="true" style="position:absolute"><defs>
    ${lit('knob-black', ['#5a5a5a', '#222', '#0a0a0a', '#000'])}
    ${lit('knob-cream', ['#fffaf0', '#efe3c4', '#bfae86'])}
    ${lit('knob-oxblood', ['#b0525a', '#6a1c26', '#3a0c12', '#22060a'])}
    ${lit('knob-teal', ['#8fe0e4', '#2f9aa3', '#17646c', '#0c4047'])}
    ${brushed('knob-gold', ['#fbeeb8', '#d9b45a', '#f1d98c', '#a37c26', '#d6b25c'])}
    ${brushed('knob-silver', ['#ffffff', '#b9bdc3', '#eef0f2', '#7d8187', '#c9ccd1'])}
  </defs></svg>`);
}

/** Numbers `from`..`to` round a circle of radius `r`. On the panel they sit
    where the pointer points; on a skirt they run the other way, so the one
    under the panel's mark is the setting. */
function dialNumbers([from, to]: [number, number], r: number, onSkirt: boolean): string {
  let out = '';
  for (let n = from; n <= to; n++) {
    const deg = startAngle + ((n - from) / (to - from)) * sweep;
    if (onSkirt) {
      out += `<text transform="rotate(${-deg}) translate(0 ${-r})">${n}</text>`;
    } else {
      const rad = ((deg - 90) * Math.PI) / 180;
      out += `<text x="${(r * Math.cos(rad)).toFixed(1)}" y="${(r * Math.sin(rad)).toFixed(1)}">${n}</text>`;
    }
  }
  return out;
}

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
    const cap = CAPS[spec.cap ?? 'disc'];
    const skirted = spec.cap === 'skirted';
    if (spec.dial) this.el.classList.add('knob-dialled');
    shareGradients();
    this.el.innerHTML = `
      <svg viewBox="-50 -50 100 100" aria-hidden="true">
        <path class="knob-track" d="${arcPath(startAngle, startAngle + sweep)}" />
        <path class="knob-arc" />
        ${spec.dial && !skirted ? `<g class="knob-dial">${dialNumbers(spec.dial, 43, false)}</g>` : ''}
        ${spec.dial && skirted ? '<line class="knob-index" x1="0" y1="-37" x2="0" y2="-46" />' : ''}
        <circle class="knob-shadow" r="${cap.shadow}" cy="4" />
        ${cap.still}
        <g class="knob-cap">${cap.turns}${spec.dial && skirted ? `<g class="knob-dial">${dialNumbers(spec.dial, 27.5, true)}</g>` : ''}</g>
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
