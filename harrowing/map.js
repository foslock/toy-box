// The map of this act: a cross-section of the funnel of Hell on old parchment, nine terraces narrowing toward the
// pit, three to a circle, with the tunnels you can dig between them.
import { drawGlyph } from './art.js';
import { ROWS, COLS } from './run.js';
import { CIRCLES, ACTS } from './enemies.js';
import { noise2, fbm, rand, lin, rad } from './paint.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
export const NODE_GLYPH = { fight: 'horned', elite: 'flameSkull', rest: 'sanctuary', shop: 'boat', event: 'question2', treasure: 'treasure', boss: 'horned' };
const BOSS_GLYPH = ['fangs', 'serpent', 'horned'];
const PAPER = new Map();

function paper(w, h, seed) {
  const key = w + 'x' + h + ':' + seed;
  if (PAPER.has(key)) return PAPER.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), n = noise2(seed), r = rand(seed);
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fbm(n, x * .012, y * .012, 4) * .6 + n(x * .15, y * .15) * .15;
    const i = (y * w + x) * 4;
    d[i] = 196 + v * 40; d[i + 1] = 166 + v * 36; d[i + 2] = 118 + v * 30; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // stains and a burnt edge
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(110,70,30,${.04 + r() * .06})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 90, 14 + r() * 60, r() * 3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = rad(g, w / 2, h / 2, Math.min(w, h) * .35, Math.max(w, h) * .75, [[0, 'rgba(60,30,10,0)'], [.8, 'rgba(60,30,10,.35)'], [1, 'rgba(30,12,4,.85)']]);
  g.fillRect(0, 0, w, h);
  PAPER.set(key, c);
  return c;
}

export class MapView {
  constructor(canvas, run, o = {}) {
    this.c = canvas; this.run = run; this.o = o;
    this.t = 0;
  }
  geom() {
    const W = this.c.width, H = this.c.height, dpr = this.dpr;
    const top = 168 * dpr, bottom = H - 150 * dpr;
    const rowY = r => top + (bottom - top) * r / (ROWS - 1);
    const half = r => W * (.44 - .3 * r / ROWS);   // the funnel narrows
    const nodeX = (r, c) => W / 2 + (c - (COLS - 1) / 2) / ((COLS - 1) / 2) * half(r) * .82;
    return { W, H, top, bottom, rowY, half, nodeX, bossY: H - 78 * dpr };
  }
  pos(n) { const G = this.geom(); if (n.type === 'boss' || n.row >= ROWS) return { x: G.W / 2, y: G.bossY }; return { x: G.nodeX(n.row, n.col), y: G.rowY(n.row) }; }
  draw(t = 0) {
    this.t = t;
    const g = this.c.getContext('2d'), G = this.geom(), run = this.run, dpr = this.dpr;
    const { W, H } = G;
    g.drawImage(paper(W, H, 7 + run.act), 0, 0);
    const ink = 'rgba(58,32,14,', act = run.act;
    // the funnel's terraces, darker as they go down
    for (let r = 0; r < ROWS; r++) {
      const y0 = G.rowY(r) - (G.rowY(1) - G.rowY(0)) * .5, y1 = y0 + (G.rowY(1) - G.rowY(0));
      const h0 = G.half(r - .5), h1 = G.half(r + .5);
      g.beginPath(); g.moveTo(W / 2 - h0, y0); g.lineTo(W / 2 + h0, y0); g.lineTo(W / 2 + h1, y1); g.lineTo(W / 2 - h1, y1); g.closePath();
      g.fillStyle = `rgba(${120 - r * 8},${50 - r * 3},${20},${.06 + r * .025})`; g.fill();
      g.strokeStyle = ink + '.25)'; g.lineWidth = 1.5 * dpr; g.stroke();
      // the circles' names in the margin
      if (r % 3 === 0) {
        const ci = act * 3 + r / 3, C = CIRCLES[ci];
        g.save(); g.fillStyle = ink + '.85)'; g.font = `700 ${16 * dpr}px Cinzel, serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(`${ROMAN[ci]}`, 14 * dpr, y0 + 20 * dpr);
        g.font = `600 ${12 * dpr}px Cinzel, serif`; g.fillStyle = ink + '.7)';
        g.fillText(C.name.toUpperCase(), 14 * dpr, y0 + 40 * dpr);
        g.font = `italic 500 ${12 * dpr}px "Alegreya Sans", sans-serif`; g.fillStyle = ink + '.55)';
        g.fillText(C.sin, 14 * dpr, y0 + 56 * dpr);
        g.restore();
        if (r) { g.strokeStyle = ink + '.5)'; g.lineWidth = 2.5 * dpr; g.setLineDash([2 * dpr, 6 * dpr]); g.beginPath(); g.moveTo(W / 2 - h0 - 10 * dpr, y0); g.lineTo(W / 2 + h0 + 10 * dpr, y0); g.stroke(); g.setLineDash([]); }
      }
    }
    // the pit itself, at the bottom
    g.fillStyle = rad(g, W / 2, G.bossY, 5 * dpr, 70 * dpr, [[0, 'rgba(120,20,10,.55)'], [1, 'rgba(60,10,4,0)']]); g.fillRect(0, G.bossY - 80 * dpr, W, 160 * dpr);
    // title
    g.fillStyle = ink + '.9)'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = `900 ${26 * dpr}px Cinzel, serif`; g.fillText(`ACT ${ROMAN[act]}`, W / 2, 46 * dpr);
    g.font = `700 ${15 * dpr}px Cinzel, serif`; g.fillText(ACTS[act].name.toUpperCase(), W / 2, 70 * dpr);
    g.font = `italic 500 ${13 * dpr}px "Alegreya Sans", sans-serif`; g.fillStyle = ink + '.6)'; g.fillText(run.pos ? 'Choose where to dig next' : 'Choose where to begin', W / 2, 92 * dpr);
    // tunnels
    const nodes = Object.values(run.map.nodes);
    const visited = new Set(run.visited.map(([r, c]) => r + ':' + c));
    const choices = new Set(this.o.viewOnly ? [] : run.choices().map(n => n.row + ':' + n.col));
    for (const n of nodes) {
      const a = this.pos(n);
      const nexts = n.row === ROWS - 1 ? [{ row: ROWS, col: 3, type: 'boss' }] : n.next.map(c => run.node(n.row + 1, c));
      for (const m of nexts) {
        const b = this.pos(m);
        const walked = visited.has(n.row + ':' + n.col) && (visited.has(m.row + ':' + m.col) || (m.type === 'boss' && run.pos?.row >= ROWS));
        g.strokeStyle = walked ? 'rgba(160,30,10,.85)' : ink + '.38)'; g.lineWidth = (walked ? 4 : 2.2) * dpr;
        g.setLineDash(walked ? [] : [3 * dpr, 7 * dpr]);
        g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2 + (a.x - b.x) * .15, (a.y + b.y) / 2, b.x, b.y); g.stroke();
      }
    }
    g.setLineDash([]);
    // spots
    const pulse = .5 + .5 * Math.sin(t * 4);
    const drawNode = (n, p, type, size) => {
      const key = n.row + ':' + n.col, isChoice = choices.has(key) || (type === 'boss' && choices.has(ROWS + ':3')), wasHere = visited.has(key);
      const r = size * dpr;
      if (isChoice) { g.fillStyle = `rgba(255,190,80,${.25 + pulse * .35})`; g.beginPath(); g.arc(p.x, p.y, r * (1.45 + pulse * .2), 0, Math.PI * 2); g.fill(); }
      g.fillStyle = wasHere ? 'rgba(140,24,10,.9)' : 'rgba(235,214,170,.95)';
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      g.lineWidth = (isChoice ? 3 : 2) * dpr; g.strokeStyle = isChoice ? '#7a3a08' : ink + '.75)'; g.stroke();
      const col = wasHere ? { body: '#ffe6c0', body2: '#ffb070', outline: '#3a0a04', hole: '#3a0a04', accent: '#fff' } : { body: '#5a3416', body2: '#2a1206', outline: '#2a1206', hole: '#e8d4a8', accent: '#8a1a10', detail: '#2a1206' };
      const glyph = type === 'boss' ? BOSS_GLYPH[run.act] : NODE_GLYPH[type];
      drawGlyph(g, glyph, p.x - r * .78, p.y - r * .8, r * 1.56, col);
    };
    for (const n of nodes) drawNode(n, this.pos(n), n.type, n.type === 'elite' ? 21 : 18);
    drawNode({ row: ROWS, col: 3 }, { x: W / 2, y: G.bossY }, 'boss', 34);
    // you are here: a little halo
    const here = run.pos ? (run.pos.row >= ROWS ? { x: W / 2, y: G.bossY } : this.pos(run.node(run.pos.row, run.pos.col))) : { x: W / 2, y: G.top - 22 * dpr };
    const hy = here.y - 34 * dpr - Math.sin(t * 2) * 4 * dpr;
    g.save(); g.translate(here.x, hy); g.scale(1, .35);
    g.strokeStyle = '#d89a20'; g.lineWidth = 4 * dpr; g.shadowColor = '#ffd36a'; g.shadowBlur = 12 * dpr;
    g.beginPath(); g.arc(0, 0, 13 * dpr, 0, Math.PI * 2); g.stroke(); g.restore();
    
  }
  // the spot under a click, if you can go there
  hit(x, y) {
    const dpr = this.dpr;
    x *= dpr; y *= dpr;
    let best = null, bd = 34 * dpr;
    for (const n of this.run.choices()) {
      const p = this.pos(n), d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
}
