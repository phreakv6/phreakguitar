#pragma once

#include <vector>

namespace phreak
{

/**
    A looper at the end of the chain (after the effects and the output
    level, before the limiter), like a classic one-button loop pedal: it records,
    closes the loop and plays it, then layers overdubs on top.

        press():  empty -> recording -> playing <-> overdubbing
        stop():   playing / overdubbing -> stopped -> playing (from the top)
        undo():   hides the newest overdub layer (again: brings it back)
        clear():  empty

    The loop is the committed layers (`base`) plus the newest overdub
    (`layer`), kept apart so undo is instant. Starting a new overdub folds
    the previous layer into `base` a stretch at a time, always ahead of the
    playhead, so no block does more than a few thousand adds.

    Memory: enable() allocates maxSeconds of stereo, twice (base + layer);
    disable() frees it. Both allocate or free: call between blocks, not
    from inside process().
*/
class Looper
{
public:
    enum class State { empty, recording, playing, overdubbing, stopped };

    void enable (double sampleRate, int numChannels, double maxSeconds = 60.0);
    void disable();
    bool isEnabled() const { return capacity > 0; }

    void press();
    void stop();
    void undo();
    void clear();

    /** Playback gain (the page folds in Master changes since recording). */
    void setGain (float g) { gain = g; }

    /** In place: records `ch` as needed and adds the loop's playback. */
    void process (float* const* ch, int numCh, int n);

    State state() const { return st; }
    int lengthSamples() const { return length; }
    int positionSamples() const { return pos; }
    bool canUndo() const { return hasLayer && ! layerHidden; }
    bool canRedo() const { return hasLayer && layerHidden; }

private:
    void startOverdub();
    void foldAhead (int n); // folds the previous layer into base, ahead of the playhead

    int channels = 2, capacity = 0, length = 0, pos = 0;
    std::vector<float> base, layer; // [channel * capacity + i]
    State st = State::empty;
    float gain = 1.0f;
    bool hasLayer = false, layerHidden = false;
    // Folding the previous overdub into base: how much of the loop is left
    // to fold, and where folding has got to.
    int foldLeft = 0, foldPos = 0;
    bool foldDiscard = false; // the previous layer was undone: drop it
};

} // namespace phreak
