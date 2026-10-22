// C ABI over the engine for the browser build (standalone WASM, no JS glue).
// The AudioWorklet writes samples into the instance's channel buffers
// (pr_channel), calls a process function, and reads them back in place.
// Everything is allocated in pr_create, except when a pedal or amp is
// loaded (pr_pedal_load, pr_amp_load), which is an explicit, occasional event.

#include "amp/AmpChain.h"

#include <memory>
#include <string>
#include <vector>

namespace
{

struct Instance
{
    phreak::AmpChain chain;
    std::vector<std::vector<float>> buffers;
    std::vector<float*> ptrs;
    int maxBlock = 0;
    double sampleRate = 48000.0;
    std::string pedalError;
    // Per pedal slot: one entry per device, see pr_pedal_activity.
    std::vector<float> activity[phreak::AmpChain::numPedalSlots];
    std::vector<float> ampActivity;
    std::vector<float> probe = std::vector<float> (phreak::Pedal::probeLength, 0.0f);
};

// Keep in sync with web/src/engine.ts (Param).
enum Param : int
{
    inputDb = 0,
    drive,       // 0..1
    outputDb,
    gateOn,      // 0/1
    gateDb,
};

// Keep in sync with web/src/engine.ts (Meter).
enum Meter : int
{
    inputPeak = 0,
    outputPeak,
    limiterGain,
    pedalFaults,         // guard resets since load, all pedals
    pedalNewtonFailures, // samples whose solve hit the iteration cap, all pedals
};

} // namespace

extern "C"
{

__attribute__ ((export_name ("pr_create")))
Instance* pr_create (float sampleRate, int maxBlock, int numChannels)
{
    auto* inst = new Instance();
    inst->maxBlock = maxBlock;
    inst->sampleRate = sampleRate;
    inst->buffers.assign ((size_t) numChannels, std::vector<float> ((size_t) maxBlock, 0.0f));
    for (auto& b : inst->buffers)
        inst->ptrs.push_back (b.data());
    inst->chain.prepare (sampleRate, maxBlock, numChannels);
    return inst;
}

__attribute__ ((export_name ("pr_destroy")))
void pr_destroy (Instance* inst) { delete inst; }

__attribute__ ((export_name ("pr_channel")))
float* pr_channel (Instance* inst, int ch) { return inst->ptrs[(size_t) ch]; }

__attribute__ ((export_name ("pr_process_pre")))
void pr_process_pre (Instance* inst, int n)
{
    inst->chain.processPreCab (inst->ptrs.data(), (int) inst->ptrs.size(), n);
}

__attribute__ ((export_name ("pr_process_post")))
void pr_process_post (Instance* inst, int n)
{
    inst->chain.processPostCab (inst->ptrs.data(), (int) inst->ptrs.size(), n);
}

__attribute__ ((export_name ("pr_process")))
void pr_process (Instance* inst, int n)
{
    inst->chain.process (inst->ptrs.data(), (int) inst->ptrs.size(), n);
}

__attribute__ ((export_name ("pr_set_param")))
void pr_set_param (Instance* inst, int id, float v)
{
    auto& c = inst->chain;
    switch (id)
    {
        case inputDb:  c.setInputGainDb (v); break;
        case drive:    c.setDrive (v); break;
        case outputDb: c.setOutputGainDb (v); break;
        case gateOn:   c.setGateEnabled (v > 0.5f); break;
        case gateDb:   c.setGateThresholdDb (v); break;
        default:       break;
    }
}

// Tone knobs move together (the stack is one interacting network).
__attribute__ ((export_name ("pr_set_tone")))
void pr_set_tone (Instance* inst, float treble01, float mid01, float bass01)
{
    inst->chain.setTone (treble01, mid01, bass01);
}

__attribute__ ((export_name ("pr_meter")))
float pr_meter (Instance* inst, int id)
{
    auto& c = inst->chain;
    switch (id)
    {
        case inputPeak:   return c.inputPeak.load();
        case outputPeak:  return c.outputPeak.load();
        case limiterGain: return c.limiterGain.load();
        case pedalFaults:
        case pedalNewtonFailures:
        {
            float total = 0.0f;
            for (int s = 0; s < phreak::AmpChain::numPedalSlots; ++s)
                if (auto* p = c.getPedal (s))
                    total += id == pedalFaults ? (float) p->getFaults() : (float) p->getStats().newtonFailures;
            return total;
        }
        default:          return 0.0f;
    }
}

// Scratch memory for passing strings (pedal netlists) in from JS.
__attribute__ ((export_name ("pr_alloc")))
char* pr_alloc (int bytes) { return new char[(size_t) bytes]; }

__attribute__ ((export_name ("pr_free")))
void pr_free (char* p) { delete[] p; }

/** Parses, builds and biases a pedal netlist, then puts it in pedal slot
    `slot` (0..3, run in order; replacing any pedal there). Returns 1 on
    success; on failure the slot is unchanged and pr_pedal_error() says
    why. Allocates: call when a glitch is acceptable (loading a pedal), not
    per block. */
__attribute__ ((export_name ("pr_pedal_load")))
int pr_pedal_load (Instance* inst, int slot, const char* text, int len, const float* knobs, int numKnobs)
{
    auto pedal = std::make_unique<phreak::Pedal>();
    inst->pedalError.clear();
    if (slot < 0 || slot >= phreak::AmpChain::numPedalSlots)
    {
        inst->pedalError = "no such pedal slot";
        return 0;
    }
    if (! pedal->load (std::string_view (text, (size_t) len), inst->pedalError))
        return 0;
    for (int i = 0; i < numKnobs; ++i)
        pedal->setControl (i, knobs[i]);
    if (! pedal->prepare (inst->sampleRate, inst->maxBlock, inst->pedalError))
        return 0;
    inst->activity[slot].assign ((size_t) pedal->getNumDevices(), 0.0f);
    inst->chain.setPedal (slot, std::move (pedal));
    return 1;
}

__attribute__ ((export_name ("pr_pedal_unload")))
void pr_pedal_unload (Instance* inst, int slot) { inst->chain.setPedal (slot, nullptr); }

__attribute__ ((export_name ("pr_pedal_error")))
const char* pr_pedal_error (Instance* inst) { return inst->pedalError.c_str(); }

__attribute__ ((export_name ("pr_pedal_enable")))
void pr_pedal_enable (Instance* inst, int slot, int on) { inst->chain.setPedalEnabled (slot, on != 0); }

__attribute__ ((export_name ("pr_pedal_control")))
void pr_pedal_control (Instance* inst, int slot, int index, float value01)
{
    if (auto* p = inst->chain.getPedal (slot))
        p->setControl (index, value01);
}

/** Moves the pedal in slot `from` to slot `to`, shifting the ones between;
    pedals keep their state and bypass switches (no re-bias). */
__attribute__ ((export_name ("pr_pedal_move")))
void pr_pedal_move (Instance* inst, int from, int to)
{
    constexpr int n = phreak::AmpChain::numPedalSlots;
    if (from < 0 || from >= n || to < 0 || to >= n)
        return;
    inst->chain.movePedal (from, to);
    for (int s = from; s != to; s += to > from ? 1 : -1)
        std::swap (inst->activity[s], inst->activity[s + (to > from ? 1 : -1)]);
}

// The looper (post stage): on/off (allocates / frees ~46 MB), commands,
// playback gain, and its state for the display.
__attribute__ ((export_name ("pr_looper_enable")))
void pr_looper_enable (Instance* inst, int on) { inst->chain.setLooperEnabled (on != 0); }

/** 0 press (record / play / overdub), 1 stop / start, 2 undo / redo, 3 clear. */
__attribute__ ((export_name ("pr_looper_command")))
void pr_looper_command (Instance* inst, int cmd)
{
    auto& l = inst->chain.getLooper();
    switch (cmd)
    {
        case 0: l.press(); break;
        case 1: l.stop(); break;
        case 2: l.undo(); break;
        case 3: l.clear(); break;
        default: break;
    }
}

__attribute__ ((export_name ("pr_looper_gain")))
void pr_looper_gain (Instance* inst, float g) { inst->chain.getLooper().setGain (g); }

/** 0 off, 1 empty, 2 recording, 3 playing, 4 overdubbing, 5 stopped;
    + 8 if an overdub can be undone, + 16 if one can be redone. */
__attribute__ ((export_name ("pr_looper_state")))
int pr_looper_state (Instance* inst)
{
    const auto& l = inst->chain.getLooper();
    if (! l.isEnabled())
        return 0;
    return 1 + (int) l.state() + (l.canUndo() ? 8 : 0) + (l.canRedo() ? 16 : 0);
}

__attribute__ ((export_name ("pr_looper_length")))
int pr_looper_length (Instance* inst) { return inst->chain.getLooper().lengthSamples(); }

__attribute__ ((export_name ("pr_looper_position")))
int pr_looper_position (Instance* inst) { return inst->chain.getLooper().positionSamples(); }

// Pedal designer probe: the voltage at one node of a pedal's circuit.
/** Starts probing node `text` (its netlist name) in slot `slot`; len 0
    stops. 1 = ok, 0 = no such pedal or node. */
__attribute__ ((export_name ("pr_pedal_probe")))
int pr_pedal_probe (Instance* inst, int slot, const char* text, int len)
{
    auto* p = inst->chain.getPedal (slot);
    return p != nullptr && p->setProbe (std::string_view (text, (size_t) len)) ? 1 : 0;
}

/** The last Pedal::probeLength probe samples (volts, oldest first). */
__attribute__ ((export_name ("pr_pedal_probe_data")))
float* pr_pedal_probe_data (Instance* inst, int slot)
{
    auto* p = inst->chain.getPedal (slot);
    if (p == nullptr)
        return nullptr;
    p->copyProbe (inst->probe.data());
    return inst->probe.data();
}

// Circuit view: a pedal's junction devices and how hard each is working.
__attribute__ ((export_name ("pr_pedal_device_count")))
int pr_pedal_device_count (Instance* inst, int slot)
{
    auto* p = inst->chain.getPedal (slot);
    return p != nullptr ? p->getNumDevices() : 0;
}

__attribute__ ((export_name ("pr_pedal_device_name")))
const char* pr_pedal_device_name (Instance* inst, int slot, int d)
{
    return inst->chain.getPedal (slot)->getDeviceName (d).c_str();
}

/** Fills and returns slot `slot`'s activity array (pr_pedal_device_count
    floats): peak since the last call, see DKSolver::takeActivity. */
__attribute__ ((export_name ("pr_pedal_activity")))
float* pr_pedal_activity (Instance* inst, int slot)
{
    auto* p = inst->chain.getPedal (slot);
    if (p == nullptr)
        return nullptr;
    p->takeActivity (inst->activity[slot].data());
    return inst->activity[slot].data();
}

/** Loads a circuit amp (amps/<name>.cir) into the amp slot, replacing the
    built-in Tweed '59; same contract as pr_pedal_load. */
__attribute__ ((export_name ("pr_amp_load")))
int pr_amp_load (Instance* inst, const char* text, int len, const float* knobs, int numKnobs)
{
    auto amp = std::make_unique<phreak::CircuitAmp>();
    inst->pedalError.clear();
    if (! amp->load (std::string_view (text, (size_t) len), inst->pedalError))
        return 0;
    for (int i = 0; i < numKnobs; ++i)
        amp->setControl (i, knobs[i]);
    if (! amp->prepare (inst->sampleRate, inst->maxBlock, inst->pedalError))
        return 0;
    inst->ampActivity.assign ((size_t) amp->getPreamp().getNumDevices(), 0.0f);
    inst->chain.setCircuitAmp (std::move (amp));
    return 1;
}

/** Back to the built-in Tweed '59. */
__attribute__ ((export_name ("pr_amp_unload")))
void pr_amp_unload (Instance* inst) { inst->chain.setCircuitAmp (nullptr); }

__attribute__ ((export_name ("pr_amp_control")))
void pr_amp_control (Instance* inst, int index, float value01)
{
    if (auto* a = inst->chain.getCircuitAmp())
        a->setControl (index, value01);
}

__attribute__ ((export_name ("pr_amp_device_count")))
int pr_amp_device_count (Instance* inst)
{
    return inst->chain.getCircuitAmp() ? inst->chain.getCircuitAmp()->getPreamp().getNumDevices() : 0;
}

__attribute__ ((export_name ("pr_amp_device_name")))
const char* pr_amp_device_name (Instance* inst, int d)
{
    return inst->chain.getCircuitAmp()->getPreamp().getDeviceName (d).c_str();
}

__attribute__ ((export_name ("pr_amp_activity")))
float* pr_amp_activity (Instance* inst)
{
    if (auto* a = inst->chain.getCircuitAmp())
        a->getPreamp().takeActivity (inst->ampActivity.data());
    return inst->ampActivity.data();
}

/** The power section's drive since the last call, 0..1 (PowerAmp::takeLevel). */
__attribute__ ((export_name ("pr_amp_power_level")))
float pr_amp_power_level (Instance* inst)
{
    auto* a = inst->chain.getCircuitAmp();
    return a != nullptr ? a->takePowerLevel() : 0.0f;
}

/** The amp's B+ (volts): the lowest since the last call (sag), 0 without
    a circuit amp. */
__attribute__ ((export_name ("pr_amp_supply_volts")))
float pr_amp_supply_volts (Instance* inst)
{
    auto* a = inst->chain.getCircuitAmp();
    return a != nullptr ? a->takeSupplyVolts() : 0.0f;
}

// DSP effects: 0 = EQ, 1 = delay, 2 = reverb run in the
// post-cab stage (the browser drives them on its post instance); 3 = Dyna
// Comp runs first in the pre-cab stage (the pre instance).
__attribute__ ((export_name ("pr_fx_enable")))
void pr_fx_enable (Instance* inst, int fx, int on) { inst->chain.setPostEffectEnabled (fx, on != 0); }

__attribute__ ((export_name ("pr_fx_control")))
void pr_fx_control (Instance* inst, int fx, int index, float value01)
{
    if (auto* e = inst->chain.getPostEffect (fx))
        e->setControl (index, value01);
}

__attribute__ ((export_name ("pr_latency")))
int pr_latency (Instance* inst) { return inst->chain.getLatencySamples(); }

} // extern "C"
