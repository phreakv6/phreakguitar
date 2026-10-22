#!/usr/bin/env python3
"""Golden-file comparison and aliasing measurement for render outputs.

Modes:
  compare.py diff rendered.wav golden.wav [--tol-peak-db -84] [--tol-rms-db X]
      Sample-wise diff. Fails (exit 1) if the peak (or, when given, RMS)
      difference exceeds tolerance. Used for regression goldens and for
      WASM-vs-native parity (SPEC-web: <= 1e-5 RMS, i.e. -100 dB).

  compare.py spectrum out.wav --fundamental 997 [--max-spur-db -80] [--max-freq 20000]
      FFT of the middle of the file; every bin in 20 Hz..max-freq not near
      a harmonic of the fundamental is a spur (aliasing, since the input was
      a pure tone). The fundamental must NOT divide the sample rate (1 kHz
      at 48 kHz folds every alias exactly onto a harmonic and hides it).
      Fails if the loudest spur exceeds the budget (dBFS). SPEC budget: -80.

Stdlib only (includes a small radix-2 FFT).
"""

import argparse
import cmath
import math
import struct
import sys
import wave


def read_wav(path):
    """Return (samples_ch0 as floats, sample_rate). 16/24/32-bit PCM or
    32-bit float (the pedal renders, which carry volts unclipped)."""
    with open(path, "rb") as f:
        head = f.read(4096)
    fmt = head.find(b"fmt ")
    if fmt >= 0:
        tag = struct.unpack_from("<H", head, fmt + 8)[0]
        if tag == 0xFFFE:  # WAVE_FORMAT_EXTENSIBLE: real format is the subformat
            tag = struct.unpack_from("<H", head, fmt + 8 + 24)[0]
        if tag == 3:
            return read_wav_float(path)
    with wave.open(path, "rb") as w:
        n, width, channels, sr = (
            w.getnframes(), w.getsampwidth(), w.getnchannels(), w.getframerate())
        raw = w.readframes(n)

    samples = []
    stride = width * channels
    if width == 2:
        for i in range(n):
            (v,) = struct.unpack_from("<h", raw, i * stride)
            samples.append(v / 32768.0)
    elif width == 3:
        for i in range(n):
            b = raw[i * stride: i * stride + 3]
            v = int.from_bytes(b, "little", signed=True)
            samples.append(v / 8388608.0)
    elif width == 4:
        for i in range(n):
            (v,) = struct.unpack_from("<i", raw, i * stride)
            samples.append(v / 2147483648.0)
    else:
        raise ValueError(f"unsupported sample width: {width}")
    return samples, sr


def read_wav_float(path):
    with open(path, "rb") as f:
        b = f.read()
    pos, ch, sr = 12, 1, 48000
    while pos + 8 <= len(b):
        cid, size = b[pos:pos + 4], struct.unpack_from("<I", b, pos + 4)[0]
        if cid == b"fmt ":
            ch, sr = struct.unpack_from("<HI", b, pos + 10)
        elif cid == b"data":
            vals = struct.unpack_from(f"<{size // 4}f", b, pos + 8)
            return list(vals[0::ch]), sr
        pos += 8 + size + (size & 1)
    raise ValueError(f"no data chunk in {path}")


def db(x):
    return 20.0 * math.log10(max(x, 1e-12))


def fft(x):
    """Iterative radix-2 FFT (input length must be a power of two)."""
    n = len(x)
    if n & (n - 1):
        raise ValueError("length must be a power of two")
    # bit-reversal permutation
    j = 0
    x = list(x)
    for i in range(1, n):
        bit = n >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j |= bit
        if i < j:
            x[i], x[j] = x[j], x[i]
    length = 2
    while length <= n:
        ang = -2.0 * math.pi / length
        wlen = cmath.exp(1j * ang)
        for i in range(0, n, length):
            w = 1.0 + 0j
            for k in range(i, i + length // 2):
                u, v = x[k], x[k + length // 2] * w
                x[k], x[k + length // 2] = u + v, u - v
                w *= wlen
        length <<= 1
    return x


def cmd_diff(args):
    a, sr_a = read_wav(args.rendered)
    b, sr_b = read_wav(args.golden)

    if sr_a != sr_b or len(a) != len(b):
        print(f"FAIL: shape mismatch ({len(a)}@{sr_a} vs {len(b)}@{sr_b})")
        return 1

    peak = max(abs(x - y) for x, y in zip(a, b))
    rms = math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)) / len(a))
    rms_tol = "" if args.tol_rms_db is None else f", {args.tol_rms_db} dB rms"
    print(f"peak diff: {db(peak):7.2f} dB   rms diff: {db(rms):7.2f} dB   "
          f"(tolerance {args.tol_peak_db} dB peak{rms_tol})")

    if db(peak) > args.tol_peak_db or (
            args.tol_rms_db is not None and db(rms) > args.tol_rms_db):
        print("FAIL")
        return 1
    print("OK")
    return 0


def cmd_spectrum(args):
    samples, sr = read_wav(args.file)

    n = 32768
    if len(samples) < n:
        print(f"FAIL: file too short ({len(samples)} < {n})")
        return 1

    start = (len(samples) - n) // 2  # skip transients at both ends

    # 4-term Blackman-Harris: -92 dB sidelobes, so harmonic leakage can't
    # masquerade as a spur when measuring an -80 dB floor (Hann's -31 dB
    # sidelobes can and did).
    a0, a1, a2, a3 = 0.35875, 0.48829, 0.14128, 0.01168
    windowed = []
    for i in range(n):
        t = 2.0 * math.pi * i / (n - 1)
        w = a0 - a1 * math.cos(t) + a2 * math.cos(2 * t) - a3 * math.cos(3 * t)
        windowed.append(samples[start + i] * w)

    spec = fft(windowed)
    # Scale by coherent gain so a full-scale sine reads 0 dBFS.
    mags = [abs(spec[i]) * 2.0 / (n * a0) for i in range(n // 2)]

    bin_hz = sr / n
    fund_bin_f = args.fundamental / bin_hz  # float: keeps harmonics aligned
    fund_bin = int(round(fund_bin_f))
    guard = 6  # main lobe + slop, in bins

    def near_harmonic(i):
        h = int(round(i / fund_bin_f)) if fund_bin_f > 0 else 0
        return h >= 1 and abs(i - h * fund_bin_f) <= guard

    worst_db, worst_hz = -999.0, 0.0
    for i in range(guard + 1, n // 2):
        if near_harmonic(i) or i * bin_hz < 20.0 or i * bin_hz > args.max_freq:
            continue
        level = db(mags[i])
        if level > worst_db:
            worst_db, worst_hz = level, i * bin_hz

    fund_db = db(mags[fund_bin]) if fund_bin < len(mags) else -999.0
    print(f"fundamental: {fund_db:6.1f} dBFS @ {args.fundamental} Hz")
    print(f"worst spur:  {worst_db:6.1f} dBFS @ {worst_hz:.0f} Hz   "
          f"(budget {args.max_spur_db} dBFS)")

    if worst_db > args.max_spur_db:
        print("FAIL")
        return 1
    print("OK")
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("diff")
    d.add_argument("rendered")
    d.add_argument("golden")
    d.add_argument("--tol-peak-db", type=float, default=-84.0)
    d.add_argument("--tol-rms-db", type=float, default=None)
    d.set_defaults(func=cmd_diff)

    s = sub.add_parser("spectrum")
    s.add_argument("file")
    s.add_argument("--fundamental", type=float, default=1000.0)
    s.add_argument("--max-spur-db", type=float, default=-80.0)
    s.add_argument("--max-freq", type=float, default=20000.0,
                   help="ignore spurs above this (inaudible; 20-24 kHz is the oversampler's transition band)")
    s.set_defaults(func=cmd_spectrum)

    args = p.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
