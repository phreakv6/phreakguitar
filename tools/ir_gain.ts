// Prints the browser's loudness-matching gain for an IR (web/src/irlevel.ts)
// so run_checks.sh can compare it with the native one (render --ir-gain).
//   node tools/ir_gain.ts file.wav

import { irLevelMatchGain } from '../web/src/irlevel.ts';
import { readWav } from './wav.ts';

const wav = readWav(process.argv[2]);
console.log(irLevelMatchGain(wav.channels.slice(0, 2), wav.sampleRate).toPrecision(9));
