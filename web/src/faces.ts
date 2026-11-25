// Amp faceplates, drawn to look like the amps the circuits come from: the
// cabinet covering, the panel and its lettering, the maker's logo where it
// sits on the real one. Plain HTML/CSS; the knobs are the rig's own.
import type { AmpInfo } from './amps.ts';

const div = (cls: string, html = '') => {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  return d;
};

const jewel = '<span class="jewel" aria-hidden="true"></span>';
const jack = '<span class="jack"></span>';
const toggle = '<span class="toggle"></span>';
const rocker = '<span class="rocker"></span>';
const screw = '<span class="screw"></span>';

/** A block of jacks with a caption under each column. */
const jacks = (cols: string[], rows = 1) =>
  `<div class="face-jacks" style="--cols:${cols.length}">${jack.repeat(cols.length * rows)}${cols.map((c) => `<small>${c}</small>`).join('')}</div>`;

/** Switches with a caption each, and the pilot lamp beside them. */
const switches = (labels: string[], sw = toggle) =>
  `<div class="face-switches" style="--cols:${labels.length}">${sw.repeat(labels.length)}${labels.map((l) => `<small>${l}</small>`).join('')}</div>`;

const lamp = (caption = '') => `<div class="face-lamp">${jewel}${caption ? `<small>${caption}</small>` : ''}</div>`;

// What each amp's panel says.
const plates: Record<string, string> = {
  'tweed-bass': 'Bassman',
  'blackpanel-22': 'Deluxe Reverb-Amp',
  'blackpanel-410': 'Super Reverb-Amp',
  'blackpanel-100': 'Twin Reverb-Amp',
  'brit-45': 'JTM 45',
  'brit-plexi': 'Super Lead',
  'brit-800': 'JCM 800',
  'brit-clean-100': 'Custom Hiwatt 100',
  'graphic-120': 'Graphic 120',
  'hotrod-100': 'Super Lead Overdrive',
  'boutique-ods': 'Overdrive Special',
  'classa-30': 'AC30',
};

/** Builds the face for `amp` around its knob elements. */
export function buildFace(amp: AmpInfo, knobs: HTMLElement[]): HTMLElement {
  const face = div(`face face-${amp.face}`);
  face.dataset.amp = amp.id;
  const row = div('face-knobs');
  row.append(...knobs);
  const plate = plates[amp.id] ?? amp.name;
  const panel = (cls: string, before: string, after: string) => {
    const p = div(`face-panel ${cls}`, before);
    p.append(row);
    p.insertAdjacentHTML('beforeend', after);
    return p;
  };

  switch (amp.face) {
    case 'plexi': {
      // Marshall plexi head: black levant, the white script, gold beading
      // over a brushed-gold panel. Switches left, the four inputs right.
      const jtm = amp.id === 'brit-45';
      face.append(
        div('mar-front', `<div class="mar-logo">Marshall</div>`),
        panel('mar-panel',
          `${switches(['POWER', 'STANDBY'])}${lamp()}
           <div class="mar-plate">${jtm ? '<b>JTM 45</b><small>MK II</small>' : '<b>JMP</b><small>SUPER LEAD<br>100W</small>'}</div>`,
          jacks(['I', 'II'], 2)));
      break;
    }
    case 'brit800': {
      // JCM800 2203: the same head, a framed panel, red rockers, the badge.
      face.append(
        div('mar-front', `<div class="mar-logo">Marshall</div>`),
        panel('mar-panel',
          `${switches(['POWER', 'STANDBY'], rocker)}`,
          `${jacks(['HIGH', 'LOW'])}
           <div class="jcm-plate"><b>JCM 800</b><small>LEAD SERIES</small><i>MODEL 2203 · MASTER VOLUME</i></div>`));
      break;
    }
    case 'classa': {
      // Vox AC30: the copper control panel on top, black covering with gold
      // beading, brown diamond cloth, the gold logo.
      face.append(
        panel('vox-panel',
          `<div class="vox-plate"><b>VOX</b><small>AC30 · TOP BOOST</small></div>${jacks(['BRILLIANT', 'NORMAL'], 2)}`,
          `${switches(['STANDBY', 'MAINS'])}${lamp()}`),
        div('vox-band', ''),
        div('vox-grille', `<div class="vox-logo">VOX</div>`));
      break;
    }
    case 'britclean': {
      // Hiwatt DR103: black covering, the logo plate, white piping round a
      // black panel with white engraved lettering.
      face.append(
        div('hw-front', `<div class="hw-logo">HIWATT</div>`),
        panel('hw-panel',
          jacks(['NORMAL', 'BRILL'], 2),
          `<div class="face-stack"><div class="hw-plate"><b>CUSTOM HIWATT 100</b><small>HYLIGHT ELECTRONICS · ENGLAND</small></div>
           <div class="face-side">${switches(['STANDBY', 'MAINS'])}${lamp()}</div></div>`));
      break;
    }
    case 'graphic': {
      // Orange Graphic: orange covering, the white panel in its black frame,
      // the logo across the top of it.
      const p = panel('or-panel', jacks(['HI', 'LO']), `${switches(['STANDBY', 'POWER'])}${lamp()}`);
      p.insertAdjacentHTML('afterbegin', `<div class="or-head"><span class="or-logo">Orange</span><small>GRAPHIC 120</small></div>`);
      face.append(p);
      break;
    }
    case 'hotrod': {
      // Soldano SLO-100: black covering and grille, the chrome script, a
      // brushed panel with black lettering.
      face.append(
        div('so-front', `<div class="so-logo">Soldano</div>`),
        panel('so-panel',
          `${jacks(['INPUT'])}`,
          `<div class="face-stack"><div class="so-plate"><b>SLO-100</b><small>SUPER LEAD OVERDRIVE</small></div>${lamp()}</div>`));
      break;
    }
    case 'boutique': {
      // Dumble Overdrive Special: black covering, the cream script, a black
      // panel with white lettering and a single input.
      face.append(
        div('du-front', `<div class="du-logo">Dumble</div><div class="du-plate">Overdrive Special</div>`),
        panel('du-panel', `${jacks(['INPUT'])}`, lamp()));
      break;
    }
    case 'blackpanel': {
      // Fender blackface combo: black covering, the black panel with white
      // lettering and the model in script, silver sparkle cloth, the raised
      // chrome logo at the top left of it.
      face.append(
        panel('bf-panel',
          `${jacks(['1', '2'])}`,
          `${lamp()}<div class="bf-plate"><b>${plate}</b><small>FENDER ELECT. INST. CO.</small></div>`),
        div('bf-grille', `<div class="bf-logo">Fender</div>`));
      face.querySelector('.face-jacks')!.insertAdjacentHTML('afterbegin', '<em>VIBRATO</em>');
      break;
    }
    default: {
      // Fender tweed Bassman: lacquered tweed, the chrome panel, oxblood
      // cloth with the script nameplate.
      face.append(
        panel('tw-panel',
          `${switches(['POWER', 'STANDBY'])}${lamp()}`,
          `${jacks(['BRIGHT', 'NORMAL'], 2)}
           <div class="tw-plate"><b>${plate}</b><small>FENDER ELECTRIC<br>INSTRUMENT CO.</small></div>`),
        div('tw-grille', `<div class="tw-logo"><span>Fender</span></div>`));
    }
  }
  face.querySelectorAll('.face-panel').forEach((p) => p.insertAdjacentHTML('beforeend', screw.repeat(4)));
  return face;
}
