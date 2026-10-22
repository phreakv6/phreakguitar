#include "PluginEditor.h"

PhreakGuitarEditor::PhreakGuitarEditor (PhreakGuitarProcessor& p)
    : AudioProcessorEditor (&p), processorRef (p)
{
    setupKnob (inputKnob, "input", "Input");
    setupKnob (driveKnob, "drive", "Drive");
    setupKnob (bassKnob, "bass", "Bass");
    setupKnob (midKnob, "mid", "Mid");
    setupKnob (trebleKnob, "treble", "Treble");
    setupKnob (gateKnob, "gateDb", "Gate Thr");
    setupKnob (outputKnob, "output", "Master");

    addAndMakeVisible (cabToggle);
    cabAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment> (
        processorRef.apvts, "cab", cabToggle);

    addAndMakeVisible (gateToggle);
    gateAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment> (
        processorRef.apvts, "gate", gateToggle);

    addAndMakeVisible (irBox);
    refreshIRMenu();
    irBox.onChange = [this]
    {
        const int id = irBox.getSelectedId();
        if (id >= userIRBaseID)
        {
            const auto index = (size_t) (id - userIRBaseID);
            if (index < userIRs.size())
                processorRef.loadIR (userIRs[index]);
        }
        else if (id > 0)
        {
            processorRef.selectBuiltInIR (id - 1);
        }
    };

    addAndMakeVisible (loadIRButton);
    loadIRButton.onClick = [this]
    {
        fileChooser = std::make_unique<juce::FileChooser> (
            "Select an impulse response", juce::File(), "*.wav");

        fileChooser->launchAsync (
            juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
            [this] (const juce::FileChooser& fc)
            {
                const auto file = fc.getResult();
                if (file.existsAsFile())
                {
                    processorRef.loadIR (file);
                    irBox.setSelectedId (0, juce::dontSendNotification);
                }
            });
    };

    addAndMakeVisible (irNameLabel);
    irNameLabel.setJustificationType (juce::Justification::centredLeft);
    irNameLabel.setFont (juce::FontOptions (13.0f));

    setSize (920, 340);
    startTimerHz (30);
}

void PhreakGuitarEditor::refreshIRMenu()
{
    irBox.clear (juce::dontSendNotification);
    userIRs.clear();

    int id = 1;
    for (const auto& ir : phreak::CabConvolver::getBuiltInIRs())
        irBox.addItem (ir.displayName, id++);

    // Everything in ~/Music/PhreakGuitar/IRs shows up automatically.
    const auto folder = PhreakGuitarProcessor::getUserIRFolder();
    folder.createDirectory();
    auto files = folder.findChildFiles (juce::File::findFiles, false, "*.wav");
    files.sort();

    if (! files.isEmpty())
        irBox.addSeparator();

    for (const auto& f : files)
    {
        irBox.addItem (f.getFileNameWithoutExtension(),
                       userIRBaseID + (int) userIRs.size());
        userIRs.push_back (f);
    }

    // Reflect the processor's current selection without notifying.
    const auto current = processorRef.getCurrentIRName();
    for (int i = 0; i < irBox.getNumItems(); ++i)
        if (irBox.getItemText (i) == current
            || irBox.getItemText (i) + ".wav" == current)
            irBox.setSelectedId (irBox.getItemId (i), juce::dontSendNotification);
}

void PhreakGuitarEditor::setupKnob (Knob& knob, const juce::String& paramID,
                                 const juce::String& text)
{
    knob.slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    knob.slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 70, 18);
    addAndMakeVisible (knob.slider);

    knob.label.setText (text, juce::dontSendNotification);
    knob.label.setJustificationType (juce::Justification::centred);
    addAndMakeVisible (knob.label);

    knob.attachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment> (
        processorRef.apvts, paramID, knob.slider);
}

void PhreakGuitarEditor::timerCallback()
{
    auto updateMeter = [] (float& display, std::atomic<float>& source)
    {
        const float value = source.load();
        display = juce::jmax (display * 0.85f, value); // fast attack, slow decay
    };

    updateMeter (inMeterLevel, processorRef.inputPeak);
    updateMeter (outMeterLevel, processorRef.outputPeak);

    irNameLabel.setText ("IR: " + processorRef.getCurrentIRName(),
                         juce::dontSendNotification);
    repaint (inMeterBounds.getUnion (outMeterBounds));
}

void PhreakGuitarEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff2a2a2e));

    g.setColour (juce::Colours::white);
    g.setFont (juce::FontOptions (18.0f, juce::Font::bold));
    g.drawText ("PhreakGuitar — dev build", 16, 10, 300, 24, juce::Justification::left);

    auto drawMeter = [&g] (juce::Rectangle<int> bounds, float level, const juce::String& name)
    {
        g.setColour (juce::Colour (0xff1a1a1c));
        g.fillRect (bounds);

        const float db = juce::Decibels::gainToDecibels (level, -60.0f);
        const float norm = juce::jmap (db, -60.0f, 0.0f, 0.0f, 1.0f);
        auto fill = bounds.withTrimmedTop (
            (int) ((float) bounds.getHeight() * (1.0f - juce::jlimit (0.0f, 1.0f, norm))));

        g.setColour (db > -3.0f ? juce::Colours::orangered
                                : juce::Colour (0xff6ec96e));
        g.fillRect (fill);

        g.setColour (juce::Colours::grey);
        g.drawRect (bounds);
        g.setFont (juce::FontOptions (11.0f));
        g.drawText (name, bounds.expanded (8, 0).withY (bounds.getBottom() + 2).withHeight (14),
                    juce::Justification::centred);
    };

    drawMeter (inMeterBounds, inMeterLevel, "in");
    drawMeter (outMeterBounds, outMeterLevel, "out");
}

void PhreakGuitarEditor::resized()
{
    auto area = getLocalBounds().reduced (16);
    area.removeFromTop (32); // title row

    // Meters on the right edge.
    auto meterColumn = area.removeFromRight (70).reduced (8, 4);
    meterColumn.removeFromBottom (18); // meter captions
    inMeterBounds = meterColumn.removeFromLeft (22);
    meterColumn.removeFromLeft (10);
    outMeterBounds = meterColumn.removeFromLeft (22);

    // Knob row, amp-panel order.
    auto knobRow = area.removeFromTop (150);
    const int knobWidth = knobRow.getWidth() / 7;
    for (auto* knob : { &inputKnob, &driveKnob, &bassKnob, &midKnob,
                        &trebleKnob, &gateKnob, &outputKnob })
    {
        auto cell = knobRow.removeFromLeft (knobWidth).reduced (8);
        knob->label.setBounds (cell.removeFromTop (18));
        knob->slider.setBounds (cell);
    }

    // Cab / gate row.
    auto cabRow = area.removeFromTop (36);
    cabToggle.setBounds (cabRow.removeFromLeft (60));
    irBox.setBounds (cabRow.removeFromLeft (190).reduced (0, 5));
    cabRow.removeFromLeft (8);
    loadIRButton.setBounds (cabRow.removeFromLeft (90).reduced (0, 5));
    cabRow.removeFromLeft (8);
    gateToggle.setBounds (cabRow.removeFromLeft (64));
    irNameLabel.setBounds (cabRow);
}
