// The looper's box, last in the "after the amp" row: a ring that fills as
// the loop goes round, the one big button (record / play / overdub), stop,
// undo and clear, and the loop's level. State comes from the engine
// (LooperStatus, ~30x a second); the host sends the commands.

import type { LooperState, LooperStatus } from './engine.ts';
import { Knob } from './ui/knob.ts';

export interface LooperHost {
  enabled(): boolean;
  setEnabled(on: boolean): void;
  powered(): boolean;
  /** 0 record / play / overdub, 1 stop / start, 2 undo / redo, 3 clear. */
  command(cmd: number): void;
  level: { get(): number; set(db: number): void };
}

export interface LooperView {
  el: HTMLElement;
  update(s: LooperStatus | null, sampleRate: number): void;
  /** Redraws the box (after turning it on or off). */
  render(): void;
}

/** What the big button does next, by state. */
export const looperNext: Record<LooperState, string> = {
  off: 'Turn on', empty: 'Record', recording: 'Play', playing: 'Overdub', overdubbing: 'Play', stopped: 'Play',
};
export const looperLabel: Record<LooperState, string> = {
  off: 'Off', empty: 'Empty', recording: 'Recording', playing: 'Playing', overdubbing: 'Overdubbing', stopped: 'Stopped',
};

const time = (samples: number, sr: number) => {
  const s = Math.floor(samples / sr);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function buildLooper(host: LooperHost): LooperView {
  const el = document.createElement('div');
  el.className = 'fxbox looper-box';
  let last: LooperStatus | null = null;
  let clearArmed = 0;
  const level = new Knob({ label: 'Level', min: -24, max: 6, value: host.level.get(), defaultValue: 0, step: 0.5,
                           format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB` });
  level.onChange = (v) => host.level.set(v);

  function render(): void {
    if (!host.enabled()) {
      el.innerHTML = `<div class="fx-brand"><b>Looper</b><small>60 s · stereo</small></div>
        <p class="looper-off">Record a part, loop it, play over it, then layer more on top. Switching presets doesn't change the loop.</p>
        <button class="looper-on">Turn the looper on</button>
        <p class="hint">Keys: L record / play / overdub · K stop · U undo</p>`;
      el.querySelector('.looper-on')!.addEventListener('click', () => { host.setEnabled(true); render(); });
      return;
    }
    el.innerHTML = `<div class="fx-brand"><b>Looper</b><small>60 s · stereo</small></div>
      <div class="looper-ring" aria-hidden="true">
        <svg viewBox="0 0 100 100"><circle class="lr-track" cx="50" cy="50" r="42"/><circle class="lr-arc" cx="50" cy="50" r="42" pathLength="100"/></svg>
        <div class="lr-read"><b class="lr-state">Empty</b><span class="lr-time">0:00</span></div>
      </div>
      <button class="looper-main" title="Record, close the loop and play it, overdub on top (L)">Record</button>
      <div class="looper-row">
        <button class="looper-stop" title="Stop; again to play from the top (K)">Stop</button>
        <button class="looper-undo" title="Undo the last overdub; again to bring it back (U)">Undo</button>
        <button class="looper-clear" title="Erase the loop (two clicks)">Clear</button>
      </div>
      <div class="looper-level"></div>
      <button class="link looper-off-btn" title="Turn the looper off (frees its memory)">Turn off</button>`;
    el.querySelector('.looper-level')!.append(level.el);
    el.querySelector('.looper-main')!.addEventListener('click', () => host.command(0));
    el.querySelector('.looper-stop')!.addEventListener('click', () => host.command(1));
    el.querySelector('.looper-undo')!.addEventListener('click', () => host.command(2));
    const clear = el.querySelector<HTMLButtonElement>('.looper-clear')!;
    clear.addEventListener('click', () => {
      if (!clearArmed) {
        clear.textContent = 'Sure?';
        clearArmed = window.setTimeout(() => { clearArmed = 0; clear.textContent = 'Clear'; }, 2500);
        return;
      }
      clearTimeout(clearArmed);
      clearArmed = 0;
      clear.textContent = 'Clear';
      host.command(3);
    });
    el.querySelector('.looper-off-btn')!.addEventListener('click', () => { host.setEnabled(false); render(); });
    paint();
  }

  function paint(): void {
    const s = last;
    const state: LooperState = !host.powered() ? 'off' : s?.state ?? 'empty';
    el.dataset.state = state;
    const q = <T extends Element>(sel: string) => el.querySelector<T>(sel);
    const main = q<HTMLButtonElement>('.looper-main');
    if (!main) return;
    main.textContent = host.powered() ? looperNext[state === 'off' ? 'empty' : state] : 'Power on first';
    main.disabled = !host.powered();
    q('.lr-state')!.textContent = host.powered() ? looperLabel[state] : 'Standby';
    const sr = srNow;
    q('.lr-time')!.textContent = !s || s.length === 0 ? '0:00'
      : s.state === 'recording' ? time(s.length, sr) : `${time(s.position, sr)} / ${time(s.length, sr)}`;
    const frac = !s || s.length === 0 || s.state === 'recording' ? (s?.state === 'recording' ? 1 : 0) : s.position / s.length;
    const arc = q<SVGCircleElement>('.lr-arc')!;
    arc.style.strokeDasharray = `${(frac * 100).toFixed(2)} 100`;
    arc.style.opacity = frac > 0 ? '1' : '0'; // a zero-length round cap is still a dot
    const undo = q<HTMLButtonElement>('.looper-undo')!;
    undo.textContent = s?.canRedo ? 'Redo' : 'Undo';
    undo.disabled = !s || (!s.canUndo && !s.canRedo);
    q<HTMLButtonElement>('.looper-stop')!.textContent = s?.state === 'stopped' ? 'Start' : 'Stop';
    q<HTMLButtonElement>('.looper-stop')!.disabled = !s || s.state === 'empty';
    q<HTMLButtonElement>('.looper-clear')!.disabled = !s || s.state === 'empty';
  }

  let srNow = 48000;
  render();
  return {
    el,
    render,
    update(s, sampleRate) {
      last = s;
      srNow = sampleRate;
      paint();
    },
  };
}
