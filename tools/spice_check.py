#!/usr/bin/env python3
"""Validate a pedal netlist: PhreakGuitar's circuit engine vs ngspice.

Both simulate the SAME netlist file with the same input and knob settings.
The engine runs its solver directly at --rate (no oversampling filters, so
the comparison sees only the solver); ngspice runs a transient with its
step capped at the same interval. The error is the RMS difference relative
to the RMS of the ngspice output, after a settling period.

usage: spice_check.py RENDER pedals/x.cir [--knob name=0..1 ...]
                      [--rate 192000] [--freq 220] [--amp 0.2]
                      [--dur 0.06] [--settle 0.01] [--max-err-db -40]

Exit 1 if the error exceeds --max-err-db. Needs ngspice on PATH.
"""

import argparse
import math
import os
import re
import struct
import subprocess
import sys
import tempfile
import wave


def write_wav_float(path, samples, sr):
    data = struct.pack(f"<{len(samples)}f", *samples)
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE")
        f.write(b"fmt " + struct.pack("<IHHIIHH", 16, 3, 1, sr, sr * 4, 4, 32))
        f.write(b"data" + struct.pack("<I", len(data)) + data)


def read_wav_any(path):
    with open(path, "rb") as f:
        b = f.read()
    pos, fmt = 12, None
    while pos + 8 <= len(b):
        cid, size = b[pos:pos + 4], struct.unpack_from("<I", b, pos + 4)[0]
        body = pos + 8
        if cid == b"fmt ":
            tag, ch, sr = struct.unpack_from("<HHI", b, body)
            bits = struct.unpack_from("<H", b, body + 14)[0]
            if tag == 0xFFFE:
                tag = struct.unpack_from("<H", b, body + 24)[0]
            fmt = (tag, ch, sr, bits)
        elif cid == b"data" and fmt:
            tag, ch, sr, bits = fmt
            n = size // (bits // 8 * ch)
            if tag == 3:
                vals = struct.unpack_from(f"<{n * ch}f", b, body)
            elif bits == 24:
                vals = [int.from_bytes(b[body + 3 * i: body + 3 * i + 3], "little", signed=True) / 8388608
                        for i in range(n * ch)]
            else:
                vals = [v / 32768 for v in struct.unpack_from(f"<{n * ch}h", b, body)]
            return list(vals[0::ch]), sr
        pos = body + size + (size & 1)
    raise ValueError(f"no data in {path}")


def controls(netlist):
    out = {}
    for line in netlist.splitlines():
        m = re.match(r"\*@control\s+(\S+)(.*)", line.strip(), re.I)
        if m:
            rest = m.group(2)
            taper = re.search(r"taper=(\w+)", rest, re.I)
            default = re.search(r"default=([\d.]+)", rest, re.I)
            out[m.group(1).lower()] = {
                "taper": (taper.group(1).lower() if taper else "lin"),
                "default": float(default.group(1)) if default else 0.5,
            }
    return out


def taper(kind, k):
    k = min(1.0, max(0.0, k))
    if kind == "audio":
        return (math.exp(3.4 * k) - 1) / (math.exp(3.4) - 1)  # = applyTaper()
    if kind == "revaudio":
        return 1 - taper("audio", 1 - k)
    return k


def input_source(netlist):
    m = re.search(r"^\*@input\s+(\S+)", netlist, re.I | re.M)
    return m.group(1) if m else None


def output_node(netlist):
    m = re.search(r"^\*@output\s+(\S+)", netlist, re.I | re.M)
    return m.group(1) if m else None


# ngspice accuracy settings, tightest first. Small circuits run with the
# strict set; bigger ones (op-amp macromodels) can abort with "timestep too
# small" under it and fall back to near-default tolerances.
TOLERANCES = [
    "reltol=1e-6 vntol=1e-9 abstol=1e-15",
    "reltol=1e-4 vntol=1e-6 abstol=1e-12",
]


def spice_deck(netlist, knobs, samples, rate, out_file, tolerances=TOLERANCES[0]):
    src = input_source(netlist)
    dt = 1.0 / rate
    lines = []
    for line in netlist.splitlines():
        low = line.strip().lower()
        if low == ".end":
            continue
        if low.startswith(".param") and any(re.match(rf"\.param\s+{k}\s*=", low) for k in knobs):
            continue
        tok = line.split()
        if tok and tok[0].lower() == src.lower():
            # Same samples, piecewise-linear between them (what the
            # engine's trapezoidal rule assumes too).
            pts = [f"{i * dt:.12g} {v:.9g}" for i, v in enumerate(samples)]
            lines.append(f"{tok[0]} {tok[1]} {tok[2]} PWL(")
            for i in range(0, len(pts), 8):
                lines.append("+ " + " ".join(pts[i:i + 8]))
            lines.append("+ )")
            continue
        lines.append(line)
    for name, pos in knobs.items():
        lines.append(f".param {name}={pos:.12g}")
    stop = (len(samples) - 1) * dt
    lines += [
        f".options {tolerances} method=trap",
        ".control",
        f"tran {dt:.12g} {stop:.12g} 0 {dt:.12g}",
        f"linearize v({output_node(netlist)})",
        f"wrdata {out_file} v({output_node(netlist)})",
        "quit",
        ".endc",
        ".end",
    ]
    return "\n".join(lines) + "\n"


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("render")
    p.add_argument("pedal")
    p.add_argument("--knob", action="append", default=[])
    p.add_argument("--rate", type=int, default=192000)
    p.add_argument("--freq", type=float, default=220.0)
    p.add_argument("--amp", type=float, default=0.2)
    p.add_argument("--dur", type=float, default=0.06)
    p.add_argument("--settle", type=float, default=0.01)
    p.add_argument("--max-err-db", type=float, default=-40.0)
    a = p.parse_args()

    netlist = open(a.pedal).read()
    ctl = controls(netlist)
    knob01 = {k: v["default"] for k, v in ctl.items()}
    for kv in a.knob:
        k, v = kv.split("=")
        knob01[k.lower()] = float(v)
    knobs = {k: taper(ctl[k]["taper"], v) for k, v in knob01.items()}

    n = int(a.dur * a.rate)
    x = [a.amp * math.sin(2 * math.pi * a.freq * i / a.rate) for i in range(n)]

    with tempfile.TemporaryDirectory() as tmp:
        wav_in, wav_out, sp_out = (os.path.join(tmp, f) for f in ("in.wav", "eng.wav", "spice.txt"))
        write_wav_float(wav_in, x, a.rate)
        cmd = [a.render, wav_in, wav_out, "--pedal", a.pedal, "--os", "1", "--block", "512"]
        for k, v in knob01.items():
            cmd += ["--knob", f"{k}={v}"]
        subprocess.run(cmd, check=True, capture_output=True)
        eng, _ = read_wav_any(wav_out)

        deck = os.path.join(tmp, "deck.cir")
        ref, used = None, None
        for tol in TOLERANCES:
            with open(deck, "w") as f:
                f.write(spice_deck(netlist, knobs, x, a.rate, sp_out, tol))
            if os.path.exists(sp_out):
                os.remove(sp_out)
            try:
                r = subprocess.run(["ngspice", "-b", deck], capture_output=True, text=True, timeout=180)
                aborted = "aborted" in r.stdout + r.stderr
            except subprocess.TimeoutExpired as e:
                # The strict set can crawl on large circuits: treat as a
                # failed attempt and try the next tolerance set.
                r = subprocess.CompletedProcess(e.cmd, 1, "timed out", "")
                aborted = True
            if os.path.exists(sp_out) and not aborted:
                ref = [float(line.split()[1]) for line in open(sp_out) if line.strip()]
                used = tol
                break
        if ref is None:
            print(r.stdout[-2000:], r.stderr[-2000:])
            print("FAIL: ngspice could not simulate the circuit")
            return 1

    m = min(len(ref), len(eng))
    start = int(a.settle * a.rate)
    err = [eng[i] - ref[i] for i in range(start, m)]
    rms_ref = math.sqrt(sum(ref[i] ** 2 for i in range(start, m)) / (m - start))
    rms_err = math.sqrt(sum(e * e for e in err) / len(err))
    peak_ref = max(abs(ref[i]) for i in range(start, m))
    err_db = 20 * math.log10(max(rms_err, 1e-15) / max(rms_ref, 1e-15))
    settings = " ".join(f"{k}={v:g}" for k, v in knob01.items())
    print(f"{os.path.basename(a.pedal)} [{settings}] {a.amp} V {a.freq:g} Hz @ {a.rate} Hz: "
          f"out {peak_ref:.3f} V peak, error {err_db:6.1f} dB rms (budget {a.max_err_db} dB)"
          + ("" if used == TOLERANCES[0] else "  [ngspice at standard tolerances]"))
    if err_db > a.max_err_db:
        print("FAIL")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
