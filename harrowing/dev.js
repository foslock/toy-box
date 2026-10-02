// A contact sheet of every card (dev.html?w=250&only=smite,ward&rot=1&glyphs=1).
import { CARDS, makeCard } from './cards.js';
import { paintFace, paintBack, CW, CH } from './face.js';
import { GLYPHS, drawGlyph } from './art.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') ?? 220), only = q.get('only')?.split(','), plus = q.has('plus');
await document.fonts.load(`400 20px "IM Fell English SC"`); await document.fonts.load(`600 20px "Alegreya Sans"`); await document.fonts.load(`800 20px "Alegreya Sans"`);
const out = document.getElementById('out');
const add = (src, label, rot) => {
  const fig = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = W * devicePixelRatio; c.height = W * CH / CW * devicePixelRatio; c.style.width = W + 'px';
  if (rot) c.className = 'rot';
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
  fig.append(c);
  const cap = document.createElement('figcaption'); cap.textContent = label; fig.append(cap);
  out.append(fig);
};
if (q.has('glyphs')) {
  for (const name of Object.keys(GLYPHS)) {
    const c = document.createElement('canvas'); c.width = 120; c.height = 120;
    const g = c.getContext('2d'); g.fillStyle = '#2a2440'; g.fillRect(0, 0, 120, 120);
    drawGlyph(g, name, 10, 10, 100, { body: '#fffdf2', body2: '#f2c14e', outline: '#8a5a08', accent: '#ffffff', detail: '#a06a10', hole: '#7a4a06' });
    const fig = document.createElement('figure'); fig.append(c); const cap = document.createElement('figcaption'); cap.textContent = name; fig.append(cap); out.append(fig);
  }
} else {
  add(paintBack(), 'back');
  for (const id of only ?? Object.keys(CARDS)) {
    const card = makeCard(id, plus);
    add(paintFace(card), id, q.has('rot'));
  }
}
document.body.dataset.ready = 1;
