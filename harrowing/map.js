// The map of this act: a cross-section of the funnel of Hell cut from black paper, nine terraces narrowing toward
// the glowing pit, three to a circle, with the tunnels you can dig between them, and every stop an ivory stamp.
import { drawGlyph } from './art.js';
import { ROWS, COLS } from './run.js';
import { CIRCLES, ACTS } from './enemies.js';
import { noise2, fbm, rand, lin, rad } from './paint.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
export const NODE_GLYPH = { fight: 'horned', elite: 'flameSkull', rest: 'sanctuary', shop: 'boat', event: 'question2', treasure: 'treasure', boss: 'horned' };
const BOSS_GLYPH = ['fangs', 'serpent', 'horned'];
const PAPER = new Map();

const T = '"IM Fell English SC", Georgia, serif', I = '"IM Fell English", Georgia, serif';
function paper(w, h, seed) {
  const key = w + 'x' + h + ':' + seed;
  if (PAPER.has(key)) return PAPER.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), n = noise2(seed);
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fbm(n, x * .02, y * .02, 3) * .5 + Math.random() * .5;
    const i = (y * w + x) * 4;
    d[i] = 16 + v * 9; d[i + 1] = 12 + v * 7; d[i + 2] = 12 + v * 6; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
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
    const top = 176 * dpr, bottom = H - 150 * dpr;
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
    const bone = 'rgba(241,231,208,', gilt = 'rgba(202,164,92,', act = run.act;
    // a ruled frame
    g.strokeStyle = gilt + '.6)'; g.lineWidth = 1.5 * dpr; g.strokeRect(10 * dpr, 10 * dpr, W - 20 * dpr, H - 20 * dpr);
    g.strokeStyle = gilt + '.25)'; g.lineWidth = 1 * dpr; g.strokeRect(16 * dpr, 16 * dpr, W - 32 * dpr, H - 32 * dpr);
    // the glow of the pit, rising through the funnel
    g.fillStyle = rad(g, W / 2, G.bossY, 10 * dpr, H * .75, [[0, 'rgba(226,100,60,.5)'], [.35, 'rgba(160,40,20,.18)'], [1, 'rgba(80,20,10,0)']]); g.fillRect(0, 0, W, H);
    // the funnel's terraces: layers of paper, each a little redder, lit along the top edge
    const dy = G.rowY(1) - G.rowY(0);
    for (let r = 0; r < ROWS; r++) {
      const y0 = G.rowY(r) - dy * .5, y1 = y0 + dy, h0 = G.half(r - .5), h1 = G.half(r + .5), k = r / (ROWS - 1);
      g.beginPath(); g.moveTo(W / 2 - h0, y0); g.lineTo(W / 2 + h0, y0); g.lineTo(W / 2 + h1, y1); g.lineTo(W / 2 - h1, y1); g.closePath();
      g.fillStyle = `rgb(${30 + k * 26 | 0},${20 + k * 4 | 0},${19 - k * 4 | 0})`; g.fill();
      g.strokeStyle = (r % 3 === 0 ? gilt + '.55)' : bone + '.12)'); g.lineWidth = (r % 3 === 0 ? 1.5 : 1) * dpr;
      g.beginPath(); g.moveTo(W / 2 - h0, y0); g.lineTo(W / 2 + h0, y0); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.moveTo(W / 2 - h0, y0); g.lineTo(W / 2 - h1, y1); g.moveTo(W / 2 + h0, y0); g.lineTo(W / 2 + h1, y1); g.stroke();
      // each circle's name in the margin
      if (r % 3 === 0) {
        const ci = act * 3 + r / 3, C = CIRCLES[ci];
        g.save(); g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillStyle = gilt + '.95)'; g.font = `${22 * dpr}px ${T}`; g.fillText(ROMAN[ci], 26 * dpr, y0 + 22 * dpr);
        g.fillStyle = bone + '.85)'; g.font = `${16 * dpr}px ${T}`; g.fillText(C.name, 26 * dpr, y0 + 44 * dpr);
        g.fillStyle = bone + '.5)'; g.font = `italic ${13 * dpr}px ${I}`; g.fillText(C.sin, 26 * dpr, y0 + 62 * dpr);
        g.restore();
      }
    }
    // title
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = bone + '.95)'; g.font = `${34 * dpr}px ${T}`; g.fillText(`Act ${ROMAN[act]}`, W / 2, 56 * dpr);
    g.fillStyle = gilt + '.95)'; g.font = `${18 * dpr}px ${T}`; g.fillText(ACTS[act].name, W / 2, 82 * dpr);
    g.fillStyle = bone + '.55)'; g.font = `italic ${15 * dpr}px ${I}`; g.fillText(run.pos ? 'Choose where to dig next' : 'Choose where to begin', W / 2, 106 * dpr);
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
        g.strokeStyle = walked ? 'rgba(226,100,60,.95)' : bone + '.3)'; g.lineWidth = (walked ? 3.5 : 2) * dpr; g.lineCap = 'round';
        g.setLineDash(walked ? [] : [.1, 7 * dpr]);
        g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2 + (a.x - b.x) * .15, (a.y + b.y) / 2, b.x, b.y); g.stroke();
      }
    }
    g.setLineDash([]);
    // stops: ivory stamps (black once you've been there), the ones you can choose ringed in pulsing gilt
    const pulse = .5 + .5 * Math.sin(t * 4);
    const drawNode = (n, p, type, size) => {
      const key = n.row + ':' + n.col, isChoice = choices.has(key) || (type === 'boss' && choices.has(ROWS + ':3')), wasHere = visited.has(key);
      const r = size * dpr;
      if (isChoice) { g.strokeStyle = `rgba(234,208,142,${.45 + pulse * .55})`; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(p.x, p.y, r * (1.3 + pulse * .12), 0, Math.PI * 2); g.stroke(); g.fillStyle = `rgba(234,208,142,${.08 + pulse * .1})`; g.fill(); }
      g.fillStyle = wasHere ? '#0d0a0b' : type === 'boss' ? '#e2643c' : '#efe5cf';
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      g.lineWidth = 1.5 * dpr; g.strokeStyle = wasHere ? 'rgba(226,100,60,.9)' : '#0d0a0b'; g.stroke();
      g.beginPath(); g.arc(p.x, p.y, r - 3 * dpr, 0, Math.PI * 2); g.lineWidth = 1 * dpr; g.strokeStyle = wasHere ? 'rgba(226,100,60,.4)' : 'rgba(13,10,11,.35)'; g.stroke();
      const col = wasHere ? { body: '#e2643c', outline: '#0d0a0b', hole: '#0d0a0b', accent: '#f6c8a8', detail: '#0d0a0b' } : { body: '#0d0a0b', outline: '#0d0a0b', hole: type === 'boss' ? '#e2643c' : '#efe5cf', accent: '#5a1a10', detail: type === 'boss' ? '#e2643c' : '#efe5cf' };
      const glyph = type === 'boss' ? BOSS_GLYPH[run.act] : NODE_GLYPH[type];
      drawGlyph(g, glyph, p.x - r * .72, p.y - r * .74, r * 1.44, col);
    };
    for (const n of nodes) drawNode(n, this.pos(n), n.type, n.type === 'elite' ? 21 : 18);
    drawNode({ row: ROWS, col: 3 }, { x: W / 2, y: G.bossY }, 'boss', 34);
    // you are here: a little halo
    const here = run.pos ? (run.pos.row >= ROWS ? { x: W / 2, y: G.bossY } : this.pos(run.node(run.pos.row, run.pos.col))) : { x: W / 2, y: G.top - 22 * dpr };
    const hy = here.y - 34 * dpr - Math.sin(t * 2) * 4 * dpr;
    g.save(); g.translate(here.x, hy); g.scale(1, .35);
    g.strokeStyle = '#ead08e'; g.lineWidth = 4 * dpr; g.shadowColor = '#ffd36a'; g.shadowBlur = 12 * dpr;
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
