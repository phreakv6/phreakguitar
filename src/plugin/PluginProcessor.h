#pragma once

#include <juce_audio_utils/juce_audio_utils.h>
#include "host/HostChain.h"

class PhreakGuitarProcessor : public juce::AudioProcessor
{
public:
    PhreakGuitarProcessor();

    // -- AudioProcessor -------------------------------------------------------
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override                        { return true; }

    const juce::String getName() const override            { return JucePlugin_Name; }
    bool acceptsMidi() const override                      { return false; }
    bool producesMidi() const override                     { return false; }
    bool isMidiEffect() const override                     { return false; }
    double getTailLengthSeconds() const override           { return 0.1; }

    int getNumPrograms() override                          { return 1; }
    int getCurrentProgram() override                       { return 0; }
    void setCurrentProgram (int) override                  {}
    const juce::String getProgramName (int) override       { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // -- PhreakGuitar ------------------------------------------------------------
    bool loadIR (const juce::File& irFile);
    bool selectBuiltInIR (int index);
    const juce::String& getCurrentIRName() const { return chain.getCurrentIRName(); }

    /** Folder scanned for user IRs shown in the editor's dropdown. */
    static juce::File getUserIRFolder();

    /** Per-block peak levels for the editor meters (linear gain). */
    std::atomic<float> inputPeak { 0.0f }, outputPeak { 0.0f };

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
    void updateChainParameters();

    void applyIRSelection();

    phreak::HostChain chain;

    /** "builtin:<index>" or an absolute file path. */
    juce::String irSelection { "builtin:0" };

    std::atomic<float>* inputParam = nullptr;
    std::atomic<float>* driveParam = nullptr;
    std::atomic<float>* outputParam = nullptr;
    std::atomic<float>* cabParam = nullptr;
    std::atomic<float>* gateParam = nullptr;
    std::atomic<float>* gateDbParam = nullptr;
    std::atomic<float>* bassParam = nullptr;
    std::atomic<float>* midParam = nullptr;
    std::atomic<float>* trebleParam = nullptr;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PhreakGuitarProcessor)
};
