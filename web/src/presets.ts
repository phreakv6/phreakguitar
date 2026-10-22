// Presets: a whole tone (amp + its knobs, pedal board, cab, delay/reverb,
// gate) under a name. Rig levels (Input, Master) and devices stay out: they
// belong to the player's interface and room, not to the tone.
//
// Knob values are 0..1 like everywhere else; anything a preset leaves out
// takes the control's default, so factory presets only list what matters.

export interface PresetSlot {
  id: string; // factoryPedals id
  on: boolean;
  knobs: Record<string, number>;
}

export interface Preset {
  name: string;
  amp: string; // amps id
  ampKnobs: Record<string, number>;
  pedals: (PresetSlot | null)[]; // signal order
  cab: string; // 'amp' (the amp's own cab), 'builtin:<i>', 'user:<file>', 'off'
  fx: Record<string, { on: boolean; values: Record<string, number> }>;
  gate: { on: boolean; db: number };
  /** Preset volume (dB), on top of Master: evens out loudness between
      presets (a clean black panel and a fuzzed Class A differ by ~40 dB). */
  level?: number;
  /** Menu group for factory presets ('Factory' if absent): an artist's name. */
  group?: string;
  /** Shown when the preset is picked: pickup, hands, what the original was. */
  notes?: string;
}

export interface UserPreset extends Preset {
  id: string;
}

// Levels: measured with real playing (pedals + amp, before the cab) and
// set so every preset lands near the same loudness (-36 dB RMS there:
// distorted presets come down rather than clean ones going up).
// Delay Mode: S / M / L = 0 / 0.5 / 1; in L, Time t gives 200 * 4^t ms.
const pedal = (id: string, knobs: Record<string, number>, on = true): PresetSlot => ({ id, on, knobs });
const delay = (values: Record<string, number>) => ({ delay: { on: true, values } });
const noFx = {};
const gateOff = { on: false, db: -65 };

export const factoryPresets: Preset[] = [
  {
    name: 'Black panel clean', level: 13.8,
    amp: 'blackpanel-100',
    ampKnobs: { volume: 0.35, treble: 0.6, middle: 0.5, bass: 0.4, reverb: 0.3 },
    pedals: [], cab: 'amp', fx: noFx, gate: gateOff,
  },
  {
    name: 'Country/funk clean: compressor + EQ', level: 5.9,
    amp: 'blackpanel-100',
    ampKnobs: { volume: 0.4, treble: 0.65, middle: 0.45, bass: 0.4, reverb: 0.2 },
    pedals: [], cab: 'amp',
    fx: {
      'red-comp': { on: true, values: { output: 0.5, sensitivity: 0.6 } },
      eq7: { on: true, values: { b100: 0.45, b400: 0.45, b800: 0.45, b3k2: 0.62, b6k4: 0.58 } },
    },
    gate: gateOff,
  },
  {
    name: 'Surf: dripping spring', level: 8,
    amp: 'blackpanel-100',
    ampKnobs: { volume: 0.45, treble: 0.75, middle: 0.4, bass: 0.35, reverb: 0.75 },
    pedals: [], cab: 'amp', fx: noFx, gate: gateOff,
  },
  {
    name: 'Black panel + Gold Horse: edge of breakup', level: -6.5,
    amp: 'blackpanel-100',
    ampKnobs: { volume: 0.5, treble: 0.55, middle: 0.55, bass: 0.4, reverb: 0.25 },
    pedals: [pedal('gold-horse', { gain: 0.35, treble: 0.55, output: 0.6 })],
    cab: 'amp', fx: noFx, gate: gateOff,
  },
  {
    name: 'Tweed blues', level: 5,
    amp: 'tweed-bass',
    ampKnobs: { bright: 0.55, normal: 0, treble: 0.65, middle: 0.5, bass: 0.35, presence: 0.6 },
    pedals: [], cab: 'amp', fx: noFx, gate: gateOff,
  },
  {
    name: 'Plexi crunch', level: -14,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.7, loud2: 0, treble: 0.6, middle: 0.6, bass: 0.4, presence: 0.5 },
    pedals: [], cab: 'amp', fx: noFx, gate: gateOff,
  },
  {
    name: 'Plexi lead: Green Drive boost + delay', level: -17.5,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.75, loud2: 0, treble: 0.6, middle: 0.65, bass: 0.4, presence: 0.5 },
    pedals: [pedal('green-drive', { drive: 0.25, tone: 0.55, level: 0.75 })],
    cab: 'amp', fx: delay({ level: 0.3, feedback: 0.3, time: 0.3, mode: 1 }) /* ~300 ms */, gate: gateOff,
  },
  {
    name: 'Brit 800 rock rhythm', level: -4,
    amp: 'brit-800',
    ampKnobs: { preamp: 0.65, master: 0.5, treble: 0.6, middle: 0.55, bass: 0.5, presence: 0.5 },
    pedals: [], cab: 'amp', fx: noFx, gate: { on: true, db: -62 },
  },
  {
    name: "'80s lead: Green Drive into a Brit 800", level: -6.5,
    amp: 'brit-800',
    ampKnobs: { preamp: 0.8, master: 0.5, treble: 0.6, middle: 0.6, bass: 0.45, presence: 0.55 },
    pedals: [pedal('green-drive', { drive: 0.1, tone: 0.6, level: 0.85 })],
    cab: 'amp', fx: delay({ level: 0.25, feedback: 0.3, time: 0.45, mode: 1 }) /* ~370 ms */, gate: { on: true, db: -60 },
  },
  {
    name: 'Class A chime', level: -20.8,
    amp: 'classa-30',
    ampKnobs: { volume: 0.4, treble: 0.65, bass: 0.45, cut: 0.3 },
    pedals: [], cab: 'amp', fx: noFx, gate: gateOff,
  },
  {
    name: 'Black Panel 22: edge of breakup', level: -2,
    amp: 'blackpanel-22',
    ampKnobs: { volume: 0.55, treble: 0.6, bass: 0.45, reverb: 0.3 },
    pedals: [], cab: 'amp', fx: noFx, gate: gateOff,
    notes: 'Two 6V6s on a tube rectifier: clean when you play softly, gritty when you dig in. Ride your guitar volume and pick attack instead of pedals.',
  },
  {
    name: "'60s British blues: treble booster into a Brit 45", level: -16,
    amp: 'brit-45',
    ampKnobs: { loud1: 0.65, loud2: 0, treble: 0.5, middle: 0.65, bass: 0.5, presence: 0.45 },
    pedals: [pedal('treble-boost', { boost: 0.8 })],
    cab: 'amp', fx: noFx, gate: gateOff,
    notes: 'A treble booster into a Brit 45 that is already cooking: the upper mids jump out and the notes sustain. Neck pickup for fat leads, bridge for bite: the mid-60s British blues-rock sound.',
  },
  {
    name: "'70s British crunch (Graphic 120)", level: -25.6,
    amp: 'graphic-120',
    ampKnobs: { gain: 0.7, bass: 0.55, treble: 0.55, fac: 0, boost: 0.3 },
    pedals: [], cab: 'amp', fx: noFx, gate: { on: true, db: -62 },
    notes: "A '70s British graphic-panel head cranked: thick, woolly, chewy crunch (early-70s hard rock, later stoner rock). Click through the Voicing switch: each step takes away more low end, from huge (1) to thin and cutting (6).",
  },
  {
    name: 'Boutique ODS: cascade overdrive', level: 3.2,
    amp: 'boutique-ods',
    ampKnobs: { volume: 0.5, treble: 0.55, middle: 0.55, bass: 0.4, drive: 0.5, level: 0.35, mode: 1, master: 0.55, presence: 0.4 },
    pedals: [], cab: 'amp', fx: delay({ level: 0.2, feedback: 0.25, time: 0.4, mode: 1 }) /* ~350 ms */, gate: { on: true, db: -62 },
    notes: "The famous boutique overdrive-special sound: the clean channel cascading into two more gain stages - smooth, singing, vocal sustain (jazz-blues and fusion players love it). Turn the clean Volume to set how hard it drives the overdrive; Level balances it against the clean channel.",
  },
  {
    name: 'Hot Rod 100: high-gain lead', level: -3.7,
    amp: 'hotrod-100',
    ampKnobs: { mode: 1, preamp: 0.6, odmaster: 0.4, bass: 0.45, middle: 0.6, treble: 0.55, presence: 0.45 },
    pedals: [], cab: 'amp', fx: delay({ level: 0.2, feedback: 0.3, time: 0.45, mode: 1 }), gate: { on: true, db: -60 },
    notes: "Experimental: heavy on the CPU for now (use the Standard buffer in Settings and close other big apps, or it can crackle). Five gain stages in a row, tight and smooth: the late-80s template for modern high gain. Preamp sets the gain, OD Master the volume; flip to Clean for a bright, glassy clean with its own Normal and Norm Master.",
  },
  {
    name: "'60s fuzz: Round Fuzz into a Class A 30", level: -24,
    amp: 'classa-30',
    ampKnobs: { volume: 0.35, treble: 0.6, bass: 0.5, cut: 0.4 },
    pedals: [pedal('round-fuzz', { fuzz: 0.85, volume: 0.25 })],
    cab: 'amp', fx: noFx, gate: gateOff,
  },
  {
    name: 'Brown sound: phaser into a cranked plexi', level: -15.2,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.85, loud2: 0, treble: 0.65, middle: 0.5, bass: 0.45, presence: 0.5 },
    pedals: [pedal('orange-phaser', { speed: 0.25 })],
    cab: 'amp',
    fx: {
      delay: { on: true, values: { level: 0.2, feedback: 0.2, time: 0.35, mode: 1 } }, // ~330 ms
      'reverb': { on: true, values: { reverb: 0.3, mode: 0.5 } },
    },
    gate: { on: true, db: -60 },
    notes: "The late-70s 'brown sound' (think 'Eruption'): a four-stage phaser at a slow sweep in front of a cranked 100 W plexi, a short echo and some room. Bridge humbucker. The phaser goes before the amp, so the distortion makes the sweep sound vocal rather than watery; try Speed up near 3 o'clock for a faster throb.",
  },
  {
    name: "'90s grunge: Rodent into a clean black panel", level: 8.5,
    amp: 'blackpanel-100',
    ampKnobs: { volume: 0.35, treble: 0.55, middle: 0.5, bass: 0.45, reverb: 0.15 },
    pedals: [pedal('rodent', { distortion: 0.65, filter: 0.35, volume: 0.45 })],
    cab: 'amp', fx: noFx, gate: { on: true, db: -60 },
  },
  {
    name: 'Ram Fuzz lead: delay + hall', level: 12,
    amp: 'blackpanel-100',
    ampKnobs: { volume: 0.35, treble: 0.55, middle: 0.55, bass: 0.4, reverb: 0 },
    pedals: [pedal('ram-fuzz', { sustain: 0.65, tone: 0.55, volume: 0.45 })],
    cab: 'amp',
    fx: {
      delay: { on: true, values: { level: 0.35, feedback: 0.35, time: 0.6, mode: 1 } }, // ~460 ms
      'reverb': { on: true, values: { reverb: 0.35, mode: 0.5 } },
    },
    gate: { on: true, db: -60 },
  },
  // --- Song tones: classic recorded sounds rebuilt from our gear, with ---
  // notes for the hands. Pickup positions on a 5-way single-coil switch:
  // 1 = bridge .. 5 = neck.
  {
    group: 'Song tones', name: 'Gravity – clean verses', level: 10,
    amp: 'boutique-ods',
    ampKnobs: { volume: 0.4, treble: 0.55, middle: 0.5, bass: 0.45, mode: 0, master: 0.55, presence: 0.4 },
    pedals: [], cab: 'amp',
    fx: { 'red-comp': { on: true, values: { output: 0.5, sensitivity: 0.35 } } },
    gate: gateOff,
    notes: "Position 4 or 5 (neck), guitar tone around 7. The platform is a loud, stiff boutique clean (the Boutique ODS's clean channel) with a touch of compression: play with your thumb and fingers, dig in on the low strings, and let the amp stay clean under you. 'Gravity' verses, 'Slow Dancing in a Burning Room'.",
  },
  {
    group: 'Song tones', name: 'Gravity – lead', level: 0,
    amp: 'boutique-ods',
    ampKnobs: { volume: 0.5, treble: 0.55, middle: 0.5, bass: 0.45, mode: 0, master: 0.55, presence: 0.4 },
    pedals: [
      pedal('green-drive', { drive: 0.3, tone: 0.5, level: 0.7 }),
      pedal('gold-horse', { gain: 0.25, treble: 0.5, output: 0.55 }),
    ],
    cab: 'amp', fx: delay({ level: 0.22, feedback: 0.25, time: 0.55, mode: 1 }) /* ~430 ms */,
    gate: { on: true, db: -62 },
    notes: 'Neck pickup (5), volume full. The lead stack is a Green Drive into a Gold Horse, both gentle, into the boutique clean channel on the edge: the drive comes from stacking, not from one pedal flat out. Wide, slow bends, and leave space between phrases.',
  },
  {
    group: 'Song tones', name: "All Your Love – '66 British blues", level: -10.5,
    amp: 'brit-45',
    ampKnobs: { loud1: 0.9, loud2: 0, treble: 0.55, middle: 0.7, bass: 0.5, presence: 0.45 },
    pedals: [], cab: 'amp', fx: noFx, gate: gateOff,
    notes: "The '66 British blues-rock sound: an early 45 W British combo (the Brit 45) turned all the way up, its GZ34 rectifier sagging under the notes, with a humbucker guitar straight in. Some accounts add a treble booster: try one in slot 1. On single-coils, position 1 or 2, volume full, pick hard: 'All Your Love', 'Hideaway'.",
  },
  {
    group: 'Song tones', name: "Sunshine of Your Love – 'woman tone'", level: -17.5,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.9, loud2: 0, treble: 0.35, middle: 0.7, bass: 0.55, presence: 0.3 },
    pedals: [], cab: 'amp',
    fx: { eq7: { on: true, values: { b100: 0.45, b400: 0.6, b800: 0.62, b1k6: 0.55, b3k2: 0.3, b6k4: 0.2 } } },
    gate: gateOff,
    notes: "The trick is the guitar: neck pickup (5) with its tone knob all the way down into a cranked plexi. Roll your tone to 0 (or close); the EQ takes off the rest of the top. Slow, wide vibrato and lots of sustain: the 'Sunshine of Your Love' solo.",
  },
  {
    group: 'Song tones', name: 'Old Love – single-coils into tweed', level: 2,
    amp: 'tweed-bass',
    ampKnobs: { bright: 0.6, normal: 0.2, treble: 0.6, middle: 0.55, bass: 0.4, presence: 0.55 },
    pedals: [], cab: 'amp',
    fx: { 'reverb': { on: true, values: { reverb: 0.2, mode: 0 } } },
    gate: gateOff,
    notes: "A single-coil guitar (ideally with an active mid boost) into a tweed. Position 4 for rhythm, 5 for lead; light touch for clean, dig in for the tweed growl: 'Old Love', 'Wonderful Tonight' (lighter).",
  },
  {
    group: 'Song tones', name: 'Sultans of Swing', level: 3.5,
    amp: 'blackpanel-410',
    ampKnobs: { volume: 0.38, treble: 0.72, middle: 0.35, bass: 0.45, reverb: 0.2 },
    pedals: [], cab: 'amp',
    fx: {
      'red-comp': { on: true, values: { output: 0.5, sensitivity: 0.45 } },
      eq7: { on: true, values: { b400: 0.45, b800: 0.42, b3k2: 0.58 } },
    },
    gate: gateOff,
    notes: "Position 4 (neck + middle: the quack), and fingers - no pick. That is most of the tone: thumb on the bass strings, snapping the treble strings with index and middle. The original was an early-60s single-coil guitar into a small black-panel combo; the Black Panel 4x10 is its bigger sibling (6L6s, tube rectifier, 10\" speakers), bright and clean with a little squash.",
  },
  {
    group: 'Song tones', name: 'Money for Nothing', level: -4,
    amp: 'brit-800',
    ampKnobs: { preamp: 0.6, master: 0.5, treble: 0.55, middle: 0.7, bass: 0.45, presence: 0.5 },
    pedals: [pedal('classic-wah', { wah: 0.58 })],
    cab: 'amp', fx: noFx, gate: { on: true, db: -60 },
    notes: "The original: a humbucker guitar through a wah parked about half-way, into a British stack. Here the Classic Wah parked near 1 kHz into a Brit 800. Leave the Wah knob where it is: the parked wah IS the tone. Bridge pickup (1), palm-muted riff, pick with your fingers if you can.",
  },
  {
    group: 'Song tones', name: 'Brothers in Arms', level: -4,
    amp: 'brit-800',
    ampKnobs: { preamp: 0.55, master: 0.5, treble: 0.4, middle: 0.65, bass: 0.5, presence: 0.4 },
    pedals: [pedal('green-drive', { drive: 0.4, tone: 0.4, level: 0.6 })],
    cab: 'amp',
    fx: {
      delay: { on: true, values: { level: 0.3, feedback: 0.4, time: 0.55, mode: 1 } }, // ~430 ms
      'reverb': { on: true, values: { reverb: 0.4, mode: 0.5 } },
    },
    gate: { on: true, db: -62 },
    notes: 'Neck pickup (5), guitar tone rolled back to about 5, fingers. A smooth, singing lead with long sustain; the original was a humbucker guitar into a high-gain hot-rod head (here a Brit 800 with a Green Drive for the sustain). Let each note ring into the delay and reverb.',
  },
  {
    group: 'Song tones', name: 'Purple Haze', level: -24,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.8, loud2: 0, treble: 0.6, middle: 0.6, bass: 0.5, presence: 0.55 },
    pedals: [pedal('round-fuzz-ge', { fuzz: 0.9, volume: 0.6 })],
    cab: 'amp', fx: noFx, gate: gateOff,
    notes: "A germanium round fuzz into a cranked 100 W plexi, the 1967 recipe. Bridge (1) for the riff, neck (5) for leads. Rolling your guitar volume back cleans the fuzz up a little; a real one does it more, because it reacts to the guitar's volume pot, which an audio interface hides. For the solo's octave-up, pick 'Purple Haze – solo (octave up)'.",
  },
  {
    group: 'Song tones', name: 'Purple Haze – solo (octave up)', level: -24,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.8, loud2: 0, treble: 0.6, middle: 0.6, bass: 0.5, presence: 0.55 },
    pedals: [pedal('octave-fuzz', { drive: 0.75, volume: 0.6, octave: 0 })],
    cab: 'amp', fx: noFx, gate: gateOff,
    notes: "The first octave-up fuzz, built in early 1967 and first heard on this solo, into the cranked plexi. Neck pickup (5), up past the 12th fret: that's where the octave jumps out (on low notes it's mostly a ragged fuzz). Pick lightly and let notes bloom; the octave is clearest on single notes, not chords.",
  },
  {
    group: 'Song tones', name: 'Little Wing', level: -10,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.5, loud2: 0, treble: 0.55, middle: 0.55, bass: 0.5, presence: 0.45 },
    pedals: [pedal('photo-vibe', { speed: 0.25, intensity: 0.55, volume: 0.5, mode: 0 })],
    cab: 'amp',
    fx: { 'reverb': { on: true, values: { reverb: 0.25, mode: 0 } } },
    gate: gateOff,
    notes: "A plexi just breaking up, neck pickup (5), chord-melody style: thumb over the neck for the bass notes, hammer-ons and slides in the chord shapes. The record's swirl was a rotating speaker; live it was a photocell vibe, as here, slow. Play softly for clean, dig in for grit.",
  },
  {
    group: 'Song tones', name: 'Comfortably Numb – solo', level: -0.4,
    amp: 'brit-clean-100',
    ampKnobs: { normal: 0.45, brilliant: 0, bass: 0.5, treble: 0.55, middle: 0.5, presence: 0.4, master: 0.45 },
    pedals: [pedal('ram-fuzz', { sustain: 0.7, tone: 0.5, volume: 0.5 })],
    cab: 'amp',
    fx: {
      delay: { on: true, values: { level: 0.35, feedback: 0.3, time: 0.62, mode: 1 } }, // ~470 ms
      'reverb': { on: true, values: { reverb: 0.35, mode: 0.5 } },
    },
    gate: { on: true, db: -60 },
    notes: "A Ram Fuzz into a very clean, loud British 100 W head (the Brit Clean 100) with long delay and hall. Bridge pickup (1) on single-coils; big, slow bends to pitch and long sustain. Let the delay fill the gaps.",
  },
  {
    group: 'Song tones', name: 'Time – solo', level: -12.7,
    amp: 'brit-clean-100',
    ampKnobs: { normal: 0.5, brilliant: 0, bass: 0.5, treble: 0.6, middle: 0.5, presence: 0.4, master: 0.45 },
    pedals: [pedal('round-fuzz', { fuzz: 0.65, volume: 0.45 })],
    cab: 'amp',
    fx: {
      delay: { on: true, values: { level: 0.28, feedback: 0.25, time: 0.45, mode: 1 } }, // ~370 ms
      'reverb': { on: true, values: { reverb: 0.25, mode: 0.5 } },
    },
    gate: { on: true, db: -60 },
    notes: "Mid-70s progressive rock: a round fuzz into a clean Brit Clean 100, with delay. Bridge or bridge + middle; aggressive, vocal bends and fast vibrato.",
  },
  {
    group: 'Song tones', name: 'Breathe – clean', level: 3.4,
    amp: 'brit-clean-100',
    ampKnobs: { normal: 0.4, brilliant: 0, bass: 0.5, treble: 0.6, middle: 0.5, presence: 0.4, master: 0.45 },
    pedals: [pedal('photo-vibe', { speed: 0.3, intensity: 0.55, volume: 0.5, mode: 0 })],
    cab: 'amp',
    fx: {
      'red-comp': { on: true, values: { output: 0.5, sensitivity: 0.55 } },
      delay: { on: true, values: { level: 0.3, feedback: 0.35, time: 0.6, mode: 1 } }, // ~460 ms
      'reverb': { on: true, values: { reverb: 0.4, mode: 0.5 } },
    },
    gate: gateOff,
    notes: "Spacious clean: a compressor, a photocell vibe (the 'Breathe' shimmer), delay and plenty of room into the Brit Clean 100. Neck + middle (4) or neck (5), gentle pick; let chords ring into the delay. Switch the vibe off for a plainer clean.",
  },
  {
    group: 'Song tones', name: 'Pride and Joy', level: -4.5,
    amp: 'blackpanel-410',
    ampKnobs: { volume: 0.6, treble: 0.6, middle: 0.5, bass: 0.5, reverb: 0.25 },
    pedals: [pedal('green-drive', { drive: 0.2, tone: 0.6, level: 0.85 })],
    cab: 'amp', fx: noFx, gate: gateOff,
    notes: "A Green Drive with low drive and the level up, into a loud Black Panel 4x10. Most of it is the hands: heavy strings (13s, tuned down a half step, are the classic choice), neck or middle pickup, and hit hard - downstrokes on the shuffle, raking into the bends.",
  },
  {
    group: 'Song tones', name: 'Texas Flood', level: -6,
    amp: 'blackpanel-410',
    ampKnobs: { volume: 0.72, treble: 0.55, middle: 0.55, bass: 0.45, reverb: 0.2 },
    pedals: [pedal('green-drive', { drive: 0.3, tone: 0.55, level: 0.75 })],
    cab: 'amp', fx: noFx, gate: gateOff,
    notes: "Slow blues: the Green Drive pushing a Black Panel 4x10 that's already on the edge, its tube rectifier giving under the big notes. Neck pickup (5), heavy attack, big bends with wide vibrato; back off for the quiet parts and the amp cleans up. For 'Lenny' and 'Cold Shot', try that preset.",
  },
  {
    group: 'Song tones', name: 'Voodoo Child', level: -24,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.8, loud2: 0, treble: 0.6, middle: 0.6, bass: 0.5, presence: 0.55 },
    pedals: [pedal('classic-wah', { wah: 0.4 }), pedal('round-fuzz-ge', { fuzz: 0.85, volume: 0.6 })],
    cab: 'amp', fx: noFx, gate: { on: true, db: -62 },
    notes: "A wah into a germanium round fuzz into a cranked plexi. Rock the Wah knob in time with the intro's muted scratches (heel down at 0, toe at 10); then park it for the riff. Neck pickup for the intro, bridge for the riff.",
  },
  {
    group: 'Song tones', name: 'White Room', level: -14.5,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.85, loud2: 0, treble: 0.5, middle: 0.7, bass: 0.5, presence: 0.4 },
    pedals: [pedal('classic-wah', { wah: 0.45 })],
    cab: 'amp', fx: noFx, gate: gateOff,
    notes: "A wah into a cranked plexi: on the record it's worked slowly, swelling into each phrase. Sweep the Wah knob gradually rather than in rhythm. Neck pickup (5), guitar tone a little rolled back.",
  },
  {
    group: 'Song tones', name: 'Machine Gun', level: -23,
    amp: 'brit-plexi',
    ampKnobs: { loud1: 0.85, loud2: 0, treble: 0.55, middle: 0.6, bass: 0.55, presence: 0.5 },
    pedals: [
      pedal('round-fuzz-ge', { fuzz: 0.8, volume: 0.55 }),
      pedal('photo-vibe', { speed: 0.4, intensity: 0.75, volume: 0.5, mode: 0 }),
    ],
    cab: 'amp', fx: noFx, gate: { on: true, db: -62 },
    notes: "A round fuzz into a photocell vibe into cranked plexis: the 1969-70 live sound. The vibe's throb turns sustained fuzz notes into the 'machine gun' pulse. Neck pickup, long sustained bends, let the vibe pulse do the rhythm.",
  },
  {
    group: 'Song tones', name: 'Lenny / Cold Shot', level: 8.5,
    amp: 'blackpanel-410',
    ampKnobs: { volume: 0.5, treble: 0.6, middle: 0.5, bass: 0.5, reverb: 0.25 },
    pedals: [pedal('photo-vibe', { speed: 0.3, intensity: 0.6, volume: 0.5, mode: 0 })],
    cab: 'amp', fx: noFx, gate: gateOff,
    notes: "A photocell vibe into a Black Panel 4x10 at the edge of breakup. 'Lenny': neck pickup (5), soft chord-melody playing, slow vibe. 'Cold Shot': middle pickup, a touch faster Speed, and dig in for the grit.",
  },
];

const storeKey = 'phreakguitar.presets.v1';

export function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(storeKey);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isPreset) : [];
  } catch {
    return [];
  }
}

export function saveUserPresets(list: UserPreset[]): void {
  try {
    localStorage.setItem(storeKey, JSON.stringify(list));
  } catch {
    /* private mode etc.: presets just don't persist */
  }
}

/** Loose check for presets coming from storage or an imported file. */
export function isPreset(p: unknown): p is UserPreset {
  const q = p as Partial<UserPreset> | null;
  return !!q && typeof q.name === 'string' && typeof q.amp === 'string' && Array.isArray(q.pedals)
    && typeof q.ampKnobs === 'object' && typeof q.fx === 'object' && typeof q.gate === 'object';
}
