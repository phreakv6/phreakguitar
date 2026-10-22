# Roadmap

What's built is in the README. What's next, roughly in order:

## Make the Hot Rod 100 playable

The late-80s high-gain amp is modelled and checked against ngspice, but it's
too heavy for real-time on real playing (five cascaded triode stages near
cutoff, where the tube curve is sharp, so Newton needs ~2.4 steps a sample)
and at 4x oversampling it aliases more than the other amps. It is listed
only with `?experimental`.

Plan: solve the preamp stage by stage. Signal flows forward; only
grid-current diodes couple a stage back to the one before, so the joint
solve is needed only while a grid conducts. Same answer, far less work;
then run it at 8x. Every amp gains.

## Song setups

Pick a song, get the tab and the rig for it: amp, pedals, cab, every knob.
Builds on the tab player and the song-tone presets.

## Match a record

Separate the guitar from a recording you own (e.g. Demucs), play the same
part, and search the rig for the closest match: starting points chosen
from the measured tone, then a numeric search over the knobs, comparing
the tone curve, distortion against picking strength, dynamics and
time-based effects.

## An assistant that builds presets

A preset is small structured data. An MCP server could expose the gear list
(every amp, pedal and knob, from the circuit files), apply and save presets
in an open tab, and run the loudness check, so a model can build or adjust a
tone from a description while you play.

## Small things

- Delay time shown in milliseconds; a tremolo pedal for any amp.
- Probes and a scope for amps, not only pedals.
- Designed pedal to hardware: parts list with part numbers, KiCad export,
  a stripboard layout.
- Sharing: publish a pedal or preset as a link.
