"""
Route the board with Freerouting, then pour the ground and save.
Runs in KiCad's own Python:

    /Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/3.9/bin/python3.9 route.py /path/to/freerouting.jar

pcb.py writes out/green-drive.dsn; Freerouting (headless) routes it into
out/green-drive.ses; this imports the tracks into green-drive.kicad_pcb
and fills the ground zones.
"""

import subprocess
import sys
from pathlib import Path

import pcbnew

HERE = Path(__file__).resolve().parent
JAVA = "/opt/homebrew/opt/openjdk/bin/java"


def main():
    jar = sys.argv[1]
    dsn, ses = HERE / "out" / "green-drive.dsn", HERE / "out" / "green-drive.ses"
    ses.unlink(missing_ok=True)
    subprocess.run([JAVA, "-jar", jar, "-de", str(dsn), "-do", str(ses), "-mp", "40",
                    "--gui.enabled=false", "--usage_and_diagnostic_data.disable_analytics=true"], check=True)
    if not ses.exists():
        raise SystemExit("Freerouting wrote no session file")

    path = str(HERE / "green-drive.kicad_pcb")
    board = pcbnew.LoadBoard(path)
    if not pcbnew.ImportSpecctraSES(board, str(ses)):
        raise SystemExit("importing the routed session failed")
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())
    pcbnew.SaveBoard(path, board)
    print("routed:", len([t for t in board.GetTracks() if t.GetClass() == "PCB_TRACK"]), "tracks,",
          len([t for t in board.GetTracks() if t.GetClass() == "PCB_VIA"]), "vias")


if __name__ == "__main__":
    main()
