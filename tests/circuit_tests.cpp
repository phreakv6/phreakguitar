#include <catch2/catch_test_macros.hpp>
#include <catch2/catch_approx.hpp>

#include "circuit/DKSolver.h"
#include "circuit/Netlist.h"
#include "circuit/Pedal.h"
#include "amp/AmpChain.h"

#include <cmath>
#include <filesystem>
#include <fstream>
#include <numbers>
#include <sstream>
#include <string>

using namespace phreak::circuit;

namespace
{
Netlist parse (const std::string& text)
{
    Netlist nl;
    std::string error;
    INFO (error);
    REQUIRE (parseNetlist (text, nl, error));
    return nl;
}

DKSolver build (const std::string& text, double fs)
{
    DKSolver s;
    std::string error;
    const auto nl = parse (text);
    const bool ok = s.build (nl, fs, error);
    INFO (error);
    REQUIRE (ok);
    return s;
}
} // namespace

TEST_CASE ("parseValue: SPICE suffixes", "[circuit]")
{
    double v = 0.0;
    REQUIRE ((parseValue ("4.7k", v) && v == Catch::Approx (4700.0)));
    REQUIRE ((parseValue ("2.2uF", v) && v == Catch::Approx (2.2e-6)));
    REQUIRE ((parseValue ("1meg", v) && v == Catch::Approx (1e6)));
    REQUIRE ((parseValue ("470p", v) && v == Catch::Approx (470e-12)));
    REQUIRE ((parseValue ("10m", v) && v == Catch::Approx (0.01)));
    REQUIRE ((parseValue ("1e-9", v) && v == Catch::Approx (1e-9)));
    REQUIRE_FALSE (parseValue ("{x}", v));
}

TEST_CASE ("parseNetlist: rejects what it can't run", "[circuit]")
{
    Netlist nl;
    std::string error;
    REQUIRE_FALSE (parseNetlist ("*@input Vin\n*@output out\nVin in 0 0\nM1 d g s s NMOS\n", nl, error));
    REQUIRE (error.find ("M1") != std::string::npos);
    // A coupling must name two inductors the circuit has.
    REQUIRE_FALSE (parseNetlist ("*@input Vin\n*@output out\nVin in 0 0\nL1 in out 1\nK1 L1 L2 0.9\n", nl, error));
    REQUIRE (error.find ("inductors") != std::string::npos);
    REQUIRE_FALSE (parseNetlist ("R1 a b 1k\n", nl, error)); // no input
}

TEST_CASE ("DK solver: RC low-pass step matches 1 - e^(-t/RC)", "[circuit]")
{
    constexpr double fs = 48000.0, R = 1000.0, C = 1e-6;
    auto s = build ("*@input Vin\n*@output out\n"
                    "Vin in 0 0\nR1 in out 1k\nC1 out 0 1u\n", fs);

    double worst = 0.0;
    for (int n = 1; n <= 480; ++n) // 10 ms = 10 tau
    {
        const double y = s.process (1.0);
        // Trapezoidal sees the step as a ramp over the first sample, so
        // compare against the analytic response delayed by half a sample.
        const double t = (n - 0.5) / fs;
        worst = std::max (worst, std::abs (y - (1.0 - std::exp (-t / (R * C)))));
    }
    REQUIRE (worst < 1e-3);
}

TEST_CASE ("DK solver: a transformer steps up by its turns ratio", "[circuit]")
{
    // 1 H : 4 H at k = 0.9999 is a 1:2 step-up; at 1 kHz the windings'
    // reactance (6 k and up) dwarfs the 10 ohm source and the load
    // barely draws, so the secondary carries 2 x the input, in phase.
    // A second, reversed 4 H winding swings the other way (a centre tap).
    constexpr double fs = 48000.0, f = 1000.0;
    auto s = build ("*@input Vin\n*@output out\n"
                    "Vin in 0 0\nR1 in p 10\nL1 p 0 1\nL2 out 0 4\nL3 0 neg 4\n"
                    "Rl out 0 100k\nRn neg 0 100k\n"
                    "K1 L1 L2 0.9999\nK2 L1 L3 0.9999\nK3 L2 L3 0.9999\n", fs);
    double worst = 0.0;
    for (int n = 0; n < 4800; ++n)
    {
        const double x = std::sin (2.0 * 3.141592653589793 * f * n / fs);
        const double y = s.process (x);
        if (n >= 2400) // past the start-up transient
            worst = std::max (worst, std::abs (y - 2.0 * x));
    }
    REQUIRE (worst < 0.02);
}

TEST_CASE ("DK solver: diode clipper DC point matches a direct root solve", "[circuit]")
{
    auto s = build ("*@input Vin\n*@output out\n"
                    ".model D1N4148 D(IS=2.52n N=1.752)\n"
                    "Vin in 0 0\nR1 in out 1k\nD1 out 0 D1N4148\n", 48000.0);

    for (double vin : { 0.2, 1.0, 5.0, -5.0 })
    {
        double y = 0.0;
        for (int i = 0; i < 64; ++i)
            y = s.process (vin);

        // Bisection on (vin - v)/R = Is (exp(v / nVt) - 1) + gmin v.
        const double nvt = 1.752 * 1.380649e-23 * 300.15 / 1.602176634e-19;
        double lo = -10.0, hi = 10.0;
        for (int i = 0; i < 200; ++i)
        {
            const double v = 0.5 * (lo + hi);
            const double f = (vin - v) / 1000.0 - (2.52e-9 * (std::exp (v / nvt) - 1.0) + 1e-12 * v);
            (f > 0.0 ? lo : hi) = v;
        }
        INFO ("vin " << vin);
        REQUIRE (y == Catch::Approx (lo).margin (1e-6));
    }
    REQUIRE (s.stats.newtonFailures == 0);
}

TEST_CASE ("DK solver: pot position moves a divider", "[circuit]")
{
    const std::string text = "*@input Vin\n*@output w\n*@control lvl label=Level default=0.25\n"
                             "Vin in 0 0\nXP1 in w 0 POT R=10k pos={lvl}\n";
    auto s = build (text, 48000.0);
    REQUIRE (s.process (1.0) == Catch::Approx (0.25).margin (1e-3));
    s.setControls ({ 0.75 });
    REQUIRE (s.process (1.0) == Catch::Approx (0.75).margin (1e-3));
}

TEST_CASE ("Pedal: guard keeps output finite and reports nothing on a sane circuit", "[circuit]")
{
    phreak::Pedal p;
    std::string error;
    REQUIRE (p.load ("*@pedal name=\"Clipper\" oversample=2\n*@input Vin\n*@output out\n"
                     ".model DS D(IS=2.52n N=1.752)\n"
                     "Vin in 0 0\nR1 in out 2.2k\nD1 out 0 DS\nD2 0 out DS\n", error));
    REQUIRE (p.prepare (48000.0, 128, error));
    REQUIRE (p.getOversampling() == 2);

    std::vector<float> buf (128);
    float peak = 0.0f;
    for (int b = 0; b < 40; ++b)
    {
        for (int i = 0; i < 128; ++i)
            buf[(size_t) i] = 3.0f * (float) std::sin (2.0 * 3.14159265 * 220.0 * (b * 128 + i) / 48000.0);
        p.process (buf.data(), 128);
        for (float v : buf)
            peak = std::max (peak, std::abs (v));
    }
    REQUIRE (peak < 0.8f);  // silicon diodes clip near 0.6-0.7 V
    REQUIRE (peak > 0.4f);
    REQUIRE (p.getFaults() == 0);
    REQUIRE (p.getStats().newtonFailures == 0);
}

TEST_CASE ("Pedal: a knob jump glides instead of stepping", "[circuit]")
{
    phreak::Pedal p;
    std::string error;
    REQUIRE (p.load ("*@pedal name=\"Level\" oversample=1\n*@input Vin\n*@output w\n"
                     "*@control lvl label=Level default=0\n"
                     "Vin in 0 0\nXP1 in w 0 POT R=10k pos={lvl}\n", error));
    REQUIRE (p.prepare (48000.0, 64, error));

    std::vector<float> buf (64, 1.0f);
    p.process (buf.data(), 64);
    REQUIRE (buf.back() == Catch::Approx (0.0f).margin (1e-3));

    p.setControl (0, 1.0f); // jump the knob from 0 to 10
    buf.assign (64, 1.0f);
    p.process (buf.data(), 64);
    // First 16 samples: one glide step (~5 % of the way), not the full jump.
    REQUIRE (buf[0] < 0.1f);
    REQUIRE (buf[63] > buf[0]);

    for (int b = 0; b < 200; ++b) // ~270 ms (13 glide time constants): arrived
    {
        buf.assign (64, 1.0f);
        p.process (buf.data(), 64);
    }
    REQUIRE (buf.back() == Catch::Approx (1.0f).margin (1e-3));
}

TEST_CASE ("DK solver: op-amp subcircuit (VCVS) as a non-inverting x11 amp", "[circuit]")
{
    // Gain = 1 + 10k/1k = 11, through a subcircuit with an internal E source.
    auto s = build ("*@input Vin\n*@output out\n"
                    ".subckt AMP inp inn out\nE1 out 0 inp inn 1e6\n.ends\n"
                    "Vin in 0 0\nXU1 in fb out AMP\nRf out fb 10k\nRg fb 0 1k\n", 48000.0);
    REQUIRE (s.process (0.1) == Catch::Approx (1.1).margin (1e-4));
}

TEST_CASE ("DK solver: 12AX7 stage biases like the textbook", "[circuit]")
{
    // 300 V supply, 100k plate load, 1.5k cathode: ~1.3 V on the cathode,
    // ~0.85 mA, ~215 V on the plate (Koren 12AX7 parameters).
    auto s = build ("*@input Vin\n*@output p\n"
                    "Vin g 0 0\nXV1 p g k TRIODE MU=100 EX=1.4 KG1=1060 KP=600 KVB=300\n"
                    "Rk k 0 1.5k\nRp b p 100k\nVb b 0 DC 300\n", 48000.0);
    const double vp = s.process (0.0);
    REQUIRE (vp == Catch::Approx (216.0).margin (2.0));
}

TEST_CASE ("Factory circuits: no Newton failures or resets when driven hard", "[circuit]")
{
    // Every pedal and amp, knobs at their defaults, all at 0 and all at 1,
    // fed ~1 V peak plucks (a very hot pickup, pushed further by a boost)
    // that start abruptly: the transients that once threw a warm start
    // volts into forward bias.
    const std::filesystem::path root (PHREAK_SOURCE_DIR);
    for (const char* dir : { "pedals", "amps" })
        for (const auto& entry : std::filesystem::directory_iterator (root / dir))
        {
            if (entry.path().extension() != ".cir")
                continue;
            std::ifstream f (entry.path());
            std::stringstream text;
            text << f.rdbuf();

            for (int setting = 0; setting < 3; ++setting)
            {
                INFO (entry.path().filename().string() << " knobs " << (setting == 0 ? "default" : setting == 1 ? "all 0" : "all 1"));
                phreak::Pedal p;
                std::string error;
                REQUIRE (p.load (text.str(), error));
                for (int c = 0; c < p.getNumControls() && setting > 0; ++c)
                    p.setControl (c, setting == 1 ? 0.0f : 1.0f);
                REQUIRE (p.prepare (48000.0, 128, error));

                std::vector<float> buf (128);
                int n = 0;
                for (int b = 0; b < 375; ++b) // 1 s
                {
                    for (auto& s : buf)
                    {
                        const double t = (double) (n % 12000) / 48000.0; // a pluck every 250 ms
                        const double hz = 82.4 * (1 + (n / 12000) % 3);
                        s = (float) (std::exp (-t * 6.0) * std::sin (2.0 * std::numbers::pi * hz * t));
                        ++n;
                    }
                    p.process (buf.data(), 128);
                }
                CHECK (p.getFaults() == 0);
                CHECK (p.getStats().newtonFailures == 0);
            }
        }
}

TEST_CASE ("AmpChain pedal board: order matters, moves keep state, bypass skips", "[chain]")
{
    // Two simple circuits that don't commute: a diode clipper and a 1:10
    // voltage divider. Clip-then-attenuate peaks at ~0.06 V; attenuate-
    // then-clip passes a 1 V sine almost untouched (0.1 V, under the knee).
    const std::string clipper = "*@pedal name=\"Clip\" oversample=1\n*@input Vin\n*@output out\n"
                                "Vin in 0 0\nR1 in out 1k\nD1 out 0 DX\nD2 0 out DX\n.model DX D(IS=1e-15)\n";
    const std::string divider = "*@pedal name=\"Pad\" oversample=1\n*@input Vin\n*@output out\n"
                                "Vin in 0 0\nR1 in out 9k\nR2 out 0 1k\n";
    auto make = [] (const std::string& text)
    {
        auto p = std::make_unique<phreak::Pedal>();
        std::string error;
        REQUIRE (p->load (text, error));
        REQUIRE (p->prepare (48000.0, 64, error));
        return p;
    };
    auto peakThrough = [] (phreak::AmpChain& chain)
    {
        float peak = 0.0f;
        std::vector<float> buf (64);
        float* ch[] = { buf.data() };
        for (int b = 0; b < 40; ++b)
        {
            for (int i = 0; i < 64; ++i)
                buf[(size_t) i] = (float) std::sin (2.0 * std::numbers::pi * 220.0 * (b * 64 + i) / 48000.0);
            chain.processPreCab (ch, 1, 64);
        }
        for (float v : buf) peak = std::max (peak, std::abs (v));
        return peak;
    };

    // Both orders go through the same built-in amp, so peaks compare.
    phreak::AmpChain chain;
    chain.prepare (48000.0, 64, 1);
    chain.setPedal (0, make (clipper));
    chain.setPedal (2, make (divider)); // a gap in slot 1 is fine
    const float clipFirst = peakThrough (chain);
    chain.movePedal (2, 0);             // divider, clipper, (empty), (empty)
    REQUIRE (chain.getPedal (0)->getName() == "Pad");
    REQUIRE (chain.getPedal (1)->getName() == "Clip");
    REQUIRE (chain.getPedal (2) == nullptr);
    const float padFirst = peakThrough (chain);
    CHECK (padFirst > clipFirst * 1.2f);

    chain.setPedalEnabled (0, false);    // bypass the pad: the clipper alone
    phreak::AmpChain clipChain;
    clipChain.prepare (48000.0, 64, 1);
    clipChain.setPedal (3, make (clipper));
    const float clipOnly = peakThrough (clipChain);
    CHECK (peakThrough (chain) == Catch::Approx (clipOnly).margin (0.02 * clipOnly));
}

TEST_CASE ("Pedal probe reads any node's voltage", "[circuit]")
{
    // A 9 V divider (6 V at mid) beside a 1:2 signal divider to the output.
    phreak::Pedal p;
    std::string error;
    REQUIRE (p.load ("*@pedal name=\"Probe\" oversample=1\n*@input Vin\n*@output out\n"
                     "Vin in 0 0\nR3 in out 1k\nR4 out 0 1k\n"
                     "Vcc vcc 0 DC 9\nR1 vcc mid 1k\nR2 mid 0 2k\n", error));
    REQUIRE (p.prepare (48000.0, 64, error));
    REQUIRE_FALSE (p.setProbe ("nowhere"));
    REQUIRE (p.setProbe ("MID")); // names match whatever the case
    std::vector<float> buf (64, 0.5f), probe (phreak::Pedal::probeLength);
    p.process (buf.data(), 64);
    p.copyProbe (probe.data());
    CHECK (probe.back() == Catch::Approx (6.0).margin (1e-4));

    REQUIRE (p.setProbe ("out"));
    for (int i = 0; i < 64; ++i)
        buf[(size_t) i] = (float) std::sin (0.1 * i);
    std::vector<float> in = buf;
    p.process (buf.data(), 64);
    p.copyProbe (probe.data());
    for (int i = 0; i < 64; ++i) // the probe sees exactly what the output does
        CHECK (probe[(size_t) (phreak::Pedal::probeLength - 64 + i)] == Catch::Approx (buf[(size_t) i]).margin (1e-6));
    CHECK (buf[40] == Catch::Approx (0.5 * in[40]).margin (1e-4));
}

TEST_CASE ("AmpChain: swapping a pedal crossfades instead of jumping", "[chain]")
{
    // A 1:10 pad swapped for a 1:1 "wire" mid-note (what the pedal designer
    // does on every edit): the level must glide up over ~20 ms, not step.
    const std::string pad = "*@pedal name=\"Pad\" oversample=1\n*@input Vin\n*@output out\n"
                            "Vin in 0 0\nR1 in out 9k\nR2 out 0 1k\n";
    const std::string wire = "*@pedal name=\"Wire\" oversample=1\n*@input Vin\n*@output out\n"
                             "Vin in 0 0\nR1 in out 1\nR2 out 0 1meg\n";
    auto make = [] (const std::string& text)
    {
        auto p = std::make_unique<phreak::Pedal>();
        std::string error;
        REQUIRE (p->load (text, error));
        REQUIRE (p->prepare (48000.0, 64, error));
        return p;
    };
    phreak::AmpChain chain;
    chain.prepare (48000.0, 64, 1);
    chain.setPedal (0, make (pad));
    std::vector<float> out, buf (64);
    float* ch[] = { buf.data() };
    int n = 0;
    auto run = [&] (int blocks)
    {
        for (int b = 0; b < blocks; ++b)
        {
            for (int i = 0; i < 64; ++i, ++n)
                buf[(size_t) i] = 0.05f * (float) std::sin (2.0 * std::numbers::pi * 220.0 * n / 48000.0);
            chain.processPreCab (ch, 1, 64);
            out.insert (out.end(), buf.begin(), buf.end());
        }
    };
    run (150);                            // 200 ms: settled
    const size_t swapAt = out.size();
    chain.setPedal (0, make (wire));
    run (150);
    auto peak = [&] (size_t from, size_t len)
    {
        float p = 0.0f;
        for (size_t i = from; i < from + len; ++i) p = std::max (p, std::abs (out[i]));
        return p;
    };
    const float before = peak (swapAt - 960, 960), early = peak (swapAt, 240), after = peak (swapAt + 4800, 960);
    CHECK (after > before * 5.0f);        // the swap happened
    CHECK (early < before + 0.35f * (after - before)); // first 5 ms: still mostly the old pedal
}

TEST_CASE ("DK solver: RL step: inductor current rises as 1 - e^(-t R/L)", "[circuit]")
{
    // A 1 V step into L in series with R: the voltage across R follows the
    // inductor's current, 1 - e^(-t/tau), tau = L/R = 1 ms.
    constexpr double fs = 48000.0, R = 100.0, L = 0.1;
    auto s = build ("*@input Vin\n*@output out\nVin in 0 0\nL1 in out 100m\nR1 out 0 100\n", fs);
    double worst = 0.0;
    for (int n = 1; n <= 480; ++n) // 10 ms
    {
        const double y = s.process (1.0);
        worst = std::max (worst, std::abs (y - (1.0 - std::exp (-(n / fs) * R / L))));
    }
    CHECK (worst < 0.02);    // trapezoidal, ~21 us steps against a 1 ms tau
    CHECK (s.process (1.0) == Catch::Approx (1.0).margin (1e-3));
}

TEST_CASE ("DK solver: LC tank rings at 1 / (2 pi sqrt(LC))", "[circuit]")
{
    // A series LC driven through 10k, output across C: kicked by a pulse,
    // it rings at f0 = 1 / (2 pi sqrt(0.5 H * 100 nF)) = 712 Hz.
    constexpr double fs = 96000.0;
    auto s = build ("*@input Vin\n*@output out\nVin in 0 0\nR1 in a 10\nL1 a out 500m\nC1 out 0 100n\nRleak out 0 1meg\n", fs);
    std::vector<double> y;
    for (int n = 0; n < 9600; ++n)
        y.push_back (s.process (n < 20 ? 1.0 : 0.0));
    // Period from rising zero crossings after the kick.
    std::vector<double> crossings;
    for (size_t n = 200; n + 1 < y.size(); ++n)
        if (y[n] <= 0.0 && y[n + 1] > 0.0)
            crossings.push_back ((double) n + y[n] / (y[n] - y[n + 1]));
    REQUIRE (crossings.size() > 10);
    const double period = (crossings.back() - crossings.front()) / (double) (crossings.size() - 1);
    CHECK (fs / period == Catch::Approx (711.8).epsilon (0.01));
}

TEST_CASE ("DK solver: inductor is a short at DC (bias through a choke)", "[circuit]")
{
    // 9 V through a 1 H choke and 1k to ground: 9 mA, no DC drop across L.
    auto s = build ("*@input Vin\n*@output out\nVin in 0 0\nVcc vcc 0 DC 9\nL1 vcc out 1\nR1 out 0 1k\nRin in 0 1k\n", 48000.0);
    CHECK (s.process (0.0) == Catch::Approx (9.0).margin (0.02));
    for (int n = 0; n < 1000; ++n) s.process (0.0);
    CHECK (s.process (0.0) == Catch::Approx (9.0).margin (0.02)); // and stays there
}

TEST_CASE ("DK solver: SW throws pick one path (a 3-way switch)", "[circuit]")
{
    // 1 V through a 3-way switch onto three different dividers: position k
    // closes throw k only.
    const std::string text = "*@input Vin\n*@output out\n*@control sel taper=lin default=0\n"
                             "Vin in 0 0\n"
                             "R1 in a 1k\nR2 in b 3k\nR3 in c 9k\n"
                             "XS0 a out SW pos={sel} k=0 n=3\nXS1 b out SW pos={sel} k=1 n=3\nXS2 c out SW pos={sel} k=2 n=3\n"
                             "Rl out 0 1k\n";
    auto s = build (text, 48000.0);
    const double expected[3] = { 0.5, 0.25, 0.1 }; // 1k/(1k+R)
    for (int k = 0; k < 3; ++k)
    {
        s.setControls ({ k / 2.0 });
        double y = 0.0;
        for (int n = 0; n < 10; ++n) y = s.process (1.0);
        CHECK (y == Catch::Approx (expected[k]).margin (1e-3));
    }
}
