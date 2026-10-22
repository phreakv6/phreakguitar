#pragma once

#include <array>
#include <cmath>
#include <numbers>

namespace phreak
{

/** Order-N IIR, transposed direct form II, double-precision state.
    Coefficients are normalised so a0 == 1. One instance per channel. */
template <int Order>
class IIRFilter
{
public:
    struct Coeffs
    {
        std::array<double, Order + 1> b {};
        std::array<double, Order + 1> a {}; // a[0] is 1 after normalise()

        void normalise()
        {
            const double inv = 1.0 / a[0];
            for (auto& v : b) v *= inv;
            for (auto& v : a) v *= inv;
        }
    };

    void setCoeffs (const Coeffs& c) { k = c; }
    void reset()                     { s.fill (0.0); }

    float processSample (float in)
    {
        const double x = in;
        const double y = k.b[0] * x + s[0];
        for (int i = 0; i < Order - 1; ++i)
            s[(size_t) i] = k.b[(size_t) i + 1] * x - k.a[(size_t) i + 1] * y + s[(size_t) i + 1];
        s[Order - 1] = k.b[Order] * x - k.a[Order] * y;
        return (float) y;
    }

    void process (float* data, int n)
    {
        for (int i = 0; i < n; ++i)
            data[i] = processSample (data[i]);
    }

private:
    Coeffs k {};
    std::array<double, Order> s {};
};

using Biquad = IIRFilter<2>;

/** RBJ cookbook high shelf; gainFactor is linear amplitude at the top. */
inline Biquad::Coeffs makeHighShelf (double sampleRate, double freq, double q, double gainFactor)
{
    const double A = std::sqrt (gainFactor);
    const double w = 2.0 * std::numbers::pi * freq / sampleRate;
    const double cosw = std::cos (w);
    const double beta = std::sin (w) * std::sqrt (A) / q;
    const double am1 = A - 1.0, ap1 = A + 1.0;

    Biquad::Coeffs c;
    c.b = { A * (ap1 + am1 * cosw + beta),
            A * -2.0 * (am1 + ap1 * cosw),
            A * (ap1 + am1 * cosw - beta) };
    c.a = { ap1 - am1 * cosw + beta,
            2.0 * (am1 - ap1 * cosw),
            ap1 - am1 * cosw - beta };
    c.normalise();
    return c;
}

} // namespace phreak
