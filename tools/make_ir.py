#!/usr/bin/env python3
"""Synthesize the built-in cabinet IRs (resources/irs/*.wav).

License-free stand-ins for real cab captures — filtered impulses shaped to
plausible guitar-speaker responses, plus early reflections and a short
decaying "room" noise tail. Real third-party IRs cannot be bundled (their
EULAs forbid redistribution); users load those via the IR file button.

Three voicings:
  ir_tweed410  — low cut 75 Hz, low-mid thump, paper-cone rolloff ~5 kHz
  ir_brit412   — bigger low end, forward mids, darker top, bigger box
  ir_black112  — scooped mids, sparkle peak, brighter, small box

Deterministic (fixed seeds), stdlib only. 48 kHz, mono, 24-bit, 4096 samples.
"""

import math
import random
import struct
import wave
from pathlib import Path

SR = 48000
LENGTH = 4096
OUT_DIR = Path(__file__).resolve().parent.parent / "resources" / "irs"


def biquad_coeffs(kind, freq, q, gain_db=0.0):
    """RBJ cookbook biquads. Returns (b0, b1, b2, a1, a2), a0-normalized."""
    a = 10.0 ** (gain_db / 40.0)
    w0 = 2.0 * math.pi * freq / SR
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2.0 * q)

    if kind == "highpass":
        b0, b1, b2 = (1 + cw) / 2, -(1 + cw), (1 + cw) / 2
        a0, a1, a2 = 1 + alpha, -2 * cw, 1 - alpha
    elif kind == "lowpass":
        b0, b1, b2 = (1 - cw) / 2, 1 - cw, (1 - cw) / 2
        a0, a1, a2 = 1 + alpha, -2 * cw, 1 - alpha
    elif kind == "peak":
        b0, b1, b2 = 1 + alpha * a, -2 * cw, 1 - alpha * a
        a0, a1, a2 = 1 + alpha / a, -2 * cw, 1 - alpha / a
    else:
        raise ValueError(kind)

    return b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0


def filt(samples, kind, freq, q, gain_db=0.0):
    b0, b1, b2, a1, a2 = biquad_coeffs(kind, freq, q, gain_db)
    out, x1, x2, y1, y2 = [], 0.0, 0.0, 0.0, 0.0
    for x in samples:
        y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x, y1, y
        out.append(y)
    return out


CABS = {
    "ir_tweed410": dict(
        seed=1959,
        filters=[
            ("highpass", 75.0, 0.707, 0.0),
            ("peak", 110.0, 1.0, 4.0),      # low-mid thump
            ("peak", 480.0, 1.2, -2.5),     # boxiness scoop
            ("peak", 2600.0, 1.4, 2.0),     # presence edge
            ("lowpass", 4800.0, 0.65, 0.0), # paper-cone rolloff...
            ("lowpass", 6500.0, 0.707, 0.0) # ...made steeper
        ],
        reflections=((3.1, -0.25), (6.8, 0.12)),
        tail_tau=0.018,
    ),
    "ir_brit412": dict(
        seed=1962,
        filters=[
            ("highpass", 70.0, 0.75, 0.0),
            ("peak", 140.0, 1.1, 5.0),      # big low-end thump
            ("peak", 550.0, 1.0, -3.0),     # scoop
            ("peak", 2200.0, 1.3, 3.5),     # aggressive upper mids
            ("lowpass", 4200.0, 0.7, 0.0),  # darker top
            ("lowpass", 5500.0, 0.707, 0.0)
        ],
        reflections=((4.2, -0.28), (8.9, 0.15)),  # bigger box
        tail_tau=0.022,
    ),
    "ir_black112": dict(
        seed=1965,
        filters=[
            ("highpass", 90.0, 0.707, 0.0),
            ("peak", 180.0, 1.0, 3.0),
            ("peak", 400.0, 1.0, -4.5),     # the classic mid scoop
            ("peak", 3400.0, 1.2, 4.0),     # sparkle
            ("lowpass", 5800.0, 0.7, 0.0),  # brighter cone
            ("lowpass", 7500.0, 0.707, 0.0)
        ],
        reflections=((2.2, -0.22), (5.1, 0.10)),  # small box
        tail_tau=0.014,
    ),
}


def synthesize(name, recipe):
    rng = random.Random(recipe["seed"])

    sig = [1.0] + [0.0] * (LENGTH - 1)
    for kind, freq, q, gain in recipe["filters"]:
        sig = filt(sig, kind, freq, q, gain)

    # Early reflections (cab panels / floor bounce).
    for delay_ms, gain in recipe["reflections"]:
        d = int(SR * delay_ms / 1000.0)
        for i in range(LENGTH - d - 1, -1, -1):
            sig[i + d] += sig[i] * gain

    # Short decaying noise tail for a hint of room.
    tau = recipe["tail_tau"]
    noise = [rng.uniform(-1.0, 1.0) * math.exp(-i / (tau * SR)) for i in range(LENGTH)]
    noise = filt(noise, "lowpass", 2000.0, 0.707)
    sig = [s + n * 0.03 for s, n in zip(sig, noise)]

    peak = max(abs(s) for s in sig)
    sig = [0.6 * s / peak for s in sig]

    path = OUT_DIR / f"{name}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(3)  # 24-bit
        w.setframerate(SR)
        frames = bytearray()
        for s in sig:
            v = max(-8388608, min(8388607, int(round(s * 8388607.0))))
            frames += struct.pack("<i", v)[:3]
        w.writeframes(bytes(frames))
    print(f"wrote {path}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, recipe in CABS.items():
        synthesize(name, recipe)


if __name__ == "__main__":
    main()
