#pragma once

#include <array>
#include <vector>

namespace phreak
{

/**
    Polyphase IIR half-band 2x resampler (Valenzuela-Constantinides
    structure, coefficients designed at runtime the way Laurent de Soras'
    hiir does it):

        H(z) = 1/2 [ A0(z^2) + z^-1 A1(z^2) ]

    A0/A1 are chains of first-order allpasses running at the LOW rate.
    Low group delay (a few samples) is why this is used over a linear-phase
    FIR: every millisecond counts against the browser's round-trip budget.
*/
class HalfBand2x
{
public:
    static constexpr int maxCoefs = 12;

    /** attenuationDb: stopband rejection; transition: normalised to the
        HIGH rate, in (0, 0.5); passband edge = (1/4 - transition/2) fs. */
    void design (double attenuationDb, double transition);
    void reset();

    void up (float x, float& even, float& odd)
    {
        even = upA0.process (x);
        odd = upA1.process (x);
    }

    float down (float even, float odd)
    {
        const float y = 0.5f * (downA0.process (even) + downA1.process (prevOdd));
        prevOdd = odd;
        return y;
    }

    /** DC group delay of one H(z) pass, in HIGH-rate samples. */
    double groupDelayHighRate() const;

    int getNumCoefs() const { return numCoefs; }

private:
    struct AllpassChain
    {
        std::array<float, maxCoefs> c {}, x1 {}, y1 {};
        int n = 0;

        float process (float x)
        {
            for (int i = 0; i < n; ++i)
            {
                const float y = c[(size_t) i] * (x - y1[(size_t) i]) + x1[(size_t) i];
                x1[(size_t) i] = x;
                y1[(size_t) i] = y;
                x = y;
            }
            return x;
        }

        void reset() { x1.fill (0.0f); y1.fill (0.0f); }
    };

    AllpassChain upA0, upA1, downA0, downA1;
    float prevOdd = 0.0f;
    int numCoefs = 0;
};

/**
    Power-of-two oversampler (1x, 2x, 4x or 8x): cascaded half-band stages
    per channel. Stage 1 (base -> 2x) passes 20 kHz flat with ~110 dB
    rejection at a 48 kHz base; later stages are wider and cheaper.
*/
class Oversampler
{
public:
    static constexpr int maxStages = 3;

    void prepare (int numChannels, int maxBlockSize, int factor);
    void reset();

    int getFactor() const { return 1 << numStages; }

    /** Upsamples n samples of `in` into the channel's internal buffer
        (factor * n samples) and returns it for in-place processing. */
    float* up (int ch, const float* in, int n);

    /** Downsamples that buffer back to n samples into `out`. */
    void down (int ch, float* out, int n);

    /** Round-trip (up + down) latency at the base rate, approximate
        (DC group delay; the IIRs are not linear-phase). */
    double getLatencySamples() const;

private:
    struct Channel
    {
        std::array<HalfBand2x, maxStages> stages;
        std::array<std::vector<float>, maxStages> bufs; // bufs[s]: 2^(s+1) * n
    };
    std::vector<Channel> channels;
    int numStages = 0;
    std::vector<float> passthrough;
};

/** The amp's fixed 4x oversampler. */
class Oversampler4x : public Oversampler
{
public:
    static constexpr int factor = 4;
    void prepare (int numChannels, int maxBlockSize) { Oversampler::prepare (numChannels, maxBlockSize, factor); }
};

} // namespace phreak
