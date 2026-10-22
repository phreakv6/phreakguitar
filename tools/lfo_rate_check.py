#!/usr/bin/env python3
"""Check a pedal's in-circuit LFO: its rate in PhreakGuitar's engine vs ngspice.

usage: lfo_rate_check.py RENDER pedals/x.cir NODE [--knob name=0..1 ...]
                         [--secs 4] [--settle 1] [--max-err 0.01]

Reads NODE (the LFO's capacitor, say) in both: the engine renders the
pedal with NODE as its output (silence in, the LFO runs by itself);
ngspice runs a transient of the same file. The rate is measured from
mid-level crossings after the settling time (the oscillator starts by
tipping off its balanced DC point in both). Exit 1 if the rates differ
by more than --max-err (relative). Needs ngspice on PATH.
"""
import argparse
import math
import os
import re
import subprocess
import sys
import tempfile
import wave

sys.path.insert(0, os.path.dirname(__file__))
from compare import read_wav  # noqa: E402


def taper(kind, k):
    audio = lambda k: (math.exp(3.4 * k) - 1.0) / (math.exp(3.4) - 1.0)
    return audio(k) if kind == "audio" else 1.0 - audio(1.0 - k) if kind == "revaudio" else k


def rate(t, v, after):
    idx = [i for i in range(len(t)) if t[i] > after]
    x = [v[i] for i in idx]
    mid = (max(x) + min(x)) / 2
    cross = [t[i] for i in idx[1:] if (v[i - 1] - mid) * (v[i] - mid) < 0]
    if len(cross) < 3:
        return 0.0
    return (len(cross) - 1) / 2 / (cross[-1] - cross[0])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("render")
    ap.add_argument("pedal")
    ap.add_argument("node")
    ap.add_argument("--knob", action="append", default=[])
    ap.add_argument("--secs", type=float, default=4.0)
    ap.add_argument("--settle", type=float, default=1.0)
    ap.add_argument("--max-err", type=float, default=0.01)
    a = ap.parse_args()

    text = open(a.pedal).read()
    knobs = dict(k.split("=") for k in a.knob)
    tapers = {m[0].lower(): (re.search(r"taper=(\w+)", m[1]) or [None, "lin"])[1]
              for m in re.findall(r"^\*@control\s+(\S+)(.*)$", text, re.M | re.I)}

    with tempfile.TemporaryDirectory() as tmp:
        probe = os.path.join(tmp, "probe.cir")
        open(probe, "w").write(re.sub(r"^\*@output\s+\S+", f"*@output {a.node}", text, flags=re.M))
        sr = 48000
        silence = os.path.join(tmp, "silence.wav")
        with wave.open(silence, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(bytes(2 * int(a.secs * sr)))
        out = os.path.join(tmp, "engine.wav")
        cmd = [a.render, silence, out, "--pedal", probe]
        for k, v in knobs.items():
            cmd += ["--knob", f"{k}={v}"]
        subprocess.run(cmd, check=True, capture_output=True)
        y, sr = read_wav(out)
        step = 24
        engine = rate([i / sr for i in range(0, len(y), step)], y[::step], a.settle)

        deck = os.path.join(tmp, "deck.cir")
        params = "".join(f".param {k}={taper(tapers.get(k, 'lin'), float(v))}\n" for k, v in knobs.items())
        body = re.sub(r"^\.end\s*$", "", text, flags=re.M | re.I)
        for k in knobs:  # the file's own default for a knob we set
            body = re.sub(rf"^\.param\s+{k}=.*$", "", body, flags=re.M | re.I)
        data = os.path.join(tmp, "lfo.txt")
        open(deck, "w").write(body + params + f".control\ntran 100u {a.secs}\nwrdata {data} v({a.node})\n.endc\n.end\n")
        subprocess.run(["ngspice", "-b", deck], check=True, capture_output=True)
        rows = [list(map(float, l.split())) for l in open(data)]
        spice = rate([r[0] for r in rows], [r[1] for r in rows], a.settle)

    err = abs(engine - spice) / max(spice, 1e-9)
    ok = spice > 0 and err <= a.max_err
    print(f"{os.path.basename(a.pedal)} {a.node} {knobs}: engine {engine:.3f} Hz, ngspice {spice:.3f} Hz, "
          f"{100 * err:.2f} % (budget {100 * a.max_err:.1f} %)")
    print("OK" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
