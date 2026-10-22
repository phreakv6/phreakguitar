#pragma once

#include "DriveStage.h"
#include "ToneStack.h"
#include "CircuitAmp.h"
#include "circuit/Pedal.h"
#include "fx/Looper.h"
#include "fx/PostEffect.h"
#include "dsp/Dynamics.h"
#include "dsp/Smoothed.h"

#include <atomic>
#include <vector>

namespace phreak
{

/**
    The amp signal chain, per SPEC.md, split around the cabinet:

        pre-cab:  [noise gate] -> [compressor] -> [pedals 1..4] -> inputGain -> amp
                  amp = a CircuitAmp (any /amps file: preamp circuit +
                  power section) when one is loaded, else the built-in
                  Tweed '59 (DriveStage -> ToneStack)
        (cab)     host-provided convolution (JUCE natively, ConvolverNode
                  in the browser) -- or nothing when bypassed
        post-cab: [EQ] -> [delay] -> [reverb] -> master -> Limiter

    The gate sits first, on the raw guitar signal, so its threshold relates
    to the interface level and doesn't move when the Input knob does.
    Default off: single-coil hum is the player's call to gate away.

    This class is the single source of truth for the DSP path. The plugin,
    the offline render harness and the browser (WASM) build all run exactly
    this, so golden-file renders regression-test what every host ships.
    No JUCE here: the engine builds with nothing but the standard library.

    Parameter setters are safe from any thread; values are latched at the
    start of each processPreCab/processPostCab and smoothed from there.
    The limiter is always on (speaker/ear protection, SPEC non-negotiable).
*/
class AmpChain
{
public:
    void prepare (double sampleRate, int maximumBlockSize, int numChannels);
    void reset();

    void setInputGainDb (float db)     { inputDb.store (db); }
    void setOutputGainDb (float db)    { outputDb.store (db); }
    void setDrive (float drive01)      { drive.store (drive01); }
    void setTone (float treble01, float mid01, float bass01)
    {
        treble.store (treble01);
        mid.store (mid01);
        bass.store (bass01);
    }
    void setGateEnabled (bool b)       { gateEnabled.store (b); }
    void setGateThresholdDb (float db) { gateDb.store (db); }

    int getLatencySamples() const;

    /** Pedal slots between the gate and the amp's input, run in slot order.
        Loading, unloading and moving pedals is not thread-safe: do it from
        the thread that calls process() (the browser worklet) or while not
        processing. A pedal must already be prepared at this chain's sample
        rate and block size. Bypass (setPedalEnabled) is safe anywhere.
        Replacing or removing a pedal crossfades from the old one over 20 ms
        (the pedal designer swaps circuits while you play). */
    static constexpr int numPedalSlots = 4;
    void setPedal (int slot, std::unique_ptr<Pedal> p)
    {
        if (! validSlot (slot))
            return;
        if (pedals[slot] != nullptr)
        {
            outgoing[slot] = std::move (pedals[slot]);
            fadeLeft[slot] = fadeSamples;
        }
        pedals[slot] = std::move (p);
    }
    Pedal* getPedal (int slot) { return validSlot (slot) ? pedals[slot].get() : nullptr; }
    void setPedalEnabled (int slot, bool b)
    {
        if (validSlot (slot))
            pedalOn[slot].store (b);
    }
    /** Moves the pedal in `from` to `to`, shifting those in between; each
        keeps its state (no re-bias) and its bypass switch. */
    void movePedal (int from, int to);

    /** After-the-amp effects, run in this order: 0 = EQ (7-band),
        1 = delay, 2 = reverb. All off by default;
        controls via getPostEffect(i)->setControl(). */
    static constexpr int numPostEffects = 3;
    /** Effect index of the compressor (Red Comp), at the front of the
        pre-cab chain; same calls as the post effects. Off by default. */
    static constexpr int compressorIndex = numPostEffects;
    PostEffect* getPostEffect (int i)
    {
        if (i == compressorIndex) return compressor.get();
        return i >= 0 && i < numPostEffects ? postFx[i].get() : nullptr;
    }
    void setPostEffectEnabled (int i, bool on)
    {
        if (i == compressorIndex) compressorOn.store (on);
        else if (i >= 0 && i < numPostEffects) postFxOn[i].store (on);
    }

    /** The looper, last before the limiter (after the output level, so a
        loop keeps the level it was played at). Off until enabled: enable
        allocates its memory (between blocks). */
    Looper& getLooper() { return looper; }
    void setLooperEnabled (bool on)
    {
        if (on && ! looper.isEnabled()) looper.enable (sampleRateNow, numChannelsNow);
        else if (! on && looper.isEnabled()) looper.disable();
    }

    /** Amp slot: a circuit amp replaces the built-in Tweed '59; null brings
        it back. Same threading rules as setPedal(). */
    void setCircuitAmp (std::unique_ptr<CircuitAmp> a) { circuitAmp = std::move (a); }
    CircuitAmp* getCircuitAmp() { return circuitAmp.get(); }

    /** In place; n <= maximumBlockSize. */
    void processPreCab (float* const* ch, int numCh, int n);
    void processPostCab (float* const* ch, int numCh, int n);

    /** Both halves with no cabinet in between. */
    void process (float* const* ch, int numCh, int n)
    {
        processPreCab (ch, numCh, n);
        processPostCab (ch, numCh, n);
    }

    /** Meters, refreshed every block (linear). Input is pre-gate. */
    std::atomic<float> inputPeak { 0.0f }, outputPeak { 0.0f };
    std::atomic<float> limiterGain { 1.0f };

    static constexpr float limiterThresholdDb = -1.0f;
    static constexpr float limiterReleaseMs = 100.0f;
    static constexpr float gateRatio = 10.0f;
    static constexpr float gateAttackMs = 1.0f;
    static constexpr float gateReleaseMs = 60.0f;

private:
    static float peakOf (float* const* ch, int numCh, int n);
    static bool validSlot (int s) { return s >= 0 && s < numPedalSlots; }

    NoiseGate gate;
    LinearSmoothed inputGain { 1.0f }, outputGain { 1.0f };
    DriveStage driveStage;
    ToneStack toneStack;
    Limiter limiter;
    std::unique_ptr<Pedal> pedals[numPedalSlots];
    std::unique_ptr<Pedal> outgoing[numPedalSlots]; // fading out after a swap
    int fadeLeft[numPedalSlots] {};
    int fadeSamples = 960;
    std::vector<float> fadeScratch;
    std::atomic<bool> pedalOn[numPedalSlots] { true, true, true, true };
    std::unique_ptr<CircuitAmp> circuitAmp;
    std::unique_ptr<PostEffect> postFx[numPostEffects] { makeEq7(), makeDigitalDelay(), makeReverb() };
    std::atomic<bool> postFxOn[numPostEffects] { false, false, false };
    std::unique_ptr<PostEffect> compressor { makeCompressor() };
    Looper looper;
    double sampleRateNow = 48000.0;
    int numChannelsNow = 2;
    std::atomic<bool> compressorOn { false };

    std::atomic<float> inputDb { 0.0f }, outputDb { 0.0f }, drive { 0.0f };
    std::atomic<float> treble { 0.5f }, mid { 0.5f }, bass { 0.5f };
    std::atomic<float> gateDb { -65.0f };
    std::atomic<bool> gateEnabled { false };

    // First block after prepare/reset jumps straight to the parameter
    // values instead of ramping from defaults.
    bool snapPre = true, snapPost = true;
};

} // namespace phreak
