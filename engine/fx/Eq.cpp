#include "PostEffect.h"
#include "dsp/IIRFilter.h"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace phreak
{

namespace
{

const FxControl ge7Controls[] = {
    { "b100", "100", 0.5f },
    { "b200", "200", 0.5f },
    { "b400", "400", 0.5f },
    { "b800", "800", 0.5f },
    { "b1k6", "1.6k", 0.5f },
    { "b3k2", "3.2k", 0.5f },
    { "b6k4", "6.4k", 0.5f },
    { "level", "Level", 0.5f },
};

constexpr int numBands = 7;
constexpr double bandHz[numBands] = { 100, 200, 400, 800, 1600, 3200, 6400 };
constexpr double rangeDb = 15.0;  // each slider: -15 .. +15 dB, centre flat
constexpr double bandQ = 1.4;     // about an octave wide, like a graphic EQ's bands

// RBJ cookbook peaking filter.
Biquad::Coeffs peaking (double fs, double f, double q, double gainDb)
{
    const double A = std::pow (10.0, gainDb / 40.0);
    const double w = 2.0 * std::numbers::pi * f / fs;
    const double alpha = std::sin (w) / (2.0 * q), cw = std::cos (w);
    Biquad::Coeffs c;
    c.b = { 1 + alpha * A, -2 * cw, 1 - alpha * A };
    c.a = { 1 + alpha / A, -2 * cw, 1 - alpha / A };
    c.normalise();
    return c;
}

/** 7-band graphic EQ: seven octave-spaced bands (100 Hz .. 6.4 kHz, +-15 dB) and
    a Level slider (+-15 dB). A DSP model: the pedal's gyrator bands are
    close to constant-Q peaking filters, which is what this uses. */
class Eq7 final : public PostEffect
{
public:
    Eq7() { loadDefaults(); }

    int numControls() const override { return 8; }
    const FxControl& control (int i) const override { return ge7Controls[i]; }

    void prepare (double sampleRate, int) override
    {
        fs = sampleRate;
        for (auto& g : gainDb) g = 0.0;
        updateFilters (true);
        reset();
    }

    void reset() override
    {
        for (auto& ch : bands)
            for (auto& b : ch) b.reset();
    }

    void process (float* const* ch, int numCh, int n) override
    {
        updateFilters (false);
        const float level = (float) std::pow (10.0, levelDb / 20.0);
        for (int c = 0; c < numCh && c < 2; ++c)
            for (int i = 0; i < n; ++i)
            {
                float x = ch[c][i];
                for (auto& b : bands[c])
                    x = b.processSample (x);
                ch[c][i] = x * level;
            }
        for (int c = 2; c < numCh; ++c)
            std::copy (ch[1], ch[1] + n, ch[c]);
    }

private:
    // Sliders glide (about 30 ms) so moving one doesn't click; filters are
    // recomputed only while something is moving.
    void updateFilters (bool snap)
    {
        const double coef = snap ? 1.0 : 0.35;
        bool moved = snap;
        for (int b = 0; b < numBands; ++b)
        {
            const double target = ((double) value (b) - 0.5) * 2.0 * rangeDb;
            if (std::abs (target - gainDb[b]) > 1e-3)
            {
                gainDb[b] += (target - gainDb[b]) * coef;
                moved = true;
            }
            else if (gainDb[b] != target)
            {
                gainDb[b] = target;
                moved = true;
            }
        }
        const double levelTarget = ((double) value (7) - 0.5) * 2.0 * rangeDb;
        levelDb += (levelTarget - levelDb) * coef;
        if (! moved)
            return;
        for (int b = 0; b < numBands; ++b)
        {
            const auto c = peaking (fs, bandHz[b], bandQ, gainDb[b]);
            bands[0][b].setCoeffs (c);
            bands[1][b].setCoeffs (c);
        }
    }

    double fs = 48000.0, levelDb = 0.0;
    double gainDb[numBands] {};
    Biquad bands[2][numBands];
};

} // namespace

std::unique_ptr<PostEffect> makeEq7() { return std::make_unique<Eq7>(); }

} // namespace phreak
