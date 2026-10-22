#include "PostEffect.h"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace phreak
{

namespace
{

const FxControl photoVibeControls[] = {
    { "speed", "Speed", 0.35f },
    { "intensity", "Intensity", 0.6f },
    { "volume", "Volume", 0.5f },
    { "mode", "Mode", 0.0f, 2 }, // Chorus, Vibrato
};

// The four phase stages as measured on an original 1968 unit
// (Darabundit, Wedelich, Bischoff, "Digital Grey Box Model of the Uni-Vibe
// Effects Pedal", DAFx-19, Table 1): phasing capacitor, the emitter-side
// (alpha) and collector-side (beta) gains of each phase splitter, and each
// LDR's resistance in full light and in the dark.
struct Stage
{
    double cp, alpha, beta, ldrLit, ldrDark, lag; // lag: this LDR's speed
};
constexpr Stage stages[4] = {
    { 15e-9,   1.01, 1.11, 12.7e3, 2.79e6, 1.00 },
    { 220e-9,  0.98, 1.09, 6.86e3, 2.59e6, 1.15 },
    { 470e-12, 0.97, 1.10, 7.69e3, 3.32e6, 0.90 },
    { 4.7e-9,  0.95, 1.09, 6.22e3, 4.16e6, 1.25 },
};
constexpr double cBlock = 1e-6;    // each stage's block capacitor (C_DC)
constexpr double rSeries = 4.7e3;  // R6, in series with the LDR
constexpr double preampGain = 3.0; // Keen: the input preamp's gain, about 3

/** Photo vibe (the 1968 photocell phaser): four phase stages,
    transistor phase splitters, each tuned by an LDR around one flickering
    lamp, with deliberately mismatched phasing capacitors. A grey-box model
    after the DAFx-19 paper: the stages are its circuit-derived transfer
    function, H = alpha He - beta Hc with omega0 = (C_DC + Cp) / (R' Cp
    C_DC), R' = LDR + 4.7k; the lamp and LDRs are a light model fitted to
    its measurements (the lamp lags the oscillator; CdS cells brighten fast
    and darken slowly, each at its own pace). Chorus mixes the preamp's dry
    signal back in (the notches); Vibrato is the phase-shifted signal alone
    (the pitch wobble). Mono. */
class PhotoVibe final : public PostEffect
{
public:
    PhotoVibe() { loadDefaults(); }

    int numControls() const override { return 4; }
    const FxControl& control (int i) const override { return photoVibeControls[i]; }

    void prepare (double sampleRate, int) override
    {
        fs = sampleRate;
        lampCoef = 1.0 - std::exp (-1.0 / (0.04 * fs));    // the bulb's thermal lag
        brighten = 1.0 - std::exp (-1.0 / (0.008 * fs));   // CdS turn-on
        darken = 1.0 - std::exp (-1.0 / (0.08 * fs));      // CdS turn-off
        dcCoef = 1.0 - std::exp (-2.0 * std::numbers::pi * 5.0 / fs);
        reset();
    }

    void reset() override
    {
        phase = 0.0;
        light = idleLight();
        for (int s = 0; s < 4; ++s)
        {
            state[s] = 0.0;
            dc[s] = 0.0;
            logR[s] = std::log (ldrResistance (s, light));
        }
    }

    void process (float* const* ch, int numCh, int n) override
    {
        const double speedHz = 0.4 * std::pow (7.6 / 0.4, (double) value (0)); // 0.4 .. 7.6 Hz
        const double intensity = value (1);
        const double vol = std::exp (3.4 * (double) value (2)) - 1.0;           // audio-taper pot
        const double outGain = vol / (std::exp (1.7) - 1.0) / preampGain;      // centre: unity
        const bool vibrato = value (3) > 0.5f;
        // The oscillator's swing grows with speed (Keen), offsetting the
        // lamp's falling response.
        const double swing = intensity * (0.8 + 0.2 * speedHz / 7.6);

        float* x = ch[0];
        for (int i = 0; i < n; ++i)
        {
            // Lamp: biased to a dim glow, driven by the oscillator.
            const double lfo = 0.5 + 0.5 * std::sin (phase);
            phase += 2.0 * std::numbers::pi * speedHz / fs;
            if (phase > 2.0 * std::numbers::pi)
                phase -= 2.0 * std::numbers::pi;
            const double drive = lampBias + (1.0 - lampBias) * swing * lfo;
            light += (drive * drive - light) * lampCoef;

            const double dry = preampGain * x[i];
            double y = dry;
            for (int s = 0; s < 4; ++s)
            {
                // The LDR follows the light: down fast, back up slowly.
                const double target = std::log (ldrResistance (s, light));
                logR[s] += (target - logR[s]) * (target < logR[s] ? brighten : darken) / stages[s].lag;
                y = stage (s, softClip (s, y), std::exp (logR[s]) + rSeries);
            }
            const double out = vibrato ? y : 0.5 * (dry + y);
            x[i] = (float) (out * outGain);
        }
        for (int c = 1; c < numCh; ++c)
            std::copy (ch[0], ch[0] + n, ch[c]);
    }

private:
    static constexpr double lampBias = 0.2; // the trimmed idle glow
    static constexpr double ldrGamma = 1.2; // CdS: R ~ light^-gamma

    static double idleLight() { return lampBias * lampBias; }

    static double ldrResistance (int s, double light)
    {
        const double r = stages[s].ldrLit * std::pow (std::max (light, 1e-6), -ldrGamma);
        return std::min (r, stages[s].ldrDark);
    }

    // The stage transistors clip a little, asymmetrically (the paper's
    // tanh with a bias), then a DC blocker takes the offset back out.
    double softClip (int s, double v)
    {
        constexpr double g = 0.5, u = 0.15;
        const double c = (std::tanh (g * v + u) - std::tanh (u)) / g;
        dc[s] += (c - dc[s]) * dcCoef;
        return c - dc[s];
    }

    // One phase splitter: H(s) = (b0 + b1 s) / (s + w0), b1 = -beta,
    // b0 = w0 (alpha ke - beta kc), bilinear with pre-warping at w0.
    double stage (int s, double v, double r)
    {
        const auto& st = stages[s];
        const double kc = st.cp / (st.cp + cBlock), ke = cBlock / (st.cp + cBlock);
        const double w0 = (cBlock + st.cp) / (r * st.cp * cBlock);
        const double half = std::min (w0 / (2.0 * fs), 1.5); // stay below Nyquist
        const double k = w0 / std::tan (half);
        const double b1 = -st.beta, b0 = w0 * (st.alpha * ke - st.beta * kc);
        const double a0 = k + w0, a1 = w0 - k;
        const double n0 = (b1 * k + b0) / a0, n1 = (b0 - b1 * k) / a0;
        const double out = n0 * v + state[s];
        state[s] = n1 * v - (a1 / a0) * out;
        return out;
    }

    double fs = 48000.0, phase = 0.0, light = 0.0;
    double lampCoef = 0.0, brighten = 0.0, darken = 0.0, dcCoef = 0.0;
    double state[4] {}, dc[4] {}, logR[4] {};
};

} // namespace

std::unique_ptr<PostEffect> makePhotoVibe() { return std::make_unique<PhotoVibe>(); }

} // namespace phreak
