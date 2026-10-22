#include "CircuitAmp.h"

#include <cmath>
#include <numbers>

namespace phreak
{

bool CircuitAmp::load (std::string_view text, std::string& error)
{
    if (! preamp.load (text, error))
        return false;

    // *@power and the face= of *@amp: one line each.
    face.clear();
    size_t pos = 0;
    bool havePower = false;
    while (pos < text.size())
    {
        auto end = text.find ('\n', pos);
        if (end == std::string_view::npos)
            end = text.size();
        const auto line = text.substr (pos, end - pos);
        pos = end + 1;

        if (line.rfind ("*@power", 0) == 0)
        {
            powerConfig = PowerAmp::parse (line, [this] (std::string_view name)
            {
                for (int i = 0; i < preamp.getNumControls(); ++i)
                    if (preamp.getControl (i).name == name)
                        return i;
                return -1;
            });
            havePower = true;
        }
        else if (line.rfind ("*@reverb", 0) == 0 || line.rfind ("*@tremolo", 0) == 0)
        {
            auto controlFor = [&] (std::string_view key) -> int
            {
                const auto at = line.find (std::string (key) + "=");
                if (at == std::string_view::npos)
                    return -1;
                auto v = line.substr (at + key.size() + 1);
                v = v.substr (0, v.find_first_of (" \t\r"));
                for (int i = 0; i < preamp.getNumControls(); ++i)
                    if (preamp.getControl (i).name == v)
                        return i;
                return -1;
            };
            if (line.rfind ("*@reverb", 0) == 0)
            {
                reverbControl = controlFor ("control");
                reverb = makeReverb();
                reverb->setControl (1, 0.0f); // spring
            }
            else
            {
                speedControl = controlFor ("speed");
                intensityControl = controlFor ("intensity");
            }
        }
        else if (line.rfind ("*@amp", 0) == 0)
        {
            if (const auto at = line.find ("face="); at != std::string_view::npos)
            {
                const auto v = line.substr (at + 5);
                face = std::string (v.substr (0, v.find_first_of (" \t\r")));
            }
        }
    }
    if (! havePower)
    {
        error = "amp file has no *@power line";
        return false;
    }
    for (int i = 0; i < preamp.getNumControls(); ++i)
        setControl (i, (float) preamp.getControl (i).defaultValue);
    return true;
}

bool CircuitAmp::prepare (double sampleRate, int maxBlockSize, std::string& error)
{
    if (! preamp.prepare (sampleRate, maxBlockSize, error))
        return false;
    power.prepare (powerConfig, sampleRate, maxBlockSize);
    if (reverb != nullptr)
        reverb->prepare (sampleRate, maxBlockSize);
    fs = sampleRate;
    // The optical cell: lights up fast, darkens slowly (the soft, lopsided
    // throb of a black-panel "Vibrato" channel).
    ldrAttack = 1.0 - std::exp (-1.0 / (0.004 * fs));
    ldrRelease = 1.0 - std::exp (-1.0 / (0.04 * fs));
    return true;
}

void CircuitAmp::setControl (int index, float value01)
{
    preamp.setControl (index, value01); // pots in the circuit (others ignored there)
    if (index == powerConfig.presenceControl)
        power.setPresence (value01);
    if (index == powerConfig.cutControl)
        power.setCut (value01);
    if (index == powerConfig.responseControl)
        power.setResponse (value01);
    if (index == reverbControl && reverb != nullptr)
        reverb->setControl (0, value01);
    if (index == speedControl)
        speed.store (value01);
    if (index == intensityControl)
        intensity.store (value01);
}

void CircuitAmp::process (float* data, int n)
{
    preamp.process (data, n);

    if (reverb != nullptr)
    {
        float* ch[] = { data };
        reverb->process (ch, 1, n);
    }

    if (speedControl >= 0)
    {
        const double depth = intensity.load();
        const double hz = 1.0 * std::pow (9.0, (double) speed.load()); // 1..9 Hz
        const double inc = 2.0 * std::numbers::pi * hz / fs;
        for (int i = 0; i < n; ++i)
        {
            // A neon lamp flashing onto an LDR that shunts the signal.
            const double lamp = std::max (0.0, std::sin (tremPhase));
            tremPhase += inc;
            if (tremPhase > 2.0 * std::numbers::pi)
                tremPhase -= 2.0 * std::numbers::pi;
            ldr += (lamp - ldr) * (lamp > ldr ? ldrAttack : ldrRelease);
            data[i] *= (float) (1.0 - 0.85 * depth * ldr);
        }
    }

    power.process (data, n);
}

} // namespace phreak
