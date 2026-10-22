// Minimal WAV reader for the Node tools: PCM 16/24/32-bit and 32-bit float.

import { readFileSync } from 'node:fs';

export interface Wav { sampleRate: number; channels: Float32Array[] }

export function readWav(path: string): Wav {
  const b = readFileSync(path);
  let pos = 12, fmt: { tag: number; ch: number; sr: number; bits: number } | null = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4), size = b.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = { tag: b.readUInt16LE(body), ch: b.readUInt16LE(body + 2), sr: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    } else if (id === 'data' && fmt) {
      const bytes = fmt.bits / 8, frames = Math.floor(size / (bytes * fmt.ch));
      const channels = Array.from({ length: fmt.ch }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++)
        for (let c = 0; c < fmt.ch; c++) {
          const o = body + (i * fmt.ch + c) * bytes;
          channels[c][i] =
            fmt.tag === 3 || (fmt.tag === 0xfffe && bytes === 4) ? b.readFloatLE(o)
            : bytes === 3 ? b.readIntLE(o, 3) / 8388608
            : bytes === 4 ? b.readInt32LE(o) / 2147483648
            : b.readInt16LE(o) / 32768;
        }
      return { sampleRate: fmt.sr, channels };
    }
    pos = body + size + (size & 1);
  }
  throw new Error(`no PCM data in ${path}`);
}
