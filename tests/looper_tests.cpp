#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>

#include "fx/Looper.h"

#include <cmath>
#include <vector>

using phreak::Looper;

namespace
{
    // Runs `n` samples of mono `in` (repeated into both channels) through
    // the looper in 128-sample blocks; returns channel 0 of the output.
    std::vector<float> run (Looper& l, const std::vector<float>& in)
    {
        std::vector<float> out (in.size());
        std::vector<float> a (128), b (128);
        for (size_t s = 0; s < in.size(); s += 128)
        {
            const size_t n = std::min<size_t> (128, in.size() - s);
            for (size_t i = 0; i < n; ++i) a[i] = b[i] = in[s + i];
            float* ch[] = { a.data(), b.data() };
            l.process (ch, 2, (int) n);
            for (size_t i = 0; i < n; ++i) out[s + i] = a[i];
        }
        return out;
    }
    std::vector<float> tone (size_t n, double f, float amp = 0.5f)
    {
        std::vector<float> v (n);
        for (size_t i = 0; i < n; ++i) v[i] = amp * (float) std::sin (f * (double) i);
        return v;
    }
    double maxDiff (const std::vector<float>& a, const std::vector<float>& b)
    {
        double m = 0.0;
        for (size_t i = 0; i < a.size(); ++i) m = std::max (m, (double) std::abs (a[i] - b[i]));
        return m;
    }
}

TEST_CASE ("Looper: records, closes the loop, plays it back sample-exact", "[looper]")
{
    Looper l;
    l.enable (1000.0, 2, 10.0);
    const size_t len = 1000; // 1 s, not a multiple of the block
    const auto take = tone (len + 37, 0.07);
    l.press();                                  // record
    run (l, std::vector<float> (take.begin(), take.begin() + (long) len));
    l.press();                                  // close: plays from the top
    REQUIRE (l.state() == Looper::State::playing);
    REQUIRE (l.lengthSamples() == (int) len);
    const auto out = run (l, std::vector<float> (2 * len, 0.0f));
    for (size_t i = 0; i < 2 * len; ++i)
        REQUIRE (out[i] == take[i % len]);

    l.stop();                                   // silence
    const auto quiet = run (l, std::vector<float> (len, 0.0f));
    CHECK (maxDiff (quiet, std::vector<float> (len, 0.0f)) == 0.0);
    l.stop();                                   // and again from the top
    const auto again = run (l, std::vector<float> (len, 0.0f));
    for (size_t i = 0; i < len; ++i)
        REQUIRE (again[i] == take[i]);

    l.clear();
    CHECK (l.state() == Looper::State::empty);
}

TEST_CASE ("Looper: overdubs layer up; undo and redo the newest", "[looper]")
{
    // A long loop (many blocks), so layers fold into the base while playing.
    Looper l;
    l.enable (48000.0, 2, 5.0);
    const size_t len = 48000 + 91;
    const auto a = tone (len, 0.011), b = tone (len, 0.023, 0.25f), c = tone (len, 0.031, 0.125f);
    const std::vector<float> silence (len, 0.0f);
    auto sum = [&] (std::initializer_list<const std::vector<float>*> parts)
    {
        std::vector<float> s (len, 0.0f);
        for (auto* p : parts) for (size_t i = 0; i < len; ++i) s[i] += (*p)[i];
        return s;
    };

    l.press(); run (l, a); l.press();           // loop A
    l.press(); run (l, b); l.press();           // overdub B over one full pass
    CHECK (maxDiff (run (l, silence), sum ({ &a, &b })) < 1e-6);

    l.undo();                                   // B hidden
    CHECK (l.canRedo());
    CHECK (maxDiff (run (l, silence), a) < 1e-6);
    l.undo();                                   // B back
    CHECK (maxDiff (run (l, silence), sum ({ &a, &b })) < 1e-6);

    l.press(); run (l, c); l.press();           // overdub C: B folds into the base
    CHECK (maxDiff (run (l, silence), sum ({ &a, &b, &c })) < 1e-6);
    l.undo();                                   // only C goes
    CHECK (maxDiff (run (l, silence), sum ({ &a, &b })) < 1e-6);

    // Overdubbing after an undo drops the undone layer for good.
    l.press(); run (l, c); l.press();
    CHECK (maxDiff (run (l, silence), sum ({ &a, &b, &c })) < 1e-6);
}

TEST_CASE ("Looper: a full recording closes itself mid-block", "[looper]")
{
    Looper l;
    l.enable (1000.0, 2, 0.5);                  // 500 samples
    const auto take = tone (700, 0.05);
    l.press();
    const auto out = run (l, take);             // 200 samples past full
    CHECK (l.state() == Looper::State::playing);
    CHECK (l.lengthSamples() == 500);
    for (size_t i = 500; i < 700; ++i)          // live input plus the loop's start
        REQUIRE (out[i] == Catch::Approx (take[i] + take[i - 500]).margin (1e-6));
}
