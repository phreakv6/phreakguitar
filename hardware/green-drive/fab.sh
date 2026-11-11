#!/bin/bash
# Fabrication files for Lion Circuits (or any fab): Gerbers + drill, zipped,
# plus the 3D renders. Run after route.py and a clean DRC.
set -euo pipefail
cd "$(dirname "$0")"
K=/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli
rm -rf out/gerbers && mkdir -p out/gerbers
$K pcb export gerbers --layers F.Cu,B.Cu,F.Mask,B.Mask,F.Silkscreen,B.Silkscreen,Edge.Cuts \
    --no-protel-ext -o out/gerbers/ green-drive.kicad_pcb
$K pcb export drill --format excellon --drill-origin absolute --excellon-units mm -o out/gerbers/ green-drive.kicad_pcb
rm -f out/green-drive-gerbers.zip
(cd out/gerbers && zip -q ../green-drive-gerbers.zip ./*)
$K pcb render --side top --rotate "-40,0,20" --perspective --width 1600 --height 1200 --quality high \
    -o out/board_3d.png green-drive.kicad_pcb
echo "out/green-drive-gerbers.zip is ready to upload"
