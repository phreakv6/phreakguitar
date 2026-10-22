#pragma once

#include <juce_dsp/juce_dsp.h>
#include "amp/AmpChain.h"
#include "CabConvolver.h"

namespace phreak
{

/**
    The native (JUCE) host around the engine: AmpChain's pre-cab half,
    then the JUCE convolution cab, then the post-cab half. The plugin and
    the render harness both run exactly this; the browser builds the same
    sandwich with a ConvolverNode in the middle.
*/
class HostChain
{
public:
    void prepare (double sampleRate, int maximumBlockSize, int numChannels)
    {
        amp.prepare (sampleRate, maximumBlockSize, numChannels);
        cab.prepare ({ sampleRate, (juce::uint32) maximumBlockSize, (juce::uint32) numChannels });
    }

    void reset()
    {
        amp.reset();
        cab.reset();
    }

    void process (juce::AudioBuffer<float>& buffer)
    {
        auto* const* ch = buffer.getArrayOfWritePointers();
        const int numCh = buffer.getNumChannels();
        const int n = buffer.getNumSamples();

        amp.processPreCab (ch, numCh, n);
        if (cabEnabled.load())
        {
            juce::dsp::AudioBlock<float> block (buffer);
            cab.process (juce::dsp::ProcessContextReplacing<float> (block));
        }
        amp.processPostCab (ch, numCh, n);
    }

    void setCabEnabled (bool b) { cabEnabled.store (b); }

    // IR management (JUCE loads asynchronously and crossfades).
    bool loadBuiltInIR (int index)               { return cab.loadBuiltIn (index); }
    bool loadIRFile (const juce::File& f)        { return cab.loadFile (f); }
    const juce::String& getCurrentIRName() const { return cab.getCurrentIRName(); }

    int getLatencySamples() const { return amp.getLatencySamples(); }

    AmpChain amp;

private:
    CabConvolver cab;
    std::atomic<bool> cabEnabled { true };
};

} // namespace phreak
