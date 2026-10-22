// The amps: circuit amps from /amps (preamp circuit + power section, see
// engine CircuitAmp), each named for the kind of amp it is.
import tweedBass from '../../amps/tweed-bass.cir?raw';
import blackPanel22 from '../../amps/blackpanel-22.cir?raw';
import blackPanel410 from '../../amps/blackpanel-410.cir?raw';
import blackPanel100 from '../../amps/blackpanel-100.cir?raw';
import brit45 from '../../amps/brit-45.cir?raw';
import britPlexi from '../../amps/brit-plexi.cir?raw';
import brit800 from '../../amps/brit-800.cir?raw';
import britClean100 from '../../amps/brit-clean-100.cir?raw';
import graphic120 from '../../amps/graphic-120.cir?raw';
import hotRod100 from '../../amps/hotrod-100.cir?raw';
import boutiqueOds from '../../amps/boutique-ods.cir?raw';
import classA30 from '../../amps/classa-30.cir?raw';
import type { PedalControl } from './pedals.ts';

export type Face = 'tweed' | 'blackpanel' | 'plexi' | 'brit800' | 'classa' | 'britclean' | 'boutique' | 'graphic' | 'hotrod';

export interface AmpInfo {
  id: string;
  name: string;
  model: string; // the line on the faceplate
  face: Face;
  netlist?: string; // absent: the built-in tweed stages
  controls: PedalControl[];
  /** Cab to switch to when this amp is picked: one of your IRs whose file
      name matches `userIR` (its cabinet, say /4x?12/), else a built-in. */
  cab: { userIR?: RegExp; builtin: number };
  /** Heavy on the CPU: listed only with ?experimental in the URL. */
  experimental?: boolean;
}

function circuitAmp(id: string, netlist: string, model: string, cab: AmpInfo['cab']): AmpInfo {
  const name = /^\*@amp\b.*?name="([^"]+)"/im.exec(netlist)?.[1] ?? id;
  const face = (/^\*@amp\b.*?face=(\w+)/im.exec(netlist)?.[1] ?? 'tweed') as Face;
  const controls = [...netlist.matchAll(/^\*@control\s+(\S+)(.*)$/gim)].map(([, ctl, rest]) => ({
    name: ctl.toLowerCase(),
    label: /label="([^"]+)"/i.exec(rest)?.[1] ?? ctl,
    defaultValue: Number(/default=([\d.]+)/i.exec(rest)?.[1] ?? 0.5),
    positions: /positions="([^"]+)"/i.exec(rest)?.[1].split(','),
  }));
  return { id, name, model, face, netlist, controls, cab };
}

// Cabinet hints for your own IR files (matched on their names).
const ir4x12 = /4 ?x ?12|412/i;
const ir2x12 = /2 ?x ?12|212/i;

export const amps: AmpInfo[] = [
  circuitAmp('tweed-bass', tweedBass, "Tweed 4x10 · '59 bass circuit", { builtin: 0 }),
  circuitAmp('blackpanel-22', blackPanel22, "Black panel · 22 W · '60s reverb circuit", { builtin: 2 }),
  circuitAmp('blackpanel-410', blackPanel410, "Black panel · 4x10 · '60s reverb circuit", { builtin: 0 }),
  circuitAmp('blackpanel-100', blackPanel100, "Black panel · 100 W · '60s reverb circuit", { builtin: 2 }),
  circuitAmp('brit-45', brit45, "Brit · 45 W · '62 KT66 circuit", { userIR: ir4x12, builtin: 1 }),
  circuitAmp('brit-plexi', britPlexi, "Brit · 100 W · '68 plexi circuit", { userIR: ir4x12, builtin: 1 }),
  circuitAmp('brit-800', brit800, "Brit · 100 W · '81 master-volume circuit", { userIR: ir4x12, builtin: 1 }),
  circuitAmp('brit-clean-100', britClean100, "Brit · 100 W · '70s high-headroom circuit", { userIR: ir4x12, builtin: 1 }),
  circuitAmp('graphic-120', graphic120, "Brit · 120 W · '70s graphic-panel circuit", { userIR: ir4x12, builtin: 1 }),
  { ...circuitAmp('hotrod-100', hotRod100, "Hot rod · 100 W · '87 super-lead circuit", { userIR: ir4x12, builtin: 1 }), experimental: true },
  circuitAmp('boutique-ods', boutiqueOds, "Boutique · 100 W · overdrive-special circuit", { builtin: 2 }),
  circuitAmp('classa-30', classA30, "Class A · 30 W · '60s top-boost circuit", { userIR: ir2x12, builtin: 2 }),
];
