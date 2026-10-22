#include "PostEffect.h"

#include <algorithm>
#include <cmath>
#include <numbers>
#include <vector>

namespace phreak
{

namespace
{

const FxControl holyGrailControls[] = {
    { "reverb", "Reverb", 0.35f },
    { "mode", "Mode", 0.0f, 3 }, // Spring, Hall, Flerb
};

// Integer delay line with a write head; taps read n samples back.
struct DelayLine
{
    std::vector<float> buf;
    int pos = 0;

    void init (int length) { buf.assign ((size_t) std::max (length, 2), 0.0f); pos = 0; }
    void clear() { std::fill (buf.begin(), buf.end(), 0.0f); }
    float tap (int back) const
    {
        const int size = (int) buf.size();
        int i = pos - back;
        while (i < 0) i += size;
        return buf[(size_t) i];
    }
    float tapFrac (double back) const
    {
        const int i = (int) back;
        const float f = (float) (back - i);
        return tap (i) * (1.0f - f) + tap (i + 1) * f;
    }
    void push (float x)
    {
        buf[(size_t) pos] = x;
        if (++pos == (int) buf.size())
            pos = 0;
    }
};

// Schroeder allpass around a delay line: H = (z^-M - g) / (1 - g z^-M).
struct Allpass
{
    DelayLine line;
    int length = 1;
    float g = 0.5f;

    void init (int len, float gain) { length = std::max (len, 1); line.init (length + 40); g = gain; }
    float process (float x, double modulation = 0.0)
    {
        const float d = modulation == 0.0 ? line.tap (length) : line.tapFrac (length + modulation);
        const float v = x + g * d;
        line.push (v);
        return d - g * v;
    }
};

class SpringHallReverb final : public PostEffect
{
public:
    SpringHallReverb() { loadDefaults(); }

    int numControls() const override { return 2; }
    const FxControl& control (int i) const override { return holyGrailControls[i]; }

    void prepare (double sampleRate, int) override
    {
        fs = sampleRate;
        mode = -1;
        configure (0);
    }

    void reset() override
    {
        predelay.clear();
        for (auto* a : { &in1, &in2, &in3, &in4, &tankAp1, &tankAp2, &tankAp3, &tankAp4 })
            a->line.clear();
        for (auto* d : { &tankD1, &tankD2, &tankD3, &tankD4 })
            d->clear();
        for (auto& a : chirp)
            a.line.clear();
        flanger[0].clear();
        flanger[1].clear();
        bandwidthState = damp1 = damp2 = 0.0f;
        feedbackL = feedbackR = 0.0f;
        lfoPhase = flangePhase = 0.0;
        hp = lpState = 0.0f;
    }

    void process (float* const* ch, int numCh, int n) override
    {
        const int m = value (1) < 0.25f ? 0 : value (1) < 0.75f ? 1 : 2;
        if (m != mode)
            configure (m);
        const float wet = 0.9f * value (0);
        const double lfoInc = 2.0 * std::numbers::pi * 1.0 / fs;
        const double flangeInc = 2.0 * std::numbers::pi * 0.22 / fs;

        for (int i = 0; i < n; ++i)
        {
            float x = numCh > 1 ? 0.5f * (ch[0][i] + ch[1][i]) : ch[0][i];

            if (mode == 0)
            {
                // Spring: a band-limited send (springs don't do lows or
                // much top) through the dispersive chain = the "boing".
                hp += 0.03f * (x - hp);
                lpState += 0.45f * ((x - hp) - lpState);
                x = lpState;
                for (auto& a : chirp)
                    x = a.process (x);
            }

            // Dattorro: predelay, bandwidth, input diffusion.
            predelay.push (x);
            bandwidthState += 0.9995f * (predelay.tap (predelayLen) - bandwidthState);
            float d = in4.process (in3.process (in2.process (in1.process (bandwidthState))));

            // Figure-eight tank, two modulated allpasses.
            const double mod = excursion * std::sin (lfoPhase);
            lfoPhase += lfoInc;
            float l = tankAp1.process (d + feedbackR * decay, mod);
            tankD1.push (l);
            damp1 += (1.0f - damping) * (tankD1.tap (len1) - damp1);
            l = tankAp2.process (damp1 * decay);
            tankD2.push (l);

            float r = tankAp3.process (d + feedbackL * decay, -mod);
            tankD3.push (r);
            damp2 += (1.0f - damping) * (tankD3.tap (len3) - damp2);
            r = tankAp4.process (damp2 * decay);
            tankD4.push (r);

            feedbackL = tankD2.tap (len2);
            feedbackR = tankD4.tap (len4);

            // Output taps (Dattorro's, scaled to this sample rate).
            float outL = tankD3.tap (t (266)) + tankD3.tap (t (2974)) - tankAp4.line.tap (t (1913))
                       + tankD4.tap (t (1996)) - tankD1.tap (t (1990)) - tankAp2.line.tap (t (187))
                       - tankD2.tap (t (1066));
            float outR = tankD1.tap (t (353)) + tankD1.tap (t (3627)) - tankAp2.line.tap (t (1228))
                       + tankD2.tap (t (2673)) - tankD3.tap (t (2111)) - tankAp4.line.tap (t (335))
                       - tankD4.tap (t (121));
            outL *= 0.6f;
            outR *= 0.6f;

            if (mode == 2)
            {
                // Flerb: a slow, deep flanger on the wet signal.
                const double depth = (1.0 + 3.5 * (0.5 + 0.5 * std::sin (flangePhase))) * 0.001 * fs;
                flangePhase += flangeInc;
                const float fl = flanger[0].tapFrac (depth), fr = flanger[1].tapFrac (depth);
                flanger[0].push (outL + 0.55f * fl);
                flanger[1].push (outR + 0.55f * fr);
                outL = 0.6f * (outL + fl);
                outR = 0.6f * (outR + fr);
            }

            if (numCh > 1)
            {
                ch[0][i] += wet * outL;
                ch[1][i] += wet * outR;
                for (int c = 2; c < numCh; ++c)
                    ch[c][i] += wet * 0.5f * (outL + outR);
            }
            else
                ch[0][i] += wet * 0.5f * (outL + outR);
        }
    }

private:
    int t (int samplesAt29k) const { return std::max (1, (int) std::lround (samplesAt29k * scale)); }

    void configure (int m)
    {
        mode = m;
        // Spring: smaller and shorter, darker; Hall/Flerb: the full plate.
        const double size = m == 0 ? 0.55 : 1.0;
        scale = fs / 29761.0 * size;
        decay = m == 0 ? 0.72f : 0.84f;
        damping = m == 0 ? 0.35f : 0.22f;
        excursion = 16.0 * fs / 29761.0;
        predelayLen = std::max (1, (int) (fs * (m == 0 ? 0.004 : 0.022)));
        predelay.init (predelayLen + 2);

        in1.init (t (142), 0.75f);
        in2.init (t (107), 0.75f);
        in3.init (t (379), 0.625f);
        in4.init (t (277), 0.625f);
        tankAp1.init (t (672), 0.7f);
        tankAp2.init (t (1800), 0.5f);
        tankAp3.init (t (908), 0.7f);
        tankAp4.init (t (2656), 0.5f);
        len1 = t (4453); len2 = t (3720); len3 = t (4217); len4 = t (3163);
        tankD1.init (len1 + 1); tankD2.init (len2 + 1); tankD3.init (len3 + 1); tankD4.init (len4 + 1);
        for (auto& a : chirp)
            a.init (2, 0.62f); // short, high-gain allpasses: frequency-dependent delay
        flanger[0].init ((int) (fs * 0.006) + 4);
        flanger[1].init ((int) (fs * 0.006) + 4);
        reset();
    }

    double fs = 48000.0, scale = 1.0, excursion = 16.0, lfoPhase = 0.0, flangePhase = 0.0;
    int mode = -1, predelayLen = 1, len1 = 1, len2 = 1, len3 = 1, len4 = 1;
    float decay = 0.8f, damping = 0.2f;
    DelayLine predelay, tankD1, tankD2, tankD3, tankD4, flanger[2];
    Allpass in1, in2, in3, in4, tankAp1, tankAp2, tankAp3, tankAp4;
    Allpass chirp[16];
    float bandwidthState = 0, damp1 = 0, damp2 = 0, feedbackL = 0, feedbackR = 0, hp = 0, lpState = 0;
};

} // namespace

std::unique_ptr<PostEffect> makeReverb() { return std::make_unique<SpringHallReverb>(); }

} // namespace phreak
