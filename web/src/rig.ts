// The browser audio graph:
//
//   interface in ─► splitter ─(chosen channel)─► [phreak-amp pre] ─► ConvolverNode (cab)
//                                                       │                 │
//                                                       └──(cab off)──────┤
//                                                                         ▼
//                                     interface out ◄─ [phreak-amp post] ◄┘
//
// pre/post are two instances of the same WASM engine (engine/amp/AmpChain),
// split around the cab exactly like the native HostChain.

import { Param, numPedalSlots, type LooperStatus } from './engine.ts';
import { irLevelMatchGain } from './irlevel.ts';
import type { AmpMessage, AmpProcessorOptions, AmpReport } from './worklet/amp-processor.ts';
import type { LoopbackReport } from './worklet/loopback-processor.ts';
import ampProcessorUrl from './worklet/amp-processor.ts?worker&url';
import loopbackProcessorUrl from './worklet/loopback-processor.ts?worker&url';

export interface Meters {
  inputPeak: number;
  outputPeak: number;
  limiterGain: number;
  pedalFaults: number;
  pedalNewtonFailures: number;
}

/** Per-device activity for the circuit view: names and values align. */
export interface PedalActivity {
  devices: string[];
  values: Float32Array;
}

/** The amp's preamp devices, how hard the power tubes work (0..1), and
    its B+ (volts, lowest since the last report). */
export interface AmpActivity extends PedalActivity {
  power: number;
  supply: number;
}

export interface LatencyEstimate {
  baseMs: number;    // AudioContext processing buffer
  outputMs: number;  // OS / device output path
  inputMs: number | null; // as reported by the input track, if at all
  engineMs: number;  // oversampler group delay
}

export interface GlitchStats {
  dropouts: number;
  runningSeconds: number;
}

export interface RigOptions {
  inputDeviceId?: string;
  inputChannel: number; // 0-based
  outputDeviceId?: string;
  /** 'low' asks Chrome for its smallest buffer (latencyHint 0): about 3 ms
      less on a Mac, with less margin before dropouts. */
  buffer: 'standard' | 'low';
  /** Called with the new AudioContext before anything waits on it: after a
      reload the browser keeps it suspended until the page gets a click,
      so the caller can resume it from one. */
  onContext?: (ctx: AudioContext) => void;
}

type SinkContext = AudioContext & { setSinkId?: (id: string) => Promise<void> };

// Voice processing off: it is designed for speech and wrecks a guitar
// signal (and adds latency).
const rawAudio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

export class Rig {
  readonly ctx: SinkContext;
  onMeters: (m: Meters) => void = () => {};
  /** The looper's state, ~30x a second. */
  onLooper: (s: LooperStatus) => void = () => {};
  onPedalActivity: (slot: number, a: PedalActivity) => void = () => {};
  /** The designer's probe: the last ~85 ms at the probed node (volts). */
  onProbe: (slot: number, node: string, samples: Float32Array) => void = () => {};
  /** Probe answers: whether the node exists in that slot's pedal. */
  onProbeSet: (slot: number, node: string, ok: boolean) => void = () => {};
  onAmpActivity: (a: AmpActivity) => void = () => {};
  private pedalDevices: string[][] = Array.from({ length: numPedalSlots }, () => []);
  private ampDevices: string[] = [];
  private ampReply: ((r: { error: string | null }) => void) | null = null;

  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private tuner: AnalyserNode | null = null;
  private readonly pre: AudioWorkletNode;
  private readonly post: AudioWorkletNode;
  private readonly cab: ConvolverNode;
  private cabOn = false;
  private inputChannel = 1;
  private engineLatencyFrames = 0;
  private lastPre = { inputPeak: 0, pedalFaults: 0, pedalNewtonFailures: 0 };
  // Per slot, in request order: the worklet answers loads in order.
  private pedalReplies: ((r: { error: string | null }) => void)[][] = Array.from({ length: numPedalSlots }, () => []);
  private captureReplies: Partial<Record<'pre' | 'post', (r: { endFrame: number; samples: Float32Array }) => void>> = {};
  private glitches = newGlitchState();
  private glitchTimer = 0;
  /** Recent raw clock-lag samples (s), for tuning the dropout estimate. */
  readonly lagHistory: number[] = [];

  private constructor(ctx: SinkContext, pre: AudioWorkletNode, post: AudioWorkletNode, engineLatency: number) {
    this.ctx = ctx;
    this.pre = pre;
    this.post = post;
    this.engineLatencyFrames = engineLatency;
    this.cab = new ConvolverNode(ctx, { disableNormalization: true, channelCount: 1, channelCountMode: 'explicit' });

    this.pre.port.onmessage = (e: MessageEvent<AmpReport>) => {
      const m = e.data;
      if (m.type === 'meters') {
        this.lastPre = m;
        m.pedalActivity.forEach((values, slot) => {
          const devices = this.pedalDevices[slot];
          if (devices.length === values.length && values.length > 0) this.onPedalActivity(slot, { devices, values });
        });
        if (m.probe) this.onProbe(m.probe.slot, m.probe.node, m.probe.samples);
        if (this.ampDevices.length === m.ampActivity.length && m.ampActivity.length > 0)
          this.onAmpActivity({ devices: this.ampDevices, values: m.ampActivity, power: m.ampPower, supply: m.ampSupply });
      }
      else if (m.type === 'amp-loaded') {
        this.engineLatencyFrames = m.latency;
        this.ampDevices = m.devices;
        this.ampReply?.(m);
        this.ampReply = null;
      }
      else if (m.type === 'capture') this.captureReplies.pre?.(m);
      else if (m.type === 'pedal-loaded') {
        this.engineLatencyFrames = m.latency;
        if (!m.error) this.pedalDevices[m.slot] = m.devices;
        this.pedalReplies[m.slot].shift()?.(m);
      }
      else if (m.type === 'latency') this.engineLatencyFrames = m.latency;
      else if (m.type === 'probe-set') this.onProbeSet(m.slot, m.node, m.ok);
    };
    this.post.port.onmessage = (e: MessageEvent<AmpReport>) => {
      if (e.data.type === 'capture') this.captureReplies.post?.(e.data);
      else if (e.data.type === 'meters') {
        if (e.data.looper) this.onLooper(e.data.looper);
        this.onMeters({
          inputPeak: this.lastPre.inputPeak,
          outputPeak: e.data.outputPeak,
          limiterGain: e.data.limiterGain,
          pedalFaults: this.lastPre.pedalFaults,
          pedalNewtonFailures: this.lastPre.pedalNewtonFailures,
        });
      }
    };

    this.cab.connect(this.post);
    this.post.connect(ctx.destination);
    this.setCab(null);
    this.glitchTimer = window.setInterval(() => this.checkGlitches(), 250);
  }

  // Web Audio doesn't report underruns. Heuristic: the audio clock
  // (contextTime) and the wall clock (performanceTime) advance together;
  // a render that misses its deadline makes the audio clock slip behind
  // for good. On real hardware (Chrome, macOS, Scarlett) the offset is a
  // sawtooth: it creeps down and jumps back ~5.5 ms every ~4.6 s with no
  // net change, so single jumps mean nothing. The sawtooth keeps returning
  // to the same floor, though; a real dropout lifts the floor permanently.
  // So track the minimum over a window longer than the sawtooth period.
  private checkGlitches(): void {
    if (this.ctx.state !== 'running') {
      this.glitches.window = [];
      return;
    }
    const ts = this.ctx.getOutputTimestamp();
    if (ts.contextTime === undefined || ts.performanceTime === undefined || ts.contextTime <= 0) return;
    const lag = ts.performanceTime / 1000 - ts.contextTime;
    this.lagHistory.push(lag);
    if (this.lagHistory.length > 2400) this.lagHistory.splice(0, 1200);

    // Clocks settle for a moment after start/device changes.
    if (performance.now() - this.glitches.startedAt < 2000) return;

    const g = this.glitches;
    g.window.push(lag);
    if (g.window.length > glitchWindow) g.window.shift();
    if (g.window.length < glitchWindow) return;

    const floor = Math.min(...g.window);
    if (!Number.isNaN(g.baseline) && floor - g.baseline > glitchThresholdS) g.dropouts++;
    g.baseline = floor; // also follows slow clock drift between devices
  }

  glitchStats(): GlitchStats {
    return { dropouts: this.glitches.dropouts, runningSeconds: (performance.now() - this.glitches.startedAt) / 1000 };
  }

  resetGlitchStats(): void {
    this.glitches = newGlitchState();
  }

  /** Must be called from a user gesture (autoplay policy). */
  static async start(opts: RigOptions): Promise<Rig> {
    // Run at the interface's own rate. A mismatch (e.g. Scarlett at 44.1 kHz,
    // context at 48 kHz) makes Chrome resample both ways: measured +5.5 ms.
    const sampleRate = await deviceSampleRate(opts.inputDeviceId);
    const ctx: SinkContext = new AudioContext({ latencyHint: opts.buffer === 'low' ? 0 : 'interactive', sampleRate });
    opts.onContext?.(ctx);
    const wasm = await fetch(`${import.meta.env.BASE_URL}engine.wasm`).then((r) => {
      if (!r.ok) throw new Error(`engine.wasm: HTTP ${r.status} (run npm run wasm)`);
      return r.arrayBuffer();
    });
    await ctx.audioWorklet.addModule(ampProcessorUrl);
    await ctx.audioWorklet.addModule(loopbackProcessorUrl);

    const makeStage = async (stage: 'pre' | 'post', channels: number) => {
      const node = new AudioWorkletNode(ctx, 'phreak-amp', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [channels],
        channelCount: channels,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers', // mono (cab off) upmixes to both sides
        processorOptions: { wasmBytes: wasm.slice(0), stage, channels } satisfies AmpProcessorOptions,
      });
      const ready = await new Promise<AmpReport>((resolve) => {
        node.port.onmessage = (e: MessageEvent<AmpReport>) => resolve(e.data);
      });
      return { node, latency: ready.type === 'ready' ? ready.latency : 0 };
    };

    const pre = await makeStage('pre', 1);
    const post = await makeStage('post', 2);
    const rig = new Rig(ctx, pre.node, post.node, pre.latency);

    if (opts.outputDeviceId) await rig.setOutputDevice(opts.outputDeviceId);
    await rig.setInput(opts.inputDeviceId, opts.inputChannel);
    await ctx.resume();
    return rig;
  }

  async setInput(deviceId: string | undefined, channel: number): Promise<void> {
    this.source?.disconnect();
    this.splitter?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...rawAudio,
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: { ideal: 2 },
        latency: { ideal: 0 }, // Chrome honours it; not in TS's DOM types yet
      } as MediaTrackConstraints,
    });
    this.source = new MediaStreamAudioSourceNode(this.ctx, { mediaStream: this.stream });
    this.splitter = new ChannelSplitterNode(this.ctx, { numberOfOutputs: Math.max(2, this.inputChannelCount()) });
    this.source.connect(this.splitter);
    this.inputChannel = Math.min(channel, this.inputChannelCount() - 1);
    this.splitter.connect(this.pre, this.inputChannel);
    if (this.tuner) this.splitter.connect(this.tuner, this.inputChannel);
  }

  /** The dry guitar (before gate and pedals) for the tuner: read it with
      getFloatTimeDomainData. Follows input/channel changes until stopTuner. */
  startTuner(): AnalyserNode {
    if (!this.tuner) {
      this.tuner = new AnalyserNode(this.ctx, { fftSize: 4096 });
      this.splitter?.connect(this.tuner, this.inputChannel);
    }
    return this.tuner;
  }

  stopTuner(): void {
    if (this.tuner && this.splitter) {
      try { this.splitter.disconnect(this.tuner); } catch { /* already gone with the old input */ }
    }
    this.tuner = null;
  }

  /** Channels the current input device actually delivers. */
  inputChannelCount(): number {
    return this.stream?.getAudioTracks()[0]?.getSettings().channelCount ?? 1;
  }

  inputLabel(): string {
    return this.stream?.getAudioTracks()[0]?.label ?? '';
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    if (!this.ctx.setSinkId) throw new Error('This browser cannot choose an output device (needs Chrome/Edge).');
    await this.ctx.setSinkId(deviceId);
  }

  setParam(id: number, value: number): void {
    const target = id === Param.outputDb ? this.post : this.pre;
    target.port.postMessage({ type: 'param', id, value } satisfies AmpMessage);
  }

  setTone(treble: number, mid: number, bass: number): void {
    this.pre.port.postMessage({ type: 'tone', treble, mid, bass } satisfies AmpMessage);
  }

  /** Loads a pedal netlist into pedal slot `slot` (0..3, in front of the
      amp, run in order). Resolves to null, or the parser/solver error (the
      slot keeps what it had). */
  loadPedal(slot: number, netlist: string, knobs: number[]): Promise<string | null> {
    return new Promise((resolve) => {
      this.pedalReplies[slot].push((r) => resolve(r.error));
      const bytes = new TextEncoder().encode(netlist);
      this.pre.port.postMessage({ type: 'pedal-load', slot, netlist: bytes, knobs } satisfies AmpMessage);
    });
  }

  /** Puts a circuit amp in the amp slot; null on success, else the error
      (the previous amp stays). */
  loadAmp(netlist: string, knobs: number[]): Promise<string | null> {
    return new Promise((resolve) => {
      this.ampReply = (r) => resolve(r.error);
      this.pre.port.postMessage({ type: 'amp-load', netlist: new TextEncoder().encode(netlist), knobs } satisfies AmpMessage);
    });
  }

  /** Back to the built-in Tweed '59. */
  unloadAmp(): void {
    this.ampDevices = [];
    this.pre.port.postMessage({ type: 'amp-unload' } satisfies AmpMessage);
  }

  /** DSP effects run on the stage that holds them: the compressor on the
      pre (mono) engine, EQ/delay/reverb on the post (stereo) one. */
  setFxEnabled(fx: number, on: boolean, stage: 'pre' | 'post' = 'post'): void {
    this.node(stage).port.postMessage({ type: 'fx-enable', fx, on } satisfies AmpMessage);
  }

  setFxControl(fx: number, index: number, value: number, stage: 'pre' | 'post' = 'post'): void {
    this.node(stage).port.postMessage({ type: 'fx-control', fx, index, value } satisfies AmpMessage);
  }

  private node(stage: 'pre' | 'post'): AudioWorkletNode {
    return stage === 'pre' ? this.pre : this.post;
  }

  setAmpControl(index: number, value: number): void {
    this.pre.port.postMessage({ type: 'amp-control', index, value } satisfies AmpMessage);
  }

  unloadPedal(slot: number): void {
    this.pedalDevices[slot] = [];
    this.pre.port.postMessage({ type: 'pedal-unload', slot } satisfies AmpMessage);
  }

  setPedalEnabled(slot: number, on: boolean): void {
    this.pre.port.postMessage({ type: 'pedal-enable', slot, on } satisfies AmpMessage);
  }

  /** The looper, on the post stage (after the cab and effects). */
  looperEnable(on: boolean): void { this.post.port.postMessage({ type: 'looper-enable', on } satisfies AmpMessage); }
  looperCommand(cmd: number): void { this.post.port.postMessage({ type: 'looper-cmd', cmd } satisfies AmpMessage); }
  looperGain(gain: number): void { this.post.port.postMessage({ type: 'looper-gain', gain } satisfies AmpMessage); }

  /** Starts probing `node` of slot `slot`'s pedal (null stops). */
  setProbe(slot: number, node: string | null): void {
    this.pre.port.postMessage({ type: 'pedal-probe', slot, node: node ?? '' } satisfies AmpMessage);
  }

  setPedalControl(slot: number, index: number, value: number): void {
    this.pre.port.postMessage({ type: 'pedal-control', slot, index, value } satisfies AmpMessage);
  }

  /** Moves the pedal in slot `from` to `to`, shifting the ones between.
      Pedals keep their state: no re-solve, no glitch. */
  movePedal(from: number, to: number): void {
    const [moved] = this.pedalDevices.splice(from, 1);
    this.pedalDevices.splice(to, 0, moved);
    this.pre.port.postMessage({ type: 'pedal-move', from, to } satisfies AmpMessage);
  }

  /** The last 30 s of dry input and of the output, aligned to end on the
      same frame (the two worklets answer in different render quanta). */
  async capture(): Promise<{ dry: Float32Array; wet: Float32Array; sampleRate: number; endTime: number }> {
    const ask = (stage: 'pre' | 'post', node: AudioWorkletNode) =>
      new Promise<{ endFrame: number; samples: Float32Array }>((resolve) => {
        this.captureReplies[stage] = resolve;
        node.port.postMessage({ type: 'capture' } satisfies AmpMessage);
      });
    const [pre, post] = await Promise.all([ask('pre', this.pre), ask('post', this.post)]);
    const end = Math.min(pre.endFrame, post.endFrame);
    const cut = (r: { endFrame: number; samples: Float32Array }) =>
      r.samples.subarray(0, r.samples.length - (r.endFrame - end));
    const dry = cut(pre), wet = cut(post);
    const n = Math.min(dry.length, wet.length);
    return {
      dry: dry.subarray(dry.length - n),
      wet: wet.subarray(wet.length - n),
      sampleRate: this.ctx.sampleRate,
      endTime: end / this.ctx.sampleRate,
    };
  }

  /** null bypasses the cab. The IR is trimmed and loudness-matched the
      same way as the native cab, so both hosts play at the same level. */
  setCab(ir: AudioBuffer | null): void {
    this.pre.disconnect();
    if (ir) {
      this.cab.buffer = prepareIR(this.ctx, ir);
      this.pre.connect(this.cab);
    } else {
      this.pre.connect(this.post);
    }
    this.cabOn = ir !== null;
  }

  get cabEnabled(): boolean { return this.cabOn; }

  latency(): LatencyEstimate {
    const track = this.stream?.getAudioTracks()[0];
    const inputLatency = (track?.getSettings() as MediaTrackSettings & { latency?: number })?.latency;
    return {
      baseMs: this.ctx.baseLatency * 1000,
      outputMs: (this.ctx.outputLatency ?? 0) * 1000,
      inputMs: typeof inputLatency === 'number' ? inputLatency * 1000 : null,
      engineMs: (this.engineLatencyFrames / this.ctx.sampleRate) * 1000,
    };
  }

  /** Device round trip in ms (median of 8 clicks). The rig is muted while
      measuring so the cable can't make a feedback loop through it. */
  async measureLoopback(): Promise<number> {
    if (!this.splitter) throw new Error('no input');
    const node = new AudioWorkletNode(this.ctx, 'phreak-loopback', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 1,
      channelCountMode: 'explicit',
    });

    this.post.disconnect();
    this.splitter.connect(node, this.inputChannel);
    node.connect(this.ctx.destination);
    try {
      const report = await new Promise<LoopbackReport>((resolve) => {
        node.port.onmessage = (e: MessageEvent<LoopbackReport>) => resolve(e.data);
      });
      if (report.type === 'failed') throw new Error(report.reason);
      const sorted = [...report.delays].sort((a, b) => a - b);
      return (sorted[Math.floor(sorted.length / 2)] / this.ctx.sampleRate) * 1000;
    } finally {
      node.disconnect();
      this.splitter.disconnect(node);
      this.post.connect(this.ctx.destination);
    }
  }

  async stop(): Promise<void> {
    window.clearInterval(this.glitchTimer);
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx.close();
  }
}

const glitchWindow = 48; // 250 ms ticks: 12 s, > 2x the observed sawtooth period
const glitchThresholdS = 0.002; // smallest real slip is a 128-frame quantum (2.7 ms)

function newGlitchState() {
  return { dropouts: 0, startedAt: performance.now(), window: [] as number[], baseline: NaN };
}

/** The input device's native sample rate, or undefined (browser default). */
async function deviceSampleRate(deviceId?: string): Promise<number | undefined> {
  // ?rate=48000 forces a context rate (latency experiments).
  const forced = Number(new URLSearchParams(location.search).get('rate'));
  if (forced >= 22050 && forced <= 192000) return forced;
  const probe = await navigator.mediaDevices.getUserMedia({
    audio: { ...rawAudio, deviceId: deviceId ? { exact: deviceId } : undefined },
  });
  const rate = probe.getAudioTracks()[0]?.getSettings().sampleRate;
  probe.getTracks().forEach((t) => t.stop());
  return rate && rate >= 22050 && rate <= 192000 ? rate : undefined;
}

/** Trim below -80 dB at both ends (as juce::dsp::Convolution's Trim::yes),
    then apply the loudness-matching gain (irlevel.ts, mirrors the engine). */
function prepareIR(ctx: BaseAudioContext, ir: AudioBuffer): AudioBuffer {
  const threshold = 1e-4; // -80 dB
  const chans = Array.from({ length: Math.min(2, ir.numberOfChannels) }, (_, c) => ir.getChannelData(c));

  let begin = ir.length, end = 0;
  for (const data of chans) {
    const first = data.findIndex((v) => Math.abs(v) >= threshold);
    if (first < 0) continue;
    let last = data.length - 1;
    while (last > first && Math.abs(data[last]) < threshold) last--;
    begin = Math.min(begin, first);
    end = Math.max(end, last + 1);
  }
  if (end <= begin) { begin = 0; end = ir.length; }

  const gain = irLevelMatchGain(chans, ir.sampleRate);
  const out = new AudioBuffer({ numberOfChannels: chans.length, length: end - begin, sampleRate: ctx.sampleRate });
  chans.forEach((data, c) => {
    const dst = out.getChannelData(c);
    for (let i = begin; i < end; i++) dst[i - begin] = data[i] * gain;
  });
  return out;
}
