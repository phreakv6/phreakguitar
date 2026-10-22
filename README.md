# PhreakGuitar

A guitar rig in your browser, built on circuit simulation. Plug in an audio
interface and play through amps and pedals whose analog circuits are solved
in real time: every resistor, capacitor, diode, transistor and tube, the same
netlists a SPICE simulator runs, checked against ngspice.

**Live:** https://phreakguitar.com

## What's in it

- **11 amps** as circuit models: tweed, black-panel, British plexi and
  master-volume, class A, high-headroom, graphic-panel, boutique overdrive
  (plus an experimental hot-rod high-gain head). Each has its own power
  section with a simulated power supply that sags and recovers, a Response
  knob, and a glowing tube view.
- **12 pedals**: wah, clean and treble boosters, silicon and germanium
  round fuzz, octave fuzz, two overdrives, a distortion, a four-stage
  phaser (with its LFO in the circuit), a photocell vibe (a measured DSP
  model, the one pedal that isn't a solved circuit) and a four-stage
  fuzz; plus a compressor, 7-band EQ, digital delay, reverb and a looper.
- **Song tones and factory presets**, level-matched, with notes on how to
  play them; save, compare (A/B), export and import your own.
- **Pedal designer**: fork any pedal, swap parts and models, add parts on the
  schematic, probe any point with a live scope, hear each change as you play.
- **Tabs beside the rig**: open Guitar Pro or MusicXML files, play along
  with a cursor, slow it down, loop a section, mute your part.
- **Stage view**, keyboard shortcuts, a tuner, cab IRs (built-in or your
  own WAV files), and a latency readout with a loopback measurement.

## Using it

- Use an audio interface and headphones or speakers. A laptop's built-in
  microphone and speakers will feed back.
- Chrome or Edge on a desktop is best (they let you pick the output
  device). Safari and Firefox mostly work.
- Your audio never leaves your computer: everything runs in the browser, and
  presets, IRs and tabs are stored in it. The public site counts anonymous
  usage (page views, power on/off, which amps, pedals and presets get picked)
  with PostHog: no cookies, no recordings, no file names. Add `?notrack` to
  the address to opt out; builds you run yourself send nothing.

## Running it locally

You need [Node.js](https://nodejs.org) 20+ and
[Emscripten](https://emscripten.org/docs/getting_started/downloads.html)
(installed to `~/emsdk`, or with `em++` on your `PATH`).

```sh
cd web
npm install
npm run dev        # builds the engine to WebAssembly, then serves the app
```

Open the printed URL (http://localhost:5173). The dev server also lists
cab IRs from `~/Music/PhreakGuitar/IRs` and tab files from
`~/Music/PhreakGuitar/Tabs` and `~/Downloads`.

The native build (unit tests, the offline render tool, a JUCE plugin) uses
CMake 3.24+ and a C++20 compiler; it fetches JUCE and Catch2:

```sh
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
ctest --test-dir build -C Release
tools/run_checks.sh   # the full suite; circuit checks need ngspice
```

## How it works

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the nodal DK-method
solver, circuits as SPICE files, amps and power supplies, the browser
engine. What's next: [docs/ROADMAP.md](docs/ROADMAP.md).

## License

GPLv3, see [LICENSE](LICENSE). Third-party components and their licenses:
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Amp and pedal models are named for the kind of gear they are. Where source
comments mention original products or circuits, the names are trademarks of
their owners, used only to identify what a model is based on. PhreakGuitar is
not affiliated with or endorsed by any manufacturer.
