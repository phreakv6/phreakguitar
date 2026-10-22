#pragma once

#include <juce_dsp/juce_dsp.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <optional>

namespace phreak
{

/**
    Cabinet simulation: zero-latency partitioned convolution with an IR.

    Ships with three synthesized built-in voicings (see tools/make_ir.py) —
    license-free stand-ins, since real IR packs forbid redistribution —
    and loads any user mono/stereo WAV (stereo IRs give true L/R width).
    Every IR is loudness-matched (engine/dsp/IRLevel.h), so the cab
    changes tone, not volume.

    Note: juce::dsp::Convolution loads IRs on a background thread and
    crossfades when ready. Fine live; for deterministic offline rendering
    the render harness waits after loading (see tools/render_main.cpp).
*/
class CabConvolver
{
public:
    struct BuiltInIR
    {
        const char* displayName;
        const char* data;
        int size;
    };

    static const std::vector<BuiltInIR>& getBuiltInIRs();

    void prepare (const juce::dsp::ProcessSpec& spec);
    void reset();

    bool loadBuiltIn (int index);
    bool loadFile (const juce::File& irFile);

    const juce::String& getCurrentIRName() const { return irName; }

    void process (juce::dsp::ProcessContextReplacing<float> context);

    struct LoadedIR
    {
        juce::AudioBuffer<float> buffer; // gain already applied
        double sampleRate = 0.0;
        float gain = 1.0f;
    };

    /** Decode an IR and apply its loudness-matching gain. */
    static std::optional<LoadedIR> readIR (std::unique_ptr<juce::InputStream> stream);

private:
    bool loadFromStream (std::unique_ptr<juce::InputStream> stream);

    juce::dsp::Convolution convolution;
    juce::String irName { "(none)" };
};

} // namespace phreak
