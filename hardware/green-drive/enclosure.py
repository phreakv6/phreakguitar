"""
The 3D-printed box for the Green Drive: a shell (lid + walls, printed lid-
down so the face comes out flat) and a bottom plate held by four M3 screws
in brass heat-set inserts.

    python3 enclosure.py          # writes out/case_shell.stl, out/case_bottom.stl

Model axes: x across (left to right seen from outside the lid), y along
(from the end above the knobs towards the footswitch), z down from the
lid's outer face. Pot and LED positions come from layout.py, mirrored
because they sit on the board's back.

Measure your parts and change the values marked MEASURE before printing.
"""

import struct
import sys
from pathlib import Path

import numpy as np
from manifold3d import CrossSection, JoinType, Manifold

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import layout  # noqa: E402

# Box
WALL = 2.5
LID = 3.0                  # lid thickness (the knob face)
IN_W, IN_L, IN_H = 68.0, 115.0, 34.0
CORNER_R = 4.0             # outer corner rounding
BOTTOM = 2.5               # bottom plate thickness

# Where the board sits inside, seen from outside the lid
BOARD_X0 = (IN_W - layout.BOARD_W) / 2
BOARD_Y0 = 4.0

# MEASURE on a real pot: shaft centre to its row of pins. The board's pin
# holes are fixed (layout.POT_SHAFT_OFFSET from the shaft positions it was
# drawn for); if your pots differ, the lid holes move instead.
POT_SHAFT_OFFSET_MEASURED = layout.POT_SHAFT_OFFSET

# Holes (diameters, mm)
POT_HOLE = 7.6             # MEASURE: WH148 bushing is M7
LED_HOLE = 5.3
FOOTSWITCH_HOLE = 12.4     # MEASURE: PBS-24-302 thread is M12
JACK_HOLE = 9.6            # MEASURE: the 1/4" jack's thread
DC_HOLE = 8.2              # MEASURE: the DC jack's thread (some are 11 mm)

# Footswitch: centred across, near the far end; a ring under the lid
# makes the face 5 mm thick there so stomping doesn't crack it.
FOOTSWITCH_Y = 100.0
FS_RING_D, FS_RING_T = 24.0, 2.0

# Jacks: input on the right wall, output on the left, the DC jack on the
# left beside the footswitch. Height measured down from the lid's inside.
JACK_Y = 80.0
DC_Y = 100.0
JACK_DEPTH = 17.0          # centre of the jack below the lid's inner face

# Corner posts for the bottom plate's screws
POST = 8.0
INSERT_D, INSERT_DEPTH = 4.2, 6.0   # M3 x 5 mm heat-set insert
SCREW_D, SCREW_HEAD_D = 3.4, 6.2

SEG = 64


def rounded_rect(w, l, r):
    return CrossSection.square([w - 2 * r, l - 2 * r]).translate([r, r]).offset(r, JoinType.Round, circular_segments=SEG)


def cyl(d, h, x, y, z):
    return Manifold.cylinder(h, d / 2, circular_segments=SEG).translate([x, y, z])


def side_hole(d, x_wall, y, z):
    """A hole through a side wall (along x)."""
    c = Manifold.cylinder(WALL * 3, d / 2, circular_segments=SEG, center=True)
    return c.rotate([0, 90, 0]).translate([x_wall, y, z])


def board_to_box(bx, by):
    mx, my = layout.mirrored(bx, by)
    return WALL + BOARD_X0 + mx, WALL + BOARD_Y0 + my


def shell():
    out_w, out_l = IN_W + 2 * WALL, IN_L + 2 * WALL
    depth = LID + IN_H
    outer = Manifold.extrude(rounded_rect(out_w, out_l, CORNER_R), depth)
    inner = Manifold.extrude(rounded_rect(IN_W, IN_L, max(CORNER_R - WALL, 0.5)), IN_H + 1).translate([WALL, WALL, LID])
    box = outer - inner

    # Corner posts, with inserts from the open end
    for px in (WALL, WALL + IN_W - POST):
        for py in (WALL, WALL + IN_L - POST):
            box += Manifold.cube([POST, POST, IN_H]).translate([px, py, LID])
            box -= cyl(INSERT_D, INSERT_DEPTH + 0.01, px + POST / 2, py + POST / 2, depth - INSERT_DEPTH)

    # Footswitch ring under the lid
    fx, fy = WALL + IN_W / 2, WALL + FOOTSWITCH_Y
    box += cyl(FS_RING_D, FS_RING_T, fx, fy, LID)

    # Holes in the lid
    tall = LID + FS_RING_T + 2
    for bx, by in layout.POTS.values():
        x, y = board_to_box(bx, by + layout.POT_SHAFT_OFFSET - POT_SHAFT_OFFSET_MEASURED)
        box -= cyl(POT_HOLE, tall, x, y, -1)
    x, y = board_to_box(*layout.LED)
    box -= cyl(LED_HOLE, tall, x, y, -1)
    box -= cyl(FOOTSWITCH_HOLE, tall, fx, fy, -1)

    # Holes in the walls
    jz = LID + JACK_DEPTH
    box -= side_hole(JACK_HOLE, WALL + IN_W + WALL / 2, WALL + JACK_Y, jz)   # input, right
    box -= side_hole(JACK_HOLE, WALL / 2, WALL + JACK_Y, jz)                 # output, left
    box -= side_hole(DC_HOLE, WALL / 2, WALL + DC_Y, jz)                     # DC, left
    return box


def bottom():
    out_w, out_l = IN_W + 2 * WALL, IN_L + 2 * WALL
    plate = Manifold.extrude(rounded_rect(out_w, out_l, CORNER_R), BOTTOM)
    for px in (WALL, WALL + IN_W - POST):
        for py in (WALL, WALL + IN_L - POST):
            cx, cy = px + POST / 2, py + POST / 2
            plate -= cyl(SCREW_D, BOTTOM + 2, cx, cy, -1)
            # countersink-ish recess for the screw head
            plate -= Manifold.cylinder(1.2, SCREW_D / 2, SCREW_HEAD_D / 2, circular_segments=SEG).translate([cx, cy, BOTTOM - 1.2 + 0.01])
    return plate


def write_stl(m, path):
    mesh = m.to_mesh()
    v = np.asarray(mesh.vert_properties)[:, :3]
    t = np.asarray(mesh.tri_verts)
    with open(path, "wb") as f:
        f.write(b"green-drive".ljust(80, b" "))
        f.write(struct.pack("<I", len(t)))
        for a, b, c in t:
            p0, p1, p2 = v[a], v[b], v[c]
            n = np.cross(p1 - p0, p2 - p0)
            n = n / (np.linalg.norm(n) or 1)
            f.write(struct.pack("<12fH", *n, *p0, *p1, *p2, 0))


def main():
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    s, b = shell(), bottom()
    for m, name in ((s, "case_shell.stl"), (b, "case_bottom.stl")):
        assert m.status().name == "NoError", m.status()
        write_stl(m, out / name)
        lo, hi = np.array(m.bounding_box()[:3]), np.array(m.bounding_box()[3:])
        print(f"{name}: {hi[0]-lo[0]:.1f} x {hi[1]-lo[1]:.1f} x {hi[2]-lo[2]:.1f} mm, volume {m.volume()/1000:.1f} cm3")


if __name__ == "__main__":
    main()
