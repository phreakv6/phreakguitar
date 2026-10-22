#include "DriveStage.h"

#include <algorithm>
#include <numbers>

namespace phreak
{

void DriveStage::prepare (double sampleRate, int maxBlockSize, int numChannels)
{
    oversampler.prepare (numChannels, maxBlockSize);
    osPtrs.assign ((size_t) numChannels, nullptr);

    // +6 dB high shelf at 750 Hz into the clipper; exact inverse after.
    constexpr double shelfFreq = 750.0, shelfQ = 0.707, shelfGain = 2.0;
    preEmphasis.assign ((size_t) numChannels, {});
    deEmphasis.assign ((size_t) numChannels, {});
    const auto pre = makeHighShelf (sampleRate, shelfFreq, shelfQ, shelfGain);
    const auto de = makeHighShelf (sampleRate, shelfFreq, shelfQ, 1.0 / shelfGain);
    for (auto& f : preEmphasis) f.setCoeffs (pre);
    for (auto& f : deEmphasis) f.setCoeffs (de);

    // Smooth drive changes at the oversampled rate (per-sample in the loop).
    const double osRate = sampleRate * Oversampler4x::factor;
    gainSmoothed.reset (osRate, 0.05);

    // Interstage coupling HP (one pole at the oversampled rate).
    hpAlpha = (float) (1.0 / (1.0 + 2.0 * std::numbers::pi * couplingHpHz / osRate));
    hpX1.assign ((size_t) numChannels, 0.0f);
    hpY1.assign ((size_t) numChannels, 0.0f);
}

void DriveStage::reset()
{
    oversampler.reset();
    for (auto& f : preEmphasis) f.reset();
    for (auto& f : deEmphasis) f.reset();
    gainSmoothed.snap();
    std::fill (hpX1.begin(), hpX1.end(), 0.0f);
    std::fill (hpY1.begin(), hpY1.end(), 0.0f);
}

void DriveStage::setDrive (float drive01)
{
    drive01 = std::clamp (drive01, 0.0f, 1.0f);
    // Exponential taper: 0 -> 1x, 1 -> 56x (~35 dB).
    gainSmoothed.setTarget (std::pow (maxGain, drive01));
}

void DriveStage::process (float* const* ch, int numCh, int n)
{
    for (int c = 0; c < numCh; ++c)
    {
        preEmphasis[(size_t) c].process (ch[c], n);
        osPtrs[(size_t) c] = oversampler.up (c, ch[c], n);
    }

    const int osN = n * Oversampler4x::factor;
    for (int i = 0; i < osN; ++i)
    {
        const float g = gainSmoothed.next();
        // Stage 2 runs at half the dB of stage 1: total ~ g^1.5.
        const float g2 = std::sqrt (g);
        // Mild loudness compensation; tanh output is bounded near +/-1
        // regardless of gain, so full makeup would feel backwards.
        const float comp = 1.0f / std::pow (g * g2, 0.35f);
        const float bias = baseBias + 0.1f * (g - minGain) / (maxGain - minGain);

        for (int c = 0; c < numCh; ++c)
        {
            float* data = osPtrs[(size_t) c];

            // Stage 1 (inverting triode, modeled non-inverted with bias).
            const float y1 = shape (g * data[i], bias);

            // Interstage coupling cap: one-pole HP.
            const float hp = hpAlpha * (hpY1[(size_t) c] + y1 - hpX1[(size_t) c]);
            hpX1[(size_t) c] = y1;
            hpY1[(size_t) c] = hp;

            // Stage 2, polarity-mirrored: the cascade's second inversion
            // flips which half-cycle clips first.
            data[i] = -shape (-g2 * hp, stage2Bias) * comp;
        }
    }

    for (int c = 0; c < numCh; ++c)
    {
        oversampler.down (c, ch[c], n);
        deEmphasis[(size_t) c].process (ch[c], n);
    }
}

} // namespace phreak
