"""
Green Drive, the real pedal: every part on the board and what it connects to.

The audio circuit is pedals/green-drive.cir, part for part (same reference
designators, same nodes, uppercased): check.py proves the two match. Added
for a real box, none of it in the audio path's sound:
  R19    1M input pull-down, so the footswitch doesn't pop (-0.05 dB)
  D4     reverse-polarity diode; C12, C13 supply filtering
  R21    + LED1 status light, switched to ground by the footswitch
  R20    makes the linear Level pot behave close to audio taper (leave it out
         with an A100K pot)
  J1-J6  wire pads: IN, OUT, 9V, GND x2 and LED- to the jacks and footswitch
The pots are RV1 Drive, RV2 Tone, RV3 Level.
Left out: Rpickup and Rload (the guitar and the amp), and the simulation's
supply source Vcc (it's the DC jack).

Pots: pin 3 is the clockwise end. A .cir POT's `a` end is where the wiper
sits at pos=1, so a -> pin 3, w -> pin 2, b -> pin 1.

Values that differ from the .cir, checked in ngspice (all under 0.5 dB):
C1 20n -> 22n, C11 51p -> 47p.

Electrolytic polarity follows the DC operating point (see check.py --op):
C2's + is P1 (4.5 V), not E1 (~3.9 V).
"""

# (ref, value, kind, {pin: net}, note)
# kind picks the symbol and footprint in build.py.
PARTS = [
    # Input
    ("R19",  "1M",   "R",      {1: "IN", 2: "GND"}, "pull-down (not in the .cir)"),
    ("R1",   "1k",   "R",      {1: "IN", 2: "N2"}, ""),
    ("C1",   "22n",  "C_FILM", {1: "N2", 2: "B1"}, ".cir: 20n"),
    ("R2",   "510k", "R",      {1: "B1", 2: "VREF"}, ""),
    ("Q1",   "2SC1815", "NPN_ECB", {"C": "VCC", "B": "B1", "E": "E1"}, ""),
    ("R3",   "10k",  "R",      {1: "E1", 2: "GND"}, ""),

    # Clipping amplifier
    ("C2",   "1u",   "C_EL",   {"+": "P1", "-": "E1"}, ""),
    ("R4",   "10k",  "R",      {1: "P1", 2: "VREF"}, ""),
    ("R6",   "4.7k", "R",      {1: "M1", 2: "G1"}, ""),
    ("C3",   "47n",  "C_FILM", {1: "G1", 2: "GND"}, ""),
    ("C11",  "47p",  "C_CER",  {1: "O1", 2: "M1"}, ".cir: 51p"),
    ("D1",   "1N4148", "D",    {"A": "M1", "K": "O1"}, ""),
    ("D3",   "1N4148", "D",    {"A": "O1", "K": "M1"}, ""),
    ("R5",   "51k",  "R",      {1: "M1", 2: "DR"}, ""),
    ("RV1", "B500K", "POT",  {3: "DR", 2: "DR", 1: "O1"}, "A500K if you find one"),

    # Tone
    ("R7",   "1k",   "R",      {1: "O1", 2: "P2"}, ""),
    ("C6",   "220n", "C_FILM", {1: "P2", 2: "GND"}, ""),
    ("R18",  "10k",  "R",      {1: "P2", 2: "VREF"}, ""),
    ("R8",   "1k",   "R",      {1: "O2", 2: "M2"}, ""),
    ("RV2", "B20K", "POT",    {3: "M2", 2: "TW", 1: "P2"}, ""),
    ("C10",  "220n", "C_FILM", {1: "TW", 2: "T2"}, ""),
    ("R9",   "220",  "R",      {1: "T2", 2: "GND"}, ""),

    # The dual op-amp: A clips, B is the tone stage
    ("U1",   "JRC4558D", "OPAMP2", {
        "+A": "P1", "-A": "M1", "OA": "O1",
        "+B": "P2", "-B": "M2", "OB": "O2",
        "V+": "VCC", "V-": "GND"}, "or RC4558P / TL072"),

    # Level and output buffer
    ("C5",   "1u",   "C_EL",   {"+": "O2", "-": "C5"}, ""),
    ("R10",  "1k",   "R",      {1: "C5", 2: "LV"}, ""),
    ("RV3", "B100K", "POT",  {3: "LV", 2: "LW", 1: "GND"}, "A100K if you find one"),
    ("R20", "15k", "R",     {1: "LW", 2: "GND"}, "only with a linear Level pot"),
    ("C7",   "100n", "C_FILM", {1: "LW", 2: "B2"}, ""),
    ("R12",  "1M",   "R",      {1: "B2", 2: "VREF"}, ""),
    ("Q2",   "2SC1815", "NPN_ECB", {"C": "VCC", "B": "B2", "E": "E2"}, ""),
    ("R13",  "10k",  "R",      {1: "E2", 2: "GND"}, ""),
    ("R14",  "100",  "R",      {1: "E2", 2: "OB"}, ""),
    ("C8",   "10u",  "C_EL",   {"+": "OB", "-": "OUT"}, ""),
    ("R15",  "10k",  "R",      {1: "OUT", 2: "GND"}, ""),

    # Power and the 4.5 V reference
    ("D4", "1N5819", "D_PWR", {"A": "V9_IN", "K": "VCC"}, "reverse-polarity protection"),
    ("C12", "100u", "C_EL",  {"+": "VCC", "-": "GND"}, ""),
    ("C13", "100n", "C_CER", {1: "VCC", 2: "GND"}, ""),
    ("R16",  "10k",  "R",      {1: "VCC", 2: "VREF"}, ""),
    ("R17",  "10k",  "R",      {1: "VREF", 2: "GND"}, ""),
    ("C9",   "47u",  "C_EL",   {"+": "VREF", "-": "GND"}, ""),

    # Status LED: the footswitch grounds LED- when the pedal is on
    ("R21", "2.2k", "R",      {1: "VCC", 2: "LED_A"}, ""),
    ("LED1", "red 5mm", "LED", {"A": "LED_A", "K": "LED_K"}, ""),

    # Wire pads
    ("J1",   "IN",   "PAD", {1: "IN"}, "to footswitch"),
    ("J2",  "OUT",  "PAD", {1: "OUT"}, "to footswitch"),
    ("J3",   "9V",   "PAD", {1: "V9_IN"}, "DC jack, sleeve (+)"),
    ("J4", "GND",  "PAD", {1: "GND"}, "DC jack, centre (-)"),
    ("J5", "GND",  "PAD", {1: "GND"}, "jack sleeves"),
    ("J6", "LED-", "PAD", {1: "LED_K"}, "to footswitch"),
]

# How each board part maps back to pedals/green-drive.cir: the .cir element
# name, and the board pins in the order of that element's nodes.
CIR_PINS = {
    "R": [1, 2], "C_FILM": [1, 2], "C_CER": [1, 2],
    "C_EL": None,      # .cir order is per part, given below
    "D": ["A", "K"],
    "NPN_ECB": ["C", "B", "E"],
    "POT": [3, 2, 1],
}
CIR_EL_ORDER = {      # .cir node order for the electrolytics
    "C2": ["-", "+"],  # C2 e1 p1
    "C5": ["+", "-"],  # C5 o2 c5
    "C8": ["+", "-"],  # C8 ob out
    "C9": ["+", "-"],  # C9 vref 0
}
CIR_NAME = {"RV1": "XDRIVE", "RV2": "XTONE", "RV3": "XLEVEL"}
NOT_IN_CIR = {"R19", "R20", "D4", "C12", "C13", "R21", "LED1"}
# The .cir op-amps: XU1 p1 m1 o1 vcc 0 / XU2 p2 m2 o2 vcc 0
CIR_OPAMPS = {"XU1": ["+A", "-A", "OA", "V+", "V-"],
              "XU2": ["+B", "-B", "OB", "V+", "V-"]}
# Board nets the .cir calls something else
NET_TO_CIR = {"GND": "0"}
