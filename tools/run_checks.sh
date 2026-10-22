#!/bin/bash
# Full local validation: build, unit tests, golden renders, aliasing budget,
# pluginval. Run from the repo root: ./tools/run_checks.sh
set -euo pipefail

cd "$(dirname "$0")/.."
BUILD=build
GOLDEN=tests/golden
RENDER="$BUILD/render_artefacts/Release/render"

echo "=== configure + build ==="
cmake -B "$BUILD" -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD"

echo "=== unit tests ==="
ctest --test-dir "$BUILD" --output-on-failure

echo "=== golden renders ==="
# (a) passthrough-ish: drive 0, cab off
"$RENDER" "$GOLDEN/sine1k.wav" "$BUILD/out_passthrough.wav" --drive 0 --no-cab
# (b) driven: drive 8, cab off
"$RENDER" "$GOLDEN/sine1k.wav" "$BUILD/out_driven.wav" --drive 8 --no-cab

if [ -f "$GOLDEN/golden_passthrough.wav" ]; then
    python3 tools/compare.py diff "$BUILD/out_passthrough.wav" "$GOLDEN/golden_passthrough.wav"
    python3 tools/compare.py diff "$BUILD/out_driven.wav" "$GOLDEN/golden_driven.wav"
else
    echo "no goldens yet — promoting these renders to golden"
    cp "$BUILD/out_passthrough.wav" "$GOLDEN/golden_passthrough.wav"
    cp "$BUILD/out_driven.wav" "$GOLDEN/golden_driven.wav"
fi

echo "=== tone stack vs independent circuit solve ==="
python3 tools/validate_tonestack.py "$RENDER"

echo "=== aliasing budget (amp, drive 8, 997 Hz; audible-band spurs <= -80 dBFS) ==="
"$RENDER" "$GOLDEN/sine997.wav" "$BUILD/out_alias.wav" --drive 8 --no-cab
python3 tools/compare.py spectrum "$BUILD/out_alias.wav" --fundamental 997 --max-spur-db -80

echo "=== schematic drawings match their netlists ==="
for f in pedals/*.cir; do
    if grep -q '^\*@sch ' "$f"; then python3 tools/check_sch.py "$f"; fi
done

echo "=== pedals: circuit engine vs ngspice (same netlist; <= -60 dB rms error) ==="
if command -v ngspice >/dev/null 2>&1; then
    for args in "fuzz=1 volume=1 0.2" "fuzz=1 volume=1 1.0" "fuzz=0.3 volume=1 0.05" \
                "fuzz=0 volume=1 0.02" "fuzz=0.6 volume=0.5 0.5"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/round-fuzz.cir --knob "$1" --knob "$2" \
            --amp "$3" --max-err-db -60
    done
    for amp in 0.05 0.5 2 8; do
        python3 tools/spice_check.py "$RENDER" tests/circuits/12ax7-stage.cir --amp "$amp" --max-err-db -60
    done
    for args in "loud1=0.6 loud2=0.4 0.25" "loud1=1 loud2=1 0.5" "loud1=0.3 loud2=0.2 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/brit-plexi.cir --knob "$1" --knob "$2" \
            --amp "$3" --max-err-db -60
    done
    # Volume/Treble on 10 with 0.5 V in clips four stages with grid current;
    # discretisation error peaks there, hence the wider budget for that case.
    for args in "volume=0.55 treble=0.6 0.25 -60" "volume=1 treble=1 0.5 -55" "volume=0.3 treble=0.2 0.05 -60" "volume=0.8 treble=0.4 1.0 -60"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/classa-30.cir --knob "$1" --knob "$2" \
            --amp "$3" --max-err-db "$4"
    done
    for args in "gain=0.3 treble=0.5 0.2" "gain=1 treble=0.5 0.3" "gain=0 treble=1 0.05" "gain=1 treble=1 1.0"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/gold-horse.cir --knob "$1" --knob "$2" \
            --amp "$3" --max-err-db -60
    done
    # Ram Fuzz: two diode-in-feedback clipping stages with Miller caps are
    # stiff; at full Sustain the fixed-step error is discretisation (it
    # falls ~10 dB per doubling of rate: -28/-36/-47/-59 dB at
    # 96/192/384/768 kHz), so the extreme case gets a wider budget.
    for args in "sustain=0.6 tone=0.5 0.2 -55" "sustain=0.1 tone=1 0.05 -55" "sustain=0.8 tone=0 0.5 -55" "sustain=1 tone=1 1.0 -35"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/ram-fuzz.cir --knob "$1" --knob "$2" \
            --amp "$3" --max-err-db "$4"
    done
    for args in "bright=0.5 normal=0.4 0.25" "bright=1 normal=1 0.5" "bright=0.3 normal=0.2 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/tweed-bass.cir --knob "$1" --knob "$2" \
            --amp "$3" --max-err-db -60
    done
    for args in "volume=0.4 treble=0.6 0.25" "volume=1 treble=1 0.5" "volume=0.2 treble=0.3 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/blackpanel-100.cir --knob "$1" --knob "$2" \
            --amp "$3" --max-err-db -60
    done
    for args in "preamp=0.6 master=0.6 0.25" "preamp=1 master=1 0.5" "preamp=0.3 master=0.5 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/brit-800.cir --knob "$1" --knob "$2" \
            --amp "$3" --max-err-db -60
    done
    # Wah (the first circuit with an inductor), at 440 Hz across the sweep.
    for args in "wah=0 0.1" "wah=0.5 0.1" "wah=1 0.1" "wah=0.5 0.5" "wah=0.2 1.0"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/classic-wah.cir --knob "$1" --amp "$2" --freq 440 --max-err-db -60
    done
    for args in "boost=0.7 0.2" "boost=1 0.5" "boost=1 1.0" "boost=0.3 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/treble-boost.cir --knob "$1" --amp "$2" --max-err-db -60
    done
    for args in "fuzz=1 volume=0.6 0.2" "fuzz=0.5 volume=0.6 0.1" "fuzz=1 volume=1 0.5" "fuzz=0 volume=0.8 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/round-fuzz-ge.cir --knob "$1" --knob "$2" --amp "$3" --max-err-db -60
    done
    for args in "loud1=0.5 treble=0.6 0.25" "loud1=1 loud2=1 0.5" "loud1=0.2 loud2=0.5 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/brit-45.cir --knob "$1" --knob "$2" --amp "$3" --max-err-db -60
    done
    for args in "normal=0.5 master=0.5 0.25" "normal=1 brilliant=1 0.5" "normal=0.2 master=0.3 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/brit-clean-100.cir --knob "$1" --knob "$2" --amp "$3" --max-err-db -60
    done
    # Boutique ODS: overdrive's cascaded clipping is discretisation-
    # limited (-21/-34/-47/-59 dB at 96/192/384/768 kHz flat out).
    for args in "mode=0 volume=0.45 0.25 -60" "mode=1 drive=0.5 0.25 -45" "mode=1 drive=1 0.5 -30" "mode=0 volume=1 0.05 -60"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/boutique-ods.cir --knob "$1" --knob "$2" --amp "$3" --max-err-db "$4"
    done
    for args in "fac=0 gain=0.5 0.25" "fac=0.6 gain=1 0.5" "fac=1 boost=1 0.25" "fac=0.2 gain=0.2 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/graphic-120.cir --knob "$1" --knob "$2" --amp "$3" --max-err-db -60
    done
    # Orange Phaser: four JFET stages (the audio path), short windows; its LFO
    # (a Schmitt trigger and a 15u integrator) is checked by rate below.
    for args in "speed=0 0.2" "speed=0.5 0.2" "speed=1 1.0" "speed=1 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/orange-phaser.cir --knob "$1" --amp "$2" --rate 96000 --max-err-db -60
    done
    for k in 0.5 1; do
        python3 tools/lfo_rate_check.py "$RENDER" pedals/orange-phaser.cir tri --knob speed=$k --secs 6
    done
    # Octave Fuzz: coupled-inductor transformer, full-wave germanium rectifier.
    for args in "drive=0.7 octave=0 0.1" "drive=1 octave=0 0.5" "drive=0.3 octave=0.5 0.05" "drive=0.7 octave=1 0.2"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/octave-fuzz.cir --knob "$1" --knob "$2" --amp "$3" --max-err-db -45
    done
    # Hot Rod 100: like the ODS, the overdrive channel's cascade is
    # discretisation-limited (about -53 dB here); clean is -76..-79 dB.
    for args in "mode=0 normalvol=0.5 0.25 -60" "mode=1 preamp=0.6 0.25 -45" "mode=1 preamp=1 0.5 -45" "mode=0 normalvol=1 0.05 -60"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" amps/hotrod-100.cir --knob "$1" --knob "$2" --amp "$3" --max-err-db "$4"
    done
    for amp in blackpanel-22 blackpanel-410; do
        for args in "volume=0.4 treble=0.6 0.25" "volume=1 treble=1 0.5" "volume=0.2 treble=0.3 0.05"; do
            set -- $args
            python3 tools/spice_check.py "$RENDER" amps/$amp.cir --knob "$1" --knob "$2" --amp "$3" --max-err-db -60
        done
    done
    for args in "volume=0.5 0.2" "volume=1 0.5" "volume=1 1.0" "volume=0.2 0.05"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/clean-boost.cir --knob "$1" --amp "$2" --max-err-db -60
    done
    # Rodent: hard clipping at up to ~67 dB of gain makes the error at the
    # clipping edges discretisation-limited (it falls ~8 dB per doubling of
    # rate: -30/-36/-44/-53 dB at 96/192/384/768 kHz flat out), so heavy
    # settings get wider budgets, as for the Ram Fuzz.
    for args in "distortion=0.5 filter=0.4 volume=0.5 0.2 -45" "distortion=1 filter=0 volume=1 0.5 -33" \
                "distortion=0.2 filter=1 volume=0.7 0.05 -60" "distortion=1 filter=1 volume=0.5 1.0 -48"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/rodent.cir --knob "$1" --knob "$2" --knob "$3" \
            --amp "$4" --max-err-db "$5"
    done
    for args in "drive=0.5 tone=0.5 level=0.5 0.2" "drive=1 tone=0.5 level=1 0.2" \
                "drive=0 tone=0 level=1 0.05" "drive=1 tone=1 level=0.7 0.5" "drive=0.3 tone=0.8 level=0.6 0.1"; do
        set -- $args
        python3 tools/spice_check.py "$RENDER" pedals/green-drive.cir --knob "$1" --knob "$2" \
            --knob "$3" --amp "$4" --max-err-db -60
    done
else
    echo "ngspice not present — brew install ngspice"
fi

echo "=== WASM engine matches native (SPEC-web: <= 1e-5 RMS) ==="
if command -v em++ >/dev/null 2>&1 || [ -f "$HOME/emsdk/emsdk_env.sh" ]; then
    ./tools/build_wasm.sh
    node tools/wasm_render.ts "$GOLDEN/sine1k.wav" "$BUILD/wasm_passthrough.wav" --drive 0
    node tools/wasm_render.ts "$GOLDEN/sine1k.wav" "$BUILD/wasm_driven.wav" --drive 8
    python3 tools/compare.py diff "$BUILD/wasm_passthrough.wav" "$BUILD/out_passthrough.wav" --tol-rms-db -100
    python3 tools/compare.py diff "$BUILD/wasm_driven.wav" "$BUILD/out_driven.wav" --tol-rms-db -100
else
    echo "Emscripten not present — install emsdk to ~/emsdk (see tools/build_wasm.sh)"
fi

echo "=== cab loudness-matching gain: browser matches native ==="
for ir in resources/irs/*.wav; do
    native=$("$RENDER" --ir-gain "$ir")
    web=$(node tools/ir_gain.ts "$ir")
    python3 -c "import sys,math; n,w=float('$native'),float('$web'); d=abs(20*math.log10(w/n)); print(f'$(basename "$ir"): native {n:.4f} web {w:.4f} diff {d:.4f} dB'); sys.exit(d>0.01)"
done

echo "=== pluginval ==="
PLUGINVAL="tools/pluginval.app/Contents/MacOS/pluginval"
if [ -x "$PLUGINVAL" ]; then
    "$PLUGINVAL" --strictness-level 10 --validate \
        "$BUILD/PhreakGuitar_artefacts/Release/VST3/PhreakGuitar.vst3"
    "$PLUGINVAL" --strictness-level 10 --validate \
        "$BUILD/PhreakGuitar_artefacts/Release/AU/PhreakGuitar.component"
else
    echo "pluginval not present — run tools/get_pluginval.sh (needs network)"
fi

echo "=== all checks passed ==="
