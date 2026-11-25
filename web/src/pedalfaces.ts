// What's printed on each pedal, after the pedal its circuit comes from: the
// logo and lettering between the knobs and the footswitch, and the line at
// the foot of the enclosure. The enclosures themselves are in style.css
// (.stomp[data-pedal=...]).

export interface PedalArt { art: string; foot: string }

let arcs = 0;

/** The printing for the pedal whose look is `look` (a factory pedal id). */
export function pedalArt(look: string): PedalArt {
  switch (look) {
    case 'green-drive':
      return {
        art: `<div class="ts-name"><b>TUBE SCREAMER</b><small>Overdrive Pro<i>TS808</i></small></div>`,
        foot: `<span class="ts-maker">Ibanez</span>`,
      };
    case 'gold-horse':
      return { art: '', foot: `<span class="klon-name"><b>KLON</b><b>CENTAUR</b></span>` };
    case 'rodent':
      return { art: `<div class="rat-logo"><i>Pro<br>Co</i><b>RAT</b></div>`, foot: '' };
    case 'orange-phaser':
      return { art: `<div class="mxr-script">MXR</div>`, foot: `<span class="mxr-model">Phase 90</span>` };
    case 'clean-boost':
      return {
        art: `<div class="lpb-label"><b>LPB-1</b><small>LINEAR POWER BOOSTER</small></div>`,
        foot: `<span class="ehx-maker">electro-harmonix</span>`,
      };
    case 'treble-boost':
      return { art: `<div class="rm-name"><i>Dallas</i><b>RANGEMASTER</b><small>TREBLE BOOSTER</small></div>`, foot: '' };
    case 'round-fuzz':
    case 'round-fuzz-ge': {
      const id = `ff-arc-${arcs++}`;
      return {
        art: `<svg class="ff-name" viewBox="0 0 200 54" aria-hidden="true"><path id="${id}" d="M14 50 Q100 2 186 50" fill="none" />
                <text><textPath href="#${id}" startOffset="50%">FUZZ FACE</textPath></text></svg>`,
        foot: `<span class="ff-maker">DALLAS · ARBITER · ENGLAND</span>`,
      };
    }
    case 'octave-fuzz':
      return { art: `<div class="oct-name"><b>OCTAVIA</b><small>TYCOBRAHE SOUND COMPANY</small></div>`, foot: '' };
    case 'photo-vibe':
      return { art: `<div class="uv-name">Uni-Vibe</div>`, foot: '' };
    case 'ram-fuzz':
      return {
        art: `<div class="bm-logo"><b>BIG MUFF</b><i>π</i></div><div class="bm-black"></div>`,
        foot: `<span class="ehx-maker">electro-harmonix</span>`,
      };
    case 'classic-wah':
      return { art: `<div class="wah-tread"><span>VOX</span></div>`, foot: `<span class="wah-model">WAH-WAH · V846</span>` };
    default:
      return { art: '', foot: '' };
  }
}
