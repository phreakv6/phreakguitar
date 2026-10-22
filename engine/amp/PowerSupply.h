#pragma once

#include <cstdlib>
#include <string>
#include <string_view>
#include <vector>

namespace phreak
{

/**
    A tube amp's high-voltage supply, simulated: the power transformer's
    secondary (a sine at mains frequency, full-wave rectified) charges the
    reservoir capacitor through its winding resistance and the rectifier,
    and the output tubes draw current from it, more the harder they work.
    The capacitor's voltage is B+, and the output stage's headroom follows
    it. So an amp's "response" - how far it sags when you dig in and how
    fast it comes back - comes from its parts:

      - Rectifier: silicon diodes (~1 V, stiff) or a GZ34 tube, whose drop
        grows with current (Child's law, I = P V^1.5): a deeper, softer dip.
      - Reservoir capacitance: how much charge there is to borrow.
      - Source resistance (transformer winding): how fast it refills.
      - Idle and full-power current: how much the tubes ask for.

    Configured from the amp file's *@power line:

        rectifier=GZ34|silicon bplus=430 cap=40 idle=90 full=240 rsource=60

    (B+ in volts at idle, cap in uF, currents in mA, ohms). B+ is reported
    averaged over one ripple period: the 120 Hz ripple cancels in a
    push-pull output transformer, so it doesn't move the headroom.

    Response (0..1, 0.5 = stock) scales the source resistance (and the tube
    rectifier's) by 4^(2r - 1): from 4x stiffer to 4x softer.
*/
class PowerSupply
{
public:
    struct Config
    {
        bool tubeRectifier = false;
        double bplus = 450.0;     // V at idle
        double capUF = 50.0;      // reservoir capacitor
        double idleMA = 140.0;    // output tubes at idle (plus the rest of the amp)
        double fullMA = 450.0;    // average draw at full power
        double sourceOhms = 25.0; // transformer winding
        double mainsHz = 60.0;
    };

    template <typename Value>
    static Config parse (Value&& value);

    /** Finds the transformer voltage that gives `bplus` at idle, and the
        idle B+ across Response settings (so loudness at idle doesn't move
        with Response). Allocates; not real-time. */
    void prepare (const Config& c, double sampleRate);
    void reset();

    /** 0..1, 0.5 = the amp as built. Real-time safe. */
    void setResponse (double r01);

    /** Advances one sample. `drive` is how hard the output tubes work
        (|output|, 1 = full power). Returns the headroom: B+ relative to its
        idle value (1 at rest, below when sagging). */
    double step (double drive);

    /** B+ now (volts, ripple averaged). */
    double voltage() const { return average; }
    /** The lowest B+ since the last call (for the display), then resets. */
    double takeMinimum();

private:
    double rectifierCurrent (double headroom) const;
    void simulateIdle (double seconds);

    Config cfg;
    double fs = 48000.0, dt = 0.0;
    double vPeak = 0.0;           // transformer secondary, peak
    double phase = 0.0, phaseStep = 0.0;
    double vCap = 0.0;            // reservoir capacitor (B+, with ripple)
    double cap = 0.0;             // farads
    double rSource = 0.0, perveance = 0.0; // current, after Response
    double idleRef = 1.0;         // idle B+ at the current Response
    double idleAt[9] {};          // idle B+ at Response 0, 1/8, .. 1
    std::vector<double> ripple;   // one ripple period of vCap, for the average
    size_t ripplePos = 0;
    double rippleSum = 0.0, average = 0.0, minimum = 1e9;
};

template <typename Value>
PowerSupply::Config PowerSupply::parse (Value&& value)
{
    Config c;
    const auto number = [&] (std::string_view key, double fallback)
    {
        const auto v = value (key);
        return v.empty() ? fallback : std::strtod (std::string (v).c_str(), nullptr);
    };
    const auto rect = value ("rectifier");
    c.tubeRectifier = ! rect.empty() && rect != "silicon";
    c.bplus = number ("bplus", c.bplus);
    c.capUF = number ("cap", c.capUF);
    c.idleMA = number ("idle", c.idleMA);
    c.fullMA = number ("full", c.fullMA);
    c.sourceOhms = number ("rsource", c.sourceOhms);
    return c;
}

} // namespace phreak
