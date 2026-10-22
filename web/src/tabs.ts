// Tabs beside the rig: Guitar Pro / MusicXML files the player owns,
// rendered and played by alphaTab (loaded on first open). Files come from
// the dev server's folders (~/Downloads, ~/Music/PhreakGuitar/Tabs), or are
// opened / dropped here and kept in this browser. Ultimate Guitar is only
// ever a link the player opens themselves: no API, and its terms forbid
// automated access.

import type * as AlphaTab from '@coderline/alphatab';
import { track } from './analytics.ts';
import { migrated } from './migrate.ts';

interface TabState {
  file?: { source: 'folder' | 'browser'; folder?: string; name: string };
  track?: number;
  speed: number; // 0.25 .. 1.5
  playMyPart: boolean; // mute the shown track: you play it
  metronome: boolean;
  countIn: boolean;
  volume: number; // backing, 0..1
  open: boolean;
}
const stateKey = 'phreakguitar.tabs.v1';
function loadState(): TabState {
  const d: TabState = { speed: 1, playMyPart: true, metronome: false, countIn: true, volume: 0.6, open: false };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(stateKey) ?? '{}') };
  } catch {
    return d;
  }
}
const state = loadState();
const save = () => { try { localStorage.setItem(stateKey, JSON.stringify(state)); } catch { /* blocked */ } };

// --- files kept in this browser (IndexedDB), like loaded IRs ---------------
const dbName = 'phreakguitar-tabs';
async function db(): Promise<IDBDatabase> {
  await migrated; // an older version's saved tabs are copied in first
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'name' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbRun<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = op(d.transaction('files', mode).objectStore('files'));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    d.close();
  }
}
interface SavedTab { name: string; bytes: ArrayBuffer; added: number }
const savedTabs = async (): Promise<SavedTab[]> => {
  try { return (await dbRun('readonly', (s) => s.getAll() as IDBRequest<SavedTab[]>)).sort((a, b) => b.added - a.added); } catch { return []; }
};
const saveTab = async (name: string, bytes: ArrayBuffer) => {
  try { await dbRun('readwrite', (s) => s.put({ name, bytes, added: Date.now() })); } catch { /* not kept */ }
};
const forgetTab = async (name: string) => { try { await dbRun('readwrite', (s) => s.delete(name)); } catch { /* */ } };

interface FolderTab { folder: string; name: string; modified: number }
async function folderTabs(): Promise<FolderTab[]> {
  try {
    const r = await fetch('/__tabs');
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

const tabExt = /\.(gp|gp3|gp4|gp5|gpx|gp7|musicxml|mxl|xml)$/i;
const songName = (file: string) => file.replace(tabExt, '').replace(/[_]+/g, ' ').replace(/\s*\(\d+\)$/, '').trim();

export interface TabsHost {
  /** The rig's output device (settings), so the backing plays there too. */
  outputDeviceId(): string | undefined;
}

/** The Tabs panel. Hidden until opened (the top bar's Tabs button). */
export function buildTabs(host: TabsHost): { el: HTMLElement; toggle(): boolean; isOpen(): boolean } {
  const el = document.createElement('section');
  el.className = 'card tabs';
  el.setAttribute('aria-label', 'Tabs');
  el.hidden = !state.open;
  el.innerHTML = `
    <div class="tabs-head">
      <h2>Tabs</h2>
      <select class="tabs-file" aria-label="Tab file"><option value="">Pick a tab…</option></select>
      <button class="tabs-open">Open file…</button>
      <input class="tabs-input" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7,.musicxml,.mxl,.xml" hidden>
      <span class="tabs-find">
        <input class="tabs-q" type="search" placeholder="Song or artist" aria-label="Search Ultimate Guitar for">
        <button class="link tabs-ug">Find on Ultimate Guitar</button>
      </span>
      <button class="link tabs-forget" hidden>Remove from this browser</button>
    </div>
    <div class="tabs-transport" hidden>
      <button class="tabs-play" aria-label="Play">▶ Play</button>
      <button class="tabs-stop" aria-label="Stop">■</button>
      <label>Track <select class="tabs-track"></select></label>
      <label class="tabs-speed">Speed <input type="range" min="25" max="150" step="5"> <output></output></label>
      <label class="switch"><input type="checkbox" class="tabs-mypart"> <span>Play my part (mute this track)</span></label>
      <label>Backing <input type="range" class="tabs-vol" min="0" max="100"></label>
      <label class="switch"><input type="checkbox" class="tabs-loop"> <span>Loop</span></label>
      <label class="switch"><input type="checkbox" class="tabs-click"> <span>Metronome</span></label>
      <label class="switch"><input type="checkbox" class="tabs-countin"> <span>Count-in</span></label>
      <span class="tabs-pos hint"></span>
    </div>
    <div class="tabs-view"><div class="tabs-score"></div></div>
    <p class="hint tabs-hint">Guitar Pro (.gp, .gp5, .gpx…) or MusicXML. ${import.meta.env.DEV
      ? 'Files you download land in the list by themselves (from Downloads or ~/Music/PhreakGuitar/Tabs); ones you open here'
      : 'Files you open or drop here'} are kept in this browser.
      Drag across bars to pick a section, then Loop. Space plays and pauses.</p>`;

  const $ = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  const fileSel = $<HTMLSelectElement>('.tabs-file');
  const transport = $<HTMLElement>('.tabs-transport');
  const view = $<HTMLElement>('.tabs-view');
  const scoreEl = $<HTMLElement>('.tabs-score');
  const playBtn = $<HTMLButtonElement>('.tabs-play');
  const trackSel = $<HTMLSelectElement>('.tabs-track');
  const speed = $<HTMLInputElement>('.tabs-speed input');
  const speedOut = $<HTMLOutputElement>('.tabs-speed output');
  const pos = $<HTMLElement>('.tabs-pos');

  let at: typeof AlphaTab | null = null;
  let api: AlphaTab.AlphaTabApi | null = null;
  let score: AlphaTab.model.Score | null = null;

  async function ensureApi(): Promise<AlphaTab.AlphaTabApi> {
    if (api) return api;
    at = await import('@coderline/alphatab');
    api = new at.AlphaTabApi(scoreEl, {
      core: { fontDirectory: '/font/' }, // alphaTab's music font, copied into public/ by its Vite plugin
      // Notation + tab for guitar parts (tab-only fails on parts without a tab staff).
      display: { staveProfile: at.StaveProfile.Default, scale: 0.95 },
      player: {
        playerMode: at.PlayerMode.EnabledSynthesizer,
        soundFont: '/soundfont/sonivox.sf2',
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        enableUserInteraction: true,
        scrollElement: view,
      },
    } as AlphaTab.json.SettingsJson);
    api.scoreLoaded.on((s) => {
      score = s;
      trackSel.replaceChildren(...s.tracks.map((t, i) => new Option(t.name || `Track ${i + 1}`, String(i))));
      // The saved track, else the first guitar-like one.
      const guess = s.tracks.findIndex((t) => /guit|gtr|lead|rhythm/i.test(t.name));
      const ti = state.track !== undefined && state.track < s.tracks.length ? state.track : Math.max(0, guess);
      trackSel.value = String(ti);
      showTrack(ti);
      transport.hidden = false;
      const q = $<HTMLInputElement>('.tabs-q');
      if (!q.value) q.value = [s.title, s.artist].filter(Boolean).join(' ');
    });
    api.playerReady.on(async () => {
      applyMix();
      // Play on the rig's output (the interface), not the system default.
      const want = host.outputDeviceId();
      if (!want) return;
      try {
        const devices = await api!.enumerateOutputDevices();
        const d = devices.find((x) => x.deviceId === want);
        if (d) await api!.setOutputDevice(d);
      } catch { /* default output */ }
    });
    api.playerStateChanged.on((e) => {
      playBtn.textContent = e.state === at!.synth.PlayerState.Playing ? '❚❚ Pause' : '▶ Play';
    });
    api.playerPositionChanged.on((e) => {
      const t = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
      pos.textContent = `${t(e.currentTime)} / ${t(e.endTime)}`;
    });
    return api;
  }

  function showTrack(i: number): void {
    if (!api || !score) return;
    state.track = i;
    save();
    api.renderTracks([score.tracks[i]]);
    applyMix();
  }

  function applyMix(): void {
    if (!api || !score) return;
    api.playbackSpeed = state.speed;
    api.masterVolume = state.volume;
    api.metronomeVolume = state.metronome ? 1 : 0;
    api.countInVolume = state.countIn ? 1 : 0;
    api.changeTrackMute(score.tracks, false);
    const t = score.tracks[state.track ?? 0];
    if (state.playMyPart && t) api.changeTrackMute([t], true);
  }

  async function load(bytes: ArrayBuffer): Promise<void> {
    const a = await ensureApi();
    a.load(new Uint8Array(bytes));
    track('tab_loaded', { format: state.file?.name.split('.').pop()?.toLowerCase() ?? 'unknown' });
  }

  async function refreshList(select?: string): Promise<void> {
    const [folder, mine] = await Promise.all([folderTabs(), savedTabs()]);
    const group = (label: string, opts: HTMLOptionElement[]) => {
      if (!opts.length) return [];
      const g = Object.assign(document.createElement('optgroup'), { label });
      g.append(...opts);
      return [g];
    };
    const opt = (value: string, label: string) => new Option(label, value);
    fileSel.replaceChildren(
      new Option('Pick a tab…', ''),
      ...group('Downloads', folder.filter((f) => f.folder === 'downloads').map((f) => opt(`folder:${f.folder}/${f.name}`, songName(f.name)))),
      ...group('Tabs folder', folder.filter((f) => f.folder === 'tabs').map((f) => opt(`folder:${f.folder}/${f.name}`, songName(f.name)))),
      ...group('In this browser', mine.map((f) => opt(`browser:${f.name}`, songName(f.name)))),
    );
    const cur = select ?? (state.file ? (state.file.source === 'folder' ? `folder:${state.file.folder}/${state.file.name}` : `browser:${state.file.name}`) : '');
    fileSel.value = [...fileSel.options].some((o) => o.value === cur) ? cur : '';
    $<HTMLButtonElement>('.tabs-forget').hidden = !fileSel.value.startsWith('browser:');
  }

  async function openSelected(): Promise<void> {
    const v = fileSel.value;
    $<HTMLButtonElement>('.tabs-forget').hidden = !v.startsWith('browser:');
    if (!v) return;
    try {
      if (v.startsWith('folder:')) {
        const [folder, ...rest] = v.slice(7).split('/');
        const name = rest.join('/');
        const r = await fetch(`/__tabs/${encodeURIComponent(folder)}/${encodeURIComponent(name)}`);
        if (!r.ok) throw new Error('not found');
        state.file = { source: 'folder', folder, name };
        await load(await r.arrayBuffer());
      } else {
        const name = v.slice(8);
        const f = (await savedTabs()).find((x) => x.name === name);
        if (!f) throw new Error('not found');
        state.file = { source: 'browser', name };
        await load(f.bytes);
      }
      state.track = undefined; // a new song: guess its guitar track
      save();
    } catch {
      pos.textContent = "Couldn't open that file.";
    }
  }

  async function openFile(f: File): Promise<void> {
    if (!tabExt.test(f.name)) return;
    const bytes = await f.arrayBuffer();
    await saveTab(f.name, bytes.slice(0));
    state.file = { source: 'browser', name: f.name };
    state.track = undefined;
    save();
    await refreshList(`browser:${f.name}`);
    await load(bytes);
  }

  fileSel.addEventListener('change', () => void openSelected());
  $('.tabs-open').addEventListener('click', () => $<HTMLInputElement>('.tabs-input').click());
  $<HTMLInputElement>('.tabs-input').addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) void openFile(f);
  });
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); });
  el.addEventListener('dragleave', () => el.classList.remove('drop'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop');
    const f = e.dataTransfer?.files[0];
    if (f) void openFile(f);
  });
  $('.tabs-forget').addEventListener('click', async () => {
    const v = fileSel.value;
    if (!v.startsWith('browser:')) return;
    await forgetTab(v.slice(8));
    state.file = undefined;
    save();
    await refreshList('');
  });
  // Ultimate Guitar: a search the player opens and reads themselves.
  $('.tabs-ug').addEventListener('click', () => {
    const q = $<HTMLInputElement>('.tabs-q').value.trim();
    const url = q ? `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`
                  : 'https://www.ultimate-guitar.com/';
    window.open(url, '_blank', 'noopener');
  });

  playBtn.addEventListener('click', () => api?.playPause());
  $('.tabs-stop').addEventListener('click', () => api?.stop());
  trackSel.addEventListener('change', () => showTrack(Number(trackSel.value)));
  speed.value = String(Math.round(state.speed * 100));
  speedOut.textContent = `${speed.value}%`;
  speed.addEventListener('input', () => {
    state.speed = Number(speed.value) / 100;
    speedOut.textContent = `${speed.value}%`;
    save();
    if (api) api.playbackSpeed = state.speed;
  });
  const vol = $<HTMLInputElement>('.tabs-vol');
  vol.value = String(Math.round(state.volume * 100));
  vol.addEventListener('input', () => { state.volume = Number(vol.value) / 100; save(); if (api) api.masterVolume = state.volume; });
  const check = (sel: string, get: () => boolean, set: (v: boolean) => void) => {
    const c = $<HTMLInputElement>(sel);
    c.checked = get();
    c.addEventListener('change', () => { set(c.checked); save(); applyMix(); });
  };
  check('.tabs-mypart', () => state.playMyPart, (v) => { state.playMyPart = v; });
  check('.tabs-click', () => state.metronome, (v) => { state.metronome = v; });
  check('.tabs-countin', () => state.countIn, (v) => { state.countIn = v; });
  const loop = $<HTMLInputElement>('.tabs-loop');
  loop.addEventListener('change', () => { if (api) api.isLooping = loop.checked; });

  // Space: play / pause while the panel is open (not while typing).
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || el.hidden || !api) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea, button')) return;
    e.preventDefault();
    api.playPause();
  });

  let listed = false;
  async function opened(): Promise<void> {
    if (!listed) {
      listed = true;
      await refreshList();
      if (fileSel.value) await openSelected();
    } else await refreshList(fileSel.value); // new downloads since
  }
  if (state.open) void opened();

  return {
    el,
    isOpen: () => !el.hidden,
    toggle() {
      el.hidden = !el.hidden;
      state.open = !el.hidden;
      save();
      if (!el.hidden) void opened();
      else api?.pause();
      return !el.hidden;
    },
  };
}
