// Pedal designer (W3): a pedal's parts as an editable list. Every edit
// rewrites the pedal's netlist (the same file the engine and ngspice read)
// and hands it back to be re-solved and heard at once. Factory pedals are
// read-only here: fork one first.

import { factoryPedals, type PedalInfo } from './pedals.ts';
import { drawAddedPart } from './schematic.ts';

/** One element line of the netlist (top level, outside .subckt). */
export interface Part {
  line: number; // index into the netlist's lines
  name: string; // as written (R1, XDRIVE, ...)
  letter: string; // r c l d q j v e x k
  nodes: string[];
  value: string; // value, model, or the subcircuit name for X
  params: string[]; // key=value tokens (X lines)
}

const nodeCount: Record<string, number> = { r: 2, c: 2, l: 2, d: 2, q: 3, j: 3, v: 2, e: 4 };

export function parseParts(netlist: string): Part[] {
  const parts: Part[] = [];
  let inSub = false;
  netlist.split('\n').forEach((raw, line) => {
    const t = raw.trim().split(/\s+/);
    const head = (t[0] ?? '').toLowerCase();
    if (head === '.subckt') inSub = true;
    else if (head === '.ends') inSub = false;
    if (inSub || !head || head.startsWith('*') || head.startsWith('.') || head.startsWith('+')) return;
    const letter = head[0];
    if (letter === 'x') {
      const params = t.filter((x, i) => i > 0 && x.includes('='));
      const rest = t.slice(1).filter((x) => !x.includes('='));
      parts.push({ line, name: t[0], letter, nodes: rest.slice(0, -1), value: rest[rest.length - 1] ?? '', params });
    } else if (letter === 'k') {
      parts.push({ line, name: t[0], letter, nodes: t.slice(1, 3), value: t[3] ?? '', params: [] });
    } else {
      const n = nodeCount[letter] ?? 2;
      const value = letter === 'v' ? t.slice(n + 1).filter((x) => x.toLowerCase() !== 'dc').join(' ') : t[n + 1] ?? '';
      parts.push({ line, name: t[0], letter, nodes: t.slice(1, n + 1), value, params: [] });
    }
  });
  return parts;
}

function partLine(p: Part): string {
  if (p.letter === 'x') return [p.name, ...p.nodes, p.value, ...p.params].join(' ');
  if (p.letter === 'v') return [p.name, ...p.nodes, 'DC', p.value].join(' ');
  return [p.name, ...p.nodes, p.value].join(' ');
}

// --- the parts library: every model the factory pedals use, plus a few
// common swaps. Germanium, silicon, Schottky and LED clippers differ
// mostly in IS and N (how early and how softly they turn on).
interface LibModel { name: string; kind: 'd' | 'npn' | 'pnp' | 'njf' | 'pjf'; line: string; label: string }
const extras: string[] = [
  '.model D1N914 D(IS=2.52n N=1.752 RS=0.568)',
  '.model DBAT46 D(IS=0.14u N=1.04 RS=1)',
  '.model DLEDRED D(IS=1e-19 N=1.7 RS=5)',
  '.model D1N4001 D(IS=14.11n N=1.984 RS=33.89m)',
  '.model Q2N3904 NPN(IS=6.734f BF=416.4 BR=0.7371)',
  '.model Q2N3906 PNP(IS=1.41f BF=180.7 BR=4.977)',
  '.model Q2N5088 NPN(IS=5.9f BF=900 BR=2)',
  '.model J2N5457 NJF(VTO=-1.372 BETA=1.125m LAMBDA=2.3m)',
];
const labels: Record<string, string> = {
  D1N4148: 'silicon', D1N914: 'silicon', D1N34A: 'germanium', DBAT46: 'Schottky', DLEDRED: 'red LED',
  D1N4001: 'silicon rectifier', DCLAMP: 'op-amp rail clamp',
};

function libraryModels(): LibModel[] {
  const seen = new Map<string, LibModel>();
  const lines = [...extras, ...factoryPedals.flatMap((p) => p.netlist.split('\n'))];
  for (const raw of lines) {
    const m = /^\.model\s+(\S+)\s+(\w+)\s*\(/i.exec(raw.trim());
    if (!m) continue;
    const name = m[1].toUpperCase();
    const kind = m[2].toLowerCase();
    if (!['d', 'npn', 'pnp', 'njf', 'pjf'].includes(kind) || seen.has(name) || name === 'DCLAMP') continue;
    seen.set(name, { name, kind: kind as LibModel['kind'], line: raw.trim(), label: labels[name] ?? '' });
  }
  return [...seen.values()];
}
const library = libraryModels();

function modelsOf(netlist: string): Map<string, string> {
  const m = new Map<string, string>(); // name -> kind
  for (const raw of netlist.split('\n')) {
    const x = /^\.model\s+(\S+)\s+(\w+)/i.exec(raw.trim());
    if (x) m.set(x[1].toUpperCase(), x[2].toLowerCase());
  }
  return m;
}

/** Adds a library .model line if the netlist doesn't define that model. */
function ensureModel(lines: string[], model: string): void {
  if (modelsOf(lines.join('\n')).has(model.toUpperCase())) return;
  const lib = library.find((l) => l.name === model.toUpperCase());
  if (!lib) return;
  const at = lines.findIndex((l) => /^\.(model|subckt|param)\b/i.test(l.trim()));
  lines.splice(at < 0 ? lines.length : at, 0, lib.line);
}

function nodesOf(parts: Part[]): string[] {
  const s = new Set<string>();
  for (const p of parts) if (p.letter !== 'k') p.nodes.forEach((n) => s.add(n));
  return [...s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

const isValue = (v: string) => /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?(meg|[tgkmunpf])?[a-z]*$/i.test(v);

const kinds = [
  { key: 'r', label: 'Resistor', prefix: 'R', value: '10k' },
  { key: 'c', label: 'Capacitor', prefix: 'C', value: '100n' },
  { key: 'l', label: 'Inductor', prefix: 'L', value: '100m' },
  { key: 'd', label: 'Diode', prefix: 'D', model: 'd' },
  { key: 'npn', label: 'NPN transistor', prefix: 'Q', model: 'npn' },
  { key: 'pnp', label: 'PNP transistor', prefix: 'Q', model: 'pnp' },
  { key: 'njf', label: 'N-JFET', prefix: 'J', model: 'njf' },
] as const;

const typeLabel = (p: Part, models: Map<string, string>): string => {
  switch (p.letter) {
    case 'r': return 'Resistor';
    case 'c': return 'Capacitor';
    case 'l': return 'Inductor';
    case 'd': return 'Diode';
    case 'q': return models.get(p.value.toUpperCase()) === 'pnp' ? 'PNP' : 'NPN';
    case 'j': return 'JFET';
    case 'v': return 'Supply';
    case 'e': return 'Controlled source';
    case 'k': return 'Coupling';
    default: {
      const sub = p.value.toLowerCase();
      return sub === 'pot' ? 'Pot' : sub === 'sw' ? 'Switch' : sub === 'triode' ? 'Triode' : p.value;
    }
  }
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface DesignerHost {
  /** The pedal's netlist changed: re-solve it wherever it's loaded.
      Resolves to the engine's error, or null. */
  apply(netlist: string): Promise<string | null>;
  rename(name: string): void;
  remove(): void;
  /** On a pedal with a drawing: lets the player click `count` wires on it;
      their nodes and points, or null if cancelled. */
  pick?(count: number): Promise<{ node: string; at: [number, number] }[] | null>;
}

/** The parts list for `pedal`; editable when `host` is given (your pedal). */
export function buildDesigner(pedal: PedalInfo, host?: DesignerHost): HTMLElement {
  const root = document.createElement('div');
  root.className = 'designer';
  let netlist = pedal.netlist;
  const history: string[] = [];
  let error: string | null = null;
  let errorLine = -1;
  let rawOpen = false;
  let picked: [number, number][] | null = null; // drawing points for the next added part

  async function commit(next: string, undoable = true): Promise<void> {
    if (next === netlist) return;
    if (undoable) {
      history.push(netlist);
      if (history.length > 100) history.shift();
    }
    netlist = next;
    render();
    error = host ? await host.apply(netlist) : null;
    // Parser errors name the line ("line 42: ..."): the part on it.
    const m = error && /line (\d+)/.exec(error);
    errorLine = m ? Number(m[1]) - 1 : -1;
    render();
  }

  function edit(fn: (lines: string[]) => void): void {
    const lines = netlist.split('\n');
    fn(lines);
    void commit(lines.join('\n'));
  }

  function render(): void {
    const parts = parseParts(netlist);
    const models = modelsOf(netlist);
    const nodes = nodesOf(parts);
    const editable = !!host;
    const listId = `nodes-${pedal.id}`;
    // Pins on a node nothing else touches: almost always a typo (and the
    // solver would only say the matrix is singular).
    const uses = new Map<string, number>();
    for (const p of parts) if (p.letter !== 'k') for (const n of p.nodes) uses.set(n.toLowerCase(), (uses.get(n.toLowerCase()) ?? 0) + 1);
    const outNode = /^\*@output\s+(\S+)/im.exec(netlist)?.[1].toLowerCase();
    const dangling = (n: string) => n !== '0' && n.toLowerCase() !== outNode && (uses.get(n.toLowerCase()) ?? 0) < 2;
    const warnings = parts.flatMap((p) => p.letter === 'k' ? [] : p.nodes.filter(dangling).map((n) => `${p.name}: pin "${n}" connects to nothing else`));
    // The guitar's source is the pedal's input: not a part to edit.
    const inputName = /^\*@input\s+(\S+)/im.exec(netlist)?.[1].toUpperCase();

    const rows = parts.map((p, i) => {
      let value = esc(p.value);
      const fixed = p.name.toUpperCase() === inputName;
      if (fixed) value = 'guitar in';
      else if (editable) {
        if ('rclk'.includes(p.letter) || p.letter === 'v')
          value = `<input class="d-value" data-i="${i}" value="${esc(p.value)}" size="7" aria-label="${esc(p.name)} value">`;
        else if ('dqj'.includes(p.letter)) {
          const kind = p.letter === 'd' ? 'd' : models.get(p.value.toUpperCase()) ?? (p.letter === 'j' ? 'njf' : 'npn');
          const opts = library.filter((l) => l.kind === kind);
          if (!opts.some((o) => o.name === p.value.toUpperCase())) opts.unshift({ name: p.value.toUpperCase(), kind: kind as LibModel['kind'], line: '', label: '' });
          value = `<select class="d-model" data-i="${i}" aria-label="${esc(p.name)} model">${opts
            .map((o) => `<option value="${o.name}" ${o.name === p.value.toUpperCase() ? 'selected' : ''}>${o.name}${o.label ? ` (${o.label})` : ''}</option>`)
            .join('')}</select>`;
        } else if (p.value.toLowerCase() === 'pot') {
          const r = p.params.find((x) => /^r=/i.test(x))?.slice(2) ?? '';
          const pos = p.params.find((x) => /^pos=/i.test(x))?.replace(/^pos=\{?|\}$/gi, '') ?? '';
          value = `<input class="d-pot" data-i="${i}" value="${esc(r)}" size="6" aria-label="${esc(p.name)} resistance"> <small>knob: ${esc(pos)}</small>`;
        }
      } else if (p.value.toLowerCase() === 'pot') {
        value = esc(p.params.find((x) => /^r=/i.test(x))?.slice(2) ?? '');
      }
      const nodeCells = p.nodes.map((n, k) => editable && !fixed && p.letter !== 'k'
        ? `<input class="d-node" data-i="${i}" data-k="${k}" value="${esc(n)}" size="7" list="${listId}" aria-label="${esc(p.name)} pin ${k + 1}">`
        : esc(n)).join(' ');
      const del = editable && !fixed ? `<button class="link d-del" data-i="${i}" aria-label="Remove ${esc(p.name)}">remove</button>` : '';
      const warn = p.letter !== 'k' && p.nodes.some(dangling);
      return `<tr class="${p.line === errorLine ? 'd-error' : warn ? 'd-warn' : ''}" data-part="${esc(p.name.toUpperCase())}">
        <td>${esc(p.name)}</td><td>${typeLabel(p, models)}</td><td class="d-nodes">${nodeCells}</td><td>${value}</td><td>${del}</td></tr>`;
    }).join('');

    const name = pedal.name;
    const addRow = editable ? `
      <div class="d-add">
        <select class="d-add-kind" aria-label="New part type">${kinds.map((k) => `<option value="${k.key}">${k.label}</option>`).join('')}</select>
        between <input class="d-add-a" size="5" list="${listId}" placeholder="node" aria-label="First pin">
        and <input class="d-add-b" size="5" list="${listId}" placeholder="node" aria-label="Second pin">
        <span class="d-add-c-wrap" hidden>and <input class="d-add-c" size="5" list="${listId}" placeholder="node" aria-label="Third pin"></span>
        <span class="d-add-value-wrap"><input class="d-add-value" size="6" aria-label="Value"></span>
        <select class="d-add-model" aria-label="Model" hidden></select>
        ${host?.pick && /^\*@sch /m.test(netlist) ? '<button class="link d-add-pick">Pick on drawing</button>' : ''}
        <button class="d-add-go">Add part</button>
        <p class="hint">Pins: C B E for transistors, D G S for JFETs, anode then cathode for diodes. 0 is ground; a new name makes a new node.</p>
      </div>` : '';

    root.innerHTML = `
      ${editable ? `<div class="d-head">
        <label>Name <input class="d-name" value="${esc(name)}" size="24" maxlength="40"></label>
        <button class="d-undo" ${history.length ? '' : 'disabled'}>Undo</button>
        <button class="link d-raw">${rawOpen ? 'Hide' : 'Edit'} netlist</button>
        <button class="link d-export">Export .cir</button>
        <button class="link d-csv">Parts list (CSV)</button>
        <button class="link d-delete">Delete this pedal</button>
      </div>` : `<div class="d-head"><button class="link d-export">Export .cir</button><button class="link d-csv">Parts list (CSV)</button></div>`}
      ${error ? `<p class="d-error-text">${esc(error)}</p>` : ''}
      ${editable && warnings.length ? `<p class="d-warn-text">${warnings.map(esc).join('<br>')}</p>` : ''}
      ${rawOpen ? `<div class="d-rawbox"><textarea class="d-rawtext" spellcheck="false" rows="18">${esc(netlist)}</textarea>
        <button class="d-raw-apply">Apply</button></div>` : ''}
      <datalist id="${listId}">${nodes.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="d-parts-wrap"><table class="d-parts"><thead><tr><th>Part</th><th>Type</th><th>Pins</th><th>Value</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${addRow}`;

    const partAt = (el: HTMLElement) => parts[Number(el.dataset.i)];
    root.querySelectorAll<HTMLInputElement>('.d-value').forEach((inp) => inp.addEventListener('change', () => {
      const p = partAt(inp);
      const v = inp.value.trim();
      if (!isValue(v)) { inp.classList.add('bad'); return; }
      edit((lines) => { lines[p.line] = partLine({ ...p, value: v }); });
    }));
    root.querySelectorAll<HTMLInputElement>('.d-pot').forEach((inp) => inp.addEventListener('change', () => {
      const p = partAt(inp);
      const v = inp.value.trim();
      if (!isValue(v)) { inp.classList.add('bad'); return; }
      edit((lines) => { lines[p.line] = partLine({ ...p, params: p.params.map((x) => (/^r=/i.test(x) ? `R=${v}` : x)) }); });
    }));
    root.querySelectorAll<HTMLSelectElement>('.d-model').forEach((sel) => sel.addEventListener('change', () => {
      const p = partAt(sel);
      edit((lines) => {
        lines[p.line] = partLine({ ...p, value: sel.value });
        ensureModel(lines, sel.value);
      });
    }));
    root.querySelectorAll<HTMLInputElement>('.d-node').forEach((inp) => inp.addEventListener('change', () => {
      const p = partAt(inp);
      const v = inp.value.trim();
      if (!/^[\w.]+$/.test(v)) { inp.classList.add('bad'); return; }
      const nodes = [...p.nodes];
      nodes[Number(inp.dataset.k)] = v;
      edit((lines) => { lines[p.line] = partLine({ ...p, nodes }); });
    }));
    root.querySelectorAll<HTMLButtonElement>('.d-del').forEach((b) => b.addEventListener('click', () => {
      const p = partAt(b);
      edit((lines) => { lines[p.line] = `* removed: ${lines[p.line]}`; });
    }));

    root.querySelector('.d-undo')?.addEventListener('click', () => {
      const prev = history.pop();
      if (prev !== undefined) void commit(prev, false);
    });
    root.querySelector('.d-raw')?.addEventListener('click', () => { rawOpen = !rawOpen; render(); });
    root.querySelector('.d-raw-apply')?.addEventListener('click', () =>
      void commit(root.querySelector<HTMLTextAreaElement>('.d-rawtext')!.value));
    root.querySelector<HTMLInputElement>('.d-name')?.addEventListener('change', (e) => {
      const v = (e.target as HTMLInputElement).value.trim().replace(/"/g, "'");
      if (!v) return;
      edit((lines) => {
        const i = lines.findIndex((l) => /^\*@pedal\b/i.test(l));
        if (i >= 0) lines[i] = /name="[^"]*"/i.test(lines[i]) ? lines[i].replace(/name="[^"]*"/i, `name="${v}"`) : `${lines[i]} name="${v}"`;
      });
      host?.rename(v);
    });
    root.querySelector('.d-delete')?.addEventListener('click', (e) => {
      // Two clicks: the first asks.
      const b = e.target as HTMLButtonElement;
      if (b.dataset.armed) host?.remove();
      else {
        b.dataset.armed = '1';
        b.textContent = 'Click again to delete it for good';
      }
    });
    root.querySelector('.d-export')?.addEventListener('click', () =>
      download(`${slug(pedal.name)}.cir`, netlist, 'text/plain'));
    root.querySelector('.d-csv')?.addEventListener('click', () =>
      download(`${slug(pedal.name)}-parts.csv`, partsCsv(parseParts(netlist), modelsOf(netlist)), 'text/csv'));

    // Adding a part.
    const kindSel = root.querySelector<HTMLSelectElement>('.d-add-kind');
    if (kindSel) {
      const modelSel = root.querySelector<HTMLSelectElement>('.d-add-model')!;
      const valueWrap = root.querySelector<HTMLElement>('.d-add-value-wrap')!;
      const valueInp = root.querySelector<HTMLInputElement>('.d-add-value')!;
      const cWrap = root.querySelector<HTMLElement>('.d-add-c-wrap')!;
      const sync = () => {
        const k = kinds.find((x) => x.key === kindSel.value)!;
        const model = 'model' in k ? k.model : null;
        modelSel.hidden = !model;
        valueWrap.hidden = !!model;
        cWrap.hidden = !(model && model !== 'd');
        if (model) modelSel.innerHTML = library.filter((l) => l.kind === model)
          .map((l) => `<option value="${l.name}">${l.name}${l.label ? ` (${l.label})` : ''}</option>`).join('');
        else valueInp.value = 'value' in k ? k.value : '';
      };
      kindSel.addEventListener('change', () => { picked = null; sync(); });
      sync();
      const pickBtn = root.querySelector<HTMLButtonElement>('.d-add-pick');
      pickBtn?.addEventListener('click', async () => {
        const k = kinds.find((x) => x.key === kindSel.value)!;
        const need = 'model' in k && k.model !== 'd' ? 3 : 2;
        const pinNames = need === 3 ? (k.key === 'njf' ? 'drain, gate, source' : 'collector, base, emitter') : k.key === 'd' ? 'anode, then cathode' : 'one end, then the other';
        pickBtn.textContent = `Click ${need} wires on the drawing: ${pinNames} (Esc cancels)`;
        const got = await host!.pick!(need);
        pickBtn.textContent = 'Pick on drawing';
        if (!got) return;
        ['.d-add-a', '.d-add-b', '.d-add-c'].forEach((sel, i) => {
          if (got[i]) root.querySelector<HTMLInputElement>(sel)!.value = got[i].node;
        });
        picked = got.map((g) => g.at);
      });
      root.querySelector('.d-add-go')!.addEventListener('click', () => {
        const k = kinds.find((x) => x.key === kindSel.value)!;
        const pins = ['.d-add-a', '.d-add-b', '.d-add-c'].map((s) => root.querySelector<HTMLInputElement>(s)!.value.trim());
        const model = 'model' in k ? k.model : null;
        const need = model && model !== 'd' ? 3 : 2;
        if (pins.slice(0, need).some((n) => !/^[\w.]+$/.test(n))) return;
        const value = model ? modelSel.value : valueInp.value.trim();
        if (!model && !isValue(value)) { valueInp.classList.add('bad'); return; }
        const used = new Set(parts.map((p) => p.name.toUpperCase()));
        let n = 1;
        while (used.has(`${k.prefix}${100 + n}`)) n++;
        const name = `${k.prefix}${100 + n}`;
        const symType = { r: 'res', c: 'cap', l: 'ind', d: 'diode', npn: 'npn', pnp: 'pnp', njf: 'njf' }[k.key];
        const drawing = picked && picked.length >= need ? drawAddedPart(netlist, symType, name, picked) : [];
        picked = null;
        edit((lines) => {
          // Before the models and subcircuits, after the last part.
          const at = lines.findIndex((l) => /^\.(model|subckt|param)\b/i.test(l.trim()));
          lines.splice(at < 0 ? lines.length : at, 0, `${name} ${pins.slice(0, need).join(' ')} ${value}`, '');
          if (model) ensureModel(lines, value);
          if (drawing.length) lines.push(...drawing);
        });
      });
    }
  }

  render();
  return root;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pedal';

function partsCsv(parts: Part[], models: Map<string, string>): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = parts
    .filter((p) => !['v', 'e', 'k'].includes(p.letter) && !['opamp'].includes(p.value.toLowerCase()))
    .map((p) => {
      const value = p.value.toLowerCase() === 'pot' ? (p.params.find((x) => /^r=/i.test(x))?.slice(2) ?? '') : p.value;
      return [p.name, typeLabel(p, models), value].map(q).join(',');
    });
  return ['Part,Type,Value', ...rows].join('\n') + '\n';
}

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A copy of `pedal` to edit: named "My <name>", remembering its parent. */
export function forkNetlist(pedal: PedalInfo, name: string): string {
  const lines = pedal.netlist.split('\n');
  const i = lines.findIndex((l) => /^\*@pedal\b/i.test(l));
  if (i >= 0) lines[i] = lines[i].replace(/name="[^"]*"/i, `name="${name.replace(/"/g, "'")}"`);
  return [`* ${name}: forked from ${pedal.name} in the PhreakGuitar pedal designer.`, ...lines].join('\n');
}
