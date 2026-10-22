#include "Pedal.h"

#include <algorithm>
#include <cctype>
#include <cmath>

namespace phreak
{

bool Pedal::load (std::string_view netlistText, std::string& error)
{
    if (! circuit::parseNetlist (netlistText, netlist, error))
        return false;

    dsp.reset();
    if (netlist.dsp == "photovibe")
        dsp = makePhotoVibe();
    else if (! netlist.dsp.empty())
    {
        error = "unknown DSP pedal '" + netlist.dsp + "'";
        return false;
    }

    knobTargets = std::make_unique<std::atomic<float>[]> (netlist.controls.size());
    knobs.resize (netlist.controls.size());
    for (size_t i = 0; i < netlist.controls.size(); ++i)
    {
        knobs[i] = netlist.controls[i].defaultValue;
        knobTargets[i].store ((float) knobs[i]);
        if (dsp != nullptr)
            dsp->setControl ((int) i, (float) knobs[i]);
    }
    return true;
}

bool Pedal::prepare (double sampleRate, int maxBlockSize, std::string& error, int oversampling)
{
    if (dsp != nullptr)
    {
        oversampler.prepare (1, maxBlockSize, 1); // no latency
        dsp->prepare (sampleRate, maxBlockSize);
        return true;
    }
    const int factor = oversampling > 0 ? oversampling : netlist.oversampling;
    oversampler.prepare (1, maxBlockSize, factor);
    baseRate = sampleRate;
    faults = 0;
    // Bias the circuit at the knob positions it will actually start with.
    for (size_t i = 0; i < knobs.size(); ++i)
        knobs[i] = knobTargets[i].load();
    if (! solver.build (netlist, sampleRate * oversampler.getFactor(), error))
        return false;
    solver.setControls (knobs);
    return solver.solveOperatingPoint() || (error = "no DC operating point at these knob settings", false);
}

bool Pedal::setProbe (std::string_view node)
{
    if (dsp != nullptr)
        return node.empty();
    int index = -1;
    if (! node.empty())
    {
        std::string key (node);
        std::transform (key.begin(), key.end(), key.begin(), [] (unsigned char c) { return (char) std::tolower (c); });
        for (size_t i = 0; i < netlist.nodes.size() && index < 0; ++i)
        {
            std::string n = netlist.nodes[i];
            std::transform (n.begin(), n.end(), n.begin(), [] (unsigned char c) { return (char) std::tolower (c); });
            if (n == key)
                index = (int) i;
        }
        if (index < 0 && key != "0" && key != "gnd")
            return false;
    }
    solver.setProbe (index);
    probing = index >= 0 || ! node.empty(); // ground: probing a flat 0 V
    std::fill (probeRing.begin(), probeRing.end(), 0.0f);
    return true;
}

void Pedal::copyProbe (float* out) const
{
    const size_t n = probeRing.size();
    for (size_t i = 0; i < n; ++i)
        out[i] = probeRing[(probePos + i) % n];
}

void Pedal::setControl (int index, float value01)
{
    if (index >= 0 && index < getNumControls())
        knobTargets[(size_t) index].store (std::clamp (value01, 0.0f, 1.0f));
    if (dsp != nullptr)
        dsp->setControl (index, std::clamp (value01, 0.0f, 1.0f));
}

void Pedal::process (float* data, int n)
{
    if (dsp != nullptr)
    {
        float* ch[] = { data };
        dsp->process (ch, 1, n);
        return;
    }
    // Knobs glide to their targets instead of jumping: a knob message is a
    // snapshot of a hand moving a pot, and an instant jump in resistance
    // is a step no real pot makes. Work in short sub-blocks while gliding
    // so the circuit sees a near-continuous sweep.
    bool gliding = false;
    for (size_t i = 0; i < knobs.size(); ++i)
        gliding |= knobTargets[i].load() != knobs[i];
    if (! gliding)
    {
        processSegment (data, n);
        return;
    }

    const double coef = 1.0 - std::exp (-(double) glideSubBlock / (knobGlideSeconds * baseRate));
    for (int pos = 0; pos < n; pos += glideSubBlock)
    {
        for (size_t i = 0; i < knobs.size(); ++i)
        {
            const double target = knobTargets[i].load();
            knobs[i] += (target - knobs[i]) * coef;
            if (std::abs (target - knobs[i]) < 1e-4)
                knobs[i] = target;
        }
        solver.setControls (knobs);
        processSegment (data + pos, std::min (glideSubBlock, n - pos));
    }
}

void Pedal::processSegment (float* data, int n)
{
    float* os = oversampler.up (0, data, n);
    const int osN = n * oversampler.getFactor();
    bool bad = false;
    const int factor = oversampler.getFactor();
    for (int i = 0; i < osN; ++i)
    {
        const double y = solver.process (os[i]);
        bad |= ! std::isfinite (y) || std::abs (y) > runawayVolts;
        os[i] = (float) y;
        if (probing && (i + 1) % factor == 0)
        {
            probeRing[probePos] = (float) solver.probeVolts();
            probePos = (probePos + 1) % probeRing.size();
        }
    }

    if (bad)
    {
        // Guardrail: re-bias the circuit, drop this block, count it.
        ++faults;
        solver.solveOperatingPoint();
        oversampler.reset();
        std::fill (data, data + n, 0.0f);
        return;
    }
    oversampler.down (0, data, n);
}

} // namespace phreak
