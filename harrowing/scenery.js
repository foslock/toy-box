// The scenery of each circle, painted like a shadow theatre: a glowing sky, then three cut-paper layers standing
// further and further off, each a flat colour that fades into the haze with distance, edged with light along its
// top and lifting out of fog at its foot. Every circle has its own landmarks: the castle of Limbo, the whirlwind of
// the lustful, the tombs and towers of Dis, the wood of the suicides, the bridges of Malebolge, the giants in the ice.
import { canvas, lin, rad, rgba, mixc, rand, noise2, fbm, TAU } from './paint.js';

export const LW = 2048;
// depth, how far each layer has faded into the haze, canvas height; scenery stands BASE px above the bottom
export const LAYERS = [{ z: -52, haze: .66, h: 760 }, { z: -34, haze: .42, h: 640 }, { z: -20, haze: .2, h: 560 }];
export const BASE = 110;

/* ---------- shapes (all filled with the current fillStyle) ---------- */
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); }
function smooth(g, pts) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  g.beginPath(); let m = mid(pts[n - 1], pts[0]); g.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = mid(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  g.closePath(); g.fill();
}
function ridge(g, x0, x1, base, top, amp, freq, seed, H, oct = 4) {
  const n = noise2(seed);
  g.beginPath(); g.moveTo(x0, H);
  for (let x = x0; x <= x1; x += 6) g.lineTo(x, base - top - fbm(n, x * freq, seed * .37, oct) * amp);
  g.lineTo(x1, H); g.closePath(); g.fill();
}
function rockPile(g, x, base, w, h, r) {
  const pts = [[x - w, base + 8]];
  for (let i = 1; i < 9; i++) { const t = i / 9; pts.push([x - w + t * 2 * w + (r() - .5) * w * .12, base - h * Math.pow(Math.sin(t * Math.PI), .6) * (.75 + r() * .4)]); }
  pts.push([x + w, base + 8]); poly(g, pts);
}
function spire(g, x, base, w, h, lean, r) {
  const L = [], R = [], n = 9;
  for (let i = 0; i <= n; i++) { const t = i / n, cx = x + lean * h * t * t, ww = w * (1 - t) ** .8 + 2; L.push([cx - ww + (r() - .5) * w * .25, base - h * t]); R.push([cx + ww + (r() - .5) * w * .25, base - h * t]); }
  poly(g, [[x - w, base + 10], ...L, ...R.reverse(), [x + w, base + 10]]);
}
function taperSeg(g, x0, y0, cx, cy, x1, y1, w0, w1) {
  const L = [], R = [], N = 8;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = 1 - t;
    const x = a * a * x0 + 2 * a * t * cx + t * t * x1, y = a * a * y0 + 2 * a * t * cy + t * t * y1;
    const dx = 2 * a * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * a * (cy - y0) + 2 * t * (y1 - cy), l = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) / 2;
    L.push([x - dy / l * w, y + dx / l * w]); R.push([x + dy / l * w, y - dx / l * w]);
  }
  poly(g, [...L, ...R.reverse()]);
}
// a dead tree, all crooked branches
function tree(g, x, base, h, r, o = {}) {
  const grow = (x0, y0, a, len, w, d) => {
    if (d <= 0 || len < 5 || w < .8) return;
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len, bend = (r() - .5) * len * .5;
    taperSeg(g, x0, y0, (x0 + x1) / 2 + Math.cos(a + 1.57) * bend, (y0 + y1) / 2 + Math.sin(a + 1.57) * bend, x1, y1, w, w * .66);
    const k = d > 4 ? 2 : 1 + (r() < .55 ? 1 : 0);
    for (let i = 0; i <= k; i++) grow(x1, y1, a + (i - k / 2) * (o.spread ?? .55) + (r() - .5) * .5 + (o.droop ?? 0) * (6 - d) * .08, len * (.62 + r() * .18), w * .64, d - 1);
  };
  grow(x, base + 6, -Math.PI / 2 + (r() - .5) * .25, h * .32, h * .07, o.depth ?? 6);
  if (o.thorns) for (let i = 0; i < 30; i++) { const tx = x + (r() - .5) * h * .9, ty = base - h * (.3 + r() * .6); poly(g, [[tx, ty], [tx + 3, ty - 9], [tx + 5, ty]]); }
}
function cypress(g, x, base, h, w) { smooth(g, [[x, base - h], [x + w * .45, base - h * .62], [x + w * .55, base - h * .2], [x + w * .38, base + 6], [x - w * .38, base + 6], [x - w * .55, base - h * .2], [x - w * .45, base - h * .62]]); }
function column(g, x, base, w, h, broken, r) {
  g.fillRect(x - w * .8, base - w * .26, w * 1.6, w * .3); g.fillRect(x - w * .64, base - w * .46, w * 1.28, w * .24);
  const top = base - h;
  if (broken) poly(g, [[x - w * .5, base - w * .4], [x - w * .46, top + w * .7], [x - w * .18, top + w * .3], [x + w * .02, top + w * .8], [x + w * .24, top], [x + w * .48, top + w * .6], [x + w * .5, base - w * .4]]);
  else { g.fillRect(x - w * .5, top + w * .4, w, h - w * .8); poly(g, [[x - w * .5, top + w * .44], [x - w * .82, top + w * .14], [x - w * .9, top - w * .04], [x + w * .9, top - w * .04], [x + w * .82, top + w * .14], [x + w * .5, top + w * .44]]); }
}
function arch(g, x, base, w, h, t) {
  const cy = base - h + w / 2;
  g.beginPath(); g.moveTo(x - w / 2 - t, base); g.lineTo(x - w / 2 - t, cy); g.arc(x, cy, w / 2 + t, Math.PI, 0); g.lineTo(x + w / 2 + t, base); g.lineTo(x + w / 2, base); g.lineTo(x + w / 2, cy); g.arc(x, cy, w / 2, 0, Math.PI, true); g.lineTo(x - w / 2, base); g.closePath(); g.fill();
}
function tower(g, x, base, w, h, roof, r, win) {
  g.fillRect(x - w / 2, base - h, w, h + 8);
  if (roof === 'cone') poly(g, [[x - w / 2 - w * .12, base - h], [x, base - h - w * 1.5], [x + w / 2 + w * .12, base - h]]);
  else for (let i = 0; i < 4; i++) g.fillRect(x - w / 2 + i * w / 3.5, base - h - w * .22, w / 7, w * .24);
  if (roof === 'dome') { g.beginPath(); g.arc(x, base - h, w * .55, Math.PI, 0); g.fill(); poly(g, [[x - 2, base - h - w * .5], [x, base - h - w * 1.1], [x + 2, base - h - w * .5]]); }
  if (win) { const f = g.fillStyle; g.fillStyle = win; for (let i = 0; i < 2 + (h > 120 ? 2 : 0); i++) if (r() < .7) g.fillRect(x - 3, base - h + 20 + i * 34, 6, 12); g.fillStyle = f; }
}
function dome(g, x, base, w, h) { g.beginPath(); g.moveTo(x - w, base); g.lineTo(x - w, base - h * .45); g.bezierCurveTo(x - w, base - h * 1.05, x - w * .2, base - h * 1.05, x, base - h * 1.2); g.bezierCurveTo(x + w * .2, base - h * 1.05, x + w, base - h * 1.05, x + w, base - h * .45); g.lineTo(x + w, base); g.closePath(); g.fill(); poly(g, [[x - 2, base - h * 1.15], [x, base - h * 1.45], [x + 2, base - h * 1.15]]); }
function tomb(g, x, base, w, h, r) {
  g.fillRect(x - w / 2, base - h, w, h + 8);
  g.save(); g.translate(x + w * .1, base - h - 4); g.rotate(-.22 + (r() - .5) * .2); g.fillRect(-w * .55, -h * .16, w * 1.1, h * .2); g.restore();
}
function flames(g, x, base, w, h, L, r) {
  const f = g.fillStyle;
  for (let i = 0; i < 3; i++) {
    const fx = x + (i - 1) * w * .32, fh = h * (.6 + r() * .5);
    g.fillStyle = lin(g, 0, base - fh, 0, base, [[0, rgba(L.glow, 0)], [.4, rgba(L.lava, .8)], [1, rgba('#fff0c0', .95)]]);
    g.beginPath(); g.moveTo(fx - w * .2, base); g.quadraticCurveTo(fx - w * .2, base - fh * .5, fx + (r() - .5) * 8, base - fh); g.quadraticCurveTo(fx + w * .2, base - fh * .5, fx + w * .2, base); g.fill();
  }
  g.fillStyle = f;
}
function ribcage(g, x, base, s, r) {
  g.save(); g.strokeStyle = g.fillStyle; g.lineCap = 'round';
  g.lineWidth = s * .09; g.beginPath(); g.moveTo(x - s * 1.4, base - s * .2); g.quadraticCurveTo(x, base - s * 1.05, x + s * 1.4, base - s * .3); g.stroke();
  for (let i = 0; i < 7; i++) { const t = i / 6, bx = x - s * 1.2 + t * s * 2.4, by = base - s * (.55 + Math.sin(t * Math.PI) * .45); g.lineWidth = s * .07 * (1 - t * .3); g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx - s * .5, by + s * .2, bx - s * .3 + (r() - .5) * 6, base + 6); g.stroke(); }
  g.restore();
}
function skull(g, x, base, s, hole) {
  smooth(g, [[x - s, base - s * .9], [x - s * .2, base - s * 1.9], [x + s * .9, base - s * 1.4], [x + s, base - s * .5], [x + s * .5, base], [x - s * .7, base]]);
  if (hole) { const f = g.fillStyle; g.fillStyle = hole; g.beginPath(); g.ellipse(x + s * .3, base - s * .95, s * .26, s * .3, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x - s * .32, base - s * .95, s * .24, s * .28, 0, 0, TAU); g.fill(); g.fillStyle = f; }
}
function boulder(g, x, base, rx, ry, r) { const pts = []; for (let i = 0; i < 10; i++) { const a = Math.PI + i / 9 * Math.PI; pts.push([x + Math.cos(a) * rx * (.85 + r() * .25), base + Math.sin(a) * ry * (.85 + r() * .25)]); } pts.push([x + rx, base + 10], [x - rx, base + 10]); smooth(g, pts); }
function heap(g, x, base, w, h, r) {
  g.beginPath(); g.moveTo(x - w, base + 8); g.quadraticCurveTo(x - w * .4, base - h * 1.1, x, base - h); g.quadraticCurveTo(x + w * .4, base - h * 1.1, x + w, base + 8); g.closePath(); g.fill();
  for (let i = 0; i < 16; i++) { const t = r(), px = x - w * .9 + t * w * 1.8, py = base - h * Math.sin(t * Math.PI) * .95; g.beginPath(); g.ellipse(px, py, 8 + r() * 7, 4 + r() * 3, (r() - .5) * .8, 0, TAU); g.fill(); }
}
function reeds(g, x, base, h, n, r) {
  g.save(); g.strokeStyle = g.fillStyle; g.lineCap = 'round';
  for (let i = 0; i < n; i++) { const rx = x + (r() - .5) * h * .8, rh = h * (.5 + r() * .5), bend = (r() - .5) * h * .4; g.lineWidth = 2 + r() * 2; g.beginPath(); g.moveTo(rx, base + 6); g.quadraticCurveTo(rx + bend * .3, base - rh * .5, rx + bend, base - rh); g.stroke(); if (r() < .4) { g.beginPath(); g.ellipse(rx + bend * .9, base - rh * .92, 3.5, 11, bend * .004, 0, TAU); g.fill(); } }
  g.restore();
}
function shard(g, x, base, w, h, lean) { poly(g, [[x - w, base + 8], [x - w * .3 + lean * .6, base - h * .6], [x + lean, base - h], [x + w * .4 + lean * .5, base - h * .5], [x + w, base + 8]]); }
// a giant, waist-deep in the ice: shoulders, a bowed head, an arm hanging
function giant(g, x, base, s, r, face) {
  smooth(g, [[x - s * .9, base + 10], [x - s * .95, base - s * .9], [x - s * .7, base - s * 1.3], [x - s * .2, base - s * 1.42], [x + s * .3, base - s * 1.4], [x + s * .8, base - s * 1.2], [x + s * .95, base - s * .7], [x + s * .9, base + 10]]);
  smooth(g, [[x - s * .26 + face * s * .1, base - s * 1.3], [x - s * .3 + face * s * .1, base - s * 1.75], [x + face * s * .2, base - s * 1.95], [x + s * .3 + face * s * .25, base - s * 1.7], [x + s * .26, base - s * 1.3]]);
  taperSeg(g, x + s * .82, base - s * 1.1, x + s * 1.1, base - s * .6, x + s * 1.0, base, s * .3, s * .22);
}
// little damned souls, for the whirlwind and the river
function soul(g, x, y, s, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.arc(0, -s * 1.1, s * .32, 0, TAU); g.fill();
  smooth(g, [[-s * .3, -s * .7], [s * .3, -s * .7], [s * .22, s * .3], [s * .08, s * 1.1], [-s * .2, s * .4]]);
  g.lineWidth = s * .14; g.strokeStyle = g.fillStyle; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-s * .2, -s * .6); g.lineTo(-s * .7, -s * 1.3); g.moveTo(s * .2, -s * .6); g.lineTo(s * .7, -s * .2); g.stroke();
  g.restore();
}
function castle(g, x, base, s, r, win) {
  smooth(g, [[x - s * 3, base + 10], [x - s * 1.6, base - s * .55], [x, base - s * .8], [x + s * 1.6, base - s * .55], [x + s * 3, base + 10]]);
  for (let ring = 0; ring < 3; ring++) { const y = base - s * (.55 + ring * .32), w = s * (2.2 - ring * .5); g.fillRect(x - w, y - s * .22, w * 2, s * .3); for (let i = -w; i <= w; i += s * .14) g.fillRect(x + i, y - s * .3, s * .07, s * .1); }
  for (let i = 0; i < 7; i++) { const tx = x - s * 1.5 + i * s * .5, th = s * (.9 + (i === 3 ? .8 : (i % 2) * .35)) + r() * s * .2; tower(g, tx, base - s * .5, s * .26, th, 'cone', r, win); }
}

/* ---------- each circle's three layers ---------- */
// li: 0 far, 1 mid, 2 near. The middle of the near layer stays low, because the fight happens in front of it.
const SCENES = {
  limbo(g, li, W, b, r, c, L) {
    if (li === 0) { ridge(g, 0, W, b, 60, 160, .0016, 11, g.canvas.height); castle(g, W * .6, b - 70, 120, r, rgba(L.glow, .9)); }
    else if (li === 1) { ridge(g, 0, W, b, 10, 90, .003, 12, g.canvas.height); for (let i = 0; i < 9; i++) { const x = r() * W; cypress(g, x, b - 20, 140 + r() * 120, 34 + r() * 16); } arch(g, W * .26, b, 90, 200, 20); arch(g, W * .74, b, 70, 170, 18); }
    else { ridge(g, 0, W, b, 0, 40, .006, 13, g.canvas.height); column(g, W * .07, b, 44, 260, false, r); column(g, W * .14, b, 40, 150, true, r); column(g, W * .9, b, 44, 230, true, r); tree(g, W * .97, b, 300, r); for (let i = 0; i < 6; i++) boulder(g, W * (.2 + r() * .6), b, 30 + r() * 30, 18 + r() * 14, r); }
  },
  lust(g, li, W, b, r, c, L) {
    if (li === 0) { ridge(g, 0, W, b, 80, 320, .0022, 21, g.canvas.height, 5); }
    else if (li === 1) { ridge(g, 0, W, b, 20, 120, .004, 22, g.canvas.height); for (let i = 0; i < 7; i++) spire(g, r() * W, b - 10, 26 + r() * 20, 180 + r() * 160, .5 + r() * .5, r); }
    else { ridge(g, 0, W, b, 0, 50, .006, 23, g.canvas.height); spire(g, W * .05, b, 50, 380, .6, r); spire(g, W * .95, b, 46, 320, .7, r); tree(g, W * .12, b, 220, r, { droop: 1.4, spread: .4 }); for (let i = 0; i < 5; i++) rockPile(g, W * (.2 + r() * .6), b, 50 + r() * 50, 30 + r() * 20, r); }
  },
  gluttony(g, li, W, b, r, c, L) {
    if (li === 0) ridge(g, 0, W, b, 30, 140, .002, 31, g.canvas.height);
    else if (li === 1) { ridge(g, 0, W, b, 0, 80, .003, 32, g.canvas.height); for (let i = 0; i < 4; i++) ribcage(g, W * (.1 + i * .27 + r() * .06), b, 70 + r() * 40, r); }
    else { ridge(g, 0, W, b, 0, 40, .006, 33, g.canvas.height); ribcage(g, W * .06, b, 120, r); taperSeg(g, W * .9, b + 6, W * .93, b - 200, W * .97, b - 330, 40, 12); for (let i = 0; i < 7; i++) skull(g, W * (.18 + r() * .64), b + 4, 14 + r() * 10, mixc(c, L.haze, .45)); for (let i = 0; i < 5; i++) boulder(g, W * (.2 + r() * .6), b, 40 + r() * 40, 16 + r() * 12, r); }
  },
  greed(g, li, W, b, r, c, L) {
    if (li === 0) { for (let i = 0; i < 6; i++) heap(g, W * (i / 5) + (r() - .5) * 100, b, 260 + r() * 120, 160 + r() * 120, r); }
    else if (li === 1) { ridge(g, 0, W, b, 0, 60, .003, 42, g.canvas.height); for (let i = 0; i < 6; i++) boulder(g, r() * W, b, 70 + r() * 50, 70 + r() * 40, r); for (let i = 0; i < 3; i++) heap(g, r() * W, b, 140, 90, r); }
    else { ridge(g, 0, W, b, 0, 30, .006, 43, g.canvas.height); heap(g, W * .06, b, 180, 200, r); heap(g, W * .95, b, 160, 170, r); boulder(g, W * .14, b, 70, 60, r); for (let i = 0; i < 6; i++) heap(g, W * (.2 + r() * .6), b, 40 + r() * 30, 20 + r() * 14, r); }
  },
  wrath(g, li, W, b, r, c, L) {
    if (li === 0) { ridge(g, 0, W, b, 0, 40, .003, 51, g.canvas.height); g.fillRect(0, b - 120, W, 140); for (let i = 0; i < 18; i++) tower(g, i * W / 17 + (r() - .5) * 40, b - 110, 34 + r() * 26, 60 + r() * 120, r() < .5 ? 'cone' : 'flat', r, rgba(L.lava, .9)); }
    else if (li === 1) { ridge(g, 0, W, b, 0, 30, .004, 52, g.canvas.height); for (let i = 0; i < 6; i++) tree(g, r() * W, b, 160 + r() * 90, r, { depth: 5 }); reeds(g, W * .5, b, 90, 40, r); }
    else { ridge(g, 0, W, b, 0, 24, .006, 53, g.canvas.height); tree(g, W * .05, b, 340, r); tree(g, W * .96, b, 300, r); reeds(g, W * .12, b, 140, 24, r); reeds(g, W * .88, b, 150, 24, r); reeds(g, W * .5, b, 60, 30, r); }
  },
  heresy(g, li, W, b, r, c, L) {
    if (li === 0) { ridge(g, 0, W, b, 0, 30, .003, 61, g.canvas.height); for (let i = 0; i < 12; i++) { const x = r() * W; r() < .5 ? dome(g, x, b - 20, 40 + r() * 40, 90 + r() * 70) : tower(g, x, b - 20, 18 + r() * 10, 160 + r() * 140, r() < .6 ? 'dome' : 'cone', r, rgba(L.lava, .95)); } }
    else if (li === 1) { ridge(g, 0, W, b, 0, 30, .004, 62, g.canvas.height); for (let i = 0; i < 9; i++) { const x = r() * W, w = 60 + r() * 30; tomb(g, x, b, w, 34 + r() * 10, r); flames(g, x, b - 40, w, 50 + r() * 40, L, r); } }
    else { ridge(g, 0, W, b, 0, 24, .006, 63, g.canvas.height); for (const [x, w] of [[W * .05, 120], [W * .95, 130]]) { tomb(g, x, b, w, 60, r); flames(g, x, b - 64, w, 90, L, r); } column(g, W * .13, b, 40, 220, true, r); for (let i = 0; i < 5; i++) { const x = W * (.22 + r() * .56); tomb(g, x, b + 10, 70, 22, r); } }
  },
  violence(g, li, W, b, r, c, L) {
    if (li === 0) { ridge(g, 0, W, b, 60, 260, .0025, 71, g.canvas.height, 5); const f = g.fillStyle; g.fillStyle = lin(g, 0, b - 30, 0, b + 10, [[0, rgba(L.lava, 0)], [.5, rgba(L.lava, .9)], [1, rgba(L.lava, 0)]]); g.fillRect(0, b - 30, W, 40); g.fillStyle = f; }
    else if (li === 1) { ridge(g, 0, W, b, 0, 40, .004, 72, g.canvas.height); for (let i = 0; i < 8; i++) tree(g, r() * W, b, 200 + r() * 120, r, { thorns: true, spread: .7, depth: 6 }); }
    else { ridge(g, 0, W, b, 0, 30, .006, 73, g.canvas.height); tree(g, W * .04, b, 420, r, { thorns: true, spread: .7 }); tree(g, W * .97, b, 380, r, { thorns: true, spread: .7 }); for (let i = 0; i < 6; i++) rockPile(g, W * (.2 + r() * .6), b, 40 + r() * 40, 20 + r() * 16, r); }
  },
  fraud(g, li, W, b, r, c, L) {
    if (li === 0) { ridge(g, 0, W, b, 20, 60, .003, 81, g.canvas.height); for (let k = 0; k < 4; k++) { const y = b - 60 - k * 70; g.fillRect(0, y, W, 14); for (let i = 0; i < 9; i++) arch(g, i * W / 8 + k * 60, y + 70, 150, 70, 14); } }
    else if (li === 1) { ridge(g, 0, W, b, 0, 50, .004, 82, g.canvas.height); g.fillRect(W * .15, b - 220, W * .7, 26); for (let i = 0; i < 4; i++) arch(g, W * (.24 + i * .17), b, 200, 220, 26); }
    else { ridge(g, 0, W, b, 0, 30, .006, 83, g.canvas.height); spire(g, W * .04, b, 70, 330, .1, r); spire(g, W * .96, b, 64, 300, -.1, r); for (let i = 0; i < 5; i++) rockPile(g, W * (.2 + r() * .6), b, 50 + r() * 40, 24 + r() * 16, r); }
  },
  treachery(g, li, W, b, r, c, L) {
    if (li === 0) { ridge(g, 0, W, b, 0, 40, .003, 91, g.canvas.height); for (let i = 0; i < 4; i++) giant(g, W * (.12 + i * .26 + r() * .06), b + 10, 110 + r() * 40, r, r() < .5 ? -1 : 1); }
    else if (li === 1) { ridge(g, 0, W, b, 0, 30, .004, 92, g.canvas.height); for (let i = 0; i < 14; i++) shard(g, r() * W, b, 20 + r() * 26, 90 + r() * 160, (r() - .5) * 60); }
    else { ridge(g, 0, W, b, 0, 20, .006, 93, g.canvas.height); for (const x of [W * .03, W * .08, W * .93, W * .98]) shard(g, x, b, 40 + r() * 20, 220 + r() * 160, (r() - .5) * 80); for (let i = 0; i < 8; i++) shard(g, W * (.18 + r() * .64), b, 10 + r() * 10, 30 + r() * 40, (r() - .5) * 20); }
  },
  // the title: the gate of Hell, standing alone in the fire
  gate(g, li, W, b, r, c, L) {
    if (li === 0) ridge(g, 0, W, b, 40, 220, .0022, 101, g.canvas.height, 5);
    else if (li === 1) { ridge(g, 0, W, b, 0, 60, .004, 102, g.canvas.height); for (let i = 0; i < 6; i++) { const x = r() < .5 ? r() * W * .3 : W * .7 + r() * W * .3; spire(g, x, b, 30 + r() * 20, 160 + r() * 140, (r() - .5) * .6, r); } }
    else {
      ridge(g, 0, W, b, 0, 20, .006, 103, g.canvas.height);
      // the gate: two great piers and a pointed arch of dressed stone, a carved band across its brow
      const x = W / 2, w = 200, h = 318, t = 56, spring = b - h * .52;
      const f = g.fillStyle;
      g.beginPath(); g.moveTo(x - w / 2 - t, b + 6); g.lineTo(x - w / 2 - t, spring);
      g.quadraticCurveTo(x - w / 2 - t, b - h - t * .6, x, b - h - t * 1.1); g.quadraticCurveTo(x + w / 2 + t, b - h - t * .6, x + w / 2 + t, spring); g.lineTo(x + w / 2 + t, b + 6);
      g.lineTo(x + w / 2, b + 6); g.lineTo(x + w / 2, spring); g.quadraticCurveTo(x + w / 2, b - h + 30, x, b - h); g.quadraticCurveTo(x - w / 2, b - h + 30, x - w / 2, spring); g.lineTo(x - w / 2, b + 6); g.closePath(); g.fill();
      // capitals, plinths, the keystone and spikes along the arch
      for (const sd of [-1, 1]) { g.fillRect(x + sd * (w / 2 + t / 2) - t * .7, spring - 14, t * 1.4, 22); g.fillRect(x + sd * (w / 2 + t / 2) - t * .72, b - 26, t * 1.44, 32); }
      poly(g, [[x - 26, b - h - t * 1.0], [x, b - h - t * 1.9], [x + 26, b - h - t * 1.0]]);
      for (let i = 1; i < 8; i++) { const a = Math.PI * (i / 8), px = x - Math.cos(a) * (w / 2 + t) * .98, py = spring - Math.sin(a) * (h * .5 + t * .4) - 6; poly(g, [[px - 7, py + 4], [px - Math.cos(a) * 30, py - Math.sin(a) * 40 - 6], [px + 7, py + 4]]); }
      // joints between the stones, and the inscription band, cut lighter
      g.fillStyle = mixc(c, L.haze, .35);
      for (const sd of [-1, 1]) for (let yy = spring + 30; yy < b - 30; yy += 46) g.fillRect(x + sd * (w / 2 + t / 2) - t / 2, yy, t, 2);
      g.fillRect(x - w / 2 - t * .7, spring - 64, w + t * 1.4, 3); g.fillRect(x - w / 2 - t * .7, spring - 40, w + t * 1.4, 3);
      g.fillStyle = f;
      spire(g, W * .08, b, 50, 300, .2, r); spire(g, W * .93, b, 46, 280, -.2, r);
    }
  },
};

/* ---------- painting ---------- */
// the top edge of a layer's silhouettes catches the light; the foot of it sinks into fog
function edgeLight(c, L, a) {
  const g = c.getContext('2d'), e = canvas(c.width, c.height), eg = e.getContext('2d');
  eg.drawImage(c, 0, 0); eg.globalCompositeOperation = 'destination-out'; eg.drawImage(c, 0, 4);
  eg.globalCompositeOperation = 'source-in'; eg.fillStyle = rgba(L.rim, a); eg.fillRect(0, 0, c.width, c.height);
  g.drawImage(e, 0, 0);
}
export function paintLayer(L, key, li) {
  const D = LAYERS[li], H = D.h, c = canvas(LW, H), g = c.getContext('2d'), b = H - BASE, r = rand(key.length * 97 + li * 13 + 5);
  const col = mixc(L.ink, L.haze, D.haze);
  g.fillStyle = col;
  SCENES[key](g, li, LW, b, r, col, L);
  g.fillStyle = col; g.fillRect(0, b + 4, LW, BASE);
  edgeLight(c, L, .22 + (2 - li) * .1);
  // fog rising at the foot
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = lin(g, 0, b - 160, 0, H, [[0, rgba(L.fog, 0)], [.5, rgba(L.fog, .28 + li * .05)], [.75, rgba(L.fog, .5)], [1, rgba(L.fog, .6)]]);
  g.fillRect(0, b - 160, LW, H);
  g.globalCompositeOperation = 'source-over';
  return c;
}
function grain(g, W, H, a) {
  const t = canvas(128, 128), tg = t.getContext('2d'), img = tg.createImageData(128, 128), r = rand(7);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  tg.putImageData(img, 0, 0);
  g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'overlay'; g.fillStyle = g.createPattern(t, 'repeat'); g.fillRect(0, 0, W, H); g.restore();
}
// paper clouds: long flat bands with a scalloped top edge
function cloudBand(g, W, y, h, col, r) {
  g.fillStyle = col; g.beginPath();
  for (let x = -60; x < W + 80; x += 50 + r() * 70) { const rr = h * (.5 + r() * .6); g.moveTo(x + rr * 2.6, y); g.ellipse(x, y, rr * 2.6, rr * .75, 0, 0, TAU); }
  g.fill(); g.fillRect(-10, y, W + 20, h * .35);
}
export const HZ = .7;   // where the horizon sits on the sky
export function paintSky(L, key) {
  const W = 1024, H = 1024, c = canvas(W, H), g = c.getContext('2d'), r = rand(key.length * 31 + 7), hz = H * HZ;
  g.fillStyle = lin(g, 0, 0, 0, H, [[0, L.sky[0]], [.2, L.sky[0]], [.48, L.sky[1]], [HZ, L.sky[2]], [1, L.sky[2]]]); g.fillRect(0, 0, W, H);
  // the light everything stands against
  g.fillStyle = rad(g, W / 2, hz, 10, W * .7, [[0, rgba(L.glow, .75)], [.25, rgba(L.glow, .3)], [.6, rgba(L.glow, .08)], [1, rgba(L.glow, 0)]]); g.fillRect(0, 0, W, H);
  if (key === 'limbo') { g.fillStyle = rgba(L.glow, .9); g.beginPath(); g.arc(W * .36, H * .3, 46, 0, TAU); g.fill(); g.fillStyle = rad(g, W * .36, H * .3, 40, 200, [[0, rgba(L.glow, .35)], [1, rgba(L.glow, 0)]]); g.fillRect(0, 0, W, H); }
  if (key === 'lust') {
    for (let k = 0; k < 9; k++) { g.strokeStyle = rgba(k % 2 ? L.glow : L.sky[0], .07 + k * .012); g.lineWidth = 26 - k * 2; g.beginPath(); g.ellipse(W * .52, hz - 220, 80 + k * 52, 22 + k * 15, -.08, k * .7, k * .7 + 4.6); g.stroke(); }
    g.fillStyle = rgba(L.sky[0], .55); for (let i = 0; i < 40; i++) { const a = r() * TAU, k = 2 + r() * 7; soul(g, W * .52 + Math.cos(a) * (80 + k * 52), hz - 220 + Math.sin(a) * (22 + k * 15), 4 + r() * 4, a + 1.6); }
  }
  if (key === 'greed') { g.fillStyle = rgba('#fff0c0', .85); g.beginPath(); g.arc(W * .5, hz + 20, 130, Math.PI, 0); g.fill(); }
  if (key === 'violence') { g.fillStyle = rgba('#ffd8c0', .8); g.beginPath(); g.arc(W * .62, hz - 160, 54, 0, TAU); g.fill(); }
  if (key === 'treachery') { for (let i = 0; i < 140; i++) { g.fillStyle = rgba('#ffffff', .2 + r() * .7); g.fillRect(r() * W, r() * hz * .7, 1.5, 1.5); } }
  if (key === 'fraud') { g.fillStyle = rgba(L.glow, .5); g.beginPath(); g.arc(W * .68, H * .26, 30, 0, TAU); g.fill(); }
  // smoke climbing out of the pit in the fiery circles
  if (['wrath', 'heresy', 'violence', 'gate'].includes(key)) for (let i = 0; i < 3; i++) {
    const x = W * (.15 + i * .35 + r() * .1), n = noise2(i + 3); g.fillStyle = rgba(L.sky[0], .16);
    g.beginPath(); g.moveTo(x - 16, hz); for (let y = hz; y > 0; y -= 16) g.lineTo(x - 12 - (hz - y) * .08 + (fbm(n, y * .008, 0, 3) - .5) * 160, y); for (let y = 0; y <= hz; y += 16) g.lineTo(x + 12 + (hz - y) * .08 + (fbm(n, y * .008, 5, 3) - .5) * 160, y); g.closePath(); g.fill();
  }
  // bands of paper cloud: dark ones high up, a lit one lower down
  const nb = key === 'gluttony' ? 4 : 3;
  for (let i = 0; i < nb; i++) { const y = H * (.1 + i * (.4 / nb)) + r() * 24; cloudBand(g, W, y, 16 + r() * 12, i < nb - 1 ? rgba(L.sky[0], .22) : rgba(L.glow, .1), r); }
  if (key === 'gluttony') { g.strokeStyle = rgba(L.glow, .12); g.lineWidth = 1.5; for (let i = 0; i < 360; i++) { const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 7, y + 28); g.stroke(); } }
  grain(g, W, H, .06);
  return c;
}
// the ledge they fight on: black rock, a sheen of the glow toward its far edge
export function paintFloor(L, key) {
  const W = 512, H = 256, c = canvas(W, H), g = c.getContext('2d'), r = rand(key.length * 17 + 3);
  g.fillStyle = lin(g, 0, 0, 0, H, [[0, mixc(L.ink, L.haze, .5)], [.04, mixc(L.ink, L.haze, .2)], [.16, L.ink], [1, '#000000']]); g.fillRect(0, 0, W, H);
  if (key === 'treachery') { g.fillStyle = lin(g, 0, 0, 0, H, [[0, rgba(L.glow, .5)], [.2, rgba(L.glow, .12)], [1, rgba(L.glow, 0)]]); g.fillRect(0, 0, W, H); }
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 10; k++) {
    let x = r() * W, y = H * .02 + r() * H * .2, a = r() * TAU;
    g.strokeStyle = rgba(L.lava, .1 + r() * .14); g.lineWidth = .6 + r(); g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 9; s++) { a += (r() - .5) * 1.2; x += Math.cos(a) * 5; y += Math.sin(a) * 1; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  grain(g, W, H, .08);
  return c;
}
// the broken far edge of the ledge, seen against the haze: a ragged black line with light along its top
export function paintLip(L, key) {
  const W = 2048, H = 128, c = canvas(W, H), g = c.getContext('2d'), n = noise2(key.length * 5 + 1);
  g.fillStyle = L.ink; g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, 34 + fbm(n, x * .01, 0, 4) * 50);
  g.lineTo(W, H); g.closePath(); g.fill();
  edgeLight(c, L, .55);
  return c;
}
