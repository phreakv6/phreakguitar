# Third-party software and assets

PhreakGuitar is licensed under the GNU General Public License v3 (see
`LICENSE`). It uses the following, each under its own license.

## Shipped with the web app

| Component | Use | License |
|---|---|---|
| [alphaTab](https://github.com/CoderLine/alphaTab) (`@coderline/alphatab`) | Renders and plays tabs (Guitar Pro, MusicXML) | MPL-2.0 |
| Bravura music font (bundled with alphaTab) | Notation glyphs | SIL Open Font License 1.1 (© Steinberg Media Technologies GmbH) |
| SONiVOX EAS soundfont `sonivox.sf2` (bundled with alphaTab) | Tab playback sounds | Apache License 2.0 (© Sonic Network Inc.) |
| [Oswald](https://fonts.google.com/specimen/Oswald), [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) (Google Fonts) | UI typefaces | SIL Open Font License 1.1 |

## Used to build

| Component | Use | License |
|---|---|---|
| [JUCE](https://juce.com) 8 (fetched by CMake) | The native plugin and the offline render tool | GPLv3 (or JUCE's commercial license) |
| [Catch2](https://github.com/catchorg/Catch2) (fetched by CMake) | Unit tests | Boost Software License 1.0 |
| [Emscripten](https://emscripten.org) | Compiles the engine to WebAssembly | MIT / University of Illinois NCSA |
| [Vite](https://vitejs.dev), [TypeScript](https://www.typescriptlang.org), `@coderline/alphatab-vite` | Web build | MIT / Apache-2.0 / MPL-2.0 |
| [ngspice](https://ngspice.sourceforge.io) (optional, not bundled) | Reference simulator the circuit engine is checked against | BSD-3-Clause |

## Research and references

The circuit models follow published circuits and analyses, credited in
each file under `amps/` and `pedals/`, notably ElectroSmash's pedal
analyses, R.G. Keen's "The Technology of Wah Pedals", and Aion FX's build
documentation. DSP models cite their papers in the source:

- D.T. Yeh and J.O. Smith, "Discretization of the '59 Fender Bassman Tone
  Stack", DAFx-06 (`engine/amp/ToneStack.h`).
- C. Darabundit, R. Wedelich and P. Bischoff, "Digital Grey Box Model of the
  Uni-Vibe Effects Pedal", DAFx-19 (`engine/fx/PhotoVibe.cpp`).
- D.T. Yeh, J.S. Abel and J.O. Smith, "Automated Physical Modeling of
  Nonlinear Audio Circuits for Real-Time Audio Effects" (the DK method,
  `engine/circuit/DKSolver.h`).

## Names

Product names that appear in those citations and in circuit
descriptions (amplifier and pedal models, component part numbers) are
trademarks of their respective owners. They are used only to identify the
circuits and research the models are based on. PhreakGuitar is not
affiliated with, sponsored or endorsed by any of them.
