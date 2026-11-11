# Green Drive: the real pedal

The '808-style overdrive from `pedals/green-drive.cir`, as a board you can
order, solder and put in a 3D-printed box. The board's audio circuit is the
one the app plays, part for part: `check.py` compares KiCad's netlist with the
`.cir` on every build.

## What's here

| File | What it is |
|---|---|
| `out/green-drive-gerbers.zip` | **Upload this to Lion Circuits.** 2 layers, 64 x 66 mm |
| `out/assembly.pdf` | Soldering map: every part with its value, polarity marked |
| `out/bom.csv` | Parts list |
| `out/case_shell.stl`, `out/case_bottom.stl` | The box (print after measuring your parts, below) |
| `out/green-drive-schematic.pdf` | The schematic |
| `green-drive.kicad_pro` / `_sch` / `_pcb` | The KiCad project, if you want to change anything |
| `design.py` | Every part and what it connects to: the source of the rest |

## 1. Order the board

[lioncircuits.com](https://www.lioncircuits.com) → instant quote → upload
`out/green-drive-gerbers.zip`. Defaults are fine: 2 layers, FR-4 1.6 mm,
HASL, green mask, white legend, quantity 5. About ₹799, 5 to 6 days.

## 2. Buy the parts (Robu.in, checked 10 Nov 2026)

| Qty | Part | Value | On the board |
|---|---|---|---|
| 1 | Resistor 1/4 W metal film | 100 | R14 |
| 1 | Resistor 1/4 W metal film | 220 | R9 |
| 4 | Resistor 1/4 W metal film | 1k | R1, R7, R8, R10 |
| 1 | Resistor 1/4 W metal film | 2.2k | R21 |
| 1 | Resistor 1/4 W metal film | 4.7k | R6 |
| 7 | Resistor 1/4 W metal film | 10k | R3, R4, R13, R15, R16, R17, R18 |
| 1 | Resistor 1/4 W metal film | 15k | R20 |
| 1 | Resistor 1/4 W metal film | 51k | R5 |
| 1 | Resistor 1/4 W metal film | 510k | R2 |
| 2 | Resistor 1/4 W metal film | 1M | R12, R19 |
| 1 | Film capacitor | 22n | C1 |
| 1 | Film capacitor | 47n | C3 |
| 1 | Film capacitor | 100n | C7 |
| 2 | Film capacitor | 220n | C6, C10 |
| 1 | Ceramic capacitor | 47p | C11 |
| 1 | Ceramic capacitor | 100n | C13 |
| 2 | Electrolytic capacitor, 25 V+ | 1u | C2, C5 |
| 1 | Electrolytic capacitor, 25 V+ | 10u | C8 |
| 1 | Electrolytic capacitor, 25 V+ | 47u | C9 |
| 1 | Electrolytic capacitor, 25 V+ | 100u | C12 |
| 2 | Diode | 1N4148 | D1, D3 |
| 1 | Schottky diode | 1N5819 | D4 |
| 2 | NPN transistor | 2SC1815 | Q1, Q2 |
| 1 | Dual op-amp, DIP-8 | JRC4558D (also try RC4558P, TL072) | U1 |
| 1 | Pot, 16 mm, PCB legs | B500K (A500K if you find one) | RV1 Drive |
| 1 | Pot, 16 mm, PCB legs | B20K | RV2 Tone |
| 1 | Pot, 16 mm, PCB legs | B100K (A100K if you find one) | RV3 Level |
| 1 | LED, 5 mm | red | LED1 |
| 1 | 8-pin DIP socket | | U1 |
| 1 | 3PDT footswitch | Daier PBS-24-302P | |
| 2 | 1/4" jack | CK-6.35-03 (stereo is fine) | |
| 1 | DC jack, panel mount | 2.1 x 5.5 mm | |
| 3 | Knob, 6 mm shaft | | |
| 4 | M3 x 5 mm brass heat-set insert + M3 x 6 mm countersunk screw | | bottom plate |
| | 24 AWG wire, two colours | | |

Notes:
- The board takes film caps at **5 mm or 10 mm** lead spacing (three holes:
  use the pair that fits) and the 47p at 2.5 or 5 mm.
- **R20 (15k)** makes the linear Level pot feel like an audio-taper one. With
  an A100K pot, leave R20 out.
- C1 is 22n (the original's 20n is rare) and C11 47p (51p): both checked in
  ngspice, under 0.5 dB anywhere on the knobs.

## 3. Solder

Follow `out/assembly.pdf`. Low parts first, so the board lies flat while you
work:

1. Resistors, the three diodes (band = **K** on the map)
2. The DIP socket (notch at the **1** end), the 47p and 100n ceramics
3. The transistors: the **thick line on the map is the flat face**, legs E-C-B
4. Film caps, then electrolytics (long leg = **+**)
5. Wires to the pads: about 10 cm each, two colours for 9V and GND
6. **Last, on the other side of the board:** the pots and the LED. Push the
   pots' shafts through the printed lid first and screw the nuts on, then
   solder, so they line up with the holes. Push the LED until its tip sits in
   the lid's LED hole, then solder it. Break off the pots' little
   anti-rotation tabs with pliers.

Don't put the op-amp in yet.

## 4. Test before boxing

9 V adapter on the 9V and GND pads, multimeter on DC volts, black probe on
GND. Without the op-amp:

| Where | Expect |
|---|---|
| D4's band end (VCC) | 8.5 to 8.8 V (the diode takes 0.3 to 0.4 V) |
| C9's + leg (VREF) | half of that, about 4.3 V |

Then power off, put the op-amp in (notch to the **1** end), power on:

| Where | Expect (from ngspice, scaled to the real supply) |
|---|---|
| U1 pins 1, 2, 3, 5, 6, 7 | all about VREF (4.3 V) |
| Q1 emitter (E) | about 3.1 V |
| Q2 emitter (E) | about 2.7 V |

The pedal should draw about 10 mA with the LED on. If it draws much more
than 20 mA, or a voltage is way off, power off
and look for a solder bridge or a part in backwards before going further.

## 5. Wire the jacks and footswitch

Check the footswitch with a multimeter on continuity first: its 9 lugs are
three columns of three. In each column the middle lug connects to the top lug
in one position and to the bottom lug in the other. Looking at the lugs:

```
 1  2  3     top row:    bypass
 4  5  6     middle row: commons
 7  8  9     bottom row: effect on
```

| From | To |
|---|---|
| Lug 4 | Output jack tip |
| Lug 5 | Input jack tip |
| Lug 6 | GND |
| Lug 1 | Lug 2 (a short jumper: the bypass path) |
| Lug 7 | Board **OUT** pad |
| Lug 8 | Board **IN** pad |
| Lug 9 | Board **LED-** pad |
| Both jack sleeves | Board **GND** pad (the one next to IN) |
| DC jack centre pin | Board **GND** pad (the one next to 9V) |
| DC jack sleeve | Board **9V** pad |

Use the stereo jacks' tip and sleeve only; leave the ring lug empty. Find the
DC jack's centre-pin lug with the multimeter. Pedal adapters are centre
negative; if one is wired backwards, D4 blocks it and nothing is harmed.

If the LED lights when the pedal is bypassed, the rows are the other way up
on your switch: swap the top-row and bottom-row wires.

## 6. The box

`out/case_shell.stl` (print it lid-down: no supports, flat face) and
`out/case_bottom.stl`. PETG or PLA, 4 walls, 40% infill.

**Before printing, measure your parts** and set the values marked MEASURE in
`enclosure.py`, then run `python3 enclosure.py`:
- the pot bushing, jack and DC jack threads (hole sizes)
- `POT_SHAFT_OFFSET_MEASURED`: shaft centre to the row of pins on your pots
  (the board assumes 7.5 mm). Only the lid's holes move; the board stays as
  ordered.

Press the M3 inserts into the four corner posts with a soldering iron. The
input jack goes on the right side as you look at the knobs, output and DC
jack on the left.

## 7. Rebuilding after a change

```
python3 build.py      # schematic, netlist, ERC, check against the .cir
KPY=/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/3.9/bin/python3.9
$KPY pcb.py           # place the parts
$KPY route.py path/to/freerouting.jar   # route (Freerouting 2.5, needs Java)
kicad-cli pcb drc --schematic-parity --refill-zones green-drive.kicad_pcb
python3 assembly.py && python3 bom.py && python3 enclosure.py
./fab.sh              # Gerbers + drill -> out/green-drive-gerbers.zip
```
Freerouting is at github.com/freerouting/freerouting/releases.
