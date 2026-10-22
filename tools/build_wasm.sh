#!/bin/bash
# Build the engine as a standalone WASM module (no Emscripten JS glue) for
# the browser AudioWorklet and the Node golden harness.
#   ./tools/build_wasm.sh            -> web/public/engine.wasm
# Needs Emscripten: source ~/emsdk/emsdk_env.sh (or emcc on PATH).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v em++ >/dev/null 2>&1; then
    if [ -f "$HOME/emsdk/emsdk_env.sh" ]; then
        source "$HOME/emsdk/emsdk_env.sh" >/dev/null 2>&1
    else
        echo "em++ not found; install emsdk (see tools/build_wasm.sh)" >&2
        exit 1
    fi
fi

OUT=web/public/engine.wasm
mkdir -p "$(dirname "$OUT")"

em++ -std=c++20 -O3 -msimd128 -fno-exceptions -fno-rtti \
    -Iengine \
    engine/dsp/Oversampler.cpp \
    engine/amp/DriveStage.cpp \
    engine/amp/ToneStack.cpp \
    engine/amp/AmpChain.cpp \
    engine/amp/PowerAmp.cpp \
    engine/amp/PowerSupply.cpp \
    engine/amp/CircuitAmp.cpp \
    engine/fx/Compressor.cpp \
    engine/fx/Delay.cpp \
    engine/fx/Eq.cpp \
    engine/fx/Reverb.cpp \
    engine/fx/PhotoVibe.cpp \
    engine/fx/Looper.cpp \
    engine/circuit/Netlist.cpp \
    engine/circuit/DKSolver.cpp \
    engine/circuit/Pedal.cpp \
    engine/wasm/api.cpp \
    -sSTANDALONE_WASM -sINITIAL_MEMORY=16MB -sALLOW_MEMORY_GROWTH=1 \
    -sFILESYSTEM=0 -sASSERTIONS=0 --no-entry \
    -o "$OUT"

echo "built $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
