#include "AmpChain.h"

#include <algorithm>
#include <cmath>

namespace phreak
{

void AmpChain::prepare (double sampleRate, int maximumBlockSize, int numChannels)
{
    sampleRateNow = sampleRate;
    numChannelsNow = numChannels;
    if (looper.isEnabled())
        looper.enable (sampleRate, numChannels); // a new rate: a fresh, empty loop
    gate.prepare (sampleRate);
    gate.setRatio (gateRatio);
    gate.setAttackMs (gateAttackMs);
    gate.setReleaseMs (gateReleaseMs);

    inputGain.reset (sampleRate, 0.02);
    outputGain.reset (sampleRate, 0.02);

    driveStage.prepare (sampleRate, maximumBlockSize, numChannels);
    toneStack.prepare (sampleRate, numChannels);

    for (auto& fx : postFx)
        fx->prepare (sampleRate, maximumBlockSize);
    compressor->prepare (sampleRate, maximumBlockSize);

    fadeSamples = std::max (1, (int) std::lround (0.02 * sampleRate));
    fadeScratch.assign ((size_t) maximumBlockSize, 0.0f);

    limiter.prepare (sampleRate);
    limiter.setThresholdDb (limiterThresholdDb);
    limiter.setReleaseMs (limiterReleaseMs);

    snapPre = snapPost = true;
}

void AmpChain::reset()
{
    gate.reset();
    driveStage.reset();
    toneStack.reset();
    limiter.reset();
    for (auto& fx : postFx)
        fx->reset();
    compressor->reset();
    snapPre = snapPost = true;
}

int AmpChain::getLatencySamples() const
{
    double pedalLatency = 0.0;
    for (int s = 0; s < numPedalSlots; ++s)
        if (pedals[s] != nullptr && pedalOn[s].load())
            pedalLatency += pedals[s]->getLatencySamples();
    const double ampLatency = circuitAmp != nullptr ? circuitAmp->getLatencySamples() : driveStage.getLatencySamples();
    return (int) std::round (ampLatency + pedalLatency);
}

void AmpChain::movePedal (int from, int to)
{
    if (! validSlot (from) || ! validSlot (to))
        return;
    const int step = to > from ? 1 : -1;
    for (int s = from; s != to; s += step)
    {
        std::swap (pedals[s], pedals[s + step]);
        std::swap (outgoing[s], outgoing[s + step]);
        std::swap (fadeLeft[s], fadeLeft[s + step]);
        const bool a = pedalOn[s].load(), b = pedalOn[s + step].load();
        pedalOn[s].store (b);
        pedalOn[s + step].store (a);
    }
}

float AmpChain::peakOf (float* const* ch, int numCh, int n)
{
    float peak = 0.0f;
    for (int c = 0; c < numCh; ++c)
        for (int i = 0; i < n; ++i)
            peak = std::max (peak, std::abs (ch[c][i]));
    return peak;
}

void AmpChain::processPreCab (float* const* ch, int numCh, int n)
{
    inputPeak.store (peakOf (ch, numCh, n));

    inputGain.setTarget (dbToGain (inputDb.load()));
    driveStage.setDrive (drive.load());
    toneStack.setKnobs (treble.load(), mid.load(), bass.load());
    gate.setThresholdDb (gateDb.load());
    if (snapPre)
    {
        inputGain.snap();
        driveStage.snapParameters();
        toneStack.snapParameters();
        snapPre = false;
    }

    if (gateEnabled.load())
        gate.process (ch, numCh, n);

    if (compressorOn.load())
        compressor->process (ch, numCh, n);

    // Pedals are mono circuits: run channel 0, copy to the rest.
    bool anyPedal = false;
    for (int s = 0; s < numPedalSlots; ++s)
    {
        if (! pedalOn[s].load())
        {
            outgoing[s].reset(); // bypassed: nothing to fade
            continue;
        }
        float* x = ch[0];
        const bool fading = outgoing[s] != nullptr && (size_t) n <= fadeScratch.size();
        if (fading)
        {
            std::copy (x, x + n, fadeScratch.data());
            outgoing[s]->process (fadeScratch.data(), n);
        }
        if (pedals[s] != nullptr)
            pedals[s]->process (x, n);
        if (fading)
        {
            for (int i = 0; i < n; ++i)
            {
                const float w = (float) std::max (fadeLeft[s] - i, 0) / (float) fadeSamples; // old pedal's share
                x[i] += (fadeScratch[(size_t) i] - x[i]) * w;
            }
            fadeLeft[s] -= n;
            if (fadeLeft[s] <= 0)
                outgoing[s].reset();
        }
        else
            outgoing[s].reset();
        anyPedal |= fading || pedals[s] != nullptr;
    }
    if (anyPedal)
        for (int c = 1; c < numCh; ++c)
            std::copy (ch[0], ch[0] + n, ch[c]);

    for (int i = 0; i < n; ++i)
    {
        const float g = inputGain.next();
        for (int c = 0; c < numCh; ++c)
            ch[c][i] *= g;
    }

    if (circuitAmp != nullptr)
    {
        circuitAmp->process (ch[0], n);
        for (int c = 1; c < numCh; ++c)
            std::copy (ch[0], ch[0] + n, ch[c]);
        return;
    }
    driveStage.process (ch, numCh, n);
    toneStack.process (ch, numCh, n);
}

void AmpChain::processPostCab (float* const* ch, int numCh, int n)
{
    for (int i = 0; i < numPostEffects; ++i)
        if (postFxOn[i].load())
            postFx[i]->process (ch, numCh, n);

    outputGain.setTarget (dbToGain (outputDb.load()));
    if (snapPost)
    {
        outputGain.snap();
        snapPost = false;
    }

    for (int i = 0; i < n; ++i)
    {
        const float g = outputGain.next();
        for (int c = 0; c < numCh; ++c)
            ch[c][i] *= g;
    }

    looper.process (ch, numCh, n);
    limiter.process (ch, numCh, n);

    outputPeak.store (peakOf (ch, numCh, n));
    limiterGain.store (limiter.takeMinGain());
}

} // namespace phreak
