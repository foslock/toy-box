// Ruckus kit: everything the scenes draw with. Flat fills and fat strokes only (no gradients, no blur), colours from
// one loud palette, and every function is a pure function of the time it is given, so a scene can be scrubbed,
// sped up or cut short without keeping any state.
import { GLYPHS, SW, pointAt } from './font.js';

export const TAU = Math.PI * 2, PI = Math.PI;
export const S = Math.sin, C = Math.cos;
export const sat = t => t < 0 ? 0 : t > 1 ? 1 : t;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => sat((t - a) / (b - a));      // how far t is through the span [a, b], 0..1

/* ---------- easing (each takes 0..1) ---------- */
export const E = {
  out: t => 1 - (1 - t) ** 3,
  out2: t => 1 - (1 - t) ** 2,
  in: t => t * t * t,
  io: t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
  outBack: t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  inBack: t => 2.70158 * t * t * t - 1.70158 * t * t,
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * S((t * 10 - 0.75) * (TAU / 3)) + 1,
  outBounce: t => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
};
// pop in: 0 → 1 with an overshoot, starting at t0 and taking d seconds
export const pop = (t, t0, d = 0.35) => t <= t0 ? 0 : E.outBack(seg(t, t0, t0 + d));
// pop out: 1 → 0, snapping shut
export const unpop = (t, t0, d = 0.25) => 1 - E.inBack(seg(t, t0, t0 + d));
// a settling spring: 0 → 1 with a few decaying overshoots
export const spring = (t, f = 2.2, d = 5) => t <= 0 ? 0 : 1 - Math.exp(-d * t) * C(TAU * f * t);
// a decaying wobble around 0
export const wob = (t, f = 3, d = 4) => t <= 0 ? 0 : Math.exp(-d * t) * S(TAU * f * t);
// a ball's height over time: parabolic hops of period T that lose height by `decay` each time; 0 on the ground
export function hop(t, T, h, decay = 1) {
  if (t < 0) return 0;
  const n = Math.floor(t / T), p = t / T - n;
  return h * decay ** n * 4 * p * (1 - p);
}
// steps: holds each value for 1/fps seconds (for flicker that should look drawn, not smooth)
export const tick = (t, fps) => Math.floor(t * fps);

/* ---------- randomness that depends only on (seed, i, j), so a scene looks the same whenever it is drawn ---------- */
export function hash(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* ---------- colour ---------- */
export const mixHex = (a, b, t) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), ch = s => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
};
export const K = {
  pink: '#ff2e88', red: '#ff3b30', orange: '#ff8a00', yellow: '#ffd60a', lime: '#b3e51c', green: '#10c76a', teal: '#00cbbd', sky: '#24b9ff',
  blue: '#2f5cff', indigo: '#4b2fe6', violet: '#8a3dff', purple: '#c23cff', magenta: '#f22fc4',
  white: '#ffffff', cream: '#fff1d2', ink: '#1a1046', black: '#0c0820',
};
// every colour also comes darker (D), lighter (L) and a little lighter (M)
for (const n of Object.keys(K)) { if (n === 'white' || n === 'ink' || n === 'black') continue; K[n + 'D'] = mixHex(K[n], '#12082e', 0.28); K[n + 'L'] = mixHex(K[n], '#ffffff', 0.38); K[n + 'M'] = mixHex(K[n], '#ffffff', 0.17); }
export const FEST = [K.pink, K.yellow, K.sky, K.lime, K.orange, K.purple, K.white, K.red];

/* ---------- the canvas everything draws on ---------- */
let c = null;
export const bind = ctx => {
  if (!ctx.clipPatched) {                                          // clips a scene sets up in the hero frame would be shrunk with it while the letter lands, so they are skipped then
    const clip = ctx.clip;
    ctx.clip = function (...args) { return HERO.un < 1 ? undefined : clip.apply(this, args); };
    ctx.clipPatched = true;
  }
  c = ctx;
};
export const raw = () => c;                                      // the canvas context itself, for anything the helpers don't cover
export const alpha = v => { c.globalAlpha = v; };                  // remember to put it back to 1

/* ---------- basic shapes ---------- */
export function disc(x, y, r, col) { if (r <= 0) return; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
export function discO(x, y, r, col, ol = 3, ink = K.ink) { if (r <= 0) return; disc(x, y, r + ol, ink); disc(x, y, r, col); }     // with the dark outline the letters have
export function ring(x, y, r, lw, col) { if (r <= 0 || lw <= 0) return; c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
export function oval(x, y, rx, ry, col, rot = 0) { if (rx <= 0 || ry <= 0) return; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); }
export function ovalO(x, y, rx, ry, col, rot = 0, ol = 3, ink = K.ink) { if (rx <= 0 || ry <= 0) return; oval(x, y, rx + ol, ry + ol, ink, rot); oval(x, y, rx, ry, col, rot); }
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
// a rectangle centred on (x, y), turned by rot, with rounded corners of radius rad
export function box(x, y, w, h, col, rot = 0, rad = 0) {
  if (w <= 0 || h <= 0) return;
  c.fillStyle = col;
  if (!rot && !rad) { c.fillRect(x - w / 2, y - h / 2, w, h); return; }
  if (!rot) { c.beginPath(); rr(x - w / 2, y - h / 2, w, h, rad); c.fill(); return; }
  c.save(); c.translate(x, y); c.rotate(rot);
  if (rad) { c.beginPath(); rr(-w / 2, -h / 2, w, h, rad); c.fill(); } else c.fillRect(-w / 2, -h / 2, w, h);
  c.restore();
}
export function boxO(x, y, w, h, col, rot = 0, rad = 0, ol = 3, ink = K.ink) { if (w <= 0 || h <= 0) return; box(x, y, w + ol * 2, h + ol * 2, ink, rot, rad + ol); box(x, y, w, h, col, rot, rad); }
export function line(x1, y1, x2, y2, lw, col, cap = 'round') { if (lw <= 0) return; c.strokeStyle = col; c.lineWidth = lw; c.lineCap = cap; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
export function poly(p, col) { c.fillStyle = col; c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); c.fill(); }
export function pline(p, lw, col, cap = 'round') { if (lw <= 0) return; c.strokeStyle = col; c.lineWidth = lw; c.lineCap = cap; c.lineJoin = 'round'; c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); }
export function tri(x, y, r, rot, col) { c.fillStyle = col; c.beginPath(); addTri(x, y, r, rot); c.fill(); }
export function star(x, y, ro, n, ri, rot, col) { c.fillStyle = col; c.beginPath(); addStar(x, y, ro, ri, n, rot); c.fill(); }
export const spark = (x, y, r, rot, col) => star(x, y, r, 4, r * 0.24, rot, col);     // a four-point twinkle
export function heart(x, y, s, rot, col) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.beginPath();
  c.moveTo(0, s); c.bezierCurveTo(-s * 1.7, -s * 0.15, -s * 0.9, -s * 1.2, 0, -s * 0.4); c.bezierCurveTo(s * 0.9, -s * 1.2, s * 1.7, -s * 0.15, 0, s); c.fill(); c.restore();
}
export function drop(x, y, s, rot, col) {       // a teardrop, point up
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.beginPath();
  c.moveTo(0, -s * 1.5); c.bezierCurveTo(s * 0.3, -s * 0.8, s, -s * 0.2, s, s * 0.35); c.arc(0, s * 0.35, s, 0, PI); c.bezierCurveTo(-s, -s * 0.2, -s * 0.3, -s * 0.8, 0, -s * 1.5); c.fill(); c.restore();
}
export function leaf(x, y, s, rot, col, vein) {   // pointed at both ends, s long each way from the middle
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.beginPath();
  c.moveTo(0, -s); c.quadraticCurveTo(s * 0.85, -s * 0.15, 0, s); c.quadraticCurveTo(-s * 0.85, -s * 0.15, 0, -s); c.fill();
  if (vein) { c.strokeStyle = vein; c.lineWidth = Math.max(1, s * 0.07); c.beginPath(); c.moveTo(0, -s * 0.8); c.lineTo(0, s * 1.05); c.stroke(); }
  c.restore();
}
export function pie(x, y, r, a0, a1, col) { if (r <= 0) return; c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, a0, a1); c.closePath(); c.fill(); }
export function arcS(x, y, r, a0, a1, lw, col, cap = 'round') { if (r <= 0 || lw <= 0) return; c.strokeStyle = col; c.lineWidth = lw; c.lineCap = cap; c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); }
export function crescent(x, y, r, rot, col, bite = 0.62) {   // a moon: a circle with a bite out of one side
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.beginPath();
  c.arc(0, 0, r, -PI * 0.5, PI * 0.5, false); c.arc(r * bite * 0.6, 0, r * 0.86, PI * 0.5, -PI * 0.5, true); c.closePath(); c.fill(); c.restore();
}
// a wobbly circle whose outline drifts with time (goo, slime, paint)
export function blob(x, y, r, seed, wobble, t, col, n = 14) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, rr2 = r * (1 + wobble * S(t * 3 + i * 2.3 + seed * 7) * (0.6 + 0.4 * S(i * 1.7 + seed)));
    const px = x + C(a) * rr2, py = y + S(a) * rr2;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.closePath(); c.fill();
}
export function zig(x1, y1, x2, y2, n, amp, lw, col) {   // a lightning-style zigzag between two points
  if (lw <= 0) return;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x1, y1);
  for (let i = 1; i < n; i++) { const f = i / n, o = (i & 1 ? 1 : -1) * amp * (0.6 + 0.4 * hash(i, 3)); c.lineTo(x1 + dx * f + nx * o, y1 + dy * f + ny * o); }
  c.lineTo(x2, y2); c.stroke();
}
export function bolt(x, y, s, rot, col) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.beginPath();
  c.moveTo(s * 0.25, -s); c.lineTo(-s * 0.55, s * 0.12); c.lineTo(-s * 0.08, s * 0.12); c.lineTo(-s * 0.3, s); c.lineTo(s * 0.6, -s * 0.2); c.lineTo(s * 0.1, -s * 0.2); c.closePath(); c.fill(); c.restore();
}
// a sine wave as a stroked line
export function wave(x0, x1, y, amp, len, ph, lw, col) {
  if (lw <= 0) return;
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  const n = Math.max(2, Math.ceil((x1 - x0) / 22));
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, yy = y + amp * S(x / len * TAU + ph); if (i) c.lineTo(x, yy); else c.moveTo(x, yy); }
  c.stroke();
}
// the ground under a sine wave, filled down to y1
export function band(x0, x1, y, amp, len, ph, col, y1) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x0, y1);
  const n = Math.max(2, Math.ceil((x1 - x0) / 26));
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; c.lineTo(x, y + amp * S(x / len * TAU + ph)); }
  c.lineTo(x1, y1); c.closePath(); c.fill();
}
// a sunburst: n wedges (every other slot) out to radius r
export function rays(x, y, n, r, rot, col, fill = 0.5) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + i / n * TAU, w = TAU / n * fill; c.moveTo(x, y); c.lineTo(x + C(a - w / 2) * r, y + S(a - w / 2) * r); c.lineTo(x + C(a + w / 2) * r, y + S(a + w / 2) * r); c.closePath(); }
  c.fill();
}
export function spiral(x, y, r0, r1, turns, rot, lw, col) {
  if (lw <= 0) return;
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  const n = Math.ceil(turns * Math.max(24, PI * Math.sqrt(Math.max(r0, r1) / 2)));      // enough steps that a big spiral doesn't show its facets
  for (let i = 0; i <= n; i++) { const f = i / n, a = rot + f * turns * TAU, r = lerp(r0, r1, f); if (i) c.lineTo(x + C(a) * r, y + S(a) * r); else c.moveTo(x + C(a) * r, y + S(a) * r); }
  c.stroke();
}
export function cloud(x, y, s, col) {
  c.fillStyle = col; c.beginPath();
  c.moveTo(x - 1.05 * s, y + 0.8 * s);
  c.arc(x - 1.05 * s, y + 0.25 * s, 0.55 * s, PI * 0.5, PI * 1.5); c.arc(x - 0.4 * s, y - 0.3 * s, 0.85 * s, PI, PI * 1.9);
  c.arc(x + 0.6 * s, y - 0.05 * s, 0.7 * s, PI * 1.35, PI * 0.5); c.arc(x + 1.2 * s, y + 0.3 * s, 0.45 * s, -PI * 0.5, PI * 0.5);
  c.closePath(); c.fill();
}
export function gear(x, y, r, teeth, rot, col, hole) {
  c.fillStyle = col; c.beginPath();
  const ri = r * 0.8;
  for (let i = 0; i < teeth; i++) {
    const a = rot + i / teeth * TAU, w = TAU / teeth;
    for (const [da, rad] of [[0.06, ri], [0.2, r], [0.55, r], [0.7, ri]]) { const aa = a + da * w * 1.4, px = x + C(aa) * rad, py = y + S(aa) * rad; if (!i && da === 0.06) c.moveTo(px, py); else c.lineTo(px, py); }
  }
  c.closePath(); c.fill(); if (hole) disc(x, y, r * 0.35, hole);
}
export function flower(x, y, r, rot, n, pet, mid) {
  c.fillStyle = pet; c.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; c.moveTo(x + C(a) * r * 0.55 + r * 0.4, y + S(a) * r * 0.55); c.ellipse(x + C(a) * r * 0.55, y + S(a) * r * 0.55, r * 0.45, r * 0.3, a, 0, TAU); }
  c.fill(); disc(x, y, r * 0.3, mid);
}
export function note(x, y, s, rot, col) {      // a music note with a flag
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = s * 0.22; c.lineCap = 'round';
  c.beginPath(); c.ellipse(0, 0, s * 0.6, s * 0.44, -0.4, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(s * 0.5, -s * 0.1); c.lineTo(s * 0.5, -s * 1.6); c.quadraticCurveTo(s * 1.3, -s * 1.3, s * 0.95, -s * 0.5); c.stroke(); c.restore();
}
export function balloon(x, y, s, rot, col, string = K.white) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.strokeStyle = string; c.lineWidth = Math.max(2, s * 0.05); c.lineCap = 'round'; c.beginPath(); c.moveTo(0, s * 1.2); c.bezierCurveTo(-s * 0.3, s * 1.6, s * 0.3, s * 1.9, 0, s * 2.5); c.stroke();
  c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, s * 0.85, s * 1.05, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(0, s * 1.0); c.lineTo(-s * 0.16, s * 1.28); c.lineTo(s * 0.16, s * 1.28); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-s * 0.35, -s * 0.4, s * 0.16, s * 0.3, 0.5, 0, TAU); c.fill();
  c.restore();
}
export function coin(x, y, r, spin, col, edge) {   // a coin turning about its vertical axis
  const w = Math.abs(C(spin)) * r;
  oval(x, y, Math.max(1, w), r, edge);
  if (w > 3) { oval(x, y, w * 0.78, r * 0.78, col); }
}
export function bird(x, y, s, flap, col) {   // two curved wings; flap in -1..1
  c.strokeStyle = col; c.lineWidth = Math.max(2, s * 0.22); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  c.moveTo(x - s, y - s * 0.2 * flap); c.quadraticCurveTo(x - s * 0.4, y - s * (0.7 + flap * 0.5), x, y); c.quadraticCurveTo(x + s * 0.4, y - s * (0.7 + flap * 0.5), x + s, y - s * 0.2 * flap); c.stroke();
}
export function eye(x, y, r, lx, ly, col = K.white, pupil = K.ink, squash = 1) {   // a googly eye; (lx, ly) is where it looks, -1..1
  c.save(); c.translate(x, y); c.scale(1, Math.max(0.05, squash));
  disc(0, 0, r, col); disc(lx * r * 0.42, ly * r * 0.42, r * 0.5, pupil); disc(lx * r * 0.42 - r * 0.14, ly * r * 0.42 - r * 0.16, r * 0.14, K.white);
  c.restore();
}
export function eyes(x, y, gap, r, lx, ly, squash = 1, col = K.white, pupil = K.ink) { eye(x - gap / 2, y, r, lx, ly, col, pupil, squash); eye(x + gap / 2, y, r, lx, ly, col, pupil, squash); }

/* ---------- little bits, drawn in bulk: one path per colour ---------- */
export function addDisc(x, y, r) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
export function addBox(x, y, w, h, rot) {
  const cs = C(rot), sn = S(rot), a = w / 2, b = h / 2;
  c.moveTo(x - cs * a + sn * b, y - sn * a - cs * b); c.lineTo(x + cs * a + sn * b, y + sn * a - cs * b); c.lineTo(x + cs * a - sn * b, y + sn * a + cs * b); c.lineTo(x - cs * a - sn * b, y - sn * a + cs * b); c.closePath();
}
export function addTri(x, y, r, rot) {
  c.moveTo(x + C(rot) * r, y + S(rot) * r); c.lineTo(x + C(rot + 2.094) * r, y + S(rot + 2.094) * r); c.lineTo(x + C(rot + 4.189) * r, y + S(rot + 4.189) * r); c.closePath();
}
export function addStar(x, y, ro, ri, n, rot) {
  for (let i = 0; i < n * 2; i++) { const a = rot + i * PI / n, r = i & 1 ? ri : ro; if (i) c.lineTo(x + C(a) * r, y + S(a) * r); else c.moveTo(x + C(a) * r, y + S(a) * r); }
  c.closePath();
}
// fn(i) adds the i-th of n shapes to the current path; bits are dealt out to the colours in turn and each colour is filled once
export function bits(cols, n, fn) {
  const nc = cols.length;
  for (let k = 0; k < nc && k < n; k++) { c.fillStyle = cols[k]; c.beginPath(); for (let i = k; i < n; i += nc) fn(i); c.fill(); }
}
const KIND = { dot: 0, rect: 1, tri: 2, star: 3, spark: 4 };
// Confetti thrown from a point at time o.t0 (give n as a.n(count) so it grows for capitals and shrinks under load): n bits fly out in directions a0..a1 at speeds v0..v1 (px/s), slow down by
// `drag`, fall under gravity g, spin, and shrink away over `life` seconds.
export function spray(a, t, o) {
  const life = o.life || 1.3, age = t - (o.t0 || 0);
  if (age <= 0 || age >= life) return;
  const n = Math.round(o.n), x0 = o.x || 0, y0 = o.y || 0, sd = o.seed || 0, a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, v0 = o.v0 ?? 250, v1 = o.v1 ?? 800;
  const g = o.g ?? 1100, s0 = o.s0 ?? 7, s1 = o.s1 ?? 20, drag = o.drag ?? 1.6, kind = KIND[o.shape];
  const dist = (1 - Math.exp(-drag * age)) / drag, shrink = 1 - sat((age / life - 0.55) / 0.45);
  bits(o.cols || FEST, n, i => {
    const ang = a0 + (a1 - a0) * a.r(sd + i, 1), v = v0 + (v1 - v0) * a.r(sd + i, 2);
    const x = x0 + C(ang) * v * dist, y = y0 + S(ang) * v * dist + 0.5 * g * age * age;
    const s = (s0 + (s1 - s0) * a.r(sd + i, 3)) * shrink, rot = a.r(sd + i, 4) * TAU + age * (a.r(sd + i, 5) - 0.5) * 16;
    const k = kind === undefined ? i % 4 : kind;
    if (k === 0) addDisc(x, y, s * 0.6); else if (k === 1) addBox(x, y, s * 1.7, s * 0.7, rot); else if (k === 2) addTri(x, y, s, rot); else if (k === 3) addStar(x, y, s * 0.95, s * 0.4, 5, rot); else addStar(x, y, s, s * 0.24, 4, rot);
  });
}
// Bits drifting down (or up, with a negative vy) across a span of the stage, wrapping round, swaying as they go.
export function fall(a, t, o) {
  const n = Math.round(o.n), x0 = o.x0 ?? -a.w / 2, x1 = o.x1 ?? a.w / 2, y0 = o.y0 ?? -a.h / 2 - 40, y1 = o.y1 ?? a.h / 2 + 40, sd = o.seed || 0;
  const vy0 = o.vy0 ?? 200, vy1 = o.vy1 ?? 420, sway = o.sway ?? 30, s0 = o.s0 ?? 6, s1 = o.s1 ?? 14, kind = KIND[o.shape], start = o.t0 || 0;
  const age = t - start;
  if (age <= 0) return;
  const grow = sat(age * 3), span = y1 - y0;
  bits(o.cols || FEST, n, i => {
    const vy = vy0 + (vy1 - vy0) * a.r(sd + i, 2), off = a.r(sd + i, 6) * span;
    const p = (((age * vy + off) % span) + span) % span, y = vy >= 0 ? y0 + p : y1 - p;
    const x = x0 + (x1 - x0) * a.r(sd + i, 1) + S(age * (1 + a.r(sd + i, 7) * 1.5) + i) * sway;
    const s = (s0 + (s1 - s0) * a.r(sd + i, 3)) * grow, rot = a.r(sd + i, 4) * TAU + age * (a.r(sd + i, 5) - 0.5) * 6;
    const k = kind === undefined ? i % 4 : kind;
    if (k === 0) addDisc(x, y, s * 0.6); else if (k === 1) addBox(x, y, s * 1.7, s * 0.7, rot); else if (k === 2) addTri(x, y, s, rot); else if (k === 3) addStar(x, y, s * 0.95, s * 0.4, 5, rot); else addStar(x, y, s, s * 0.24, 4, rot);
  });
}
// a ring that grows and thins as it goes: a shockwave
export function pulse(x, y, t, t0, dur, r1, lw, col) {
  const p = seg(t, t0, t0 + dur);
  if (p <= 0 || p >= 1) return;
  ring(x, y, r1 * E.out(p), Math.max(1, lw * (1 - p)), col);
}

/* ---------- limbs ---------- */
export const KNEE = { x: 0, y: 0 };
// two-bone inverse kinematics: where the middle joint goes so a limb of lengths l1, l2 reaches from (hx, hy) to (fx, fy)
export function ik(hx, hy, fx, fy, l1, l2, dir) {
  const dx = fx - hx, dy = fy - hy;
  let d = Math.hypot(dx, dy) || 1;
  d = Math.min(d, l1 + l2 - 0.5);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / Math.hypot(dx, dy || 1e-6), uy = dy / (Math.hypot(dx, dy) || 1);
  KNEE.x = hx + ux * a - uy * h * dir; KNEE.y = hy + uy * a + ux * h * dir;
}
export function limb(hx, hy, fx, fy, l1, l2, dir, lw, col) {
  if (lw <= 0) return;
  ik(hx, hy, fx, fy, l1, l2, dir);
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(KNEE.x, KNEE.y); c.lineTo(fx, fy); c.stroke();
}

// a limb with a dark outline, the way the letters have one
export function limbO(hx, hy, fx, fy, l1, l2, dir, lw, col, ol, ink = K.ink) {
  if (lw <= 0) return;
  ik(hx, hy, fx, fy, l1, l2, dir);
  c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(KNEE.x, KNEE.y); c.lineTo(fx, fy);
  c.strokeStyle = ink; c.lineWidth = lw + ol * 2; c.stroke(); c.strokeStyle = col; c.lineWidth = lw; c.stroke();
}
export function ngon(x, y, r, n, rot, col) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; if (i) c.lineTo(x + C(a) * r, y + S(a) * r); else c.moveTo(x + C(a) * r, y + S(a) * r); }
  c.closePath(); c.fill();
}
// Legs for a glyph, hung from its feet (in the hero frame). phase drives the walk: one full step cycle is TAU; the feet
// alternate. stride/lift/len are in glyph units; dir is which way the knees bend; `shoe` draws a foot in that colour.
export function legs(g, k, o) {
  const len = (o.len ?? 55) * k, stride = (o.stride ?? 14) * k, lift = (o.lift ?? 14) * k, lw = (o.lw ?? 7) * k, ph = o.phase || 0, dir = o.dir ?? 1;
  const col = o.col || K.white, shoe = o.shoe || K.ink, feet = o.feet || g.feet, sc = o.k ?? 1, ol = 3.2 * k;
  if (sc < 0.04) return;                                          // o.k is how much of the legs is showing (they draw in as the letter leaves)
  for (let i = 0; i < feet.length; i++) {
    const hx = gx(g, k, feet[i][0]), hy = gy(k, feet[i][1]) - 5 * k, p = ph + (i & 1 ? PI : 0);
    const fx = hx + stride * C(p), fy = hy + len * 0.97 * sc - lift * Math.max(0, -S(p));
    limbO(hx, hy, fx, fy, len * 0.5 * sc, len * 0.5 * sc, dir, lw, col, ol);
    if (o.heel) { poly([fx - 9 * k, fy + 1 * k, fx + 12 * k * dir, fy + 3 * k, fx + 12 * k * dir, fy + 9 * k, fx - 4 * k, fy + 9 * k], shoe); line(fx - 7 * k, fy + 8 * k, fx - 9 * k, fy + 22 * k, 3.5 * k, shoe); }
    else { oval(fx + dir * 5 * k, fy + 3 * k, 12 * k, 6.5 * k, shoe); }
  }
}

/* ---------- glyphs ---------- */
const P = { x: 0, y: 0 };          // a custom warp writes its result here
// The hero frame, as Anim.begin() sets it while a letter is landing in the text: every warp a scene applies to the glyph
// eases out toward the plain letter (relax 0 to 1); whatever else hangs off the letter is shrunk into it (the frame is scaled
// by `un`, and the glyph itself scales back up so it stays full size).
export const HERO = { relax: 0, un: 1, color: null };            // color: the letter's own colour, which a sticker eases to as it lands
const SV0 = [0, 0];
// The hard shadow always falls down and to the right on screen, however the frame it is drawn in is turned, squashed or flipped:
// find the offset, in the current frame, that comes out as (s, 1.1 s) in device pixels, where s is sh scaled like the frame.
const SV = [0, 0];
function shadowVec(sh) {
  const m = c.getTransform(), det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-9) { SV[0] = SV[1] = 0; return SV; }
  const X = sh * Math.sqrt(Math.abs(det)), Y = 1.1 * X;
  SV[0] = (m.d * X - m.c * Y) / det; SV[1] = (m.a * Y - m.b * X) / det;
  return SV;
}
export { P };
const meas = document.createElement('canvas').getContext('2d');
const TEXTS = new Map();
// The glyph for a character: from the stroke font if it has one, otherwise the character itself drawn as text.
export function glyphOf(ch) {
  if (GLYPHS[ch]) return GLYPHS[ch];
  if (GLYPHS[ch.toUpperCase()]) return GLYPHS[ch.toUpperCase()];
  if (!TEXTS.has(ch)) {
    meas.font = '900 120px system-ui, sans-serif';
    TEXTS.set(ch, { ch, text: true, w: Math.max(30, Math.min(150, meas.measureText(ch).width * 100 / 120)), strokes: [], total: 0, feet: [[25, 92], [55, 92]], bottom: 100 });
  }
  return TEXTS.get(ch);
}
export const gx = (g, k, x) => (x - g.w / 2) * k;      // glyph units → local pixels, with the glyph box centred on the origin
export const gy = (k, y) => (y - 50) * k;
// where a fraction f (0..1) of the way along a glyph's strokes is, in hero-frame pixels: [x, y, heading] (a shared array, read it at once)
const TR = [0, 0, 0];
export function trace(g, k, f) { const p = pointAt(g, f); TR[0] = (p[0] - g.w / 2) * k; TR[1] = (p[1] - 50) * k; TR[2] = p[2]; return TR; }

// Builds the path of a glyph (in local pixels, centred) on a Path2D. Options, all optional:
//   t0, t1     draw only that stretch (0..1) of the strokes, in order: for drawing a letter on
//   wave       {ax, ay, kx, ky, ph}: shifts x by ax·sin(y·kx+ph) and y by ay·sin(x·ky+ph), in glyph units
//   slither    {amp, k, ph}: ripples the strokes sideways along their length, held still at both ends
//   jit, jt    shakes every point by up to jit units, changing 12 times a second
//   only       [stroke indexes]: draw just those strokes
//   parts      per stroke {r, px, py, dx, dy}: turns that stroke about (px, py) and moves it
//   fn         (x, y) => writes P.x, P.y: any other warp
export function gpath(g, k, o = {}) {
  const rl = HERO.relax, keep = 1 - rl;
  const p = new Path2D(), ox = g.w / 2, t0 = (o.t0 || 0) * keep * g.total, t1 = (o.t1 === undefined ? 1 : o.t1 + (1 - o.t1) * rl) * g.total, wv = o.wave, sl = o.slither, jit = (o.jit || 0) * keep, jf = o.jt ? Math.floor(o.jt * 12) : 0;
  for (let si = 0; si < g.strokes.length; si++) {
    const s = g.strokes[si], pts = s.p, n = pts.length / 2, part = o.parts && o.parts[si];
    if (s.off + s.total < t0 || s.off > t1 || (o.only && rl < 0.5 && !o.only.includes(si))) continue;
    let pen = false;
    const put = (x, y, l) => {
      if (part) { const pr = (part.r || 0) * keep, dx = x - part.px, dy = y - part.py, cs = C(pr), sn = S(pr); x = part.px + dx * cs - dy * sn + (part.dx || 0) * keep; y = part.py + dx * sn + dy * cs + (part.dy || 0) * keep; }
      if (wv) { const x2 = x + (wv.ax || 0) * keep * S(y * (wv.kx || 0.1) + wv.ph), y2 = y + (wv.ay || 0) * keep * S(x * (wv.ky || 0.1) + wv.ph); x = x2; y = y2; }
      if (sl) { const f = s.total ? l / s.total : 0, e = S(f * PI), off = sl.amp * keep * e * S(f * sl.k + sl.ph), i2 = Math.min(n - 1, Math.max(1, Math.round(f * (n - 1)))), tx = pts[2 * i2] - pts[2 * i2 - 2], ty = pts[2 * i2 + 1] - pts[2 * i2 - 1], tl = Math.hypot(tx, ty) || 1; x += -ty / tl * off; y += tx / tl * off; }
      if (jit) { const h1 = hash(si * 131 + Math.round(l), jf, 1), h2 = hash(si * 131 + Math.round(l), jf, 2); x += (h1 - 0.5) * 2 * jit; y += (h2 - 0.5) * 2 * jit; }
      if (o.fn) { const x0 = x, y0 = y; o.fn(x, y); x = x0 + (P.x - x0) * keep; y = y0 + (P.y - y0) * keep; }
      if (pen) p.lineTo((x - ox) * k, (y - 50) * k); else { p.moveTo((x - ox) * k, (y - 50) * k); pen = true; }
    };
    for (let i = 0; i < n; i++) {
      const l = s.off + s.cum[i];
      if (l < t0) {                                            // before the start: begin part-way along this segment
        if (i + 1 < n && s.off + s.cum[i + 1] > t0) { const r = (t0 - l) / (s.cum[i + 1] - s.cum[i]); put(pts[2 * i] + (pts[2 * i + 2] - pts[2 * i]) * r, pts[2 * i + 1] + (pts[2 * i + 3] - pts[2 * i + 1]) * r, t0 - s.off); }
        continue;
      }
      if (l > t1) {                                            // past the end: finish part-way along the segment before
        if (i > 0) { const pl = s.off + s.cum[i - 1], r = (t1 - pl) / (l - pl); if (r > 0) put(pts[2 * i - 2] + (pts[2 * i] - pts[2 * i - 2]) * r, pts[2 * i - 1] + (pts[2 * i + 1] - pts[2 * i - 1]) * r, t1 - s.off); }
        break;
      }
      put(pts[2 * i], pts[2 * i + 1], s.cum[i]);
    }
  }
  return p;
}
// Draws a glyph as a sticker: a colour fill inside a dark outline, with a hard flat shadow. k is pixels per glyph unit.
// o also takes color, ink, sw (stroke weight in units), ol (outline in px), sh (shadow offset in px, 0 for none), plus gpath's options.
export function glyph(g, k, o = {}) {
  const rl = HERO.relax, un = HERO.un, ink = o.ink || K.ink;
  let col = o.color || K.white, ol = o.ol ?? 4.2 * k, sh = o.sh ?? 4.6 * k, swu = o.sw || SW;
  if (rl > 0) {                                                    // landing: the sticker settles into the plain look it will have in the text
    if (HERO.color && col !== HERO.color && col[0] === '#' && col.length === 7 && HERO.color.length === 7) col = mixHex(col, HERO.color, rl);
    ol = lerp(ol, 4.2 * k, rl); sh = lerp(sh, 4.6 * k, rl); swu = lerp(swu, SW, rl);
  }
  if (un !== 1) { c.save(); c.scale(1 / un, 1 / un); }
  let p;
  const [dx, dy] = sh ? shadowVec(sh) : SV0;
  if (g.text) textGlyph(g, k, col, ink, ol, dx, dy, o.alpha);
  else {
    const sw = swu * k;
    p = gpath(g, k, o);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (sh) { c.save(); c.translate(dx, dy); c.strokeStyle = ink; c.lineWidth = sw + ol * 2; c.stroke(p); c.restore(); }
    if (ol > 0) { c.strokeStyle = ink; c.lineWidth = sw + ol * 2; c.stroke(p); }
    c.strokeStyle = col; c.lineWidth = sw; c.stroke(p);
  }
  if (un !== 1) c.restore();
  return p;
}
// a stroke laid along a glyph with no outline (patterns, highlights): dash [on, off] in px if given
export function glyphInk(g, k, o, col, lw, dash, cap = 'round') {
  const un = HERO.un;
  if (g.text || un < 0.03) return;                                // a pattern on the letter goes with the rest of what hangs off it, as it lands
  const p = gpath(g, k, o);
  if (un !== 1) { c.save(); c.scale(1 / un, 1 / un); }
  c.lineCap = cap; c.lineJoin = 'round'; c.strokeStyle = col; c.lineWidth = lw * k * un;
  if (dash) c.setLineDash([dash[0] * k, dash[1] * k]);
  c.stroke(p);
  if (dash) c.setLineDash([]);
  if (un !== 1) c.restore();
}
function textGlyph(g, k, col, ink, ol, dx, dy, alpha) {
  c.save(); c.font = `900 ${120 * k}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (alpha !== undefined) c.globalAlpha = alpha;
  if (dx || dy) { c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = ol * 2; c.strokeText(g.ch, dx, dy + 4 * k); c.fillText(g.ch, dx, dy + 4 * k); }
  if (ol > 0) { c.strokeStyle = ink; c.lineWidth = ol * 2; c.strokeText(g.ch, 0, 4 * k); }
  c.fillStyle = col; c.fillText(g.ch, 0, 4 * k);
  c.restore();
}
export { SW };
