#pragma once

#include "Matrix.h"
#include "Netlist.h"

#include <string>
#include <vector>

namespace phreak::circuit
{

/**
    Nodal DK-method circuit solver (Yeh & Smith; Holters & Zoelzer's
    generalisation).

    Modified nodal analysis of the linear part (resistors, pots, voltage
    sources, capacitors and inductors as trapezoidal companions) is solved symbolically
    once, leaving a state-space system:

        p      = G x + H u                 (linear prediction at the ports)
        v_n    = p - K i(v_n)              (solved per sample, Newton)
        y      = D x + E u - F i(v_n)
        x_next = Ax x + Bx u - Cx i(v_n)

    x: capacitor and inductor states, u: source voltages (guitar input + supplies),
    v_n / i: voltages / currents of the nonlinear ports (one per diode,
    two per transistor: B-E and B-C, two per triode: G-K and P-K). Only the
    small port system is solved per sample, so cost scales with the number
    of junctions, not nodes.

    Each Newton step solves (I + K J) dv = r, J = dI/dV. J is low rank: a
    triode's grid draws no current (its row is zero) and a reverse-biased
    junction's voltage moves no current (its column is ~zero), so the step
    goes through the Woodbury identity with a system of J's rank (about
    one per device) instead of one per port.

    Matrices are rebuilt when a pot moves (O(nodes^3), at block rate).
*/
class DKSolver
{
public:
    /** Builds the system for `nl` at `sampleRate` with all knobs at their
        defaults, and solves the DC operating point. */
    bool build (const Netlist& nl, double sampleRate, std::string& error);

    /** Knob positions (0..1, before taper), one per Netlist control.
        Rebuilds matrices if anything changed; keeps capacitor state. */
    void setControls (const std::vector<double>& knobs01);

    /** Re-solves the DC operating point (bias) and resets all state. */
    bool solveOperatingPoint();

    /** One sample: input voltage in, output voltage out. */
    double process (double input);

    static constexpr int maxNewtonIterations = 30;

    struct Stats
    {
        long long samples = 0;
        long long newtonFailures = 0; // samples that hit the iteration cap
        int maxIterations = 0;
        long long totalIterations = 0;
        long long wakes = 0; // dormant diodes that had to rejoin a solve
        long long activePorts = 0; // summed over samples: ports in the Newton solve
        long long rank = 0;        // summed over Newton steps: size of the system solved
        /** Samples by Newton steps taken (all attempts), the last bin
            collecting everything from maxNewtonIterations up. */
        long long stepsHistogram[maxNewtonIterations + 1] {};
    };
    Stats stats;

    static constexpr double newtonTolerance = 1e-6; // volts: residual of v = p - K i(v)
    /** A diode reverse-biased by more than this many n*Vt passes -Is to
        within e^-14 (~1e-6) of it and is left out of the Newton solve. */
    static constexpr double dormantDepth = 14.0;
    /** Largest per-iteration voltage step on a tube port (volts). */
    static constexpr double tubeMaxStep = 20.0;

    /** Nonlinear devices in solver order (diodes, transistors, triodes), with
        their netlist names (subcircuit parts prefixed, e.g. XU1.DHI). */
    /** A second output: the voltage at `node` (a Netlist node index; -1 =
        none), read with probeVolts() after each process(). Re-projects the
        circuit (allocates): call between blocks. */
    void setProbe (int node);
    double probeVolts() const { return probe; }

    int numDevices() const { return (int) devices.size(); }
    const std::string& deviceName (int d) const { return devices[(size_t) d].name; }

    /** How hard each device worked since the last call, then resets:
        diodes: peak |current| (A); transistors and triodes: peak swing of
        the collector / plate current away from its running average, as a
        fraction of that average (0 = idle, 1 = swinging by its whole bias
        current). */
    void takeActivity (float* out);

    int numNodes() const   { return (int) nl.nodes.size(); }
    int numPorts() const   { return (int) ports.size(); }
    int numStates() const  { return (int) nl.capacitors.size(); }

private:
    struct Port
    {
        int p = -1, n = -1;
        double vt = 0.025852, vcrit = 0.6, sign = 1.0; // junction limiting
        bool junction = true; // pn junction (pnjlim) vs tube/JFET (step clamp)
        bool control = false; // a voltage the device senses but draws no current from (grid, gate)
    };

    struct Device
    {
        enum Kind { diode, bjt, triode, jfet } kind = diode;
        double vto = -2.0, beta = 1e-4, lambda = 0.0; // JFET
        double mu = 100, ex = 1.4, kg1 = 1060, kp = 600, kvb = 300; // triode
        int port = 0;       // first port index (BJT uses port, port + 1)
        std::string name;
        double is = 1e-14, nvt = 0.025852, bf = 100.0, br = 1.0, sign = 1.0;
    };

    bool rebuild();
    bool solvePorts (const double* p, int maxIter, bool countStats, bool& woke);
    int factorJacobian(); // J = U W^T over the active devices; returns the rank
    double stepResidualBound() const; // after a Newton step dv, see solvePorts
    void updateKColumnMax(); // and sK: after K changes
    void evalDevices (const double* v);

    Netlist nl;
    double fs = 48000.0;
    std::vector<Port> ports;
    std::vector<Device> devices;
    std::vector<double> controlPos;    // tapered wiper positions
    std::vector<double> knobs;
    std::vector<double> gCap;          // 2C/T per capacitor, T/(2L) per inductor
    // Inductors (state indices) and their companion conductances
    // (T/2) L^-1, a full matrix when windings share a core (K elements):
    // a current in one winding answers to the voltages across all of them.
    std::vector<int> inductors;
    Matrix gInd;
    std::vector<int> blockStart, blockSize; // each port's device block
    std::vector<int> portDevice, act;       // port -> device; active ports
    std::vector<int> currentPorts;          // ports that carry current (not tube grids)
    std::vector<char> dormant;              // per device

    // State-space matrices (see class comment).
    Matrix G, H, K, D, E, F, Ax, Bx, Cx;

    /** A matrix's non-zero entries, row by row (most are exactly zero: a
        grid behind a coupling cap, a stage that doesn't feed back). The
        per-sample products use these; built in rebuild(). */
    struct SparseRows
    {
        std::vector<int> start, col;
        std::vector<double> val;
        /** Keeps entries above 1e-15 of their row's largest (exact zeros
            and rounding dust); `cols`, if given, limits the columns. */
        void build (const Matrix& m, const std::vector<int>* cols = nullptr);
        double dot (int r, const double* v) const
        {
            double s = 0.0;
            for (int i = start[(size_t) r], e = start[(size_t) r + 1]; i < e; ++i)
                s += val[(size_t) i] * v[col[(size_t) i]];
            return s;
        }
    };
    SparseRows sG, sK, sAx, sCx, sD, sF; // sK, sCx, sF: current-carrying ports only
    // H u, Bx u, E u split into the fixed supplies' part and the input's.
    std::vector<double> hConst, hIn, bConst, bIn;
    double eConst = 0.0, eIn = 0.0;
    int probeNode = -1;
    double probe = 0.0, probeConst = 0.0, probeIn = 0.0; // E u's share for the probe row

    // Per-sample working storage (sized in build, never reallocated).
    std::vector<double> x, xNext, u, vn, vnPrev, in, pBuf, rhs, dv;
    // Newton step: jb = each port's row of its device's 2x2 (or 1x1) block
    // of dI/dV; rank-1 terms u w^T of J (on one device's ports); K U; the
    // small system I + W^T K U and its right-hand side.
    std::vector<double> jb, termU, termW, ku, small, smallRhs;
    std::vector<int> termPort, termSize;
    std::vector<double> kColumnMax; // per port: max |K(r, port)| over all rows r
    std::vector<double> activity, icAverage; // per device, see takeActivity()
    double averageCoef = 0.0;
    int inputIndex = 0;
};

} // namespace phreak::circuit
