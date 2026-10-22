#pragma once

#include "dsp/IIRFilter.h"
#include "dsp/Oversampler.h"
#include "dsp/Smoothed.h"

#include <cmath>
#include <vector>

namespace phreak
{

/**
    First-sound drive stage (SPEC.md Phase 1, behavioral tier).

    Chain: pre-emphasis high shelf -> 4x oversampled [stage 1 -> interstage
    coupling HP -> stage 2] -> de-emphasis (exact inverse shelf).

    The pre/de-emphasis pair brightens the signal *into* the clippers (more
    high-frequency content saturates first, which reads as "definition")
    and restores tonal balance afterwards. The shelves are exact inverses,
    so at zero drive the pair is transparent.

    Each stage is tanh with a DC bias offset, re-centred so silence in gives
    silence out. The bias creates asymmetric clipping -> even harmonics, the
    single-ended triode signature. Stage 2 is polarity-mirrored because a
    real triode stage inverts: the asymmetry alternates through the cascade,
    which is where the even/odd harmonic interplay of a two-stage preamp
    comes from. The interstage one-pole HP stands in for the coupling cap.
    Behavioral approximations throughout; Phase 2 replaces the shapes with a
    Koren triode model and the HP with real coupling-cap (blocking) behavior.
*/
class DriveStage
{
public:
    void prepare (double sampleRate, int maxBlockSize, int numChannels);
    void reset();

    /** drive in [0, 1]. 0 = near-clean, 1 = full saturation (~35 dB in). */
    void setDrive (float drive01);
    void snapParameters() { gainSmoothed.snap(); }

    double getLatencySamples() const { return oversampler.getLatencySamples(); }

    void process (float* const* ch, int numCh, int n);

    /** Static transfer curve, exposed for unit tests.
        Monotonic in x, bounded, asymmetric for bias != 0, f(0) = 0. */
    static float shape (float x, float bias)
    {
        return std::tanh (x + bias) - std::tanh (bias);
    }

    static constexpr float minGain = 1.0f;
    static constexpr float maxGain = 56.0f;       // ~35 dB, stage 1
    static constexpr float baseBias = 0.15f;      // stage 1
    static constexpr float stage2Bias = 0.12f;
    static constexpr float couplingHpHz = 25.0f;  // interstage coupling cap

private:
    Oversampler4x oversampler;
    std::vector<Biquad> preEmphasis, deEmphasis;
    std::vector<float*> osPtrs;
    MultiplicativeSmoothed gainSmoothed { minGain };

    // Interstage one-pole HP state, per channel (runs at oversampled rate).
    std::vector<float> hpX1, hpY1;
    float hpAlpha = 1.0f;
};

} // namespace phreak
