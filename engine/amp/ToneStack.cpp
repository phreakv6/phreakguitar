#include "ToneStack.h"

#include <algorithm>

namespace phreak
{

void ToneStack::analogCoefficients (const Components& c,
                                    double t, double m, double l,
                                    std::array<double, 4>& b,
                                    std::array<double, 4>& a)
{
    const double R1 = c.R1, R2 = c.R2, R3 = c.R3, R4 = c.R4;
    const double C1 = c.C1, C2 = c.C2, C3 = c.C3;

    // Yeh & Smith, DAFx-06: H(s) = (b1 s + b2 s^2 + b3 s^3)
    //                            / (a0 + a1 s + a2 s^2 + a3 s^3)
    b[0] = 0.0;
    b[1] = t * C1 * R1 + m * C3 * R3 + l * (C1 * R2 + C2 * R2)
         + (C1 * R3 + C2 * R3);

    b[2] = t * (C1 * C2 * R1 * R4 + C1 * C3 * R1 * R4)
         - m * m * (C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3)
         + m * (C1 * C3 * R1 * R3 + C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3)
         + l * (C1 * C2 * R1 * R2 + C1 * C2 * R2 * R4 + C1 * C3 * R2 * R4)
         + l * m * (C1 * C3 * R2 * R3 + C2 * C3 * R2 * R3)
         + (C1 * C2 * R1 * R3 + C1 * C2 * R3 * R4 + C1 * C3 * R3 * R4);

    b[3] = l * m * (C1 * C2 * C3 * R1 * R2 * R3 + C1 * C2 * C3 * R2 * R3 * R4)
         - m * m * (C1 * C2 * C3 * R1 * R3 * R3 + C1 * C2 * C3 * R3 * R3 * R4)
         + m * (C1 * C2 * C3 * R1 * R3 * R3 + C1 * C2 * C3 * R3 * R3 * R4)
         + t * C1 * C2 * C3 * R1 * R3 * R4
         - t * m * C1 * C2 * C3 * R1 * R3 * R4
         + t * l * C1 * C2 * C3 * R1 * R2 * R4;

    a[0] = 1.0;

    a[1] = (C1 * R1 + C1 * R3 + C2 * R3 + C2 * R4 + C3 * R4)
         + m * C3 * R3 + l * (C1 * R2 + C2 * R2);

    a[2] = m * (C1 * C3 * R1 * R3 - C2 * C3 * R3 * R4
                + C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3)
         + l * m * (C1 * C3 * R2 * R3 + C2 * C3 * R2 * R3)
         - m * m * (C1 * C3 * R3 * R3 + C2 * C3 * R3 * R3)
         + l * (C1 * C2 * R2 * R4 + C1 * C2 * R1 * R2
                + C1 * C3 * R2 * R4 + C2 * C3 * R2 * R4)
         + (C1 * C2 * R1 * R4 + C1 * C3 * R1 * R4 + C1 * C2 * R3 * R4
            + C1 * C2 * R1 * R3 + C1 * C3 * R3 * R4 + C2 * C3 * R3 * R4);

    a[3] = l * m * (C1 * C2 * C3 * R1 * R2 * R3 + C1 * C2 * C3 * R2 * R3 * R4)
         - m * m * (C1 * C2 * C3 * R1 * R3 * R3 + C1 * C2 * C3 * R3 * R3 * R4)
         + m * (C1 * C2 * C3 * R3 * R3 * R4 + C1 * C2 * C3 * R1 * R3 * R3
                - C1 * C2 * C3 * R1 * R3 * R4)
         + l * C1 * C2 * C3 * R1 * R2 * R4
         + C1 * C2 * C3 * R1 * R3 * R4;
}

std::array<double, 8> ToneStack::digitalCoefficients (const Components& c,
                                                      double t, double m, double l,
                                                      double sampleRate)
{
    std::array<double, 4> b {}, a {};
    analogCoefficients (c, t, m, l, b, a);

    // Bilinear transform s = k (1 - z^-1) / (1 + z^-1), multiplied through
    // by (1 + z^-1)^3. Expansion of (1 - z)(1 + z)^2, (1 - z)^2 (1 + z),
    // (1 - z)^3 and (1 + z)^3 gives:
    const double k = 2.0 * sampleRate;
    const double k2 = k * k, k3 = k2 * k;

    const double B0 =  b[1] * k + b[2] * k2 + b[3] * k3;
    const double B1 =  b[1] * k - b[2] * k2 - 3.0 * b[3] * k3;
    const double B2 = -b[1] * k - b[2] * k2 + 3.0 * b[3] * k3;
    const double B3 = -b[1] * k + b[2] * k2 - b[3] * k3;

    const double A0 =        a[0] + a[1] * k + a[2] * k2 + a[3] * k3;
    const double A1 =  3.0 * a[0] + a[1] * k - a[2] * k2 - 3.0 * a[3] * k3;
    const double A2 =  3.0 * a[0] - a[1] * k - a[2] * k2 + 3.0 * a[3] * k3;
    const double A3 =        a[0] - a[1] * k + a[2] * k2 - a[3] * k3;

    return { B0, B1, B2, B3, A0, A1, A2, A3 };
}

void ToneStack::prepare (double sr, int numChannels)
{
    sampleRate = sr;

    trebleSm.reset (sampleRate, 0.02);
    midSm.reset (sampleRate, 0.02);
    bassSm.reset (sampleRate, 0.02);

    filters.assign ((size_t) numChannels, {});
    lastT = lastM = lastL = -1.0f; // force initial coefficient computation
    updateCoefficients (trebleSm.getTarget(), midSm.getTarget(), bassSm.getTarget());
}

void ToneStack::reset()
{
    for (auto& f : filters)
        f.reset();
}

void ToneStack::snapParameters()
{
    trebleSm.snap();
    midSm.snap();
    bassSm.snap();
    updateCoefficients (trebleSm.getCurrent(), midSm.getCurrent(), bassSm.getCurrent());
}

void ToneStack::setKnobs (float treble01, float mid01, float bass01)
{
    trebleSm.setTarget (std::clamp (treble01, 0.0f, 1.0f));
    midSm.setTarget (std::clamp (mid01, 0.0f, 1.0f));
    bassSm.setTarget (std::clamp (bass01, 0.0f, 1.0f));
}

void ToneStack::updateCoefficients (float t, float m, float l)
{
    if (t == lastT && m == lastM && l == lastL)
        return;
    lastT = t; lastM = m; lastL = l;

    // Pot tapers: treble & mid are close enough to linear; the 1M bass pot
    // is audio taper — approximate its law as l = e^{3.4 (L - 1)}.
    const double tE = t;
    const double mE = std::max (0.01f, m); // rheostat never quite 0 ohms
    const double lE = std::exp (3.4 * (l - 1.0));

    const auto d = digitalCoefficients (bassman5F6A, tE, mE, lE, sampleRate);

    // Fold makeup gain into the numerator.
    const double makeup = dbToGain ((double) makeupDb);
    IIRFilter<3>::Coeffs c;
    c.b = { d[0] * makeup, d[1] * makeup, d[2] * makeup, d[3] * makeup };
    c.a = { d[4], d[5], d[6], d[7] };
    c.normalise();
    for (auto& f : filters)
        f.setCoeffs (c);
}

void ToneStack::process (float* const* ch, int numCh, int n)
{
    // Advance knob smoothing per block; recompute only when values moved.
    trebleSm.skip (n);
    midSm.skip (n);
    bassSm.skip (n);
    updateCoefficients (trebleSm.getCurrent(), midSm.getCurrent(), bassSm.getCurrent());

    for (int c = 0; c < numCh; ++c)
        filters[(size_t) c].process (ch[c], n);
}

} // namespace phreak
