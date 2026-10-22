#pragma once

#include <cmath>
#include <string>
#include <string_view>
#include <vector>

namespace phreak::circuit
{

/**
    A pedal circuit, parsed from a SPICE-subset netlist that ngspice can run
    unchanged (that's how factory pedals are validated). PhreakGuitar-specific
    metadata lives in comment directives ngspice ignores:

        *@pedal name="Round Fuzz" oversample=4
        *@control fuzz label="Fuzz" taper=lin default=0.8
        *@input Vin        voltage source the guitar signal drives (1.0 = 1 V)
        *@output out       node the pedal output is read from (1 V = 1.0)

    Elements: R, C, V (DC), E (VCVS), D, Q (NPN/PNP), J (NJF/PJF), L, K (coupled
    inductors: transformers), subcircuit instances
    (Xname nodes... SUBNAME, parameterless .subckt blocks), and pots as
        Xname a w b POT R=500k pos={control}
    (w is the wiper; pos = 1 puts it at a). The file should carry the
    matching .subckt POT so ngspice can run it; the engine knows POT
    natively. Ground is node 0 (or gnd).
*/

enum class Taper { linear, audio, reverseAudio };

struct Control
{
    std::string name, label;
    Taper taper = Taper::linear;
    double defaultValue = 0.5;
};

struct DiodeModel
{
    double is = 1e-14, n = 1.0, rs = 0.0;
};

struct BjtModel
{
    bool pnp = false;
    double is = 1e-16, bf = 100.0, br = 1.0;
};

struct Resistor
{
    int a = -1, b = -1;
    double r = 1.0;
    // Pot halves: resistance depends on a control (see potResistance).
    int control = -1;
    bool upper = false; // a..w half (shrinks as pos -> 1)
    double total = 0.0;
    // A switch throw (Xname a b SW pos={control} k=.. n=..): closed when the
    // control is at position k of n, open otherwise.
    int throwIndex = -1, throws = 0;
};

/** A reactive element: a capacitor (c in farads), or an inductor when
    `inductor` is set (c in henries). Both are solver states. */
struct Capacitor { int a = -1, b = -1; double c = 0.0; bool inductor = false; std::string name; };
/** K element: two inductors (indices into capacitors) on one core, with
    mutual inductance k sqrt(L1 L2). Transformers: one inductor per winding
    (or half-winding, for a centre tap), every pair coupled. */
struct Coupling  { int a = -1, b = -1; double k = 0.0; };
struct Source    { std::string name; int p = -1, n = -1; double value = 0.0; };
struct Diode     { int a = -1, k = -1; DiodeModel m; std::string name; };
struct Bjt       { int c = -1, b = -1, e = -1; BjtModel m; std::string name; };
/** Vacuum triode, Koren's model (plate current only; grid current is a
    separate diode in the netlist so ngspice and the engine agree):
        E1 = Vpk/KP * ln(1 + exp(KP * (1/MU + Vgk / sqrt(KVB + Vpk^2))))
        Ip = max(E1, 0)^EX / KG1
    Written as  Xname plate grid cathode TRIODE MU=.. EX=.. KG1=.. KP=.. KVB=..
    with a matching .subckt TRIODE (a B source) for ngspice. */
/** Shichman-Hodges JFET (SPICE level 1): Id = BETA Vgst^2 (1 + LAMBDA Vds)
    in saturation, BETA Vds (2 Vgst - Vds)(1 + LAMBDA Vds) below it, drain
    and source swapping roles when Vds < 0. The gate junctions (reverse
    biased in the circuits here, ~1e-14 A) are left out. */
struct JfetModel { bool pjf = false; double vto = -2.0, beta = 1e-4, lambda = 0.0; };
struct Jfet      { int d = -1, g = -1, s = -1; JfetModel m; std::string name; };
struct Triode    { int p = -1, g = -1, k = -1; double mu = 100, ex = 1.4, kg1 = 1060, kp = 600, kvb = 300; std::string name; };

/** E element: V(p) - V(n) = gain * (V(cp) - V(cn)). Op-amp macromodels. */
struct Vcvs      { int p = -1, n = -1, cp = -1, cn = -1; double gain = 1.0; };

struct Netlist
{
    std::string name;
    std::vector<std::string> nodes; // index = node id; ground is -1
    std::vector<Resistor> resistors;
    std::vector<Capacitor> capacitors; // and inductors
    std::vector<Coupling> couplings;
    std::vector<Source> sources;
    std::vector<Diode> diodes;
    std::vector<Bjt> bjts;
    std::vector<Jfet> jfets;
    std::vector<Vcvs> vcvs;
    std::vector<Triode> triodes;
    std::vector<Control> controls;
    int inputSource = -1; // index into sources
    int outputNode = -1;
    int oversampling = 4;
    /** A pedal that is a DSP model rather than a circuit (*@pedal dsp=...):
        its file has only directives; Pedal runs the named model. */
    std::string dsp;
};

/** Pots never reach 0 ohms (keeps the system well-conditioned); the POT
    subcircuit in each pedal file must use the same minimum. */
constexpr double potMinOhms = 1.0;

inline double potResistance (const Resistor& r, double pos)
{
    if (r.throws > 0) // a switch throw: 1 ohm closed, 1 Gohm open
        return std::lround (pos * (r.throws - 1)) == r.throwIndex ? 1.0 : 1e9;
    return r.total * (r.upper ? 1.0 - pos : pos) + potMinOhms;
}

/** Knob position 0..1 -> wiper position through the pot's taper. Audio
    taper ~15 % at half rotation, like a real A-taper pot; reverse audio
    (a C-taper pot, "taper=revaudio") the mirror image, ~85 %. */
double applyTaper (Taper t, double knob01);

/** Parses `text`; on failure returns false and sets `error` (with line). */
bool parseNetlist (std::string_view text, Netlist& out, std::string& error);

/** SPICE number: 4.7k, 2.2u, 1meg, 100n, 1e-9, 470pF ... */
bool parseValue (std::string_view s, double& v);

} // namespace phreak::circuit
