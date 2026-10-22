#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>

#include "amp/DriveStage.h"
#include "amp/ToneStack.h"
#include "amp/AmpChain.h"
#include "amp/PowerSupply.h"
#include "dsp/Oversampler.h"
#include "fx/PostEffect.h"

#include <algorithm>
#include <cmath>
#include <complex>
#include <limits>
#include <numbers>
#include <vector>

namespace
{

constexpr double pi = std::numbers::pi;

// Minimal multichannel buffer for engine calls (float* const*).
struct Buffer
{
    Buffer (int numCh, int n) : data ((size_t) numCh, std::vector<float> ((size_t) n, 0.0f))
    {
        for (auto& ch : data)
            ptrs.push_back (ch.data());
    }

    float* const* get()  { return ptrs.data(); }
    int channels() const { return (int) data.size(); }
    int size() const     { return (int) data.front().size(); }
    void clear()         { for (auto& ch : data) std::fill (ch.begin(), ch.end(), 0.0f); }

    float magnitude (int ch, int start, int len) const
    {
        float m = 0.0f;
        for (int i = start; i < start + len; ++i)
            m = std::max (m, std::abs (data[(size_t) ch][(size_t) i]));
        return m;
    }

    std::vector<std::vector<float>> data;
    std::vector<float*> ptrs;
};

// |H(e^{j 2 pi f / sr})| for the 3rd-order digital coefficients {B0..B3, A0..A3}.
double responseAt (const std::array<double, 8>& c, double f, double sr)
{
    const auto z = std::exp (std::complex<double> (0.0, -2.0 * pi * f / sr));
    std::complex<double> num = 0.0, den = 0.0, zp = 1.0;
    for (int i = 0; i < 4; ++i)
    {
        num += c[(size_t) i] * zp;
        den += c[(size_t) (i + 4)] * zp;
        zp *= z;
    }
    return std::abs (num / den);
}

// Steady-state gain of a sine through a 4x up/down round trip.
double oversamplerGain (double freq, double sr = 48000.0)
{
    phreak::Oversampler4x os;
    constexpr int block = 256, blocks = 40;
    os.prepare (1, block);

    std::vector<float> buf (block);
    double inPeak = 0.0, outPeak = 0.0;
    for (int b = 0; b < blocks; ++b)
    {
        for (int i = 0; i < block; ++i)
            buf[(size_t) i] = (float) std::sin (2.0 * pi * freq * (b * block + i) / sr);
        os.up (0, buf.data(), block);
        os.down (0, buf.data(), block);
        if (b >= blocks / 2) // settled
            for (int i = 0; i < block; ++i)
            {
                inPeak = std::max (inPeak, std::abs (std::sin (2.0 * pi * freq * (b * block + i) / sr)));
                outPeak = std::max (outPeak, (double) std::abs (buf[(size_t) i]));
            }
    }
    return outPeak / inPeak;
}

} // namespace

// --- transfer curve ----------------------------------------------------------

TEST_CASE ("shape: silence in, silence out", "[drive]")
{
    for (float bias : { 0.0f, 0.15f, 0.25f })
        REQUIRE (phreak::DriveStage::shape (0.0f, bias) == Catch::Approx (0.0f).margin (1e-9));
}

TEST_CASE ("shape: monotonic and bounded", "[drive]")
{
    constexpr float bias = 0.2f;
    float prev = phreak::DriveStage::shape (-10.0f, bias);
    for (float x = -9.9f; x <= 10.0f; x += 0.1f)
    {
        const float y = phreak::DriveStage::shape (x, bias);
        if (std::abs (x) <= 3.0f)
            REQUIRE (y > prev);        // strictly increasing where tanh has slope
        else
            REQUIRE (y >= prev);       // float32 plateaus in deep saturation
        REQUIRE (std::abs (y) < 2.0f); // bounded
        prev = y;
    }
}

TEST_CASE ("shape: bias creates asymmetry (even harmonics)", "[drive]")
{
    constexpr float bias = 0.2f;
    const float pos = phreak::DriveStage::shape (1.0f, bias);
    const float neg = phreak::DriveStage::shape (-1.0f, bias);
    REQUIRE (std::abs (pos) != Catch::Approx (std::abs (neg)).epsilon (0.01));

    // ...and zero bias is symmetric.
    const float posSym = phreak::DriveStage::shape (1.0f, 0.0f);
    const float negSym = phreak::DriveStage::shape (-1.0f, 0.0f);
    REQUIRE (std::abs (posSym) == Catch::Approx (std::abs (negSym)));
}

// --- Oversampler ----------------------------------------------------------------

TEST_CASE ("Oversampler: passband is flat to 20 kHz", "[oversampler]")
{
    for (double f : { 100.0, 1000.0, 5000.0, 10000.0, 15000.0, 19000.0 })
        REQUIRE (20.0 * std::log10 (oversamplerGain (f)) == Catch::Approx (0.0).margin (0.1));
}

TEST_CASE ("Oversampler: half-band stage rejects its stopband", "[oversampler]")
{
    // Drive one 2x stage at the high rate and measure H directly:
    // a tone in the stopband (28..48 kHz at 96 kHz) must be crushed by down().
    phreak::HalfBand2x hb;
    hb.design (110.0, 2.0 * (0.25 - 20.0 / 96.0));

    for (double f : { 28500.0, 32000.0, 40000.0, 47000.0 })
    {
        hb.reset();
        double peak = 0.0;
        for (int m = 0; m < 8192; ++m)
        {
            const float e = (float) std::sin (2.0 * pi * f * (2 * m) / 96000.0);
            const float o = (float) std::sin (2.0 * pi * f * (2 * m + 1) / 96000.0);
            const float y = hb.down (e, o);
            if (m > 4096)
                peak = std::max (peak, (double) std::abs (y));
        }
        REQUIRE (20.0 * std::log10 (std::max (peak, 1e-12)) < -100.0);
    }
}

TEST_CASE ("Oversampler: reported latency matches a measured impulse delay", "[oversampler]")
{
    phreak::Oversampler4x os;
    constexpr int n = 512;
    os.prepare (1, n);

    // Low-passed impulse (DC-ish content) so the DC group delay applies.
    std::vector<float> buf (n, 0.0f);
    for (int i = 0; i < 64; ++i)
        buf[(size_t) i] = (float) (0.5 - 0.5 * std::cos (2.0 * pi * i / 64.0));
    os.up (0, buf.data(), n);
    os.down (0, buf.data(), n);

    // Centroid of the output minus centroid of the input (the pulse is
    // symmetric about i = 32: value(i) == value(64 - i)).
    double num = 0.0, den = 0.0;
    for (int i = 0; i < n; ++i)
    {
        num += i * (double) buf[(size_t) i];
        den += buf[(size_t) i];
    }
    const double measured = num / den - 32.0;
    REQUIRE (measured == Catch::Approx (os.getLatencySamples()).margin (0.25));
    REQUIRE (os.getLatencySamples() < 8.0); // low-latency design
}

// --- DriveStage block processing ----------------------------------------------

TEST_CASE ("DriveStage: silence in, silence out through the full stage", "[drive]")
{
    phreak::DriveStage stage;
    stage.prepare (48000.0, 512, 2);
    stage.setDrive (0.8f);

    Buffer buffer (2, 512);
    for (int i = 0; i < 8; ++i) // several blocks so filters/oversampler settle
        stage.process (buffer.get(), 2, 512);

    REQUIRE (buffer.magnitude (0, 0, 512) < 1e-5f);
}

TEST_CASE ("DriveStage: reports oversampling latency", "[drive]")
{
    phreak::DriveStage stage;
    stage.prepare (48000.0, 512, 2);
    REQUIRE (stage.getLatencySamples() > 0.0);
}

// --- ToneStack ----------------------------------------------------------------

TEST_CASE ("ToneStack: knobs act on their bands", "[tonestack]")
{
    using TS = phreak::ToneStack;
    constexpr double sr = 48000.0;

    // Treble up -> more 5 kHz.
    const auto tLo = TS::digitalCoefficients (TS::bassman5F6A, 0.1, 0.5, 0.2, sr);
    const auto tHi = TS::digitalCoefficients (TS::bassman5F6A, 0.9, 0.5, 0.2, sr);
    REQUIRE (responseAt (tHi, 5000, sr) > responseAt (tLo, 5000, sr) * 1.5);

    // Bass up -> more 80 Hz.
    const auto lLo = TS::digitalCoefficients (TS::bassman5F6A, 0.5, 0.5, 0.05, sr);
    const auto lHi = TS::digitalCoefficients (TS::bassman5F6A, 0.5, 0.5, 0.9, sr);
    REQUIRE (responseAt (lHi, 80, sr) > responseAt (lLo, 80, sr) * 1.5);

    // Mid up -> more 500 Hz.
    const auto mLo = TS::digitalCoefficients (TS::bassman5F6A, 0.5, 0.05, 0.2, sr);
    const auto mHi = TS::digitalCoefficients (TS::bassman5F6A, 0.5, 0.9, 0.2, sr);
    REQUIRE (responseAt (mHi, 500, sr) > responseAt (mLo, 500, sr) * 1.2);
}

TEST_CASE ("ToneStack: stable (impulse decays) across knob grid", "[tonestack]")
{
    for (float t : { 0.0f, 0.5f, 1.0f })
        for (float m : { 0.0f, 0.5f, 1.0f })
            for (float b : { 0.0f, 0.5f, 1.0f })
            {
                phreak::ToneStack ts;
                ts.setKnobs (t, m, b);
                ts.prepare (48000.0, 1);

                Buffer buf (1, 4096);
                buf.data[0][0] = 1.0f;
                ts.process (buf.get(), 1, 4096);

                // Passive RC network: impulse response must decay.
                const float early = buf.magnitude (0, 0, 1024);
                const float late = buf.magnitude (0, 3072, 1024);
                REQUIRE (early > 0.0f);
                REQUIRE (late < early * 0.01f);
            }
}

// --- AmpChain -----------------------------------------------------------------

TEST_CASE ("AmpChain: output never exceeds limiter ceiling", "[chain]")
{
    phreak::AmpChain chain;
    chain.prepare (48000.0, 512, 2);
    chain.setInputGainDb (24.0f);   // slam it
    chain.setDrive (1.0f);
    chain.setOutputGainDb (24.0f);

    Buffer buffer (2, 512);
    const float ceiling = std::pow (10.0f, phreak::AmpChain::limiterThresholdDb / 20.0f);

    float maxAbs = 0.0f;
    for (int block = 0; block < 32; ++block)
    {
        for (int ch = 0; ch < 2; ++ch)
            for (int i = 0; i < 512; ++i)
                buffer.data[(size_t) ch][(size_t) i] =
                    0.9f * (float) std::sin (2.0 * pi * 110.0 * (block * 512 + i) / 48000.0);
        chain.process (buffer.get(), 2, 512);
        maxAbs = std::max (maxAbs, buffer.magnitude (0, 0, 512));
    }

    REQUIRE (maxAbs <= ceiling + 1e-6f);
    REQUIRE (chain.limiterGain.load() < 1.0f); // and it reports that it worked
}

TEST_CASE ("AmpChain: limiter turns non-finite input into silence", "[chain]")
{
    phreak::AmpChain chain;
    chain.prepare (48000.0, 64, 1);

    Buffer buffer (1, 64);
    buffer.data[0][10] = std::numeric_limits<float>::quiet_NaN();
    buffer.data[0][20] = std::numeric_limits<float>::infinity();
    chain.processPostCab (buffer.get(), 1, 64);

    for (float v : buffer.data[0])
        REQUIRE (std::isfinite (v));
}

TEST_CASE ("AmpChain: gate attenuates sub-threshold signal", "[chain]")
{
    auto run = [] (bool gateOn)
    {
        phreak::AmpChain chain;
        chain.prepare (48000.0, 512, 2);
        chain.setDrive (0.0f);
        chain.setGateEnabled (gateOn);
        chain.setGateThresholdDb (-40.0f);

        Buffer buffer (2, 512);
        float lastMag = 0.0f;
        for (int block = 0; block < 16; ++block)
        {
            for (int ch = 0; ch < 2; ++ch)
                for (int i = 0; i < 512; ++i) // -60 dBFS tone, well below threshold
                    buffer.data[(size_t) ch][(size_t) i] =
                        0.001f * (float) std::sin (2.0 * pi * 220.0 * (block * 512 + i) / 48000.0);
            chain.process (buffer.get(), 2, 512);
            lastMag = buffer.magnitude (0, 0, 512);
        }
        return lastMag;
    };

    const float open = run (false);
    const float gated = run (true);
    REQUIRE (gated < open * 0.1f); // at least 20 dB quieter through the gate
}

TEST_CASE ("AmpChain: silence in, silence out", "[chain]")
{
    phreak::AmpChain chain;
    chain.prepare (48000.0, 512, 2);
    chain.setDrive (1.0f);

    Buffer buffer (2, 512);
    for (int i = 0; i < 8; ++i)
        chain.process (buffer.get(), 2, 512);

    REQUIRE (buffer.magnitude (0, 0, 512) < 1e-5f);
}

TEST_CASE ("AmpChain: pre + post halves equal process()", "[chain]")
{
    auto render = [] (bool split)
    {
        phreak::AmpChain chain;
        chain.prepare (48000.0, 128, 1);
        chain.setDrive (0.7f);
        Buffer buffer (1, 128);
        std::vector<float> out;
        for (int block = 0; block < 8; ++block)
        {
            for (int i = 0; i < 128; ++i)
                buffer.data[0][(size_t) i] = 0.3f * (float) std::sin (2.0 * pi * 440.0 * (block * 128 + i) / 48000.0);
            if (split)
            {
                chain.processPreCab (buffer.get(), 1, 128);
                chain.processPostCab (buffer.get(), 1, 128);
            }
            else
                chain.process (buffer.get(), 1, 128);
            out.insert (out.end(), buffer.data[0].begin(), buffer.data[0].end());
        }
        return out;
    };
    REQUIRE (render (true) == render (false));
}

// --- After-the-amp effects --------------------------------------------------------

TEST_CASE ("Digital delay: an impulse echoes at the set time, then repeats quieter", "[fx]")
{
    auto dd3 = phreak::makeDigitalDelay();
    dd3->prepare (48000.0, 512);
    dd3->setControl (0, 1.0f / 1.2f); // E.Level: repeats at the dry level
    dd3->setControl (1, 0.5f);        // F.Back
    dd3->setControl (2, 0.5f);        // D.Time mid of range
    dd3->setControl (3, 0.5f);        // Mode M: 50 * 4^0.5 = 100 ms
    dd3->reset();

    std::vector<float> buf (48000, 0.0f);
    buf[0] = 1.0f;
    float* chans[] = { buf.data() };
    for (int pos = 0; pos < 48000; pos += 512)
    {
        float* block[] = { buf.data() + pos };
        dd3->process (block, 1, std::min (512, 48000 - pos));
    }
    (void) chans;
    const auto peakNear = [&] (int centre)
    {
        float m = 0.0f;
        for (int i = centre - 60; i < centre + 60; ++i)
            m = std::max (m, std::abs (buf[(size_t) i]));
        return m;
    };
    REQUIRE (peakNear (4800) > 0.3f);              // first echo at 100 ms
    REQUIRE (peakNear (9600) < peakNear (4800));   // second repeat quieter
    REQUIRE (peakNear (2400) < 0.01f);             // nothing in between
}

TEST_CASE ("Reverb: every mode rings out, stays finite and decays", "[fx]")
{
    for (float mode : { 0.0f, 0.5f, 1.0f })
    {
        auto hg = phreak::makeReverb();
        hg->prepare (48000.0, 512);
        hg->setControl (0, 1.0f);
        hg->setControl (1, mode);
        std::vector<float> l (48000 * 6, 0.0f), r (48000 * 6, 0.0f);
        l[0] = r[0] = 1.0f;
        for (size_t pos = 0; pos < l.size(); pos += 512)
        {
            float* block[] = { l.data() + pos, r.data() + pos };
            hg->process (block, 2, 512);
        }
        float early = 0.0f, late = 0.0f;
        for (size_t i = 4800; i < 48000; ++i) early = std::max (early, std::abs (l[i]));
        for (size_t i = 48000 * 5; i < l.size(); ++i) late = std::max (late, std::abs (l[i]));
        REQUIRE (std::all_of (l.begin(), l.end(), [] (float v) { return std::isfinite (v); }));
        INFO ("mode " << mode);
        REQUIRE (early > 1e-3f);         // there is a tail
        REQUIRE (late < early * 0.05f);  // and it dies away
    }
}

TEST_CASE ("7-band EQ: flat when centred, a slider moves its own band", "[fx]")
{
    // Steady-state sine gain (dB) through the EQ, after the sliders glide.
    const auto gainAt = [] (phreak::PostEffect& eq, double hz)
    {
        eq.reset();
        std::vector<float> buf (512);
        double peak = 0.0;
        for (int b = 0; b < 200; ++b) // ~2 s: sliders settled, filters rung in
        {
            for (int i = 0; i < 512; ++i)
                buf[(size_t) i] = (float) std::sin (2.0 * std::numbers::pi * hz * (b * 512 + i) / 48000.0);
            float* ch[] = { buf.data() };
            eq.process (ch, 1, 512);
            if (b > 150)
                for (float v : buf) peak = std::max (peak, (double) std::abs (v));
        }
        return 20.0 * std::log10 (peak);
    };

    auto eq = phreak::makeEq7();
    eq->prepare (48000.0, 512);
    for (double hz : { 60.0, 400.0, 2000.0, 9000.0 })
        CHECK (gainAt (*eq, hz) == Catch::Approx (0.0).margin (0.05));

    eq->setControl (3, 1.0f); // 800 Hz slider all the way up
    CHECK (gainAt (*eq, 800.0) == Catch::Approx (15.0).margin (0.2));
    CHECK (gainAt (*eq, 100.0) == Catch::Approx (0.0).margin (0.5));
    CHECK (gainAt (*eq, 6400.0) == Catch::Approx (0.0).margin (0.5));

    eq->setControl (3, 0.5f);
    eq->setControl (7, 0.0f); // Level all the way down
    CHECK (gainAt (*eq, 1000.0) == Catch::Approx (-15.0).margin (0.1));
}

TEST_CASE ("Compressor: evens out loud and soft playing", "[fx]")
{
    // A loud and a soft burst (20 dB apart): with Sensitivity up, they come
    // out much closer together.
    auto comp = phreak::makeCompressor();
    comp->prepare (48000.0, 512);
    comp->setControl (1, 0.8f);
    const auto burstPeak = [&] (float amp)
    {
        comp->reset();
        std::vector<float> buf (512);
        float peak = 0.0f;
        for (int b = 0; b < 60; ++b)
        {
            for (int i = 0; i < 512; ++i)
                buf[(size_t) i] = amp * (float) std::sin (2.0 * std::numbers::pi * 196.0 * (b * 512 + i) / 48000.0);
            float* ch[] = { buf.data() };
            comp->process (ch, 1, 512);
            if (b > 40)
                for (float v : buf) peak = std::max (peak, std::abs (v));
        }
        return 20.0f * std::log10 (peak);
    };
    const float loud = burstPeak (0.3f), soft = burstPeak (0.03f);
    CHECK (loud - soft < 6.0f);   // 20 dB in, under 6 dB out
    CHECK (loud - soft > 0.5f);   // still compression, not a gate in reverse
}

namespace
{
    // Idle B+, and the lowest B+ during a 300 ms full-power note.
    std::pair<double, double> supplyBurst (phreak::PowerSupply& s)
    {
        s.reset();
        double idle = 0.0, low = 1e9;
        for (int i = 0; i < 48000; ++i)
        {
            const double t = i / 48000.0;
            const double drive = t >= 0.2 && t < 0.5 ? std::abs (std::sin (2.0 * std::numbers::pi * 110.0 * t)) : 0.0;
            s.step (drive);
            if (i == 9000) idle = s.voltage();
            low = std::min (low, s.voltage());
        }
        return { idle, low };
    }
}

TEST_CASE ("PowerSupply: idles at its B+, sags under load, tube rectifier sags more", "[power]")
{
    phreak::PowerSupply::Config c;
    c.bplus = 430.0; c.capUF = 40.0; c.idleMA = 90.0; c.fullMA = 240.0; c.sourceOhms = 60.0;
    phreak::PowerSupply silicon, tube;
    silicon.prepare (c, 48000.0);
    c.tubeRectifier = true;
    tube.prepare (c, 48000.0);

    const auto [si, sl] = supplyBurst (silicon);
    const auto [ti, tl] = supplyBurst (tube);
    CHECK (si == Catch::Approx (430.0).margin (1.0));
    CHECK (ti == Catch::Approx (430.0).margin (1.0));
    CHECK (sl < si - 5.0);              // a full-power note pulls B+ down
    CHECK (ti - tl > 1.3 * (si - sl));  // the GZ34 sags clearly more

    // Ripple is averaged out: at idle, step() stays at 1 (+-0.2%).
    tube.reset();
    double lo = 9.0, hi = 0.0;
    for (int i = 0; i < 24000; ++i)
    {
        const double h = tube.step (0.0);
        if (i > 4800) { lo = std::min (lo, h); hi = std::max (hi, h); }
    }
    CHECK (lo > 0.998);
    CHECK (hi < 1.002);
}

TEST_CASE ("PowerSupply: Response makes it stiffer or softer, not louder at rest", "[power]")
{
    phreak::PowerSupply::Config c;
    c.tubeRectifier = true;
    c.bplus = 430.0; c.capUF = 40.0; c.idleMA = 90.0; c.fullMA = 240.0; c.sourceOhms = 60.0;
    phreak::PowerSupply s;
    s.prepare (c, 48000.0);
    double sag[3];
    for (int k = 0; k < 3; ++k)
    {
        s.setResponse (k * 0.5);
        const auto [idle, low] = supplyBurst (s);
        sag[k] = (idle - low) / idle;
        s.reset();
        double h = 0.0;
        for (int i = 0; i < 12000; ++i) h = s.step (0.0);
        CHECK (h == Catch::Approx (1.0).margin (0.003)); // headroom at rest stays 1
    }
    CHECK (sag[0] < sag[1]);
    CHECK (sag[1] < sag[2]);
}

TEST_CASE ("Photo vibe: chorus throbs, vibrato wobbles pitch, about unity overall", "[fx]")
{
    // A steady 440 Hz sine, 4 s, slow Speed (~1.1 Hz: the LDRs follow
    // the lamp fully; faster, they lag and the sweep gets shallower).
    const auto run = [] (float mode, std::vector<float>& out)
    {
        auto vibe = phreak::makePhotoVibe();
        vibe->prepare (48000.0, 256);
        vibe->setControl (0, 0.3f);
        vibe->setControl (1, 0.8f);
        vibe->setControl (2, 0.5f);
        vibe->setControl (3, mode);
        vibe->reset();
        out.assign (48000 * 4, 0.0f);
        for (size_t i = 0; i < out.size(); ++i)
            out[i] = 0.1f * (float) std::sin (2.0 * std::numbers::pi * 440.0 * (double) i / 48000.0);
        for (size_t p = 0; p < out.size(); p += 256)
        {
            float* ch[] = { out.data() + p };
            vibe->process (ch, 1, 256);
        }
    };
    // Level in 20 ms windows over the last 3 s: (max - min) in dB, and the mean.
    const auto levels = [] (const std::vector<float>& y)
    {
        double lo = 1e9, hi = 0.0, sum = 0.0;
        int count = 0;
        for (size_t w = 48000; w + 960 <= y.size(); w += 960)
        {
            double pk = 0.0;
            for (size_t i = w; i < w + 960; ++i) pk = std::max (pk, (double) std::abs (y[i]));
            lo = std::min (lo, pk); hi = std::max (hi, pk); sum += pk; ++count;
        }
        return std::pair { 20.0 * std::log10 (hi / lo), sum / count };
    };

    std::vector<float> chorus, vibrato;
    run (0.0f, chorus);
    run (1.0f, vibrato);
    for (float v : chorus) REQUIRE (std::isfinite (v));

    const auto [chorusSwing, chorusMean] = levels (chorus);
    const auto [vibratoSwing, vibratoMean] = levels (vibrato);
    CHECK (chorusSwing > 10.0);  // the notches sweep through: it throbs
    CHECK (vibratoSwing < 3.0);  // vibrato: level steady ...
    CHECK (chorusMean > 0.04);   // and neither mode loses the signal
    CHECK (vibratoMean > 0.07);
    CHECK (vibratoMean < 0.16);  // ~unity (0.1 in) at Volume centre

    // ... but the pitch wobbles: zero-crossing periods vary.
    double pmin = 1e9, pmax = 0.0, last = -1.0;
    for (size_t i = 48000; i + 1 < vibrato.size(); ++i)
        if (vibrato[i] <= 0.0f && vibrato[i + 1] > 0.0f)
        {
            const double t = (double) i + vibrato[i] / (vibrato[i] - vibrato[i + 1]);
            if (last > 0.0) { pmin = std::min (pmin, t - last); pmax = std::max (pmax, t - last); }
            last = t;
        }
    CHECK ((pmax - pmin) / (48000.0 / 440.0) > 0.01); // more than 1% (~17 cents) of swing
}
