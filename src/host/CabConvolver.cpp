#include "CabConvolver.h"
#include "BinaryData.h"
#include "dsp/IRLevel.h"

namespace phreak
{

const std::vector<CabConvolver::BuiltInIR>& CabConvolver::getBuiltInIRs()
{
    static const std::vector<BuiltInIR> irs {
        { "Tweed 4x10", BinaryData::ir_tweed410_wav, BinaryData::ir_tweed410_wavSize },
        { "Brit 4x12",  BinaryData::ir_brit412_wav,  BinaryData::ir_brit412_wavSize },
        { "Black 1x12", BinaryData::ir_black112_wav, BinaryData::ir_black112_wavSize },
    };
    return irs;
}

void CabConvolver::prepare (const juce::dsp::ProcessSpec& spec)
{
    convolution.prepare (spec);
}

void CabConvolver::reset()
{
    convolution.reset();
}

bool CabConvolver::loadBuiltIn (int index)
{
    const auto& irs = getBuiltInIRs();
    if (index < 0 || index >= (int) irs.size())
        return false;

    const auto& ir = irs[(size_t) index];
    if (! loadFromStream (std::make_unique<juce::MemoryInputStream> (ir.data, (size_t) ir.size, false)))
        return false;
    irName = ir.displayName;
    return true;
}

bool CabConvolver::loadFile (const juce::File& irFile)
{
    if (! irFile.existsAsFile() || ! loadFromStream (irFile.createInputStream()))
        return false;
    irName = irFile.getFileName();
    return true;
}

std::optional<CabConvolver::LoadedIR> CabConvolver::readIR (std::unique_ptr<juce::InputStream> stream)
{
    if (stream == nullptr)
        return std::nullopt;

    juce::AudioFormatManager formats;
    formats.registerBasicFormats();
    std::unique_ptr<juce::AudioFormatReader> reader (formats.createReaderFor (std::move (stream)));
    if (reader == nullptr || reader->lengthInSamples <= 0)
        return std::nullopt;

    LoadedIR ir;
    ir.sampleRate = reader->sampleRate;
    ir.buffer.setSize (juce::jmin (2, (int) reader->numChannels), (int) reader->lengthInSamples);
    reader->read (&ir.buffer, 0, ir.buffer.getNumSamples(), 0, true, true);

    // Loudness-match instead of JUCE's energy normalisation (see IRLevel.h).
    ir.gain = irLevelMatchGain (ir.buffer.getArrayOfReadPointers(), ir.buffer.getNumChannels(),
                                ir.buffer.getNumSamples(), ir.sampleRate);
    ir.buffer.applyGain (ir.gain);
    return ir;
}

bool CabConvolver::loadFromStream (std::unique_ptr<juce::InputStream> stream)
{
    auto ir = readIR (std::move (stream));
    if (! ir)
        return false;

    const auto stereo = ir->buffer.getNumChannels() > 1 ? juce::dsp::Convolution::Stereo::yes
                                                         : juce::dsp::Convolution::Stereo::no;
    convolution.loadImpulseResponse (std::move (ir->buffer), ir->sampleRate, stereo,
                                     juce::dsp::Convolution::Trim::yes,
                                     juce::dsp::Convolution::Normalise::no);
    return true;
}

void CabConvolver::process (juce::dsp::ProcessContextReplacing<float> context)
{
    convolution.process (context);
}

} // namespace phreak
