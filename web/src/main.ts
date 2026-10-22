import './style.css';
import './migrate.ts'; // first: moves data saved by earlier versions
import { kindOf, track } from './analytics.ts';
import { Param, numPedalSlots } from './engine.ts';
import { Rig, type Meters } from './rig.ts';
import { Knob, type KnobSpec } from './ui/knob.ts';
import { factoryPedals, loadUserPedals, lookOf, saveUserPedals, userPedalInfo, type PedalControl, type PedalInfo } from './pedals.ts';
import { buildDesigner, forkNetlist, parseParts } from './designer.ts';
import { buildTabs } from './tabs.ts';
import { buildStage, type StageItem } from './stage.ts';
import { buildLooper, looperLabel } from './looperui.ts';
import type { LooperStatus } from './engine.ts';
import { amps, type AmpInfo } from './amps.ts';
import { buildFace } from './faces.ts';
import { buildTubes, type TubeView } from './tubes.ts';
import { Tuner } from './tuner.ts';
import { forgetIR, loadSavedIR, saveIR, savedIRNames } from './irstore.ts';
import { allEffects, compressor, postEffects, type PostFxInfo } from './postfx.ts';
import { factoryPresets, isPreset, loadUserPresets, saveUserPresets, type Preset } from './presets.ts';
import { glowFor, glowParts, hasSchematic, markNode, renderSchematic, setGlow } from './schematic.ts';
import type { PedalActivity } from './rig.ts';
import tweed410 from '../../resources/irs/ir_tweed410.wav?url';
import brit412 from '../../resources/irs/ir_brit412.wav?url';
import black112 from '../../resources/irs/ir_black112.wav?url';

// --- settings (per-browser convenience; everything still works without) ----

interface Settings {
  knobs: Record<string, number>;
  gateOn: boolean;
  cab: string; // 'builtin:<i>' | 'user:<file>' (dev server folder) | 'saved:<file>' (IndexedDB) | 'off'
  inputDeviceId?: string;
  inputChannel: number;
  outputDeviceId?: string;
  buffer: 'standard' | 'low';
  /** Pedal slots in signal order (null: empty). */
  board?: (BoardSlot | null)[];
  circuitSlot?: number | null; // whose circuit is shown
  /** Last knob positions per pedal type: a pedal put in a slot starts there. */
  pedalKnobs?: Record<string, Record<string, number>>;
  preset?: string; // 'factory:<i>' | 'user:<id>': the last one picked
  powered?: boolean; // the rig was on when the page was last used: power up on load
  presetLevel?: number; // dB on top of Master (the preset's volume)
  welcomed?: boolean; // the first-visit card was seen
  tubesOpen?: boolean; // the amp's tube chassis drawn full size (else a strip)
  looperOn?: boolean; // the looper is switched on (its memory reserved)
  looperDb?: number; // the loop's playback level
  /** Before the board (one pedal, knobs per pedal type): migrated on load. */
  pedal?: { id: string; on: boolean; knobs: Record<string, Record<string, number>> };
  amp?: string;
  ampKnobs?: Record<string, Record<string, number>>;
  fx?: Record<string, { on: boolean; values: Record<string, number> }>;
}

interface BoardSlot {
  id: string;
  on: boolean;
  knobs: Record<string, number>;
}

const settingsKey = 'phreakguitar.settings.v1';
const defaults: Settings = { knobs: {}, gateOn: false, cab: 'builtin:0', inputChannel: 0, buffer: 'standard' };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(settingsKey);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

const firstVisit = (() => {
  try { return localStorage.getItem(settingsKey) === null; } catch { return false; }
})();
const settings = loadSettings();
// A first visit starts quiet: Master at -12 dB until you turn it up.
if (firstVisit) settings.knobs.master = -12;
if (!settings.board) {
  // From the single pedal slot: that pedal (and its knobs) goes first.
  const old = settings.pedal;
  settings.board = Array(numPedalSlots).fill(null);
  if (old && old.id !== 'none') settings.board[0] = { id: old.id, on: old.on, knobs: { ...old.knobs[old.id] } };
  settings.pedalKnobs = { ...old?.knobs };
  delete settings.pedal;
  delete (settings as { showCircuit?: boolean }).showCircuit;
}
while (settings.board.length < numPedalSlots) settings.board.push(null);
function saveSettings(): void {
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  } catch {
    /* private mode etc.: settings just don't persist */
  }
  afterSave();
}
let afterSave = () => {}; // the presets section hooks in (the "edited" mark)

// --- controls ---------------------------------------------------------------

const db = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
const panel = (v: number) => v.toFixed(1);

// Same ranges and defaults as the plugin (src/plugin/PluginProcessor.cpp).
const knobSpecs: Record<string, KnobSpec> = {
  input: { label: 'Input', min: -24, max: 24, value: 0, defaultValue: 0, step: 0.1, format: db },
  drive: { label: 'Drive', min: 0, max: 10, value: 4, defaultValue: 4, step: 0.01, format: panel },
  bass: { label: 'Bass', min: 0, max: 10, value: 5, defaultValue: 5, step: 0.01, format: panel },
  mid: { label: 'Middle', min: 0, max: 10, value: 5, defaultValue: 5, step: 0.01, format: panel },
  treble: { label: 'Treble', min: 0, max: 10, value: 6, defaultValue: 6, step: 0.01, format: panel },
  master: { label: 'Master', min: -24, max: 24, value: 0, defaultValue: 0, step: 0.1, format: db },
  gateDb: { label: 'Threshold', min: -90, max: -30, value: -65, defaultValue: -65, step: 0.5, format: (v) => `${v.toFixed(1)} dB` },
  presetLevel: { label: 'Level', min: -30, max: 30, value: 0, defaultValue: 0, step: 0.5, format: db },
};

const knobs: Record<string, Knob> = {};
for (const [id, spec] of Object.entries(knobSpecs)) {
  const saved = id === 'presetLevel' ? settings.presetLevel : settings.knobs[id];
  const k = new Knob({ ...spec, value: saved ?? spec.value });
  k.onChange = () => {
    if (id === 'presetLevel') settings.presetLevel = k.value;
    else settings.knobs[id] = k.value;
    saveSettings();
    applyKnob(id);
    logEvent(`amp.${id}`, k.value);
  };
  knobs[id] = k;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

/** A switch control: one button per position; value 0 = first .. 1 = last. */
function buildSwitch(label: string, positions: string[], get: () => number, set: (v: number) => void): HTMLElement {
  const sw = document.createElement('div');
  sw.className = 'fx-switch';
  sw.setAttribute('role', 'radiogroup');
  sw.setAttribute('aria-label', label);
  const n = positions.length;
  const mark = () => sw.querySelectorAll('button').forEach((b, q) =>
    b.setAttribute('aria-checked', String(q === Math.round(get() * (n - 1)))));
  positions.forEach((name, q) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => { set(q / (n - 1)); mark(); });
    sw.append(b);
  });
  mark();
  return sw;
}

// The rig's own levels live with the meters; amp faces show amp controls.
$('#level-knobs').append(knobs.input.el);
$('#master-slot').append(knobs.master.el);
$('#preset-level').append(knobs.presetLevel.el);

const powerBtn = $<HTMLButtonElement>('#power');
const statusEl = $('#status');
const inputSel = $<HTMLSelectElement>('#input-device');
const channelSel = $<HTMLSelectElement>('#input-channel');
const outputSel = $<HTMLSelectElement>('#output-device');
// The cab: a tile after the amp, first in that row (placed by renderPostFx).
const cabTile = document.createElement('div');
cabTile.className = 'fxbox cab-tile';
cabTile.innerHTML = `<div class="fx-brand"><b>Cab</b><small>Speaker · IR</small></div>
  <div class="cab-grille" aria-hidden="true"><span></span></div>
  <select id="cab" aria-label="Cabinet impulse response"></select>
  <input id="ir-file" type="file" accept=".wav,audio/wav,audio/*" hidden />
  <button id="ir-forget" class="link" hidden>Remove this IR from the browser</button>`;
const cabSel = cabTile.querySelector<HTMLSelectElement>('#cab')!;
const irFile = cabTile.querySelector<HTMLInputElement>('#ir-file')!;
const irForget = cabTile.querySelector<HTMLButtonElement>('#ir-forget')!;
const measureBtn = $<HTMLButtonElement>('#measure');
const bufferSel = $<HTMLSelectElement>('#buffer');

channelSel.value = String(settings.inputChannel);
bufferSel.value = settings.buffer;

const builtInIRs = [
  { name: 'Tweed 4x10', url: tweed410 },
  { name: 'Brit 4x12', url: brit412 },
  { name: 'Black 1x12', url: black112 },
];
const builtinGroup = document.createElement('optgroup');
builtinGroup.label = 'Built-in';
builtInIRs.forEach((ir, i) => builtinGroup.append(new Option(ir.name, `builtin:${i}`)));
const userGroup = document.createElement('optgroup');
userGroup.label = 'Your IRs (~/Music/PhreakGuitar/IRs)';
const savedGroup = document.createElement('optgroup');
savedGroup.label = 'Saved in this browser';
savedGroup.hidden = true;
cabSel.append(builtinGroup, userGroup, savedGroup);
cabSel.add(new Option('Load IR file…', 'file'));
cabSel.add(new Option('Off (no cab)', 'off'));
if (settings.cab === 'file') settings.cab = 'builtin:0'; // the old, unsaved single file
cabSel.value = settings.cab;

// IRs loaded from files, kept in IndexedDB.
let savedIRs: string[] = [];
async function listSavedIRs(): Promise<void> {
  savedIRs = await savedIRNames();
  savedGroup.replaceChildren(...savedIRs.map((n) => new Option(n.replace(/\.wav$/i, ''), `saved:${n}`)));
  savedGroup.hidden = savedIRs.length === 0;
  if (settings.cab.startsWith('saved:')) cabSel.value = settings.cab;
  showForget();
}
function showForget(): void {
  irForget.hidden = !cabSel.value.startsWith('saved:');
}
void listSavedIRs();

// Dev server only: the IR folder the native plugin uses, listed live.
let userIRNames: string[] = [];
async function listUserIRs(): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    userIRNames = await fetch('/__irs').then((r) => r.json());
  } catch {
    userIRNames = [];
  }
  userGroup.replaceChildren(...userIRNames.map((n) => new Option(n.replace(/\.wav$/i, ''), `user:${n}`)));
  userGroup.hidden = userIRNames.length === 0;
  if (settings.cab.startsWith('user:')) cabSel.value = settings.cab;
}

// --- event log (for captures) ------------------------------------------------

// Every control change with the audio clock's time, so a capture can be
// lined up with what was turned when.
const events: { t: number; what: string; value: string | number | boolean }[] = [];
function logEvent(what: string, value: string | number | boolean): void {
  // Touching anything while comparing A / B makes that the edit now.
  if (what !== 'preset' && !abApplying && ab) { ab = null; showAb(); }
  events.push({ t: rig?.ctx.currentTime ?? -1, what, value });
  if (events.length > 2000) events.splice(0, 1000);
}

// --- rig --------------------------------------------------------------------

let rig: Rig | null = null;

function applyKnob(id: string): void {
  if (!rig) return;
  const v = knobs[id].value;
  switch (id) {
    case 'input': rig.setParam(Param.inputDb, v); break;
    case 'drive': rig.setParam(Param.drive, v / 10); break;
    case 'master': case 'presetLevel':
      rig.setParam(Param.outputDb, tunerMuted ? -120 : knobs.master.value + knobs.presetLevel.value);
      sendLooperGain();
      break;
    case 'gateDb': rig.setParam(Param.gateDb, v); break;
    case 'bass': case 'mid': case 'treble':
      rig.setTone(knobs.treble.value / 10, knobs.mid.value / 10, knobs.bass.value / 10);
      break;
  }
}

function applyAll(): void {
  for (const id of Object.keys(knobs)) applyKnob(id);
  rig?.setParam(Param.gateOn, settings.gateOn ? 1 : 0);
}

const irCache = new Map<string, AudioBuffer>();
async function applyCab(): Promise<void> {
  if (!rig) return;
  const choice = cabSel.value;
  if (choice === 'off') return rig.setCab(null);
  if (choice === 'file') return;
  if (choice.startsWith('saved:')) {
    let buffer = irCache.get(choice);
    if (!buffer) {
      const bytes = await loadSavedIR(choice.slice(6));
      if (!bytes) return rig.setCab(null);
      buffer = await rig.ctx.decodeAudioData(bytes);
      irCache.set(choice, buffer);
    }
    return rig.setCab(buffer);
  }

  const url = choice.startsWith('user:')
    ? `/__irs/${encodeURIComponent(choice.slice(5))}`
    : (builtInIRs[Number(choice.split(':')[1])] ?? builtInIRs[0]).url;
  let buffer = irCache.get(url);
  if (!buffer) {
    const bytes = await fetch(url).then((r) => r.arrayBuffer());
    buffer = await rig.ctx.decodeAudioData(bytes);
    irCache.set(url, buffer);
  }
  rig.setCab(buffer);
}

async function listDevices(): Promise<void> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const fill = (sel: HTMLSelectElement, kind: MediaDeviceKind, selected?: string) => {
    sel.replaceChildren(new Option('System default', ''));
    for (const d of devices.filter((d) => d.kind === kind && d.deviceId !== 'default'))
      sel.add(new Option(d.label || `${kind} ${sel.options.length}`, d.deviceId));
    sel.value = selected && [...sel.options].some((o) => o.value === selected) ? selected : '';
  };
  fill(inputSel, 'audioinput', settings.inputDeviceId);
  fill(outputSel, 'audiooutput', settings.outputDeviceId);
  outputSel.disabled = !('setSinkId' in AudioContext.prototype);
  deviceAccess.hidden = devicesListed(devices);
}

// Until the microphone is allowed, browsers hide which devices there are
// (no names, often just one stand-in), so picking an interface comes after
// allowing it: ask for it briefly, then list them.
const deviceAccess = $('#device-access');
const devicesListed = (devices: MediaDeviceInfo[]) => devices.some((d) => d.kind === 'audioinput' && d.label);
async function showDevices(): Promise<void> {
  if (!(await micGranted())) {
    const go = await micDialog('ask');
    track('mic_explained', { choice: go ? 'continue' : 'not now', from: 'devices' });
    if (!go) return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch (err) {
    track('devices_blocked', { error: err instanceof Error ? err.name : 'unknown' });
    if (err instanceof DOMException && err.name === 'NotAllowedError') void micDialog('blocked');
    return;
  }
  await listDevices();
  track('devices_shown');
}
$('#device-allow').addEventListener('click', () => void showDevices());

function refreshChannelOptions(): void {
  const count = rig?.inputChannelCount() ?? 2;
  [...channelSel.options].forEach((o) => (o.disabled = Number(o.value) >= count));
  if (Number(channelSel.value) >= count) channelSel.value = '0';
}

function setStatus(text: string, kind: 'idle' | 'on' | 'error' = 'idle'): void {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

// The power switch shows its state by lever, lamp and legend (CSS, from
// body.powered); this keeps what it says to screen readers in step.
function showPower(on: boolean): void {
  powerBtn.setAttribute('aria-pressed', String(on));
  powerBtn.setAttribute('aria-label', on ? 'Power: on' : 'Power: off');
  powerBtn.title = on ? 'Power: on (click to switch off)' : 'Power: off (click to switch on)';
}

// Phones and tablets: the rig works there with an interface (and
// headphones), but most visitors on one are only looking around.
const onPhone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;

// Before the browser's own microphone prompt, say why it's coming: half of
// first power-ups used to stop at that prompt. Skipped once it's allowed.
async function micGranted(): Promise<boolean> {
  try {
    return (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state === 'granted';
  } catch {
    return false; // browsers that can't say: explain anyway
  }
}
function micDialog(kind: 'ask' | 'blocked'): Promise<boolean> {
  const d = document.createElement('dialog');
  d.className = 'mic-dialog';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const howToAllow = ios
    ? 'tap <b>aA</b> in the address bar → <b>Website Settings</b> → <b>Microphone</b> → <b>Allow</b>, then reload'
    : onPhone
      ? 'tap the icon at the left of the address bar → <b>Permissions</b> → <b>Microphone</b> → <b>Allow</b>'
      : 'click the icon at the left of the address bar and allow the <b>Microphone</b>';
  d.innerHTML = kind === 'ask'
    ? `<h2>Plug in, then allow the microphone</h2>
       <p>Your browser will now ask to use the <b>microphone</b>. Choose <b>Allow</b>: that's how your guitar
         gets in, through your audio interface's input.</p>
       <p class="mic-small">Everything is processed right here in this tab. Nothing is recorded, uploaded or sent anywhere.</p>
       <div class="welcome-actions"><button class="go">Continue</button><button class="link no">Not now</button></div>`
    : `<h2>The microphone is blocked</h2>
       <p>The rig can't hear your guitar without it. To allow it, ${howToAllow}, and try again.</p>
       <div class="welcome-actions"><button class="go">OK</button></div>`;
  document.body.append(d);
  return new Promise((resolve) => {
    const done = (ok: boolean) => { d.close(); d.remove(); resolve(ok); };
    d.querySelector('.go')!.addEventListener('click', () => done(true));
    d.querySelector('.no')?.addEventListener('click', () => done(false));
    d.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
    d.showModal();
  });
}

let stillPlaying = 0;
async function powerOn(): Promise<void> {
  if (!(await micGranted())) {
    const go = await micDialog('ask');
    track('mic_explained', { choice: go ? 'continue' : 'not now' });
    if (!go) { settings.powered = false; saveSettings(); return; }
  }
  powerBtn.disabled = true;
  powerBtn.classList.add('starting');
  setStatus('Starting…');
  try {
    rig = await Rig.start({
      inputDeviceId: settings.inputDeviceId || undefined,
      inputChannel: settings.inputChannel,
      outputDeviceId: settings.outputDeviceId || undefined,
      buffer: settings.buffer,
      onContext: (ctx) => {
        // Without a click since the page loaded (powering up after a
        // reload), the browser holds audio back: the first click or key
        // anywhere starts it.
        if (ctx.state === 'running') return;
        setStatus('Click anywhere to start the sound (the browser needs one click after a reload)');
        const kick = () => {
          void ctx.resume();
          removeEventListener('pointerdown', kick, true);
          removeEventListener('keydown', kick, true);
        };
        addEventListener('pointerdown', kick, true);
        addEventListener('keydown', kick, true);
      },
    });
    if (import.meta.env.DEV) (window as unknown as { phreakguitar: Rig }).phreakguitar = rig; // console/diagnostics
    rig.onMeters = showMeters;
    rig.onPedalActivity = showPedalActivity;
    rig.onProbe = showProbe;
    rig.onProbeSet = (slot, node, ok) => {
      if (!ok && probe?.slot === slot && probe.node === node && probeReadout)
        probeReadout.textContent = `${node}: waiting for the circuit (not in it, or not loaded yet)`;
    };
    if (probe) rig.setProbe(probe.slot, probe.node);
    rig.onAmpActivity = (a) => tubeView?.update(a);
    rig.onLooper = showLooper;
    if (settings.looperOn) rig.looperEnable(true);
    applyAll();
    await applyAmp();
    await applyCab();
    await applyBoard();
    applyPostFx();
    await listDevices(); // labels only appear after mic permission
    refreshChannelOptions();
    document.body.classList.add('powered');
    showPower(true);
    measureBtn.disabled = false;
    tunerBtn.disabled = false;
    tunerBtn.title = 'Tuner';
    $<HTMLButtonElement>('#send-capture').disabled = !import.meta.env.DEV;
    setStatus(`Playing · ${rig.inputLabel() || 'default input'} · ${rig.ctx.sampleRate / 1000} kHz`, 'on');
    poweredAt = performance.now();
    // Most people close the tab rather than switch off: a ping now and
    // then (and one as the tab closes) says how long they played.
    clearInterval(stillPlaying);
    stillPlaying = window.setInterval(() => track('still_playing', { minutes_on: minutesOn() }), 5 * 60_000);
    track('power_on', {
      sample_rate: rig.ctx.sampleRate,
      latency_ms: Math.round((rig.ctx.baseLatency + (rig.ctx.outputLatency || 0)) * 1000),
      buffer: settings.buffer, amp: settings.amp, preset: settings.preset ?? null,
    });
  } catch (err) {
    await rig?.stop();
    rig = null;
    setStatus(describeError(err), 'error');
    track('power_on_failed', { error: err instanceof DOMException || err instanceof Error ? err.name : 'unknown' });
    settings.powered = false;
    saveSettings();
    // The status line is hidden on phones: say this one out loud.
    if (err instanceof DOMException && err.name === 'NotAllowedError') void micDialog('blocked');
  } finally {
    powerBtn.disabled = false;
    powerBtn.classList.remove('starting');
  }
}

let poweredAt = 0;
const minutesOn = () => Math.round((performance.now() - poweredAt) / 6000) / 10;
addEventListener('pagehide', () => { if (rig) track('power_off', { minutes_on: minutesOn(), how: 'closed' }, true); });
async function powerOff(): Promise<void> {
  if (rig) track('power_off', { minutes_on: minutesOn(), how: 'switch' });
  clearInterval(stillPlaying);
  tuner.close();
  tunerBtn.disabled = true;
  tunerBtn.title = 'Tuner (power on first)';
  await rig?.stop();
  rig = null;
  document.body.classList.remove('powered');
  showPower(false);
  measureBtn.disabled = true;
  $<HTMLButtonElement>('#send-capture').disabled = true;
  for (const k of Object.keys(held)) delete held[k];
  if (circuitSvg) for (const name of circuitGlow.keys()) setGlow(circuitSvg, name, 0);
  circuitGlow.clear();
  tubeView?.reset();
  looperStatus = null;
  looperView.update(null, 48000);
  showMeters({ inputPeak: 0, outputPeak: 0, limiterGain: 1, pedalFaults: 0, pedalNewtonFailures: 0 });
  setStatus('Standby');
}

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'NotAllowedError')
    return 'Microphone blocked: allow it in the address bar, then switch on again.';
  if (err instanceof DOMException && err.name === 'OverconstrainedError')
    return 'That input device is unavailable. Pick another one.';
  return err instanceof Error ? err.message : String(err);
}

// Power remembers what you chose, so a reload comes back the same way.
powerBtn.addEventListener('click', () => {
  settings.powered = !rig;
  saveSettings();
  return rig ? powerOff() : powerOn();
});

inputSel.addEventListener('change', async () => {
  settings.inputDeviceId = inputSel.value || undefined;
  saveSettings();
  if (rig) {
    try {
      await rig.setInput(settings.inputDeviceId, settings.inputChannel);
      refreshChannelOptions();
      setStatus(`Playing · ${rig.inputLabel()}`, 'on');
    } catch (err) {
      setStatus(describeError(err), 'error');
    }
  }
});

channelSel.addEventListener('change', async () => {
  settings.inputChannel = Number(channelSel.value);
  saveSettings();
  if (rig) await rig.setInput(settings.inputDeviceId, settings.inputChannel);
});

outputSel.addEventListener('change', async () => {
  settings.outputDeviceId = outputSel.value || undefined;
  saveSettings();
  if (rig) {
    try {
      await rig.setOutputDevice(outputSel.value);
    } catch (err) {
      setStatus(describeError(err), 'error');
    }
  }
});

cabSel.addEventListener('change', async () => {
  if (cabSel.value === 'file') {
    irFile.click();
    return;
  }
  showForget();
  settings.cab = cabSel.value;
  saveSettings();
  logEvent('cab', cabSel.value);
  track('cab_changed', { cab: cabSel.value.startsWith('builtin:') ? cabSel.value : kindOf(cabSel.value) });
  await applyCab();
});

irFile.addEventListener('change', async () => {
  const file = irFile.files?.[0];
  irFile.value = '';
  if (!file) {
    cabSel.value = settings.cab;
    return;
  }
  try {
    const bytes = await file.arrayBuffer();
    // Decode once now: a file that isn't audio is refused before it's kept.
    const ctx = rig?.ctx ?? new OfflineAudioContext(1, 1, 48000);
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    const key = `saved:${file.name}`;
    irCache.set(key, buffer);
    if (!(await saveIR(file.name, bytes))) setStatus(`${file.name} is loaded but this browser won't keep it after a reload.`, 'error');
    await listSavedIRs();
    if (![...cabSel.options].some((o) => o.value === key)) savedGroup.append(new Option(file.name.replace(/\.wav$/i, ''), key));
    savedGroup.hidden = false;
    cabSel.value = key;
    settings.cab = key;
    saveSettings();
    showForget();
    logEvent('cab', key);
    await applyCab();
  } catch {
    setStatus(`Couldn't read ${file.name} as audio.`, 'error');
    cabSel.value = settings.cab;
  }
});

irForget.addEventListener('click', async () => {
  const key = cabSel.value;
  if (!key.startsWith('saved:')) return;
  await forgetIR(key.slice(6));
  irCache.delete(key);
  settings.cab = ampCab(currentAmp());
  saveSettings();
  await listSavedIRs();
  cabSel.value = settings.cab;
  showForget();
  await applyCab();
});

// --- amp ---------------------------------------------------------------------

const ampSel = $<HTMLSelectElement>('#amp-type');
const ampStatus = $('#amp-status');
// Experimental amps (too heavy on the CPU for now) only with ?experimental.
const experimental = new URLSearchParams(location.search).has('experimental');
const ampListed = (a: AmpInfo) => experimental || !a.experimental || a.id === settings.amp;
for (const a of amps) if (ampListed(a)) ampSel.add(new Option(a.name, a.id));
ampSel.value = amps.some((a) => a.id === settings.amp) ? settings.amp! : amps[0].id;
const currentAmp = (): AmpInfo => amps.find((a) => a.id === ampSel.value) ?? amps[0];
const ampKnobValue = (a: AmpInfo, i: number) =>
  settings.ampKnobs?.[a.id]?.[a.controls[i].name] ?? a.controls[i].defaultValue;

function renderAmp(): void {
  const a = currentAmp();
  let faceKnobs: HTMLElement[];
  if (!a.netlist) {
    // The built-in tweed stages (no circuit file): their knobs.
    faceKnobs = ['drive', 'bass', 'mid', 'treble'].map((id) => knobs[id].el);
  } else {
    const cap = a.face === 'plexi' || a.face === 'brit800' || a.face === 'britclean' ? 'goldcap'
      : a.face === 'classa' ? 'chicken' : a.face === 'blackpanel' || a.face === 'boutique' ? 'skirted' : 'disc';
    responseKnob = undefined;
    faceKnobs = a.controls.flatMap((c, i) => {
      const set = (v: number) => {
        ((settings.ampKnobs ??= {})[a.id] ??= {})[c.name] = v;
        saveSettings();
        rig?.setAmpControl(i, v);
        logEvent(`amp.${c.name}`, v);
      };
      if (c.positions) {
        // A switch on the faceplate (Clean / Overdrive, the F.A.C.), labelled.
        const wrap = document.createElement('div');
        wrap.className = 'amp-switch';
        wrap.append(buildSwitch(c.label, c.positions, () => ampKnobValue(a, i), set));
        wrap.insertAdjacentHTML('beforeend', `<div class="knob-label">${c.label}</div>`);
        return [wrap];
      }
      const k = new Knob({ label: c.label, min: 0, max: 10, value: ampKnobValue(a, i) * 10,
                           defaultValue: c.defaultValue * 10, step: 0.01, format: panel, cap });
      k.onChange = () => set(k.value / 10);
      // Response isn't on a real amp's face: it lives with the power supply
      // on the chassis.
      if (c.name === 'response') {
        k.el.title = 'How the power supply responds: left stiffer and faster, right spongier, centre as the amp was built';
        responseKnob = k.el;
        return [];
      }
      return [k.el];
    });
  }
  tubeView = buildTubes(a, responseKnob);
  if (tubeView) {
    // A slim strip by default; full size on request (remembered).
    const t = tubeView.el;
    t.classList.toggle('compact', !settings.tubesOpen);
    const b = document.createElement('button');
    b.className = 'link tubes-toggle';
    const label = () => (b.textContent = settings.tubesOpen ? 'Smaller' : 'Bigger');
    b.addEventListener('click', () => {
      settings.tubesOpen = !settings.tubesOpen;
      saveSettings();
      t.classList.toggle('compact', !settings.tubesOpen);
      label();
    });
    label();
    t.append(b);
  }
  $('#amp-face').replaceChildren(buildFace(a, faceKnobs), ...(tubeView ? [tubeView.el] : []));
}
let tubeView: TubeView | null = null;
let responseKnob: HTMLElement | undefined;

async function applyAmp(): Promise<void> {
  if (!rig) return;
  const a = currentAmp();
  if (!a.netlist) {
    rig.unloadAmp();
    ampStatus.textContent = '';
    return;
  }
  ampStatus.textContent = 'Warming up the tubes…';
  const error = await rig.loadAmp(a.netlist, a.controls.map((_, i) => ampKnobValue(a, i)));
  ampStatus.textContent = error ? `Couldn't load: ${error}` : '';
}

ampSel.addEventListener('change', async () => {
  settings.amp = ampSel.value;
  // Switch to the amp's own cab: your IR if you have it.
  settings.cab = ampCab(currentAmp());
  cabSel.value = settings.cab;
  saveSettings();
  logEvent('amp', ampSel.value);
  track('amp_changed', { amp: ampSel.value });
  renderAmp();
  await applyAmp();
  await applyCab();
});

/** The amp's own cab: your IR of it if you have that file, else built-in. */
function ampCab(a: AmpInfo): string {
  const mine = a.cab.userIR && userIRNames.find((n) => a.cab.userIR!.test(n));
  return mine ? `user:${mine}` : `builtin:${a.cab.builtin}`;
}

renderAmp();
void listUserIRs();

// --- after the amp: delay and reverb ----------------------------------------------

const fxState = (fx: PostFxInfo) => ((settings.fx ??= {})[fx.id] ??= { on: false, values: {} });
const fxValue = (fx: PostFxInfo, i: number) => fxState(fx).values[fx.controls[i].name] ?? fx.controls[i].defaultValue;

function renderPostFx(): void {
  $('#fx-boards').replaceChildren(cabTile, ...postEffects.map(fxBox), looperView.el);
}

// --- the looper (last, after the effects) -------------------------------------

// The loop is recorded after the output level, so it keeps the level it was
// played at when presets change; Master still moves it (relative to where
// Master was when it was recorded), and the tuner's mute silences it.
let looperStatus: LooperStatus | null = null;
let masterAtRecord = 0;
function looperGain(): number {
  if (tunerMuted) return 0;
  return 10 ** (((settings.looperDb ?? 0) + knobs.master.value - masterAtRecord) / 20);
}
function sendLooperGain(): void {
  rig?.looperGain(looperGain());
}
function looperCommand(cmd: number): void {
  if (!rig || !settings.looperOn) return;
  if (cmd === 0 && (!looperStatus || looperStatus.state === 'empty')) {
    masterAtRecord = knobs.master.value;
    sendLooperGain();
  }
  rig.looperCommand(cmd);
  logEvent('looper', ['press', 'stop', 'undo', 'clear'][cmd]);
  if (cmd === 0 && (!looperStatus || looperStatus.state === 'empty')) track('looper_recorded');
}
const looperView = buildLooper({
  enabled: () => !!settings.looperOn,
  setEnabled: (on) => {
    settings.looperOn = on;
    saveSettings();
    rig?.looperEnable(on);
    if (on) sendLooperGain();
    looperStatus = null;
    refreshStages();
  },
  powered: () => !!rig,
  command: looperCommand,
  level: { get: () => settings.looperDb ?? 0, set: (db) => { settings.looperDb = db; saveSettings(); sendLooperGain(); } },
});
function showLooper(s: LooperStatus): void {
  const changed = s.state !== looperStatus?.state;
  looperStatus = s;
  looperView.update(s, rig?.ctx.sampleRate ?? 48000);
  if (changed) refreshStages();
}

/** One effect's box: brand, controls (knobs, switches or EQ sliders) and
    its footswitch. */
function fxBox(fx: PostFxInfo): HTMLElement {
  {
    const box = document.createElement('div');
    box.className = `fxbox fx-${fx.id}`;
    box.innerHTML = `<div class="fx-brand"><b>${fx.name}</b><small>${fx.maker}</small></div>
      <div class="fx-controls"></div>
      <button class="footswitch" aria-pressed="false"><span class="led" aria-hidden="true"></span><span class="fs-label"></span></button>`;
    const controls = box.querySelector('.fx-controls')!;
    fx.controls.forEach((c, i) => {
      const set = (v: number) => {
        fxState(fx).values[c.name] = v;
        saveSettings();
        rig?.setFxControl(fx.index, i, v, fx.stage);
        logEvent(`fx.${fx.id}.${c.name}`, v);
      };
      if (c.slider) {
        // A graphic-EQ slider: up boosts, centre is flat, -15..+15 dB.
        const wrap = document.createElement('label');
        wrap.className = 'eq-band';
        const dbText = (v: number) => { const d = (v - 0.5) * 30; return `${d > 0 ? '+' : ''}${d.toFixed(Math.abs(d) < 10 ? 1 : 0)}`; };
        wrap.innerHTML = `<span class="eq-db"></span><input type="range" min="0" max="1" step="0.005" aria-label="${c.label} Hz" /><span class="eq-label">${c.label}</span>`;
        const input = wrap.querySelector('input')!;
        const db = wrap.querySelector('.eq-db')!;
        input.value = String(fxValue(fx, i));
        db.textContent = dbText(fxValue(fx, i));
        input.addEventListener('input', () => { set(Number(input.value)); db.textContent = dbText(Number(input.value)); });
        input.addEventListener('dblclick', () => { input.value = '0.5'; set(0.5); db.textContent = dbText(0.5); });
        controls.append(wrap);
      } else if (c.positions) {
        // A switch: one button per position.
        const sw = document.createElement('div');
        sw.className = 'fx-switch';
        sw.setAttribute('role', 'radiogroup');
        sw.setAttribute('aria-label', c.label);
        const n = c.positions.length;
        c.positions.forEach((label, p) => {
          const b = document.createElement('button');
          b.textContent = label;
          b.setAttribute('role', 'radio');
          const v = p / (n - 1);
          const mark = () => sw.querySelectorAll('button').forEach((x, q) => x.setAttribute('aria-checked', String(q === Math.round(fxValue(fx, i) * (n - 1)))));
          b.addEventListener('click', () => { set(v); mark(); });
          sw.append(b);
          queueMicrotask(mark);
        });
        controls.append(sw);
      } else {
        const k = new Knob({ label: c.label, min: 0, max: 10, value: fxValue(fx, i) * 10,
                             defaultValue: c.defaultValue * 10, step: 0.01, format: panel });
        k.onChange = () => set(k.value / 10);
        controls.append(k.el);
      }
    });
    const fs = box.querySelector<HTMLButtonElement>('.footswitch')!;
    const showOn = () => {
      fs.setAttribute('aria-pressed', String(fxState(fx).on));
      fs.querySelector('.fs-label')!.textContent = fxState(fx).on ? 'On' : 'Off';
    };
    fs.addEventListener('click', () => {
      fxState(fx).on = !fxState(fx).on;
      saveSettings();
      showOn();
      rig?.setFxEnabled(fx.index, fxState(fx).on, fx.stage);
      logEvent(`fx.${fx.id}.on`, fxState(fx).on);
    });
    showOn();
    return box;
  }
}

function applyPostFx(): void {
  if (!rig) return;
  for (const fx of allEffects) {
    fx.controls.forEach((_, i) => rig!.setFxControl(fx.index, i, fxValue(fx, i), fx.stage));
    rig.setFxEnabled(fx.index, fxState(fx).on, fx.stage);
  }
}

renderPostFx();

// --- pedals: four slots in signal order --------------------------------------

const board = $('#board');
const boardStatus = $('#board-status');
const slotState = (slot: number): BoardSlot | null => settings.board![slot];
let userPedals = loadUserPedals();
const allPedals = (): PedalInfo[] => [...factoryPedals, ...userPedals.map(userPedalInfo)];
const findPedal = (id: string | undefined): PedalInfo | undefined => allPedals().find((p) => p.id === id);
const pedalInfo = (slot: number): PedalInfo | undefined => findPedal(slotState(slot)?.id);
const slotKnobValue = (slot: number, p: PedalInfo, i: number) =>
  slotState(slot)?.knobs[p.controls[i].name] ?? p.controls[i].defaultValue;
const slotStatus: string[] = Array(numPedalSlots).fill('');

function renderBoard(): void {
  // The compressor sits first, on the raw guitar, then the four slots.
  const comp = fxBox(compressor);
  comp.classList.add('stomp-comp');
  const parts: HTMLElement[] = [gateBox(), Object.assign(document.createElement('div'), { className: 'cable', ariaHidden: 'true' }), comp];
  for (let slot = 0; slot < numPedalSlots; slot++) {
    parts.push(Object.assign(document.createElement('div'), { className: 'cable', ariaHidden: 'true' }));
    parts.push(renderStomp(slot));
  }
  board.replaceChildren(...parts);
  renderCircuit();
}

/** The noise gate, first on the board: threshold and a footswitch. */
function gateBox(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'fxbox gate-box';
  box.innerHTML = `<div class="fx-brand"><b>Gate</b><small>Noise gate</small></div><div class="fx-controls"></div>
    <button class="footswitch" aria-pressed="false"><span class="led" aria-hidden="true"></span><span class="fs-label"></span></button>`;
  box.querySelector('.fx-controls')!.append(knobs.gateDb.el);
  const fs = box.querySelector<HTMLButtonElement>('.footswitch')!;
  const show = () => {
    fs.setAttribute('aria-pressed', String(settings.gateOn));
    fs.querySelector('.fs-label')!.textContent = settings.gateOn ? 'On' : 'Off';
  };
  fs.addEventListener('click', () => { setGate(!settings.gateOn); show(); });
  show();
  return box;
}

function renderStomp(slot: number): HTMLElement {
  const p = pedalInfo(slot);
  const st = slotState(slot);
  const box = document.createElement('div');
  box.className = `stomp${p ? '' : ' empty'}`;
  box.dataset.pedal = p ? lookOf(p, allPedals()) : '';
  box.innerHTML = `
    <div class="stomp-head">
      <button class="slot-move" data-dir="-1" aria-label="Move pedal ${slot + 1} earlier" title="Move earlier" ${slot === 0 || !p ? 'disabled' : ''}>◀</button>
      <label class="stomp-name" title="${p ? `${p.name.replace(/"/g, '')}: change pedal` : 'Add a pedal'}"><span>${p ? p.name.replace(/[&<>"]/g, '') : '+'}</span>${p ? '<i aria-hidden="true">▾</i>' : ''}
        <select aria-label="Pedal ${slot + 1}"></select></label>
      <button class="slot-move" data-dir="1" aria-label="Move pedal ${slot + 1} later" title="Move later" ${slot === numPedalSlots - 1 || !p ? 'disabled' : ''}>▶</button>
    </div>
    <div class="knob-row small"></div>
    <button class="footswitch" aria-pressed="false"><span class="led" aria-hidden="true"></span><span class="fs-label"></span></button>
    <button class="link-light circuit-toggle" aria-controls="circuit-panel"></button>
    <div class="hint slot-status"></div>`;

  const sel = box.querySelector('select')!;
  sel.add(new Option(p ? 'No pedal (remove)' : 'Add a pedal…', 'none'));
  for (const fp of factoryPedals) sel.add(new Option(fp.name, fp.id));
  if (userPedals.length) {
    const mine = Object.assign(document.createElement('optgroup'), { label: 'Yours' });
    for (const u of userPedals) mine.append(new Option(userPedalInfo(u).name, u.id));
    sel.append(mine);
  }
  sel.value = p?.id ?? 'none';
  sel.addEventListener('change', async () => {
    settings.board![slot] = sel.value === 'none' ? null : { id: sel.value, on: true, knobs: { ...settings.pedalKnobs?.[sel.value] } };
    if (sel.value === 'none' && settings.circuitSlot === slot) settings.circuitSlot = null;
    saveSettings();
    logEvent(`pedal${slot}.type`, sel.value);
    track('pedal_changed', { slot, pedal: sel.value.startsWith('my-') ? 'my-pedal' : sel.value });
    renderBoard();
    await applySlot(slot);
  });

  box.querySelectorAll<HTMLButtonElement>('.slot-move').forEach((b) =>
    b.addEventListener('click', () => movePedal(slot, slot + Number(b.dataset.dir))));

  if (p && st) {
    const setValue = (c: PedalControl, i: number, v: number) => {
      st.knobs[c.name] = v;
      ((settings.pedalKnobs ??= {})[p.id] ??= {})[c.name] = v;
      saveSettings();
      rig?.setPedalControl(slot, i, v);
      logEvent(`pedal${slot}.${c.name}`, v);
    };
    const knobs = p.controls.map((c, i) => {
      if (c.positions) return buildSwitch(c.label, c.positions, () => slotKnobValue(slot, p, i), (v) => setValue(c, i, v));
      const k = new Knob({ label: c.label, min: 0, max: 10, value: slotKnobValue(slot, p, i) * 10,
                           defaultValue: c.defaultValue * 10, step: 0.01, format: panel });
      k.onChange = () => setValue(c, i, k.value / 10);
      return k.el;
    });
    box.querySelector('.knob-row')!.replaceChildren(...knobs);

    const fs = box.querySelector<HTMLButtonElement>('.footswitch')!;
    fs.setAttribute('aria-pressed', String(st.on));
    fs.querySelector('.fs-label')!.textContent = st.on ? 'On' : 'Bypassed';
    fs.addEventListener('click', () => {
      st.on = !st.on;
      saveSettings();
      logEvent(`pedal${slot}.on`, st.on);
      fs.setAttribute('aria-pressed', String(st.on));
      fs.querySelector('.fs-label')!.textContent = st.on ? 'On' : 'Bypassed';
      rig?.setPedalEnabled(slot, st.on);
    });

    const ct = box.querySelector<HTMLButtonElement>('.circuit-toggle')!;
    const showing = settings.circuitSlot === slot;
    ct.textContent = showing ? 'Hide circuit' : p.parent ? 'Edit circuit' : 'Show circuit';
    ct.setAttribute('aria-expanded', String(showing));
    ct.addEventListener('click', () => {
      settings.circuitSlot = settings.circuitSlot === slot ? null : slot;
      saveSettings();
      renderBoard();
    });
  }
  box.querySelector('.slot-status')!.textContent = slotStatus[slot];
  return box;
}

function setSlotStatus(slot: number, text: string): void {
  slotStatus[slot] = text;
  const el = board.querySelectorAll('.stomp')[slot]?.querySelector('.slot-status');
  if (el) el.textContent = text;
}

// Moving a pedal keeps its state in the engine (no re-solve): the rig and
// the settings shift the same way.
function movePedal(from: number, to: number): void {
  if (to < 0 || to >= numPedalSlots || from === to) return;
  const slots = settings.board!;
  const [moved] = slots.splice(from, 1);
  slots.splice(to, 0, moved);
  const [status] = slotStatus.splice(from, 1);
  slotStatus.splice(to, 0, status);
  const cs = settings.circuitSlot;
  if (cs !== null && cs !== undefined) {
    // The circuit view follows its pedal.
    if (cs === from) settings.circuitSlot = to;
    else if (from < cs && cs <= to) settings.circuitSlot = cs - 1;
    else if (to <= cs && cs < from) settings.circuitSlot = cs + 1;
  }
  saveSettings();
  logEvent('pedal.move', `${from}->${to}`);
  rig?.movePedal(from, to);
  renderBoard();
}

// The circuit panel: the schematic (when the pedal has a drawing) and
// its parts list - read-only for factory pedals (fork one to edit it),
// the live designer for your own.
let designer: { id: string; el: HTMLElement } | null = null;
function renderCircuit(): void {
  const slot = settings.circuitSlot;
  const p = slot !== null && slot !== undefined ? pedalInfo(slot) : undefined;
  $('#circuit-panel').hidden = !p;
  if (!p) {
    circuitSvg = null;
    designer = null;
    stopProbe();
    return;
  }
  $('#circuit-title').textContent = `${p.name} (pedal ${slot! + 1})`;
  if (probe && (probe.slot !== slot || probe.pedal !== p.id)) stopProbe();
  circuitSvg = hasSchematic(p) ? renderSchematic(p, { onNode: (n, at) => onWire(slot!, n, at) }) : null;
  $('#circuit-view').replaceChildren(...(circuitSvg ? [circuitSvg] : []));
  $('#circuit-view').hidden = !circuitSvg;
  $('#circuit-hint').hidden = !circuitSvg;
  circuitGlow.clear();
  // Keep the designer (its undo history, open fields) across re-renders.
  if (designer?.id !== p.id) designer = { id: p.id, el: buildDesigner(p, p.parent ? designerHost(p.id) : undefined) };
  const fork = document.createElement('div');
  fork.className = 'd-fork';
  if (!p.parent) {
    fork.innerHTML = `<button>Fork this pedal</button> <span class="hint">Makes your own copy in this slot to change parts in, and hear each change as you play.</span>`;
    fork.querySelector('button')!.addEventListener('click', () => forkPedal(slot!));
  }
  $('#circuit-design').replaceChildren(fork, designer.el);
  if (circuitSvg) linkSchematic(circuitSvg);
  renderProbe(p, slot!);
}

// The probe: a scope on one node of the shown pedal, fed ~30x a second.
let probe: { slot: number; pedal: string; node: string } | null = null;
let probeCanvas: HTMLCanvasElement | null = null;
let probeReadout: HTMLElement | null = null;

// A wire click: picking pins for a part being added, else probing.
let picking: { need: number; got: { node: string; at: [number, number] }[];
               resolve: (r: { node: string; at: [number, number] }[] | null) => void } | null = null;
function onWire(slot: number, node: string, at: [number, number]): void {
  if (!picking) { startProbe(slot, node); return; }
  picking.got.push({ node, at });
  if (circuitSvg) markNode(circuitSvg, node);
  if (picking.got.length >= picking.need) {
    const { got, resolve } = picking;
    picking = null;
    circuitSvg?.classList.remove('picking');
    resolve(got);
  }
}
function cancelPick(): void {
  if (!picking) return;
  const { resolve } = picking;
  picking = null;
  circuitSvg?.classList.remove('picking');
  resolve(null);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancelPick(); });

function startProbe(slot: number, node: string): void {
  const p = pedalInfo(slot);
  if (!p) return;
  probe = { slot, pedal: p.id, node };
  rig?.setProbe(slot, node);
  if (circuitSvg) markNode(circuitSvg, node);
  renderProbe(p, slot);
}

function stopProbe(): void {
  if (probe) rig?.setProbe(probe.slot, null);
  probe = null;
}

function renderProbe(p: PedalInfo, slot: number): void {
  const box = $('#circuit-probe');
  if (p.netlist.match(/^\*@pedal\b.*\bdsp=/im)) { box.replaceChildren(); return; } // a DSP model: no nodes
  const nodes = [...new Set(parseParts(p.netlist).filter((x) => x.letter !== 'k').flatMap((x) => x.nodes))]
    .filter((n) => n !== '0').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  box.innerHTML = `
    <div class="probe-head">
      <label>Probe <select class="probe-node"><option value="">off</option>${nodes
        .map((n) => `<option ${probe?.node === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <span class="probe-readout hint">${hasSchematic(p) ? 'Click a wire on the drawing, or pick a point here.' : 'Pick a point in the circuit.'}${rig ? '' : ' Power on to see it.'}</span>
    </div>
    <canvas class="probe-scope" width="900" height="180" ${probe ? '' : 'hidden'}></canvas>`;
  probeCanvas = box.querySelector('canvas');
  probeReadout = box.querySelector('.probe-readout');
  box.querySelector<HTMLSelectElement>('.probe-node')!.addEventListener('change', (e) => {
    const node = (e.target as HTMLSelectElement).value;
    if (node) startProbe(slot, node);
    else {
      stopProbe();
      if (circuitSvg) markNode(circuitSvg, null);
      renderProbe(p, slot);
    }
  });
}

/** Draws the probe's samples: triggered on a rising crossing of their
    mean so a steady note stands still; DC level and swing in volts. */
function showProbe(slot: number, node: string, samples: Float32Array): void {
  if (!probe || probe.slot !== slot || probe.node !== node || !probeCanvas || samples.length === 0) return;
  let sum = 0, lo = Infinity, hi = -Infinity;
  for (const v of samples) { sum += v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const mean = sum / samples.length;
  const span = Math.floor(samples.length / 2);
  let start = 0;
  for (let i = 1; i < samples.length - span; i++)
    if (samples[i - 1] < mean && samples[i] >= mean) { start = i; break; }
  const ctx = probeCanvas.getContext('2d')!;
  const { width: w, height: h } = probeCanvas;
  const pad = Math.max((hi - lo) * 0.1, 0.005);
  const y = (v: number) => h - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * h;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(232, 220, 192, 0.25)';
  ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(0, y(mean)); ctx.lineTo(w, y(mean)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#7fe0a8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < span; i++) {
    const x = (i / (span - 1)) * w;
    if (i === 0) ctx.moveTo(x, y(samples[start + i])); else ctx.lineTo(x, y(samples[start + i]));
  }
  ctx.stroke();
  const ms = (span / (rig?.ctx.sampleRate ?? 48000)) * 1000;
  const fmt = (v: number) => (Math.abs(v) >= 1 ? `${v.toFixed(2)} V` : `${(v * 1000).toFixed(1)} mV`);
  if (probeReadout)
    probeReadout.textContent = `${node}: DC ${fmt(mean)} · swing ${fmt(hi - lo)} peak to peak · ${ms.toFixed(0)} ms across`;
}

// Hovering a part on the drawing marks its row in the parts list.
function linkSchematic(svg: SVGSVGElement): void {
  const mark = (name: string | null) =>
    designer?.el.querySelectorAll<HTMLElement>('tr[data-part]').forEach((tr) =>
      tr.classList.toggle('d-hot', !!name && tr.dataset.part === name));
  svg.addEventListener('mouseover', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('.sch-part');
    mark(g?.dataset.name?.toUpperCase() ?? null);
  });
  svg.addEventListener('mouseleave', () => mark(null));
}

function forkPedal(slot: number): void {
  const p = pedalInfo(slot);
  const st = slotState(slot);
  if (!p || !st) return;
  const id = `my-${Date.now().toString(36)}`;
  userPedals.push({ id, parent: p.id, netlist: forkNetlist(p, `My ${p.name}`) });
  saveUserPedals(userPedals);
  settings.board![slot] = { id, on: st.on, knobs: { ...st.knobs } };
  (settings.pedalKnobs ??= {})[id] = { ...st.knobs };
  settings.circuitSlot = slot;
  saveSettings();
  logEvent(`pedal${slot}.fork`, p.id);
  track('pedal_forked', { pedal: p.id.startsWith('my-') ? 'my-pedal' : p.id });
  renderBoard();
  void applySlot(slot);
}

function designerHost(id: string) {
  return {
    async apply(netlist: string): Promise<string | null> {
      const u = userPedals.find((x) => x.id === id);
      if (!u) return null;
      u.netlist = netlist;
      saveUserPedals(userPedals);
      logEvent('designer.edit', id);
      // Values on the drawing come from the netlist: redraw it.
      const p = userPedalInfo(u);
      if (circuitSvg && hasSchematic(p)) {
        circuitSvg = renderSchematic(p, { onNode: (n, at) => onWire(settings.circuitSlot!, n, at) });
        $('#circuit-view').replaceChildren(circuitSvg);
        linkSchematic(circuitSvg);
        markNode(circuitSvg, probe?.node ?? null);
      }
      renderProbe(p, settings.circuitSlot!);
      if (!rig) return null;
      let error: string | null = null;
      for (let slot = 0; slot < numPedalSlots; slot++) {
        if (slotState(slot)?.id !== id) continue;
        const e = await rig.loadPedal(slot, netlist, p.controls.map((_, i) => slotKnobValue(slot, p, i)));
        rig.setPedalEnabled(slot, slotState(slot)?.on ?? true);
        setSlotStatus(slot, e ? `Couldn't load: ${e}` : '');
        error ??= e;
      }
      return error;
    },
    rename(): void {
      renderBoard(); // the designer itself is kept
    },
    pick(count: number) {
      cancelPick();
      return new Promise<{ node: string; at: [number, number] }[] | null>((resolve) => {
        picking = { need: count, got: [], resolve };
        circuitSvg?.classList.add('picking');
      });
    },
    remove(): void {
      userPedals = userPedals.filter((x) => x.id !== id);
      saveUserPedals(userPedals);
      settings.board = settings.board!.map((b) => (b?.id === id ? null : b));
      settings.circuitSlot = null;
      saveSettings();
      renderBoard();
      void applyBoard();
    },
  };
}

// Live glow: the engine reports each diode's and transistor's activity
// ~30x a second; parts light up instantly and fade over ~100 ms.
let circuitSvg: SVGSVGElement | null = null;
const circuitGlow = new Map<string, number>();
function showPedalActivity(slot: number, a: PedalActivity): void {
  if (!circuitSvg || slot !== settings.circuitSlot) return;
  const parts = glowParts(circuitSvg);
  a.devices.forEach((name, i) => {
    const kind = parts.get(name);
    if (!kind) return; // e.g. op-amp rail clamps: not drawn
    const g = Math.max(glowFor(kind, a.values[i]), (circuitGlow.get(name) ?? 0) * 0.72);
    circuitGlow.set(name, g);
    setGlow(circuitSvg!, name, g);
  });
}

async function applySlot(slot: number): Promise<void> {
  if (!rig) return;
  const p = pedalInfo(slot);
  if (!p) {
    rig.unloadPedal(slot);
    setSlotStatus(slot, '');
    return;
  }
  setSlotStatus(slot, 'Solving the circuit…');
  const error = await rig.loadPedal(slot, p.netlist, p.controls.map((_, i) => slotKnobValue(slot, p, i)));
  rig.setPedalEnabled(slot, slotState(slot)?.on ?? true);
  setSlotStatus(slot, error ? `Couldn't load: ${error}` : '');
}

async function applyBoard(): Promise<void> {
  await Promise.all(Array.from({ length: numPedalSlots }, (_, slot) => applySlot(slot)));
}

renderBoard();

// The buffer size is fixed when the AudioContext is created: restart.
bufferSel.addEventListener('change', async () => {
  settings.buffer = bufferSel.value === 'low' ? 'low' : 'standard';
  saveSettings();
  if (rig) {
    await powerOff();
    await powerOn();
  }
});

function setGate(on: boolean): void {
  settings.gateOn = on;
  saveSettings();
  logEvent('gate.on', on);
  rig?.setParam(Param.gateOn, on ? 1 : 0);
}

// --- tabs ---------------------------------------------------------------------

const tabs = buildTabs({ outputDeviceId: () => settings.outputDeviceId || undefined });
$('#tabs-slot').replaceWith(tabs.el);
const tabsBtn = $<HTMLButtonElement>('#tabs-btn');
tabsBtn.setAttribute('aria-pressed', String(tabs.isOpen()));
tabsBtn.addEventListener('click', () => {
  tabsBtn.setAttribute('aria-pressed', String(tabs.toggle()));
  logEvent('tabs.open', tabs.isOpen());
  if (tabs.isOpen()) track('tabs_opened');
  layoutPractice();
});

// --- tuner --------------------------------------------------------------------

let tunerMuted = false;
const tunerBtn = $<HTMLButtonElement>('#tuner-btn');
const tuner = new Tuner({
  input: () => rig?.startTuner() ?? null,
  sampleRate: () => rig?.ctx.sampleRate ?? 48000,
  mute: (on) => {
    tunerMuted = on;
    applyKnob('master');
  },
});
$('#tuner-slot').append(tuner.el);
tunerBtn.addEventListener('click', () => {
  if (tuner.isOpen) tuner.close();
  else { tuner.open(); track('tuner_opened'); }
  tunerBtn.setAttribute('aria-pressed', String(tuner.isOpen));
});
tuner.el.addEventListener('close', () => {
  rig?.stopTuner();
  tunerBtn.setAttribute('aria-pressed', 'false');
});

// --- presets ------------------------------------------------------------------

const presetSel = $<HTMLSelectElement>('#preset');
const presetName = $<HTMLInputElement>('#preset-name');
const presetSave = $<HTMLButtonElement>('#preset-save');
const presetDelete = $<HTMLButtonElement>('#preset-delete');
let userPresets = loadUserPresets();

const presetById = (key: string | undefined): Preset | undefined =>
  key?.startsWith('factory:') ? factoryPresets[Number(key.slice(8))]
    : key?.startsWith('user:') ? userPresets.find((p) => p.id === key.slice(5)) : undefined;

// A preset with every knob spelled out (defaults filled in), rounded, so two
// presets that sound the same compare equal.
function normalized(p: Preset): string {
  const amp = amps.find((a) => a.id === p.amp) ?? amps[0];
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const knobsOf = (controls: { name: string; defaultValue: number }[], values: Record<string, number>) =>
    Object.fromEntries(controls.map((c) => [c.name, r(values[c.name] ?? c.defaultValue)]));
  const pedals = Array.from({ length: numPedalSlots }, (_, i) => {
    const slot = p.pedals[i];
    const info = slot && findPedal(slot.id);
    return slot && info ? { id: slot.id, on: slot.on, knobs: knobsOf(info.controls, slot.knobs) } : null;
  });
  const fx = Object.fromEntries(allEffects.map((f) => {
    const st = p.fx[f.id];
    return [f.id, { on: !!st?.on, values: knobsOf(f.controls, st?.values ?? {}) }];
  }));
  const cab = p.cab === 'amp' ? ampCab(amp) : p.cab;
  return JSON.stringify({ amp: amp.id, ampKnobs: knobsOf(amp.controls, p.ampKnobs), pedals, cab, fx,
                          gate: { on: p.gate.on, db: r(p.gate.db) }, level: r(p.level ?? 0) });
}

/** The rig as it stands, as a preset. */
function currentTone(name: string): Preset {
  const a = currentAmp();
  return {
    name,
    amp: a.id,
    ampKnobs: Object.fromEntries(a.controls.map((c, i) => [c.name, ampKnobValue(a, i)])),
    pedals: settings.board!.map((b) => (b ? { id: b.id, on: b.on, knobs: { ...b.knobs } } : null)),
    cab: settings.cab,
    fx: structuredClone(settings.fx ?? {}),
    gate: { on: settings.gateOn, db: knobs.gateDb.value },
    level: knobs.presetLevel.value,
  };
}

function renderPresets(): void {
  // Factory presets in their groups (Factory, then each artist), in order.
  const groups = new Map<string, HTMLOptGroupElement>();
  factoryPresets.forEach((p, i) => {
    const amp = amps.find((a) => a.id === p.amp);
    if (amp && !ampListed(amp) && settings.preset !== `factory:${i}`) return;
    const label = p.group ?? 'Factory';
    if (!groups.has(label)) groups.set(label, Object.assign(document.createElement('optgroup'), { label }));
    groups.get(label)!.append(new Option(p.group ? p.name.replace(`${p.group}: `, '') : p.name, `factory:${i}`));
  });
  const mine = document.createElement('optgroup');
  mine.label = 'Yours';
  for (const p of userPresets) mine.append(new Option(p.name, `user:${p.id}`));
  presetSel.replaceChildren(new Option('— Pick a preset —', ''), ...groups.values(), ...(userPresets.length ? [mine] : []));
  presetSel.value = presetById(settings.preset) ? settings.preset! : '';
  const p = presetById(settings.preset);
  presetName.value = p?.name ?? '';
  const notes = $('#preset-notes');
  notes.textContent = p?.notes ?? '';
  notes.hidden = !p?.notes;
  const isUser = !!settings.preset?.startsWith('user:');
  presetSave.textContent = isUser ? 'Save' : 'Save as mine';
  presetSave.title = isUser ? 'Save your changes to this preset' : 'Save the rig as one of your presets';
  presetDelete.hidden = !isUser;
  showPresetEdited();
}

function presetEdited(): boolean {
  const p = presetById(settings.preset);
  return !!p && normalized(p) !== normalized(currentTone(p.name));
}
function showPresetEdited(): void {
  const edited = presetEdited();
  $('#preset-edited').hidden = !edited;
  $('#preset-ab').hidden = !edited && !ab;
}

async function applyPreset(p: Preset): Promise<void> {
  const a = amps.find((x) => x.id === p.amp) ?? amps[0];
  settings.amp = a.id;
  ampSel.value = a.id;
  (settings.ampKnobs ??= {})[a.id] = { ...p.ampKnobs };
  settings.board = Array.from({ length: numPedalSlots }, (_, i) => {
    const slot = p.pedals[i];
    return slot && findPedal(slot.id) ? { id: slot.id, on: slot.on, knobs: { ...slot.knobs } } : null;
  });
  if (settings.circuitSlot !== null && settings.circuitSlot !== undefined && !settings.board[settings.circuitSlot])
    settings.circuitSlot = null;
  const cab = p.cab === 'amp' ? ampCab(a) : p.cab;
  // A user IR that isn't in the folder any more: the amp's own cab instead.
  settings.cab = [...cabSel.options].some((o) => o.value === cab) ? cab : ampCab(a);
  cabSel.value = settings.cab;
  settings.fx = structuredClone(p.fx);
  settings.gateOn = p.gate.on;
  knobs.gateDb.set(p.gate.db, false);
  settings.knobs.gateDb = knobs.gateDb.value;
  knobs.presetLevel.set(p.level ?? 0, false);
  settings.presetLevel = knobs.presetLevel.value;
  saveSettings();
  logEvent('preset', p.name);

  renderAmp();
  renderBoard();
  renderPostFx();
  if (rig) {
    applyAll();
    applyPostFx();
    await Promise.all([applyAmp(), applyBoard(), applyCab()]);
  }
}

presetSel.addEventListener('change', async () => {
  ab = null;
  showAb();
  closeSaving();
  settings.preset = presetSel.value || undefined;
  const p = presetById(settings.preset);
  renderPresets();
  if (p) await applyPreset(p);
  if (p) track('preset_selected', { preset: settings.preset!.startsWith('user:') ? 'user' : p.name, group: p.group ?? null });
  showPresetEdited();
});

/** A preset's name without its artist group (the menu shows that already). */
const shortName = (p: Preset) => (p.group ? p.name.replace(`${p.group}: `, '') : p.name);

// Saving: your own preset saves in place; anything else asks for a name
// first (the name field only shows then).
const presetSaving = $('#preset-saving');
const userPresetNow = () => settings.preset?.startsWith('user:') ? userPresets.find((p) => `user:${p.id}` === settings.preset) : undefined;
function savePreset(name: string): void {
  const existing = userPresetNow();
  if (existing) Object.assign(existing, currentTone(name));
  else {
    const id = Date.now().toString(36);
    userPresets.push({ ...currentTone(name), id });
    settings.preset = `user:${id}`;
  }
  ab = null;
  track('preset_saved', { amp: settings.amp });
  saveUserPresets(userPresets);
  saveSettings();
  renderPresets();
}
function closeSaving(): void {
  presetSaving.hidden = true;
  presetSave.hidden = false;
}
presetSave.addEventListener('click', () => {
  const existing = userPresetNow();
  if (existing) { savePreset(existing.name); return; }
  const p = presetById(settings.preset);
  presetName.value = p ? `My ${shortName(p)}` : `My tone ${userPresets.length + 1}`;
  presetSaving.hidden = false;
  presetSave.hidden = true;
  presetName.focus();
  presetName.select();
});
$('#preset-save-ok').addEventListener('click', () => {
  savePreset(presetName.value.trim() || `My tone ${userPresets.length + 1}`);
  closeSaving();
});
$('#preset-save-cancel').addEventListener('click', closeSaving);
presetName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#preset-save-ok').click();
  else if (e.key === 'Escape') closeSaving();
});

// Previous / next: through the menu's order (factory, artists, yours).
function stepPreset(dir: number): void {
  const opts = [...presetSel.options].filter((o) => o.value);
  if (!opts.length) return;
  const i = opts.findIndex((o) => o.value === presetSel.value);
  const next = opts[i < 0 ? (dir > 0 ? 0 : opts.length - 1) : (i + dir + opts.length) % opts.length];
  presetSel.value = next.value;
  presetSel.dispatchEvent(new Event('change'));
}
$('#preset-prev').addEventListener('click', () => stepPreset(-1));
$('#preset-next').addEventListener('click', () => stepPreset(1));

// A / B: hear the saved preset (A) against your edit (B). Touching anything
// while comparing makes that the new edit.
let ab: { edit: Preset; showing: 'A' | 'B' } | null = null;
let abApplying = false;
const abBtn = $<HTMLButtonElement>('#preset-ab');
function showAb(): void {
  abBtn.textContent = !ab ? 'A / B' : ab.showing === 'A' ? 'Hearing A (saved)' : 'Hearing B (your edit)';
  abBtn.classList.toggle('active', !!ab);
}
abBtn.addEventListener('click', async () => {
  const p = presetById(settings.preset);
  if (!p) return;
  if (!ab) ab = { edit: currentTone(p.name), showing: 'B' };
  ab.showing = ab.showing === 'A' ? 'B' : 'A';
  abApplying = true;
  try {
    await applyPreset(ab.showing === 'A' ? p : ab.edit);
  } finally {
    abApplying = false;
  }
  showAb();
  showPresetEdited();
});

// Deleting takes two clicks (no dialogs): the first one arms it for 3 s.
let deleteArmed = 0;
presetDelete.addEventListener('click', () => {
  if (!settings.preset?.startsWith('user:')) return;
  if (!deleteArmed) {
    presetDelete.textContent = 'Really delete?';
    deleteArmed = window.setTimeout(() => { deleteArmed = 0; presetDelete.textContent = 'Delete'; }, 3000);
    return;
  }
  clearTimeout(deleteArmed);
  deleteArmed = 0;
  presetDelete.textContent = 'Delete';
  userPresets = userPresets.filter((p) => `user:${p.id}` !== settings.preset);
  settings.preset = undefined;
  saveUserPresets(userPresets);
  saveSettings();
  renderPresets();
});

// Backup / move to another browser: your presets as a JSON file.
$('#preset-export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(userPresets, null, 2)], { type: 'application/json' }));
  a.download = 'phreakguitar-presets.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
const presetFile = $<HTMLInputElement>('#preset-file');
$('#preset-import').addEventListener('click', () => presetFile.click());
presetFile.addEventListener('change', async () => {
  const file = presetFile.files?.[0];
  presetFile.value = '';
  if (!file) return;
  try {
    const list = JSON.parse(await file.text());
    const incoming = (Array.isArray(list) ? list : []).filter(isPreset);
    const known = new Set(userPresets.map((p) => p.id));
    for (const p of incoming) userPresets.push(known.has(p.id) ? { ...p, id: `${p.id}-${Date.now().toString(36)}` } : p);
    saveUserPresets(userPresets);
    renderPresets();
    $('#preset-note').textContent = `Imported ${incoming.length} preset${incoming.length === 1 ? '' : 's'}.`;
  } catch {
    $('#preset-note').textContent = "That file isn't a PhreakGuitar preset file.";
  }
});

afterSave = () => { showPresetEdited(); refreshStages(); };
renderPresets();

// --- meters -----------------------------------------------------------------

const meterFloorDb = -60;
const silenceDb = -90;
const fallDbPerSec = 24; // peak-hold decay, so readings are legible while playing
const toDb = (g: number) => (g > 0 ? 20 * Math.log10(g) : -Infinity);
const held: Record<string, { db: number; at: number }> = {};

function holdPeak(id: string, dbValue: number): number {
  const now = performance.now();
  const h = held[id] ?? { db: -Infinity, at: now };
  const decayed = h.db - ((now - h.at) / 1000) * fallDbPerSec;
  held[id] = { db: Math.max(dbValue, decayed), at: now };
  return held[id].db;
}

function setLevelMeter(id: string, gain: number): void {
  const dbValue = holdPeak(id, toDb(gain));
  const frac = Math.max(0, Math.min(1, (dbValue - meterFloorDb) / -meterFloorDb));
  $(`#${id} .meter-fill`).style.transform = `scaleX(${frac})`;
  $(`#${id} .meter-readout`).textContent = dbValue > silenceDb ? `${dbValue.toFixed(1)} dB` : '–∞';
  $(`#${id}`).classList.toggle('hot', dbValue > -3);
}

function showMeters(m: Meters): void {
  // Circuit health: the engine resets a pedal whose solve runs away.
  boardStatus.textContent = m.pedalFaults > 0 || m.pedalNewtonFailures > 0
    ? `Solver: ${m.pedalNewtonFailures} slow samples, ${m.pedalFaults} resets` : '';
  setLevelMeter('meter-in', m.inputPeak);
  setLevelMeter('meter-out', m.outputPeak);
  // Gain reduction grows from the right: 0..12 dB mapped onto the bar.
  const gr = Math.max(0, holdPeak('meter-limit-gr', -toDb(m.limiterGain)));
  $('#meter-limit .meter-fill').style.transform = `scaleX(${Math.min(1, gr / 12)})`;
  $('#meter-limit .meter-readout').textContent = gr > 0.05 ? `−${gr.toFixed(1)} dB` : '0 dB';
  $('#meter-limit').classList.toggle('active', gr > 0.05);
  $('#limit-led').classList.toggle('on', gr > 0.05);
  const outDb = held['meter-out']?.db ?? -Infinity;
  const frac = Math.max(0, Math.min(1, (outDb - meterFloorDb) / -meterFloorDb));
  for (const v of stageViews) v.level(frac, outDb > -3);
}

// --- latency & dropouts -------------------------------------------------------

const fmtMs = (ms: number) => `${ms.toFixed(1)} ms`;

function showLatency(): void {
  if (!rig) {
    $('#lat-estimate').textContent = '—';
    $('#lat-breakdown').textContent = 'Power on to see the signal path latency.';
    $('#dropouts').textContent = '—';
    return;
  }
  const l = rig.latency();
  const total = l.baseMs + l.outputMs + (l.inputMs ?? 0) + l.engineMs;
  $('#lat-estimate').textContent = fmtMs(total);
  $('#lat-breakdown').textContent =
    `buffer ${fmtMs(l.baseMs)} + output ${fmtMs(l.outputMs)} + input ` +
    `${l.inputMs === null ? 'n/a' : fmtMs(l.inputMs)} + amp ${fmtMs(l.engineMs)}`;

  const g = rig.glitchStats();
  const mins = Math.floor(g.runningSeconds / 60), secs = Math.floor(g.runningSeconds % 60);
  $('#dropouts').textContent = `${g.dropouts} in ${mins}:${String(secs).padStart(2, '0')}`;
  $('#dropouts').dataset.bad = String(g.dropouts > 0);
}
setInterval(showLatency, 500);
showLatency();

$('#dropouts-reset').addEventListener('click', () => {
  rig?.resetGlitchStats();
  showLatency();
});

measureBtn.addEventListener('click', async () => {
  if (!rig) return;
  measureBtn.disabled = true;
  const result = $('#lat-measured');
  result.textContent = 'Measuring…';
  try {
    const deviceMs = await rig.measureLoopback();
    const total = deviceMs + rig.latency().engineMs;
    result.textContent = `${fmtMs(total)} round trip`;
    result.dataset.ok = String(total <= 12);
    $('#lat-measured-note').textContent = `device ${fmtMs(deviceMs)} + amp ${fmtMs(rig.latency().engineMs)} · target ≤ 12 ms`;
  } catch (err) {
    result.textContent = 'Failed';
    delete result.dataset.ok;
    $('#lat-measured-note').textContent = describeError(err);
  } finally {
    measureBtn.disabled = false;
  }
});

navigator.mediaDevices?.addEventListener('devicechange', () => void listDevices());
void listDevices();

// --- capture: "Send last 30 s to Claude" (dev server only) ---------------------

function wavFloat32(samples: Float32Array, sampleRate: number): Blob {
  const header = new DataView(new ArrayBuffer(44));
  const str = (o: number, s: string) => [...s].forEach((ch, i) => header.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); header.setUint32(4, 36 + samples.byteLength, true); str(8, 'WAVE');
  str(12, 'fmt '); header.setUint32(16, 16, true); header.setUint16(20, 3, true); header.setUint16(22, 1, true);
  header.setUint32(24, sampleRate, true); header.setUint32(28, sampleRate * 4, true);
  header.setUint16(32, 4, true); header.setUint16(34, 32, true);
  str(36, 'data'); header.setUint32(40, samples.byteLength, true);
  return new Blob([header, new Float32Array(samples)]); // copy: a view may sit in a larger buffer
}

async function sendCapture(): Promise<string> {
  if (!rig) throw new Error('power on first');
  const cap = await rig.capture();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const meta = {
    capturedAt: new Date().toISOString(),
    sampleRate: cap.sampleRate,
    seconds: cap.dry.length / cap.sampleRate,
    // Event times are seconds before the end of the capture (negative).
    events: events.filter((e) => e.t >= 0).map((e) => ({ ...e, t: +(e.t - cap.endTime).toFixed(3) }))
      .filter((e) => e.t > -cap.dry.length / cap.sampleRate),
    settings,
    pedals: settings.board!.map((b) => (b ? `${b.id}${b.on ? '' : ' (bypassed)'}` : null)),
    latency: rig.latency(),
    dropouts: rig.glitchStats(),
    pedalStatus: [...slotStatus, boardStatus.textContent],
  };
  const post = (file: string, body: Blob) =>
    fetch(`/__capture?file=${file}`, { method: 'POST', body }).then((r) => {
      if (!r.ok) throw new Error(`save failed (${r.status})`);
    });
  await post(`${stamp}-dry.wav`, wavFloat32(cap.dry, cap.sampleRate));
  await post(`${stamp}-wet.wav`, wavFloat32(cap.wet, cap.sampleRate));
  await post(`${stamp}-meta.json`, new Blob([JSON.stringify(meta, null, 2)]));
  return stamp;
}

$('#send-capture').addEventListener('click', async () => {
  const status = $('#capture-status');
  status.textContent = 'Saving…';
  try {
    const stamp = await sendCapture();
    status.textContent = `Saved as captures/${stamp}-*. Tell Claude what you heard and roughly when.`;
  } catch (err) {
    status.textContent = describeError(err);
  }
});

if (import.meta.env.DEV) (window as unknown as { phreakguitarCapture: typeof sendCapture }).phreakguitarCapture = sendCapture;

// --- settings drawer ------------------------------------------------------------

const drawer = $('#settings');
const scrim = $('#drawer-scrim');
const settingsBtn = $<HTMLButtonElement>('#settings-btn');
function openDrawer(open: boolean): void {
  drawer.hidden = !open;
  scrim.hidden = !open;
  settingsBtn.setAttribute('aria-expanded', String(open));
}
settingsBtn.addEventListener('click', () => openDrawer(Boolean(drawer.hidden)));
$('#settings-close').addEventListener('click', () => openDrawer(false));
scrim.addEventListener('click', () => openDrawer(false));

// --- stage view, and the compact rig beside the tabs ----------------------------

const fxKeys: Record<string, string> = { eq7: 'E', delay: 'D', 'reverb': 'R' };
function stageItems(): StageItem[] {
  const items: StageItem[] = [
    { id: 'gate', label: 'Gate', on: settings.gateOn, key: 'G' },
    { id: 'comp', label: 'Red Comp', on: fxState(compressor).on, key: 'C' },
  ];
  for (let s = 0; s < numPedalSlots; s++) {
    const p = pedalInfo(s);
    const st = slotState(s);
    if (p && st) items.push({ id: `slot${s}`, label: p.name, on: st.on, key: String(s + 1) });
  }
  for (const fx of postEffects) items.push({ id: fx.id, label: fx.name, on: fxState(fx).on, key: fxKeys[fx.id] ?? '' });
  if (settings.looperOn) {
    const st = looperStatus?.state ?? 'empty';
    items.push({ id: 'looper', label: `Looper · ${looperLabel[st]}`, on: st === 'recording' || st === 'playing' || st === 'overdubbing', key: 'L' });
  }
  return items;
}

/** Flips one thing in the chain on or off (switches, keys, stage view). */
function toggleChain(id: string): void {
  if (id === 'looper') looperCommand(0);
  else if (id === 'gate') {
    setGate(!settings.gateOn);
    renderBoard();
  } else if (id === 'comp' || postEffects.some((f) => f.id === id)) {
    const fx = id === 'comp' ? compressor : postEffects.find((f) => f.id === id)!;
    const st = fxState(fx);
    st.on = !st.on;
    saveSettings();
    rig?.setFxEnabled(fx.index, st.on, fx.stage);
    logEvent(`fx.${fx.id}.on`, st.on);
    if (id === 'comp') renderBoard(); else renderPostFx();
  } else if (id.startsWith('slot')) {
    const slot = Number(id.slice(4));
    const st = slotState(slot);
    if (!st) return;
    st.on = !st.on;
    saveSettings();
    rig?.setPedalEnabled(slot, st.on);
    logEvent(`pedal${slot}.on`, st.on);
    renderBoard();
  }
}

const stageHost = (close?: () => void) => ({
  preset: () => {
    const p = presetById(settings.preset);
    return { name: p ? shortName(p) : 'No preset', notes: p?.notes, edited: presetEdited() };
  },
  items: stageItems,
  toggle: toggleChain,
  prev: () => stepPreset(-1),
  next: () => stepPreset(1),
  tuner: () => { if (!tunerBtn.disabled) tunerBtn.click(); },
  master: { spec: knobSpecs.master, get: () => knobs.master.value, set: (v: number) => knobs.master.set(v) },
  close,
});
const stageEl = $('#stage');
const fullStage = buildStage(stageHost(() => openStage(false)), 'full');
const miniStage = buildStage(stageHost(), 'mini');
stageEl.append(fullStage.el);
$('#mini-slot').append(miniStage.el);
const stageViews = [fullStage, miniStage];
let stageQueued = false;
function refreshStages(): void {
  if (stageQueued) return;
  stageQueued = true;
  requestAnimationFrame(() => {
    stageQueued = false;
    if (!stageEl.hidden) fullStage.refresh();
    if (!$('#mini-slot').hidden) miniStage.refresh();
  });
}
function openStage(open: boolean): void {
  stageEl.hidden = !open;
  document.body.classList.toggle('staging', open);
  $('#stage-btn').setAttribute('aria-pressed', String(open));
  if (open) { fullStage.refresh(); track('stage_opened'); }
}
$('#stage-btn').addEventListener('click', () => openStage(Boolean(stageEl.hidden)));

// Practice view: on a wide screen, the tabs get the left and the compact
// rig sits beside them.
function layoutPractice(): void {
  const side = tabs.isOpen() && innerWidth >= 1200;
  $('#practice').classList.toggle('side', side);
  $('#mini-slot').hidden = !side;
  if (side) miniStage.refresh();
}
addEventListener('resize', layoutPractice);
layoutPractice();

// --- keys ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (e.key === 'Escape') {
    if (!stageEl.hidden) openStage(false);
    else if (!drawer.hidden) openDrawer(false);
    return;
  }
  if (t.closest('input, select, textarea, [contenteditable="true"], .knob')) return;
  const k = e.key.toLowerCase();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    stepPreset(e.key === 'ArrowLeft' ? -1 : 1);
  } else if (/^[1-4]$/.test(k)) toggleChain(`slot${Number(k) - 1}`);
  else if (k === 'g') toggleChain('gate');
  else if (k === 'c') toggleChain('comp');
  else if (k === 'e') toggleChain('eq7');
  else if (k === 'd') toggleChain('delay');
  else if (k === 'r') toggleChain('reverb');
  else if (k === 't') { if (!tunerBtn.disabled) tunerBtn.click(); }
  else if (k === 's') openStage(Boolean(stageEl.hidden));
  else if (k === 'l') looperCommand(0);
  else if (k === 'k') looperCommand(1);
  else if (k === 'u') looperCommand(2);
  else return;
  refreshStages();
});

// --- the public site: dev-only parts, first visit, browser support ------------

if (!import.meta.env.DEV) $('#capture-sec').hidden = true; // saves into the dev server's folder

function showWelcome(): void {
  const card = document.createElement('section');
  card.className = 'card welcome';
  card.setAttribute('aria-label', 'Welcome');
  card.innerHTML = `
    <h2>Welcome to PhreakGuitar</h2>
    <p>A guitar rig in your browser: amps and pedals simulated as real circuits.</p>
    <ul>
      <li><b>Use an audio interface, and headphones or speakers.</b> A laptop's built-in microphone
        with its speakers will howl with feedback.</li>
      <li>Press <b>Choose my interface</b> below (it's also in <b>⚙ Settings</b>): allow the microphone so your browser
        can list your interface, pick its input, channel and output, then flip the <b>power switch</b> at the top right.</li>
      <li>Master starts at −12 dB. Turn it up slowly. Your audio stays on this computer.</li>
    </ul>
    <div class="welcome-actions">
      <button class="welcome-devices">Choose my interface</button>
      <button class="link welcome-ok">Got it</button>
    </div>`;
  if (onPhone) card.querySelector('ul')!.insertAdjacentHTML('afterbegin',
    `<li class="welcome-phone"><b>On a phone?</b> Have a look around the amps, pedals and presets. To play, you'll want a
      computer (or a phone with an audio interface that plugs into it) and headphones.</li>`);
  const done = () => { settings.welcomed = true; saveSettings(); card.remove(); };
  card.querySelector('.welcome-ok')!.addEventListener('click', () => { done(); track('welcome_done', { choice: 'ok' }); });
  card.querySelector('.welcome-devices')!.addEventListener('click', () => {
    done();
    track('welcome_done', { choice: 'devices' });
    openDrawer(true);
    if (!deviceAccess.hidden) void showDevices();
  });
  $('main').prepend(card);
}

const unsupported = !('AudioWorkletNode' in window) || !navigator.mediaDevices?.getUserMedia
  || typeof WebAssembly === 'undefined';
if (unsupported) {
  setStatus('This browser can\'t run the rig (it needs AudioWorklet, WebAssembly and microphone access). Try Chrome or Edge.', 'error');
  powerBtn.disabled = true;
  track('unsupported_browser');
} else if (firstVisit && !settings.welcomed) showWelcome();

// Last, once everything above exists: power back up if it was on.
// ?nopower in the URL skips it (a second tab, or a look without sound).
if (settings.powered && !new URLSearchParams(location.search).has('nopower')) void powerOn();
