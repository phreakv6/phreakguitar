"""
Lay out the Green Drive board. Runs in KiCad's own Python:

    /Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/3.9/bin/python3.9 pcb.py

Reads out/green-drive.net (build.py exports it from the schematic, so the
board's connections are the schematic's), places the parts and writes
green-drive.kicad_pcb with the outline, ground pours and design rules, plus
out/green-drive.dsn for the autorouter.

The pots, the LED, the wire pads and the mounting holes go where layout.py
says (the box is drilled to match). Everything else is placed by simulated
annealing: short connections, no overlaps, nothing with leads under a pot
body (the pots sit on the back and their metal cases would rest on the
joints).
"""

import math
import random
import re
import sys
from pathlib import Path

import pcbnew

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import layout  # noqa: E402

FOOTPRINTS = Path("/Applications/KiCad/KiCad.app/Contents/SharedSupport/footprints")
X0, Y0 = 100.0, 100.0           # board's top-left corner on the KiCad sheet
EDGE = 1.0                      # keep parts this far inside the edge
GAP = 0.6                       # extra space between courtyards
GRID = 0.635
SEED = 7

# Net weights for the placer: ground and the supply are poured / easy.
NET_WEIGHT = {"GND": 0.05, "VCC": 0.3, "VREF": 0.6}
POWER_NETS = {"GND", "VCC", "V9_IN"}


def mm(v):
    return pcbnew.FromMM(v)


def pt(x, y):
    return pcbnew.VECTOR2I(mm(X0 + x), mm(Y0 + y))


def read_netlist(path):
    """Components (value, footprint, description, symbol uuid) and nets
    (full names as the schematic gives them, e.g. "/IN")."""
    text = Path(path).read_text()
    comps = {}
    for chunk in re.split(r"\(comp\s", text)[1:]:
        f = lambda key: (re.search(r'\(%s "([^"]*)"\)' % key, chunk) or [None, ""])[1]
        desc = re.search(r'\(name "Description"\)\s*"([^"]*)"\)', chunk)
        comps[f("ref")] = (f("value"), f("footprint"), desc.group(1) if desc else "", f("tstamps"))
    nets = {}
    for chunk in re.split(r"\(net\s+\(code", text)[1:]:
        name = re.search(r'\(name "([^"]*)"\)', chunk).group(1)
        for ref, pin in re.findall(r'\(node\s+\(ref "([^"]+)"\)\s+\(pin "([^"]+)"\)', chunk):
            nets.setdefault(name, []).append((ref, pin))
    return comps, nets


def set_description(fp, text):
    for f in fp.GetFields():
        if f.GetName() == "Description":
            f.SetText(text)
            return


def short(net):
    return net.lstrip("/")


def load_fp(fpid):
    lib, name = fpid.split(":")
    path = HERE / "green-drive.pretty" if lib == "green-drive" else FOOTPRINTS / f"{lib}.pretty"
    fp = pcbnew.FootprintLoad(str(path), name)
    if fp is None:
        raise SystemExit(f"footprint not found: {fpid}")
    return fp


def to_mm(v):
    return pcbnew.ToMM(v.x) - X0, pcbnew.ToMM(v.y) - Y0


def move_so(fp, anchor_xy, target_xy):
    """Shift fp so the point currently at anchor_xy lands on target_xy."""
    dx, dy = target_xy[0] - anchor_xy[0], target_xy[1] - anchor_xy[1]
    p = fp.GetPosition()
    fp.SetPosition(pcbnew.VECTOR2I(p.x + mm(dx), p.y + mm(dy)))


def pad_centre(fp, numbers=None):
    pads = [p for p in fp.Pads() if numbers is None or p.GetNumber() in numbers]
    xs = [to_mm(p.GetPosition()) for p in pads]
    return sum(x for x, _ in xs) / len(xs), sum(y for _, y in xs) / len(xs)


def shape(fp):
    """Courtyard box and pad offsets relative to the footprint's position,
    for its current orientation."""
    fp.BuildCourtyardCaches()
    cy = fp.GetCourtyard(pcbnew.F_CrtYd)
    bb = cy.BBox() if cy.OutlineCount() else fp.GetBoundingBox(False)
    px, py = to_mm(fp.GetPosition())
    x1, y1 = pcbnew.ToMM(bb.GetX()) - X0 - px, pcbnew.ToMM(bb.GetY()) - Y0 - py
    box = (x1, y1, x1 + pcbnew.ToMM(bb.GetWidth()), y1 + pcbnew.ToMM(bb.GetHeight()))
    pads, every = {}, []
    for p in fp.Pads():
        x, y = to_mm(p.GetPosition())
        pads.setdefault(p.GetNumber(), (x - px, y - py))
        every.append((x - px, y - py))
    return box, pads, every


class Placer:
    def __init__(self, movable, fixed_boxes, pins, keep_circles):
        self.ids = list(movable)                  # ref -> {rot: (box, pads)}
        self.shapes = movable
        self.fixed = fixed_boxes                  # [(x1,y1,x2,y2)]
        self.pins = pins                          # net -> [(ref, pin, fixed_xy or None)]
        self.circles = keep_circles
        self.state = {}
        rnd = random.Random(SEED)
        self.rnd = rnd
        for ref in self.ids:
            self.state[ref] = (rnd.uniform(5, layout.BOARD_W - 5), rnd.uniform(25, layout.BOARD_H - 8), rnd.choice((0, 90)))
        self.ref_nets = {}
        for net, members in pins.items():
            for ref, _pin, _xy in members:
                self.ref_nets.setdefault(ref, set()).add(net)

    def box(self, ref, st=None):
        x, y, r = st or self.state[ref]
        b = self.shapes[ref][r][0]
        return (x + b[0], y + b[1], x + b[2], y + b[3])

    def pin_xy(self, ref, pin, st=None):
        x, y, r = st or self.state[ref]
        ox, oy = self.shapes[ref][r][1][pin]
        return x + ox, y + oy

    def net_cost(self, net):
        pts = []
        for ref, pin, xy in self.pins[net]:
            pts.append(xy if xy else self.pin_xy(ref, pin))
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return NET_WEIGHT.get(short(net), 1.0) * ((max(xs) - min(xs)) + (max(ys) - min(ys)))

    @staticmethod
    def overlap(a, b):
        w = min(a[2], b[2]) - max(a[0], b[0]) + GAP
        h = min(a[3], b[3]) - max(a[1], b[1]) + GAP
        return w * h if w > 0 and h > 0 else 0.0

    def part_cost(self, ref, st=None):
        b = self.box(ref, st)
        c = 0.0
        for other in self.ids:
            if other != ref:
                c += self.overlap(b, self.box(other))
        for f in self.fixed:
            c += self.overlap(b, f)
        # inside the board
        out = max(0, EDGE - b[0]) + max(0, EDGE - b[1]) + max(0, b[2] - (layout.BOARD_W - EDGE)) + max(0, b[3] - (layout.BOARD_H - EDGE))
        c += 20 * out
        # no pads under a pot body
        x, y, r = st or self.state[ref]
        for px, py in self.shapes[ref][r][2]:
            for cx, cy, rad in self.circles:
                d = math.hypot(x + px - cx, y + py - cy)
                if d < rad:
                    c += 10 * (rad - d)
        return c

    def run(self, steps=150000):
        T0, T1 = 8.0, 0.01
        for i in range(steps):
            T = T0 * (T1 / T0) ** (i / steps)
            self.w = 5 + 400 * (i / steps) ** 2   # overlaps matter more and more
            ref = self.rnd.choice(self.ids)
            old = self.state[ref]
            span = max(1.0, 25.0 * T / T0)
            if self.rnd.random() < 0.15:
                new = (old[0], old[1], self.rnd.choice((0, 90, 180, 270)))
            else:
                new = (old[0] + self.rnd.gauss(0, span), old[1] + self.rnd.gauss(0, span), old[2])
            new = (round(new[0] / GRID) * GRID, round(new[1] / GRID) * GRID, new[2])
            nets = self.ref_nets.get(ref, ())
            before = sum(self.net_cost(n) for n in nets) + self.w * self.part_cost(ref)
            self.state[ref] = new
            after = sum(self.net_cost(n) for n in nets) + self.w * self.part_cost(ref)
            d = after - before
            if d > 0 and self.rnd.random() >= math.exp(-d / T):
                self.state[ref] = old
        return {r: self.part_cost(r) for r in self.ids}


def pad_boxes(board, layer_side=None):
    """Bounding boxes (mm, board coords) of every pad, grown by 0.25 mm."""
    out = []
    for fp in board.GetFootprints():
        for pad in fp.Pads():
            bb = pad.GetBoundingBox()
            x1, y1 = pcbnew.ToMM(bb.GetX()) - X0, pcbnew.ToMM(bb.GetY()) - Y0
            out.append((x1 - 0.25, y1 - 0.25, x1 + pcbnew.ToMM(bb.GetWidth()) + 0.25, y1 + pcbnew.ToMM(bb.GetHeight()) + 0.25))
    return out


def hits(box, boxes):
    return any(box[0] < b[2] and b[0] < box[2] and box[1] < b[3] and b[1] < box[3] for b in boxes)


def text_box(cx, cy, text, size, vertical):
    w, h = len(text) * size * 0.9 + 0.3, size + 0.3
    if vertical:
        w, h = h, w
    return (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)


def place_label(fp, pads_all, taken, size=0.8):
    """Put the reference where it touches no pad and no other label: the
    body's middle first, then along it, then beside it."""
    box, _pads, _every = shape(fp)
    px, py = to_mm(fp.GetPosition())
    x1, y1, x2, y2 = px + box[0], py + box[1], px + box[2], py + box[3]
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    vertical = (y2 - y1) > (x2 - x1)
    text = fp.GetReference()
    cands = []
    along = [i * 0.5 for i in range(0, 14)]
    for d in along:
        for s in ((1,) if d == 0 else (1, -1)):
            cands.append((cx, cy + s * d, vertical) if vertical else (cx + s * d, cy, vertical))
    beside = []
    for d in (0.9, 1.4):   # beside the body
        if vertical:
            beside += [(x1 - d, cy, True), (x2 + d, cy, True)]
        else:
            beside += [(cx, y1 - d, False), (cx, y2 + d, False)]
    # Round parts (electrolytics, transistors) have markings all over their
    # outline: label them beside, horizontally.
    name = fp.GetFPID().GetLibItemName().wx_str()
    if name.startswith(("CP_Radial", "TO-92")):
        beside = [(cx, y1 - d, False) for d in (0.6, 1.0, 1.4)] + [(cx, y2 + d, False) for d in (0.6, 1.0, 1.4)] + \
                 [(x1 - d - len(text) * 0.4, cy, False) for d in (0.3, 0.8)] + [(x2 + d + len(text) * 0.4, cy, False) for d in (0.3, 0.8)]
        cands = beside
    else:
        cands += beside
    for x, y, v in cands:
        tb = text_box(x, y, text, size, v)
        if not hits(tb, pads_all) and not hits(tb, taken) and 0 < tb[0] and tb[2] < layout.BOARD_W and 0 < tb[1] and tb[3] < layout.BOARD_H:
            break
    else:
        x, y, v = cx, cy, vertical
        tb = text_box(x, y, text, size, v)
    ref = fp.Reference()
    ref.SetPosition(pt(x, y))
    ref.SetTextAngleDegrees(90 if v else 0)
    ref.SetTextSize(pcbnew.VECTOR2I(mm(size), mm(size)))
    ref.SetTextThickness(mm(0.12))
    taken.append(tb)


def clear_spot(text, size, pads_all, taken, y_from, y_to):
    """First spot on the board, scanning rows, where text touches no pad."""
    y = y_from
    while y <= y_to:
        x = layout.BOARD_W / 2
        for dx in [i * 0.5 for i in range(0, 40)]:
            for xx in (x + dx, x - dx):
                tb = text_box(xx, y, text, size, False)
                if tb[0] > 1 and tb[2] < layout.BOARD_W - 1 and not hits(tb, pads_all) and not hits(tb, taken):
                    taken.append(tb)
                    return xx, y
        y += 0.5
    return layout.BOARD_W / 2, y_from


def write_placement(fps, path):
    """Where each part went, for assembly.py's soldering map."""
    import json
    parts = []
    for ref, fp in sorted(fps.items()):
        box, _pads, _every = shape(fp)
        px, py = to_mm(fp.GetPosition())
        pads = []
        for p in fp.Pads():
            x, y = to_mm(p.GetPosition())
            pads.append({"num": p.GetNumber(), "x": round(x, 3), "y": round(y, 3),
                         "square": p.GetShape() in (pcbnew.PAD_SHAPE_RECTANGLE, pcbnew.PAD_SHAPE_ROUNDRECT)})
        parts.append({"ref": ref, "value": fp.GetValue(), "footprint": fp.GetFPID().GetLibItemName().wx_str(),
                      "back": fp.IsFlipped(), "rot": fp.GetOrientationDegrees(),
                      "box": [round(px + box[0], 3), round(py + box[1], 3), round(px + box[2], 3), round(py + box[3], 3)],
                      "pads": pads})
    Path(path).write_text(json.dumps({"board": [layout.BOARD_W, layout.BOARD_H], "parts": parts}, indent=1))


def add_text(board, text, x, y, layer, size=1.0, mirror=False):
    t = pcbnew.PCB_TEXT(board)
    t.SetText(text)
    t.SetPosition(pt(x, y))
    t.SetLayer(layer)
    t.SetTextSize(pcbnew.VECTOR2I(mm(size), mm(size)))
    t.SetTextThickness(mm(size * 0.15))
    if mirror:
        t.SetMirrored(True)
    board.Add(t)


def zone(board, net, layer, poly, name="", keepout=False):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer)
    if keepout:
        z.SetIsRuleArea(True)
        z.SetDoNotAllowVias(True)
        z.SetDoNotAllowTracks(False)
        z.SetDoNotAllowZoneFills(False)
        z.SetDoNotAllowPads(False)
        z.SetDoNotAllowFootprints(False)
        z.SetLayerSet(pcbnew.LSET.AllCuMask())
    else:
        z.SetNet(net)
        z.SetLocalClearance(mm(0.4))
        z.SetMinThickness(mm(0.3))
        z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
    z.SetZoneName(name)
    o = z.Outline()
    o.NewOutline()
    for x, y in poly:
        o.Append(mm(X0 + x), mm(Y0 + y))
    board.Add(z)
    return z


def main():
    comps, nets = read_netlist(HERE / "out" / "green-drive.net")
    board = pcbnew.BOARD()
    ds = board.GetDesignSettings()
    ds.SetCopperLayerCount(2)
    ds.m_TrackMinWidth = mm(0.25)
    ds.m_MinClearance = mm(0.2)
    ds.m_ViasMinSize = mm(0.6)
    ds.m_MinThroughDrill = mm(0.3)
    nc = ds.m_NetSettings.GetDefaultNetclass()
    nc.SetTrackWidth(mm(0.4))
    nc.SetClearance(mm(0.25))
    nc.SetViaDiameter(mm(0.9))
    nc.SetViaDrill(mm(0.45))

    netinfo = {}
    for name in nets:
        ni = pcbnew.NETINFO_ITEM(board, name)
        board.Add(ni)
        netinfo[name] = ni
    pad_net = {(ref, pin): name for name, members in nets.items() for ref, pin in members}

    fps = {}
    for ref, (value, fpid, desc, sym_uuid) in comps.items():
        fp = load_fp(fpid)
        fp.SetFPID(pcbnew.LIB_ID(*fpid.split(":")))
        fp.SetReference(ref)
        fp.SetValue(value)
        fp.SetPath(pcbnew.KIID_PATH("/" + sym_uuid))
        fp.SetSheetname("/")
        fp.SetSheetfile("green-drive.kicad_sch")
        set_description(fp, desc)
        fp.SetPosition(pt(0, 0))
        board.Add(fp)
        for p in fp.Pads():
            n = pad_net.get((ref, p.GetNumber()))
            if n:
                p.SetNet(netinfo[n])
        fp.Reference().SetTextSize(pcbnew.VECTOR2I(mm(0.8), mm(0.8)))
        fp.Reference().SetTextThickness(mm(0.12))
        fps[ref] = fp

    fixed_boxes, keep = [], []
    flip = pcbnew.FLIP_DIRECTION_LEFT_RIGHT

    # Pots on the back, shafts where layout.py says.
    for ref, (sx, sy) in layout.POTS.items():
        fp = fps[ref]
        fp.Flip(fp.GetPosition(), flip)
        move_so(fp, pad_centre(fp, {"2"}), (sx, sy + layout.POT_SHAFT_OFFSET))
        keep.append((sx, sy, layout.POT_KEEPOUT_R))
        fixed_boxes.append((sx - 7, sy + layout.POT_SHAFT_OFFSET - 1.6, sx + 7, sy + layout.POT_SHAFT_OFFSET + 1.6))
        label = {"RV1": "DRIVE", "RV2": "TONE", "RV3": "LEVEL"}[ref]
        add_text(board, label, sx, sy - 1.5, pcbnew.B_SilkS, 1.2, mirror=True)
    # LED on the back
    fp = fps["LED1"]
    fp.Flip(fp.GetPosition(), flip)
    move_so(fp, pad_centre(fp), layout.LED)
    lx, ly = layout.LED
    fixed_boxes.append((lx - 3.2, ly - 3.2, lx + 3.2, ly + 3.2))
    # Wire pads along the bottom
    n = len(layout.PADS)
    for i, ref in enumerate(layout.PADS):
        x = 6 + i * (layout.BOARD_W - 12) / (n - 1)
        move_so(fps[ref], pad_centre(fps[ref]), (x, layout.PADS_Y))
        fixed_boxes.append((x - 2.5, layout.PADS_Y - 2.5, x + 2.5, layout.PADS_Y + 2.5))
        add_text(board, layout.PAD_LABELS[ref], x, layout.PADS_Y - 2.6, pcbnew.F_SilkS, 0.9)
        fps[ref].Reference().SetVisible(False)
    fixed_refs = set(layout.POTS) | {"LED1"} | set(layout.PADS)
    movable = {}
    for ref, fp in fps.items():
        if ref in fixed_refs:
            continue
        shapes = {}
        for rot in (0, 90, 180, 270):
            fp.SetOrientationDegrees(rot)
            shapes[rot] = shape(fp)
        movable[ref] = shapes

    pins = {}
    for name, members in nets.items():
        lst = []
        for ref, pin in members:
            if ref in fixed_refs:
                p = [p for p in fps[ref].Pads() if p.GetNumber() == pin][0]
                lst.append((ref, pin, to_mm(p.GetPosition())))
            else:
                lst.append((ref, pin, None))
        if len(lst) > 1:
            pins[name] = lst

    best = None
    for attempt in range(4):
        global SEED
        SEED = 7 + attempt
        pl = Placer(movable, fixed_boxes, pins, keep)
        bad = pl.run()
        worst = max(bad.values())
        wl = sum(pl.net_cost(nn) for nn in pins)
        print(f"placement {attempt}: wirelength {wl:.0f}, worst overlap {worst:.3f}")
        if best is None or (worst, wl) < (best[0], best[1]):
            best = (worst, wl, dict(pl.state))
        if worst == 0 and attempt >= 1:
            break
    worst, wl, state = best
    if worst > 0:
        print("WARNING: parts still overlap; see DRC")

    for ref, (x, y, r) in state.items():
        fp = fps[ref]
        fp.SetOrientationDegrees(r)
        fp.SetPosition(pt(x, y))
    pads_all, taken = pad_boxes(board), []
    for ref in sorted(state):
        place_label(fps[ref], pads_all, taken)

    # Outline, rounded a little
    W, H, R = layout.BOARD_W, layout.BOARD_H, 2.0
    seg = pcbnew.PCB_SHAPE(board)
    seg.SetShape(pcbnew.SHAPE_T_RECTANGLE)
    seg.SetStart(pt(0, 0))
    seg.SetEnd(pt(W, H))
    seg.SetLayer(pcbnew.Edge_Cuts)
    seg.SetWidth(mm(0.1))
    board.Add(seg)

    # Ground on both layers; no vias under the pots (their cases sit there).
    rect = [(0, 0), (W, 0), (W, H), (0, H)]
    zone(board, netinfo["/GND"], pcbnew.F_Cu, rect, "GND top")
    zone(board, netinfo["/GND"], pcbnew.B_Cu, rect, "GND bottom")
    # A no-track band round the edge (Freerouting doesn't get the edge rule).
    band = 1.0
    for x1, y1, x2, y2 in ((0, 0, W, band), (0, H - band, W, H), (0, 0, band, H), (W - band, 0, W, H)):
        z = zone(board, None, pcbnew.F_Cu, [(x1, y1), (x2, y1), (x2, y2), (x1, y2)], "edge band", keepout=True)
        z.SetDoNotAllowTracks(True)
    for cx, cy, rad in keep:
        circle = [(cx + rad * math.cos(a * math.pi / 12), cy + rad * math.sin(a * math.pi / 12)) for a in range(24)]
        zone(board, None, pcbnew.B_Cu, circle, "no vias under pot", keepout=True)

    # The name goes on the back: only the pots and the LED live there.
    back = []   # labels on the back only compete with each other
    x, y = clear_spot("GREEN DRIVE", 2.0, pads_all, back, 24, 58)
    add_text(board, "GREEN DRIVE", x, y, pcbnew.B_SilkS, 2.0, mirror=True)
    x, y = clear_spot("phreakguitar v1", 1.0, pads_all, back, y + 2.2, 60)
    add_text(board, "phreakguitar v1", x, y, pcbnew.B_SilkS, 1.0, mirror=True)

    write_placement(fps, HERE / "out" / "placement.json")

    board.SetFileName(str(HERE / "green-drive.kicad_pcb"))
    pcbnew.SaveBoard(str(HERE / "green-drive.kicad_pcb"), board)
    pcbnew.ExportSpecctraDSN(board, str(HERE / "out" / "green-drive.dsn"))
    print("wrote green-drive.kicad_pcb and out/green-drive.dsn")


if __name__ == "__main__":
    main()
