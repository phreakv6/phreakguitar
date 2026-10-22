#!/usr/bin/env python3
"""Validate the C++ tone stack against an independent circuit solve.

Two completely separate derivations of the same schematic:

  1. C++ side: Yeh & Smith's symbolic transfer-function polynomials +
     bilinear transform (src/dsp/ToneStack.cpp), dumped via
     `render --dump-tonestack t m l`.
  2. This script: numeric Modified Nodal Analysis of the 5F6-A tone stack
     network, solved per frequency with complex arithmetic. No symbolic
     formulas shared with the C++ implementation.

If both agree across a knob grid and frequency range, the symbolic
implementation is right. SPEC budget: <= 0.5 dB below 4 kHz (bilinear
warping is allowed a little more headroom above).

usage: validate_tonestack.py path/to/render
"""

import cmath
import math
import subprocess
import sys

# 5F6-A components (must match ToneStack::bassman5F6A).
R1, R2, R3, R4 = 250e3, 1e6, 25e3, 56e3
C1, C2, C3 = 250e-12, 20e-9, 20e-9

SR = 48000.0
FREQS = [30 * (8000 / 30) ** (i / 19) for i in range(20)]
GRID = [0.05, 0.3, 0.5, 0.8, 1.0]
TOL_LOW_DB, TOL_HIGH_DB = 0.5, 1.0  # below/above 4 kHz


def solve_mna(t, m, l, f):
    """Solve the tone stack at frequency f via nodal analysis.

    5F6-A wiring:
      Vin --C1--> T1;  Vin --R4--> S
      treble pot R1 end-to-end T1..B, wiper unloaded -> Vout = B + t*(T1-B)
      S --C2--> B
      bass pot as rheostat: B --l*R2--> P
      mid pot is a TRUE potentiometer: P --(1-m)*R3--> W --m*R3--> gnd,
      with C3 from S to the WIPER W. (This is where the m^2 terms in the
      transfer function come from; a rheostat would only give linear m.)

    Nodes: 0=T1, 1=S, 2=B, 3=P, 4=W. Vin = 1.
    """
    w = 2.0 * math.pi * f
    yC1 = 1j * w * C1
    yC2 = 1j * w * C2
    yC3 = 1j * w * C3
    yR1 = 1.0 / R1
    yR4 = 1.0 / R4
    yRb = 1.0 / max(l * R2, 1e-3)          # bass rheostat
    yRmU = 1.0 / max((1.0 - m) * R3, 1e-3)  # mid pot above wiper
    yRmL = 1.0 / max(m * R3, 1e-3)          # mid pot below wiper

    n = 5
    Y = [[0j] * n for _ in range(n)]
    I = [0j] * n

    def stamp(a, b, y):
        """Admittance y between nodes a and b (-1 = ground)."""
        if a >= 0:
            Y[a][a] += y
        if b >= 0:
            Y[b][b] += y
        if a >= 0 and b >= 0:
            Y[a][b] -= y
            Y[b][a] -= y

    # Vin -> C1 -> T1 ; Vin -> R4 -> S  (Vin known: move to RHS)
    Y[0][0] += yC1
    I[0] += yC1 * 1.0
    Y[1][1] += yR4
    I[1] += yR4 * 1.0

    stamp(0, 2, yR1)    # treble pot end-to-end (wiper unloaded)
    stamp(1, 2, yC2)
    stamp(2, 3, yRb)    # bass rheostat
    stamp(3, 4, yRmU)   # mid pot, top section
    stamp(4, -1, yRmL)  # mid pot, bottom section to ground
    stamp(1, 4, yC3)    # C3 lands on the mid wiper

    # Gaussian elimination with partial pivoting.
    A = [Y[r][:] + [I[r]] for r in range(n)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(A[r][col]))
        A[col], A[piv] = A[piv], A[col]
        for r in range(col + 1, n):
            factor = A[r][col] / A[col][col]
            for cc in range(col, n + 1):
                A[r][cc] -= factor * A[col][cc]
    v = [0j] * n
    for r in range(n - 1, -1, -1):
        v[r] = (A[r][n] - sum(A[r][cc] * v[cc] for cc in range(r + 1, n))) / A[r][r]

    return v[2] + t * (v[0] - v[2])  # treble wiper voltage


def digital_response(coeffs, f):
    """|H| of the dumped digital filter at frequency f."""
    b = coeffs[0:4]
    a = coeffs[4:8]
    z = cmath.exp(-2j * math.pi * f / SR)
    num = sum(bi * z**i for i, bi in enumerate(b))
    den = sum(ai * z**i for i, ai in enumerate(a))
    return abs(num / den)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    render = sys.argv[1]

    worst = (0.0, None)
    checked = 0
    for t in GRID:
        for m in GRID:
            for l in GRID:
                out = subprocess.run(
                    [render, "--dump-tonestack", str(t), str(m), str(l), str(SR)],
                    capture_output=True, text=True, check=True).stdout.split()
                coeffs = [float(x) for x in out[1:9]]

                for f in FREQS:
                    ana = abs(solve_mna(t, m, l, f))
                    dig = digital_response(coeffs, f)
                    diff = abs(20 * math.log10(max(dig, 1e-12) / max(ana, 1e-12)))
                    tol = TOL_LOW_DB if f < 4000 else TOL_HIGH_DB
                    checked += 1
                    if diff > worst[0]:
                        worst = (diff, (t, m, l, f))
                    if diff > tol:
                        print(f"FAIL: t={t} m={m} l={l} f={f:.0f}Hz: "
                              f"analog {20*math.log10(max(ana,1e-12)):.2f} dB vs "
                              f"digital {20*math.log10(max(dig,1e-12)):.2f} dB "
                              f"(diff {diff:.2f} dB > {tol})")
                        return 1

    d, where = worst
    t, m, l, f = where
    print(f"OK: {checked} points checked; worst diff {d:.3f} dB "
          f"at t={t} m={m} l={l} f={f:.0f}Hz")
    return 0


if __name__ == "__main__":
    sys.exit(main())
