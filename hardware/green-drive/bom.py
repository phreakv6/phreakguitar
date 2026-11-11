"""
Parts list from design.py: python3 bom.py  ->  out/bom.csv and a table on stdout.

Robu.in products were checked on 10 Nov 2026 (prices incl. GST, per piece).
"""

import csv
import sys
from collections import OrderedDict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import design  # noqa: E402

KIND_NAME = {
    "R": "Resistor 1/4 W metal film", "C_FILM": "Film capacitor (polyester box)",
    "C_CER": "Ceramic capacitor", "C_EL": "Electrolytic capacitor, 25 V+",
    "D": "Diode", "D_PWR": "Schottky diode", "NPN_ECB": "NPN transistor (pins E-C-B)",
    "OPAMP2": "Dual op-amp, DIP-8", "POT": "Pot, 16 mm, PCB legs", "LED": "LED",
}

# Off-board hardware: (item, qty, note)
HARDWARE = [
    ("8-pin DIP socket", 1, "for U1"),
    ("3PDT footswitch (Daier PBS-24-302P)", 1, "true bypass + LED"),
    ('1/4" jack (CK-6.35-03, stereo is fine)', 2, "input and output"),
    ("2.1 x 5.5 mm DC jack, panel mount", 1, "centre negative, like Boss"),
    ("Knob, 6 mm shaft", 3, ""),
    ("24 AWG hook-up wire", 1, "a couple of colours"),
    ("M3 x 5 mm brass heat-set insert", 4, "bottom plate"),
    ("M3 x 6 mm countersunk screw", 4, "bottom plate"),
]


def main():
    groups = OrderedDict()
    for ref, value, kind, _pins, note in design.PARTS:
        if kind == "PAD":
            continue
        key = (KIND_NAME[kind], value)
        g = groups.setdefault(key, {"refs": [], "notes": set()})
        g["refs"].append(ref)
        if note:
            g["notes"].add(note)
    order = list(KIND_NAME.values())

    def value_num(v):
        mult = {"p": 1e-12, "n": 1e-9, "u": 1e-6, "k": 1e3, "K": 1e3, "M": 1e6}
        num = "".join(c for c in v if c.isdigit() or c == ".")
        tail = v[len(num):len(num) + 1] if v[:len(num)] == num else ""
        try:
            return float(num) * mult.get(tail, 1)
        except ValueError:
            return 0.0
    groups = OrderedDict(sorted(groups.items(), key=lambda kv: (order.index(kv[0][0]), value_num(kv[0][1]))))
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    with open(out / "bom.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Qty", "Part", "Value", "References", "Notes"])
        print("| Qty | Part | Value | On the board |")
        print("|---|---|---|---|")
        for (part, value), g in groups.items():
            refs = ", ".join(g["refs"])
            notes = "; ".join(sorted(g["notes"]))
            w.writerow([len(g["refs"]), part, value, refs, notes])
            print(f"| {len(g['refs'])} | {part} | {value} | {refs} |")
        for item, qty, note in HARDWARE:
            w.writerow([qty, item, "", "", note])
            print(f"| {qty} | {item} | | |")
    print(f"\n{sum(len(g['refs']) for g in groups.values())} parts on the board; out/bom.csv written")


if __name__ == "__main__":
    main()
