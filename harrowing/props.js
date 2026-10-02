// Things on the ledge around the fight, different in each circle: braziers, boulders, broken columns, skulls,
// burning tombs, heaps of gold, ice. Painted once like the figures, lit the same way.
import { canvas, lin, rad, rgba, mixc, rand, TAU } from './paint.js';

const W = 256, H = 256;
function paint(draw, glowDraw) {
  const c = canvas(W, H), g = c.getContext('2d');
  draw(g);
  let gc = null;
  if (glowDraw) { gc = canvas(W, H); glowDraw(gc.getContext('2d')); }
  return { canvas: c, glow: gc };
}
const P = d => new Path2D(d);

export const PROPS = {
  rock: (L, r) => paint(g => {
    const p = new Path2D(); const n = 12, cx = 128, cy = 200;
    for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI, rr = (70 + r() * 30) * (i === 0 || i === n ? 1.1 : 1); p.lineTo(cx + Math.cos(a) * rr * 1.3, cy + Math.sin(a) * rr * .9); }
    p.closePath();
    g.fillStyle = lin(g, 0, 110, 0, 210, [[0, mixc(L.rock2, L.rim, .15)], [1, mixc(L.rock, '#000000', .3)]]); g.fill(p);
    g.strokeStyle = rgba('#000000', .35); g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(60 + r() * 140, 140 + r() * 40); g.lineTo(60 + r() * 140, 160 + r() * 40); g.stroke(); }
  }),
  skulls: (L, r) => paint(g => {
    for (let i = 0; i < 6; i++) {
      const x = 60 + r() * 136, y = 190 + r() * 26 - (i > 3 ? 30 : 0), s = .7 + r() * .4;
      g.save(); g.translate(x, y); g.scale(s, s); g.rotate((r() - .5) * .6);
      g.fillStyle = lin(g, 0, -30, 0, 26, [[0, '#efe6d0'], [1, '#8a7a60']]);
      g.beginPath(); g.ellipse(0, -8, 24, 22, 0, 0, TAU); g.fill(); g.fillRect(-14, 6, 28, 16);
      g.fillStyle = '#140808'; g.beginPath(); g.ellipse(-9, -6, 7, 8, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(9, -6, 7, 8, 0, 0, TAU); g.fill();
      g.restore();
    }
  }),
  brazier: (L, r) => paint(g => {
    g.strokeStyle = '#1a1210'; g.lineWidth = 7; g.lineCap = 'round';
    for (const dx of [-38, 0, 38]) { g.beginPath(); g.moveTo(128 + dx * .3, 150); g.lineTo(128 + dx, 246); g.stroke(); }
    g.fillStyle = lin(g, 0, 120, 0, 160, [[0, '#4a3a30'], [1, '#120a08']]);
    g.beginPath(); g.moveTo(78, 124); g.lineTo(178, 124); g.quadraticCurveTo(170, 162, 128, 164); g.quadraticCurveTo(86, 162, 78, 124); g.fill();
    g.fillStyle = '#2a1a14'; g.fillRect(74, 118, 108, 9);
    // flames
    g.fillStyle = lin(g, 0, 40, 0, 124, [[0, 'rgba(255,220,120,0)'], [.4, '#ff9a2a'], [1, '#ff4a0a']]);
    for (const [x, h] of [[100, 60], [128, 86], [154, 64]]) { g.beginPath(); g.moveTo(x - 20, 124); g.quadraticCurveTo(x - 16, 124 - h * .6, x, 124 - h); g.quadraticCurveTo(x + 16, 124 - h * .6, x + 20, 124); g.fill(); }
  }, g => { g.fillStyle = rad(g, 128, 96, 4, 120, [[0, 'rgba(255,190,90,.8)'], [.4, 'rgba(255,120,40,.3)'], [1, 'rgba(255,90,20,0)']]); g.fillRect(0, 0, W, H); }),
  column: (L, r) => paint(g => {
    const x = 92, w = 72, top = 70 + r() * 50;
    g.fillStyle = lin(g, x, 0, x + w, 0, [[0, '#8a8478'], [.4, '#e0dacd'], [1, '#6a645a']]);
    g.beginPath(); g.moveTo(x, 240); g.lineTo(x, top + 14); g.lineTo(x + w * .3, top); g.lineTo(x + w * .55, top + 22); g.lineTo(x + w * .8, top + 6); g.lineTo(x + w, top + 18); g.lineTo(x + w, 240); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + i * w / 4, top + 24); g.lineTo(x + i * w / 4, 240); g.stroke(); }
    g.fillStyle = lin(g, 0, 236, 0, 252, [[0, '#a8a296'], [1, '#4a463e']]); g.fillRect(x - 12, 236, w + 24, 16);
    g.fillStyle = 'rgba(30,20,20,.25)'; g.fillRect(x, 140, w, 100);
  }),
  tomb: (L, r) => paint(g => {
    g.fillStyle = lin(g, 0, 150, 0, 250, [[0, '#6a5a50'], [1, '#2a201c']]); g.fillRect(40, 160, 176, 90);
    g.fillStyle = lin(g, 0, 130, 0, 160, [[0, '#7a6a5e'], [1, '#3a2e28']]);
    g.save(); g.translate(128, 150); g.rotate(-.18); g.fillRect(-96, -14, 192, 20); g.restore();
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3; g.strokeRect(56, 176, 144, 60);
    g.fillStyle = lin(g, 0, 70, 0, 164, [[0, 'rgba(255,200,90,0)'], [.5, '#ff8a2a'], [1, '#ff3a0a']]);
    for (const [x, h] of [[80, 70], [120, 96], [168, 80]]) { g.beginPath(); g.moveTo(x - 22, 164); g.quadraticCurveTo(x - 10, 164 - h * .7, x, 164 - h); g.quadraticCurveTo(x + 10, 164 - h * .7, x + 22, 164); g.fill(); }
  }, g => { g.fillStyle = rad(g, 128, 120, 4, 130, [[0, 'rgba(255,170,70,.7)'], [1, 'rgba(255,90,20,0)']]); g.fillRect(0, 0, W, H); }),
  gold: (L, r) => paint(g => {
    g.fillStyle = lin(g, 0, 160, 0, 250, [[0, '#ffe38a'], [1, '#8a5a10']]);
    g.beginPath(); g.moveTo(10, 250); g.quadraticCurveTo(128, 110, 246, 250); g.fill();
    for (let i = 0; i < 60; i++) { const x = 30 + r() * 196, y = 170 + r() * 76; if (y < 250 - Math.abs(x - 128) * .9 - 10) continue; g.fillStyle = r() < .5 ? '#fff0b0' : '#c8902a'; g.beginPath(); g.ellipse(x, y, 7, 3, r(), 0, TAU); g.fill(); }
    g.fillStyle = '#5a3a1a'; g.beginPath(); g.moveTo(150, 200); g.lineTo(160, 120); g.lineTo(176, 122); g.lineTo(168, 204); g.fill();
  }, g => { for (let i = 0; i < 8; i++) { const x = 60 + Math.random() * 140, y = 170 + Math.random() * 60; g.fillStyle = rad(g, x, y, 0, 10, [[0, 'rgba(255,240,180,.9)'], [1, 'rgba(255,240,180,0)']]); g.fillRect(x - 10, y - 10, 20, 20); } }),
  ice: (L, r) => paint(g => {
    for (let i = 0; i < 4; i++) {
      const x = 60 + i * 44 + r() * 20, h = 90 + r() * 120, w = 22 + r() * 18;
      g.fillStyle = lin(g, x - w, 0, x + w, 0, [[0, 'rgba(170,215,240,.95)'], [.5, 'rgba(240,252,255,.95)'], [1, 'rgba(110,170,210,.95)']]);
      g.beginPath(); g.moveTo(x - w, 250); g.lineTo(x + (r() - .5) * 20, 250 - h); g.lineTo(x + w, 250); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w * .3, 246); g.lineTo(x, 250 - h * .8); g.stroke();
    }
  }),
  tree: (L, r) => paint(g => {
    g.strokeStyle = '#1a0c0a'; g.lineCap = 'round';
    const branch = (x, y, a, len, w, d) => { if (d > 5 || len < 8) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); branch(x2, y2, a - .4 - r() * .3, len * .72, w * .7, d + 1); branch(x2, y2, a + .3 + r() * .3, len * .66, w * .7, d + 1); };
    branch(128, 252, -Math.PI / 2 + (r() - .5) * .3, 70, 16, 0);
  }),
  stalagmite: (L, r) => paint(g => {
    for (let i = 0; i < 3; i++) {
      const x = 80 + i * 48 + r() * 20, h = 80 + r() * 140, w = 24 + r() * 20;
      g.fillStyle = lin(g, x - w, 0, x + w, 0, [[0, mixc(L.rock, '#000000', .3)], [.6, L.rock2], [1, mixc(L.rock2, L.rim, .2)]]);
      g.beginPath(); g.moveTo(x - w, 252); g.quadraticCurveTo(x - w * .3, 252 - h * .6, x, 252 - h); g.quadraticCurveTo(x + w * .3, 252 - h * .6, x + w, 252); g.fill();
    }
  }),
  chains: (L, r) => paint(g => {
    g.strokeStyle = '#3a3438'; g.lineWidth = 5;
    for (const x of [70, 128, 186]) { const len = 120 + r() * 100; for (let y = 0; y < len; y += 16) { g.beginPath(); g.ellipse(x + Math.sin(y * .02) * 4, y + 8, 5, 9, 0, 0, TAU); g.stroke(); } }
  }),
};

// which things lie about in each circle: [kind, anchor (L: the left edge of the fight, R: the right, C: the middle),
// offset from it, depth, size]
export const SETS = [
  [['column', 'L', -.4, -3.6, 2.8], ['brazier', 'R', .2, -4.2, 2.1], ['stalagmite', 'L', 2.2, -7.5, 3.2], ['rock', 'C', 3, -8, 2.2]],
  [['rock', 'L', -.3, -3.4, 2.6], ['brazier', 'R', .2, -4.6, 2.1], ['chains', 'C', -2, -8, 3], ['stalagmite', 'R', -2, -8, 3.2]],
  [['rock', 'L', -.3, -3.4, 2.6], ['skulls', 'R', .3, -3.6, 2], ['brazier', 'C', -3, -7.5, 2], ['stalagmite', 'R', -1.5, -8, 3.2]],
  [['gold', 'L', -.4, -3.4, 2.8], ['gold', 'R', .4, -4, 3], ['brazier', 'C', -2.5, -7.5, 2.1], ['skulls', 'C', 3.5, -7.8, 1.8]],
  [['rock', 'L', -.3, -3.4, 2.6], ['skulls', 'R', .3, -3.6, 2], ['chains', 'C', -3, -8, 3.2], ['brazier', 'C', 3, -7.6, 2.1]],
  [['tomb', 'L', -.5, -3.8, 2.6], ['tomb', 'R', .4, -4.4, 2.6], ['column', 'C', -3, -8, 2.8], ['brazier', 'C', 3, -7.6, 2.1]],
  [['tree', 'L', -.4, -3.6, 3.2], ['tree', 'R', .4, -4.4, 3.4], ['skulls', 'C', -2.5, -7.6, 1.8], ['brazier', 'C', 3, -7.8, 2.1]],
  [['rock', 'L', -.3, -3.4, 2.6], ['chains', 'R', .2, -5, 3.2], ['brazier', 'C', -2.8, -7.6, 2.1], ['stalagmite', 'C', 3, -8, 3.2]],
  [['ice', 'L', -.4, -3.6, 3], ['ice', 'R', .4, -4.4, 3.2], ['ice', 'C', -3, -8, 2.6], ['ice', 'C', 3.4, -8.2, 2.8]],
];
export const propLook = (kind, L, seed) => PROPS[kind](L, rand(seed));
