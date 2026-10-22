// DSP effects: EQ, delay and reverb after the amp, the compressor at the
// front of the chain. Keep in sync with engine/fx/*.cpp and AmpChain's
// effect order (control order, defaults, switch positions); the engine owns
// the DSP.
export interface FxControlInfo {
  name: string;
  label: string;
  defaultValue: number; // 0..1
  positions?: string[]; // a switch: labels for each position
  slider?: boolean; // a graphic-EQ slider (centre = 0 dB)
}

export interface PostFxInfo {
  index: number; // engine effect index (AmpChain::getPostEffect)
  stage: 'pre' | 'post'; // which engine instance runs it in the browser
  id: string;
  name: string;
  maker: string;
  controls: FxControlInfo[];
}

const band = (name: string, label: string): FxControlInfo => ({ name, label, defaultValue: 0.5, slider: true });

export const postEffects: PostFxInfo[] = [
  {
    index: 0, stage: 'post', id: 'eq7', name: '7-Band EQ', maker: 'Graphic equalizer',
    controls: [band('b100', '100'), band('b200', '200'), band('b400', '400'), band('b800', '800'),
               band('b1k6', '1.6k'), band('b3k2', '3.2k'), band('b6k4', '6.4k'), band('level', 'Level')],
  },
  {
    index: 1, stage: 'post', id: 'delay', name: 'Digital Delay', maker: '12 ms – 800 ms',
    controls: [
      { name: 'level', label: 'Level', defaultValue: 0.45 },
      { name: 'feedback', label: 'Repeats', defaultValue: 0.35 },
      { name: 'time', label: 'Time', defaultValue: 0.55 },
      { name: 'mode', label: 'Mode', defaultValue: 1, positions: ['S', 'M', 'L'] },
    ],
  },
  {
    index: 2, stage: 'post', id: 'reverb', name: 'Reverb', maker: 'Spring · Hall · Flange',
    controls: [
      { name: 'reverb', label: 'Reverb', defaultValue: 0.35 },
      { name: 'mode', label: 'Mode', defaultValue: 0, positions: ['Spring', 'Hall', 'Flange'] },
    ],
  },
];

/** The compressor: same effect API, but first in the chain (before the
    pedals), so it runs on the pre-cab engine and lives on the pedal board. */
export const compressor: PostFxInfo = {
  index: 3, stage: 'pre', id: 'red-comp', name: 'Red Comp', maker: 'Compressor',
  controls: [
    { name: 'output', label: 'Output', defaultValue: 0.5 },
    { name: 'sensitivity', label: 'Sensitivity', defaultValue: 0.5 },
  ],
};

/** Every DSP effect, for presets. */
export const allEffects: PostFxInfo[] = [compressor, ...postEffects];
