#!/usr/bin/env python3
"""Check a pedal's schematic drawing (its *@sch lines) against its netlist.

usage: check_sch.py pedals/x.cir [--verbose]

The drawing is only coordinates: wires, symbols with pins, flags. This
works out which netlist node every drawn net is, the same way the web
viewer does (web/src/schematic.ts: flags by name; diodes, transistors,
op-amps and a pot's wiper by pin order; two-pin parts and pot ends either
way round), then checks every drawn part's pins land on the nodes its
netlist line names. Exit 1 on any mismatch or unnamed net.
"""
import re
import sys

PINS = {
    'res': [(16, 16), (16, 96)], 'cap': [(16, 0), (16, 64)], 'polcap': [(16, 0), (16, 64)],
    'diode': [(16, 0), (16, 64)], 'npn': [(64, 0), (0, 48), (64, 96)], 'pnp': [(64, 0), (0, 48), (64, 96)],
    'opamp': [(-32, 80), (-32, 48), (0, 32), (0, 96), (32, 64)], 'pot': [(16, 16), (64, 64), (16, 96)],
    'voltage': [(0, 16), (0, 96)], 'ind': [(16, 16), (16, 96)], 'njf': [(64, 0), (0, 48), (64, 96)],
}
# Drawn pin i -> index into the netlist line's nodes (None: either end).
ORDER = {
    'diode': [0, 1], 'npn': [0, 1, 2], 'pnp': [0, 1, 2], 'njf': [0, 1, 2], 'voltage': [0, 1],
    'opamp': [0, 1, 3, 4, 2], 'pot': [None, 1, None],
}


def place(p, rot, x, y):
    px, py = p
    for _ in range(int(rot[1:]) // 90):
        px, py = -py, px
    if rot.startswith('M'):
        px = -px
    return (x + px, y + py)


def parts_of(text):
    """Top-level element lines: name -> nodes (lower case)."""
    parts, in_sub = {}, False
    for raw in text.split('\n'):
        t = raw.split()
        if not t:
            continue
        head = t[0].lower()
        if head == '.subckt':
            in_sub = True
        elif head == '.ends':
            in_sub = False
        if in_sub or head.startswith(('*', '.', '+')):
            continue
        letter = head[0]
        if letter == 'x':
            rest = [x for x in t[1:] if '=' not in x]
            nodes = rest[:-1]
        else:
            n = {'q': 3, 'j': 3, 'e': 4}.get(letter, 2)
            nodes = t[1:1 + n]
        parts[t[0].upper()] = [x.lower() for x in nodes]
    return parts


def check(path, verbose=False):
    text = open(path).read()
    syms, wires, flags = [], [], []
    for line in text.split('\n'):
        t = line.split()
        if not t or t[0] != '*@sch':
            continue
        if t[1] == 'sym':
            syms.append((t[2], int(t[3]), int(t[4]), t[5], t[6].upper()))
        elif t[1] == 'wire':
            wires.append(tuple(map(int, t[2:6])))
        elif t[1] == 'flag':
            flags.append((int(t[2]), int(t[3]), t[4]))
    if not syms:
        print(f'{path}: no drawing')
        return True

    parent = {}

    def find(k):
        while parent.get(k, k) != k:
            parent[k] = parent.get(parent[k], parent[k])
            k = parent[k]
        return k

    def union(a, b):
        a, b = find(a), find(b)
        if a != b:
            parent[a] = b

    points = []
    for x1, y1, x2, y2 in wires:
        union((x1, y1), (x2, y2))
        points += [(x1, y1), (x2, y2)]
    pins = {}
    for s in syms:
        pins[s] = [place(p, s[3], s[1], s[2]) for p in PINS.get(s[0], [])]
        points += pins[s]
    points += [(f[0], f[1]) for f in flags]
    for x1, y1, x2, y2 in wires:
        for x, y in points:
            if (x1 == x2 == x and min(y1, y2) <= y <= max(y1, y2)) or (y1 == y2 == y and min(x1, x2) <= x <= max(x1, x2)):
                union((x, y), (x1, y1))

    parts = parts_of(text)
    nodes = {n for ns in parts.values() for n in ns}
    out = (re.search(r'^\*@output\s+(\S+)', text, re.M | re.I) or [None, ''])[1].lower()
    named = {}

    def name(p, node):
        r = find(p)
        if node and r not in named:
            named[r] = node.lower()

    for x, y, label in flags:
        l = label.lower()
        if l == '0':
            name((x, y), '0')
        elif l == 'out':
            name((x, y), out)
        elif l == 'in':  # the node the *@input source drives
            src = (re.search(r'^\*@input\s+(\S+)', text, re.M | re.I) or [None, ''])[1].upper()
            name((x, y), parts.get(src, [None])[0])
        elif l in nodes:
            name((x, y), l)
        else:  # "9V": the node a 9 V supply drives
            m = re.match(r'([\d.]+)', l)
            for pname, pn in parts.items():
                if m and pname.startswith('V') and re.search(rf'^{re.escape(pname)}\s.*\b{m.group(1)}\b', text, re.M | re.I):
                    name((x, y), pn[0])
    for s in syms:
        order, part = ORDER.get(s[0]), parts.get(s[4])
        if order and part:
            for i, p in enumerate(pins[s]):
                if order[i] is not None:
                    name(p, part[order[i]])
    changed = True
    while changed:
        changed = False
        for s in syms:
            part = parts.get(s[4])
            ps = pins[s]
            if not part:
                continue
            ends = [ps[0], ps[2]] if s[0] == 'pot' else ps
            nn = [part[0], part[2]] if s[0] == 'pot' else part
            if len(ends) != 2 or len(nn) != 2:
                continue
            a, b = (named.get(find(p)) for p in ends)
            other = lambda n: nn[1] if n == nn[0] else nn[0] if n == nn[1] else None
            if a and not b and other(a):
                name(ends[1], other(a))
                changed = True
            elif b and not a and other(b):
                name(ends[0], other(b))
                changed = True

    ok = True
    for s in syms:
        part = parts.get(s[4])
        if part is None:
            print(f'  {s[4]}: drawn but not in the netlist')
            ok = False
            continue
        got = [named.get(find(p)) for p in pins[s]]
        order = ORDER.get(s[0])
        if s[0] == 'pot':
            want_ok = got[1] == part[1] and sorted([got[0] or '?', got[2] or '?']) == sorted([part[0], part[2]])
        elif order:
            want_ok = all(order[i] is None or got[i] == part[order[i]] for i in range(len(got)))
        else:
            want_ok = sorted(g or '?' for g in got) == sorted(part[:len(got)])
        if not want_ok:
            print(f'  {s[4]} ({s[0]}): pins land on {got}, netlist says {part}')
            ok = False
        elif verbose:
            print(f'  {s[4]}: {got}')
    # A pin must meet something: a wire, another pin or a flag.
    touches = {}
    for p in points:
        touches[p] = touches.get(p, 0) + 1
    for x1, y1, x2, y2 in wires:
        for p in set(points):
            if (x1 == x2 == p[0] and min(y1, y2) < p[1] < max(y1, y2)) or (y1 == y2 == p[1] and min(x1, x2) < p[0] < max(x1, x2)):
                touches[p] = touches.get(p, 0) + 1
    for s in syms:
        for p in pins[s]:
            if touches.get(p, 0) < 2:
                print(f'  {s[4]}: a pin at {p} connects to nothing')
                ok = False
    unnamed = {find(p) for p in points} - set(named)
    if unnamed:
        print(f'  {len(unnamed)} drawn net(s) have no node: near {sorted(unnamed)[:4]}')
        ok = False
    print(f'{path}: {"OK" if ok else "MISMATCH"} ({len(syms)} parts, {len(wires)} wires)')
    return ok


if __name__ == '__main__':
    sys.exit(0 if check(sys.argv[1], '--verbose' in sys.argv) else 1)
