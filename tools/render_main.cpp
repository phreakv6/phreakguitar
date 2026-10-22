/*
    Offline render harness.

    Runs the exact plugin DSP chain (phreak::HostChain) headlessly:

        render in.wav out.wav [--drive 0..10] [--in-db X] [--out-db X]
                              [--cab path.wav | --cab-builtin | --no-cab]
                              [--block 128]
        render in.wav out.wav --amp amps/x.cir [--ampknob name=0..1 ...] [--no-cab]
            the full amp chain with a circuit amp in the amp slot.
        render in.wav out.wav --pedal file.cir [--knob name=0..1 ...]
                              [--os 1|2|4|8] [--stats] [--histogram]
            pedal only (no amp), 32-bit float WAV out (volts, unclipped).
            With --os 1 the solver runs at the file's rate: that's how
            tools/spice_check.py compares it sample-for-sample with ngspice.

    Used to generate and check golden files (tools/compare.py) so DSP
    changes never regress silently. Defaults: drive 0, gains 0 dB, no cab
    (goldens stay independent of IR data), block 128.
*/

#include <juce_audio_formats/juce_audio_formats.h>
#include "host/HostChain.h"
#include "amp/ToneStack.h"
#include "circuit/Pedal.h"
#include "amp/CircuitAmp.h"

#include <chrono>
#include <iostream>
#include <thread>

namespace
{

float argValue (juce::StringArray& args, const juce::String& flag, float fallback)
{
    const int i = args.indexOf (flag);
    if (i < 0 || i + 1 >= args.size())
        return fallback;
    return args[i + 1].getFloatValue();
}

juce::String argString (juce::StringArray& args, const juce::String& flag)
{
    const int i = args.indexOf (flag);
    if (i < 0 || i + 1 >= args.size())
        return {};
    return args[i + 1];
}

} // namespace

int main (int argc, char* argv[])
{
    juce::StringArray args;
    for (int i = 1; i < argc; ++i)
        args.add (juce::String (argv[i]));

    // --dump-tonestack t m l [sr] : print digital coefficients (ELECTRICAL
    // pot fractions, no taper) for tools/validate_tonestack.py, then exit.
    if (args.contains ("--dump-tonestack"))
    {
        const int i = args.indexOf ("--dump-tonestack");
        if (i + 3 >= args.size())
        {
            std::cerr << "usage: render --dump-tonestack t m l [sampleRate]\n";
            return 2;
        }
        const double t = args[i + 1].getDoubleValue();
        const double m = args[i + 2].getDoubleValue();
        const double l = args[i + 3].getDoubleValue();
        const double sr = (i + 4 < args.size() && ! args[i + 4].startsWith ("-"))
                              ? args[i + 4].getDoubleValue() : 48000.0;

        const auto d = phreak::ToneStack::digitalCoefficients (
            phreak::ToneStack::bassman5F6A, t, m, l, sr);
        std::cout.precision (17);
        std::cout << sr;
        for (const auto v : d)
            std::cout << " " << v;
        std::cout << "\n";
        return 0;
    }

    // --ir-gain file.wav : print the loudness-matching gain the cab applies
    // (parity check against web/src/irlevel.ts), then exit.
    if (args.contains ("--ir-gain"))
    {
        const int i = args.indexOf ("--ir-gain");
        const auto file = juce::File::getCurrentWorkingDirectory().getChildFile (args[i + 1]);
        const auto ir = phreak::CabConvolver::readIR (file.createInputStream());
        if (! ir)
        {
            std::cerr << "error: cannot read IR " << file.getFullPathName() << "\n";
            return 1;
        }
        std::cout.precision (9);
        std::cout << ir->gain << "\n";
        return 0;
    }

    if (args.size() < 2)
    {
        std::cerr << "usage: render in.wav out.wav [--drive 0..10] [--in-db X] "
                     "[--out-db X] [--cab ir.wav | --cab-builtin | --no-cab] "
                     "[--block N]\n";
        return 2;
    }

    const juce::String pedalPath = argString (args, "--pedal");
    const juce::File inFile (juce::File::getCurrentWorkingDirectory().getChildFile (args[0]));
    const juce::File outFile (juce::File::getCurrentWorkingDirectory().getChildFile (args[1]));

    const float drive = argValue (args, "--drive", 0.0f);
    const float inDb = argValue (args, "--in-db", 0.0f);
    const float outDb = argValue (args, "--out-db", 0.0f);
    const int blockSize = (int) argValue (args, "--block", 128.0f);
    const juce::String cabPath = argString (args, "--cab");
    const bool cabBuiltin = args.contains ("--cab-builtin");
    const bool useCab = cabBuiltin || cabPath.isNotEmpty();

    // --- read input -----------------------------------------------------
    juce::AudioFormatManager formats;
    formats.registerBasicFormats();

    std::unique_ptr<juce::AudioFormatReader> reader (formats.createReaderFor (inFile));
    if (reader == nullptr)
    {
        std::cerr << "error: cannot read " << inFile.getFullPathName() << "\n";
        return 1;
    }

    const int numChannels = (int) reader->numChannels;
    const int numSamples = (int) reader->lengthInSamples;
    const double sampleRate = reader->sampleRate;

    juce::AudioBuffer<float> buffer (numChannels, numSamples);
    reader->read (&buffer, 0, numSamples, 0, true, true);

    if (pedalPath.isNotEmpty())
    {
        phreak::Pedal pedal;
        std::string error;
        const auto text = juce::File::getCurrentWorkingDirectory().getChildFile (pedalPath).loadFileAsString();
        if (! pedal.load (text.toStdString(), error))
        {
            std::cerr << "error: " << pedalPath << ": " << error << "\n";
            return 1;
        }
        for (int i = 0; i < args.size(); ++i)
            if (args[i] == "--knob" && i + 1 < args.size())
            {
                const auto name = args[i + 1].upToFirstOccurrenceOf ("=", false, false).toLowerCase();
                const float value = args[i + 1].fromFirstOccurrenceOf ("=", false, false).getFloatValue();
                bool found = false;
                for (int c = 0; c < pedal.getNumControls(); ++c)
                    if (juce::String (pedal.getControl (c).name) == name)
                    {
                        pedal.setControl (c, value);
                        found = true;
                    }
                if (! found)
                {
                    std::cerr << "error: no control '" << name << "'\n";
                    return 1;
                }
            }
        if (! pedal.prepare (sampleRate, blockSize, error, (int) argValue (args, "--os", 0.0f)))
        {
            std::cerr << "error: " << error << "\n";
            return 1;
        }

        const auto start = std::chrono::steady_clock::now();
        std::vector<float> block ((size_t) blockSize);
        std::vector<float> act ((size_t) pedal.getNumDevices()), actPeak ((size_t) pedal.getNumDevices());
        float* data = buffer.getWritePointer (0);
        for (int pos = 0; pos < numSamples; pos += blockSize)
        {
            const int len = std::min (blockSize, numSamples - pos);
            std::copy (data + pos, data + pos + len, block.data());
            pedal.process (block.data(), len);
            std::copy (block.data(), block.data() + len, data + pos);
            pedal.takeActivity (act.data());
            if (pos > (int) sampleRate) // skip the first second (settling)
                for (size_t d = 0; d < act.size(); ++d)
                    actPeak[d] = std::max (actPeak[d], act[d]);
        }
        const double secs = std::chrono::duration<double> (std::chrono::steady_clock::now() - start).count();

        outFile.deleteFile();
        juce::WavAudioFormat wav;
        std::unique_ptr<juce::AudioFormatWriter> writer (wav.createWriterFor (
            new juce::FileOutputStream (outFile), sampleRate, 1, 32, {}, 0));
        if (writer == nullptr)
            return 1;
        writer->writeFromAudioSampleBuffer (buffer, 0, numSamples);
        writer->flush();

        const auto& st = pedal.getStats();
        std::cout << "pedal '" << pedal.getName() << "' " << pedal.getOversampling() << "x: "
                  << numSamples << " samples, latency " << pedal.getLatencySamples() << " samples";
        if (args.contains ("--stats"))
            std::cout << "\n  realtime load " << (secs / (numSamples / sampleRate)) * 100.0 << " %"
                      << ", newton avg " << (double) st.totalIterations / (double) std::max (1LL, st.samples)
                      << " max " << st.maxIterations << " failures " << st.newtonFailures
                      << ", faults " << pedal.getFaults()
                      << ", ports solved avg " << (double) st.activePorts / (double) std::max (1LL, st.samples)
                      << ", wakes " << st.wakes << ", rank avg " << (double) st.rank / (double) std::max (1LL, st.totalIterations);
        if (args.contains ("--histogram"))
        {
            std::cout << "\n  newton steps per sample:";
            for (int k = 0; k <= phreak::circuit::DKSolver::maxNewtonIterations; ++k)
                if (st.stepsHistogram[k] > 0)
                    std::cout << " " << k << (k == phreak::circuit::DKSolver::maxNewtonIterations ? "+" : "") << ":" << st.stepsHistogram[k];
        }
        if (args.contains ("--activity"))
            for (int d = 0; d < pedal.getNumDevices(); ++d)
                std::cout << "\n  " << pedal.getDeviceName (d) << " activity peak " << actPeak[(size_t) d];
        std::cout << "\n";
        return 0;
    }

    // --- set up chain -----------------------------------------------------
    phreak::HostChain chain;
    chain.prepare (sampleRate, blockSize, numChannels);
    if (const auto ampPath = argString (args, "--amp"); ampPath.isNotEmpty())
    {
        auto amp = std::make_unique<phreak::CircuitAmp>();
        std::string error;
        const auto text = juce::File::getCurrentWorkingDirectory().getChildFile (ampPath).loadFileAsString();
        if (! amp->load (text.toStdString(), error))
        {
            std::cerr << "error: " << ampPath << ": " << error << "\n";
            return 1;
        }
        for (int i = 0; i < args.size(); ++i)
            if (args[i] == "--ampknob" && i + 1 < args.size())
            {
                const auto name = args[i + 1].upToFirstOccurrenceOf ("=", false, false).toLowerCase();
                for (int c = 0; c < amp->getNumControls(); ++c)
                    if (juce::String (amp->getControl (c).name) == name)
                        amp->setControl (c, args[i + 1].fromFirstOccurrenceOf ("=", false, false).getFloatValue());
            }
        if (! amp->prepare (sampleRate, blockSize, error))
        {
            std::cerr << "error: " << error << "\n";
            return 1;
        }
        chain.amp.setCircuitAmp (std::move (amp));
    }
    chain.amp.setInputGainDb (inDb);
    chain.amp.setOutputGainDb (outDb);
    chain.amp.setDrive (drive / 10.0f);
    chain.setCabEnabled (useCab);

    if (useCab)
    {
        if (cabBuiltin)
        {
            chain.loadBuiltInIR (0);
        }
        else if (! chain.loadIRFile (juce::File::getCurrentWorkingDirectory()
                                         .getChildFile (cabPath)))
        {
            std::cerr << "error: cannot load IR " << cabPath << "\n";
            return 1;
        }

        // juce::dsp::Convolution loads IRs on a background thread; wait so
        // offline renders are deterministic.
        std::this_thread::sleep_for (std::chrono::milliseconds (500));
    }

    // --- process ----------------------------------------------------------
    juce::AudioBuffer<float> blockBuffer (numChannels, blockSize);
    for (int start = 0; start < numSamples; start += blockSize)
    {
        const int len = std::min (blockSize, numSamples - start);

        blockBuffer.setSize (numChannels, len, false, false, true);
        for (int ch = 0; ch < numChannels; ++ch)
            blockBuffer.copyFrom (ch, 0, buffer, ch, start, len);

        chain.process (blockBuffer);

        for (int ch = 0; ch < numChannels; ++ch)
            buffer.copyFrom (ch, start, blockBuffer, ch, 0, len);
    }

    // --- write output (24-bit WAV) -----------------------------------------
    outFile.deleteFile();
    juce::WavAudioFormat wav;
    std::unique_ptr<juce::AudioFormatWriter> writer (wav.createWriterFor (
        new juce::FileOutputStream (outFile), sampleRate,
        (unsigned int) numChannels, 24, {}, 0));

    if (writer == nullptr)
    {
        std::cerr << "error: cannot write " << outFile.getFullPathName() << "\n";
        return 1;
    }

    writer->writeFromAudioSampleBuffer (buffer, 0, numSamples);
    writer->flush();

    std::cout << "rendered " << numSamples << " samples @ " << sampleRate
              << " Hz, latency " << chain.getLatencySamples() << " samples\n";
    return 0;
}
