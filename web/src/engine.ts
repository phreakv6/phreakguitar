// Thin wrapper over engine.wasm (engine/wasm/api.cpp). Shared by the
// AudioWorklet and the Node golden harness (tools/wasm_render.ts), so it
// uses only erasable TypeScript (no enums) and no DOM or Node APIs.

// Keep in sync with engine/wasm/api.cpp.
export const Param = {
  inputDb: 0,
  drive: 1, // 0..1
  outputDb: 2,
  gateOn: 3, // 0/1
  gateDb: 4,
} as const;

/** Pedal slots in front of the amp (engine AmpChain::numPedalSlots). */
export type LooperState = 'off' | 'empty' | 'recording' | 'playing' | 'overdubbing' | 'stopped';
const looperStates: LooperState[] = ['off', 'empty', 'recording', 'playing', 'overdubbing', 'stopped'];
export interface LooperStatus { state: LooperState; canUndo: boolean; canRedo: boolean; length: number; position: number }

/** Probe samples kept per pedal (engine Pedal::probeLength). */
export const probeLength = 4096;
export const numPedalSlots = 4;

export const Meter = {
  inputPeak: 0,
  outputPeak: 1,
  limiterGain: 2,
  pedalFaults: 3, // guard resets since load
  pedalNewtonFailures: 4, // samples whose circuit solve hit the iteration cap
} as const;

interface EngineExports {
  memory: WebAssembly.Memory;
  _initialize(): void;
  pr_create(sampleRate: number, maxBlock: number, numChannels: number): number;
  pr_destroy(inst: number): void;
  pr_channel(inst: number, ch: number): number;
  pr_process_pre(inst: number, n: number): void;
  pr_process_post(inst: number, n: number): void;
  pr_process(inst: number, n: number): void;
  pr_set_param(inst: number, id: number, value: number): void;
  pr_set_tone(inst: number, treble: number, mid: number, bass: number): void;
  pr_meter(inst: number, id: number): number;
  pr_latency(inst: number): number;
  pr_alloc(bytes: number): number;
  pr_free(ptr: number): void;
  pr_pedal_load(inst: number, slot: number, text: number, len: number, knobs: number, numKnobs: number): number;
  pr_pedal_unload(inst: number, slot: number): void;
  pr_pedal_error(inst: number): number;
  pr_pedal_enable(inst: number, slot: number, on: number): void;
  pr_pedal_control(inst: number, slot: number, index: number, value: number): void;
  pr_pedal_move(inst: number, from: number, to: number): void;
  pr_pedal_device_count(inst: number, slot: number): number;
  pr_pedal_device_name(inst: number, slot: number, d: number): number;
  pr_pedal_activity(inst: number, slot: number): number;
  pr_pedal_probe(inst: number, slot: number, text: number, len: number): number;
  pr_looper_enable(inst: number, on: number): void;
  pr_looper_command(inst: number, cmd: number): void;
  pr_looper_gain(inst: number, g: number): void;
  pr_looper_state(inst: number): number;
  pr_looper_length(inst: number): number;
  pr_looper_position(inst: number): number;
  pr_pedal_probe_data(inst: number, slot: number): number;
  pr_amp_load(inst: number, text: number, len: number, knobs: number, numKnobs: number): number;
  pr_amp_unload(inst: number): void;
  pr_amp_control(inst: number, index: number, value: number): void;
  pr_amp_device_count(inst: number): number;
  pr_amp_device_name(inst: number, d: number): number;
  pr_amp_activity(inst: number): number;
  pr_amp_power_level(inst: number): number;
  pr_amp_supply_volts(inst: number): number;
  pr_fx_enable(inst: number, fx: number, on: number): void;
  pr_fx_control(inst: number, fx: number, index: number, value: number): void;
}

// Standalone WASM still imports a few WASI stdio calls (only reachable on
// abort paths). Satisfy every import with a no-op so instantiation never
// depends on which ones the toolchain happened to emit.
function stubImports(module: WebAssembly.Module): WebAssembly.Imports {
  const imports: Record<string, Record<string, () => number>> = {};
  for (const imp of WebAssembly.Module.imports(module)) {
    if (imp.kind !== 'function') continue;
    (imports[imp.module] ??= {})[imp.name] = () => 0;
  }
  return imports;
}

/** One AmpChain instance with its own channel buffers. Synchronous
    instantiation: fine off the main thread (worklet, Node). */
export class Engine {
  private readonly x: EngineExports;
  private readonly inst: number;
  private views: Float32Array[] = [];
  private viewBuffer: ArrayBuffer | null = null;
  readonly maxBlock: number;
  readonly numChannels: number;

  constructor(module: WebAssembly.Module, sampleRate: number, maxBlock: number, numChannels: number) {
    this.maxBlock = maxBlock;
    this.numChannels = numChannels;
    const instance = new WebAssembly.Instance(module, stubImports(module));
    this.x = instance.exports as unknown as EngineExports;
    this.x._initialize();
    this.inst = this.x.pr_create(sampleRate, maxBlock, numChannels);
  }

  /** Float32Array view of a channel's block buffer (maxBlock samples). */
  channel(ch: number): Float32Array {
    // Views detach if memory ever grows; rebuild lazily.
    if (this.viewBuffer !== this.x.memory.buffer) {
      this.viewBuffer = this.x.memory.buffer;
      this.views = [];
      for (let c = 0; c < this.numChannels; c++) {
        const ptr = this.x.pr_channel(this.inst, c);
        this.views.push(new Float32Array(this.viewBuffer, ptr, this.maxBlock));
      }
    }
    return this.views[ch];
  }

  processPre(n: number): void { this.x.pr_process_pre(this.inst, n); }
  processPost(n: number): void { this.x.pr_process_post(this.inst, n); }
  process(n: number): void { this.x.pr_process(this.inst, n); }

  setParam(id: number, value: number): void { this.x.pr_set_param(this.inst, id, value); }
  setTone(treble: number, mid: number, bass: number): void {
    this.x.pr_set_tone(this.inst, treble, mid, bass);
  }

  meter(id: number): number { return this.x.pr_meter(this.inst, id); }
  latency(): number { return this.x.pr_latency(this.inst); }

  /** Loads a pedal netlist (UTF-8 bytes) into pedal slot `slot` (0..3,
      run in order) with initial knob positions. Returns null on success or
      the parser/solver's error. */
  loadPedal(slot: number, netlist: Uint8Array, knobs: number[]): string | null {
    return this.loadInto((inst, t, l, k, n) => this.x.pr_pedal_load(inst, slot, t, l, k, n), netlist, knobs);
  }

  /** Loads a circuit amp (amps/<name>.cir) into the amp slot. */
  loadAmp(netlist: Uint8Array, knobs: number[]): string | null {
    return this.loadInto(this.x.pr_amp_load, netlist, knobs);
  }

  unloadAmp(): void { this.x.pr_amp_unload(this.inst); }
  setAmpControl(index: number, value01: number): void { this.x.pr_amp_control(this.inst, index, value01); }

  ampDeviceNames(): string[] {
    const n = this.x.pr_amp_device_count(this.inst);
    return Array.from({ length: n }, (_, d) => this.cString(this.x.pr_amp_device_name(this.inst, d)));
  }

  ampActivity(): Float32Array {
    const n = this.x.pr_amp_device_count(this.inst);
    if (n === 0) return new Float32Array(0);
    return new Float32Array(this.x.memory.buffer, this.x.pr_amp_activity(this.inst), n).slice();
  }

  /** The power tubes' drive since the last call, 0..1. */
  ampPowerLevel(): number {
    return this.x.pr_amp_power_level(this.inst);
  }

  /** The amp's B+ (volts): lowest since the last call, 0 without a circuit amp. */
  ampSupplyVolts(): number {
    return this.x.pr_amp_supply_volts(this.inst);
  }

  private loadInto(
    load: (inst: number, text: number, len: number, knobs: number, n: number) => number,
    netlist: Uint8Array, knobs: number[],
  ): string | null {
    const textPtr = this.x.pr_alloc(netlist.length + 1);
    const knobPtr = this.x.pr_alloc(Math.max(1, knobs.length) * 4);
    new Uint8Array(this.x.memory.buffer, textPtr, netlist.length).set(netlist);
    new Float32Array(this.x.memory.buffer, knobPtr, knobs.length).set(knobs);
    const ok = load(this.inst, textPtr, netlist.length, knobPtr, knobs.length);
    this.x.pr_free(textPtr);
    this.x.pr_free(knobPtr);
    if (ok) return null;
    return this.cString(this.x.pr_pedal_error(this.inst)) || 'unknown error';
  }

  // No TextDecoder in AudioWorkletGlobalScope: the strings are ASCII.
  private cString(ptr: number): string {
    const bytes = new Uint8Array(this.x.memory.buffer, ptr);
    let s = '';
    for (let i = 0; bytes[i] !== 0 && i < 1000; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  /** A slot's pedal: its diodes and transistors, in activity order. */
  pedalDeviceNames(slot: number): string[] {
    const n = this.x.pr_pedal_device_count(this.inst, slot);
    return Array.from({ length: n }, (_, d) => this.cString(this.x.pr_pedal_device_name(this.inst, slot, d)));
  }

  /** Peak activity per device since the last call (see DKSolver::takeActivity). */
  pedalActivity(slot: number): Float32Array {
    const n = this.x.pr_pedal_device_count(this.inst, slot);
    if (n === 0) return new Float32Array(0);
    return new Float32Array(this.x.memory.buffer, this.x.pr_pedal_activity(this.inst, slot), n).slice();
  }

  /** Probes node `node` (netlist name) of slot `slot`'s pedal; '' stops.
      False if there's no such node. */
  setPedalProbe(slot: number, node: string): boolean {
    const ptr = this.x.pr_alloc(node.length + 1);
    const bytes = new Uint8Array(this.x.memory.buffer, ptr, node.length);
    for (let i = 0; i < node.length; i++) bytes[i] = node.charCodeAt(i) & 0x7f;
    const ok = this.x.pr_pedal_probe(this.inst, slot, ptr, node.length);
    this.x.pr_free(ptr);
    return ok !== 0;
  }

  /** The probe's last probeLength samples (volts), oldest first. */
  pedalProbeData(slot: number): Float32Array {
    const ptr = this.x.pr_pedal_probe_data(this.inst, slot);
    return ptr ? new Float32Array(this.x.memory.buffer, ptr, probeLength).slice() : new Float32Array(0);
  }

  /** The looper (post stage). Enabling reserves its memory (~46 MB). */
  looperEnable(on: boolean): void { this.x.pr_looper_enable(this.inst, on ? 1 : 0); }
  /** 0 record / play / overdub, 1 stop / start, 2 undo / redo, 3 clear. */
  looperCommand(cmd: number): void { this.x.pr_looper_command(this.inst, cmd); }
  looperGain(g: number): void { this.x.pr_looper_gain(this.inst, g); }
  looperStatus(): LooperStatus {
    const s = this.x.pr_looper_state(this.inst);
    return {
      state: looperStates[s & 7] ?? 'off',
      canUndo: (s & 8) !== 0,
      canRedo: (s & 16) !== 0,
      length: this.x.pr_looper_length(this.inst),
      position: this.x.pr_looper_position(this.inst),
    };
  }

  unloadPedal(slot: number): void { this.x.pr_pedal_unload(this.inst, slot); }
  setPedalEnabled(slot: number, on: boolean): void { this.x.pr_pedal_enable(this.inst, slot, on ? 1 : 0); }
  setPedalControl(slot: number, index: number, value01: number): void {
    this.x.pr_pedal_control(this.inst, slot, index, value01);
  }
  /** Moves a pedal to another slot, shifting the ones between (state kept). */
  movePedal(from: number, to: number): void { this.x.pr_pedal_move(this.inst, from, to); }

  /** After-the-amp effects: 0 = EQ, 1 = delay, 2 = reverb. */
  setFxEnabled(fx: number, on: boolean): void { this.x.pr_fx_enable(this.inst, fx, on ? 1 : 0); }
  setFxControl(fx: number, index: number, value01: number): void { this.x.pr_fx_control(this.inst, fx, index, value01); }

  dispose(): void { this.x.pr_destroy(this.inst); }
}
