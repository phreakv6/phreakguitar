#!/usr/bin/env python3
"""Convert an LTspice .asc drawing into PhreakGuitar *@sch lines.

The drawing is kept in the pedal's .cir file as comments ngspice ignores:
    *@sch sym <type> <x> <y> <rot> <element name>
    *@sch wire <x1> <y1> <x2> <y2>
    *@sch flag <x> <y> <label>        (label 0 = ground)
Coordinates and rotations are LTspice's (R0..R270, M0..M270: rotate, then
mirror); the web viewer (web/src/schematic.ts) draws them.

usage: asc_to_sch.py drawing.asc [--rename OLD=NEW ...] [--drop NAME ...]
                     [--drop-flag LABEL ...]
Symbols whose pins all lie on dropped parts' wires are not pruned: drop the
test sources and their flags explicitly.
"""
import argparse

TYPES = {'res': 'res', 'cap': 'cap', 'polcap': 'polcap', 'diode': 'diode', 'npn': 'npn',
         'pnp': 'pnp', 'pot': 'pot', 'voltage': 'voltage', 'OpAmps\\\\opamp2': 'opamp',
         'OpAmps\\opamp2': 'opamp'}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('asc')
    p.add_argument('--rename', action='append', default=[])
    p.add_argument('--drop', action='append', default=[])
    p.add_argument('--drop-flag', action='append', default=[])
    a = p.parse_args()
    rename = dict(r.split('=') for r in a.rename)

    lines = open(a.asc, 'rb').read().decode('latin-1').replace('\r', '').split('\n')
    out, sym = [], None
    for line in lines + ['END']:
        t = line.split()
        if not t:
            continue
        if sym and t[0] in ('SYMBOL', 'WIRE', 'FLAG', 'IOPIN', 'TEXT', 'END'):
            if sym['name'] not in a.drop:
                name = rename.get(sym['name'], sym['name'])
                out.append(f"*@sch sym {sym['type']} {sym['x']} {sym['y']} {sym['rot']} {name}")
            sym = None
        if t[0] == 'WIRE':
            out.append('*@sch wire ' + ' '.join(t[1:5]))
        elif t[0] == 'FLAG' and t[3] not in a.drop_flag:
            out.append(f'*@sch flag {t[1]} {t[2]} {t[3]}')
        elif t[0] == 'SYMBOL':
            if t[1] not in TYPES:
                raise SystemExit(f'unknown symbol {t[1]}')
            sym = {'type': TYPES[t[1]], 'x': t[2], 'y': t[3], 'rot': t[4], 'name': '?'}
        elif t[0] == 'SYMATTR' and sym and t[1] == 'InstName':
            sym['name'] = t[2]
    print('\n'.join(out))


if __name__ == '__main__':
    main()
