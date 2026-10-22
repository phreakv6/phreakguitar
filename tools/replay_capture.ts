// Replays a capture (captures/<stamp>-dry.wav + -meta.json) through the WASM
// engine: same dry input, same pedal, same knob moves at the same moments.
// Prints output peak per window, to compare with what the player heard.
// Reads captures from the single-pedal days (meta.pedal); the pedal goes
// in slot 1.
//   node tools/replay_capture.ts captures/<stamp> [--window 0.5]

import { readFileSync } from 'node:fs';
import { Engine, Param } from '../web/src/engine.ts';
import { readWav } from './wav.ts';

const base = process.argv[2];
const win = Number(process.argv[process.argv.indexOf('--window') + 1]) || 0.5;
const meta = JSON.parse(readFileSync(`${base}-meta.json`, 'utf8'));
const dry = readWav(`${base}-dry.wav`).channels[0];
const sr: number = meta.sampleRate;
const module = new WebAssembly.Module(readFileSync(new URL('../web/public/engine.wasm', import.meta.url)));

const block = 128;
const engine = new Engine(module, sr, block, 1);
const amp = meta.settings.knobs;
engine.setParam(Param.drive, (amp.drive ?? 4) / 10);
engine.setParam(Param.inputDb, amp.input ?? 0);
engine.setParam(Param.outputDb, amp.master ?? 0);
engine.setTone((amp.treble ?? 6) / 10, (amp.mid ?? 5) / 10, (amp.bass ?? 5) / 10);

const pedalFile = readFileSync(new URL(`../pedals/${meta.pedal}.cir`, import.meta.url));
const controls = [...pedalFile.toString().matchAll(/^\*@control\s+(\S+).*?default=([\d.]+)/gim)].map((m) => m[1].toLowerCase());
const events = (meta.events as { t: number; what: string; value: number }[])
  .filter((e) => e.what.startsWith('pedal.') && controls.includes(e.what.slice(6)))
  .map((e) => ({ frame: Math.round(dry.length + e.t * sr), index: controls.indexOf(e.what.slice(6)), value: e.value / 10 }));

// Knobs as they were before the first logged move.
const final = meta.settings.pedal.knobs[meta.pedal] ?? {};
const start = controls.map((c) => {
  const first = events.find((e) => controls[e.index] === c);
  return first ? (meta.events.find((e: { what: string }) => e.what === `pedal.${c}`).value / 10) : final[c] ?? 0.5;
});
const err = engine.loadPedal(0, new Uint8Array(pedalFile), start);
if (err) throw new Error(err);

const out = new Float32Array(dry.length);
let ei = 0;
for (let pos = 0; pos < dry.length; pos += block) {
  while (ei < events.length && events[ei].frame <= pos) {
    engine.setPedalControl(0, events[ei].index, events[ei].value);
    ei++;
  }
  const n = Math.min(block, dry.length - pos);
  engine.channel(0).set(dry.subarray(pos, pos + n));
  engine.process(n);
  out.set(engine.channel(0).subarray(0, n), pos);
}

const db = (v: number) => (20 * Math.log10(Math.max(v, 1e-9))).toFixed(1).padStart(6);
const w = Math.round(win * sr);
console.log(' t(s)  replay peak');
for (let i = 0; i < out.length; i += w) {
  let pk = 0;
  for (let j = i; j < Math.min(i + w, out.length); j++) pk = Math.max(pk, Math.abs(out[j]));
  if (pk > 1e-6) console.log(`${((i - out.length) / sr).toFixed(1).padStart(6)} ${db(pk)}`);
}
