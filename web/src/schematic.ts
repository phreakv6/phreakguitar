// Draws a pedal's schematic from the *@sch lines in its netlist (see
// tools/asc_to_sch.py): LTspice coordinates, standard symbols, values taken
// from the netlist itself so the picture can't disagree with the circuit.

import type { PedalInfo } from './pedals.ts';
import { parseParts } from './designer.ts';

interface Sym { type: string; x: number; y: number; rot: string; name: string; added?: boolean }
interface Flag { x: number; y: number; label: string }
type Pt = [number, number];

// Symbol bodies in local coordinates, pins where LTspice puts them.
const BODIES: Record<string, string> = {
  res: 'M16 16V28L4 34L28 42L4 50L28 58L4 66L28 74L16 80V96',
  cap: 'M16 0V26M0 26H32M0 38H32M16 38V64',
  polcap: 'M16 0V26M0 26H32M0 42Q16 32 32 42M16 37V64',
  diode: 'M16 0V20M0 20H32L16 44ZM0 44H32M16 44V64',
  npn: 'M0 48H16M16 16V80M16 36L64 6V0M16 60L64 90V96',
  pnp: 'M0 48H16M16 16V80M16 36L64 6V0M16 60L64 90V96',
  opamp: 'M-32 32L32 64L-32 96ZM0 32V48M0 80V96',
  pot: 'M16 16V28L4 34L28 42L4 50L28 58L4 66L28 74L16 80V96M64 64H30',
  ind: 'M16 16V28A10 10 0 0 1 16 48A10 10 0 0 1 16 68A10 10 0 0 1 16 88V96',
  njf: 'M0 48H16M16 16V80M16 28H64V0M16 68H64V96',
  voltage: 'M0 16V32M0 80V96',
};
const PINS: Record<string, Pt[]> = {
  res: [[16, 16], [16, 96]], cap: [[16, 0], [16, 64]], polcap: [[16, 0], [16, 64]],
  diode: [[16, 0], [16, 64]], npn: [[64, 0], [0, 48], [64, 96]], pnp: [[64, 0], [0, 48], [64, 96]],
  opamp: [[-32, 80], [-32, 48], [0, 32], [0, 96], [32, 64]], pot: [[16, 16], [64, 64], [16, 96]],
  voltage: [[0, 16], [0, 96]], ind: [[16, 16], [16, 96]], njf: [[64, 0], [0, 48], [64, 96]],
};
// Small filled shapes: arrowheads and marks.
const FILLS: Record<string, string> = {
  npn: 'M64 90L48 88L56 76Z',
  pnp: 'M22 64L36 62L30 74Z',
  pot: 'M30 64L42 58V70Z',
  njf: 'M16 48L6 42V54Z',
};

// LTspice orientation: rotate by R, then mirror (M) left-right.
function transform(rot: string): string {
  const deg = Number(rot.slice(1));
  return `${rot.startsWith('M') ? 'scale(-1 1) ' : ''}rotate(${deg})`;
}
function place(p: Pt, s: Sym): Pt {
  let [x, y] = p;
  for (let i = 0; i < Number(s.rot.slice(1)) / 90; i++) [x, y] = [-y, x];
  if (s.rot.startsWith('M')) x = -x;
  return [s.x + x, s.y + y];
}

/** Display values straight from the netlist's element lines. */
function partValues(netlist: string, pedal: PedalInfo): Map<string, string> {
  const values = new Map<string, string>();
  const models = new Map<string, string>();
  let inSub = false;
  for (const raw of netlist.split('\n')) {
    const t = raw.trim().split(/\s+/);
    const head = t[0]?.toLowerCase() ?? '';
    if (head === '.subckt') inSub = true;
    else if (head === '.ends') inSub = false;
    else if (head === '.model') models.set(t[1].toLowerCase(), t[1]);
    if (inSub || !head || head.startsWith('*') || head.startsWith('.')) continue;
    const name = t[0].toUpperCase();
    const unit = (v: string, u: string) =>
      v.toLowerCase().replace(/meg$/, 'M').replace(/u$/, 'µ').replace(/k$/, 'k') + u;
    switch (head[0]) {
      case 'r': values.set(name, unit(t[3], 'Ω')); break;
      case 'c': values.set(name, unit(t[3], 'F')); break;
      case 'l': values.set(name, unit(t[3], 'H')); break;
      case 'j': values.set(name, t[4].replace(/^J(?=\d)/i, '')); break;
      case 'd': values.set(name, t[3].replace(/^D(?=\d)/i, '')); break;
      case 'q': values.set(name, t[4].replace(/^Q(?=\d)/i, '')); break;
      case 'x': {
        if (t[4]?.toUpperCase() === 'POT') {
          const r = /R=(\S+)/i.exec(raw)?.[1] ?? '';
          const ctl = /pos=\{(\w+)\}/i.exec(raw)?.[1]?.toLowerCase();
          const label = pedal.controls.find((c) => c.name === ctl)?.label ?? 'Pot';
          values.set(name, `${label} ${unit(r, 'Ω')}`);
        } else {
          values.set(name, 'op-amp');
        }
        break;
      }
    }
  }
  return values;
}

// Which netlist node each drawn wire is. The drawing only has coordinates;
// connected wire ends and pins form nets, and the parts on them say which
// node each net is: flags by name, parts with a fixed pin order (diodes,
// transistors, op-amps, sources, a pot's wiper) directly, then two-pin
// parts and pot ends (either way round: drawings mirror them) carry a known
// node at one end over to the other.
const pinOrder: Record<string, (number | null)[]> = {
  diode: [0, 1], npn: [0, 1, 2], pnp: [0, 1, 2], njf: [0, 1, 2], pot: [null, 1, null], voltage: [0, 1],
  opamp: [0, 1, 3, 4, 2], // drawn In+ In- V+ V- Out; netlist inp inn out vcc vee
};
function resolveNets(pedal: PedalInfo, syms: Sym[], wires: [number, number, number, number][], flags: Flag[],
                     added: Set<number>) {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(k, r);
    return r;
  };
  const union = (a: string, b: string) => { const x = find(a), y = find(b); if (x !== y) parent.set(x, y); };
  const key = (p: Pt) => `${p[0]},${p[1]}`;
  const points: Pt[] = [];
  for (const [x1, y1, x2, y2] of wires) { union(key([x1, y1]), key([x2, y2])); points.push([x1, y1], [x2, y2]); }
  const pinsOf = new Map<Sym, Pt[]>();
  for (const s of syms) { const ps = (PINS[s.type] ?? []).map((p) => place(p, s)); pinsOf.set(s, ps); points.push(...ps); }
  for (const f of flags) points.push([f.x, f.y]);
  // A point on a wire's span is on that wire (T-junctions). Wires the
  // designer added join only where they were clicked: their far ends, not
  // their pins or corners, and nothing joins their spans.
  const addedEnds = new Map<string, number>();
  added.forEach((i) => { const [x1, y1, x2, y2] = wires[i]; for (const k of [key([x1, y1]), key([x2, y2])]) addedEnds.set(k, (addedEnds.get(k) ?? 0) + 1); });
  const addedPins = new Set(syms.filter((s) => s.added).flatMap((s) => pinsOf.get(s)!.map(key)));
  const internal = (p: Pt) => { const n = addedEnds.get(key(p)); return n !== undefined && (n > 1 || addedPins.has(key(p))); };
  for (const [i, [x1, y1, x2, y2]] of wires.entries()) {
    if (added.has(i)) continue;
    for (const [x, y] of points) {
      if (internal([x, y])) continue;
      const on = (x1 === x2 && x === x1 && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) ||
        (y1 === y2 && y === y1 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2));
      if (on) union(key([x, y]), key([x1, y1]));
    }
  }

  const parts = new Map(parseParts(pedal.netlist).map((p) => [p.name.toUpperCase(), p]));
  const nodes = new Set([...parts.values()].flatMap((p) => p.nodes.map((n) => n.toLowerCase())));
  const outNode = /^\*@output\s+(\S+)/im.exec(pedal.netlist)?.[1].toLowerCase();
  const inSource = /^\*@input\s+(\S+)/im.exec(pedal.netlist)?.[1].toUpperCase();
  const inNode = inSource ? parts.get(inSource)?.nodes[0]?.toLowerCase() : undefined;
  const netNode = new Map<string, string>();
  const set = (p: Pt, node: string | undefined) => { if (node && !netNode.has(find(key(p)))) netNode.set(find(key(p)), node.toLowerCase()); };

  for (const f of flags) {
    const l = f.label.toLowerCase();
    if (l === '0') set([f.x, f.y], '0');
    else if (l === 'out') set([f.x, f.y], outNode);
    else if (l === 'in') set([f.x, f.y], inNode); // where the guitar comes in
    else if (nodes.has(l)) set([f.x, f.y], l);
    else { // "9V": the node a 9 V supply drives
      const volts = parseFloat(l);
      const src = [...parts.values()].find((p) => p.letter === 'v' && parseFloat(p.value) === volts);
      set([f.x, f.y], src?.nodes[0]);
    }
  }
  for (const s of syms) {
    const order = pinOrder[s.type];
    const part = parts.get(s.name);
    if (!order || !part) continue;
    pinsOf.get(s)!.forEach((p, i) => { const k = order[i]; if (k !== null) set(p, part.nodes[k]); });
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const s of syms) {
      const part = parts.get(s.name);
      const all = pinsOf.get(s)!;
      // The two interchangeable ends: a two-pin part's pins, a pot's a and b.
      const ps = s.type === 'pot' ? [all[0], all[2]] : all;
      const ends = s.type === 'pot' ? [part?.nodes[0], part?.nodes[2]] : part?.nodes;
      if (!part || !ends || ps.length !== 2 || ends.length !== 2 || ends.some((n) => !n)) continue;
      const [a, b] = ps.map((p) => netNode.get(find(key(p))));
      const [n0, n1] = ends.map((n) => n!.toLowerCase());
      const other = (n: string) => (n === n0 ? n1 : n === n1 ? n0 : undefined);
      if (a && !b && other(a)) { set(ps[1], other(a)); changed = true; }
      else if (b && !a && other(b)) { set(ps[0], other(b)); changed = true; }
    }
  }
  return (p: Pt) => netNode.get(find(key(p)));
}

export function hasSchematic(pedal: PedalInfo): boolean {
  return /^\*@sch /m.test(pedal.netlist);
}

export interface SchematicOptions {
  /** A wire was clicked: the netlist node it is, and the point on the
      wire (drawing units, on the 16 grid) nearest the click. */
  onNode?: (node: string, at: Pt) => void;
}

export function renderSchematic(pedal: PedalInfo, opts: SchematicOptions = {}): SVGSVGElement {
  const syms: Sym[] = [], wires: [number, number, number, number][] = [], flags: Flag[] = [];
  const addedWires = new Set<number>(); // drawn by the designer
  for (const line of pedal.netlist.split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] !== '*@sch') continue;
    if (t[1] === 'sym') syms.push({ type: t[2], x: +t[3], y: +t[4], rot: t[5], name: t[6].toUpperCase(), added: t[7] === 'new' });
    else if (t[1] === 'wire') { wires.push([+t[2], +t[3], +t[4], +t[5]]); if (t[6] === 'new') addedWires.add(wires.length - 1); }
    else if (t[1] === 'flag') flags.push({ x: +t[2], y: +t[3], label: t[4] });
  }
  const values = partValues(pedal.netlist, pedal);

  // Junction dots: points where three or more wire ends / pins meet.
  const degree = new Map<string, number>();
  const bump = (p: Pt) => degree.set(p.join(','), (degree.get(p.join(',')) ?? 0) + 1);
  for (const [x1, y1, x2, y2] of wires) { bump([x1, y1]); bump([x2, y2]); }
  for (const s of syms) for (const p of PINS[s.type] ?? []) bump(place(p, s));
  for (const f of flags) bump([f.x, f.y]);
  for (const [x1, y1, x2, y2] of wires)
    for (const key of degree.keys()) {
      const [x, y] = key.split(',').map(Number);
      const inside = (x1 === x2 && x === x1 && y > Math.min(y1, y2) && y < Math.max(y1, y2)) ||
        (y1 === y2 && y === y1 && x > Math.min(x1, x2) && x < Math.max(x1, x2));
      if (inside) degree.set(key, (degree.get(key) ?? 0) + 2);
    }

  // Bounds for the viewBox.
  const xs: number[] = [], ys: number[] = [];
  for (const [x1, y1, x2, y2] of wires) xs.push(x1, x2), ys.push(y1, y2);
  for (const s of syms) for (const p of PINS[s.type] ?? []) { const q = place(p, s); xs.push(q[0]); ys.push(q[1]); }
  for (const f of flags) xs.push(f.x), ys.push(f.y);
  const pad = 200; // room for the in/out labels beside their points
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;

  const ns = 'http://www.w3.org/2000/svg';
  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };
  const svg = el('svg', { viewBox: `${x0} ${y0} ${w} ${h}`, class: 'schematic', role: 'img',
                          'aria-label': `${pedal.name} schematic` });
  // Halo gradients for the live glow (see setGlow).
  const defs = el('defs', {});
  for (const [id, color] of [['halo-diode', '#ff5a36'], ['halo-bjt', '#ffb347']]) {
    const grad = el('radialGradient', { id });
    grad.append(el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.9 }),
                el('stop', { offset: '45%', 'stop-color': color, 'stop-opacity': 0.35 }),
                el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }));
    defs.append(grad);
  }
  svg.append(defs);
  const halos = el('g', { class: 'sch-halos' });
  svg.append(halos);
  // At most ~0.4 px per unit, so a small circuit isn't blown up to fill the
  // panel (labels stay near 12 px); big ones shrink to fit.
  const fit = `min(100%, ${Math.round(w * 0.4)}px)`, full = `${Math.round(w * 0.4)}px`;
  svg.style.width = fit;
  // Click toggles fit-to-panel and full size (the panel scrolls sideways).
  svg.addEventListener('click', (e) => {
    if ((e.target as Element).classList.contains('sch-hit')) return; // a probe click
    const zoomed = svg.classList.toggle('zoomed');
    svg.style.width = zoomed ? full : fit;
    svg.style.maxWidth = zoomed ? 'none' : '';
  });

  const wireGroup = el('g', { class: 'sch-wires' });
  const nodeAt = resolveNets(pedal, syms, wires, flags, addedWires);
  wires.forEach(([x1, y1, x2, y2], i) => {
    const node = nodeAt([x1, y1]) ?? '';
    wireGroup.append(el('line', { x1, y1, x2, y2, 'data-node': node, ...(addedWires.has(i) ? { class: 'sch-new' } : {}) }));
  });
  for (const [key, n] of degree) {
    if (n < 3) continue;
    const [cx, cy] = key.split(',').map(Number);
    wireGroup.append(el('circle', { cx, cy, r: 7, class: 'sch-dot' }));
  }
  svg.append(wireGroup);
  // Wide invisible twins of the wires: something to click to probe.
  if (opts.onNode) {
    const hits = el('g', { class: 'sch-hits' });
    for (const [x1, y1, x2, y2] of wires) {
      const node = nodeAt([x1, y1]);
      if (!node || node === '0') continue;
      const hit = el('line', { x1, y1, x2, y2, class: 'sch-hit', 'data-node': node });
      const title = el('title', {});
      title.textContent = `Probe ${node}`;
      hit.append(title);
      hit.addEventListener('click', (e) => {
        // The point on this wire nearest the click, snapped to the grid.
        const m = svg.getScreenCTM()?.inverse();
        const q = m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m) : new DOMPoint(x1, y1);
        const snap = (v: number, a: number, b: number) => Math.min(Math.max(Math.round(v / 16) * 16, Math.min(a, b)), Math.max(a, b));
        opts.onNode!(node, x1 === x2 ? [x1, snap(q.y, y1, y2)] : [snap(q.x, x1, x2), y1]);
      });
      hits.append(hit);
    }
    svg.append(hits);
  }

  const present = new Set(parseParts(pedal.netlist).map((x) => x.name.toUpperCase()));
  for (const s of syms) {
    const state = !present.has(s.name) ? ' sch-removed' : s.added ? ' sch-new' : '';
    const g = el('g', { class: `sch-part sch-${s.type}${state}`, 'data-name': s.name });
    const title = el('title', {});
    title.textContent = `${s.name}${values.has(s.name) ? ` · ${values.get(s.name)}` : ''}`;
    g.append(title);
    const body = el('g', { transform: `translate(${s.x} ${s.y}) ${transform(s.rot)}` });
    body.append(el('path', { d: BODIES[s.type] ?? '', class: 'sch-body' }));
    if (FILLS[s.type]) body.append(el('path', { d: FILLS[s.type], class: 'sch-fill' }));
    g.append(body);

    // Label beside the body, never rotated.
    const pins = (PINS[s.type] ?? []).map((p) => place(p, s));
    const cx = pins.reduce((a, p) => a + p[0], 0) / pins.length;
    const cy = pins.reduce((a, p) => a + p[1], 0) / pins.length;
    // One short label per part (its value; the op-amps their name); the
    // designator lives in the hover title, which keeps dense spots legible.
    const horizontal = Number(s.rot.slice(1)) % 180 === 90 && s.type !== 'opamp';
    // Pots are labelled at the wiper (their middle is where wires meet).
    const [lx, ly, anchor] = s.type === 'pot' ? [pins[1][0] + 12, pins[1][1] - 18, 'start']
      : horizontal ? [cx, cy - 30, 'middle'] : [cx + 34, cy + 11, 'start'];
    if (s.type === 'diode' || s.type === 'npn' || s.type === 'pnp') {
      const halo = el('circle', { cx, cy, r: s.type === 'diode' ? 90 : 110, class: 'sch-halo',
                                  fill: `url(#halo-${s.type === 'diode' ? 'diode' : 'bjt'})`, opacity: 0,
                                  'data-for': s.name });
      halos.append(halo);
    }
    const val = el('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'sch-value' });
    val.textContent = s.type === 'opamp' ? s.name.replace(/^X/, '') : (values.get(s.name) ?? s.name);
    g.append(val);
    svg.append(g);
  }

  for (const f of flags) {
    const g = el('g', { class: 'sch-flag' });
    if (f.label === '0') {
      g.append(el('path', { d: `M${f.x - 24} ${f.y}H${f.x + 24}M${f.x - 15} ${f.y + 10}H${f.x + 15}M${f.x - 6} ${f.y + 20}H${f.x + 6}`,
                             class: 'sch-body' }));
    } else {
      const io = /^(IN|OUT)$/i.test(f.label);
      const isIn = f.label.toUpperCase() === 'IN';
      const t = io
        ? el('text', { x: f.x + (isIn ? -22 : 22), y: f.y + 15, 'text-anchor': isIn ? 'end' : 'start', class: 'sch-io' })
        : el('text', { x: f.x, y: f.y - 14, 'text-anchor': 'middle', class: 'sch-rail' });
      t.textContent = io ? (f.label.toUpperCase() === 'IN' ? 'Guitar in' : 'To amp') : f.label;
      g.append(el('circle', { cx: f.x, cy: f.y, r: 6, class: 'sch-dot' }), t);
    }
    svg.append(g);
  }
  return svg;
}

/** Lights a diode or transistor on a drawing made by renderSchematic:
    g = 0 (idle) .. 1 (working flat out). Names are the netlist's (Q1, D3). */
export function setGlow(svg: SVGSVGElement, name: string, g: number): void {
  const halo = svg.querySelector<SVGCircleElement>(`.sch-halo[data-for="${name}"]`);
  const part = svg.querySelector<SVGGElement>(`.sch-part[data-name="${name}"]`);
  if (!halo || !part) return;
  halo.setAttribute('opacity', g.toFixed(3));
  part.style.setProperty('--g', g.toFixed(3));
}

/** Glow level for a device from the engine's activity number. */
export function glowFor(type: 'diode' | 'bjt', activity: number): number {
  if (type === 'diode') // current: dark at 0.1 uA, full at 10 uA (log scale)
    return Math.min(1, Math.max(0, (Math.log10(Math.max(activity, 1e-12)) + 7) / 2));
  return Math.min(1, Math.max(0, activity)) ** 0.6; // collector-current swing
}

/** The drawing's glowable parts: name -> kind. */
export function glowParts(svg: SVGSVGElement): Map<string, 'diode' | 'bjt'> {
  const parts = new Map<string, 'diode' | 'bjt'>();
  svg.querySelectorAll<SVGGElement>('.sch-part').forEach((p) => {
    const kind = p.classList.contains('sch-diode') ? 'diode'
      : p.classList.contains('sch-npn') || p.classList.contains('sch-pnp') ? 'bjt' : null;
    if (kind && p.dataset.name) parts.set(p.dataset.name, kind);
  });
  return parts;
}

/** Marks the wires of `node` (the probed one) on a drawing; null clears. */
export function markNode(svg: SVGSVGElement, node: string | null): void {
  svg.querySelectorAll<SVGLineElement>('.sch-wires line').forEach((l) =>
    l.classList.toggle('probed', !!node && l.dataset.node === node));
}

/** Drawing lines (*@sch) for a part the designer adds: its symbol in a
    free spot beside the points it connects to, and wires from each pin to
    its point (down/up, then across). `type`: res cap ind diode npn pnp njf. */
export function drawAddedPart(netlist: string, type: string, name: string, points: Pt[]): string[] {
  const syms: Pt[] = [];
  for (const line of netlist.split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === '*@sch' && t[1] === 'sym') syms.push([+t[3], +t[4]]);
  }
  const pins = PINS[type] ?? PINS.res;
  const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
  const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
  // Candidate spots around the points; the one farthest from other parts.
  const spots: Pt[] = [];
  for (const d of [128, 192, 256])
    for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]]) spots.push([cx + dx * d, cy + dy * d]);
  const clearance = (p: Pt) => Math.min(...syms.map((s) => Math.hypot(s[0] - p[0], s[1] - p[1])), 1e9);
  const best = spots.reduce((a, b) => (clearance(b) > clearance(a) + 1 ? b : a));
  const g = (v: number) => Math.round(v / 16) * 16;
  const x = g(best[0] - 16), y = g(best[1] - 48);
  const lines = [`*@sch sym ${type} ${x} ${y} R0 ${name} new`];
  pins.forEach(([px, py], i) => {
    const pin: Pt = [x + px, y + py];
    const to = points[i] ?? points[points.length - 1];
    const corner: Pt = [pin[0], to[1]];
    if (pin[1] !== corner[1]) lines.push(`*@sch wire ${pin[0]} ${pin[1]} ${corner[0]} ${corner[1]} new`);
    if (corner[0] !== to[0]) lines.push(`*@sch wire ${corner[0]} ${corner[1]} ${to[0]} ${to[1]} new`);
  });
  return lines;
}
