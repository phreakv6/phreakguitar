#pragma once

#include <algorithm>
#include <cmath>
#include <numbers>

namespace phreak
{

/**
    Loudness-matching gain for a cabinet impulse response: the factor that
    makes the IR's average power response over the guitar's core band
    (200 Hz - 2.5 kHz, 16 log-spaced points) equal to 1, so switching the
    cab on/off or between IRs changes the tone, not the volume.

    Stereo IRs get one gain for all channels (based on their mean power),
    which keeps the L/R balance. Clamped to +/-40 dB so a broken IR can't
    blast or vanish. Mirrored in web/src/irlevel.ts; run_checks.sh verifies
    both give the same gain for the built-in IRs.
*/
inline float irLevelMatchGain (const float* const* ch, int numCh, int n, double sampleRate)
{
    constexpr int points = 16;
    constexpr double fLo = 200.0, fHi = 2500.0;

    double power = 0.0;
    for (int p = 0; p < points; ++p)
    {
        const double f = fLo * std::pow (fHi / fLo, (double) p / (points - 1));
        const double w = 2.0 * std::numbers::pi * f / sampleRate;
        for (int c = 0; c < numCh; ++c)
        {
            double re = 0.0, im = 0.0;
            for (int i = 0; i < n; ++i)
            {
                re += ch[c][i] * std::cos (w * i);
                im -= ch[c][i] * std::sin (w * i);
            }
            power += re * re + im * im;
        }
    }
    power /= (double) (points * std::max (1, numCh));

    if (! (power > 1e-12))
        return 1.0f;
    const double gain = 1.0 / std::sqrt (power);
    return (float) std::clamp (gain, 0.01, 100.0);
}

} // namespace phreak
