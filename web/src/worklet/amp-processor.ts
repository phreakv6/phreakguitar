// Runs one half of the engine's AmpChain on the audio thread:
//   stage 'pre'  : gate -> input -> drive -> tone stack   (before the cab)
//   stage 'post' : master -> limiter                       (after the cab)
// The cab itself is a ConvolverNode between the two nodes.

import { Engine, Meter, numPedalSlots, type LooperStatus } from '../engine.ts';

export interface AmpProcessorOptions {
  wasmBytes: ArrayBuffer;
  stage: 'pre' | 'post';
  channels: number;
}

export type AmpMessage =
  | { type: 'param'; id: number; value: number }
  | { type: 'tone'; treble: number; mid: number; bass: number }
  | { type: 'pedal-load'; slot: number; netlist: Uint8Array; knobs: number[] }
  | { type: 'pedal-unload'; slot: number }
  | { type: 'pedal-enable'; slot: number; on: boolean }
  | { type: 'pedal-control'; slot: number; index: number; value: number }
  | { type: 'pedal-move'; from: number; to: number }
  | { type: 'pedal-probe'; slot: number; node: string } // node '' stops
  | { type: 'looper-enable'; on: boolean }
  | { type: 'looper-cmd'; cmd: number }
  | { type: 'looper-gain'; gain: number }
  | { type: 'amp-load'; netlist: Uint8Array; knobs: number[] }
  | { type: 'amp-unload' }
  | { type: 'amp-control'; index: number; value: number }
  | { type: 'fx-enable'; fx: number; on: boolean }
  | { type: 'fx-control'; fx: number; index: number; value: number }
  | { type: 'capture' };

export type AmpReport =
  | { type: 'ready'; latency: number }
  | { type: 'pedal-loaded'; slot: number; error: string | null; latency: number; devices: string[] }
  | { type: 'latency'; latency: number } // after a pedal is bypassed, removed or moved
  | { type: 'probe-set'; slot: number; node: string; ok: boolean }
  | { type: 'amp-loaded'; error: string | null; latency: number; devices: string[] }
  | { type: 'capture'; stage: 'pre' | 'post'; endFrame: number; samples: Float32Array }
  | {
      type: 'meters';
      inputPeak: number;
      outputPeak: number;
      limiterGain: number;
      pedalFaults: number;
      pedalNewtonFailures: number;
      pedalActivity: Float32Array[]; // per slot
      ampActivity: Float32Array;
      ampPower: number;
      ampSupply: number; // B+ volts, lowest since the last report
      probe?: { slot: number; node: string; samples: Float32Array };
      looper?: LooperStatus; // post stage
    };

const maxBlock = 1024; // render quantum is 128; leave room for renderSizeHint
const meterIntervalFrames = Math.round(sampleRate / 30);
const captureSeconds = 30;

class AmpProcessor extends AudioWorkletProcessor {
  private readonly engine: Engine;
  private readonly stage: 'pre' | 'post';
  private framesSinceReport = 0;
  private inPeak = 0;
  private outPeak = 0;
  private minLimiterGain = 1;
  // Rolling recording of the last 30 s: the dry input at 'pre', what the
  // player hears at 'post' (channel 0). Saved on request for diagnosis.
  private readonly ring = new Float32Array(Math.round(captureSeconds * sampleRate));
  private ringPos = 0;
  // The pedal designer's probe: which slot and node, if any.
  // Kept even while the node can't be found (the pedal may not be loaded
  // yet): each load tries it again. ok: it's live.
  private probe: { slot: number; node: string; ok: boolean } | null = null;
  private endFrame = 0; // context frame just after the last recorded sample

  constructor(options: AudioWorkletNodeOptions) {
    super(options);
    const opts = options.processorOptions as AmpProcessorOptions;
    this.stage = opts.stage;
    this.engine = new Engine(new WebAssembly.Module(opts.wasmBytes), sampleRate, maxBlock, opts.channels);

    this.port.onmessage = (e: MessageEvent<AmpMessage>) => {
      const m = e.data;
      switch (m.type) {
        case 'param': this.engine.setParam(m.id, m.value); break;
        case 'tone': this.engine.setTone(m.treble, m.mid, m.bass); break;
        case 'pedal-control': this.engine.setPedalControl(m.slot, m.index, m.value); break;
        case 'looper-enable': this.engine.looperEnable(m.on); break;
        case 'looper-cmd': this.engine.looperCommand(m.cmd); break;
        case 'looper-gain': this.engine.looperGain(m.gain); break;
        case 'pedal-probe': {
          if (this.probe) this.engine.setPedalProbe(this.probe.slot, '');
          const ok = m.node === '' || this.engine.setPedalProbe(m.slot, m.node);
          this.probe = m.node ? { slot: m.slot, node: m.node, ok } : null;
          this.port.postMessage({ type: 'probe-set', slot: m.slot, node: m.node, ok } satisfies AmpReport);
          break;
        }
        case 'pedal-enable':
        case 'pedal-unload':
        case 'pedal-move':
          if (m.type === 'pedal-enable') this.engine.setPedalEnabled(m.slot, m.on);
          else if (m.type === 'pedal-unload') this.engine.unloadPedal(m.slot);
          else this.engine.movePedal(m.from, m.to);
          if (m.type !== 'pedal-enable' && this.probe) {
            // The UI re-asks for it; until then, nothing.
            this.engine.setPedalProbe(this.probe.slot, '');
            this.probe = null;
          }
          this.port.postMessage({ type: 'latency', latency: this.engine.latency() } satisfies AmpReport);
          break;
        case 'amp-control': this.engine.setAmpControl(m.index, m.value); break;
        case 'fx-enable': this.engine.setFxEnabled(m.fx, m.on); break;
        case 'fx-control': this.engine.setFxControl(m.fx, m.index, m.value); break;
        case 'amp-unload': this.engine.unloadAmp(); break;
        case 'amp-load': {
          const error = this.engine.loadAmp(m.netlist, m.knobs);
          this.port.postMessage({
            type: 'amp-loaded',
            error,
            latency: this.engine.latency(),
            devices: error ? [] : this.engine.ampDeviceNames(),
          } satisfies AmpReport);
          break;
        }
        case 'capture': {
          const samples = new Float32Array(this.ring.length);
          samples.set(this.ring.subarray(this.ringPos));
          samples.set(this.ring.subarray(0, this.ringPos), this.ring.length - this.ringPos);
          this.port.postMessage(
            { type: 'capture', stage: this.stage, endFrame: this.endFrame, samples } satisfies AmpReport,
            [samples.buffer],
          );
          break;
        }
        case 'pedal-load': {
          // Builds and biases the circuit here, on the audio thread: a
          // one-off glitch at load time, never during play.
          const error = this.engine.loadPedal(m.slot, m.netlist, m.knobs);
          // A re-loaded pedal (a designer edit) keeps its probe if the node's still there.
          if (this.probe?.slot === m.slot) this.probe.ok = this.engine.setPedalProbe(m.slot, this.probe.node);
          this.port.postMessage({
            type: 'pedal-loaded',
            slot: m.slot,
            error,
            latency: this.engine.latency(),
            devices: error ? [] : this.engine.pedalDeviceNames(m.slot),
          } satisfies AmpReport);
          break;
        }
      }
    };
    this.port.postMessage({ type: 'ready', latency: this.engine.latency() } satisfies AmpReport);
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];
    const output = outputs[0];
    const total = output[0].length;

    for (let start = 0; start < total; start += maxBlock) {
      const n = Math.min(maxBlock, total - start);
      for (let c = 0; c < this.engine.numChannels; c++) {
        const buf = this.engine.channel(c);
        // An unconnected input arrives with zero channels: feed silence.
        const src = input[c] ?? input[0];
        if (src) buf.set(src.subarray(start, start + n));
        else buf.fill(0, 0, n);
      }
      if (this.stage === 'pre') this.record(this.engine.channel(0), n);

      if (this.stage === 'pre') this.engine.processPre(n);
      else this.engine.processPost(n);

      for (let c = 0; c < output.length; c++)
        output[c].set(this.engine.channel(Math.min(c, this.engine.numChannels - 1)).subarray(0, n), start);
      if (this.stage === 'post') this.record(this.engine.channel(0), n);

      this.inPeak = Math.max(this.inPeak, this.engine.meter(Meter.inputPeak));
      this.outPeak = Math.max(this.outPeak, this.engine.meter(Meter.outputPeak));
      this.minLimiterGain = Math.min(this.minLimiterGain, this.engine.meter(Meter.limiterGain));
    }

    this.endFrame = currentFrame + total; // the context's clock: shared by both stages
    this.framesSinceReport += total;
    if (this.framesSinceReport >= meterIntervalFrames) {
      this.port.postMessage({
        type: 'meters',
        inputPeak: this.inPeak,
        outputPeak: this.outPeak,
        limiterGain: this.minLimiterGain,
        pedalFaults: this.engine.meter(Meter.pedalFaults),
        pedalNewtonFailures: this.engine.meter(Meter.pedalNewtonFailures),
        pedalActivity: Array.from({ length: numPedalSlots }, (_, slot) => this.engine.pedalActivity(slot)),
        ampActivity: this.engine.ampActivity(),
        ampPower: this.engine.ampPowerLevel(),
        ampSupply: this.engine.ampSupplyVolts(),
        ...(this.stage === 'post' ? { looper: this.engine.looperStatus() } : {}),
        ...(this.probe?.ok
          ? { probe: { slot: this.probe.slot, node: this.probe.node, samples: this.engine.pedalProbeData(this.probe.slot) } }
          : {}),
      } satisfies AmpReport);
      this.framesSinceReport = 0;
      this.inPeak = this.outPeak = 0;
      this.minLimiterGain = 1;
    }
    return true;
  }

  private record(data: Float32Array, n: number): void {
    for (let i = 0; i < n; i++) {
      this.ring[this.ringPos] = data[i];
      if (++this.ringPos === this.ring.length) this.ringPos = 0;
    }
  }
}

registerProcessor('phreak-amp', AmpProcessor);
