#pragma once

#include <atomic>
#include <memory>

namespace phreak
{

/** A knob or switch on an after-the-amp effect. steps = 0 for a smooth knob,
    otherwise the number of switch positions (value = position / (steps-1)). */
struct FxControl
{
    const char* name;
    const char* label;
    float defaultValue;
    int steps = 0;
};

/**
    A DSP effect, in place: the EQ, delay and reverb after the amp and cab
    (stereo), and the compressor at the front of the chain (mono). Unlike
    pedals these are DSP models, not solved circuits: a digital delay is
    exactly what it computes, and a reverb isn't a circuit one could solve.
    Controls are thread-safe; process() reads them per block.
*/
class PostEffect
{
public:
    virtual ~PostEffect() = default;

    virtual int numControls() const = 0;
    virtual const FxControl& control (int i) const = 0;

    void setControl (int i, float v01)
    {
        if (i >= 0 && i < numControls() && i < maxControls)
            values[i].store (v01);
    }
    float value (int i) const { return values[i].load(); }

    virtual void prepare (double sampleRate, int maxBlockSize) = 0;
    virtual void reset() = 0;
    virtual void process (float* const* ch, int numCh, int n) = 0;

protected:
    void loadDefaults()
    {
        for (int i = 0; i < numControls() && i < maxControls; ++i)
            values[i].store (control (i).defaultValue);
    }

    static constexpr int maxControls = 8;
    std::atomic<float> values[maxControls] {};
};

/** Red Comp: Output and Sensitivity; an OTA-style compressor for the front of
    the chain (before the pedals), DSP-modelled. */
std::unique_ptr<PostEffect> makeCompressor();

/** Photo vibe: Speed, Intensity, Volume and the Chorus / Vibrato switch; a
    grey-box model of the 1968 photocell phaser (see PhotoVibe.cpp). Mono, for
    the pedal board (a pedal file with *@pedal dsp=univibe). */
std::unique_ptr<PostEffect> makePhotoVibe();

/** 7-band graphic EQ: seven bands (100 Hz .. 6.4 kHz, +-15 dB) and
    Level (+-15 dB); every slider centred is flat. */
std::unique_ptr<PostEffect> makeEq7();

/** Digital delay: Level, Repeats, Time and the S/M/L Mode
    switch (50 / 200 / 800 ms ranges). Clean dry path; repeats band-limited
    to ~7 kHz like the original's; turning D.Time bends the repeats'
    pitch, as on the pedal. */
std::unique_ptr<PostEffect> makeDigitalDelay();

/** Reverb: Reverb (blend) and the Spring / Hall /
    Flerb switch. Hall is Dattorro's plate tank; Spring adds a dispersive
    allpass chain (the chirp) and a narrower, shorter tank; Flerb is the
    hall with a slow flanger on the wet signal. */
std::unique_ptr<PostEffect> makeReverb();

} // namespace phreak
