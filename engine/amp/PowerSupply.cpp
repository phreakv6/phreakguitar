#include "PowerSupply.h"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace phreak
{

namespace
{
    // GZ34 / 5AR4, per anode: Child's law fitted to its ~17 V drop at 250 mA.
    constexpr double gz34Perveance = 0.25 / 70.1; // A / V^1.5 (17^1.5 = 70.1)
    constexpr double siliconDrop = 1.0;            // V, one diode of a full-wave pair
    constexpr double tau = 2.0 * std::numbers::pi;
} // namespace

void PowerSupply::prepare (const Config& c, double sampleRate)
{
    cfg = c;
    fs = sampleRate;
    dt = 1.0 / fs;
    cap = cfg.capUF * 1e-6;
    phaseStep = tau * cfg.mainsHz / fs;
    ripple.assign ((size_t) std::max (1L, std::lround (fs / (2.0 * cfg.mainsHz))), 0.0);

    // Transformer voltage for the stated B+ at idle: simulate, correct, repeat.
    std::fill (std::begin (idleAt), std::end (idleAt), 0.0);
    idleRef = 1.0;
    setResponse (0.5);
    vPeak = cfg.bplus + cfg.idleMA * 1e-3 * cfg.sourceOhms * 3.0 + (cfg.tubeRectifier ? 20.0 : siliconDrop);
    for (int i = 0; i < 8; ++i)
    {
        simulateIdle (0.25);
        vPeak += cfg.bplus - average;
    }
    // Idle B+ across Response (more source resistance, lower B+ at rest):
    // the headroom is measured against it, so Response changes the sag,
    // not the loudness at rest.
    for (int k = 0; k <= 8; ++k)
    {
        setResponse (k / 8.0);
        simulateIdle (0.25);
        idleAt[k] = average;
    }
    setResponse (0.5);
    reset();
}

void PowerSupply::simulateIdle (double seconds)
{
    vCap = idleRef > 1.0 ? idleRef : cfg.bplus;
    std::fill (ripple.begin(), ripple.end(), vCap);
    rippleSum = vCap * (double) ripple.size();
    ripplePos = 0;
    phase = 0.0;
    for (long i = 0, n = std::lround (seconds * fs); i < n; ++i)
        step (0.0);
}

void PowerSupply::reset()
{
    vCap = idleRef;
    std::fill (ripple.begin(), ripple.end(), vCap);
    rippleSum = vCap * (double) ripple.size();
    ripplePos = 0;
    average = vCap;
    minimum = 1e9;
    phase = 0.0;
}

void PowerSupply::setResponse (double r01)
{
    const double f = std::pow (4.0, 2.0 * std::clamp (r01, 0.0, 1.0) - 1.0);
    rSource = cfg.sourceOhms * f;
    perveance = gz34Perveance / f;
    // Idle B+ at this setting, interpolated from prepare()'s table.
    const double x = std::clamp (r01, 0.0, 1.0) * 8.0;
    const int k = std::min (7, (int) x);
    if (idleAt[8] > 0.0)
        idleRef = idleAt[k] + (idleAt[k + 1] - idleAt[k]) * (x - k);
}

// Current through the rectifier for `headroom` = transformer minus B+.
double PowerSupply::rectifierCurrent (double headroom) const
{
    if (headroom <= 0.0)
        return 0.0;
    if (! cfg.tubeRectifier)
        return std::max (0.0, headroom - siliconDrop) / rSource;
    // Tube: headroom = v + R P v^1.5 (tube drop v plus the winding's), Newton on v.
    const double rp = rSource * perveance;
    double v = std::min (headroom, std::cbrt ((headroom / rp) * (headroom / rp)));
    for (int i = 0; i < 6; ++i)
    {
        const double sv = std::sqrt (v);
        const double g = v + rp * v * sv - headroom;
        v = std::max (0.0, v - g / (1.0 + 1.5 * rp * sv));
    }
    return perveance * v * std::sqrt (v);
}

double PowerSupply::step (double drive)
{
    const double vt = vPeak * std::abs (std::sin (phase));
    phase += phaseStep;
    if (phase > tau)
        phase -= tau;

    // Push-pull draw: idle plus a share that grows with the signal; a sine
    // at full power averages fullMA (|sin| averages 2/pi).
    const double load = (cfg.idleMA + (cfg.fullMA - cfg.idleMA) * std::min (drive, 1.2) * std::numbers::pi / 2.0) * 1e-3;
    vCap += dt / cap * (rectifierCurrent (vt - vCap) - load);
    vCap = std::max (vCap, 0.0);

    rippleSum += vCap - ripple[ripplePos];
    ripple[ripplePos] = vCap;
    if (++ripplePos == ripple.size())
        ripplePos = 0;
    average = rippleSum / (double) ripple.size();
    minimum = std::min (minimum, average);
    return average / idleRef;
}

double PowerSupply::takeMinimum()
{
    const double m = minimum < 1e8 ? minimum : average;
    minimum = 1e9;
    return m;
}

} // namespace phreak
