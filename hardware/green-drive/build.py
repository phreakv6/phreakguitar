"""
Build the Green Drive's KiCad project from design.py.

    python3 build.py

1. green-drive.kicad_sch: the schematic. Every pin gets a short wire and a
   net label, grouped by stage; open it in KiCad to read or change it.
2. kicad-cli exports the netlist and runs ERC; check.py --net proves the
   netlist KiCad made is pedals/green-drive.cir.
3. pcb.py (in KiCad's own Python) places the parts, from which
   route.py / KiCad routes the board; see README.md.
"""

import re
import subprocess
import sys
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import design  # noqa: E402

KICAD = Path("/Applications/KiCad/KiCad.app/Contents")
CLI = KICAD / "MacOS" / "kicad-cli"
SYMBOLS = KICAD / "SharedSupport" / "symbols"
PROJECT = "green-drive"

# kind -> (symbol, footprint)
PARTS_LIB = {
    "R":       ("Device:R", "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal"),
    "C_FILM":  ("Device:C", "green-drive:C_Film_P5_P10"),
    "C_CER":   ("Device:C", "green-drive:C_Disc_P2.5_P5"),
    "C_EL":    ("Device:C_Polarized", "Capacitor_THT:CP_Radial_D5.0mm_P2.00mm"),
    "D":       ("Device:D", "Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal"),
    "D_PWR":   ("Device:D", "Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal"),
    "NPN_ECB": ("Transistor_BJT:Q_NPN_ECB", "Package_TO_SOT_THT:TO-92_Inline"),
    "OPAMP2":  ("Amplifier_Operational:LM2904", "Package_DIP:DIP-8_W7.62mm_Socket"),
    "POT":     ("Device:R_Potentiometer", "green-drive:Pot_WH148_16mm"),
    "LED":     ("Device:LED", "LED_THT:LED_D5.0mm"),
    "PAD":     ("Connector_Generic:Conn_01x01", "Connector_Wire:SolderWire-0.5sqmm_1x01_D0.9mm_OD2.1mm"),
}
FOOTPRINT_OVERRIDE = {"C12": "Capacitor_THT:CP_Radial_D6.3mm_P2.50mm"}

# Symbolic pin -> symbol pin number (also the footprint pad number).
PIN_NUMBERS = {
    "R": {1: 1, 2: 2}, "C_FILM": {1: 1, 2: 2}, "C_CER": {1: 1, 2: 2},
    "C_EL": {"+": 1, "-": 2},
    "D": {"K": 1, "A": 2}, "D_PWR": {"K": 1, "A": 2}, "LED": {"K": 1, "A": 2},
    "NPN_ECB": {"E": 1, "C": 2, "B": 3},
    "POT": {1: 1, 2: 2, 3: 3},
    "OPAMP2": {"OA": 1, "-A": 2, "+A": 3, "V-": 4, "+B": 5, "-B": 6, "OB": 7, "V+": 8},
    "PAD": {1: 1},
}

# Schematic groups, in reading order: (title, [refs])
GROUPS = [
    ("Input buffer", ["R19", "R1", "C1", "R2", "Q1", "R3"]),
    ("Clipping amplifier (op-amp A)", ["C2", "R4", "R6", "C3", "C11", "D1", "D3", "R5", "RV1"]),
    ("Tone (op-amp B)", ["R7", "C6", "R18", "R8", "RV2", "C10", "R9"]),
    ("Op-amp", ["U1"]),
    ("Level and output buffer", ["C5", "R10", "RV3", "R20", "C7", "R12", "Q2", "R13", "R14", "C8", "R15"]),
    ("Power, 4.5 V reference, LED", ["D4", "C12", "C13", "R16", "R17", "C9", "R21", "LED1", "#FLG1", "#FLG2"]),
    ("Wire pads: jacks, DC jack, footswitch", ["J1", "J2", "J3", "J4", "J5", "J6"]),
]
EXTRA = {  # in the schematic but not in design.py
    "#FLG1": ("power:PWR_FLAG", None, {1: "VCC"}),
    "#FLG2": ("power:PWR_FLAG", None, {1: "GND"}),
}


def uid():
    return str(uuid.uuid4())


def sexpr_block(text, start):
    depth = 0
    for j in range(start, len(text)):
        if text[j] == "(":
            depth += 1
        elif text[j] == ")":
            depth -= 1
            if depth == 0:
                return text[start:j + 1]
    raise ValueError("unbalanced")


def load_symbol(lib_id):
    lib, name = lib_id.split(":")
    text = (SYMBOLS / f"{lib}.kicad_sym").read_text()
    block = sexpr_block(text, text.index(f'(symbol "{name}"'))
    if "(extends" in block[:400]:
        raise ValueError(f"{lib_id} extends another symbol; pick its parent")
    pins = []  # (unit, number, x, y, angle)
    for sub in re.finditer(r'\(symbol "%s_(\d+)_\d+"' % re.escape(name), block):
        unit = int(sub.group(1))
        sb = sexpr_block(block, sub.start())
        for m in re.finditer(r'\(pin \w+ \w+\s*\(at ([-\d.]+) ([-\d.]+) (\d+)\).*?\(number "([^"]*)"', sb, re.S):
            pins.append((unit, m.group(4), float(m.group(1)), float(m.group(2)), int(m.group(3))))
    # In the schematic the top-level name carries the library prefix.
    block = block.replace(f'(symbol "{name}"', f'(symbol "{lib_id}"', 1)
    return block, pins


def g(v):
    return round(round(v / 1.27) * 1.27, 4)


def main():
    root = uid()
    parts = {ref: (value, kind, pins, note) for ref, value, kind, pins, note in design.PARTS}
    lib_cache, lib_blocks = {}, []

    def sym(lib_id):
        if lib_id not in lib_cache:
            block, pins = load_symbol(lib_id)
            lib_cache[lib_id] = pins
            lib_blocks.append(block)
        return lib_cache[lib_id]

    items = []

    def text(s, x, y, size=2.0):
        items.append(f'\t(text "{s}" (exclude_from_sim no) (at {x} {y} 0) (effects (font (size {size} {size}) (bold yes)) (justify left bottom)) (uuid "{uid()}"))')

    def place(ref, lib_id, value, footprint, netmap, x, y, unit=1, units_pins=None, dnp=False, desc=""):
        pins = sym(lib_id)
        pin_uuids = "\n".join(f'\t\t(pin "{p[1]}" (uuid "{uid()}"))' for p in pins if p[0] in (unit, 0))
        fp = footprint or ""
        hidden_ref = ref.startswith("#")
        # Parts with a pin on the right get their text underneath instead.
        side = any(u in (unit, 0) and num in netmap and ang == 180 for u, num, _px, _py, ang in pins)
        vertical = any(u in (unit, 0) and num in netmap and ang in (90, 270) for u, num, _px, _py, ang in pins)
        if side and vertical:   # pots: wiper on the right, ends top and bottom
            rx, ry, vy = x + 3.81, y + 3.81, y + 5.715
        elif side:
            rx, ry, vy = x - 2.54, y + 5.08, y + 6.985
        else:
            rx, ry, vy = x + 3.81, y - 1.27, y + 1.27
        items.append(f'''\t(symbol (lib_id "{lib_id}") (at {x} {y} 0) (unit {unit})
\t\t(exclude_from_sim no) (in_bom {"no" if hidden_ref or ref.startswith("J") else "yes"}) (on_board {"no" if hidden_ref else "yes"}) (dnp {"yes" if dnp else "no"})
\t\t(uuid "{uid()}")
\t\t(property "Reference" "{ref}" (at {rx} {ry} 0) (effects (font (size 1.27 1.27)) (justify left){" (hide yes)" if hidden_ref else ""}))
\t\t(property "Value" "{value}" (at {rx} {vy} 0) (effects (font (size 1.27 1.27)) (justify left)))
\t\t(property "Footprint" "{fp}" (at {x} {y} 0) (effects (font (size 1.27 1.27)) (hide yes)))
\t\t(property "Datasheet" "" (at {x} {y} 0) (effects (font (size 1.27 1.27)) (hide yes)))
\t\t(property "Description" "{desc}" (at {x} {y} 0) (effects (font (size 1.27 1.27)) (hide yes)))
{pin_uuids}
\t\t(instances (project "{PROJECT}" (path "/{root}" (reference "{ref}") (unit {unit}))))
\t)''')
        # A stub and a label on every connected pin of this unit.
        for u, num, px, py, ang in pins:
            if u not in (unit, 0) or num not in netmap:
                continue
            ax, ay = g(x + px), g(y - py)          # symbol y is up, sheet y is down
            out = (ang + 180) % 360                 # pin angle points into the body
            dx, dy = {0: (2.54, 0), 90: (0, -2.54), 180: (-2.54, 0), 270: (0, 2.54)}[out]
            bx, by = g(ax + dx), g(ay + dy)
            items.append(f'\t(wire (pts (xy {ax} {ay}) (xy {bx} {by})) (stroke (width 0) (type default)) (uuid "{uid()}"))')
            just = {0: "left bottom", 90: "left bottom", 180: "right bottom", 270: "right bottom"}[out]
            items.append(f'\t(label "{netmap[num]}" (at {bx} {by} {out if out in (0, 90) else (out - 180)}) (effects (font (size 1.27 1.27)) (justify {just})) (uuid "{uid()}"))')

    y0 = 25.4
    for title, refs in GROUPS:
        text(title, 25.4, y0)
        x, y = 38.1, y0 + 15.24
        for ref in refs:
            if ref in EXTRA:
                lib_id, fp, pins = EXTRA[ref]
                value = "PWR_FLAG" if ref.startswith("#") else "M3"
                place(ref, lib_id, value, fp, {str(k): v for k, v in pins.items()}, x, y)
                x += 25.4
                continue
            value, kind, pins, note = parts[ref]
            lib_id, fp = PARTS_LIB[kind]
            fp = FOOTPRINT_OVERRIDE.get(ref, fp)
            nums = {str(PIN_NUMBERS[kind][k]): net for k, net in pins.items()}
            if kind == "OPAMP2":
                for unit in (1, 2, 3):
                    place(ref, lib_id, value, fp, nums, x, y, unit=unit, desc=note)
                    x += 38.1
                continue
            place(ref, lib_id, value, fp, nums, x, y, desc=note)
            x += 25.4
            if x > 300:
                x, y = 38.1, y + 25.4
        y0 = y + 30.48

    sch = f'''(kicad_sch
\t(version 20250114)
\t(generator "green-drive-build")
\t(generator_version "10.0")
\t(uuid "{root}")
\t(paper "A2")
\t(title_block (title "Green Drive") (comment 1 "Generated by hardware/green-drive/build.py from design.py; matches pedals/green-drive.cir (check.py)"))
\t(lib_symbols
{chr(10).join(lib_blocks)}
\t)
{chr(10).join(items)}
\t(sheet_instances (path "/" (page "1")))
)
'''
    (HERE / f"{PROJECT}.kicad_sch").write_text(sch)
    (HERE / "fp-lib-table").write_text(
        '(fp_lib_table\n\t(version 7)\n\t(lib (name "green-drive") (type "KiCad") (uri "${KIPRJMOD}/green-drive.pretty") (options "") (descr "Green Drive footprints"))\n)\n')
    pro = HERE / f"{PROJECT}.kicad_pro"
    if not pro.exists():
        pro.write_text('{\n  "meta": { "filename": "green-drive.kicad_pro", "version": 3 }\n}\n')
    print("wrote", f"{PROJECT}.kicad_sch")

    out = HERE / "out"
    out.mkdir(exist_ok=True)
    run([CLI, "sch", "export", "netlist", "--output", out / "green-drive.net", HERE / f"{PROJECT}.kicad_sch"])
    erc = subprocess.run([CLI, "sch", "erc", "--severity-error", "--severity-warning", "--exit-code-violations",
                          "--output", out / "erc.rpt", HERE / f"{PROJECT}.kicad_sch"], capture_output=True, text=True)
    print(erc.stdout.strip().splitlines()[-1] if erc.stdout.strip() else "", "(ERC: out/erc.rpt)")
    run([sys.executable, HERE / "check.py", "--net", out / "green-drive.net"])
    run([CLI, "sch", "export", "pdf", "--output", out / "green-drive-schematic.pdf", HERE / f"{PROJECT}.kicad_sch"])


def run(cmd):
    res = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if res.stdout.strip():
        print(res.stdout.strip())
    if res.returncode:
        print(res.stderr)
        sys.exit(res.returncode)


if __name__ == "__main__":
    main()
