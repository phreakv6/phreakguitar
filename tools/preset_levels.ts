// Measures each factory preset's loudness: dry guitar -> gate, comp, pedals, amp (pre engine)
// -> cab IR -> EQ, delay, reverb (post engine), with the preset level left out.
//   node tools/preset_levels.ts <from> <to> <out.jsonl> dry1.wav dry2.wav ...
// Writes one line per preset: its level now and its loudness (LUFS) for each take with
// the level left out. Equal loudness: level = target - mean(loud).
import { readFileSync, appendFileSync } from 'node:fs';
const R = new URL('../', import.meta.url).pathname;
const { Engine, Param } = await import(R + 'web/src/engine.ts');
const { factoryPresets } = await import(R + 'web/src/presets.ts');
const { allEffects } = await import(R + 'web/src/postfx.ts');
const { irLevelMatchGain } = await import(R + 'web/src/irlevel.ts');
const { readWav } = await import(R + 'tools/wav.ts');

const SR = 48000, BLOCK = 128;
const [from, to, outPath, ...inputs] = process.argv.slice(2);
const module = new WebAssembly.Module(readFileSync(R + 'web/public/engine.wasm'));
const cabOf: Record<string, number> = { 'tweed-bass': 0, 'blackpanel-22': 2, 'blackpanel-410': 0, 'blackpanel-100': 2, 'brit-45': 1, 'brit-plexi': 1,
  'brit-800': 1, 'brit-clean-100': 1, 'graphic-120': 1, 'hotrod-100': 1, 'boutique-ods': 2, 'classa-30': 2 };
const irFiles = ['ir_tweed410.wav', 'ir_brit412.wav', 'ir_black112.wav'];

function resample(x: Float32Array, fromRate: number): Float32Array {
  if (fromRate === SR) return x;
  const n = Math.floor((x.length * SR) / fromRate), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = (i * fromRate) / SR, k = Math.floor(p), f = p - k; y[i] = x[k] * (1 - f) + (x[Math.min(k + 1, x.length - 1)] ?? 0) * f; }
  return y;
}
const irs = irFiles.map((f) => { const w = readWav(R + 'resources/irs/' + f); const ch = w.channels.slice(0, 1).map((c) => resample(c, w.sampleRate)); const g = irLevelMatchGain(ch, SR); return ch[0].map((v) => v * g); });

// FFT convolution (radix-2, in place).
function fft(re: Float64Array, im: Float64Array, inv: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inv ? -2 : 2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2; const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
function convolve(x: Float32Array, h: Float32Array): Float32Array {
  let n = 1; while (n < x.length + h.length) n <<= 1;
  const ar = new Float64Array(n), ai = new Float64Array(n), br = new Float64Array(n), bi = new Float64Array(n);
  ar.set(x); br.set(h); fft(ar, ai, false); fft(br, bi, false);
  for (let i = 0; i < n; i++) { const r = ar[i] * br[i] - ai[i] * bi[i]; ai[i] = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = r; }
  fft(ar, ai, true);
  return Float32Array.from(ar.subarray(0, x.length));
}

// BS.1770 integrated loudness (K-weighting, gated), 48 kHz.
function lufs(chs: Float32Array[]): number {
  const kw = (x: Float32Array) => { const y = new Float64Array(x.length);
    let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = 1.53512485958697 * x[i] - 2.69169618940638 * a1 + 1.19839281085285 * a2 + 1.69065929318241 * b1 - 0.73248077421585 * b2;
      a2 = a1; a1 = x[i]; b2 = b1; b1 = v;
      const w = v - 2 * c1 + c2 + 1.99004745483398 * d1 - 0.99007225036621 * d2;
      c2 = c1; c1 = v; d2 = d1; d1 = w; y[i] = w; }
    return y; };
  const k = chs.map(kw), win = 0.4 * SR, hop = 0.1 * SR, blocks: number[] = [];
  for (let s = 0; s + win <= k[0].length; s += hop) { let p = 0; for (const c of k) { let q = 0; for (let i = s; i < s + win; i++) q += c[i] * c[i]; p += q / win; } blocks.push(p); }
  const L = (p: number) => -0.691 + 10 * Math.log10(p + 1e-20), mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const g1 = blocks.filter((p) => L(p) > -70), rel = L(mean(g1)) - 10;
  return L(mean(g1.filter((p) => L(p) > rel)));
}

const dry = inputs.map((f) => { const w = readWav(f); return resample(w.channels[0], w.sampleRate); });
const PAD = 30; // measure with the output 30 dB down, clear of the limiter

for (let pi = Number(from); pi < Number(to) && pi < factoryPresets.length; pi++) {
  const p = factoryPresets[pi];
  const loud: number[] = [];
  for (const x of dry) {
    const pre = new Engine(module, SR, BLOCK, 1), post = new Engine(module, SR, BLOCK, 2);
    pre.setParam(Param.inputDb, 0); pre.setParam(Param.gateOn, p.gate.on ? 1 : 0); pre.setParam(Param.gateDb, p.gate.db);
    post.setParam(Param.outputDb, -PAD);
    for (const fx of allEffects) {
      const st = p.fx[fx.id], eng = fx.stage === 'pre' ? pre : post;
      eng.setFxEnabled(fx.index, !!st?.on);
      fx.controls.forEach((c: { name: string; defaultValue: number }, i: number) => eng.setFxControl(fx.index, i, st?.values[c.name] ?? c.defaultValue));
    }
    const knobs = (text: string, vals: Record<string, number>) => [...text.matchAll(/^\*@control\s+(\S+)(.*)$/gim)].map(([, n, rest]) =>
      vals[n.toLowerCase()] ?? Number(/default=([\d.]+)/i.exec(rest)?.[1] ?? 0.5));
    p.pedals.forEach((s: { id: string; on: boolean; knobs: Record<string, number> } | null, slot: number) => {
      if (!s) return;
      const text = readFileSync(R + 'pedals/' + s.id + '.cir', 'utf8');
      const err = pre.loadPedal(slot, new TextEncoder().encode(text), knobs(text, s.knobs));
      if (err) throw new Error(`${p.name}: ${s.id}: ${err}`);
      pre.setPedalEnabled(slot, s.on);
    });
    const ampText = readFileSync(R + 'amps/' + p.amp + '.cir', 'utf8');
    const err = pre.loadAmp(new TextEncoder().encode(ampText), knobs(ampText, p.ampKnobs));
    if (err) throw new Error(`${p.name}: amp: ${err}`);
    const mono = new Float32Array(x.length);
    for (let s = 0; s < x.length; s += BLOCK) { const n = Math.min(BLOCK, x.length - s); pre.channel(0).set(x.subarray(s, s + n)); pre.processPre(n); mono.set(pre.channel(0).subarray(0, n), s); }
    const cab = p.cab === 'off' ? mono : convolve(mono, irs[/^builtin:(\d)/.test(p.cab) ? Number(p.cab.slice(8)) : cabOf[p.amp]]);
    const L = new Float32Array(x.length), Rr = new Float32Array(x.length);
    for (let s = 0; s < x.length; s += BLOCK) { const n = Math.min(BLOCK, x.length - s);
      post.channel(0).set(cab.subarray(s, s + n)); post.channel(1).set(cab.subarray(s, s + n)); post.processPost(n);
      L.set(post.channel(0).subarray(0, n), s); Rr.set(post.channel(1).subarray(0, n), s); }
    loud.push(lufs([L, Rr]) + PAD);
    pre.dispose(); post.dispose();
  }
  appendFileSync(outPath, JSON.stringify({ i: pi, name: p.name, level: p.level ?? 0, loud }) + '\n');
}
