#pragma once

#include "PowerSupply.h"
#include "dsp/IIRFilter.h"
#include "dsp/Oversampler.h"

#include <atomic>
#include <cstdlib>
#include <string>
#include <string_view>

namespace phreak
{

/**
    A tube amp's power section as a behavioural model, configured per amp
    from its file's  *@power  line:

        *@power tubes=EL34 nfb=0.35 presence=presence headroom=34 rectifier=silicon bplus=470 ...
        *@power tubes=EL84 nfb=0 cut=cut headroom=30 rectifier=GZ34 bplus=335 ...

    Signal: phase-inverter drive (volts from the preamp circuit, scaled by
    headroom = the drive that reaches full power) -> Cut (a treble cut
    between the PI and the output tubes, 20 kHz .. 1.2 kHz) -> push-pull
    output stage whose headroom follows the simulated B+ (PowerSupply: its
    rectifier, capacitor and current draw set how the amp sags and
    recovers) -> negative feedback / Presence (a treble
    lift, as the presence cap shunts the feedback's highs) -> output
    transformer band limits -> speaker interaction (the low resonance and
    voice-coil treble rise that an amp without feedback lets through).

    EL34 pairs clip firmly and nearly symmetrically; cathode-biased EL84s
    in class A clip softer and lopsided (even harmonics, the class-A chime).
    The preamp is the circuit-level part; this stays cheap on purpose.

    count= / pi= / rectifier= list the amp's other bottles; only the
    browser's tube view reads them.
*/
class PowerAmp
{
public:
    struct Config
    {
        bool el84 = false;
        double nfb = 0.0;      // 0 (none) .. 1 (heavy): tighter
        double headroom = 30;  // PI drive (V peak) that reaches full power
        int presenceControl = -1, cutControl = -1, responseControl = -1; // amp control indices
        PowerSupply::Config supply;
    };

    /** Reads a *@power line (control names resolved by `controlIndex`). */
    template <typename Lookup>
    static Config parse (std::string_view line, Lookup&& controlIndex);

    void prepare (const Config& c, double sampleRate, int maxBlockSize);
    void reset();

    /** Presence / Cut knob positions 0..1 (thread-safe). */
    void setPresence (float v) { presence.store (v); }
    void setCut (float v)      { cut.store (v); }
    /** The supply's Response, 0..1 (0.5 = as built); see PowerSupply. */
    void setResponse (float v) { response.store (v); }

    /** B+ (volts): now, and the lowest since the last call (then resets). */
    double getSupplyVolts() const { return supply.voltage(); }
    double takeSupplyMinimum() { return supply.takeMinimum(); }
    double getIdleSupplyVolts() const { return cfg.supply.bplus; }

    /** In place: preamp output volts in, normalised speaker drive out
        (about +-0.5 at full power). */
    void process (float* data, int n);

    double getLatencySamples() const { return oversampler.getLatencySamples(); }

    /** How hard the output tubes have worked since the last call: peak of
        the stage's output, 0 (idle) .. 1 (flat out, clipping). Audio
        thread only (the browser reads it between blocks). */
    float takeLevel() { const float l = (float) peakLevel; peakLevel = 0.0; return l; }

private:
    void updateFilters();

    Config cfg;
    double fs = 48000.0;
    Oversampler oversampler;
    std::atomic<float> presence { 0.5f }, cut { 0.3f }, response { 0.5f };
    float lastPresence = -1.0f, lastCut = -1.0f, lastResponse = -1.0f;
    PowerSupply supply;
    double headroomNow = 1.0; // supply.step()'s last answer

    Biquad cutFilter, presenceShelf, otHighpass, otLowpass, resonance, voiceCoil;
    double peakLevel = 0.0;
};

template <typename Lookup>
PowerAmp::Config PowerAmp::parse (std::string_view line, Lookup&& controlIndex)
{
    Config c;
    auto value = [&] (std::string_view key) -> std::string_view
    {
        const auto at = line.find (std::string (key) + "=");
        if (at == std::string_view::npos)
            return {};
        auto v = line.substr (at + key.size() + 1);
        return v.substr (0, v.find_first_of (" \t\r\n"));
    };
    auto number = [&] (std::string_view key, double fallback)
    {
        const auto v = value (key);
        return v.empty() ? fallback : std::strtod (std::string (v).c_str(), nullptr);
    };
    c.el84 = value ("tubes") == "EL84";
    c.nfb = number ("nfb", c.nfb);
    c.supply = PowerSupply::parse (value);
    c.headroom = number ("headroom", c.headroom);
    if (const auto v = value ("presence"); ! v.empty()) c.presenceControl = controlIndex (v);
    if (const auto v = value ("cut"); ! v.empty())      c.cutControl = controlIndex (v);
    if (const auto v = value ("response"); ! v.empty()) c.responseControl = controlIndex (v);
    return c;
}

} // namespace phreak
