#pragma once

#include "PowerAmp.h"
#include "circuit/Pedal.h"
#include "fx/PostEffect.h"

#include <string>
#include <string_view>

namespace phreak
{

/**
    A tube amp from an amp file (amps/<name>.cir): the preamp is a circuit (the
    same engine as the pedals, Koren triodes and all) and the power section
    is PowerAmp, configured by the file's *@power line. The amp's knobs are
    the file's *@control lines: pots in the preamp circuit, plus Presence /
    Cut, which the power section reads. Amps with built-in effects declare
    them too, and they run between preamp and power section, where the
    real ones sit:
        *@reverb control=reverb                  spring tank (the Reverb's spring)
        *@tremolo speed=speed intensity=intensity  optical tremolo ("Vibrato")

    Mono. load()/prepare() allocate: call them when a glitch is acceptable.
*/
class CircuitAmp
{
public:
    bool load (std::string_view text, std::string& error);
    bool prepare (double sampleRate, int maxBlockSize, std::string& error);

    const std::string& getName() const { return preamp.getName(); }
    const std::string& getFace() const { return face; }
    int getNumControls() const { return preamp.getNumControls(); }
    const circuit::Control& getControl (int i) const { return preamp.getControl (i); }
    void setControl (int index, float value01);

    void process (float* data, int n);

    double getLatencySamples() const { return preamp.getLatencySamples() + power.getLatencySamples(); }

    /** The preamp circuit (device activity for the circuit view, stats). */
    Pedal& getPreamp() { return preamp; }
    /** See PowerAmp::takeLevel() (the power tubes' glow). */
    float takePowerLevel() { return power.takeLevel(); }
    /** The lowest B+ (volts) since the last call: how far the supply sagged. */
    float takeSupplyVolts() { return (float) power.takeSupplyMinimum(); }

private:
    Pedal preamp;
    PowerAmp power;
    std::unique_ptr<PostEffect> reverb;  // null unless the amp has one
    int reverbControl = -1, speedControl = -1, intensityControl = -1;
    std::atomic<float> speed { 0.5f }, intensity { 0.0f };
    double fs = 48000.0, tremPhase = 0.0, ldr = 0.0, ldrAttack = 0.0, ldrRelease = 0.0;
    PowerAmp::Config powerConfig;
    std::string face;
};

} // namespace phreak
