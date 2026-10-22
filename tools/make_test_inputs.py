#!/usr/bin/env python3
"""Generate deterministic test input WAVs for the render harness goldens.

- sine1k.wav: 1 kHz sine, -12 dBFS, 2 s. Used for the passthrough and
  driven goldens.
- sine997.wav: 997 Hz sine, -12 dBFS, 2 s. For the aliasing measurement
  (compare.py spectrum): 997 doesn't divide 48000, so aliases land
  between harmonics where they can be seen. At 1 kHz every alias folds
  exactly onto a harmonic and the check is blind.

48 kHz, mono, 24-bit, stdlib only.
"""

import math
import struct
import wave
from pathlib import Path

SR = 48000
OUT_DIR = Path(__file__).resolve().parent.parent / "tests" / "golden"


def write_wav(path, samples):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(3)  # 24-bit
        w.setframerate(SR)
        frames = bytearray()
        for s in samples:
            v = max(-8388608, min(8388607, int(round(s * 8388607.0))))
            frames += struct.pack("<i", v)[:3]
        w.writeframes(bytes(frames))
    print(f"wrote {path}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    amp = 10.0 ** (-12.0 / 20.0)  # -12 dBFS
    length = 2 * SR
    sine = [amp * math.sin(2.0 * math.pi * 1000.0 * i / SR) for i in range(length)]
    write_wav(OUT_DIR / "sine1k.wav", sine)
    sine997 = [amp * math.sin(2.0 * math.pi * 997.0 * i / SR) for i in range(length)]
    write_wav(OUT_DIR / "sine997.wav", sine997)


if __name__ == "__main__":
    main()
