// Amp faceplates: each amp family's look (tweed, black panel, gold panel,
// copper top, white piping, cream-and-orange, boutique black, chrome), with
// the amp's own name where a maker's logo would sit. Plain HTML/CSS; the
// knobs are the rig's own.
import type { AmpInfo } from './amps.ts';

const div = (cls: string, html = '') => {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  return d;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Builds the face for `amp` around its knob elements. */
export function buildFace(amp: AmpInfo, knobs: HTMLElement[]): HTMLElement {
  const face = div(`face face-${amp.face}`);
  const row = div('face-knobs');
  row.append(...knobs);
  const jewel = '<span class="jewel" aria-hidden="true"></span>';
  const name = esc(amp.name);
  const model = esc(amp.model);
  const maker = '<small class="face-maker">PhreakGuitar</small>';
  const jacks = (labels: string[]) =>
    `<div class="face-inputs">${labels.map(() => '<span class="jack"></span>').join('')}${labels.map((l) => `<small>${l}</small>`).join('')}</div>`;

  switch (amp.face) {
    case 'plexi':
    case 'brit800': {
      // Brushed gold panel over black: two inputs, standby and power, the lamp.
      const panel = div('px-panel', jacks(amp.face === 'brit800' ? ['HIGH', 'LOW'] : ['HIGH', 'NORMAL']));
      panel.append(row, div('px-switches', `<span class="toggle"></span><span class="toggle"></span>
          <small>STANDBY</small><small>ON</small>${jewel}`));
      face.append(panel, div('px-front', `<div class="px-logo">${name}</div><div class="px-model">${model}</div>${maker}`));
      break;
    }
    case 'classa': {
      // Copper top panel, diamond grille.
      const panel = div('ca-panel', `<div class="ca-panel-label"><b>${name}</b></div>`);
      panel.append(row, div('ca-lamp', `${jewel}<small>${model}</small>`));
      face.append(panel, div('ca-grille', `<div class="ca-logo">${name}</div>${maker}`));
      break;
    }
    case 'britclean': {
      // Black panel, white engraved lettering, white piping.
      const panel = div('bc-panel', jacks(['NORMAL', 'BRILLIANT']));
      panel.append(row, div('bc-lamp', `${jewel}<small>${model}</small>`));
      face.append(panel, div('bc-front', `<div class="bc-logo">${name}</div>${maker}`));
      break;
    }
    case 'graphic': {
      // Cream panel, orange covering, basketweave grille.
      const panel = div('gr-panel', `<div class="gr-inputs"><span class="jack"></span><span class="jack"></span></div>`);
      panel.append(row, div('gr-lamp', `${jewel}<small>${model}</small>`));
      face.append(panel, div('gr-front', `<div class="gr-logo">${name}</div>${maker}`));
      break;
    }
    case 'hotrod': {
      // Chrome panel, black lettering, black grille.
      const panel = div('hr-panel', `<div class="hr-inputs"><span class="jack"></span><small>INPUT</small></div>`);
      panel.append(row, div('hr-lamp', `${jewel}<small>${model}</small>`));
      face.append(panel, div('hr-front', `<div class="hr-logo">${name}</div>${maker}`));
      break;
    }
    case 'boutique': {
      // Black panel, cream lettering, a single input.
      const panel = div('bq-panel', `<div class="bq-inputs"><span class="jack"></span><small>INPUT</small></div>`);
      panel.append(row, div('bq-lamp', `${jewel}<small>${model}</small>`));
      face.append(panel, div('bq-front', `<div class="bq-logo">${name}</div>${maker}`));
      break;
    }
    case 'blackpanel': {
      // Black panel, silver grille.
      const panel = div('bp-panel', `<div class="bp-inputs"><span class="jack"></span><span class="jack"></span>
          <small>VIBRATO</small></div>`);
      panel.append(row, div('bp-lamp', `${jewel}<small>${model}</small>`));
      face.append(panel, div('bp-grille', `<div class="bp-logo">${name}</div>${maker}`));
      break;
    }
    default: {
      // Tweed: lacquered tweed, chrome control strip.
      const panel = div('tw-panel', `<div class="tw-label"><span class="tw-logo">${name}</span>
          <small>${model}</small></div>`);
      panel.append(row, div('tw-lamp', jewel));
      face.append(div('tw-tweed', ''), panel);
    }
  }
  return face;
}
