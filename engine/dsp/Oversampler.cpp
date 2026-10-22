#include "Oversampler.h"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace phreak
{

namespace
{
    // Elliptic-filter design of the allpass coefficients, after
    // L. de Soras, hiir (PolyphaseIir2Designer), itself after
    // Valenzuela & Constantinides (1983).
    void transitionParams (double transition, double& k, double& q)
    {
        k = std::tan ((1.0 - transition * 2.0) * std::numbers::pi / 4.0);
        k *= k;
        const double kksqrt = std::pow (1.0 - k * k, 0.25);
        const double e = 0.5 * (1.0 - kksqrt) / (1.0 + kksqrt);
        const double e4 = e * e * e * e;
        q = e * (1.0 + e4 * (2.0 + e4 * (15.0 + 150.0 * e4)));
    }

    int orderFor (double attenuationDb, double q)
    {
        const double attnP2 = std::pow (10.0, -attenuationDb / 10.0);
        const double a = attnP2 / (1.0 - attnP2);
        int order = (int) std::ceil (std::log (a * a / 16.0) / std::log (q));
        if (order % 2 == 0)
            ++order;
        return order;
    }

    double coefficient (int index, double k, double q, int order)
    {
        const int c = index + 1;

        double num = 0.0, term = 0.0;
        int i = 0, sign = 1;
        do
        {
            term = std::pow (q, i * (i + 1)) * std::sin ((i * 2 + 1) * c * std::numbers::pi / order) * sign;
            num += term;
            sign = -sign;
            ++i;
        } while (std::abs (term) > 1e-100);
        num *= std::pow (q, 0.25);

        double den = 0.0;
        i = 1;
        sign = -1;
        do
        {
            term = std::pow (q, i * i) * std::cos (i * 2 * c * std::numbers::pi / order) * sign;
            den += term;
            sign = -sign;
            ++i;
        } while (std::abs (term) > 1e-100);
        den += 0.5;

        const double ww = num / den;
        const double wwsq = ww * ww;
        const double x = std::sqrt ((1.0 - wwsq * k) * (1.0 - wwsq / k)) / (1.0 + wwsq);
        return (1.0 - x) / (1.0 + x);
    }
} // namespace

void HalfBand2x::design (double attenuationDb, double transition)
{
    double k = 0.0, q = 0.0;
    transitionParams (transition, k, q);
    const int order = orderFor (attenuationDb, q);
    numCoefs = std::min ((order - 1) / 2, maxCoefs);

    for (auto* chain : { &upA0, &upA1, &downA0, &downA1 })
        chain->n = 0;

    // Even-indexed coefficients form the undelayed branch A0, odd ones A1
    // (the other assignment is not a lowpass; checked in tests).
    for (int i = 0; i < numCoefs; ++i)
    {
        const float c = (float) coefficient (i, k, q, order);
        for (auto* chain : (i % 2 == 0) ? std::array { &upA0, &downA0 }
                                         : std::array { &upA1, &downA1 })
            chain->c[(size_t) chain->n++] = c;
    }
    reset();
}

void HalfBand2x::reset()
{
    upA0.reset();
    upA1.reset();
    downA0.reset();
    downA1.reset();
    prevOdd = 0.0f;
}

double HalfBand2x::groupDelayHighRate() const
{
    // First-order allpass (c + z^-1)/(1 + c z^-1) has DC group delay
    // (1 - c)/(1 + c) low-rate samples = twice that at the high rate.
    // At DC both branches have unit gain, so H's delay is their average.
    auto chainDelay = [] (const AllpassChain& ch)
    {
        double d = 0.0;
        for (int i = 0; i < ch.n; ++i)
            d += 2.0 * (1.0 - ch.c[(size_t) i]) / (1.0 + ch.c[(size_t) i]);
        return d;
    };
    return 0.5 * (chainDelay (upA0) + 1.0 + chainDelay (upA1));
}

void Oversampler::prepare (int numChannels, int maxBlockSize, int factor)
{
    numStages = factor >= 8 ? 3 : factor >= 4 ? 2 : factor >= 2 ? 1 : 0;
    channels.assign ((size_t) numChannels, {});
    for (auto& ch : channels)
        for (int s = 0; s < numStages; ++s)
        {
            // Every stage keeps 20 kHz flat; the higher the rate, the wider
            // the transition band and the fewer allpass sections it needs.
            const double highRate = 96.0 * (1 << s); // kHz, at a 48 kHz base
            ch.stages[(size_t) s].design (s == 0 ? 110.0 : 100.0, 2.0 * (0.25 - 20.0 / highRate));
            ch.bufs[(size_t) s].assign ((size_t) maxBlockSize << (s + 1), 0.0f);
        }
    passthrough.assign ((size_t) maxBlockSize, 0.0f);
}

void Oversampler::reset()
{
    for (auto& ch : channels)
        for (auto& st : ch.stages)
            st.reset();
}

float* Oversampler::up (int chIndex, const float* in, int n)
{
    if (numStages == 0)
    {
        std::copy (in, in + n, passthrough.data());
        return passthrough.data();
    }
    auto& ch = channels[(size_t) chIndex];
    const float* src = in;
    int len = n;
    for (int s = 0; s < numStages; ++s)
    {
        float* dst = ch.bufs[(size_t) s].data();
        for (int i = 0; i < len; ++i)
            ch.stages[(size_t) s].up (src[i], dst[2 * i], dst[2 * i + 1]);
        src = dst;
        len *= 2;
    }
    return ch.bufs[(size_t) numStages - 1].data();
}

void Oversampler::down (int chIndex, float* out, int n)
{
    if (numStages == 0)
    {
        std::copy (passthrough.data(), passthrough.data() + n, out);
        return;
    }
    auto& ch = channels[(size_t) chIndex];
    for (int s = numStages - 1; s >= 0; --s)
    {
        const int len = n << s; // output length of this stage
        const float* src = ch.bufs[(size_t) s].data();
        float* dst = s == 0 ? out : ch.bufs[(size_t) s - 1].data();
        for (int i = 0; i < len; ++i)
            dst[i] = ch.stages[(size_t) s].down (src[2 * i], src[2 * i + 1]);
    }
}

double Oversampler::getLatencySamples() const
{
    if (channels.empty())
        return 0.0;
    // Each stage runs H twice (up + down) at its high rate, 2^(s+1) x base.
    double latency = 0.0;
    for (int s = 0; s < numStages; ++s)
        latency += 2.0 * channels.front().stages[(size_t) s].groupDelayHighRate() / (double) (2 << s);
    return latency;
}

} // namespace phreak
