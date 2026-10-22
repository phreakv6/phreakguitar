#pragma once

#include "PluginProcessor.h"

class PhreakGuitarEditor : public juce::AudioProcessorEditor,
                        private juce::Timer
{
public:
    explicit PhreakGuitarEditor (PhreakGuitarProcessor&);

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;

    struct Knob
    {
        juce::Slider slider;
        juce::Label label;
        std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> attachment;
    };

    void setupKnob (Knob& knob, const juce::String& paramID, const juce::String& text);

    PhreakGuitarProcessor& processorRef;

    void refreshIRMenu();

    Knob inputKnob, driveKnob, bassKnob, midKnob, trebleKnob, gateKnob, outputKnob;

    juce::ToggleButton cabToggle { "Cab" };
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> cabAttachment;

    juce::ToggleButton gateToggle { "Gate" };
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> gateAttachment;

    juce::ComboBox irBox;
    std::vector<juce::File> userIRs; // parallel to menu ids >= userIRBaseID
    static constexpr int userIRBaseID = 100;

    juce::TextButton loadIRButton { "Load IR..." };
    juce::Label irNameLabel;
    std::unique_ptr<juce::FileChooser> fileChooser;

    // Meter display state (decayed in timerCallback).
    float inMeterLevel = 0.0f, outMeterLevel = 0.0f;
    juce::Rectangle<int> inMeterBounds, outMeterBounds;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PhreakGuitarEditor)
};
