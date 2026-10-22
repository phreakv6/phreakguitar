#include "PostEffect.h"
#include "dsp/IIRFilter.h"

#include <algorithm>
#include <cmath>
#include <numbers>
#include <vector>

namespace phreak
{

namespace
{

const FxControl dd3Controls[] = {
    { "level", "E.Level", 0.45f },
    { "feedback", "F.Back", 0.35f },
    { "time", "D.Time", 0.55f },
    { "mode", "Mode", 1.0f, 3 }, // S, M, L
};

// 4-point Hermite interpolation on a circular buffer.
inline float readFrac (const std::vector<float>& buf, int writePos, double delay)
{
    const int size = (int) buf.size();
    const double readPos = writePos - delay;
    const int i = (int) std::floor (readPos);
    const float f = (float) (readPos - i);
    auto at = [&] (int k) { return buf[(size_t) (((k % size) + size) % size)]; };
    const float xm1 = at (i - 1), x0 = at (i), x1 = at (i + 1), x2 = at (i + 2);
    const float c1 = 0.5f * (x1 - xm1);
    const float c2 = xm1 - 2.5f * x0 + 2.0f * x1 - 0.5f * x2;
    const float c3 = 0.5f * (x2 - xm1) + 1.5f * (x0 - x1);
    return ((c3 * f + c2) * f + c1) * f + x0;
}

class DigitalDelay final : public PostEffect
{
public:
    DigitalDelay() { loadDefaults(); }

    int numControls() const override { return 4; }
    const FxControl& control (int i) const override { return dd3Controls[i]; }

    void prepare (double sampleRate, int) override
    {
        fs = sampleRate;
        for (auto& line : lines)
            line.assign ((size_t) (fs * 0.85) + 8, 0.0f); // 800 ms + margin
        // Repeats: ~7 kHz bandwidth, like the classic digital delay pedals' delayed signal.
        const double w = std::tan (std::numbers::pi * 7000.0 / fs);
        const double q = 0.7071, norm = 1.0 / (1.0 + w / q + w * w);
        Biquad::Coeffs c;
        c.b = { w * w * norm, 2 * w * w * norm, w * w * norm };
        c.a = { 1.0, 2 * (w * w - 1) * norm, (1 - w / q + w * w) * norm };
        for (auto& f : tone) f.setCoeffs (c);
        smoothCoef = 1.0 - std::exp (-1.0 / (0.06 * fs)); // D.Time glides
        reset();
    }

    void reset() override
    {
        for (auto& line : lines) std::fill (line.begin(), line.end(), 0.0f);
        for (auto& f : tone) f.reset();
        writePos = 0;
        delay = targetDelay();
    }

    void process (float* const* ch, int numCh, int n) override
    {
        const float level = 1.2f * value (0);       // repeats can top the dry note
        const float fb = 0.95f * value (1);         // just short of runaway
        const double target = targetDelay();
        const int channels = std::min (numCh, 2);
        const int size = (int) lines[0].size();

        for (int i = 0; i < n; ++i)
        {
            delay += (target - delay) * smoothCoef;
            for (int c = 0; c < channels; ++c)
            {
                auto& line = lines[(size_t) c];
                const float echo = tone[(size_t) c].processSample (readFrac (line, writePos, delay));
                line[(size_t) writePos] = ch[c][i] + fb * echo;
                ch[c][i] += level * echo;
            }
            if (++writePos == size)
                writePos = 0;
        }
    }

private:
    double targetDelay() const
    {
        // Mode ranges (ms): S 12.5-50, M 50-200, L 200-800; D.Time sweeps
        // each range exponentially, like the pedal's pot feels.
        const float m = value (3);
        const double lo = m < 0.25f ? 12.5 : m < 0.75f ? 50.0 : 200.0;
        return lo * std::pow (4.0, (double) value (2)) * 0.001 * fs;
    }

    double fs = 48000.0, delay = 0.0, smoothCoef = 0.0;
    std::vector<float> lines[2];
    Biquad tone[2];
    int writePos = 0;
};

} // namespace

std::unique_ptr<PostEffect> makeDigitalDelay() { return std::make_unique<DigitalDelay>(); }

} // namespace phreak
