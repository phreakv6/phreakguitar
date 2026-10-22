// Pitch detection for the tuner: the McLeod pitch method (McLeod & Wyvill,
// "A smarter way to find pitch", 2005). A normalised autocorrelation (the
// NSDF) peaks near 1 at the period; picking the first peak close to the
// highest one avoids the octave errors plain autocorrelation makes on a
// guitar's strong second harmonic.

export interface Pitch {
  hz: number;
  clarity: number; // 0..1: how periodic the window is
}

/** Lowest / highest notes the tuner reads: A1 (a 5-string bass's open A,
    below any drop tuning) to the high E string's 24th fret. */
export const minHz = 55;
export const maxHz = 1400;

/** Pitch of `buf` (the most recent samples), or null if there's no clear
    note: too quiet, or not periodic enough. */
export function detectPitch(buf: Float32Array, sampleRate: number, minClarity = 0.8): Pitch | null {
  const maxTau = Math.min(Math.floor(sampleRate / minHz), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  const w = buf.length - maxTau; // correlation window
  const x = buf.subarray(buf.length - w - maxTau); // newest samples

  let energy = 0;
  for (let j = 0; j < w; j++) energy += x[j] * x[j];
  if (energy / w < 1e-8) return null; // under ~-80 dBFS RMS: no note

  // NSDF n(tau) = 2 r(tau) / m(tau), with m updated incrementally.
  const nsdf = new Float32Array(maxTau + 1);
  let m = 0;
  for (let j = 0; j < w; j++) m += 2 * x[j] * x[j];
  for (let tau = 0; tau <= maxTau; tau++) {
    if (tau > 0) m += x[w + tau - 1] * x[w + tau - 1] - x[tau - 1] * x[tau - 1];
    let r = 0;
    for (let j = 0; j < w; j++) r += x[j] * x[j + tau];
    nsdf[tau] = m > 0 ? (2 * r) / m : 0;
  }

  // Key maxima: the highest point of each positive lobe after the first
  // negative-going zero crossing (from zero lag, so a high note's first
  // period isn't mistaken for the zero-lag lobe), at or above minTau.
  const peaks: number[] = [];
  let tau = 0;
  while (tau < maxTau && nsdf[tau] > 0) tau++; // the zero-lag lobe
  while (tau < maxTau) {
    while (tau < maxTau && nsdf[tau] <= 0) tau++;
    let best = tau;
    while (tau < maxTau && nsdf[tau] > 0) {
      if (nsdf[tau] > nsdf[best]) best = tau;
      tau++;
    }
    if (best < maxTau && best >= minTau && nsdf[best] > 0) peaks.push(best);
  }
  if (peaks.length === 0) return null;
  const highest = Math.max(...peaks.map((p) => nsdf[p]));
  const pick = peaks.find((p) => nsdf[p] >= 0.9 * highest)!;
  if (nsdf[pick] < minClarity) return null;

  // Parabolic interpolation around the peak for sub-sample accuracy.
  const a = nsdf[pick - 1], b = nsdf[pick], c = nsdf[pick + 1] ?? b;
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  return { hz: sampleRate / (pick + shift), clarity: b };
}

const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Nearest equal-tempered note and how far off it is, in cents. */
export function noteOf(hz: number, a4 = 440): { name: string; octave: number; cents: number; midi: number } {
  const exact = 69 + 12 * Math.log2(hz / a4);
  const midi = Math.round(exact);
  return { name: names[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1, cents: (exact - midi) * 100, midi };
}
