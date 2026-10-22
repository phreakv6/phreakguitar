#include "Netlist.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <map>

namespace phreak::circuit
{

namespace
{

std::string lower (std::string_view s)
{
    std::string r (s);
    for (auto& c : r)
        c = (char) std::tolower ((unsigned char) c);
    return r;
}

// Splits on whitespace, keeping "quoted strings" and "(...)" groups intact.
std::vector<std::string> tokenize (std::string_view line)
{
    std::vector<std::string> t;
    size_t i = 0;
    while (i < line.size())
    {
        while (i < line.size() && std::isspace ((unsigned char) line[i]))
            ++i;
        if (i >= line.size())
            break;
        std::string tok;
        while (i < line.size() && ! std::isspace ((unsigned char) line[i]))
        {
            if (line[i] == '"')
            {
                const auto end = line.find ('"', i + 1);
                tok += line.substr (i, (end == std::string_view::npos ? line.size() : end + 1) - i);
                i = end == std::string_view::npos ? line.size() : end + 1;
            }
            else
                tok += line[i++];
        }
        t.push_back (tok);
    }
    return t;
}

// key=value pairs (case-insensitive keys), from tokens or "(IS=1n N=2)".
std::map<std::string, std::string> keyValues (const std::vector<std::string>& toks, size_t from)
{
    std::string joined;
    for (size_t i = from; i < toks.size(); ++i)
        joined += toks[i] + " ";
    for (auto& c : joined)
        if (c == '(' || c == ')' || c == ',')
            c = ' ';
    // "IS = 1n" -> "IS=1n"
    std::string compact;
    for (size_t i = 0; i < joined.size(); ++i)
    {
        if (joined[i] == ' ')
        {
            size_t j = i;
            while (j < joined.size() && joined[j] == ' ')
                ++j;
            const bool nextEq = j < joined.size() && joined[j] == '=';
            const bool prevEq = ! compact.empty() && compact.back() == '=';
            if (nextEq || prevEq)
            {
                i = j - 1;
                continue;
            }
        }
        compact += joined[i];
    }

    std::map<std::string, std::string> kv;
    for (const auto& tok : tokenize (compact))
    {
        const auto eq = tok.find ('=');
        if (eq == std::string::npos)
            continue;
        auto v = tok.substr (eq + 1);
        if (v.size() >= 2 && v.front() == '"' && v.back() == '"')
            v = v.substr (1, v.size() - 2);
        kv[lower (tok.substr (0, eq))] = v;
    }
    return kv;
}

std::string upper (std::string_view s)
{
    std::string r (s);
    for (auto& c : r)
        c = (char) std::toupper ((unsigned char) c);
    return r;
}

struct Builder
{
    Netlist& nl;
    std::map<std::string, int> nodeIds;
    std::map<std::string, DiodeModel> diodeModels;
    std::map<std::string, BjtModel> bjtModels;
    std::map<std::string, JfetModel> jfetModels;

    int node (const std::string& name)
    {
        const auto key = lower (name);
        if (key == "0" || key == "gnd")
            return -1;
        if (auto it = nodeIds.find (key); it != nodeIds.end())
            return it->second;
        const int id = (int) nl.nodes.size();
        nl.nodes.push_back (name);
        nodeIds[key] = id;
        return id;
    }
};

} // namespace

double applyTaper (Taper t, double k)
{
    k = std::clamp (k, 0.0, 1.0);
    if (t == Taper::audio)
        return (std::exp (3.4 * k) - 1.0) / (std::exp (3.4) - 1.0);
    if (t == Taper::reverseAudio)
        return 1.0 - applyTaper (Taper::audio, 1.0 - k);
    return k;
}

bool parseValue (std::string_view s, double& v)
{
    std::string str (s);
    if (! str.empty() && str.front() == '{')
        return false;
    char* end = nullptr;
    v = std::strtod (str.c_str(), &end);
    if (end == str.c_str())
        return false;
    const auto suffix = lower (end);
    if (suffix.rfind ("meg", 0) == 0)      v *= 1e6;
    else if (suffix.rfind ("mil", 0) == 0) v *= 25.4e-6;
    else if (! suffix.empty())
        switch (suffix[0])
        {
            case 't': v *= 1e12; break;
            case 'g': v *= 1e9; break;
            case 'k': v *= 1e3; break;
            case 'm': v *= 1e-3; break;
            case 'u': v *= 1e-6; break;
            case 'n': v *= 1e-9; break;
            case 'p': v *= 1e-12; break;
            case 'f': v *= 1e-15; break;
            default: break; // unit letters (ohm, F, V) are ignored, as in SPICE
        }
    return std::isfinite (v);
}

bool parseNetlist (std::string_view text, Netlist& out, std::string& error)
{
    out = {};
    Builder b { out, {}, {}, {}, {} };

    // Join '+' continuation lines, remembering original line numbers.
    std::vector<std::pair<int, std::string>> lines;
    {
        int lineNo = 0;
        size_t pos = 0;
        while (pos <= text.size())
        {
            auto end = text.find ('\n', pos);
            if (end == std::string_view::npos)
                end = text.size();
            std::string line (text.substr (pos, end - pos));
            ++lineNo;
            if (! line.empty() && line.back() == '\r')
                line.pop_back();
            if (! line.empty() && line[0] == '+' && ! lines.empty())
                lines.back().second += " " + line.substr (1);
            else
                lines.emplace_back (lineNo, line);
            pos = end + 1;
        }
    }

    // Two passes: models first (they may follow the devices using them).
    struct Pending { int line; std::vector<std::string> toks; };
    struct Subckt { std::vector<std::string> ports; std::vector<Pending> body; };
    std::vector<Pending> devices;
    std::map<std::string, Subckt> subckts;
    std::string inputName, outputName;
    Subckt* inSubckt = nullptr;

    auto fail = [&] (int line, const std::string& msg)
    {
        error = "line " + std::to_string (line) + ": " + msg;
        return false;
    };

    for (const auto& [lineNo, raw] : lines)
    {
        const auto toks = tokenize (raw);
        if (toks.empty())
            continue;
        const auto head = lower (toks[0]);

        if (head.rfind ("*@", 0) == 0)
        {
            const auto directive = head.substr (2);
            const auto kv = keyValues (toks, 1);
            if (directive == "pedal" || directive == "amp")
            {
                if (kv.count ("name")) out.name = kv.at ("name");
                if (kv.count ("oversample")) out.oversampling = std::atoi (kv.at ("oversample").c_str());
                if (kv.count ("dsp")) out.dsp = lower (kv.at ("dsp"));
            }
            else if (directive == "control")
            {
                if (toks.size() < 2)
                    return fail (lineNo, "*@control needs a name");
                Control c;
                c.name = lower (toks[1]);
                c.label = kv.count ("label") ? kv.at ("label") : toks[1];
                {
                    const auto t = kv.count ("taper") ? lower (kv.at ("taper")) : std::string ("lin");
                    c.taper = t == "audio" ? Taper::audio : t == "revaudio" ? Taper::reverseAudio : Taper::linear;
                }
                if (kv.count ("default"))
                    parseValue (kv.at ("default"), c.defaultValue);
                out.controls.push_back (c);
            }
            else if (directive == "input" && toks.size() >= 2)
                inputName = lower (toks[1]);
            else if (directive == "output" && toks.size() >= 2)
                outputName = toks[1];
            continue;
        }
        if (head[0] == '*')
            continue;

        if (head == ".subckt")
        {
            if (toks.size() < 2)
                return fail (lineNo, ".subckt needs a name");
            auto& sc = subckts[lower (toks[1])];
            sc = {};
            for (size_t i = 2; i < toks.size() && toks[i].find ('=') == std::string::npos; ++i)
                sc.ports.push_back (toks[i]);
            inSubckt = &sc;
            continue;
        }
        if (head == ".ends") { inSubckt = nullptr; continue; }
        if (inSubckt != nullptr)
        {
            if (head[0] != '.')
                inSubckt->body.push_back ({ lineNo, toks });
            continue;
        }

        if (head == ".model")
        {
            if (toks.size() < 3)
                return fail (lineNo, ".model needs a name and type");
            // Type may be glued to the parameter list: "D(IS=..)".
            std::string type = lower (toks[2]);
            if (const auto paren = type.find ('('); paren != std::string::npos)
                type = type.substr (0, paren);
            const auto kv = keyValues (toks, 2);
            auto num = [&] (const char* key, double fallback)
            {
                double v = fallback;
                if (kv.count (key)) parseValue (kv.at (key), v);
                return v;
            };
            const auto name = lower (toks[1]);
            if (type == "d")
                b.diodeModels[name] = { num ("is", 1e-14), num ("n", 1.0), num ("rs", 0.0) };
            else if (type == "npn" || type == "pnp")
                b.bjtModels[name] = { type == "pnp", num ("is", 1e-16), num ("bf", 100.0), num ("br", 1.0) };
            else if (type == "njf" || type == "pjf")
                b.jfetModels[name] = { type == "pjf", num ("vto", -2.0), num ("beta", 1e-4), num ("lambda", 0.0) };
            else
                return fail (lineNo, "unsupported model type '" + type + "'");
            continue;
        }
        if (head[0] == '.')
            continue; // .param, .tran, .options, .end ... are for ngspice

        devices.push_back ({ lineNo, toks });
    }

    // Expand subcircuit instances (POT, TRIODE and SW are built in). Internal nodes and
    // element names get the instance prefix; ports map to the caller's
    // nodes; ground stays ground. Nested instances expand on later passes.
    for (int depth = 0;; ++depth)
    {
        bool expanded = false;
        std::vector<Pending> next;
        for (const auto& d : devices)
        {
            const auto& t = d.toks;
            if (std::tolower ((unsigned char) t[0][0]) != 'x' || t.size() < 2)
            {
                next.push_back (d);
                continue;
            }
            // Subckt name = last token that isn't key=value.
            size_t nameIdx = t.size() - 1;
            while (nameIdx > 1 && t[nameIdx].find ('=') != std::string::npos)
                --nameIdx;
            const auto sub = lower (t[nameIdx]);
            if (sub == "pot" || sub == "triode" || sub == "sw") // built in, not expanded
            {
                next.push_back (d);
                continue;
            }
            const auto it = subckts.find (sub);
            if (it == subckts.end())
                return fail (d.line, "unknown subcircuit '" + t[nameIdx] + "'");
            if (nameIdx - 1 != it->second.ports.size())
                return fail (d.line, "'" + t[0] + "' connects " + std::to_string (nameIdx - 1)
                                         + " nodes, " + t[nameIdx] + " has " + std::to_string (it->second.ports.size()));
            std::map<std::string, std::string> nodeMap;
            for (size_t i = 0; i < it->second.ports.size(); ++i)
                nodeMap[lower (it->second.ports[i])] = t[i + 1];
            const auto prefix = t[0] + ".";
            auto mapNode = [&] (const std::string& n)
            {
                const auto key = lower (n);
                if (key == "0" || key == "gnd") return n;
                if (auto m = nodeMap.find (key); m != nodeMap.end()) return m->second;
                return prefix + n;
            };
            for (auto line : it->second.body)
            {
                auto& bt = line.toks;
                const char k = (char) std::tolower ((unsigned char) bt[0][0]);
                // How many node tokens follow the element name.
                const size_t numNodes = k == 'q' || k == 'j' ? 3 : k == 'e' ? 4 : k == 'x' || k == 'k' ? 0 : 2;
                if (k == 'k') // the inductors it couples were renamed like any element
                    for (size_t i = 1; i <= 2 && i < bt.size(); ++i)
                        bt[i] = std::string (1, bt[i][0]) + prefix + bt[i];
                if (k == 'x')
                {
                    size_t ni = bt.size() - 1;
                    while (ni > 1 && bt[ni].find ('=') != std::string::npos)
                        --ni;
                    for (size_t i = 1; i < ni; ++i)
                        bt[i] = mapNode (bt[i]);
                }
                for (size_t i = 1; i <= numNodes && i < bt.size(); ++i)
                    bt[i] = mapNode (bt[i]);
                bt[0] = std::string (1, bt[0][0]) + prefix + bt[0];
                line.line = d.line;
                next.push_back (line);
            }
            expanded = true;
        }
        devices = std::move (next);
        if (! expanded)
            break;
        if (depth > 8)
            return fail (0, "subcircuits nested too deeply (recursive?)");
    }

    std::vector<Pending> pendingCouplings; // resolved once every inductor is known
    for (const auto& [lineNo, toks] : devices)
    {
        const char kind = (char) std::tolower ((unsigned char) toks[0][0]);
        auto needs = [&] (size_t n) { return toks.size() >= n; };
        double value = 0.0;

        switch (kind)
        {
            case 'r':
                if (! needs (4) || ! parseValue (toks[3], value) || value <= 0.0)
                    return fail (lineNo, "resistor needs two nodes and a positive value");
                out.resistors.push_back ({ b.node (toks[1]), b.node (toks[2]), value });
                break;

            case 'c':
                if (! needs (4) || ! parseValue (toks[3], value) || value <= 0.0)
                    return fail (lineNo, "capacitor needs two nodes and a positive value");
                out.capacitors.push_back ({ b.node (toks[1]), b.node (toks[2]), value, false, upper (toks[0]) });
                break;

            case 'l':
                if (! needs (4) || ! parseValue (toks[3], value) || value <= 0.0)
                    return fail (lineNo, "inductor needs two nodes and a positive value");
                out.capacitors.push_back ({ b.node (toks[1]), b.node (toks[2]), value, true, upper (toks[0]) });
                break;

            case 'k':
                if (! needs (4) || ! parseValue (toks[3], value) || value <= 0.0 || value >= 1.0)
                    return fail (lineNo, "coupling needs two inductors and 0 < k < 1");
                pendingCouplings.push_back ({ lineNo, toks });
                break;

            case 'v':
            {
                if (! needs (3))
                    return fail (lineNo, "voltage source needs two nodes");
                size_t vi = 3;
                if (toks.size() > vi && lower (toks[vi]) == "dc")
                    ++vi;
                if (toks.size() > vi)
                    parseValue (toks[vi], value);
                out.sources.push_back ({ lower (toks[0]), b.node (toks[1]), b.node (toks[2]), value });
                break;
            }

            case 'e':
            {
                if (! needs (6) || ! parseValue (toks[5], value))
                    return fail (lineNo, "E source needs out+, out-, ctrl+, ctrl- and a gain");
                out.vcvs.push_back ({ b.node (toks[1]), b.node (toks[2]), b.node (toks[3]), b.node (toks[4]), value });
                break;
            }

            case 'd':
            {
                if (! needs (4))
                    return fail (lineNo, "diode needs anode, cathode and model");
                const auto it = b.diodeModels.find (lower (toks[3]));
                if (it == b.diodeModels.end())
                    return fail (lineNo, "unknown diode model '" + toks[3] + "'");
                Diode d { b.node (toks[1]), b.node (toks[2]), it->second, upper (toks[0]) };
                if (d.m.rs > 0.0)
                {
                    // Series resistance becomes a linear resistor to an
                    // internal node, so the junction itself stays explicit.
                    const int inner = b.node (toks[0] + "#junction");
                    out.resistors.push_back ({ d.a, inner, d.m.rs });
                    d.a = inner;
                }
                out.diodes.push_back (d);
                break;
            }

            case 'q':
            {
                if (! needs (5))
                    return fail (lineNo, "transistor needs collector, base, emitter and model");
                const auto it = b.bjtModels.find (lower (toks[4]));
                if (it == b.bjtModels.end())
                    return fail (lineNo, "unknown transistor model '" + toks[4] + "'");
                out.bjts.push_back ({ b.node (toks[1]), b.node (toks[2]), b.node (toks[3]), it->second, upper (toks[0]) });
                break;
            }

            case 'j':
            {
                if (! needs (5))
                    return fail (lineNo, "JFET needs drain, gate, source and model");
                const auto it = b.jfetModels.find (lower (toks[4]));
                if (it == b.jfetModels.end())
                    return fail (lineNo, "unknown JFET model '" + toks[4] + "'");
                out.jfets.push_back ({ b.node (toks[1]), b.node (toks[2]), b.node (toks[3]), it->second, upper (toks[0]) });
                break;
            }

            case 'x':
            {
                if (needs (5) && lower (toks[4]) == "triode")
                {
                    const auto kv = keyValues (toks, 5);
                    Triode t { b.node (toks[1]), b.node (toks[2]), b.node (toks[3]) };
                    auto num = [&] (const char* key, double& v)
                    {
                        if (kv.count (key)) parseValue (kv.at (key), v);
                    };
                    num ("mu", t.mu); num ("ex", t.ex); num ("kg1", t.kg1); num ("kp", t.kp); num ("kvb", t.kvb);
                    t.name = upper (toks[0]);
                    out.triodes.push_back (t);
                    break;
                }
                if (needs (4) && lower (toks[3]) == "sw")
                {
                    // A switch throw between two nodes, closed at position k of n.
                    const auto kv = keyValues (toks, 4);
                    std::string pos = kv.count ("pos") ? lower (kv.at ("pos")) : "";
                    pos.erase (std::remove_if (pos.begin(), pos.end(), [] (char c) { return c == '{' || c == '}'; }), pos.end());
                    const auto ctl = std::find_if (out.controls.begin(), out.controls.end(),
                                                   [&] (const Control& c) { return c.name == pos; });
                    const int k = kv.count ("k") ? std::atoi (kv.at ("k").c_str()) : -1;
                    const int n = kv.count ("n") ? std::atoi (kv.at ("n").c_str()) : 0;
                    if (ctl == out.controls.end() || n < 2 || k < 0 || k >= n)
                        return fail (lineNo, "SW needs pos={control} k=<throw> n=<positions> (0 <= k < n)");
                    Resistor r { b.node (toks[1]), b.node (toks[2]), 1.0, (int) (ctl - out.controls.begin()) };
                    r.throwIndex = k;
                    r.throws = n;
                    out.resistors.push_back (r);
                    break;
                }
                if (! needs (5) || lower (toks[4]) != "pot")
                    return fail (lineNo, "unsupported subcircuit use: Xname a w b POT R=... pos={control}, Xname a b SW pos={control} k= n=, or Xname p g k TRIODE ...");
                const auto kv = keyValues (toks, 5);
                double total = 0.0;
                if (! kv.count ("r") || ! parseValue (kv.at ("r"), total) || total <= 0.0)
                    return fail (lineNo, "POT needs R=<value>");
                std::string pos = kv.count ("pos") ? lower (kv.at ("pos")) : "";
                pos.erase (std::remove_if (pos.begin(), pos.end(), [] (char c) { return c == '{' || c == '}'; }), pos.end());
                const auto ctl = std::find_if (out.controls.begin(), out.controls.end(),
                                               [&] (const Control& c) { return c.name == pos; });
                if (ctl == out.controls.end())
                    return fail (lineNo, "POT pos={" + pos + "} has no matching *@control");
                const int ci = (int) (ctl - out.controls.begin());
                const int a = b.node (toks[1]), w = b.node (toks[2]), bn = b.node (toks[3]);
                out.resistors.push_back ({ a, w, total, ci, true, total });
                out.resistors.push_back ({ w, bn, total, ci, false, total });
                break;
            }

            default:
                return fail (lineNo, "unsupported element '" + toks[0] + "'");
        }
    }

    if (! out.dsp.empty())
        return true; // a DSP pedal: controls only, no circuit to check

    for (const auto& [lineNo, toks] : pendingCouplings)
    {
        auto inductor = [&] (const std::string& name)
        {
            for (size_t i = 0; i < out.capacitors.size(); ++i)
                if (out.capacitors[i].inductor && out.capacitors[i].name == upper (name))
                    return (int) i;
            return -1;
        };
        Coupling k { inductor (toks[1]), inductor (toks[2]) };
        parseValue (toks[3], k.k);
        if (k.a < 0 || k.b < 0 || k.a == k.b)
            return fail (lineNo, toks[0] + " needs two different inductors of this circuit");
        out.couplings.push_back (k);
    }

    for (size_t i = 0; i < out.sources.size(); ++i)
        if (out.sources[i].name == inputName)
            out.inputSource = (int) i;
    if (out.inputSource < 0)
        return fail (0, "missing *@input <voltage source>");

    const auto it = b.nodeIds.find (lower (outputName));
    if (it == b.nodeIds.end())
        return fail (0, "missing or unknown *@output node");
    out.outputNode = it->second;

    if (out.oversampling != 1 && out.oversampling != 2 && out.oversampling != 4 && out.oversampling != 8)
        return fail (0, "oversample must be 1, 2, 4 or 8");
    return true;
}

} // namespace phreak::circuit
