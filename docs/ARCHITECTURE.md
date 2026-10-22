# How PhreakGuitar works

PhreakGuitar is a guitar rig that runs in the browser: pedals, amps, cab
and effects, with the analog parts simulated as circuits rather than
approximated by curves. One C++ engine builds natively (tests, a desktop
plugin, an offline render tool) and to WebAssembly (the browser).

```
 interface in ─► getUserMedia (no echo cancel / noise suppression / AGC)
              ─► AudioWorklet "pre" (WASM): gate → compressor → pedals 1-4 → amp
              ─► ConvolverNode (cab impulse response)
              ─► AudioWorklet "post" (WASM): EQ → delay → reverb → output level
                                              → looper → limiter ─► interface out
 main thread: UI, presets, tabs (alphaTab), pedal designer, meters
```

## Repository

```
engine/            C++20 DSP core, no framework dependencies
  circuit/         netlist parser, DK-method solver, Pedal (oversampling, knobs, guards)
  amp/             CircuitAmp (preamp circuit + power section), PowerAmp, PowerSupply,
                   AmpChain (the whole rig), the built-in tweed stages
  fx/              compressor, EQ, delay, reverb, photo vibe, looper
  dsp/             oversampler, filters, dynamics, smoothing
  wasm/api.cpp     the C API the browser calls
amps/, pedals/     the factory circuits: SPICE netlists (see below)
web/               Vite + TypeScript app; web/src/worklet/ is the AudioWorklet
src/plugin/        JUCE plugin, a thin host around engine/
tests/             Catch2 unit tests and golden WAVs
tools/             render tool, ngspice comparison, drawing checker, IR synthesis
docs/              this file, the roadmap
```

## Circuits as files

Every amp preamp and every analog pedal is a SPICE netlist that ngspice runs
unchanged. PhreakGuitar-specific metadata lives in comment directives that
ngspice ignores:

```
*@pedal name="Round Fuzz" oversample=4
*@control fuzz label="Fuzz" taper=lin default=0.8
*@input Vin          the voltage source the guitar drives (1.0 = 1 V)
*@output out         the node the pedal's output is read from
*@sch ...            the schematic drawing (coordinates, symbols, wires)
```

Amps add `*@amp`, `*@power` (the output stage and power supply),
`*@reverb` and `*@tremolo`. Elements: R, C, L, K (coupled inductors:
transformers), V (DC), E (VCVS: op-amp macromodels), D, Q (NPN/PNP), J
(N/P JFET), subcircuits, and three built-ins: `POT` (with lin / audio /
reverse-audio tapers), `SW` (multi-way switches) and `TRIODE` (Koren model).

Because the browser engine reads the same file ngspice does,
`tools/spice_check.py` can render a pedal through both and report the
difference; `tools/run_checks.sh` does that for every factory circuit at
several settings (budgets are -60 dB for most; a few high-gain cascades are
limited by discretisation and say so).

## The solver

`engine/circuit/DKSolver` implements the nodal DK method (Yeh, Abel and
Smith): modified nodal analysis of the linear network, with capacitors and
inductors as trapezoidal companions, reduced to a state-space system whose
only unknowns each sample are the voltages at the nonlinear devices' ports
(diode junctions, transistor B-E / B-C, JFET gate/drain, triode grid/plate).

- **Newton per sample**, warm-started by extrapolating the last two
  samples, junction steps limited (SPICE's pnjlim), triode steps clamped.
- **Woodbury low-rank updates**: the Jacobian is a sum of rank-1 terms per
  conducting device, so each Newton step solves a small dense system the size
  of the active devices, not the whole circuit.
- **Dormant diodes**: a diode predicted to stay in deep reverse bias skips
  the solve (its current is constant to 1e-6 of its saturation current);
  it wakes if the solution says otherwise.
- **First-step acceptance**: after one unlimited Newton step from the warm
  start, the residual is bounded analytically; if the bound is under the
  tolerance the step is accepted without re-evaluating the devices.
- **Sparse products**: the per-sample matrix-vector products skip the exact
  zeros (most of every matrix).
- **Knobs** re-project the matrices (`setControls`); knob changes glide over
  20 ms in short sub-blocks so a jump never steps the circuit.
- **Guards**: a non-finite or runaway output re-biases the circuit and drops
  the block; counters show in the UI.
- **Probes**: any node can be read as a second output row (the designer's
  scope).

The engine is compiled with `-ffp-contract=off` so native and WASM results
match bit-for-bit in practice; `run_checks.sh` compares them.

## Amps

`CircuitAmp` solves the preamp (gain stages, tone stack, phase-inverter
drive) as a circuit and runs a behavioural power section after it:
`PowerAmp` (push-pull output stage, negative feedback and presence, output
transformer band limits, speaker interaction) whose headroom follows a
simulated `PowerSupply` (rectifier, reservoir capacitor, current draw: B+
sags and recovers from the amp's own parts). The Response knob scales the
supply's source resistance. Spring reverb and optical tremolo are optional
blocks an amp file can declare.

## The browser

- The engine runs in two AudioWorklets (before and after the cab
  convolver), 128-sample render quanta, messages by `postMessage`.
- Loading a pedal or amp builds and biases its circuit on the audio thread
  (milliseconds); replacing a pedal crossfades from the old one over 20 ms.
- Settings, presets, your pedals (as netlists) and tab state live in
  `localStorage`; loaded IRs and tab files in IndexedDB. Nothing leaves the
  browser.
- The pedal designer edits a pedal's netlist directly (parts list, models,
  added parts drawn on the schematic) and re-solves it as you play.
- Tabs: alphaTab renders and plays Guitar Pro / MusicXML files you open.

## Checks

```
cmake -B build && cmake --build build      # native engine, tests, render tool, plugin
ctest --test-dir build                     # unit tests (solver, devices, effects, looper)
tools/run_checks.sh                        # golden renders, aliasing, every circuit vs ngspice,
                                           # drawings vs netlists, WASM vs native
```
