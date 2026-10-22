#pragma once

#include "dsp/IIRFilter.h"
#include "dsp/Smoothed.h"

#include <array>
#include <vector>

namespace phreak
{

/**
    Exact passive TMB tone stack (SPEC.md Phase 1), solved from the schematic.

    Topology (the '59 tweed bass 5F6-A stack, also the classic British one):

                  C1
        IN >------||------ T1
             |             | )
             |             | ) R1 treble pot (wiper -> OUT, unloaded)
             | R4          | )
             |             N3 ----+
             |     C2      |      |
             +-----||------+      ( l*R2  bass rheostat
             |                    |
             |     C3             N4
             +-----||-------------+
                                  ( m*R3  mid rheostat
                                  |
                                 gnd

    The network is passive and linear, so it has an exact 3rd-order transfer
    function H(s) = (b1 s + b2 s^2 + b3 s^3) / (a0 + a1 s + a2 s^2 + a3 s^3)
    whose coefficients are polynomials in the pot fractions (t, m, l) —
    derived in D.T. Yeh & J.O. Smith, "Discretization of the '59 Fender
    Bassman Tone Stack" (DAFx-06). We discretize with the bilinear transform,
    recomputing coefficients whenever a knob moves. This is why the three
    knobs interact exactly like the real circuit: they ARE the real circuit.

    Validated against an independent numeric MNA solve of the same schematic
    (tools/validate_tonestack.py) to within the SPEC tolerance.
*/
class ToneStack
{
public:
    struct Components
    {
        double R1, R2, R3, R4; // treble pot, bass pot, mid pot, slope resistor
        double C1, C2, C3;
    };

    /** '59 tweed bass 5F6-A values. */
    static constexpr Components bassman5F6A { 250e3, 1e6, 25e3, 56e3,
                                              250e-12, 20e-9, 20e-9 };

    /** Analog s-domain coefficients; t, m, l are ELECTRICAL pot fractions
        in [0, 1] (tapers are applied in setKnobs, not here). */
    static void analogCoefficients (const Components& c,
                                    double t, double m, double l,
                                    std::array<double, 4>& b,
                                    std::array<double, 4>& a);

    /** Bilinear-transformed digital coefficients {B0..B3, A0..A3}. */
    static std::array<double, 8> digitalCoefficients (const Components& c,
                                                      double t, double m, double l,
                                                      double sampleRate);

    void prepare (double sampleRate, int numChannels);
    void reset();
    void snapParameters();

    /** UI knob values in [0, 1]; applies pot tapers (bass pot is audio
        taper: l = e^{3.4 (L - 1)}, matching measured pot laws). */
    void setKnobs (float treble01, float mid01, float bass01);

    void process (float* const* ch, int numCh, int n);

    /** The passive stack is lossy (~10-20 dB at noon); the real amp makes
        this up in the following stage. Fixed makeup keeps levels workable. */
    static constexpr float makeupDb = 12.0f;

private:
    void updateCoefficients (float t, float m, float l);

    std::vector<IIRFilter<3>> filters; // one per channel

    LinearSmoothed trebleSm { 0.5f }, midSm { 0.5f }, bassSm { 0.5f };
    float lastT = -1.0f, lastM = -1.0f, lastL = -1.0f;
    double sampleRate = 48000.0;
};

} // namespace phreak
