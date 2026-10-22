#pragma once

#include <algorithm>
#include <cmath>

namespace phreak
{

/** Downward expander used as a noise gate. RMS detector with separate
    attack/release ballistics, linked across channels. Below threshold,
    gain = (level / threshold)^(ratio - 1). */
class NoiseGate
{
public:
    void prepare (double sr)
    {
        sampleRate = sr;
        setAttackMs (attackMs);
        setReleaseMs (releaseMs);
        reset();
    }

    void reset() { envSq = 0.0f; }

    void setThresholdDb (float db) { threshold = std::pow (10.0f, db * 0.05f); }
    void setRatio (float r)        { ratio = std::max (1.0f, r); }
    void setAttackMs (float ms)    { attackMs = ms; attackCoef = coefFor (ms); }
    void setReleaseMs (float ms)   { releaseMs = ms; releaseCoef = coefFor (ms); }

    void process (float* const* ch, int numCh, int n)
    {
        for (int i = 0; i < n; ++i)
        {
            float levelSq = 0.0f;
            for (int c = 0; c < numCh; ++c)
                levelSq = std::max (levelSq, ch[c][i] * ch[c][i]);

            const float coef = levelSq > envSq ? attackCoef : releaseCoef;
            envSq = levelSq + coef * (envSq - levelSq);

            const float rms = std::sqrt (envSq);
            const float gain = rms >= threshold ? 1.0f
                             : rms <= 0.0f      ? 0.0f
                                                : std::pow (rms / threshold, ratio - 1.0f);
            for (int c = 0; c < numCh; ++c)
                ch[c][i] *= gain;
        }
    }

private:
    float coefFor (float ms) const
    {
        return (float) std::exp (-1.0 / (std::max (0.01f, ms) * 0.001 * sampleRate));
    }

    double sampleRate = 48000.0;
    float threshold = 0.001f, ratio = 10.0f;
    float attackMs = 1.0f, releaseMs = 60.0f;
    float attackCoef = 0.0f, releaseCoef = 0.0f;
    float envSq = 0.0f;
};

/** Safety peak limiter: instant attack, exponential release, linked across
    channels, then a hard clip at the ceiling. Non-finite samples become
    silence. The ceiling is guaranteed, which is the point (ears first). */
class Limiter
{
public:
    void prepare (double sr)
    {
        sampleRate = sr;
        setReleaseMs (releaseMs);
        reset();
    }

    void reset() { env = 0.0f; minGain = 1.0f; }

    void setThresholdDb (float db) { ceiling = std::pow (10.0f, db * 0.05f); }
    void setReleaseMs (float ms)
    {
        releaseMs = ms;
        releaseCoef = (float) std::exp (-1.0 / (std::max (0.01f, ms) * 0.001 * sampleRate));
    }

    void process (float* const* ch, int numCh, int n)
    {
        for (int i = 0; i < n; ++i)
        {
            float peak = 0.0f;
            for (int c = 0; c < numCh; ++c)
            {
                float& x = ch[c][i];
                if (! std::isfinite (x))
                    x = 0.0f;
                peak = std::max (peak, std::abs (x));
            }

            env = peak >= env ? peak : peak + releaseCoef * (env - peak);
            const float gain = env > ceiling ? ceiling / env : 1.0f;
            minGain = std::min (minGain, gain);

            for (int c = 0; c < numCh; ++c)
                ch[c][i] = std::clamp (ch[c][i] * gain, -ceiling, ceiling);
        }
    }

    /** Lowest gain applied since the last call (1 = no limiting). */
    float takeMinGain()
    {
        const float g = minGain;
        minGain = 1.0f;
        return g;
    }

private:
    double sampleRate = 48000.0;
    float ceiling = 0.891f, releaseMs = 100.0f, releaseCoef = 0.0f;
    float env = 0.0f, minGain = 1.0f;
};

} // namespace phreak
