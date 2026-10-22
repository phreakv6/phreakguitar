#include "DKSolver.h"

#include <algorithm>
#include <cmath>

namespace phreak::circuit
{

namespace
{
    // Thermal voltage at SPICE's nominal 27 degC (matches ngspice).
    constexpr double thermalVoltage = 1.380649e-23 * 300.15 / 1.602176634e-19;
    // ngspice puts GMIN across every junction; so do we, for agreement and
    // so a fully reverse-biased junction never leaves a port undefined.
    constexpr double junctionGmin = 1e-12;
    // Tiny leak from every node to ground: keeps nodes isolated by
    // capacitors well-defined when they're opened for the DC solve.
    constexpr double nodeGmin = 1e-12;
    // An inductor at DC: a short (1 mOhm).
    constexpr double inductorDcConductance = 1e3;

    double pnjlim (double vnew, double vold, double vt, double vcrit)
    {
        if (vnew > vcrit && std::abs (vnew - vold) > 2.0 * vt)
        {
            if (vold > 0.0)
            {
                const double arg = 1.0 + (vnew - vold) / vt;
                vnew = arg > 0.0 ? vold + vt * std::log (arg) : vcrit;
            }
            else
                vnew = vt * std::log (vnew / vt);
        }
        return vnew;
    }

    double safeExp (double a) { return std::exp (std::min (a, 80.0)); }

    // value of (+1 at a, -1 at b) row applied to column `col` of X.
    double pick (const Matrix& X, int a, int b, int col)
    {
        return (a >= 0 ? X (a, col) : 0.0) - (b >= 0 ? X (b, col) : 0.0);
    }

    // The solved linear system, as port/state/output projections of S^-1.
    struct Projections
    {
        Matrix stateFromState, stateFromSource, stateFromPort; // A, B, C
        Matrix portFromState, portFromSource, portFromPort;    // G, H, K
        Matrix outFromState, outFromSource, outFromPort;       // D, E, F
    };
} // namespace

bool DKSolver::build (const Netlist& netlist, double sampleRate, std::string& error)
{
    nl = netlist;
    fs = sampleRate;
    stats = {};

    ports.clear();
    devices.clear();
    for (const auto& d : nl.diodes)
    {
        Device dev;
        dev.kind = Device::diode;
        dev.port = (int) ports.size();
        dev.is = d.m.is;
        dev.nvt = d.m.n * thermalVoltage;
        dev.name = d.name;
        const double vcrit = dev.nvt * std::log (dev.nvt / (std::sqrt (2.0) * dev.is));
        ports.push_back ({ d.a, d.k, dev.nvt, vcrit, 1.0 });
        devices.push_back (dev);
    }
    for (const auto& q : nl.bjts)
    {
        Device dev;
        dev.kind = Device::bjt;
        dev.port = (int) ports.size();
        dev.is = q.m.is;
        dev.nvt = thermalVoltage;
        dev.bf = q.m.bf;
        dev.br = q.m.br;
        dev.sign = q.m.pnp ? -1.0 : 1.0;
        dev.name = q.name;
        const double vcrit = dev.nvt * std::log (dev.nvt / (std::sqrt (2.0) * dev.is));
        ports.push_back ({ q.b, q.e, dev.nvt, vcrit, dev.sign }); // B-E
        ports.push_back ({ q.b, q.c, dev.nvt, vcrit, dev.sign }); // B-C
        devices.push_back (dev);
    }
    for (const auto& t : nl.triodes)
    {
        Device dev;
        dev.kind = Device::triode;
        dev.port = (int) ports.size();
        dev.mu = t.mu; dev.ex = t.ex; dev.kg1 = t.kg1; dev.kp = t.kp; dev.kvb = t.kvb;
        dev.name = t.name;
        Port gk { t.g, t.k };
        gk.junction = false;
        Port pk { t.p, t.k };
        pk.junction = false;
        gk.control = true;
        ports.push_back (gk); // port: grid-cathode voltage (no current; it's an input)
        ports.push_back (pk); // port: plate-cathode, carries Ip
        devices.push_back (dev);
    }
    for (const auto& j : nl.jfets)
    {
        Device dev;
        dev.kind = Device::jfet;
        dev.port = (int) ports.size();
        dev.vto = j.m.vto; dev.beta = j.m.beta; dev.lambda = j.m.lambda;
        dev.sign = j.m.pjf ? -1.0 : 1.0;
        dev.name = j.name;
        Port gs { j.g, j.s };
        gs.junction = false;
        gs.control = true;
        Port ds { j.d, j.s };
        ds.junction = false;
        ports.push_back (gs); // port: gate-source voltage (no current)
        ports.push_back (ds); // port: drain-source, carries Id
        devices.push_back (dev);
    }

    const int nx = numStates(), nn = numPorts(), nu = (int) nl.sources.size();
    portDevice.assign ((size_t) nn, 0);
    currentPorts.clear();
    for (int k = 0; k < nn; ++k)
        if (! ports[(size_t) k].control)
            currentPorts.push_back (k);
    for (size_t d = 0; d < devices.size(); ++d)
        for (int k = devices[d].port; k < devices[d].port + (devices[d].kind == Device::diode ? 1 : 2); ++k)
            portDevice[(size_t) k] = (int) d;
    dormant.assign (devices.size(), 0);
    activity.assign (devices.size(), 0.0);
    icAverage.assign (devices.size(), 0.0);
    averageCoef = 1.0 - std::exp (-1.0 / (0.3 * fs)); // 300 ms running average
    act.assign ((size_t) nn, 0);
    blockStart.assign ((size_t) nn, 0);
    blockSize.assign ((size_t) nn, 1);
    for (const auto& d : devices)
    {
        const int size = d.kind == Device::diode ? 1 : 2;
        for (int k = d.port; k < d.port + size; ++k)
        {
            blockStart[(size_t) k] = d.port;
            blockSize[(size_t) k] = size;
        }
    }
    gCap.resize ((size_t) nx);
    inductors.clear();
    for (int k = 0; k < nx; ++k)
    {
        // Trapezoidal companions: 2C/T for a capacitor, T/(2L) for an inductor.
        const auto& e = nl.capacitors[(size_t) k];
        gCap[(size_t) k] = e.inductor ? 1.0 / (2.0 * e.c * fs) : 2.0 * e.c * fs;
        if (e.inductor)
            inductors.push_back (k);
    }
    {
        // Inductance matrix: L on the diagonal, k sqrt(L1 L2) between
        // coupled windings; the companion is (T/2) times its inverse.
        const int ni = (int) inductors.size();
        auto slot = [&] (int cap) { return (int) (std::find (inductors.begin(), inductors.end(), cap) - inductors.begin()); };
        Matrix L (ni, ni), I (ni, ni);
        for (int i = 0; i < ni; ++i)
        {
            L (i, i) = nl.capacitors[(size_t) inductors[(size_t) i]].c;
            I (i, i) = 1.0;
        }
        for (const auto& k : nl.couplings)
        {
            const int a = slot (k.a), b = slot (k.b);
            L (a, b) = L (b, a) = k.k * std::sqrt (L (a, a) * L (b, b));
        }
        LU lu;
        if (ni > 0 && ! lu.factor (L))
        {
            error = "coupled inductors: inductance matrix is singular";
            return false;
        }
        gInd = ni > 0 ? lu.solve (I) : Matrix (0, 0);
        for (auto& g : gInd.d)
            g *= 0.5 / fs;
    }

    x.assign ((size_t) nx, 0.0);
    xNext.assign ((size_t) nx, 0.0);
    u.assign ((size_t) nu, 0.0);
    for (int k = 0; k < nu; ++k)
        u[(size_t) k] = nl.sources[(size_t) k].value;
    inputIndex = nl.inputSource;
    u[(size_t) inputIndex] = 0.0;
    vn.assign ((size_t) nn, 0.0);
    vnPrev.assign ((size_t) nn, 0.0);
    in.assign ((size_t) nn, 0.0);
    pBuf.assign ((size_t) nn, 0.0);
    rhs.assign ((size_t) nn, 0.0);
    dv.assign ((size_t) nn, 0.0);
    jb.assign ((size_t) (nn * 2), 0.0);
    termU.assign ((size_t) (nn * 2), 0.0);
    termW.assign ((size_t) (nn * 2), 0.0);
    termPort.assign ((size_t) nn, 0);
    termSize.assign ((size_t) nn, 1);
    ku.assign ((size_t) (nn * nn), 0.0);
    small.assign ((size_t) (nn * nn), 0.0);
    smallRhs.assign ((size_t) nn, 0.0);

    knobs.resize (nl.controls.size());
    controlPos.resize (nl.controls.size());
    for (size_t c = 0; c < nl.controls.size(); ++c)
    {
        knobs[c] = nl.controls[c].defaultValue;
        controlPos[c] = applyTaper (nl.controls[c].taper, knobs[c]);
    }

    if (! rebuild())
    {
        error = "circuit matrix is singular (floating node or source loop?)";
        return false;
    }
    if (! solveOperatingPoint())
    {
        error = "no DC operating point found (bias did not converge)";
        return false;
    }
    return true;
}

void DKSolver::setControls (const std::vector<double>& knobs01)
{
    bool changed = false;
    for (size_t c = 0; c < knobs.size() && c < knobs01.size(); ++c)
        if (knobs01[c] != knobs[c])
        {
            knobs[c] = knobs01[c];
            controlPos[c] = applyTaper (nl.controls[c].taper, knobs[c]);
            changed = true;
        }
    if (changed)
        rebuild();
}

// Builds the MNA matrix S (capacitors as companions, or open for DC) and
// projects S^-1 onto the states, ports and output.
static bool project (const Netlist& nl, const std::vector<double>& controlPos,
                     const std::vector<double>* gCap, const std::vector<int>& inductors,
                     const Matrix& gInd, int numPorts,
                     const std::vector<std::pair<int, int>>& portNodes, int probeNode,
                     Projections& out)
{
    const int N = (int) nl.nodes.size(), M = (int) nl.sources.size(), V = (int) nl.vcvs.size();
    const int nx = (int) nl.capacitors.size(), nu = M, nn = numPorts;
    const int size = N + M + V; // node voltages, source currents, VCVS currents
    Matrix S (size, size);

    auto stamp = [&] (int a, int b, double g)
    {
        if (a >= 0) S (a, a) += g;
        if (b >= 0) S (b, b) += g;
        if (a >= 0 && b >= 0) { S (a, b) -= g; S (b, a) -= g; }
    };

    for (int i = 0; i < N; ++i)
        S (i, i) += nodeGmin;
    for (const auto& r : nl.resistors)
    {
        const double ohms = r.control >= 0 ? potResistance (r, controlPos[(size_t) r.control]) : r.r;
        stamp (r.a, r.b, 1.0 / ohms);
    }
    // Companion conductances; at DC (no gCap) capacitors are open and
    // inductors short.
    for (int k = 0; k < nx; ++k)
    {
        const auto& e = nl.capacitors[(size_t) k];
        if (gCap != nullptr && ! e.inductor)
            stamp (e.a, e.b, (*gCap)[(size_t) k]);
        else if (gCap == nullptr && e.inductor)
            stamp (e.a, e.b, inductorDcConductance);
    }
    // Inductors: the current in winding i is sum_j gInd(i, j) v_j (one
    // conductance each if nothing is coupled).
    if (gCap != nullptr)
        for (size_t i = 0; i < inductors.size(); ++i)
            for (size_t j = 0; j < inductors.size(); ++j)
            {
                const double g = gInd ((int) i, (int) j);
                if (g == 0.0)
                    continue;
                const auto& a = nl.capacitors[(size_t) inductors[i]];
                const auto& b = nl.capacitors[(size_t) inductors[j]];
                if (a.a >= 0 && b.a >= 0) S (a.a, b.a) += g;
                if (a.a >= 0 && b.b >= 0) S (a.a, b.b) -= g;
                if (a.b >= 0 && b.a >= 0) S (a.b, b.a) -= g;
                if (a.b >= 0 && b.b >= 0) S (a.b, b.b) += g;
            }
    for (int k = 0; k < M; ++k)
    {
        const auto& s = nl.sources[(size_t) k];
        if (s.p >= 0) { S (N + k, s.p) += 1.0; S (s.p, N + k) += 1.0; }
        if (s.n >= 0) { S (N + k, s.n) -= 1.0; S (s.n, N + k) -= 1.0; }
    }
    // VCVS: its current enters KCL like a source's; its row enforces
    // V(p) - V(n) - gain * (V(cp) - V(cn)) = 0.
    for (int k = 0; k < V; ++k)
    {
        const auto& e = nl.vcvs[(size_t) k];
        const int r = N + M + k;
        if (e.p >= 0)  { S (r, e.p) += 1.0; S (e.p, r) += 1.0; }
        if (e.n >= 0)  { S (r, e.n) -= 1.0; S (e.n, r) -= 1.0; }
        if (e.cp >= 0) S (r, e.cp) -= e.gain;
        if (e.cn >= 0) S (r, e.cn) += e.gain;
    }

    // RHS columns: [capacitor states | sources | ports].
    Matrix rhs (size, nx + nu + nn);
    for (int k = 0; k < nx; ++k)
    {
        const auto& c = nl.capacitors[(size_t) k];
        if (c.a >= 0) rhs (c.a, k) += 1.0;
        if (c.b >= 0) rhs (c.b, k) -= 1.0;
    }
    for (int k = 0; k < nu; ++k)
        rhs (N + k, nx + k) = 1.0;
    for (int k = 0; k < nn; ++k)
    {
        const auto [p, n] = portNodes[(size_t) k];
        if (p >= 0) rhs (p, nx + nu + k) += 1.0;
        if (n >= 0) rhs (n, nx + nu + k) -= 1.0;
    }

    LU lu;
    if (! lu.factor (S))
        return false;
    const Matrix X = lu.solve (rhs);

    auto rowsFrom = [&] (auto rowNodes, int numRows, int colStart, int numCols)
    {
        Matrix m (numRows, numCols);
        for (int r = 0; r < numRows; ++r)
        {
            const auto [a, b] = rowNodes (r);
            for (int c = 0; c < numCols; ++c)
                m (r, c) = pick (X, a, b, colStart + c);
        }
        return m;
    };
    auto capRow = [&] (int r) { return std::pair { nl.capacitors[(size_t) r].a, nl.capacitors[(size_t) r].b }; };
    auto portRow = [&] (int r) { return portNodes[(size_t) r]; };
    // Row 0: the output; row 1 (if probing): the probed node.
    auto outRow = [&] (int r) { return std::pair { r == 0 ? nl.outputNode : probeNode, -1 }; };
    const int numOut = probeNode >= 0 ? 2 : 1;

    out.stateFromState  = rowsFrom (capRow, nx, 0, nx);
    out.stateFromSource = rowsFrom (capRow, nx, nx, nu);
    out.stateFromPort   = rowsFrom (capRow, nx, nx + nu, nn);
    out.portFromState   = rowsFrom (portRow, nn, 0, nx);
    out.portFromSource  = rowsFrom (portRow, nn, nx, nu);
    out.portFromPort    = rowsFrom (portRow, nn, nx + nu, nn);
    out.outFromState    = rowsFrom (outRow, numOut, 0, nx);
    out.outFromSource   = rowsFrom (outRow, numOut, nx, nu);
    out.outFromPort     = rowsFrom (outRow, numOut, nx + nu, nn);
    return true;
}

bool DKSolver::rebuild()
{
    std::vector<std::pair<int, int>> portNodes;
    for (const auto& p : ports)
        portNodes.emplace_back (p.p, p.n);

    Projections pr;
    if (! project (nl, controlPos, &gCap, inductors, gInd, numPorts(), portNodes, probeNode, pr))
        return false;

    G = pr.portFromState; H = pr.portFromSource; K = pr.portFromPort;
    updateKColumnMax();
    D = pr.outFromState;  E = pr.outFromSource;  F = pr.outFromPort;

    // Constant-source parts of H u, Bx u and E u (all sources but the
    // input are fixed supplies), so process() only adds the input's share.
    auto split = [&] (const Matrix& m, std::vector<double>& constant, std::vector<double>& fromInput)
    {
        constant.assign ((size_t) m.rows, 0.0);
        fromInput.assign ((size_t) m.rows, 0.0);
        for (int r = 0; r < m.rows; ++r)
            for (int c = 0; c < m.cols; ++c)
                (c == inputIndex ? fromInput[(size_t) r] : constant[(size_t) r]) +=
                    m (r, c) * (c == inputIndex ? 1.0 : nl.sources[(size_t) c].value);
    };
    split (H, hConst, hIn);

    // Trapezoidal state update: x' = 2 Gc v_C - x, with v_C = A x + B u - C i.
    const int nx = numStates();
    Ax = pr.stateFromState;
    Bx = pr.stateFromSource;
    Cx = pr.stateFromPort;
    // A capacitor's state x (the companion's current source, injected
    // into its first node) updates as x' = 2 Gc v - x. An inductor's,
    // y = -(i + Gl v) injected the same way, as y' = y - 2 Gl v.
    // Coupled windings: y' = y - 2 gInd v over all of them.
    const int ni = (int) inductors.size();
    auto updateRows = [&] (Matrix& m)
    {
        const Matrix v = m; // branch-voltage rows, before scaling
        for (int r = 0; r < nx; ++r)
            if (! nl.capacitors[(size_t) r].inductor)
                for (int c = 0; c < m.cols; ++c) m (r, c) = 2.0 * gCap[(size_t) r] * v (r, c);
        for (int i = 0; i < ni; ++i)
        {
            const int r = inductors[(size_t) i];
            for (int c = 0; c < m.cols; ++c)
            {
                double s = 0.0;
                for (int j = 0; j < ni; ++j)
                    s += gInd (i, j) * v (inductors[(size_t) j], c);
                m (r, c) = -2.0 * s;
            }
        }
    };
    updateRows (Ax);
    updateRows (Bx);
    updateRows (Cx);
    for (int r = 0; r < nx; ++r)
        Ax (r, r) += nl.capacitors[(size_t) r].inductor ? 1.0 : -1.0;
    split (Bx, bConst, bIn);
    {
        std::vector<double> ec, ei;
        split (E, ec, ei);
        eConst = ec[0];
        eIn = ei[0];
        probeConst = ec.size() > 1 ? ec[1] : 0.0;
        probeIn = ei.size() > 1 ? ei[1] : 0.0;
    }
    sG.build (G);
    sD.build (D);
    sF.build (F, &currentPorts);
    sAx.build (Ax);
    sCx.build (Cx, &currentPorts);
    return true;
}

void DKSolver::evalDevices (const double* v)
{
    // jb[k*2 + o] = d i_k / d v_(first port of k's device + o). Junction
    // GMIN is in the currents but left out of the Jacobian: it only has to
    // keep the circuit defined, and it would make every column non-zero.
    for (size_t di = 0; di < devices.size(); ++di)
    {
        const auto& d = devices[di];
        const int k = d.port;
        if (dormant[di])
        {
            in[(size_t) k] = -d.is; // exact to ~1e-6 Is at dormantDepth
            continue;
        }
        if (d.kind == Device::diode)
        {
            const double e = safeExp (v[k] / d.nvt);
            in[(size_t) k] = d.is * (e - 1.0) + junctionGmin * v[k];
            jb[(size_t) (k * 2)] = d.is * e / d.nvt;
            continue;
        }

        if (d.kind == Device::jfet)
        {
            // Shichman-Hodges, symmetric: for Vds < 0 drain and source swap,
            // so the gate is measured from the drain (Vgd = Vgs - Vds).
            const double s = d.sign;
            const double vgs = s * v[k], vds = s * v[k + 1];
            const bool inverse = vds < 0.0;
            const double vd = inverse ? -vds : vds;
            const double vgst = (inverse ? vgs - vds : vgs) - d.vto;
            double id = 0.0, gm = 0.0, gds = 0.0; // dId/dVgst, dId/dVd (normal orientation)
            if (vgst > 0.0)
            {
                const double lam = 1.0 + d.lambda * vd;
                if (vd < vgst) // linear region
                {
                    id = d.beta * vd * (2.0 * vgst - vd) * lam;
                    gm = 2.0 * d.beta * vd * lam;
                    gds = d.beta * (2.0 * vgst - 2.0 * vd) * lam + d.beta * vd * (2.0 * vgst - vd) * d.lambda;
                }
                else // saturation
                {
                    id = d.beta * vgst * vgst * lam;
                    gm = 2.0 * d.beta * vgst * lam;
                    gds = d.beta * vgst * vgst * d.lambda;
                }
            }
            // Back to (Vgs, Vds): inverse mode has I = -id(Vgs - Vds, -Vds).
            double dIdVgs = gm, dIdVds = gds;
            if (inverse)
            {
                id = -id;
                dIdVgs = -gm;
                dIdVds = gm + gds;
            }
            in[(size_t) k] = 0.0; // the gate draws nothing here
            in[(size_t) k + 1] = s * id + junctionGmin * v[k + 1];
            jb[(size_t) (k * 2)] = jb[(size_t) (k * 2 + 1)] = 0.0;
            jb[(size_t) ((k + 1) * 2)] = dIdVgs;
            jb[(size_t) ((k + 1) * 2 + 1)] = dIdVds;
            continue;
        }

        if (d.kind == Device::triode)
        {
            // Koren: E1 = Vpk/KP * softplus(KP (1/MU + Vgk / sqrt(KVB + Vpk^2)))
            const double vgk = v[k], vpk = v[k + 1];
            const double sq = std::sqrt (d.kvb + vpk * vpk);
            const double a = d.kp * (1.0 / d.mu + vgk / sq);
            const double sp = a > 30.0 ? a : std::log1p (std::exp (a));
            const double sig = 1.0 / (1.0 + std::exp (-a));
            const double e1 = vpk / d.kp * sp;
            double ip = 0.0, dIdE = 0.0;
            if (e1 > 0.0)
            {
                ip = std::pow (e1, d.ex) / d.kg1;
                dIdE = d.ex * ip / e1;
            }
            const double dEdVgk = vpk * sig / sq;
            const double dEdVpk = sp / d.kp - sig * vgk * vpk * vpk / (sq * sq * sq);
            in[(size_t) k] = 0.0;                      // the grid draws nothing here
            in[(size_t) k + 1] = ip + junctionGmin * vpk;
            jb[(size_t) (k * 2)] = jb[(size_t) (k * 2 + 1)] = 0.0;
            jb[(size_t) ((k + 1) * 2)] = dIdE * dEdVgk;
            jb[(size_t) ((k + 1) * 2 + 1)] = dIdE * dEdVpk;
            continue;
        }

        // Ebers-Moll (= SPICE Gummel-Poon with default parameters).
        // Ports: k = B-E, k+1 = B-C; PNP evaluates the mirrored junctions.
        const double s = d.sign;
        const double vbe = s * v[k], vbc = s * v[k + 1];
        const double eF = safeExp (vbe / d.nvt), eR = safeExp (vbc / d.nvt);
        const double ic = d.is * (eF - eR) - d.is / d.br * (eR - 1.0);
        const double ib = d.is / d.bf * (eF - 1.0) + d.is / d.br * (eR - 1.0);
        const double dicdbe = d.is * eF / d.nvt;
        const double dicdbc = -d.is * eR / d.nvt - d.is / d.br * eR / d.nvt;
        const double dibdbe = d.is / d.bf * eF / d.nvt;
        const double dibdbc = d.is / d.br * eR / d.nvt;

        // Port currents (B->E branch, B->C branch): i1 = ib + ic, i2 = -ic.
        in[(size_t) k]     = s * (ib + ic) + junctionGmin * v[k];
        in[(size_t) k + 1] = s * -ic + junctionGmin * v[k + 1];
        jb[(size_t) (k * 2)]           = dibdbe + dicdbe;
        jb[(size_t) (k * 2 + 1)]       = dibdbc + dicdbc;
        jb[(size_t) ((k + 1) * 2)]     = -dicdbe;
        jb[(size_t) ((k + 1) * 2 + 1)] = -dicdbc;
    }
}

// J = dI/dV over the active devices as a sum of rank-1 terms u w^T, each
// on one device's ports. A device block whose row or column is zero (a
// triode's grid row; a reverse-biased junction's column, to within
// jacobianFloor) needs one term, a fully conducting transistor two.
int DKSolver::factorJacobian()
{
    // Conductances below this (siemens) are left out of the Newton step:
    // against port impedances of at most ~10 Mohm they move nothing.
    constexpr double jacobianFloor = 1e-12;
    int t = 0;
    auto term = [&] (int port, int size, double u0, double u1, double w0, double w1)
    {
        termPort[(size_t) t] = port;
        termSize[(size_t) t] = size;
        termU[(size_t) (t * 2)] = u0; termU[(size_t) (t * 2 + 1)] = u1;
        termW[(size_t) (t * 2)] = w0; termW[(size_t) (t * 2 + 1)] = w1;
        ++t;
    };
    for (size_t di = 0; di < devices.size(); ++di)
    {
        if (dormant[di])
            continue;
        const int k = devices[di].port;
        const double* j = &jb[(size_t) (k * 2)];
        if (devices[di].kind == Device::diode)
        {
            if (j[0] > jacobianFloor)
                term (k, 1, 1.0, 0.0, j[0], 0.0);
            continue;
        }
        // 2x2 block [j0 j1; j2 j3] (rows: ports k, k+1; columns likewise).
        const bool row0 = std::abs (j[0]) > jacobianFloor || std::abs (j[1]) > jacobianFloor;
        const bool row1 = std::abs (j[2]) > jacobianFloor || std::abs (j[3]) > jacobianFloor;
        const bool col0 = std::abs (j[0]) > jacobianFloor || std::abs (j[2]) > jacobianFloor;
        const bool col1 = std::abs (j[1]) > jacobianFloor || std::abs (j[3]) > jacobianFloor;
        if (! row0 && row1)      term (k, 2, 0.0, 1.0, j[2], j[3]); // triode: only Ip
        else if (row0 && ! row1) term (k, 2, 1.0, 0.0, j[0], j[1]);
        else if (! col1 && col0) term (k, 2, j[0], j[2], 1.0, 0.0); // B-C reverse biased
        else if (! col0 && col1) term (k, 2, j[1], j[3], 0.0, 1.0);
        else if (col0)
        {
            term (k, 2, j[0], j[2], 1.0, 0.0);
            term (k, 2, j[1], j[3], 0.0, 1.0);
        }
    }
    return t;
}

// Bound on the residual a Newton step dv leaves behind: each port current
// misses its linear prediction by ~ i'' dv^2 / 2, and a current error moves
// any port voltage by at most kColumnMax times it. Junctions: i'' = i' / nVt
// per exponential. Triodes: Ip's curvature is at most i' over
// sqrt(KVB + Vpk^2) / (KP EX) volts on the grid (below cutoff Ip is an
// exponential of that scale; above it a gentler power law), and over Vpk
// on the plate (EX < 2).
double DKSolver::stepResidualBound() const
{
    double bound = 0.0;
    for (size_t di = 0; di < devices.size(); ++di)
    {
        if (dormant[di])
            continue;
        const auto& d = devices[di];
        const int k = d.port;
        const double* j = &jb[(size_t) (k * 2)];
        if (d.kind == Device::diode)
        {
            const double e = dv[(size_t) k];
            bound += kColumnMax[(size_t) k] * 0.5 * std::abs (j[0]) * e * e / d.nvt;
        }
        else if (d.kind == Device::bjt)
        {
            const double e0 = dv[(size_t) k] * dv[(size_t) k], e1 = dv[(size_t) k + 1] * dv[(size_t) k + 1];
            bound += kColumnMax[(size_t) k] * 0.5 * (std::abs (j[0]) * e0 + std::abs (j[1]) * e1) / d.nvt
                   + kColumnMax[(size_t) k + 1] * 0.5 * (std::abs (j[2]) * e0 + std::abs (j[3]) * e1) / d.nvt;
        }
        else if (d.kind == Device::jfet)
        {
            // Id is quadratic in (Vgs, Vds), second derivatives at most
            // 2 BETA each (times 1 + LAMBDA |Vds|, plus LAMBDA's own terms).
            const double e = std::abs (dv[(size_t) k]) + std::abs (dv[(size_t) k + 1]);
            const double c = d.beta * (1.0 + d.lambda * (std::abs (vn[(size_t) k + 1]) + 4.0 * std::abs (d.vto)));
            bound += kColumnMax[(size_t) k + 1] * c * e * e;
        }
        else
        {
            const double vpk = std::max (std::abs (vn[(size_t) k + 1]), 1.0);
            const double gridScale = std::sqrt (d.kvb + vpk * vpk) / (d.kp * std::max (d.ex, 1.0));
            const double eg = dv[(size_t) k], ep = dv[(size_t) k + 1];
            bound += kColumnMax[(size_t) k + 1] * 0.5 * (std::abs (j[2]) * eg * eg / gridScale + std::abs (j[3]) * ep * ep / vpk);
        }
    }
    return bound;
}

void DKSolver::SparseRows::build (const Matrix& m, const std::vector<int>* cols)
{
    start.assign (1, 0);
    col.clear();
    val.clear();
    for (int r = 0; r < m.rows; ++r)
    {
        double largest = 0.0;
        for (int c = 0; c < m.cols; ++c)
            largest = std::max (largest, std::abs (m (r, c)));
        auto keep = [&] (int c)
        {
            const double v = m (r, c);
            if (v != 0.0 && std::abs (v) > 1e-15 * largest)
            {
                col.push_back (c);
                val.push_back (v);
            }
        };
        if (cols != nullptr)
            for (const int c : *cols) keep (c);
        else
            for (int c = 0; c < m.cols; ++c) keep (c);
        start.push_back ((int) col.size());
    }
}

void DKSolver::updateKColumnMax()
{
    sK.build (K, &currentPorts);
    const int nn = numPorts();
    kColumnMax.assign ((size_t) nn, 0.0);
    for (int r = 0; r < nn; ++r)
        for (int c = 0; c < nn; ++c)
            kColumnMax[(size_t) c] = std::max (kColumnMax[(size_t) c], std::abs (K (r, c)));
}

// Newton on v = p - K i(v), from the current vn (warm start), over the
// active ports only. Dormant diodes (hard reverse bias, see process())
// carry their constant saturation current -Is: they enter the active
// ports' equations through K but are not solved. Returns false if Newton
// failed; sets `woke` if a dormant diode turned out not to be dormant
// (the caller re-solves with it active).
bool DKSolver::solvePorts (const double* p, int maxIter, bool countStats, bool& woke)
{
    const int nn = numPorts();
    woke = false;
    if (nn == 0)
        return true;

    int na = 0;
    for (int k = 0; k < nn; ++k)
        if (! dormant[(size_t) portDevice[(size_t) k]])
            act[(size_t) na++] = k;
    if (countStats)
        stats.activePorts += na;

    // K times the port currents (tube grids carry none).
    auto kTimesI = [this] (int r) { return sK.dot (r, in.data()); };

    // Dormant diodes' voltages follow from the solution; if one has come
    // out of hard reverse bias its constant-current stand-in is no longer
    // exact, so wake it and let the caller re-solve.
    auto converged = [&] (int steps)
    {
        for (size_t d = 0; d < devices.size(); ++d)
        {
            if (! dormant[d])
                continue;
            const int k = devices[d].port;
            const double v = p[k] - kTimesI (k);
            vn[(size_t) k] = v;
            if (v > -dormantDepth * devices[d].nvt)
            {
                // Its linear prediction can be volts into forward bias;
                // start the re-solve no further than where limiting begins.
                vn[(size_t) k] = std::min (v, ports[(size_t) k].vcrit);
                dormant[d] = 0;
                woke = true;
            }
        }
        if (countStats)
        {
            stats.maxIterations = std::max (stats.maxIterations, steps);
            stats.totalIterations += steps; // Newton steps actually taken
        }
        return true;
    };

    for (int it = 1; it <= maxIter; ++it)
    {
        evalDevices (vn.data());

        // Residual first: if the circuit's equations already balance at
        // these voltages (often true straight from the extrapolated warm
        // start, and almost always after one step), we're done without
        // building or solving the Newton system at all.
        double maxResidual = 0.0;
        for (int ai = 0; ai < na; ++ai)
        {
            const int r = act[(size_t) ai];
            rhs[(size_t) r] = p[r] - kTimesI (r) - vn[(size_t) r];
            maxResidual = std::max (maxResidual, std::abs (rhs[(size_t) r]));
        }

        if (maxResidual < newtonTolerance)
            return converged (it - 1);

        // Step: (I + K J) dv = r with J = U W^T (rank m), by Woodbury:
        //   dv = r - (K U) y,   (I + W^T K U) y = W^T r.
        const int m = factorJacobian();
        if (countStats)
            stats.rank += m;
        for (int ai = 0; ai < na; ++ai)
        {
            const int r = act[(size_t) ai];
            double* kur = &ku[(size_t) (r * nn)];
            for (int t = 0; t < m; ++t)
            {
                const int j0 = termPort[(size_t) t];
                double v = K (r, j0) * termU[(size_t) (t * 2)];
                if (termSize[(size_t) t] == 2)
                    v += K (r, j0 + 1) * termU[(size_t) (t * 2 + 1)];
                kur[t] = v;
            }
        }
        for (int t1 = 0; t1 < m; ++t1)
        {
            const int j0 = termPort[(size_t) t1];
            const double w0 = termW[(size_t) (t1 * 2)], w1 = termW[(size_t) (t1 * 2 + 1)];
            const bool two = termSize[(size_t) t1] == 2;
            const double* ku0 = &ku[(size_t) (j0 * nn)];
            const double* ku1 = two ? &ku[(size_t) ((j0 + 1) * nn)] : ku0;
            for (int t2 = 0; t2 < m; ++t2)
                small[(size_t) (t1 * m + t2)] = (t1 == t2 ? 1.0 : 0.0) + w0 * ku0[t2] + (two ? w1 * ku1[t2] : 0.0);
            smallRhs[(size_t) t1] = w0 * rhs[(size_t) j0] + (two ? w1 * rhs[(size_t) j0 + 1] : 0.0);
        }
        if (m > 0 && ! solveSmall (small.data(), smallRhs.data(), m))
            break;

        bool limited = false, beyondCritical = false;
        for (int ai = 0; ai < na; ++ai)
        {
            const int k = act[(size_t) ai];
            const double* kur = &ku[(size_t) (k * nn)];
            double step = rhs[(size_t) k];
            for (int t = 0; t < m; ++t)
                step -= kur[t] * smallRhs[(size_t) t];
            const auto& port = ports[(size_t) k];
            const double vold = vn[(size_t) k];
            double vnew = vold + step;
            if (port.junction)
                vnew = port.sign * pnjlim (port.sign * vnew, port.sign * vold, port.vt, port.vcrit);
            else // tube: no exponential to tame, just keep big jumps sane
                vnew = vold + std::clamp (vnew - vold, -tubeMaxStep, tubeMaxStep);
            limited |= vnew != vold + step;
            beyondCritical |= port.junction && port.sign * vnew > port.vcrit;
            dv[(size_t) k] = vnew - vold;
            vn[(size_t) k] = vnew;
        }

        // After an unlimited Newton step the residual is second order in
        // it. When that is provably below the tolerance, move the currents
        // along the Jacobian instead of re-evaluating every device just to
        // confirm. Only on the first step from the warm start, and with every
        // junction short of vcrit: past it (or after limiting) exponentials
        // may be clamped or so steep that the step's own rounding outweighs
        // the bound.
        if (it == 1 && ! limited && ! beyondCritical && stepResidualBound() < newtonTolerance)
        {
            for (int ai = 0; ai < na; ++ai)
            {
                const int k = act[(size_t) ai];
                const int b = blockStart[(size_t) k];
                double di = jb[(size_t) (k * 2)] * dv[(size_t) b];
                if (blockSize[(size_t) k] == 2)
                    di += jb[(size_t) (k * 2 + 1)] * dv[(size_t) b + 1];
                in[(size_t) k] += di;
            }
            return converged (it);
        }
    }

    evalDevices (vn.data());
    if (countStats)
    {
        ++stats.newtonFailures;
        stats.maxIterations = maxIter;
        stats.totalIterations += maxIter;
    }
    return false;
}

bool DKSolver::solveOperatingPoint()
{
    // DC: capacitors open. Ramp the supplies up (source stepping) so the
    // Newton solve never starts far from a solution.
    std::vector<std::pair<int, int>> portNodes;
    for (const auto& p : ports)
        portNodes.emplace_back (p.p, p.n);
    Projections dc;
    if (! project (nl, controlPos, nullptr, inductors, gInd, numPorts(), portNodes, -1, dc))
        return false;

    const int nn = numPorts(), nu = (int) u.size(), nx = numStates();
    std::fill (vn.begin(), vn.end(), 0.0);
    std::fill (dormant.begin(), dormant.end(), 0);
    std::vector<double> uDc (u.size());

    auto savedK = K;
    K = dc.portFromPort;
    updateKColumnMax();
    bool ok = true;
    constexpr int steps = 20;
    for (int s = 1; s <= steps && ok; ++s)
    {
        const double lambda = (double) s / steps;
        for (int k = 0; k < nu; ++k)
            uDc[(size_t) k] = k == inputIndex ? 0.0 : lambda * nl.sources[(size_t) k].value;
        for (int r = 0; r < nn; ++r)
        {
            double v = 0.0;
            for (int c = 0; c < nu; ++c)
                v += dc.portFromSource (r, c) * uDc[(size_t) c];
            pBuf[(size_t) r] = v;
        }
        bool woke = false;
        ok = solvePorts (pBuf.data(), 200, false, woke);
    }
    K = savedK;
    updateKColumnMax();
    if (! ok)
        return false;
    vnPrev = vn;
    // Start the transistors' running averages at their bias currents.
    for (size_t d = 0; d < devices.size(); ++d)
        if (devices[d].kind == Device::bjt)
            icAverage[d] = -devices[d].sign * in[(size_t) devices[d].port + 1];
        else if (devices[d].kind == Device::triode || devices[d].kind == Device::jfet)
            icAverage[d] = devices[d].sign * in[(size_t) devices[d].port + 1];

    // DC voltages -> trapezoidal states. A capacitor carries no current:
    // x = Gc v. An inductor carries what its DC short does, i = Gdc v:
    // y = -(i + Gl v).
    std::vector<double> vDc ((size_t) nx, 0.0);
    for (int r = 0; r < nx; ++r)
    {
        double v = 0.0;
        for (int c = 0; c < nu; ++c)
            v += dc.stateFromSource (r, c) * uDc[(size_t) c];
        for (int c = 0; c < nn; ++c)
            v -= dc.stateFromPort (r, c) * in[(size_t) c];
        vDc[(size_t) r] = v;
        if (! nl.capacitors[(size_t) r].inductor)
            x[(size_t) r] = gCap[(size_t) r] * v;
    }
    for (size_t i = 0; i < inductors.size(); ++i)
    {
        const int r = inductors[i];
        double gv = 0.0; // the companion's current for these voltages
        for (size_t j = 0; j < inductors.size(); ++j)
            gv += gInd ((int) i, (int) j) * vDc[(size_t) inductors[j]];
        x[(size_t) r] = -(inductorDcConductance * vDc[(size_t) r] + gv);
    }
    return true;
}

void DKSolver::setProbe (int node)
{
    if (node == probeNode)
        return;
    probeNode = node >= 0 && node < (int) nl.nodes.size() ? node : -1;
    probe = 0.0;
    rebuild();
}

void DKSolver::takeActivity (float* out)
{
    for (size_t d = 0; d < devices.size(); ++d)
    {
        out[d] = (float) activity[d];
        activity[d] = 0.0;
    }
}

double DKSolver::process (double input)
{
    const int nn = numPorts(), nx = numStates();
    u[(size_t) inputIndex] = input;
    const double* xs = x.data();

    // p = G x + H u. Every source but the guitar input is a constant
    // supply, so H u = hConst + hIn * input (refreshed in rebuild()).
    for (int r = 0; r < nn; ++r)
        pBuf[(size_t) r] = hConst[(size_t) r] + hIn[(size_t) r] * input + sG.dot (r, xs);

    // Warm start: extrapolate the port voltages linearly from the last two
    // samples (a better first guess than holding the last value), limited
    // like a Newton step: after a big jump, extrapolating a junction can
    // land it volts into forward bias, where its exponential overflows.
    for (int k = 0; k < nn; ++k)
    {
        const double prev = vn[(size_t) k];
        const auto& port = ports[(size_t) k];
        double guess = 2.0 * prev - vnPrev[(size_t) k];
        if (port.junction)
            guess = port.sign * pnjlim (port.sign * guess, port.sign * prev, port.vt, port.vcrit);
        else
            guess = prev + std::clamp (guess - prev, -tubeMaxStep, tubeMaxStep);
        vn[(size_t) k] = guess;
        vnPrev[(size_t) k] = prev;
    }
    // Diodes predicted to sit in hard reverse bias (with a margin, so they
    // don't flicker in and out) skip the Newton solve this sample.
    for (size_t d = 0; d < devices.size(); ++d)
        if (devices[d].kind == Device::diode)
            dormant[d] = vn[(size_t) devices[d].port] < -(dormantDepth + 4.0) * devices[d].nvt ? 1 : 0;

    const long long stepsBefore = stats.totalIterations;
    bool woke = false;
    for (int attempt = 0; attempt < 4; ++attempt)
    {
        if (! solvePorts (pBuf.data(), maxNewtonIterations, true, woke))
        {
            // Retry from the plain previous value, all ports active,
            // before giving up on the sample.
            for (int k = 0; k < nn; ++k)
                vn[(size_t) k] = vnPrev[(size_t) k];
            std::fill (dormant.begin(), dormant.end(), 0);
            --stats.newtonFailures;
            solvePorts (pBuf.data(), maxNewtonIterations, true, woke);
            break;
        }
        if (! woke)
            break;
        ++stats.wakes;
    }
    ++stats.samples;
    ++stats.stepsHistogram[std::min<long long> (stats.totalIterations - stepsBefore, maxNewtonIterations)];

    // Activity for the circuit view (cheap: a compare per device).
    for (size_t d = 0; d < devices.size(); ++d)
    {
        const auto& dev = devices[d];
        if (dev.kind == Device::diode)
            activity[d] = std::max (activity[d], std::abs (in[(size_t) dev.port]));
        else
        {
            const double ic = dev.kind == Device::bjt ? -dev.sign * in[(size_t) dev.port + 1]
                                                      : dev.sign * in[(size_t) dev.port + 1];
            icAverage[d] += (ic - icAverage[d]) * averageCoef;
            const double swing = std::abs (ic - icAverage[d]) / std::max (std::abs (icAverage[d]), 1e-9);
            activity[d] = std::max (activity[d], swing);
        }
    }

    const double* is = in.data();
    double y = eConst + eIn * input;
    y += sD.dot (0, xs) - sF.dot (0, is);
    if (probeNode >= 0)
        probe = probeConst + probeIn * input + sD.dot (1, xs) - sF.dot (1, is);

    double* xn = xNext.data();
    for (int r = 0; r < nx; ++r)
        xn[r] = bConst[(size_t) r] + bIn[(size_t) r] * input + sAx.dot (r, xs) - sCx.dot (r, is);
    std::swap (x, xNext);
    return y;
}

} // namespace phreak::circuit
