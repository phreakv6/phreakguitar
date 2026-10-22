#include "Looper.h"

#include <algorithm>
#include <cmath>

namespace phreak
{

void Looper::enable (double sampleRate, int numChannels, double maxSeconds)
{
    channels = std::max (1, numChannels);
    capacity = std::max (1, (int) std::lround (sampleRate * maxSeconds));
    base.assign ((size_t) (channels * capacity), 0.0f);
    layer.assign ((size_t) (channels * capacity), 0.0f);
    clear();
}

void Looper::disable()
{
    std::vector<float>().swap (base);
    std::vector<float>().swap (layer);
    capacity = 0;
    clear();
}

void Looper::clear()
{
    st = State::empty;
    length = pos = 0;
    hasLayer = layerHidden = false;
    foldLeft = 0;
}

void Looper::press()
{
    if (! isEnabled())
        return;
    switch (st)
    {
        case State::empty:
            length = pos = 0;
            hasLayer = layerHidden = false;
            foldLeft = 0;
            st = State::recording;
            break;
        case State::recording:
            // Closing the loop: it plays from the top straight away.
            st = length > 0 ? State::playing : State::empty;
            pos = 0;
            break;
        case State::playing:     startOverdub(); break;
        case State::overdubbing: st = State::playing; break;
        case State::stopped:     st = State::playing; pos = 0; break;
    }
}

void Looper::stop()
{
    if (st == State::recording)
        st = length > 0 ? State::stopped : State::empty;
    else if (st == State::playing || st == State::overdubbing)
    {
        foldAhead (foldLeft); // finish any folding now (a pause, not a performance)
        st = State::stopped;
    }
    else if (st == State::stopped)
    {
        st = State::playing;
        pos = 0;
    }
}

void Looper::undo()
{
    if (! hasLayer)
        return;
    foldAhead (foldLeft); // the older layer goes into the base first
    layerHidden = ! layerHidden;
}

void Looper::startOverdub()
{
    if (hasLayer)
    {
        // The previous layer becomes part of the base (or is dropped, if
        // it was undone), folded ahead of where this overdub writes.
        foldAhead (foldLeft); // an older fold, if one is still going
        foldLeft = length;
        foldPos = pos;
        foldDiscard = layerHidden;
    }
    hasLayer = true;
    layerHidden = false;
    st = State::overdubbing;
}

void Looper::foldAhead (int n)
{
    if (foldLeft <= 0 || length <= 0)
        return;
    const int todo = std::min (foldLeft, std::max (n, 0));
    for (int k = 0; k < todo; ++k)
    {
        for (int c = 0; c < channels; ++c)
        {
            float& l = layer[(size_t) (c * capacity + foldPos)];
            if (! foldDiscard)
                base[(size_t) (c * capacity + foldPos)] += l;
            l = 0.0f;
        }
        foldPos = foldPos + 1 == length ? 0 : foldPos + 1;
    }
    foldLeft -= todo;
}

void Looper::process (float* const* ch, int numCh, int n)
{
    if (! isEnabled() || st == State::empty || st == State::stopped)
        return;
    const int nc = std::min (numCh, channels);

    if (st == State::recording)
    {
        for (int i = 0; i < n; ++i)
        {
            if (length == capacity)
            {
                // Full: the loop closes itself and plays the rest of the block.
                st = State::playing;
                pos = 0;
                float* rest[8];
                const int m = std::min (numCh, 8);
                for (int c = 0; c < m; ++c)
                    rest[c] = ch[c] + i;
                process (rest, m, n - i);
                return;
            }
            for (int c = 0; c < channels; ++c)
            {
                const float x = ch[std::min (c, numCh - 1)][i];
                base[(size_t) (c * capacity + length)] = x;
                layer[(size_t) (c * capacity + length)] = 0.0f;
            }
            ++length;
        }
        return;
    }

    // Playing or overdubbing. Fold well ahead of the playhead: 32x its
    // speed, so a whole fold takes 1/32 of the loop.
    foldAhead (std::max (n * 32, 4096));
    const bool dub = st == State::overdubbing;
    const bool showLayer = hasLayer && ! layerHidden;
    for (int i = 0; i < n; ++i)
    {
        for (int c = 0; c < nc; ++c)
        {
            const size_t idx = (size_t) (c * capacity + pos);
            const float in = ch[c][i];
            const float loop = base[idx] + (showLayer ? layer[idx] : 0.0f);
            if (dub)
                layer[idx] += in;
            ch[c][i] = in + gain * loop;
        }
        pos = pos + 1 == length ? 0 : pos + 1;
    }
}

} // namespace phreak
