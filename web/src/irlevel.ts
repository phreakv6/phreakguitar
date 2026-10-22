// Mirror of engine/dsp/IRLevel.h (keep in sync): loudness-matching gain
// for a cab IR, so its average response over 200 Hz - 2.5 kHz is unity.
// Pure, no DOM, so the Node parity check (tools/ir_gain.ts) can import it.

export function irLevelMatchGain(channels: Float32Array[], sampleRate: number): number {
  const points = 16, fLo = 200, fHi = 2500;
  let power = 0;
  for (let p = 0; p < points; p++) {
    const f = fLo * Math.pow(fHi / fLo, p / (points - 1));
    const w = (2 * Math.PI * f) / sampleRate;
    for (const data of channels) {
      let re = 0, im = 0;
      for (let i = 0; i < data.length; i++) {
        re += data[i] * Math.cos(w * i);
        im -= data[i] * Math.sin(w * i);
      }
      power += re * re + im * im;
    }
  }
  power /= points * Math.max(1, channels.length);
  if (!(power > 1e-12)) return 1;
  return Math.min(100, Math.max(0.01, 1 / Math.sqrt(power)));
}
