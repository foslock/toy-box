// Things standing about on the ledge, different in each circle: braziers, broken columns, burning tombs, heaps of
// coin, dead trees, shards of ice. Cut from the same black paper as the demons (ice from pale paper), with their
// flames painted on a glow layer.
import { canvas, lin, rad, rgba, rand, TAU } from './paint.js';

const W = 256, H = 256, INK = '#0b0809';
function paint(draw, glowDraw, o = {}) {
  const c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = INK; g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
  draw(g);
  let gc = null;
  if (glowDraw) { gc = canvas(W, H); glowDraw(gc.getContext('2d')); }
  return { canvas: c, glow: gc, fire: o.fire ?? null };
}
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fill(); }
function flameGlow(g, x, y, w, h, L) {
  g.fillStyle = rad(g, x, y - h * .4, 2, h * 1.3, [[0, rgba(L.glow, .55)], [.4, rgba(L.lava, .22)], [1, rgba(L.lava, 0)]]); g.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) {
    const fx = x + (i - 1) * w * .3, fh = h * (i === 1 ? 1 : .7);
    g.fillStyle = lin(g, 0, y - fh, 0, y, [[0, rgba(L.lava, 0)], [.35, rgba(L.lava, .85)], [1, '#fff2c8']]);
    g.beginPath(); g.moveTo(fx - w * .22, y); g.bezierCurveTo(fx - w * .24, y - fh * .5, fx - w * .02, y - fh * .6, fx + w * .04, y - fh); g.bezierCurveTo(fx + w * .1, y - fh * .5, fx + w * .26, y - fh * .45, fx + w * .22, y); g.closePath(); g.fill();
  }
}

export const PROPS = {
  rock: (L, r) => paint(g => {
    const pts = []; const n = 11, cx = 128, cy = 252;
    for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI; pts.push([cx + Math.cos(a) * (84 + r() * 26), cy + Math.sin(a) * (70 + r() * 40)]); }
    poly(g, pts);
  }),
  skulls: (L, r) => paint(g => {
    for (let i = 0; i < 7; i++) {
      const x = 56 + r() * 144, y = 236 + r() * 14 - (i > 4 ? 30 : 0), s = .7 + r() * .4;
      g.save(); g.translate(x, y); g.scale(s, s); g.rotate((r() - .5) * .7);
      g.fillStyle = INK; g.beginPath(); g.ellipse(0, -10, 22, 20, 0, 0, TAU); g.fill(); g.fillRect(-12, 2, 24, 14);
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.ellipse(-8, -8, 6, 7, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(8, -8, 6, 7, 0, 0, TAU); g.fill();
      g.restore();
    }
  }),
  brazier: (L, r) => paint(g => {
    g.lineWidth = 6;
    for (const dx of [-34, 0, 34]) { g.beginPath(); g.moveTo(128 + dx * .3, 160); g.quadraticCurveTo(128 + dx * .9, 210, 128 + dx * 1.1, 250); g.stroke(); }
    g.beginPath(); g.moveTo(82, 136); g.lineTo(174, 136); g.quadraticCurveTo(168, 170, 128, 172); g.quadraticCurveTo(88, 170, 82, 136); g.fill();
    g.fillRect(76, 128, 104, 10);
    for (let i = 0; i < 6; i++) poly(g, [[80 + i * 19, 130], [86 + i * 19, 118], [92 + i * 19, 130]]);
  }, g => flameGlow(g, 128, 130, 70, 100, L), { fire: .5 }),
  column: (L, r) => paint(g => {
    const x = 128, w = 64, top = 60 + r() * 50;
    g.fillRect(x - w * .8, 236, w * 1.6, 18); g.fillRect(x - w * .62, 222, w * 1.24, 16);
    poly(g, [[x - w / 2, 224], [x - w / 2, top + 16], [x - w * .2, top], [x, top + 26], [x + w * .22, top + 4], [x + w / 2, top + 20], [x + w / 2, 224]]);
    g.globalCompositeOperation = 'destination-out'; g.lineWidth = 1.4;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x - w / 2 + i * w / 4, top + 34); g.lineTo(x - w / 2 + i * w / 4, 216); g.stroke(); }
  }),
  tomb: (L, r) => paint(g => {
    g.fillRect(36, 170, 184, 86);
    g.save(); g.translate(140, 160); g.rotate(-.2); g.fillRect(-100, -14, 200, 20); g.restore();
    g.globalCompositeOperation = 'destination-out'; g.lineWidth = 1.4; g.strokeRect(52, 186, 152, 54);
  }, g => flameGlow(g, 128, 170, 120, 110, L), { fire: .62 }),
  gold: (L, r) => paint(g => {
    g.beginPath(); g.moveTo(8, 256); g.quadraticCurveTo(128, 120, 248, 256); g.fill();
    for (let i = 0; i < 30; i++) { const t = r(), x = 20 + t * 216, y = 256 - Math.sin(t * Math.PI) * 66 - r() * 8; g.beginPath(); g.ellipse(x, y, 9, 4, (r() - .5) * .8, 0, TAU); g.fill(); }
    g.save(); g.translate(170, 168); g.rotate(.3); g.fillRect(-4, -60, 8, 70); g.beginPath(); g.ellipse(0, -60, 20, 9, 0, 0, Math.PI); g.fill(); g.restore();
  }, g => { for (let i = 0; i < 9; i++) { const x = 40 + Math.random() * 176, y = 210 + Math.random() * 40; g.fillStyle = rad(g, x, y, 0, 9, [[0, rgba('#fff2c0', .95)], [1, rgba('#ffd060', 0)]]); g.fillRect(x - 9, y - 9, 18, 18); } }),
  ice: (L, r) => {
    const o = paint(g => {
      for (let i = 0; i < 4; i++) {
        const x = 60 + i * 44 + r() * 20, h = 90 + r() * 120, w = 22 + r() * 18;
        g.fillStyle = 'rgba(190,222,240,.92)'; poly(g, [[x - w, 256], [x + (r() - .5) * 20, 256 - h], [x + w, 256]]);
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w * .3, 252); g.lineTo(x, 256 - h * .8); g.stroke();
      }
    });
    o.paper = true; return o;
  },
  tree: (L, r) => paint(g => {
    const branch = (x, y, a, len, w, d) => { if (d > 5 || len < 6) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (r() - .5) * len * .4, (y + y2) / 2, x2, y2); g.stroke(); branch(x2, y2, a - .35 - r() * .35, len * .74, w * .68, d + 1); branch(x2, y2, a + .25 + r() * .35, len * .66, w * .68, d + 1); };
    branch(128, 256, -Math.PI / 2 + (r() - .5) * .3, 72, 18, 0);
  }),
  stalagmite: (L, r) => paint(g => {
    for (let i = 0; i < 3; i++) { const x = 70 + i * 54 + r() * 20, h = 90 + r() * 140, w = 22 + r() * 20; g.beginPath(); g.moveTo(x - w, 256); g.quadraticCurveTo(x - w * .3, 256 - h * .6, x + (r() - .5) * 10, 256 - h); g.quadraticCurveTo(x + w * .3, 256 - h * .6, x + w, 256); g.fill(); }
  }),
  gibbet: (L, r) => paint(g => {
    // a post with chains hanging from its arm
    g.fillRect(80, 30, 12, 226); g.fillRect(80, 30, 110, 10); g.lineWidth = 5; g.beginPath(); g.moveTo(92, 70); g.lineTo(130, 40); g.stroke();
    g.lineWidth = 3;
    for (const x of [150, 176]) { const len = 80 + r() * 70; for (let y = 40; y < 40 + len; y += 12) { g.beginPath(); g.ellipse(x, y + 6, 4, 7, 0, 0, TAU); g.stroke(); } }
    g.fillRect(70, 244, 32, 12);
  }),
};

// which things stand about in each scene: [kind, anchor (L: the left edge of the fight, R: the right, C: the
// middle), offset from it, depth, size]
export const SETS = {
  limbo: [['column', 'L', -.4, -3.6, 2.8], ['brazier', 'R', .2, -4.2, 2], ['stalagmite', 'C', 2.4, -7.5, 3], ['rock', 'C', -3, -8, 2.2]],
  lust: [['rock', 'L', -.3, -3.4, 2.4], ['brazier', 'R', .2, -4.6, 2], ['gibbet', 'C', -2, -8, 3.2], ['stalagmite', 'R', -2, -8, 3]],
  gluttony: [['rock', 'L', -.3, -3.4, 2.4], ['skulls', 'R', .3, -3.6, 2], ['brazier', 'C', -3, -7.5, 2], ['stalagmite', 'R', -1.5, -8, 3]],
  greed: [['gold', 'L', -.4, -3.4, 2.6], ['gold', 'R', .4, -4, 2.8], ['brazier', 'C', -2.5, -7.5, 2], ['skulls', 'C', 3.5, -7.8, 1.8]],
  wrath: [['rock', 'L', -.3, -3.4, 2.4], ['skulls', 'R', .3, -3.6, 2], ['gibbet', 'C', -3, -8, 3.2], ['brazier', 'C', 3, -7.6, 2]],
  heresy: [['tomb', 'L', -.5, -3.8, 2.6], ['tomb', 'R', .4, -4.4, 2.6], ['column', 'C', -3, -8, 2.8], ['brazier', 'C', 3, -7.6, 2]],
  violence: [['tree', 'L', -.4, -3.6, 3.2], ['tree', 'R', .4, -4.4, 3.4], ['skulls', 'C', -2.5, -7.6, 1.8], ['brazier', 'C', 3, -7.8, 2]],
  fraud: [['rock', 'L', -.3, -3.4, 2.4], ['gibbet', 'R', .2, -5, 3.2], ['brazier', 'C', -2.8, -7.6, 2], ['stalagmite', 'C', 3, -8, 3]],
  treachery: [['ice', 'L', -.4, -3.6, 3], ['ice', 'R', .4, -4.4, 3.2], ['ice', 'C', -3, -8, 2.6], ['ice', 'C', 3.4, -8.2, 2.8]],
  gate: [['brazier', 'C', -3.1, -1.6, 2.2], ['brazier', 'C', 3.1, -1.6, 2.2]],
};
export const propLook = (kind, L, seed) => PROPS[kind](L, rand(seed));
