#include "PowerAmp.h"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace phreak
{

namespace
{
    Biquad::Coeffs onePoleLowpass (double fs, double fc)
    {
        const double k = std::tan (std::numbers::pi * fc / fs);
        Biquad::Coeffs c;
        c.b = { k / (1 + k), k / (1 + k), 0.0 };
        c.a = { 1.0, (k - 1) / (k + 1), 0.0 };
        return c;
    }

    // RBJ cookbook filters.
    Biquad::Coeffs rbj (int type, double fs, double f, double q, double gainDb)
    {
        const double A = std::pow (10.0, gainDb / 40.0);
        const double w = 2.0 * std::numbers::pi * f / fs, cw = std::cos (w), sw = std::sin (w);
        const double alpha = sw / (2.0 * q);
        Biquad::Coeffs c;
        switch (type)
        {
            case 0: // highpass
                c.b = { (1 + cw) / 2, -(1 + cw), (1 + cw) / 2 };
                c.a = { 1 + alpha, -2 * cw, 1 - alpha };
                break;
            case 1: // lowpass
                c.b = { (1 - cw) / 2, 1 - cw, (1 - cw) / 2 };
                c.a = { 1 + alpha, -2 * cw, 1 - alpha };
                break;
            case 2: // peak
                c.b = { 1 + alpha * A, -2 * cw, 1 - alpha * A };
                c.a = { 1 + alpha / A, -2 * cw, 1 - alpha / A };
                break;
            default: // high shelf
            {
                const double sq = 2 * std::sqrt (A) * alpha;
                c.b = { A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq) };
                c.a = { (A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq };
            }
        }
        c.normalise();
        return c;
    }

    constexpr int factor = 4;
} // namespace

void PowerAmp::prepare (const Config& c, double sampleRate, int maxBlockSize)
{
    cfg = c;
    fs = sampleRate * factor;
    oversampler.prepare (1, maxBlockSize, factor);

    // Output transformer: the EL84 class-A 30 W iron is smaller and rolls off
    // sooner at both ends than a 100 W British head's.
    otHighpass.setCoeffs (rbj (0, fs, cfg.el84 ? 55.0 : 35.0, 0.7, 0));
    otLowpass.setCoeffs (rbj (1, fs, cfg.el84 ? 9000.0 : 12000.0, 0.7, 0));
    // Speaker interaction: without feedback the amp's output impedance is
    // high, so the cone's low resonance and the voice coil's rising
    // impedance at the top come through; feedback damps both.
    const double undamped = 1.0 - cfg.nfb;
    resonance.setCoeffs (rbj (2, fs, 100.0, 1.4, 4.5 * undamped));
    voiceCoil.setCoeffs (rbj (3, fs, 3000.0, 0.7, 3.0 * undamped));

    supply.prepare (cfg.supply, sampleRate);
    lastPresence = lastCut = lastResponse = -1.0f;
    updateFilters();
    reset();
}

void PowerAmp::reset()
{
    oversampler.reset();
    for (auto* f : { &cutFilter, &presenceShelf, &otHighpass, &otLowpass, &resonance, &voiceCoil })
        f->reset();
    supply.reset();
    headroomNow = 1.0;
}

void PowerAmp::updateFilters()
{
    const float p = presence.load(), k = cut.load();
    if (p == lastPresence && k == lastCut)
        return;
    lastPresence = p;
    lastCut = k;
    // Cut: 20 kHz (off) .. 1.2 kHz (full), exponential sweep.
    const double fc = cfg.cutControl >= 0 ? 20000.0 * std::pow (1200.0 / 20000.0, (double) k) : 20000.0;
    cutFilter.setCoeffs (onePoleLowpass (fs, fc));
    // Presence: up to +9 dB of treble lift, scaled by how much feedback
    // there is to shunt (none without NFB).
    const double lift = cfg.presenceControl >= 0 ? 9.0 * (double) p * std::min (1.0, cfg.nfb * 2.0) : 0.0;
    presenceShelf.setCoeffs (rbj (3, fs, 3500.0, 0.7, lift));
}

void PowerAmp::process (float* data, int n)
{
    updateFilters();
    if (const float r = response.load(); r != lastResponse)
    {
        supply.setResponse (r);
        lastResponse = r;
    }
    float* os = oversampler.up (0, data, n);
    const int osN = n * factor;

    // Feedback lowers the open-loop drive.
    const double drive = (1.0 - 0.5 * cfg.nfb) / cfg.headroom;
    // Class-A EL84: softer knee, lopsided; EL34 push-pull: firmer, even.
    const double bias = cfg.el84 ? 0.22 : 0.06;
    const double knee = cfg.el84 ? 1.6 : 2.6;
    const double biasOut = bias / std::pow (1.0 + std::pow (std::abs (bias), knee), 1.0 / knee);

    double tubeDrive = 0.0; // |output| over this base-rate sample, for the supply
    for (int i = 0; i < osN; ++i)
    {
        double x = cutFilter.processSample (os[i]) * drive;

        // The output swing can't exceed what B+ allows: the ceiling is the
        // simulated supply voltage relative to idle.
        const double ceiling = headroomNow;
        const double u = x / ceiling + bias;
        double y = (u / std::pow (1.0 + std::pow (std::abs (u), knee), 1.0 / knee) - biasOut) * ceiling;
        const double level = std::abs (y);
        peakLevel = std::max (peakLevel, level);
        tubeDrive += level;
        if ((i + 1) % factor == 0) // the supply runs at the base rate
        {
            headroomNow = supply.step (tubeDrive / factor);
            tubeDrive = 0.0;
        }

        y = presenceShelf.processSample ((float) y);
        y = otHighpass.processSample ((float) y);
        y = otLowpass.processSample ((float) y);
        y = resonance.processSample ((float) y);
        y = voiceCoil.processSample ((float) y);
        os[i] = (float) (0.5 * y);
    }
    oversampler.down (0, data, n);
}

} // namespace phreak
