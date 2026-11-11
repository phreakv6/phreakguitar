"""
Check the board against the circuit the app plays.

    python3 check.py                  # design.py vs pedals/green-drive.cir
    python3 check.py --net board.net  # KiCad's exported netlist vs the .cir
    python3 check.py --op             # DC voltages to measure on the board

Every element of the .cir's audio circuit must be on the board with each of
its nodes on the same net, and the board must have nothing else on the
audio path beyond the parts design.py lists as added. With --net the board
side is read from what KiCad actually wired, so a slip in the schematic is
caught too.
"""

import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CIR = HERE.parent.parent / "pedals" / "green-drive.cir"
sys.path.insert(0, str(HERE))
import design  # noqa: E402

# The .cir's test fixtures: the guitar, the amp, the supply source.
FIXTURES = {"VIN", "RPICKUP", "RLOAD", "VCC"}


def cir_elements(text):
    """Top-level elements of the .cir: name -> [nodes]."""
    out, depth = {}, 0
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("*"):
            continue
        low = s.lower()
        if low.startswith(".subckt"):
            depth += 1
            continue
        if low.startswith(".ends"):
            depth -= 1
            continue
        if depth or s.startswith("."):
            continue
        tok = s.split()
        name = tok[0].upper()
        if name in FIXTURES:
            continue
        n = {"R": 2, "C": 2, "D": 2, "Q": 3}.get(name[0])
        if name[0] == "X":  # subcircuit: nodes up to the subckt name
            nodes = [t for t in tok[1:] if "=" not in t][:-1]
        else:
            nodes = tok[1:1 + n]
        out[name] = [x.lower() for x in nodes]
    return out


def board_pins_from_design():
    """ref -> {symbolic pin: net} straight from design.py."""
    return {ref: dict(pins) for ref, _v, _k, pins, _n in design.PARTS}


def board_pins_from_kicad(path):
    """ref -> {symbolic pin: net} from a KiCad .net file (pin numbers mapped
    back to symbolic names with build.PIN_NUMBERS)."""
    import build
    kinds = {ref: kind for ref, _v, kind, _p, _n in design.PARTS}
    text = Path(path).read_text()
    out = {}
    for chunk in re.split(r"\(net\s+\(code", text)[1:]:
        net = re.search(r'\(name "([^"]*)"\)', chunk).group(1).lstrip("/")
        for ref, pin in re.findall(r'\(node\s+\(ref "([^"]+)"\)\s+\(pin "([^"]+)"\)', chunk):
            if ref not in kinds:   # power flags, mounting holes
                continue
            num_to_sym = {str(v): k for k, v in build.PIN_NUMBERS[kinds[ref]].items()}
            out.setdefault(ref, {})[num_to_sym[pin]] = net
    missing = set(kinds) - set(out)
    if missing:
        raise SystemExit(f"parts with no connections in the netlist: {sorted(missing)}")
    return out


def to_cir_net(net):
    return design.NET_TO_CIR.get(net, net.lower())


def compare(board):
    cir = cir_elements(CIR.read_text())
    kinds = {ref: kind for ref, _v, kind, _p, _n in design.PARTS}
    errors, matched = [], set()

    for ref, pins in board.items():
        kind = kinds[ref]
        if ref in design.NOT_IN_CIR or kind == "PAD":
            continue
        if kind == "OPAMP2":
            for xname, order in design.CIR_OPAMPS.items():
                got = [to_cir_net(pins[p]) for p in order]
                want = cir.get(xname)
                if got != want:
                    errors.append(f"{ref} as {xname}: board {got}, .cir {want}")
                matched.add(xname)
            continue
        name = design.CIR_NAME.get(ref, ref)
        order = design.CIR_EL_ORDER[ref] if kind == "C_EL" else design.CIR_PINS[kind]
        got = [to_cir_net(pins[p]) for p in order]
        want = cir.get(name)
        if want is not None and kind in ("R", "C_FILM", "C_CER"):
            got, want = sorted(got), sorted(want)  # no polarity
        if want is None:
            errors.append(f"{ref}: not in the .cir (add it to NOT_IN_CIR if it's meant)")
        elif got != want:
            errors.append(f"{ref}: board {got}, .cir {name} {want}")
        matched.add(name)

    for name in cir:
        if name not in matched:
            errors.append(f".cir {name} {cir[name]} has no part on the board")

    # Added parts must not touch the audio path except where design.py says.
    audio_nets = {n for nodes in cir.values() for n in nodes} - {"0", "vcc", "vref"}
    allowed = {("R19", "in"), ("R20", "lw"), ("J1", "in"), ("J2", "out")}
    for ref, pins in board.items():
        if ref in design.NOT_IN_CIR or kinds[ref] == "PAD":
            for net in pins.values():
                n = to_cir_net(net)
                if n in audio_nets and (ref, n) not in allowed:
                    errors.append(f"{ref} touches audio net {n}")
    return errors, len(matched)


def operating_point():
    """DC voltage at every node, from ngspice on the .cir itself."""
    text = CIR.read_text().replace(".end\n", "")
    text += "\n.control\nop\nprint all\nquit\n.endc\n.end\n"
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "op.cir"
        p.write_text(text)
        res = subprocess.run(["ngspice", "-b", str(p)], capture_output=True, text=True)
    v = {}
    for m in re.finditer(r"^\s*([\w.#:]+)\s*=\s*([-+0-9.eE]+)", res.stdout, re.M):
        v[m.group(1).lower()] = float(m.group(2))
    return v


def main():
    args = sys.argv[1:]
    if "--op" in args:
        v = operating_point()
        print("DC voltages (9 V supply; the board's diode drops ~0.4 V, so expect a little less):")
        for node in ["vcc", "vref", "b1", "e1", "p1", "m1", "o1", "p2", "m2", "o2", "b2", "e2"]:
            print(f"  {node.upper():5s} {v.get(node, float('nan')):6.2f} V")
        print("Electrolytics (+ must be the higher side):")
        for ref, _v, kind, pins, _n in design.PARTS:
            if kind == "C_EL":
                hi = v.get(to_cir_net(pins["+"]), 0.0) if to_cir_net(pins["+"]) != "0" else 0.0
                lo = v.get(to_cir_net(pins["-"]), 0.0) if to_cir_net(pins["-"]) != "0" else 0.0
                if pins["+"] in ("VCC",):
                    hi = v.get("vcc", 9.0)
                ok = "ok" if hi >= lo else "REVERSED"
                print(f"  {ref:6s} + {pins['+']:5s} {hi:5.2f} V   - {pins['-']:5s} {lo:5.2f} V   {ok}")
        return

    if "--net" in args:
        board = board_pins_from_kicad(args[args.index("--net") + 1])
        src = "KiCad netlist"
    else:
        board = board_pins_from_design()
        src = "design.py"
    errors, n = compare(board)
    if errors:
        print(f"{src} does NOT match pedals/green-drive.cir:")
        for e in errors:
            print("  " + e)
        sys.exit(1)
    print(f"{src} matches pedals/green-drive.cir: all {n} audio-circuit elements, every node.")


if __name__ == "__main__":
    main()
