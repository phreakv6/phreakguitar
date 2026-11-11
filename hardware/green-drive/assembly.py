"""
The soldering map: every part's outline with its reference and value,
polarity marked. python3 assembly.py -> out/assembly.pdf and out/assembly.png

Left: the component side, where everything but the pots and the LED goes.
Right: the back, seen from the back (the pots and the LED go here).
Reads out/placement.json, which pcb.py writes.
"""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Circle, FancyBboxPatch, Rectangle  # noqa: E402

HERE = Path(__file__).resolve().parent

COLOURS = {  # footprint prefix -> body colour
    "R_Axial": "#f3dfb8", "C_Film": "#cfe8c8", "C_Disc": "#f7d8a8", "CP_Radial": "#c8daf3",
    "D_DO": "#e2e2e2", "TO-92": "#d6d6d6", "DIP": "#d6d6d6", "Pot": "#eeeeee", "LED": "#f6c8c8",
    "SolderWire": "#ffffff",
}
POLARITY = {  # footprint prefix -> {pad number: mark}
    "CP_Radial": {"1": "+"}, "D_DO": {"1": "K"}, "LED": {"1": "K"},
    "TO-92": {"1": "E", "2": "C", "3": "B"}, "DIP": {"1": "1"},
}


def colour(fp):
    return next((c for k, c in COLOURS.items() if fp.startswith(k)), "#eeeeee")


def draw(ax, parts, board, back):
    W, H = board
    fx = (lambda x: W - x) if back else (lambda x: x)
    ax.add_patch(Rectangle((0, 0), W, H, fill=False, lw=1.2, ec="#333"))
    for p in parts:
        if p["back"] != back and not p["footprint"].startswith("SolderWire"):
            # parts on the other side: just their pads, faintly
            for pad in p["pads"]:
                ax.add_patch(Circle((fx(pad["x"]), pad["y"]), 0.5, fc="#ddd", ec="none"))
            continue
        x1, y1, x2, y2 = p["box"]
        if back:
            x1, x2 = fx(x2), fx(x1)
        fp = p["footprint"]
        if fp.startswith("Pot"):
            sx = sum(pd["x"] for pd in p["pads"]) / 3
            sy = p["pads"][0]["y"] - 7.5
            ax.add_patch(Circle((fx(sx), sy), 8, fc=colour(fp), ec="#555", lw=0.8))
            ax.add_patch(Circle((fx(sx), sy), 3.5, fc="white", ec="#555", lw=0.6))
            name = {"RV1": "DRIVE", "RV2": "TONE", "RV3": "LEVEL"}.get(p["ref"], "")
            ax.text(fx(sx), sy - 5.2, f"{name}\n{p['ref']} {p['value']}", ha="center", va="center", fontsize=6.5, weight="bold")
        elif not fp.startswith("SolderWire"):
            ax.add_patch(FancyBboxPatch((x1 + 0.3, y1 + 0.3), x2 - x1 - 0.6, y2 - y1 - 0.6,
                                        boxstyle="round,pad=0,rounding_size=0.6", fc=colour(fp), ec="#555", lw=0.6))
        marks = next((m for k, m in POLARITY.items() if fp.startswith(k)), {})
        off = (0.0, -1.25)
        if fp.startswith("TO-92"):
            # The flat face: KiCad's TO-92 has it 1.85 mm off the pad row on
            # the side away from the round body. Draw it, and put E/C/B on
            # the round side so they never overlap.
            pd = {q["num"]: (fx(q["x"]), q["y"]) for q in p["pads"]}
            ux, uy = pd["3"][0] - pd["1"][0], pd["3"][1] - pd["1"][1]
            n = (ux * ux + uy * uy) ** 0.5
            ux, uy = ux / n, uy / n
            nx, ny = (-uy, ux) if not back else (uy, -ux)
            a = (pd["1"][0] - 0.6 * ux + 1.85 * nx, pd["1"][1] - 0.6 * uy + 1.85 * ny)
            b = (pd["1"][0] + 3.1 * ux + 1.85 * nx, pd["1"][1] + 3.1 * uy + 1.85 * ny)
            ax.plot([a[0], b[0]], [a[1], b[1]], color="#222", lw=2.2, solid_capstyle="butt")
            off = (-1.45 * nx, -1.45 * ny)
        for pad in p["pads"]:
            px = fx(pad["x"])
            ax.add_patch(Circle((px, pad["y"]), 0.55, fc="#b87333", ec="#5a3a1a", lw=0.3))
            m = marks.get(pad["num"])
            if m:
                ax.text(px + off[0], pad["y"] + off[1], m, ha="center", va="center", fontsize=5.5, weight="bold", color="#b00000")
        if fp.startswith("SolderWire"):
            pad = p["pads"][0]
            ax.text(fx(pad["x"]), pad["y"] - 1.6, p["value"], ha="center", fontsize=6.5, weight="bold")
            continue
        if fp.startswith("Pot"):
            continue
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        vertical = (y2 - y1) > (x2 - x1) * 1.2
        ax.text(cx, cy, f"{p['ref']}\n{p['value']}", ha="center", va="center", fontsize=5.2,
                rotation=90 if vertical else 0, linespacing=1.0)
    ax.set_xlim(-2, W + 2)
    ax.set_ylim(H + 2, -2)
    ax.set_aspect("equal")
    ax.axis("off")


def main():
    data = json.loads((HERE / "out" / "placement.json").read_text())
    fig, axes = plt.subplots(1, 2, figsize=(11.7, 6.6))
    draw(axes[0], data["parts"], data["board"], back=False)
    axes[0].set_title("Component side: solder everything here first", fontsize=10)
    draw(axes[1], data["parts"], data["board"], back=True)
    axes[1].set_title("Back (faces the lid): pots and LED, last", fontsize=10)
    fig.suptitle("Green Drive: soldering map", fontsize=13, weight="bold")
    fig.text(0.5, 0.02, "+ = electrolytic's long leg   K = diode band / LED flat side   E C B = transistor legs, "
             "thick line = its flat face   1 = op-amp notch end", ha="center", fontsize=8, color="#b00000")
    fig.tight_layout(rect=(0, 0.04, 1, 0.95))
    for ext in ("pdf", "png"):
        fig.savefig(HERE / "out" / f"assembly.{ext}", dpi=200)
    print("wrote out/assembly.pdf and out/assembly.png")


if __name__ == "__main__":
    main()
