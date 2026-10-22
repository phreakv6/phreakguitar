// The amp's tubes, seen through the back of the chassis: preamp bottles
// glow with their triodes' activity (from the circuit solver), the phase
// inverter and power tubes with how hard the power section works. Heaters
// glow dimly whenever the rig is on, like the real thing.
import type { AmpInfo } from './amps.ts';
import type { AmpActivity } from './rig.ts';

interface Bottle {
  label: string; // V1, PI, ...
  type: string;  // 12AX7, EL34, ...
  kind: 'pre' | 'power' | 'rect';
  devices: string[]; // solver device names (preamp bottles only)
}

const SVG = 'http://www.w3.org/2000/svg';

/** The amp's bottles, from its netlist: triodes XV<n><A|B> share bottle V<n>. */
export function bottlesFor(amp: AmpInfo): Bottle[] {
  if (!amp.netlist) return [];
  const pre = new Map<string, Bottle>();
  for (const [, dev, n, rest] of amp.netlist.matchAll(/^(XV(\d+)[AB]?)\s.*?\bTRIODE\b(.*)$/gim)) {
    const mu = Number(/MU=([\d.]+)/i.exec(rest)?.[1] ?? 100);
    const b = pre.get(n) ?? { label: `V${n}`, type: mu < 60 ? '12AY7' : '12AX7', kind: 'pre' as const, devices: [] };
    b.devices.push(dev.toUpperCase());
    pre.set(n, b);
  }
  const power = /^\*@power\b(.*)$/im.exec(amp.netlist)?.[1] ?? '';
  const key = (k: string) => new RegExp(`\\b${k}=(\\S+)`).exec(power)?.[1];
  const bottles = [...pre.values()].sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  bottles.push({ label: 'PI', type: key('pi') ?? '12AX7', kind: 'power', devices: [] });
  const tubes = key('tubes') ?? 'EL34';
  for (let i = 0; i < Number(key('count') ?? 2); i++)
    bottles.push({ label: '', type: tubes, kind: 'power', devices: [] });
  const rect = key('rectifier');
  if (rect && rect !== 'silicon') bottles.push({ label: 'RECT', type: rect, kind: 'rect', devices: [] });
  return bottles;
}

// One bottle, drawn standing on the chassis. Big bottles for output tubes
// and rectifiers (EL84s are small, like the real ones).
function drawBottle(b: Bottle): SVGSVGElement {
  const big = b.kind !== 'pre' && b.label !== 'PI' && b.type !== 'EL84';
  const w = big ? 46 : 32, h = big ? 112 : 80;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `${-w / 2 - 8} ${-h - 10} ${w + 16} ${h + 22}`);
  svg.setAttribute('width', String(w + 16));
  svg.setAttribute('height', String(h + 22));
  svg.classList.add('tube', `tube-${b.kind}`);
  const r = w / 2, top = -h + r;
  // Coke-bottle shape for the big octals (6L6, EL34, GZ34); straight for the rest.
  const glass = big
    ? `M${-r + 4} 0 L${-r + 4} ${-h * 0.25} C${-r - 1} ${-h * 0.45} ${-r} ${-h * 0.6} ${-r} ${top} A${r} ${r} 0 0 1 ${r} ${top}
       C${r} ${-h * 0.6} ${r + 1} ${-h * 0.45} ${r - 4} ${-h * 0.25} L${r - 4} 0 Z`
    : `M${-r} 0 L${-r} ${top} A${r} ${r} 0 0 1 ${r} ${top} L${r} 0 Z`;
  const plateH = h * 0.42, plateW = w * 0.62, plateY = -h * 0.2 - plateH;
  svg.innerHTML = `
    <ellipse class="tube-halo" cx="0" cy="${-h * 0.32}" rx="${w * 0.9}" ry="${h * 0.42}" />
    <path class="tube-glass" d="${glass}" />
    <rect class="tube-plate" x="${-plateW / 2}" y="${plateY}" width="${plateW}" height="${plateH}" rx="2" />
    <rect class="tube-heater" x="${-plateW * 0.18}" y="${plateY + 4}" width="${plateW * 0.36}" height="${plateH - 8}" rx="3" />
    <rect class="tube-hot" x="${-plateW * 0.18}" y="${plateY + 4}" width="${plateW * 0.36}" height="${plateH - 8}" rx="3" />
    ${b.kind === 'power' && big ? `<ellipse class="tube-blue" cx="0" cy="${plateY + plateH / 2}" rx="${r - 3}" ry="${plateH * 0.75}" />` : ''}
    <ellipse class="tube-getter" cx="0" cy="${top - r * 0.55}" rx="${r * 0.62}" ry="${r * 0.32}" />
    <path class="tube-shine" d="M${-r * 0.55} ${-h * 0.12} L${-r * 0.55} ${top}" />
    <rect class="tube-base" x="${-r - (big ? 0 : 1)}" y="0" width="${w + (big ? 0 : 2)}" height="${big ? 10 : 6}" rx="2" />`;
  return svg;
}

export interface TubeView {
  el: HTMLElement;
  update(a: AmpActivity): void;
  /** Rig off: heaters out. */
  reset(): void;
}

/** The chassis: the tubes, and the power supply with its B+ readout and
    the Response knob (`responseKnob`, if the amp has one). */
export function buildTubes(amp: AmpInfo, responseKnob?: HTMLElement): TubeView | null {
  const bottles = bottlesFor(amp);
  if (bottles.length === 0) return null;
  const el = document.createElement('div');
  el.className = 'tubes';
  el.setAttribute('aria-label', 'Tubes');
  const power = /^\*@power\b(.*)$/im.exec(amp.netlist ?? '')?.[1] ?? '';
  const idleBplus = Number(/\bbplus=([\d.]+)/.exec(power)?.[1] ?? 0);
  const rectifier = /\brectifier=(\S+)/.exec(power)?.[1] ?? 'silicon';
  const groups = [
    { title: 'Preamp', items: bottles.filter((b) => b.kind === 'pre') },
    { title: 'Power', items: bottles.filter((b) => b.kind !== 'pre') },
  ];
  const cells: { b: Bottle; svg: SVGSVGElement; glow: number }[] = [];
  for (const g of groups) {
    const row = document.createElement('div');
    row.className = 'tube-group';
    row.innerHTML = `<small class="tube-group-title">${g.title}</small>`;
    const shelf = document.createElement('div');
    shelf.className = 'tube-shelf';
    for (const b of g.items) {
      const cell = document.createElement('figure');
      cell.className = 'tube-cell';
      const svg = drawBottle(b);
      const cap = document.createElement('figcaption');
      cap.innerHTML = b.label ? `${b.label}<br><span>${b.type}</span>` : `<br><span>${b.type}</span>`;
      cell.append(svg, cap);
      cell.title = b.devices.length ? `${b.label} (${b.type}): ${b.devices.join(' + ')}` : `${b.label || 'Output'} (${b.type})`;
      shelf.append(cell);
      cells.push({ b, svg, glow: 0 });
    }
    row.append(shelf);
    el.append(row);
  }

  // Power supply: B+ sagging live as you play, and the Response knob.
  const supply = document.createElement('div');
  supply.className = 'tube-group supply';
  supply.innerHTML = `<small class="tube-group-title">Power supply</small>
    <div class="supply-read" title="B+: the voltage the output tubes run on. It dips when you dig in and recovers between notes.">
      <b class="bplus">—</b><span class="sag"></span>
      <small>B+ · ${rectifier === 'silicon' ? 'silicon rectifier' : `${rectifier} rectifier`}</small>
    </div>`;
  if (responseKnob) supply.append(responseKnob);
  if (idleBplus > 0) el.append(supply);
  const bplusEl = supply.querySelector<HTMLElement>('.bplus')!;
  const sagEl = supply.querySelector<HTMLElement>('.sag')!;
  let shownVolts = 0;

  return {
    el,
    update(a) {
      const index = new Map(a.devices.map((d, i) => [d.toUpperCase(), i]));
      // The power section's output: soft-clipped, ~0.1 at a quiet clean
      // note, ~0.9 flat out.
      const power = Math.min(1, Math.max(0, (a.power - 0.03) / 0.8)) ** 0.7;
      for (const c of cells) {
        let target: number;
        if (c.b.kind === 'pre') {
          // Triode activity: plate-current swing relative to its idle current.
          const swing = Math.max(0, ...c.b.devices.map((d) => a.values[index.get(d) ?? -1] ?? 0));
          target = Math.min(1, swing) ** 0.6;
        } else if (c.b.kind === 'rect') target = power * 0.6; // works harder with the load, glows less
        else target = power;
        // Light up instantly, fade over ~150 ms (reports come ~30x a second).
        c.glow = Math.max(target, c.glow * 0.78);
        c.svg.style.setProperty('--g', c.glow.toFixed(3));
      }
      if (a.supply > 0 && idleBplus > 0) {
        // Dips show at once; the readout climbs back over ~150 ms.
        shownVolts = shownVolts === 0 || a.supply < shownVolts ? a.supply : shownVolts + (a.supply - shownVolts) * 0.25;
        bplusEl.textContent = `${Math.round(shownVolts)} V`;
        const sag = (1 - shownVolts / idleBplus) * 100;
        sagEl.textContent = sag >= 0.5 ? `−${sag.toFixed(sag < 10 ? 1 : 0)}%` : '';
        supply.style.setProperty('--sag', String(Math.min(1, Math.max(0, sag / 15))));
      }
    },
    reset() {
      shownVolts = 0;
      bplusEl.textContent = '—';
      sagEl.textContent = '';
      for (const c of cells) {
        c.glow = 0;
        c.svg.style.setProperty('--g', '0');
      }
    },
  };
}
