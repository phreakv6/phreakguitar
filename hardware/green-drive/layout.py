"""
Where things sit, shared by build.py (the board) and enclosure.py (the box).

Board coordinates: mm from the board's top-left corner, looking at the
component side (KiCad's front, F), y down. The pots and the LED sit on the
other side (B) and poke through the lid, so seen from outside the pedal
everything is mirrored left-right: Drive ends up on the left.

Measure your parts before printing: POT_SHAFT_OFFSET, the hole sizes and
the jack positions in enclosure.py are the things most likely to differ.
"""

BOARD_W = 64.0
BOARD_H = 66.0

# Pot shaft centres (component-side view, so Level is on the left here).
POT_Y = 12.0
POTS = {"RV3": (12.0, POT_Y), "RV2": (32.0, POT_Y), "RV1": (52.0, POT_Y)}
POT_BODY_D = 16.0
# Shaft centre to the row of three pins. 7.5 mm fits Alpha 16 mm pots;
# check a WH148 with calipers and change this (board and box both follow).
POT_SHAFT_OFFSET = 7.5

LED = (32.0, 55.5)   # 5 mm LED, B side, under the lid

# Nothing on the component side may put a pad under a pot body: the pots
# sit on the other face and their metal backs would rest on the joints.
POT_KEEPOUT_R = POT_BODY_D / 2 + 1.0

# Wire pads along the bottom edge, left to right (component-side view, so
# the input, whose jack is on the right of the pedal, is on the left here).
PADS_Y = 62.5
PADS = ["J1", "J5", "J6", "J2", "J4", "J3"]
PAD_LABELS = {"J1": "IN", "J5": "GND", "J6": "LED-", "J2": "OUT", "J4": "GND", "J3": "9V"}

# No mounting holes: the three pot nuts hold the board to the lid.


def mirrored(x, y):
    """Board point -> position seen from outside the lid (x from the left
    edge of the board as seen from outside, y from its top edge)."""
    return BOARD_W - x, y
