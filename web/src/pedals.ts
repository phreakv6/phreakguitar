// Factory pedals: SPICE netlists in /pedals, parsed by the engine. The UI
// only needs the *@pedal / *@control directives from the same files.
import roundFuzz from '../../pedals/round-fuzz.cir?raw';
import roundFuzzGe from '../../pedals/round-fuzz-ge.cir?raw';
import greenDrive from '../../pedals/green-drive.cir?raw';
import goldHorse from '../../pedals/gold-horse.cir?raw';
import ramFuzz from '../../pedals/ram-fuzz.cir?raw';
import cleanBoost from '../../pedals/clean-boost.cir?raw';
import trebleBoost from '../../pedals/treble-boost.cir?raw';
import classicWah from '../../pedals/classic-wah.cir?raw';
import photoVibe from '../../pedals/photo-vibe.cir?raw';
import orangePhaser from '../../pedals/orange-phaser.cir?raw';
import octaveFuzz from '../../pedals/octave-fuzz.cir?raw';
import rodent from '../../pedals/rodent.cir?raw';

export interface PedalControl {
  name: string;
  label: string;
  defaultValue: number;
  positions?: string[]; // a switch (positions="A,B"): 0 = first .. 1 = last
}

export interface PedalInfo {
  id: string;
  name: string;
  netlist: string;
  controls: PedalControl[];
  /** Your own pedals (the designer): the pedal it was forked from, whose
      enclosure it wears. Absent for factory pedals. */
  parent?: string;
}

export function info(id: string, netlist: string): PedalInfo {
  const name = /^\*@pedal\b.*?name="([^"]+)"/im.exec(netlist)?.[1] ?? id;
  const controls = [...netlist.matchAll(/^\*@control\s+(\S+)(.*)$/gim)].map(([, ctl, rest]) => ({
    name: ctl.toLowerCase(),
    label: /label="([^"]+)"/i.exec(rest)?.[1] ?? ctl,
    defaultValue: Number(/default=([\d.]+)/i.exec(rest)?.[1] ?? 0.5),
    positions: /positions="([^"]+)"/i.exec(rest)?.[1].split(','),
  }));
  return { id, name, netlist, controls };
}

export const factoryPedals: PedalInfo[] = [
  info('classic-wah', classicWah),
  info('clean-boost', cleanBoost),
  info('treble-boost', trebleBoost),
  info('round-fuzz', roundFuzz),
  info('round-fuzz-ge', roundFuzzGe),
  info('octave-fuzz', octaveFuzz),
  info('green-drive', greenDrive),
  info('gold-horse', goldHorse),
  info('rodent', rodent),
  info('orange-phaser', orangePhaser),
  info('photo-vibe', photoVibe),
  info('ram-fuzz', ramFuzz),
];

// Your pedals: forks made in the designer, kept in this browser as their
// netlists (the same files the engine and ngspice read).
export interface UserPedal { id: string; parent: string; netlist: string }
const userKey = 'phreakguitar.pedals.v1';

export function loadUserPedals(): UserPedal[] {
  try {
    const list = JSON.parse(localStorage.getItem(userKey) ?? '[]');
    return Array.isArray(list) ? list.filter((p) => typeof p?.id === 'string' && typeof p?.netlist === 'string') : [];
  } catch {
    return [];
  }
}

export function saveUserPedals(list: UserPedal[]): void {
  try {
    localStorage.setItem(userKey, JSON.stringify(list));
  } catch {
    // storage full or blocked: the pedal still works until the page closes
  }
}

export const userPedalInfo = (u: UserPedal): PedalInfo => ({ ...info(u.id, u.netlist), parent: u.parent });

/** The parent factory pedal a pedal descends from (itself if factory). */
export function lookOf(p: PedalInfo, all: PedalInfo[]): string {
  let id = p.id, parent = p.parent;
  for (let i = 0; parent && i < 16; i++) {
    id = parent;
    parent = all.find((x) => x.id === parent)?.parent;
  }
  return id;
}
