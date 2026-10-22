#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace param
{
    static constexpr auto input  = "input";
    static constexpr auto drive  = "drive";
    static constexpr auto output = "output";
    static constexpr auto cab    = "cab";
    static constexpr auto gate   = "gate";
    static constexpr auto gateDb = "gateDb";
    static constexpr auto bass   = "bass";
    static constexpr auto mid    = "mid";
    static constexpr auto treble = "treble";
}

PhreakGuitarProcessor::PhreakGuitarProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "state", createLayout())
{
    inputParam  = apvts.getRawParameterValue (param::input);
    driveParam  = apvts.getRawParameterValue (param::drive);
    outputParam = apvts.getRawParameterValue (param::output);
    cabParam    = apvts.getRawParameterValue (param::cab);
    gateParam   = apvts.getRawParameterValue (param::gate);
    gateDbParam = apvts.getRawParameterValue (param::gateDb);
    bassParam   = apvts.getRawParameterValue (param::bass);
    midParam    = apvts.getRawParameterValue (param::mid);
    trebleParam = apvts.getRawParameterValue (param::treble);
}

juce::File PhreakGuitarProcessor::getUserIRFolder()
{
    // ~/Music/PhreakGuitar/IRs, or the folder of the old name if that's
    // where the files are.
    const auto music = juce::File::getSpecialLocation (juce::File::userMusicDirectory);
    const auto folder = music.getChildFile ("PhreakGuitar").getChildFile ("IRs");
    const auto old = music.getChildFile ("PhreakRig").getChildFile ("IRs");
    return folder.isDirectory() || ! old.isDirectory() ? folder : old;
}

juce::AudioProcessorValueTreeState::ParameterLayout PhreakGuitarProcessor::createLayout()
{
    using FloatParam = juce::AudioParameterFloat;
    using BoolParam = juce::AudioParameterBool;

    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    layout.add (std::make_unique<FloatParam> (
        juce::ParameterID { param::input, 1 }, "Input",
        juce::NormalisableRange<float> (-24.0f, 24.0f, 0.1f), 0.0f,
        juce::AudioParameterFloatAttributes().withLabel ("dB")));

    layout.add (std::make_unique<FloatParam> (
        juce::ParameterID { param::drive, 1 }, "Drive",
        juce::NormalisableRange<float> (0.0f, 10.0f, 0.01f), 4.0f));

    // Tone stack pots, amp-panel style 0..10. Defaults: classic "noon-ish".
    for (auto [id, name, def] : { std::tuple { param::bass, "Bass", 5.0f },
                                  std::tuple { param::mid, "Mid", 5.0f },
                                  std::tuple { param::treble, "Treble", 6.0f } })
        layout.add (std::make_unique<FloatParam> (
            juce::ParameterID { id, 1 }, name,
            juce::NormalisableRange<float> (0.0f, 10.0f, 0.01f), def));

    layout.add (std::make_unique<FloatParam> (
        juce::ParameterID { param::output, 1 }, "Master",
        juce::NormalisableRange<float> (-24.0f, 24.0f, 0.1f), 0.0f,
        juce::AudioParameterFloatAttributes().withLabel ("dB")));

    layout.add (std::make_unique<BoolParam> (
        juce::ParameterID { param::cab, 1 }, "Cab", true));

    layout.add (std::make_unique<BoolParam> (
        juce::ParameterID { param::gate, 1 }, "Gate", false));

    layout.add (std::make_unique<FloatParam> (
        juce::ParameterID { param::gateDb, 1 }, "Gate Threshold",
        juce::NormalisableRange<float> (-90.0f, -30.0f, 0.5f), -65.0f,
        juce::AudioParameterFloatAttributes().withLabel ("dB")));

    return layout;
}

void PhreakGuitarProcessor::updateChainParameters()
{
    auto& amp = chain.amp;
    amp.setInputGainDb (inputParam->load());
    amp.setDrive (driveParam->load() / 10.0f);
    amp.setOutputGainDb (outputParam->load());
    chain.setCabEnabled (cabParam->load() > 0.5f);
    amp.setGateEnabled (gateParam->load() > 0.5f);
    amp.setGateThresholdDb (gateDbParam->load());
    amp.setTone (trebleParam->load() / 10.0f,
                   midParam->load() / 10.0f,
                   bassParam->load() / 10.0f);
}

void PhreakGuitarProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    chain.prepare (sampleRate, samplesPerBlock, getTotalNumOutputChannels());
    applyIRSelection();
    updateChainParameters();
    setLatencySamples (chain.getLatencySamples());
}

void PhreakGuitarProcessor::releaseResources()
{
    chain.reset();
}

bool PhreakGuitarProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto in = layouts.getMainInputChannelSet();
    const auto out = layouts.getMainOutputChannelSet();

    if (out != juce::AudioChannelSet::mono() && out != juce::AudioChannelSet::stereo())
        return false;

    // mono->mono, stereo->stereo, mono->stereo (guitar into a stereo track)
    return in == out || (in == juce::AudioChannelSet::mono()
                         && out == juce::AudioChannelSet::stereo());
}

void PhreakGuitarProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    const int numIn = getTotalNumInputChannels();
    const int numOut = getTotalNumOutputChannels();
    const int numSamples = buffer.getNumSamples();

    // A guitar is a mono source, but interfaces (e.g. Scarlett Solo) present
    // as stereo devices with the instrument on only one channel. Fold all
    // inputs to mono (0.5 each so a true stereo source stays at unity), then
    // feed identical copies to every chain channel. True stereo width comes
    // from stereo IRs / effects, not from the input.
    if (numIn > 1)
    {
        buffer.applyGain (0, 0, numSamples, 0.5f);
        for (int ch = 1; ch < numIn; ++ch)
            buffer.addFrom (0, 0, buffer, ch, 0, numSamples, 0.5f);
    }
    for (int ch = 1; ch < numOut; ++ch)
        buffer.copyFrom (ch, 0, buffer, 0, 0, numSamples);

    updateChainParameters();

    chain.process (buffer);
    inputPeak.store (chain.amp.inputPeak.load());
    outputPeak.store (chain.amp.outputPeak.load());
}

void PhreakGuitarProcessor::applyIRSelection()
{
    if (irSelection.startsWith ("builtin:"))
    {
        if (! chain.loadBuiltInIR (irSelection.fromFirstOccurrenceOf (":", false, false)
                                       .getIntValue()))
            chain.loadBuiltInIR (0);
        return;
    }

    if (! chain.loadIRFile (juce::File (irSelection)))
    {
        irSelection = "builtin:0"; // stored file has vanished; fall back
        chain.loadBuiltInIR (0);
    }
}

bool PhreakGuitarProcessor::loadIR (const juce::File& irFile)
{
    if (! chain.loadIRFile (irFile))
        return false;

    irSelection = irFile.getFullPathName();
    return true;
}

bool PhreakGuitarProcessor::selectBuiltInIR (int index)
{
    if (! chain.loadBuiltInIR (index))
        return false;

    irSelection = "builtin:" + juce::String (index);
    return true;
}

void PhreakGuitarProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    state.setProperty ("ir", irSelection, nullptr);

    if (auto xml = state.createXml())
        copyXmlToBinary (*xml, destData);
}

void PhreakGuitarProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
    {
        auto state = juce::ValueTree::fromXml (*xml);
        if (! state.isValid())
            return;

        apvts.replaceState (state);

        irSelection = state.getProperty ("ir", "builtin:0").toString();
        applyIRSelection();
    }
}

juce::AudioProcessorEditor* PhreakGuitarProcessor::createEditor()
{
    return new PhreakGuitarEditor (*this);
}

// This creates new instances of the plugin.
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new PhreakGuitarProcessor();
}
