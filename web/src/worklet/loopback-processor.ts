// Round-trip latency measurement. Emits a train of clicks and finds each
// one in the input (patch interface output -> input with a cable). Both
// happen in the same render callback, so the measured offset is exactly
// the device round trip: output latency + input latency + any buffering.

export type LoopbackReport =
  | { type: 'result'; delays: number[] } // frames, one per detected click
  | { type: 'failed'; reason: string; peak: number };

const clicks = 8;
const spacing = Math.round(sampleRate * 0.3); // window per click, frames
const clickLevel = 0.25; // -12 dBFS
const minDetect = 0.01; // -40 dBFS: anything quieter means no loopback

class LoopbackProcessor extends AudioWorkletProcessor {
  private frame = 0;
  private bestLevel = 0;
  private bestOffset = -1;
  private readonly delays: number[] = [];
  private done = false;
  private peakSeen = 0;

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.done) return false;
    const input = inputs[0][0];
    const output = outputs[0];
    const n = output[0].length;

    for (let i = 0; i < n; i++, this.frame++) {
      const offset = this.frame % spacing;
      const click = Math.floor(this.frame / spacing);

      if (offset === 0 && click > 0) this.finishWindow();

      const out = offset === 0 && click < clicks ? clickLevel : 0;
      for (const ch of output) ch[i] = out;

      const level = input ? Math.abs(input[i]) : 0;
      this.peakSeen = Math.max(this.peakSeen, level);
      if (level > this.bestLevel) {
        this.bestLevel = level;
        this.bestOffset = offset;
      }

      if (click >= clicks) {
        this.done = true;
        this.port.postMessage(
          this.delays.length >= clicks / 2
            ? ({ type: 'result', delays: this.delays } satisfies LoopbackReport)
            : ({
                type: 'failed',
                reason: `no clicks came back (input peak ${(20 * Math.log10(this.peakSeen || 1e-9)).toFixed(1)} dBFS); is the output patched into the input?`,
                peak: this.peakSeen,
              } satisfies LoopbackReport),
        );
        return false;
      }
    }
    return true;
  }

  private finishWindow(): void {
    if (this.bestLevel >= minDetect) this.delays.push(this.bestOffset);
    this.bestLevel = 0;
    this.bestOffset = -1;
  }
}

registerProcessor('phreak-loopback', LoopbackProcessor);
