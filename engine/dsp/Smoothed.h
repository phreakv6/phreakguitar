#pragma once

#include <algorithm>
#include <cmath>

namespace phreak
{

/** Linear ramp towards a target over a fixed time. Not thread-safe: owned
    by the audio thread (AmpChain feeds it from atomics at block start). */
class LinearSmoothed
{
public:
    explicit LinearSmoothed (float initial = 0.0f) : current (initial), target (initial) {}

    void reset (double sampleRate, double rampSeconds)
    {
        steps = std::max (1, (int) std::floor (rampSeconds * sampleRate));
        snap();
    }

    void snap()                         { current = target; countdown = 0; }
    void setCurrentAndTarget (float v)  { target = v; snap(); }

    void setTarget (float v)
    {
        if (std::abs (v - target) <= 0.0f) // exact compare, without -Wfloat-equal noise
            return;
        target = v;
        countdown = steps;
        step = (target - current) / (float) countdown;
    }

    float next()
    {
        if (countdown <= 0)
            return target;
        if (--countdown == 0)
            current = target;
        else
            current += step;
        return current;
    }

    void skip (int n)
    {
        if (n >= countdown)
            snap();
        else
        {
            current += step * (float) n;
            countdown -= n;
        }
    }

    bool isSmoothing() const { return countdown > 0; }
    float getCurrent() const { return current; }
    float getTarget() const  { return target; }

private:
    float current, target, step = 0.0f;
    int steps = 1, countdown = 0;
};

/** Exponential (constant ratio per sample) ramp; values must stay > 0. */
class MultiplicativeSmoothed
{
public:
    explicit MultiplicativeSmoothed (float initial = 1.0f) : current (initial), target (initial) {}

    void reset (double sampleRate, double rampSeconds)
    {
        steps = std::max (1, (int) std::floor (rampSeconds * sampleRate));
        snap();
    }

    void snap()                         { current = target; countdown = 0; }
    void setCurrentAndTarget (float v)  { target = v; snap(); }

    void setTarget (float v)
    {
        if (std::abs (v - target) <= 0.0f) // exact compare, without -Wfloat-equal noise
            return;
        target = v;
        countdown = steps;
        step = std::exp ((std::log (target) - std::log (current)) / (float) countdown);
    }

    float next()
    {
        if (countdown <= 0)
            return target;
        if (--countdown == 0)
            current = target;
        else
            current *= step;
        return current;
    }

    float getCurrent() const { return current; }
    float getTarget() const  { return target; }

private:
    float current, target, step = 1.0f;
    int steps = 1, countdown = 0;
};

inline float dbToGain (float db)   { return std::pow (10.0f, db * 0.05f); }
inline double dbToGain (double db) { return std::pow (10.0, db * 0.05); }

} // namespace phreak
