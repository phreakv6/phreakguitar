// Stage view: the rig as you'd want it mid-song - the preset big, previous /
// next, one footswitch per thing in the chain, Master. Full screen
// ('full'), or compact beside the tabs ('mini'). It owns no state: the
// host (main.ts) answers what's on and does the switching.

import { Knob, type KnobSpec } from './ui/knob.ts';

export interface StageItem {
  id: string; // 'gate' | 'comp' | 'slot<n>' | effect id
  label: string;
  on: boolean;
  key: string; // its keyboard shortcut, shown on the switch
}

export interface StageHost {
  preset(): { name: string; notes?: string; edited: boolean };
  items(): StageItem[];
  toggle(id: string): void;
  prev(): void;
  next(): void;
  tuner(): void;
  /** Master volume: its knob spec and live value. */
  master: { spec: KnobSpec; get(): number; set(v: number): void };
  close?(): void;
}

export interface StageView {
  el: HTMLElement;
  /** Re-reads the preset and the switches (cheap; call after any change). */
  refresh(): void;
  /** The output level, 0..1, and whether it's near clipping. */
  level(frac: number, hot: boolean): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function buildStage(host: StageHost, mode: 'full' | 'mini'): StageView {
  const el = document.createElement('div');
  el.className = `stage-view stage-${mode}`;
  el.innerHTML = `
    ${mode === 'full' ? `<div class="stage-top">
      <button class="link stage-tuner">Tuner (T)</button>
      <button class="link stage-close">Exit stage view (Esc)</button>
    </div>` : ''}
    <div class="stage-preset">
      <button class="nav stage-prev" aria-label="Previous preset">◀</button>
      <div class="stage-name"><b></b><span class="preset-edited" hidden>edited</span></div>
      <button class="nav stage-next" aria-label="Next preset">▶</button>
    </div>
    ${mode === 'full' ? '<p class="stage-notes"></p>' : ''}
    <div class="stage-switches"></div>
    <div class="stage-bottom">
      <div class="stage-master"></div>
      <div class="stage-meter"><div class="meter-bar"><div class="meter-fill"></div></div><small>Out</small></div>
      ${mode === 'mini' ? '<button class="link stage-tuner">Tuner (T)</button>' : ''}
    </div>`;

  const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  q('.stage-prev').addEventListener('click', () => host.prev());
  q('.stage-next').addEventListener('click', () => host.next());
  el.querySelector('.stage-close')?.addEventListener('click', () => host.close?.());
  el.querySelector('.stage-tuner')?.addEventListener('click', () => host.tuner());

  const master = new Knob({ ...host.master.spec, value: host.master.get() });
  master.onChange = (v) => host.master.set(v);
  q('.stage-master').append(master.el);

  const switches = q<HTMLElement>('.stage-switches');
  function refresh(): void {
    const p = host.preset();
    q('.stage-name b').textContent = p.name;
    q<HTMLElement>('.stage-name .preset-edited').hidden = !p.edited;
    const notes = el.querySelector<HTMLElement>('.stage-notes');
    if (notes) notes.textContent = p.notes ?? '';
    switches.innerHTML = host.items().map((it) => `
      <button class="stage-fs" data-id="${esc(it.id)}" aria-pressed="${it.on}">
        <span class="led" aria-hidden="true"></span>
        <span class="stage-fs-name">${esc(it.label)}</span>
        <kbd>${esc(it.key)}</kbd>
      </button>`).join('');
    switches.querySelectorAll<HTMLButtonElement>('.stage-fs').forEach((b) =>
      b.addEventListener('click', () => host.toggle(b.dataset.id!)));
    if (Math.abs(master.value - host.master.get()) > 1e-9) master.set(host.master.get(), false);
  }
  const fill = q<HTMLElement>('.stage-meter .meter-fill');
  refresh();
  return {
    el,
    refresh,
    level(frac, hot) {
      fill.style.transform = `scaleX(${frac})`;
      el.classList.toggle('hot', hot);
    },
  };
}
