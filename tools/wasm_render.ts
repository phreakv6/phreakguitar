// Offline render through the WASM engine, mirroring tools/render_main.cpp
// with the cab off, so the harness can diff browser output against native:
//
//   node tools/wasm_render.ts in.wav out.wav [--drive 0..10] [--block 128]
//        [--pedal file.cir [--knob name=0..1 ...]]
//        [--amp amps/x.cir [--ampknob name=0..1 ...]] [--bench]
//
// --bench prints the real-time load (CPU time / audio time) of the run,
// the closest offline stand-in for the AudioWorklet's budget in Chrome.
//
// Reads/writes 16/24-bit PCM WAV. Runs under Node's built-in type stripping.

import { readFileSync, writeFileSync } from 'node:fs';
import { Engine, Param } from '../web/src/engine.ts';
import { readWav, type Wav } from './wav.ts';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? Number(process.argv[i + 1]) : fallback;
}

function writeWav24(path: string, { sampleRate, channels }: Wav): void {
  const n = channels[0].length, ch = channels.length, dataSize = n * ch * 3;
  const b = Buffer.alloc(44 + dataSize);
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataSize, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * ch * 3, 28);
  b.writeUInt16LE(ch * 3, 32); b.writeUInt16LE(24, 34);
  b.write('data', 36); b.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      // Same rounding as JUCE's 24-bit writer: scale by 0x7fffff and round.
      const v = Math.max(-8388608, Math.min(8388607, Math.round(channels[c][i] * 8388607)));
      b.writeIntLE(v, 44 + (i * ch + c) * 3, 3);
    }
  writeFileSync(path, b);
}

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('usage: node tools/wasm_render.ts in.wav out.wav [--drive 0..10] [--block 128]');
  process.exit(2);
}

const wasmPath = new URL('../web/public/engine.wasm', import.meta.url);
const module = new WebAssembly.Module(readFileSync(wasmPath));
const wav = readWav(inPath);
const block = arg('--block', 128);

const engine = new Engine(module, wav.sampleRate, block, wav.channels.length);
engine.setParam(Param.drive, arg('--drive', 0) / 10);

// A circuit file's knob positions: its defaults, overridden by `flag name=v`.
function knobsFor(text: Buffer, flag: string): number[] {
  const names = [...text.toString().matchAll(/^\*@control\s+(\S+).*?default=([\d.]+)/gim)];
  const knobs = names.map(([, , def]) => Number(def));
  process.argv.forEach((a, i) => {
    if (a !== flag) return;
    const [k, v] = process.argv[i + 1].split('=');
    const idx = names.findIndex(([, n]) => n.toLowerCase() === k.toLowerCase());
    if (idx < 0) throw new Error(`no control ${k}`);
    knobs[idx] = Number(v);
  });
  return knobs;
}

const pedalPath = process.argv.includes('--pedal') ? process.argv[process.argv.indexOf('--pedal') + 1] : null;
if (pedalPath) {
  const text = readFileSync(pedalPath);
  const err = engine.loadPedal(0, new Uint8Array(text), knobsFor(text, '--knob'));
  if (err) throw new Error(`${pedalPath}: ${err}`);
}
const ampPath = process.argv.includes('--amp') ? process.argv[process.argv.indexOf('--amp') + 1] : null;
if (ampPath) {
  const text = readFileSync(ampPath);
  const err = engine.loadAmp(new Uint8Array(text), knobsFor(text, '--ampknob'));
  if (err) throw new Error(`${ampPath}: ${err}`);
}
const t0 = performance.now();

const total = wav.channels[0].length;
for (let start = 0; start < total; start += block) {
  const len = Math.min(block, total - start);
  wav.channels.forEach((data, c) => engine.channel(c).set(data.subarray(start, start + len)));
  engine.process(len);
  wav.channels.forEach((data, c) => data.set(engine.channel(c).subarray(0, len), start));
}

const cpuSeconds = (performance.now() - t0) / 1000;
writeWav24(outPath, wav);
if (process.argv.includes('--bench'))
  console.log(`realtime load ${((cpuSeconds / (total / wav.sampleRate)) * 100).toFixed(2)} %`);
console.log(`wasm rendered ${total} samples @ ${wav.sampleRate} Hz, latency ${engine.latency()} samples`);
