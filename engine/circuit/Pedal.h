#pragma once

#include "DKSolver.h"
#include "Netlist.h"
#include "dsp/Oversampler.h"
#include "fx/PostEffect.h"

#include <atomic>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace phreak
{

/**
    A pedal: a solved circuit (circuit::DKSolver) with oversampling, knobs
    and guardrails. Audio in/out is mono, 1.0 = 1 V at the circuit.
    A pedal file can instead name a DSP model (*@pedal dsp=univibe): then
    it carries only directives, and the model does the processing.

    load() and prepare() allocate and may take milliseconds: call them off
    the audio thread (or accept a glitch at load time). setControl() is
    safe from any thread; process() picks knob changes up at block start.
*/
class Pedal
{
public:
    bool load (std::string_view netlistText, std::string& error);

    /** oversampling 0 = the pedal's own *@pedal oversample= value. */
    bool prepare (double sampleRate, int maxBlockSize, std::string& error, int oversampling = 0);

    const std::string& getName() const { return netlist.name; }
    int getNumControls() const { return (int) netlist.controls.size(); }
    const circuit::Control& getControl (int i) const { return netlist.controls[(size_t) i]; }

    /** Knob position 0..1 (the pot's taper is applied inside). */
    void setControl (int index, float value01);

    void process (float* data, int n);

    double getLatencySamples() const { return oversampler.getLatencySamples(); }
    int getOversampling() const { return oversampler.getFactor(); }
    const circuit::DKSolver::Stats& getStats() const { return solver.stats; }

    int getNumDevices() const { return solver.numDevices(); }
    const std::string& getDeviceName (int d) const { return solver.deviceName (d); }
    /** See DKSolver::takeActivity(); out has getNumDevices() entries. */
    void takeActivity (float* out) { solver.takeActivity (out); }

    /** Probe: records the voltage at a node (its netlist name; "" stops)
        at the base sample rate. False if the pedal has no such node.
        Re-projects the circuit: call from the thread that runs process(). */
    bool setProbe (std::string_view node);
    /** The last probeLength probe samples, oldest first, into `out`. */
    void copyProbe (float* out) const;
    static constexpr int probeLength = 4096;

    /** Times the guard reset the circuit (non-finite or runaway output). */
    int getFaults() const { return faults; }

    /** Output beyond this many volts means the solve has gone wrong (tube
        preamps legitimately swing ~100 V; nothing here reaches kilovolts). */
    static constexpr double runawayVolts = 2000.0;

    /** Time constant of the knob glide, and the step it is applied in. */
    static constexpr double knobGlideSeconds = 0.02;
    static constexpr int glideSubBlock = 16;

private:
    void processSegment (float* data, int n);
    double baseRate = 48000.0;

    circuit::Netlist netlist;
    circuit::DKSolver solver;
    Oversampler oversampler;
    std::unique_ptr<std::atomic<float>[]> knobTargets;
    std::vector<double> knobs;
    int faults = 0;
    bool probing = false;
    std::vector<float> probeRing = std::vector<float> (probeLength, 0.0f);
    size_t probePos = 0;
    std::unique_ptr<PostEffect> dsp; // a DSP pedal instead of a circuit
};

} // namespace phreak
