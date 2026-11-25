// The leads between the rows: out of the last box before the amp, along the
// right-hand margin into the amp's side, out of its other side and down the
// left-hand margin into the first box after it. Drawn on an overlay from
// where those things are on the page, and redrawn when the page reflows.

const NS = 'http://www.w3.org/2000/svg';
const R = 9; // how far out in the margin the lead runs

export function setupWires(main: HTMLElement, board: HTMLElement, ampFace: HTMLElement, after: HTMLElement): void {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'wires');
  svg.setAttribute('aria-hidden', 'true');
  main.append(svg);
  const narrow = matchMedia('(max-width: 760px)');

  const draw = () => {
    const m = main.getBoundingClientRect();
    const box = (el: Element | null) => {
      if (!(el instanceof HTMLElement) || !el.offsetParent) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left - m.left, right: r.right - m.left, top: r.top - m.top, mid: r.top - m.top + r.height / 2, height: r.height };
    };
    const out = box(board.lastElementChild);
    const amp = box(ampFace.querySelector('.face'));
    const inn = box(after.firstElementChild);
    const side = !!main.querySelector('.practice.side') || document.body.classList.contains('staging');
    if (!out || !amp || !inn || narrow.matches || side || inn.top < amp.top) {
      svg.replaceChildren();
      return;
    }
    // Cables, not conduit: each hangs a little and swings out into the margin
    // before it turns, and meets its plug straight on.
    const xr = amp.right + R, xl = amp.left - R;
    const ya = amp.top + Math.min(amp.height / 2, 110);
    const y0 = out.mid, y1 = inn.mid;
    const fromX = Math.min(out.right - 2, xr - R);
    const run = xr - fromX, dropA = ya - y0, dropB = y1 - ya;
    // (The pedals may sit above the amp or below it: the lead climbs or drops.)
    const up = dropA < 0 ? -1 : 1;
    const toAmp = `M ${fromX} ${y0} C ${fromX + run * 0.55} ${y0 + Math.min(34, run * 0.12 + 8)}, ${xr + 5} ${y0 + up * 4}, ${xr + 3} ${y0 + dropA * 0.42}`
      + ` S ${xr + 7} ${ya - up * 3}, ${amp.right + 6} ${ya}`;
    const toX = Math.max(inn.left + 2, xl + R);
    const fromAmp = `M ${amp.left - 6} ${ya} C ${xl - 7} ${ya + 3}, ${xl - 1} ${ya + dropB * 0.3}, ${xl - 3} ${ya + dropB * 0.6}`
      + ` S ${xl - 5} ${y1 + 9}, ${toX} ${y1}`;
    const lead = (d: string) => `<path class="wire" d="${d}" /><path class="wire-shine" d="${d}" />`;
    const plug = (x: number) => `<rect class="wire-plug" x="${x}" y="${ya - 8}" width="11" height="16" rx="2" />`;
    svg.innerHTML = `<defs><linearGradient id="wire-chrome" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f6f6f6" /><stop offset="0.42" stop-color="#a2a5a9" /><stop offset="0.56" stop-color="#6d7074" /><stop offset="1" stop-color="#dcdde0" />
      </linearGradient></defs>
      ${lead(toAmp)}${lead(fromAmp)}${plug(amp.right - 4)}${plug(amp.left - 7)}`;
  };

  let queued = false;
  const redraw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(); });
  };
  const sizes = new ResizeObserver(redraw);
  for (const el of [main, board, ampFace, after]) sizes.observe(el);
  const changes = new MutationObserver(redraw);
  for (const el of [board, ampFace, after]) changes.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  changes.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', redraw);
  narrow.addEventListener('change', redraw);
  void document.fonts?.ready.then(redraw);
  redraw();
}
