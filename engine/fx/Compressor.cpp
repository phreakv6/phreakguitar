#include "PostEffect.h"

#include <algorithm>
#include <cmath>

namespace phreak
{

namespace
{

const FxControl dynaCompControls[] = {
    { "output", "Output", 0.5f },
    { "sensitivity", "Sensitivity", 0.5f },
};

/** The classic red OTA compressor, as a DSP model of what it does rather than its OTA
    circuit: a fast-attack, slow-release, high-ratio compressor on the raw
    guitar. Sensitivity lowers the threshold (more squash, more sustain,
    makeup gain to match); Output sets the level. A little of the pick
    attack gets through before the 3 ms attack clamps down: the "pop" of
    the pedal. Mono: it sits before the (mono) pedals. */
class OtaCompressor final : public PostEffect
{
public:
    OtaCompressor() { loadDefaults(); }

    int numControls() const override { return 2; }
    const FxControl& control (int i) const override { return dynaCompControls[i]; }

    void prepare (double sampleRate, int) override
    {
        attack = 1.0 - std::exp (-1.0 / (0.003 * sampleRate));
        release = 1.0 - std::exp (-1.0 / (0.35 * sampleRate));
        gainSmooth = 1.0 - std::exp (-1.0 / (0.002 * sampleRate));
        reset();
    }

    void reset() override
    {
        envelope = 0.0;
        gain = 1.0;
    }

    void process (float* const* ch, int numCh, int n) override
    {
        // Threshold -12 dB (Sensitivity 0) .. -48 dB (full), re 1 V: a
        // guitar peaks around -12..-20 dB here. Ratio 8:1, 6 dB soft knee.
        const double thresholdDb = -12.0 - 36.0 * (double) value (1);
        const double makeupDb = -thresholdDb * (1.0 - 1.0 / ratio) * 0.55;
        const double outputDb = ((double) value (0) - 0.5) * 30.0;
        const double outGain = std::pow (10.0, (makeupDb + outputDb) / 20.0);

        float* x = ch[0];
        for (int i = 0; i < n; ++i)
        {
            const double level = std::abs ((double) x[i]);
            envelope += (level - envelope) * (level > envelope ? attack : release);
            const double over = 20.0 * std::log10 (std::max (envelope, 1e-9)) - thresholdDb;
            double reductionDb = 0.0;
            if (over > knee / 2)
                reductionDb = over * (1.0 - 1.0 / ratio);
            else if (over > -knee / 2)
                reductionDb = (1.0 - 1.0 / ratio) * (over + knee / 2) * (over + knee / 2) / (2.0 * knee);
            const double target = std::pow (10.0, -reductionDb / 20.0);
            gain += (target - gain) * gainSmooth;
            x[i] = (float) (x[i] * gain * outGain);
        }
        for (int c = 1; c < numCh; ++c)
            std::copy (ch[0], ch[0] + n, ch[c]);
    }

private:
    static constexpr double ratio = 8.0, knee = 6.0;
    double attack = 0.0, release = 0.0, gainSmooth = 0.0, envelope = 0.0, gain = 1.0;
};

} // namespace

std::unique_ptr<PostEffect> makeCompressor() { return std::make_unique<OtaCompressor>(); }

} // namespace phreak
