// The angel and the demons as shadow-theatre puppets. Every figure is drawn in profile facing right (the demons
// are turned around to face her), cut from paper in a few jointed pieces (wings, body, arms, head, tail) so they
// breathe, flap and lunge in the 3D scene. The demons are black paper: all their character is in the outline, with
// slits cut for eyes and mouths that the fire behind shows through. The angel is ivory paper drawn over in gold.
// Everything is drawn in a 512-pixel frame with the feet at (256, 496); each piece is cropped to what's painted
// and remembers where it sat.
import { canvas, rgba, TAU } from './paint.js';

const FW = 512 + 2 * 160, FH = 512, FX = 256, FY = 496;   // FW: the sheet's width, margins included
const INK = '#0b0809', INK2 = '#1d1416';                   // black paper, and the dark grey of far limbs
const IVORY = '#f5eedd', IVORY2 = '#e3d5b6', GOLD = '#b4853a';
const ICE = '#b9d9ea';

/* ---------- drawing ---------- */
// A smooth path through points (Catmull-Rom); a point with a truthy third value is a sharp corner.
function curve(pts, closed = true) {
  const p = new Path2D(), n = pts.length;
  const at = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const s1 = p1[2] ? 0 : 1 / 6, s2 = p2[2] ? 0 : 1 / 6;
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * s1, p1[1] + (p2[1] - p0[1]) * s1, p2[0] - (p3[0] - p1[0]) * s2, p2[1] - (p3[1] - p1[1]) * s2, p2[0], p2[1]);
  }
  if (closed) p.closePath();
  return p;
}
function sample(pts, per = 10) {
  const out = [], n = pts.length, at = i => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => .5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}
// A stroke that tapers along a smooth curve, w0 wide at the start and w1 at the end (or w0(t) for any profile).
function taper(g, pts, w0, w1 = 0, col = INK) {
  const s = sample(pts), n = s.length, W = typeof w0 === 'function' ? w0 : t => w0 + (w1 - w0) * t;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = W(i / (n - 1)) / 2;
    L.push([s[i][0] - ty * w, s[i][1] + tx * w]); R.push([s[i][0] + ty * w, s[i][1] - tx * w]);
  }
  const p = new Path2D();
  p.moveTo(L[0][0], L[0][1]); for (const q of L) p.lineTo(q[0], q[1]);
  for (let i = n - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
  p.closePath();
  g.fillStyle = col; g.fill(p);
  for (const [q, w] of [[s[0], W(0)], [s[n - 1], W(1)]]) if (w > 3) { g.beginPath(); g.arc(q[0], q[1], w / 2, 0, TAU); g.fill(); }
  return s;
}
function fill(g, path, col = INK) { g.fillStyle = col; g.fill(path); }
function shape(g, pts, col = INK) { fill(g, curve(pts), col); }
function ell(g, x, y, rx, ry, col = INK, rot = 0) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); }
// cut through the paper: whatever draw() paints becomes a hole
function cut(g, draw) { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round'; g.lineJoin = 'round'; draw(g); g.restore(); }
function line(g, pts, col, w) { g.save(); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(curve(pts, false)); g.restore(); }
function slit(g, pts, w) { cut(g, () => { g.lineWidth = w; g.stroke(curve(pts, false)); }); }
// a glowing eye (on the glow layer)
function glowDot(g, x, y, r, col, core = '#fff6e0') {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
  gr.addColorStop(0, rgba(col, .95)); gr.addColorStop(.3, rgba(col, .45)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3.2, 0, TAU); g.fill();
  g.fillStyle = core; g.beginPath(); g.ellipse(x, y, r * .7, r * .45, 0, 0, TAU); g.fill();
}
function flame(g, x, y, h, w, col = '#ff7a2a') {
  const gr = g.createLinearGradient(0, y - h, 0, y);
  gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.45, rgba(col, .8)); gr.addColorStop(1, rgba('#ffe0a0', .95));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(x - w, y); g.bezierCurveTo(x - w, y - h * .45, x - w * .1, y - h * .55, x + w * .15, y - h);
  g.bezierCurveTo(x + w * .3, y - h * .5, x + w, y - h * .45, x + w, y); g.closePath(); g.fill();
}
function crop(c) {
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 4) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const pad = 12;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
  const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(c, -x0, -y0);
  return { canvas: out, x: x0, y: y0 };
}
// A puppet under construction: part(name, draw, o) cuts one jointed piece.
// Pieces are drawn in the 512 frame but cut from a sheet with a margin all round, so wings can spread past it.
const MX = 160, MY = 200;
class Rig {
  constructor(o = {}) { this.parts = []; this.o = o; this.frameH = (o.frameH ?? FH) + MY; this.paper = !!o.paper; this.feet = FY; this.top = 0; }
  part(name, draw, o = {}) {
    // drawn on the CPU (willReadFrequently), since each part is read back once to crop it
    const sheet = () => { const c = canvas(FW, this.frameH), g = c.getContext('2d', { willReadFrequently: true }); g.translate(MX, MY); return [c, g]; };
    const [c, g] = sheet();
    draw(g);
    let glow = null;
    if (o.glow) { const [gc, gg] = sheet(); o.glow(gg); glow = gc; }
    const cr = crop(c), gcr = glow ? crop(glow) : null;
    if (!cr && !gcr) return this;
    const pv = o.pivot ?? [FX, FY];
    this.parts.push({ name, base: cr, glow: gcr, pivot: [pv[0] + MX, pv[1] + MY], z: o.z ?? this.parts.length, anim: o.anim ?? null, paper: o.paper ?? this.paper });
    return this;
  }
  // where the feet and the top of the head are, on the sheet
  get feetY() { return this.feet + MY; }
  get topY() { return this.top + MY; }
}
const lerp = (a, b, t) => a + (b - a) * t;
const add = (p, x, y) => [p[0] + x, p[1] + y];

/* ---------- heads, in profile facing right ---------- */
// Outlines in head units: the skull spans y from -1 (crown) to 1 (chin), the nose reaches x ~ .9.
const HEADS = {
  human: { pts: [[-.3, 1.4], [-.42, .78], [-.78, .2], [-.64, -.6], [-.1, -1], [.42, -.86], [.66, -.42], [.7, -.14], [.65, .01, 1], [.9, .34, 1], [.69, .41, 1], [.75, .52], [.68, .58, 1], [.73, .66], [.63, .76, 1], [.67, .92], [.48, 1.04], [.26, 1.08], [.24, 1.4]], eye: [.46, -.04] },
  hag: { pts: [[-.3, 1.4], [-.45, .78], [-.8, .2], [-.66, -.6], [-.1, -1], [.42, -.86], [.68, -.44], [.76, -.16], [.66, 0, 1], [.82, .2], [1.02, .48, 1], [.8, .44, 1], [.74, .58, 1], [.66, .62, 1], [.84, .9, 1], [.56, 1.02], [.28, 1.1], [.24, 1.4]], eye: [.46, -.05] },
  demon: { pts: [[-.3, 1.4], [-.45, .72], [-.8, .16], [-.66, -.6], [-.12, -.96], [.44, -.82], [.72, -.44], [.92, -.22, 1], [.7, -.05, 1], [.8, .1], [1.1, .44, 1], [.78, .44, 1], [.88, .56, 1], [.7, .62, 1], [.8, .74], [.72, .9], [.86, 1.32, 1], [.46, 1.06], [.24, 1.1], [.22, 1.4]], eye: [.52, -.04], mouth: [[.86, .57], [.64, .63], [.48, .58]] },
  imp: { pts: [[-.2, 1.3], [-.4, .9], [-.9, .4], [-.95, -.3], [-.55, -.95], [.15, -1.08], [.62, -.8], [.8, -.38], [.74, -.14, 1], [1.3, .3, 1], [.8, .3, 1], [.86, .44], [.98, .52, 1], [.62, .7, 1], [.5, .9], [.2, 1], [.1, 1.3]], eye: [.5, -.12], mouth: [[.96, .52], [.72, .62], [.38, .5]] },
  wolf: { pts: [[-.4, 1.5], [-.66, .7], [-.86, .1], [-.9, -.4, 1], [-.96, -1.36, 1], [-.52, -.7, 1], [-.36, -1.5, 1], [-.06, -.66, 1], [.4, -.6], [.9, -.42], [1.34, -.3, 1], [1.4, -.06, 1], [1.06, .06, 1], [1.3, .2, 1], [1.28, .44, 1], [.9, .5, 1], [.66, .7], [.3, .96], [.1, 1.5]], eye: [.26, -.34], mouth: [[1.1, .1], [.6, .24]] },
  bull: { pts: [[-.5, 1.6], [-.8, .8], [-1.0, .1], [-.86, -.6], [-.3, -.96], [.36, -.86], [.74, -.5], [.96, -.06], [1.26, .36], [1.4, .7, 1], [1.2, .98, 1], [.84, .92], [.64, 1.16], [.2, 1.24], [.1, 1.6]], eye: [.4, -.3], mouth: [[1.3, .78], [.96, .84]] },
  fly: { pts: [[-.3, 1.4], [-.5, .8], [-.8, .2], [-.7, -.5], [-.2, -.9], [.5, -.86], [.9, -.4], [.95, .2], [.8, .54], [.94, .9, 1], [.6, .66], [.62, 1.3, 1], [.42, .86], [.2, 1.1], [.16, 1.4]], eye: [.36, -.14] },
  hood: { pts: [[-.5, 1.5], [-.8, .7], [-1.05, -.1], [-1.4, -.66, 1], [-.82, -.9], [-.2, -1.1], [.5, -.92], [.86, -.46], [.98, .1], [.9, .7, 1], [.7, .34], [.62, .1], [.4, .36], [.46, .8], [.36, 1.5]], eye: [.62, .04] },
  skull: { pts: [[-.3, 1.3], [-.5, .7], [-.82, .1], [-.66, -.66], [-.1, -1], [.46, -.86], [.74, -.4], [.78, -.05, 1], [.66, .06, 1], [.86, .34, 1], [.66, .42, 1], [.76, .56, 1], [.62, .66, 1], [.74, .8, 1], [.44, .96], [.2, 1], [.16, 1.3]], eye: [.46, -.1] },
};
// draw a head; returns where its eye is, in frame pixels
function head(g, x, y, s, kind, o = {}) {
  const H = HEADS[kind] ?? HEADS.human, col = o.col ?? INK;
  const T = ([u, v, k]) => [x + u * s, y + v * s, k];
  if (o.hair === 'long') for (let i = 0; i < 4; i++) taper(g, [T([-.1, -.9]), T([-.7 - i * .05, -.5]), T([-1.1 - i * .08, .4 + i * .2]), T([-1.2 - i * .2 - (o.wind ?? 0), 1.5 + i * .25 - (o.wind ?? 0) * .6]), T([-1.5 - i * .25 - (o.wind ?? 0) * 1.6, 2.4 + i * .1 - (o.wind ?? 0) * 1.1])], s * (.95 - i * .12), 0, col);
  if (o.hair === 'short') shape(g, [T([-.2, -1.08]), T([.5, -.96]), T([.72, -.5]), T([.3, -.62]), T([-.3, -.5]), T([-.84, .2]), T([-.82, -.6])], col);
  if (o.ears) { taper(g, [T([-.2, .1]), T([-.6, -.4]), T([-1.05, -.95])], s * .42, 0, col); }
  shape(g, H.pts.map(T), col);
  if (o.horns) horns(g, T, s, o.horns, col);
  if (o.hair === 'snakes') {
    for (let i = 0; i < 7; i++) {
      const a = -2.9 + i * .38, r0 = .78, r1 = 1.6 + (i % 2) * .35;
      const b = T([Math.cos(a) * r0 - .1, Math.sin(a) * r0 - .1]), w = (i % 2 ? 1 : -1) * .3;
      const pts = [b, T([Math.cos(a) * 1.1 - .1 + w * Math.sin(a), Math.sin(a) * 1.1 - .1 - w * Math.cos(a)]), T([Math.cos(a) * r1 - .1 - w * Math.sin(a), Math.sin(a) * r1 - .1 + w * Math.cos(a)])];
      const sm = taper(g, pts, s * .2, s * .13, col), e = sm[sm.length - 1];
      ell(g, e[0], e[1], s * .16, s * .1, col, a);
      line(g, [[e[0], e[1]], [e[0] + Math.cos(a) * s * .3, e[1] + Math.sin(a) * s * .3]], col, 1.5);
    }
  }
  if (o.mitre) shape(g, [T([-.6, -.6, 1]), T([-.3, -2.3, 1]), T([.05, -2.7, 1]), T([.42, -2.2, 1]), T([.62, -.7, 1]), T([.1, -.92])], col);
  if (o.crown) { const c = [T([-.6, -.78, 1]), T([-.66, -1.5, 1]), T([-.4, -1.1, 1]), T([-.18, -1.62, 1]), T([.06, -1.14, 1]), T([.3, -1.62, 1]), T([.42, -1.06, 1]), T([.6, -1.46, 1]), T([.62, -.7, 1])]; shape(g, c, col); }
  const eye = T(H.eye);
  if (!o.noCut) {
    cut(g, () => { g.beginPath(); g.ellipse(eye[0], eye[1], s * .16, s * .07, -.12, 0, TAU); g.fill(); });
    if (H.mouth && o.mouth !== false) { const m = H.mouth.map(T); slit(g, m, Math.max(2, s * .07)); if (o.teeth) cut(g, () => { for (let i = 0; i < 3; i++) { const q = [lerp(m[0][0], m[1][0], .2 + i * .3), lerp(m[0][1], m[1][1], .2 + i * .3)]; g.beginPath(); g.moveTo(q[0] - s * .06, q[1]); g.lineTo(q[0], q[1] + s * .16); g.lineTo(q[0] + s * .06, q[1]); g.fill(); } }); }
  }
  return eye;
}
function horns(g, T, s, kind, col) {
  const H = {
    curl: [[[-.1, -.8], [-.62, -1.18], [-1.1, -.72], [-1.0, -.06], [-.56, .08], [-.44, -.32]], .34, .1],
    big: [[[.26, -.86], [-.04, -1.5], [-.66, -1.9], [-1.02, -2.4]], .34, 0],
    straight: [[[.2, -.86], [-.32, -1.42], [-.96, -1.76]], .28, 0],
    small: [[[.32, -.86], [.3, -1.22], [.08, -1.46]], .22, 0],
    bull: [[[-.16, -.84], [.24, -1.24], [.8, -1.36], [1.2, -1.86]], .56, 0],
    imp: [[[.12, -.92], [.02, -1.36], [-.3, -1.62]], .26, 0],
  }[kind];
  if (!H) return;
  if (kind === 'bull' || kind === 'big') taper(g, H[0].map(([u, v]) => T([u - .3, v + .08])), s * H[1] * .8, 0, col === INK ? INK2 : col);
  taper(g, H[0].map(T), s * H[1], s * H[2], col);
}

/* ---------- wings ---------- */
// In wing units: X runs back (away from where the figure faces), Y runs up; the root is the shoulder.
function wingXY(root, len, side) { return ([X, Y]) => [root[0] - side * X * len, root[1] - Y * len]; }
// A bat's wing, raised: an arm out to the wrist, fingers fanning from it, a scalloped membrane the fire shows
// through a little.
function batWing(g, root, len, o = {}) {
  const side = o.side ?? 1, W = wingXY(root, len, side), col = o.col ?? INK, up = o.up ?? 1;
  const E = W([.3, .3 * up]), Wr = W([.46, .64 * up]);
  const tips = [[.62, 1.02 * up], [1.0, .74 * up], [1.08, .3 * up], [.82, -.08]].map(W);
  const attach = W([.08, -.34]);
  const p = new Path2D();
  p.moveTo(root[0], root[1]); p.lineTo(E[0], E[1]); p.lineTo(Wr[0], Wr[1]); p.lineTo(tips[0][0], tips[0][1]);
  for (let i = 1; i <= tips.length; i++) {
    const a = tips[i - 1], b = i < tips.length ? tips[i] : attach;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    p.quadraticCurveTo(mx + (Wr[0] - mx) * .36, my + (Wr[1] - my) * .36, b[0], b[1]);
  }
  p.closePath();
  g.save(); g.globalAlpha = o.membrane ?? .84; fill(g, p, col); g.restore();
  if (o.tatter) { const r = mulberry(o.tatter); cut(g, () => { for (let i = 0; i < 9; i++) { const k = i % 3, a = tips[k], b = tips[k + 1]; const t = .2 + r() * .6; g.beginPath(); g.ellipse(lerp(a[0], b[0], t) + (Wr[0] - a[0]) * .15, lerp(a[1], b[1], t) + (Wr[1] - a[1]) * .15 + r() * 8, 4 + r() * 7, 6 + r() * 10, r() * 3, 0, TAU); g.fill(); } }); }
  taper(g, [root, E, Wr], len * .075, len * .05, col);
  for (const t of tips) taper(g, [Wr, [lerp(Wr[0], t[0], .5) + (t[1] - Wr[1]) * .04 * side, lerp(Wr[1], t[1], .5)], t], len * .042, 1.5, col);
  // the thumb claw
  taper(g, [Wr, W([.44, .76 * up]), W([.38, .82 * up])], len * .04, 0, col);
}
// A feathered wing, raised behind the shoulder: an arched leading edge out to the tip, secondaries hanging from
// the inner half, long primaries sweeping back from the outer half, two rows of coverts over their roots. Dark
// wings have slits cut between the feathers; ivory ones are drawn over in gold.
function featherWing(g, root, len, o = {}) {
  const side = o.side ?? 1, W = wingXY(root, len, side), dark = !o.ivory, col = o.col ?? (dark ? INK : IVORY), ln = o.line ?? GOLD;
  const P0 = [0, 0], P1 = [-.02, .6], P2 = [.3, 1.12], P3 = [.86, 1.22];
  const edge = t => { const a = 1 - t; return [0, 1].map(k => a * a * a * P0[k] + 3 * a * a * t * P1[k] + 3 * a * t * t * P2[k] + t * t * t * P3[k]); };
  const deg = Math.PI / 180;
  const blade = (b, ang, l, w) => {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    return [[b[0] + nx * w * .5, b[1] + ny * w * .5], [b[0] + dx * l * .5 + nx * w * .6, b[1] + dy * l * .5 + ny * w * .6], [b[0] + dx * l * .9 + nx * w * .3, b[1] + dy * l * .9 + ny * w * .3], [b[0] + dx * l, b[1] + dy * l, 1], [b[0] + dx * l * .55 - nx * w * .42, b[1] + dy * l * .55 - ny * w * .42], [b[0] - nx * w * .5, b[1] - ny * w * .5]].map(W);
  };
  const feather = (b, ang, l, w, c, quill) => {
    const p = curve(blade(b, ang, l, w));
    fill(g, p, c);
    if (!dark) {
      g.save(); g.strokeStyle = ln; g.lineWidth = 1.5; g.stroke(p); g.restore();
      if (quill) { const q0 = W(b), q1 = W([b[0] + Math.cos(ang) * l * .8, b[1] + Math.sin(ang) * l * .8]); g.save(); g.strokeStyle = ln; g.globalAlpha = .7; g.lineWidth = 1.1; g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.stroke(); g.restore(); }
    }
    return [b, ang, l, w];
  };
  const slits = [];
  const N = o.n ?? 15;
  // primaries, tip first, sweeping back
  for (let i = 0; i < 9; i++) {
    const t = 1 - i * .055, b = edge(t);
    slits.push(feather(b, (34 - i * 9) * deg - (i > 6 ? (i - 6) * 6 * deg : 0), (.5 + (i < 3 ? i * .05 : .15 - (i - 3) * .02)) * (o.long ?? 1), .1, col, true));
  }
  // secondaries hang down and back from the arm
  for (let i = 0; i < N - 9; i++) {
    const t = .5 - i * (.44 / Math.max(1, N - 10)), b = edge(t);
    slits.push(feather(b, (-46 - i * 7) * deg, (.44 - i * .012) * (o.long ?? 1), .11, col, true));
  }
  // coverts in two rows
  for (let row = 0; row < 2; row++) for (let i = 10; i >= 0; i--) {
    const t = .05 + i * .085, b = edge(t), ang = (-60 + t * 85) * deg;
    feather([b[0] + .015 * Math.sin(ang), b[1] - .03 - row * .07], ang, (.15 + t * .1) * (row ? .9 : 1.15), .1, dark ? col : (row ? (o.col2 ?? col) : col), false);
  }
  const E = Array.from({ length: 12 }, (_, i) => W(edge(i / 11)));
  taper(g, E, len * .085, len * .03, col);
  if (!dark) line(g, E.map(([x, y], i) => [x - side * 0, y - len * .035 * (1 - i / 11)]), ln, 1.5);
  if (dark) cut(g, () => {
    g.lineWidth = 1.2;
    for (const [b, ang, l, w] of slits) { const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx; const a = W([b[0] + dx * l * .35 - nx * w * .4, b[1] + dy * l * .35 - ny * w * .4]), c = W([b[0] + dx * l * .9 - nx * w * .05, b[1] + dy * l * .9 - ny * w * .05]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke(); }
  });
}
// An insect's wings: two long veined blades, mostly clear
function insectWing(g, root, len, o = {}) {
  const side = o.side ?? 1, W = wingXY(root, len, side);
  for (const [a, l] of [[.5, 1], [.15, .8]]) {
    const dx = Math.cos(a), dy = Math.sin(a);
    const p = curve([W([0, 0]), W([dx * l * .5 - dy * .14, dy * l * .5 + dx * .14]), W([dx * l, dy * l, 1]), W([dx * l * .5 + dy * .1, dy * l * .5 - dx * .1])]);
    g.save(); g.globalAlpha = .55; fill(g, p); g.restore();
    g.save(); g.clip(p); g.strokeStyle = INK; g.lineWidth = 2.2;
    for (let i = 0; i < 6; i++) { const t = (i + 1) / 7; g.beginPath(); const s = W([dx * l * t * .3, dy * l * t * .3]); g.moveTo(s[0], s[1]); const e = W([dx * l * t + dy * .2 * (i % 2 ? 1 : -1), dy * l * t - dx * .2 * (i % 2 ? 1 : -1)]); g.lineTo(e[0], e[1]); g.stroke(); }
    g.restore();
    g.save(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(p); g.restore();
  }
}
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- limbs, hands, weapons ---------- */
function claw(g, at, ang, s, col = INK, n = 3) {
  ell(g, at[0] + Math.cos(ang) * s * .14, at[1] + Math.sin(ang) * s * .14, s * .26, s * .2, col, ang);
  for (let i = 0; i < n; i++) {
    const a = ang + (i - (n - 1) / 2) * .34, l = s * (1.15 - Math.abs(i - (n - 1) / 2) * .22);
    const k1 = [at[0] + Math.cos(a) * l * .5, at[1] + Math.sin(a) * l * .5], k2 = [at[0] + Math.cos(a + .35) * l * .85, at[1] + Math.sin(a + .35) * l * .85], tip = [at[0] + Math.cos(a + .75) * l, at[1] + Math.sin(a + .75) * l];
    taper(g, [at, k1, k2, tip], prof([[0, s * .2], [.5, s * .13], [1, 0]]), 0, col);
  }
  // a thumb
  const ta = ang - (n + 1) * .2;
  taper(g, [at, [at[0] + Math.cos(ta) * s * .4, at[1] + Math.sin(ta) * s * .4], [at[0] + Math.cos(ta + .6) * s * .6, at[1] + Math.sin(ta + .6) * s * .6]], prof([[0, s * .18], [1, 0]]), 0, col);
}
// piecewise-linear width profiles along a limb
const prof = stops => t => { for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, a] = stops[i - 1], [t1, b] = stops[i]; return lerp(a, b, (t - t0) / (t1 - t0)); } return stops[stops.length - 1][1]; };
// an arm: a round shoulder, the upper arm, a narrow elbow, a swelling forearm, the wrist
function arm(g, sh, el, wr, w0, w1, col = INK) {
  taper(g, [sh, el, wr], prof([[0, w0 * 1.08], [.22, w0 * .92], [.48, w0 * .6], [.62, w0 * .74], [1, w1]]), 0, col);
  ell(g, sh[0], sh[1], w0 * .62, w0 * .58, col);
}
// a demon's leg, bent backward at the hock like a goat's
function leg(g, pts, w, col = INK) { taper(g, pts, prof([[0, w], [.25, w * .78], [.36, w * .56], [.5, w * .62], [.68, w * .36], [1, w * .3]]), 0, col); }
// Weapons are drawn about the hand at h, pointing along angle a (0 is up), len long.
function weapon(g, kind, h, a, len, col = INK) {
  g.save(); g.translate(h[0], h[1]); g.rotate(a);
  const L = len;
  const shaft = (y0, y1, w) => taper(g, [[0, y0], [0, y1]], w, w, col);
  switch (kind) {
    case 'trident': case 'fork': {
      shaft(L * .45, -L * .5, 5);
      const n = kind === 'trident' ? 3 : 2, sp = kind === 'trident' ? 14 : 9;
      taper(g, [[-sp, -L * .5], [0, -L * .55], [sp, -L * .5]], 5, 5, col);
      for (let i = 0; i < n; i++) { const x = n === 3 ? (i - 1) * sp : (i ? sp : -sp); shape(g, [[x - 3, -L * .5], [x - 3, -L * .64], [x, -L * .74, 1], [x + 3, -L * .64], [x + 3, -L * .5]], col); if (x) shape(g, [[x, -L * .64], [x + Math.sign(x) * 6, -L * .6, 1], [x, -L * .6]], col); }
      break;
    }
    case 'staff': shaft(L * .48, -L * .5, 6); ell(g, 0, -L * .52, 9, 11, col); break;
    case 'crosier': { shaft(L * .48, -L * .45, 6); taper(g, [[0, -L * .45], [2, -L * .58], [-12, -L * .7], [-30, -L * .64], [-28, -L * .52], [-16, -L * .52]], 6, 3, col); break; }
    case 'sword': {
      shape(g, [[-5, -6], [-5, -L * .78], [0, -L * .9, 1], [5, -L * .78], [5, -6]], col);
      taper(g, [[-16, -6], [16, -6]], 6, 6, col); shaft(-6, 16, 6); ell(g, 0, 18, 6, 6, col);
      cut(g, () => { g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -14); g.lineTo(0, -L * .76); g.stroke(); });
      break;
    }
    case 'axe': {
      // a double-bitted axe: two crescent blades either side of the haft's head
      shaft(L * .4, -L * .56, 6);
      for (const sd of [-1, 1]) shape(g, [[0, -L * .38], [sd * 16, -L * .36], [sd * 40, -L * .3, 1], [sd * 34, -L * .44], [sd * 40, -L * .6, 1], [sd * 16, -L * .54], [0, -L * .52]], col);
      shape(g, [[-4, -L * .56], [0, -L * .66, 1], [4, -L * .56]], col);
      break;
    }
    case 'whip': {
      shaft(10, -16, 6);
      taper(g, [[0, -16], [14, -L * .3], [-10, -L * .55], [24, -L * .8], [60, -L * .9], [90, -L * .78]], 4.5, 1, col);
      break;
    }
    case 'oar': { shaft(L * .4, -L * .5, 5); shape(g, [[0, L * .36], [-12, L * .5], [-10, L * .7], [0, L * .78], [10, L * .7], [12, L * .5]], col); break; }
    case 'scale': {
      shaft(8, -L * .36, 4);
      taper(g, [[-L * .3, -L * .36], [L * .3, -L * .4]], 4, 4, col);
      for (const x of [-L * .3, L * .3]) { const y = -L * .38 + (x > 0 ? -.02 : .02) * L; line(g, [[x, y], [x - 12, y + 34]], col, 1.6); line(g, [[x, y], [x + 12, y + 34]], col, 1.6); shape(g, [[x - 16, y + 34], [x + 16, y + 34], [x + 8, y + 42], [x - 8, y + 42]], col); }
      break;
    }
    case 'hook': {
      shaft(L * .45, -L * .5, 5);
      taper(g, [[0, -L * .5], [6, -L * .62], [24, -L * .66], [34, -L * .56], [26, -L * .48]], 6, 1, col);
      break;
    }
    case 'bow': {
      taper(g, [[0, -L * .5], [-14, -L * .3], [-18, 0], [-14, L * .3], [0, L * .5]], 3, 3, col);
      line(g, [[0, -L * .5], [26, 0], [0, L * .5]], col, 1.4);
      taper(g, [[26, 0], [-L * .2, 0]], 3, 3, col);
      shape(g, [[-L * .2, -6], [-L * .3, 0, 1], [-L * .2, 6]], col);
      break;
    }
    case 'mask': {
      taper(g, [[0, 10], [0, -L * .55]], 4, 4, col);
      g.save(); g.translate(0, -L * .7);
      const m = curve([[-26, -30], [0, -40], [26, -30], [30, 6], [16, 34], [0, 40, 1], [-16, 34], [-30, 6]]);
      fill(g, m, IVORY); g.strokeStyle = GOLD; g.lineWidth = 2; g.stroke(m);
      cut(g, () => { for (const x of [-12, 12]) { g.beginPath(); g.ellipse(x, -8, 8, 4, x > 0 ? -.3 : .3, 0, TAU); g.fill(); } g.lineWidth = 4; g.beginPath(); g.arc(0, 4, 18, .35, Math.PI - .35); g.stroke(); });
      g.restore();
      break;
    }
    case 'horn': taper(g, [[0, 0], [-8, -L * .2], [6, -L * .4], [30, -L * .5]], 8, 24, col); break;
    case 'spear': shaft(L * .5, -L * .5, 5); shape(g, [[-7, -L * .5], [0, -L * .7, 1], [7, -L * .5], [0, -L * .46]], col); break;
  }
  g.restore();
}
// sacks and heaps of coins
function sack(g, x, y, s, col = INK) { shape(g, [[x - s * .2, y - s], [x + s * .2, y - s], [x + s * .1, y - s * .8], [x + s * .7, y - s * .4], [x + s * .76, y + s * .2], [x + s * .4, y + s * .5], [x - s * .4, y + s * .5], [x - s * .76, y + s * .2], [x - s * .7, y - s * .4], [x - s * .1, y - s * .8]], col); }

/* ---------- the angel ---------- */
function angel() {
  const r = new Rig({ frameH: 600, paper: true });
  const SH = [258, 248];          // shoulders
  const HC = [272, 194], HS = 34;   // head
  r.part('wingFar', g => { g.save(); g.translate(SH[0] + 6, SH[1]); g.rotate(.22); featherWing(g, [0, 0], 196, { ivory: true, col: IVORY2, col2: IVORY2, side: 1, n: 14 }); g.restore(); }, { pivot: [SH[0] + 4, SH[1] + 2], z: 0, anim: { rot: .07, speed: 1.4, phase: .5 } });
  r.part('wingNear', g => featherWing(g, [SH[0] - 16, SH[1] + 14], 226, { ivory: true, col2: IVORY2, side: 1, n: 16 }), { pivot: [SH[0] - 16, SH[1] + 14], z: 1, anim: { rot: -.09, speed: 1.4 } });
  r.part('body', g => {
    // a long robe, its hem trailing behind and fluttering
    const robe = [[SH[0] - 22, SH[1] + 4], [SH[0] - 34, SH[1] + 80], [SH[0] - 50, SH[1] + 190], [SH[0] - 80, SH[1] + 280], [SH[0] - 106, 548, 1], [SH[0] - 70, 540], [SH[0] - 40, 556, 1], [SH[0] - 6, 546], [SH[0] + 24, 558, 1], [SH[0] + 52, 550], [SH[0] + 66, 556, 1], [SH[0] + 54, 470], [SH[0] + 40, 380], [SH[0] + 30, SH[1] + 80], [SH[0] + 34, SH[1] + 26], [SH[0] + 20, SH[1] - 6], [SH[0] - 6, SH[1] - 10]];
    const p = curve(robe); fill(g, p, IVORY);
    g.save(); g.clip(p);
    // folds, and the hem's band
    for (const [x0, x1] of [[-14, -60], [4, -24], [20, 12], [36, 44]]) line(g, [[SH[0] + x0 * .4, SH[1] + 96], [SH[0] + x0 * .8 + x1 * .3, 420], [SH[0] + x1, 548]], GOLD, 1.6);
    line(g, [[SH[0] - 110, 532], [SH[0] - 70, 524], [SH[0] - 40, 540], [SH[0] - 6, 530], [SH[0] + 24, 542], [SH[0] + 52, 534], [SH[0] + 70, 540]], GOLD, 2.2);
    g.restore();
    g.save(); g.strokeStyle = GOLD; g.lineWidth = 1.6; g.stroke(p); g.restore();
    // a cord at the waist
    taper(g, [[SH[0] - 30, SH[1] + 84], [SH[0] + 2, SH[1] + 90], [SH[0] + 34, SH[1] + 84]], 5, 5, GOLD);
    taper(g, [[SH[0] + 6, SH[1] + 90], [SH[0] + 2, SH[1] + 130], [SH[0] + 10, SH[1] + 170]], 3.5, 1.5, GOLD);
  }, { z: 2, anim: { breath: .01, speed: 1.4 } });
  r.part('head', g => {
    // hair falling down her back
    for (let i = 0; i < 4; i++) taper(g, [[HC[0] - 6, HC[1] - 30], [HC[0] - 28 - i * 3, HC[1] - 14], [HC[0] - 40 - i * 4, HC[1] + 24 + i * 6], [HC[0] - 44 - i * 7, HC[1] + 70 + i * 6], [HC[0] - 56 - i * 9, HC[1] + 108]], 30 - i * 4, 0, i % 2 ? IVORY2 : IVORY);
    head(g, HC[0], HC[1], HS, 'human', { col: IVORY, noCut: true });
    const T = ([u, v]) => [HC[0] + u * HS, HC[1] + v * HS];
    g.save(); g.strokeStyle = GOLD; g.lineWidth = 1.6; g.stroke(curve(HEADS.human.pts.map(([u, v, k]) => [HC[0] + u * HS, HC[1] + v * HS, k]))); g.restore();
    // hair over the crown, a closed eye, strands
    shape(g, [T([-.86, .3]), T([-.84, -.5]), T([-.3, -1.08]), T([.36, -1.0]), T([.7, -.6]), T([.4, -.62]), T([.0, -.5]), T([-.3, -.14]), T([-.5, .4])], IVORY2);
    for (let i = 0; i < 4; i++) line(g, [T([.5 - i * .3, -.9 + i * .06]), T([-.1 - i * .3, -.6 + i * .1]), T([-.5 - i * .2, .1 + i * .2])], GOLD, 1.3);
    line(g, [T([.34, -.04]), T([.48, .02]), T([.6, -.02])], '#6a4a1c', 2);
  }, { z: 4, pivot: [HC[0] - 6, HC[1] + 34], anim: { bob: 2, speed: 1.4, rot: .025 } });
  // a halo: a ring of light behind her head
  r.part('halo', () => {}, { z: 3.5, pivot: [HC[0] - 6, HC[1] + 34], anim: { bob: 2, speed: 1.4, rot: .025 },
    glow: g => {
      g.save(); g.translate(HC[0] - 14, HC[1] - 20);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 62); gr.addColorStop(0, 'rgba(255,236,180,.55)'); gr.addColorStop(.7, 'rgba(255,220,140,.22)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,226,150,.55)'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,248,224,.95)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.stroke();
      g.restore();
    } });
  r.part('arm', g => {
    // a sleeve, and a hand holding a spear of light pointed at the demons
    const sh = [SH[0] + 10, SH[1] + 12], el = [SH[0] + 40, SH[1] + 58], wr = [SH[0] + 82, SH[1] + 40];
    arm(g, sh, el, wr, 30, 14, IVORY);
    shape(g, [[SH[0] + 18, SH[1] + 40], [SH[0] + 50, SH[1] + 86], [SH[0] + 34, SH[1] + 96], [SH[0] + 12, SH[1] + 60]], IVORY);
    g.save(); g.strokeStyle = GOLD; g.lineWidth = 1.4; g.stroke(curve([[SH[0] + 18, SH[1] + 40], [SH[0] + 50, SH[1] + 86], [SH[0] + 34, SH[1] + 96], [SH[0] + 12, SH[1] + 60]])); g.restore();
    ell(g, wr[0] + 4, wr[1] - 2, 8, 7, IVORY);
    g.save(); g.translate(wr[0] + 4, wr[1] - 2); g.rotate(-.5);
    taper(g, [[-140, 0], [150, 0]], 5, 5, GOLD);
    shape(g, [[150, -9], [196, 0, 1], [150, 9], [158, 0]], '#fff8e4');
    g.restore();
  }, { z: 5, pivot: [SH[0] + 10, SH[1] + 12], anim: { rot: .035, speed: 1.4, phase: 1 },
    glow: g => { g.save(); g.translate(SH[0] + 86, SH[1] + 38); g.rotate(-.5); g.shadowColor = '#fff2b0'; g.shadowBlur = 24; g.fillStyle = 'rgba(255,245,210,.9)'; g.beginPath(); g.moveTo(150, -12); g.lineTo(204, 0); g.lineTo(150, 12); g.closePath(); g.fill(); g.restore(); } });
  r.feet = 560; r.top = 60; r.hover = true;
  return r;
}

/* ---------- a generic demon, assembled from options ---------- */
// o: h (height), bulk, lean (shoulders forward of hips), head, hs (head size), horns, hair, crown, mitre, halo,
// lower: legs | hooves | robe | cloak | serpent | horse | bird | ice | boat, wings: bat | feather | insect | six,
// wingS, tatter, tail: arrow | scorpion, weapon, pose: reach | raise | hold | low, eye, flames, hover, mouth, teeth
function demon(o) {
  const r = new Rig({ frameH: o.frameH ?? FH });
  const fy = o.frameH ? o.frameH - 16 : FY, h = o.h ?? 1, bulk = o.bulk ?? 1, lean = o.lean ?? 8;
  const legLen = (o.lower === 'horse' ? 190 : 156) * h;
  const cx = o.cx ?? 250;
  const hip = [cx, fy - legLen - (o.hover ? 26 : 0)];
  const torso = 112 * h * (o.torso ?? 1);
  const sh = [hip[0] + lean, hip[1] - torso];
  const neck = [sh[0] + 6 + lean * .2, sh[1] - 10 * h];
  const hs = 34 * h * (o.hs ?? 1);
  const hc = [neck[0] + 8 + (o.headDX ?? 0), neck[1] - hs * 1.02 + (o.headDY ?? 0)];
  const chest = 38 * bulk * (o.fem ? .86 : 1) * (o.chest ?? 1), waist = 24 * bulk;
  const eyeCol = o.eye ?? '#ff8a3a';
  const tAnim = { rot: .14, speed: 1.8 };
  let eyePos = null;
  // wings behind everything
  if (o.wings) {
    const ws = (o.wingS ?? 1) * 190 * h, root = [sh[0] - chest * .5, sh[1] + 16];
    const draw = (g, far) => {
      const R = far ? [root[0] + 14, root[1] - 6] : root, L = far ? ws * .86 : ws;
      if (o.wings === 'bat') batWing(g, R, L, { col: far ? INK2 : INK, tatter: o.tatter ? o.tatter + (far ? 3 : 0) : 0, up: far ? 1.1 : 1 });
      else if (o.wings === 'feather') featherWing(g, R, L, { col: far ? INK2 : INK, n: 14 });
      else if (o.wings === 'insect') insectWing(g, R, L * .9);
    };
    if (o.wings === 'six') {
      for (const [k, dy, a, sc] of [[0, -20, -.35, .8], [1, 0, .15, .95], [2, 26, .75, .72]]) r.part('wing' + k, g => { g.save(); g.translate(root[0], root[1] + dy); g.rotate(a); featherWing(g, [0, 0], ws * sc, { col: k === 1 ? INK : INK2, n: 13 }); g.restore(); }, { pivot: [root[0], root[1] + dy], z: k * .1, anim: { rot: .09, speed: 1.3, phase: k } });
    } else {
      r.part('wingFar', g => draw(g, true), { pivot: [root[0] + 14, root[1] - 6], z: 0, anim: { rot: .12, speed: o.wings === 'insect' ? 14 : 2.2, phase: .4 } });
      r.part('wingNear', g => draw(g, false), { pivot: root, z: .5, anim: { rot: -.14, speed: o.wings === 'insect' ? 14 : 2.2 } });
    }
  }
  if (o.tail) {
    const b = [hip[0] - waist * .8, hip[1] + 6];
    r.part('tail', g => {
      if (o.tail === 'scorpion') {
        const pts = [b, [b[0] - 60, b[1] + 30], [b[0] - 120, b[1] - 10], [b[0] - 118, b[1] - 90], [b[0] - 70, b[1] - 130], [b[0] - 30, b[1] - 110]];
        const s = taper(g, pts, 26, 9);
        cut(g, () => { g.lineWidth = 2; for (let i = 6; i < s.length - 4; i += 5) { const a = s[i - 1], c = s[i + 1], m = s[i]; const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy); g.beginPath(); g.moveTo(m[0] - dy / l * 10, m[1] + dx / l * 10); g.lineTo(m[0] + dy / l * 10, m[1] - dx / l * 10); g.stroke(); } });
        const e = s[s.length - 1]; shape(g, [[e[0] - 6, e[1] - 8], [e[0] + 18, e[1] - 2], [e[0] + 30, e[1] + 18, 1], [e[0] + 10, e[1] + 8], [e[0] - 4, e[1] + 8]]);
      } else {
        const pts = [b, [b[0] - 50, b[1] + 26], [b[0] - 96, b[1] + 4], [b[0] - 104, b[1] - 46], [b[0] - 84, b[1] - 70]];
        const s = taper(g, pts, 12 * bulk, 3);
        const e = s[s.length - 1], p = s[s.length - 4], a = Math.atan2(e[1] - p[1], e[0] - p[0]);
        g.save(); g.translate(e[0], e[1]); g.rotate(a); shape(g, [[-4, 0], [-8, -12, 1], [20, 0, 1], [-8, 12, 1]]); g.restore();
      }
    }, { pivot: b, z: .8, anim: tAnim });
  }
  // the far arm, behind the body
  const shF = [sh[0] + 6, sh[1] + 10], shB = [sh[0] - 8, sh[1] + 8];
  if (o.backArm !== false && o.lower !== 'ice2') r.part('armBack', g => {
    const el = [shB[0] - 10, shB[1] + 54 * h], wr = [shB[0] + 14, shB[1] + 100 * h];
    if (o.pose2 === 'reach') { arm(g, shB, [shB[0] + 34, shB[1] + 44 * h], [shB[0] + 78, shB[1] + 26 * h], 22 * bulk, 12 * bulk, INK2); claw(g, [shB[0] + 80, shB[1] + 26 * h], -.2, 22 * h, INK2); }
    else { arm(g, shB, el, wr, 22 * bulk, 12 * bulk, INK2); claw(g, wr, 1.2, 22 * h, INK2); }
    if (o.weapon2 === 'sack') sack(g, wr[0] + 4, wr[1] + 26, 34 * bulk, INK2);
  }, { pivot: shB, z: 1, anim: { rot: .08, speed: 1.8, phase: 2 } });
  // the body: legs (or whatever's below), torso
  r.part('body', g => {
    lowerBody(g, o, hip, waist, bulk, h, fy, legLen);
    const fem = !!o.fem;
    const T = [[hip[0] - waist * .9, hip[1] + 12], [hip[0] - waist * (fem ? 1.3 : 1.08), hip[1] - torso * .06], [hip[0] - waist * (fem ? .78 : .92), hip[1] - torso * .42], [sh[0] - chest * 1.04, sh[1] + torso * .24], [sh[0] - chest * .86, sh[1] + 2], [neck[0] - 8 * h, neck[1] - 4], [neck[0] + 9 * h, neck[1] + 2], [sh[0] + chest * .66, sh[1] + 6], [sh[0] + chest * (fem ? 1.08 : 1.0), sh[1] + torso * (fem ? .3 : .22)], [sh[0] + chest * (fem ? .6 : .8), sh[1] + torso * .46], [hip[0] + waist * (fem ? .66 : .9) + lean * .3, hip[1] - torso * .26], [hip[0] + waist * (fem ? 1.08 : .94), hip[1] - torso * .02], [hip[0] + waist * .5, hip[1] + 14]];
    shape(g, T);
    if (o.hump) ell(g, sh[0] - chest * .5, sh[1] + 10, chest * .62, chest * .46);
    if (o.lower === 'robe' || o.lower === 'cloak' || o.lower === 'boat') shape(g, [[sh[0] - chest * 1.1, sh[1] - 2], [sh[0] + chest * .9, sh[1] - 2], [sh[0] + chest * 1.05, sh[1] + 30], [sh[0] - chest * 1.3, sh[1] + 40]]);
    if (o.ribs) cut(g, () => { g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(sh[0] + chest * .1, sh[1] + 28 + i * 13); g.quadraticCurveTo(sh[0] + chest * .6, sh[1] + 24 + i * 13, sh[0] + chest * .82, sh[1] + 34 + i * 13); g.stroke(); } });
  }, { z: 2, anim: { breath: .012, speed: 1.8 } });
  // the head
  r.part('head', g => { eyePos = head(g, hc[0], hc[1], hs, o.head ?? 'demon', { horns: o.horns, hair: o.hair, crown: o.crown, mitre: o.mitre, ears: o.ears, wind: o.wind, teeth: o.teeth, mouth: o.mouth }); },
    { pivot: [neck[0], neck[1] + 6], z: 4, anim: { bob: 1.5, speed: 1.8, rot: .04, phase: .6 },
      glow: g => {
        const e = eyePos ?? [hc[0] + hs * .5, hc[1]];
        glowDot(g, e[0], e[1], Math.max(3.5, hs * .13), eyeCol);
        if (o.halo) { g.save(); g.translate(hc[0] - hs * .2, hc[1] - hs * 1.5); g.scale(1, .32); g.strokeStyle = rgba(o.haloCol ?? '#d8c8ff', .9); g.lineWidth = 6; g.shadowColor = o.haloCol ?? '#d8c8ff'; g.shadowBlur = 14; g.beginPath(); g.arc(0, 0, hs * .9, o.halo === 'broken' ? .5 : 0, o.halo === 'broken' ? TAU - .9 : TAU); g.stroke(); g.restore(); }
        if (o.flames) for (let i = 0; i < 3; i++) flame(g, hc[0] - hs * .5 + i * hs * .45, hc[1] - hs * .82 + (i % 2) * 6, hs * (1.1 + (i % 2) * .5), hs * .28, o.flameCol ?? '#ff6a1a');
        if (o.hair === 'snakes') for (let i = 0; i < 7; i++) { const a = -2.9 + i * .38, rr = 1.6 + (i % 2) * .35; glowDot(g, hc[0] + (Math.cos(a) * rr - .1) * hs, hc[1] + (Math.sin(a) * rr - .1) * hs, 1.6, eyeCol); }
      } });
  // the near arm, with whatever it holds
  r.part('arm', g => {
    const pose = o.pose ?? (o.weapon ? 'hold' : 'reach');
    let el, wr, ang = 0;
    if (pose === 'reach') { el = [shF[0] + 30 * h, shF[1] + 50 * h]; wr = [shF[0] + 84 * h, shF[1] + 34 * h]; }
    else if (pose === 'raise') { el = [shF[0] + 36 * h, shF[1] + 22 * h]; wr = [shF[0] + 56 * h, shF[1] - 34 * h]; ang = .35; }
    else if (pose === 'low') { el = [shF[0] + 12 * h, shF[1] + 56 * h]; wr = [shF[0] + 34 * h, shF[1] + 104 * h]; }
    else { el = [shF[0] + 26 * h, shF[1] + 56 * h]; wr = [shF[0] + 62 * h, shF[1] + 50 * h]; }
    arm(g, shF, el, wr, 25 * bulk, 13 * bulk);
    if (o.weapon) {
      const L = { mask: 120, trident: 300, fork: 220, staff: 320, crosier: 320, sword: 150, axe: 230, whip: 180, oar: 330, scale: 150, hook: 300, bow: 170, spear: 300, horn: 90 }[o.weapon] * h * (o.wscale ?? 1);
      const a = o.wang ?? ({ whip: 1.2, sword: pose === 'raise' ? .5 : 1.1, axe: pose === 'raise' ? .3 : .2, bow: 0, scale: 0 }[o.weapon] ?? ang + .08);
      weapon(g, o.weapon, wr, a, L);
      ell(g, wr[0], wr[1], 10 * bulk, 9 * bulk);
    } else claw(g, wr, pose === 'low' ? 1.3 : -.1, 26 * h);
  }, { pivot: shF, z: 5, anim: { rot: .07, speed: 1.8, phase: 1 },
    glow: o.staffGlow ? g => { const L = 320 * h, el = [shF[0] + 26 * h, shF[1] + 56 * h], wr = [shF[0] + 62 * h, shF[1] + 50 * h]; void el; const a = .08; flame(g, wr[0] + Math.sin(a) * L * .52, wr[1] - Math.cos(a) * L * .52 - 4, 44 * h, 12 * h, o.staffGlow); glowDot(g, wr[0] + Math.sin(a) * L * .52, wr[1] - Math.cos(a) * L * .52, 6, o.staffGlow); } : null });
  if (o.lower === 'ice') r.part('ice', g => iceBlock(g, cx, fy, 110 * bulk, 150 * h), { z: 6, paper: true });
  if (o.lower === 'boat') r.part('boat', g => boat(g, cx, fy, h), { z: 6 });
  r.feet = fy; r.top = Math.min(hc[1] - hs * (o.horns === 'big' ? 2.2 : o.mitre ? 2.6 : 1.2), o.wings ? sh[1] - (o.wingS ?? 1) * 150 * h : 1e9);
  r.hover = !!o.hover;
  return r;
}
function lowerBody(g, o, hip, waist, bulk, h, fy, legLen) {
  const L = o.lower ?? 'legs';
  if (L === 'human') {
    for (const [dx, col] of [[-6, INK2], [10, INK]]) {
      const H = [hip[0] + dx, hip[1]], knee = [H[0] + 12 * h, H[1] + legLen * .46], ank = [H[0] - 4 * h, fy - 14];
      taper(g, [H, knee, ank], prof([[0, 30 * bulk], [.3, 24 * bulk], [.5, 15 * bulk], [.65, 17 * bulk], [1, 8 * bulk]]), 0, col);
      shape(g, [[ank[0] - 7, ank[1] - 6], [ank[0] + 7, ank[1] - 6], [ank[0] + 10, fy + 2, 1], [ank[0] - 8, fy + 2, 1]], col);
    }
  } else if (L === 'legs' || L === 'hooves') {
    for (const [dx, col] of [[-12, INK2], [8, INK]]) {
      const H = [hip[0] + dx, hip[1]], knee = [H[0] + 30 * h, H[1] + legLen * .36], hock = [H[0] - 8 * h, H[1] + legLen * .74], foot = [H[0] + 10 * h, fy - 6];
      leg(g, [H, knee, hock, foot], 34 * Math.min(bulk, 1.08) * (o.fem ? .82 : 1), col);
      if (L === 'hooves') shape(g, [[foot[0] - 9, foot[1] - 10], [foot[0] + 9, foot[1] - 10], [foot[0] + 12, fy + 2, 1], [foot[0] - 10, fy + 2, 1]], col);
      else taper(g, [[foot[0] - 4, foot[1] - 2], [foot[0] + 14, fy - 2], [foot[0] + 30, fy]], 10 * bulk, 2, col);
    }
  } else if (L === 'robe' || L === 'cloak') {
    const hem = o.hover ? fy - 30 : fy;
    const back = L === 'cloak' ? 80 : 46, wind = o.wind ?? 0;
    const pts = [[hip[0] - waist * 1.3, hip[1] - 60], [hip[0] - waist * 1.6 - wind * 30, hip[1] + 60], [hip[0] - back * bulk - wind * 90, hem - 10, 1]];
    const n = L === 'cloak' ? 7 : 5, r = mulberry(o.seed ?? 5);
    for (let i = 1; i <= n; i++) { const x = lerp(hip[0] - back * bulk - wind * 90, hip[0] + 44 * bulk, i / n); pts.push([x - 8, hem - (L === 'cloak' ? 26 + r() * 30 : 10) + (i % 2) * 4, 0], [x, hem + (L === 'cloak' ? r() * 16 : 0), L === 'cloak' ? 1 : 0]); }
    pts.push([hip[0] + 36 * bulk, hip[1] + 80], [hip[0] + waist * 1.1, hip[1] - 40]);
    shape(g, pts);
    cut(g, () => { g.lineWidth = 1.1; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(hip[0] - 4 + i * 20, hip[1] + 40); g.quadraticCurveTo(hip[0] - 16 + i * 20 - wind * 20, hem - 80, hip[0] - 24 + i * 26 - wind * 40, hem - 30); g.stroke(); } });
  } else if (L === 'serpent') {
    const b = hip, pts = [[b[0] + 6, b[1] - 20], [b[0] + 12, fy - 60], [b[0] - 30, fy - 16], [b[0] - 140, fy - 16], [b[0] - 196, fy - 56], [b[0] - 184, fy - 110], [b[0] - 140, fy - 116]];
    const s = taper(g, pts, t => (58 - 50 * t) * bulk, 0);
    cut(g, () => { g.lineWidth = 1.1; for (let i = 9; i < s.length - 8; i += 7) { const a = s[i - 1], c = s[i + 1], m = s[i]; const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy), w = (58 - 50 * i / s.length) * bulk * .36; g.beginPath(); g.moveTo(m[0] - dy / l * w, m[1] + dx / l * w); g.quadraticCurveTo(m[0] + dx / l * 6, m[1] + dy / l * 6, m[0] + dy / l * w, m[1] - dx / l * w); g.stroke(); } });
  } else if (L === 'horse') {
    const top = hip[1] + 12, belly = top + 80 * h, front = hip[0] + 40, rump = hip[0] - 190 * h;
    for (const [x, col, k] of [[rump + 26, INK2, 0], [front - 16, INK2, 1], [rump + 6, INK, 0], [front - 36, INK, 1]]) {
      const raise = k && col === INK;
      const pts = raise ? [[x, belly - 20], [x + 26, belly + 40], [x + 60, belly + 44], [x + 66, belly + 80]] : [[x, belly - 20], [x + 8 * (k ? 1 : -1), belly + 50], [x - 6, fy - 40], [x, fy - 8]];
      taper(g, pts, t => 30 - 20 * t, 0, col);
      const e = pts[pts.length - 1]; shape(g, [[e[0] - 8, e[1] - 6], [e[0] + 8, e[1] - 6], [e[0] + 10, e[1] + 8, 1], [e[0] - 10, e[1] + 8, 1]], col);
    }
    shape(g, [[front + 10, top + 10], [front + 22, top + 50], [front - 10, belly], [rump + 40, belly + 4], [rump - 6, belly - 30], [rump - 14, top + 16], [rump + 30, top - 4], [hip[0] - 40, top + 4], [hip[0] - 6, hip[1] - 20]]);
    for (let i = 0; i < 4; i++) taper(g, [[rump - 6, top + 14], [rump - 40 - i * 6, top + 30 + i * 10], [rump - 56 - i * 8, top + 110 + i * 12]], 12 - i * 2, 0);
  } else if (L === 'bird') {
    const H = [hip[0], hip[1] + 10];
    shape(g, [[H[0] - 40, H[1] - 30], [H[0] + 30, H[1] - 36], [H[0] + 40, H[1] + 10], [H[0] + 10, H[1] + 50], [H[0] - 60, H[1] + 40], [H[0] - 130, H[1] + 70, 1], [H[0] - 76, H[1] + 10]]);
    for (const [dx, col] of [[-14, INK2], [8, INK]]) { const k = [H[0] + dx, H[1] + 40]; taper(g, [k, [k[0] + 10, k[1] + 40], [k[0] - 4, fy - 30]], 14, 6, col); claw(g, [k[0] - 2, fy - 28], .9, 26, col, 3); }
  } else if (L === 'ice' || L === 'boat') {
    shape(g, [[hip[0] - waist * 1.1, hip[1] - 40], [hip[0] - waist * 1.2, fy - 10], [hip[0] + waist * 1.2, fy - 10], [hip[0] + waist * 1.05, hip[1] - 40]]);
  }
}
function iceBlock(g, cx, fy, w, hgt) {
  const r = mulberry(cx * 7 + w);
  const pts = [[cx - w, fy + 2, 1]];
  for (let i = 0; i <= 8; i++) pts.push([cx - w + i * w / 4 + (r() - .5) * 14, fy - hgt * (.55 + r() * .45) + (i % 2) * 18, 1]);
  pts.push([cx + w, fy + 2, 1]);
  const p = curve(pts);
  g.save(); g.globalAlpha = .88; fill(g, p, ICE); g.restore();
  g.save(); g.clip(p);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) { const x = cx - w + r() * w * 2; g.beginPath(); g.moveTo(x, fy - hgt); g.lineTo(x + (r() - .5) * 40, fy - hgt * .4); g.lineTo(x + (r() - .5) * 60, fy); g.stroke(); }
  g.fillStyle = 'rgba(40,80,110,.35)'; g.fillRect(cx - w, fy - 26, w * 2, 30);
  g.restore();
  g.save(); g.strokeStyle = '#5f8aa6'; g.lineWidth = 2; g.stroke(p); g.restore();
}
function boat(g, cx, fy, h) {
  shape(g, [[cx - 150 * h, fy - 70 * h, 1], [cx - 120 * h, fy - 46 * h], [cx + 90 * h, fy - 46 * h], [cx + 130 * h, fy - 80 * h], [cx + 150 * h, fy - 150 * h], [cx + 132 * h, fy - 176 * h, 1], [cx + 150 * h, fy - 160 * h], [cx + 168 * h, fy - 110 * h], [cx + 150 * h, fy - 40 * h], [cx + 100 * h, fy - 4], [cx - 100 * h, fy - 4], [cx - 140 * h, fy - 30 * h]]);
  cut(g, () => { g.lineWidth = 2; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(cx - 120 * h, fy - (36 - i * 14) * h); g.lineTo(cx + 120 * h, fy - (36 - i * 14) * h); g.stroke(); } });
}

/* ---------- imps: big-headed, bat-winged, a spaded tail ---------- */
function imp(o) {
  const r = new Rig();
  const bulk = o.belly ?? 1, cx = 248, hip = [cx, 410 - (bulk - 1) * 10], hs = 40 * (o.hs ?? 1);
  const bodyC = [cx + 4, hip[1] - 36 * bulk], sh = [cx + 18, hip[1] - 70 - (bulk - 1) * 30];
  const hc = [sh[0] + 22, sh[1] - hs * .9];
  let eyePos;
  if (o.wings !== false) {
    const root = [sh[0] - 20, sh[1] + 10], ws = 118 * (o.wingS ?? 1);
    r.part('wingFar', g => batWing(g, [root[0] + 10, root[1] - 4], ws * .85, { col: INK2, up: 1.15 }), { pivot: [root[0] + 10, root[1] - 4], z: 0, anim: { rot: .3, speed: 7, phase: .3 } });
    r.part('wingNear', g => batWing(g, root, ws, { tatter: o.tatter }), { pivot: root, z: .5, anim: { rot: -.3, speed: 7 } });
  }
  const tb = [cx - 26 * bulk, hip[1] - 4];
  r.part('tail', g => {
    const s = taper(g, [tb, [tb[0] - 50, tb[1] + 30], [tb[0] - 96, tb[1] + 2], [tb[0] - 96, tb[1] - 50], [tb[0] - 74, tb[1] - 70]], 9, 2.5);
    const e = s[s.length - 1], p = s[s.length - 4], a = Math.atan2(e[1] - p[1], e[0] - p[0]);
    g.save(); g.translate(e[0], e[1]); g.rotate(a); shape(g, [[-3, 0], [-8, -11, 1], [18, 0, 1], [-8, 11, 1]]); g.restore();
  }, { pivot: tb, z: .8, anim: { rot: .2, speed: 2.6 } });
  r.part('armBack', g => { const s = [sh[0] - 8, sh[1] + 8]; arm(g, s, [s[0] - 10, s[1] + 40], [s[0] + 14, s[1] + 64], 14 * bulk, 8, INK2); claw(g, [s[0] + 14, s[1] + 64], 1.1, 18, INK2);
    if (o.coins) sack(g, s[0] + 12, s[1] + 92, 32, INK2); }, { pivot: [sh[0] - 8, sh[1] + 8], z: 1, anim: { rot: .1, speed: 2.4, phase: 2 } });
  r.part('body', g => {
    for (const [dx, col] of [[-10, INK2], [8, INK]]) {
      const H = [hip[0] + dx, hip[1]], knee = [H[0] + 22, H[1] + 34], hock = [H[0] - 6, H[1] + 64], foot = [H[0] + 8, FY - 4];
      leg(g, [H, knee, hock, foot], 24 * Math.min(1.3, bulk), col);
      taper(g, [[foot[0] - 2, foot[1] - 2], [foot[0] + 12, FY - 2], [foot[0] + 24, FY]], 8, 2, col);
    }
    shape(g, [[hip[0] - 26 * bulk, hip[1] + 4], [bodyC[0] - 38 * bulk, bodyC[1] + 10], [sh[0] - 30, sh[1] + 8], [sh[0] - 6, sh[1] - 12], [sh[0] + 22, sh[1] - 4], [sh[0] + 30 * bulk, sh[1] + 30], [bodyC[0] + 44 * bulk, bodyC[1] + 14], [hip[0] + 30 * bulk, hip[1] + 6]]);
    if (o.ribs !== false && bulk < 1.2) cut(g, () => { g.lineWidth = 1.8; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(sh[0] + 2, sh[1] + 20 + i * 11); g.quadraticCurveTo(sh[0] + 16, sh[1] + 16 + i * 11, sh[0] + 22, sh[1] + 26 + i * 11); g.stroke(); } });
    if (bulk > 1.2) cut(g, () => { g.lineWidth = 2; g.beginPath(); g.arc(bodyC[0] + 18, bodyC[1] + 6, 30 * bulk, -.9, .9); g.stroke(); });
  }, { z: 2, anim: { breath: .03, speed: 2.4 } });
  r.part('head', g => { eyePos = head(g, hc[0], hc[1], hs, 'imp', { horns: 'imp', ears: true, teeth: true }); },
    { pivot: [hc[0] - 6, hc[1] + hs * .9], z: 4, anim: { bob: 2.5, speed: 2.4, rot: .06 },
      glow: g => { const e = eyePos; glowDot(g, e[0], e[1], 4.5, o.eye ?? '#ffb02a'); if (o.flame) for (let i = 0; i < 3; i++) flame(g, hc[0] - hs * .5 + i * hs * .42, hc[1] - hs * .9, hs * (1 + (i % 2) * .6), hs * .26); } });
  r.part('arm', g => {
    const s = [sh[0] + 8, sh[1] + 10];
    if (o.fork) { const el = [s[0] + 22, s[1] + 34], wr = [s[0] + 50, s[1] + 26]; arm(g, s, el, wr, 15, 9); weapon(g, 'fork', wr, .25, 180); ell(g, wr[0], wr[1], 8, 7); }
    else if (o.fists) { const el = [s[0] + 26, s[1] + 18], wr = [s[0] + 40, s[1] - 26]; arm(g, s, el, wr, 16, 10); ell(g, wr[0], wr[1] - 4, 12, 11); }
    else { const el = [s[0] + 22, s[1] + 36], wr = [s[0] + 62, s[1] + 26]; arm(g, s, el, wr, 15, 9); claw(g, wr, -.2, 22); }
  }, { pivot: [sh[0] + 8, sh[1] + 10], z: 5, anim: { rot: .1, speed: 2.4, phase: 1 } });
  r.feet = FY; r.top = hc[1] - hs * 1.6;
  return r;
}

/* ---------- wraiths, shades and lost souls: a hood and a tattered cloak, no legs ---------- */
function wraith(o) {
  const r = new Rig();
  const s = o.size ?? 1, cx = 244, top = FY - 380 * s, wind = o.wind ?? .2;
  const hc = [cx + 30 * s, top + 56 * s], hs = 40 * s;
  let eyePos;
  r.part('cloak', g => {
    const rr = mulberry(o.seed ?? 3);
    const pts = [[cx - 30 * s, top + 70 * s], [cx - 70 * s - wind * 40, top + 170 * s], [cx - 110 * s - wind * 100, top + 290 * s]];
    for (let i = 0; i <= 8; i++) { const x = cx - 110 * s - wind * 100 + i * (150 + wind * 100) * s / 8; pts.push([x - 6, top + (300 + (i % 2 ? -30 : 10) + rr() * 30 - wind * (8 - i) * 6) * s, i % 2 ? 0 : 1]); }
    pts.push([cx + 60 * s, top + 200 * s], [cx + 44 * s, top + 100 * s]);
    shape(g, pts);
    cut(g, () => { g.lineWidth = 1.1; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(cx - 4 * s + i * 22 * s, top + 130 * s); g.quadraticCurveTo(cx - 30 * s + i * 10 * s - wind * 40, top + 220 * s, cx - 60 * s + i * 12 * s - wind * 80, top + 290 * s); g.stroke(); } });
    if (o.ice) for (let i = 0; i < 5; i++) { const x = cx - 80 * s + i * 34 * s; shape(g, [[x - 8, top + 280 * s], [x, top + (330 + (i % 2) * 30) * s, 1], [x + 8, top + 280 * s]]); }
  }, { z: 0, pivot: [cx, top + 80 * s], anim: { rot: .035, speed: 1.3, sway: 5 } });
  r.part('armBack', g => { const a = [cx + 10 * s, top + 110 * s]; arm(g, a, [a[0] + 30 * s, a[1] + 46 * s], [a[0] + 80 * s, a[1] + 40 * s], 20 * s, 8 * s, INK2); claw(g, [a[0] + 80 * s, a[1] + 40 * s], -.1, 26 * s, INK2, 4); }, { z: .5, pivot: [cx + 10 * s, top + 110 * s], anim: { rot: .06, speed: 1.3, phase: 2 } });
  r.part('hood', g => { eyePos = head(g, hc[0], hc[1], hs, o.skull ? 'skull' : 'hood', { mouth: false }); },
    { z: 1, pivot: [hc[0], hc[1] + hs], anim: { bob: 2, speed: 1.3, rot: .04 },
      glow: g => { const e = eyePos; glowDot(g, e[0], e[1], 4.5 * s, o.eye ?? '#b8d8ff'); glowDot(g, e[0] - 10 * s, e[1] + 2, 3 * s, o.eye ?? '#b8d8ff'); } });
  r.part('arm', g => { const a = [cx + 22 * s, top + 104 * s]; arm(g, a, [a[0] + 44 * s, a[1] + 30 * s], [a[0] + 104 * s, a[1] + 6 * s], 22 * s, 8 * s); claw(g, [a[0] + 104 * s, a[1] + 6 * s], -.3, 32 * s, INK, 4); }, { z: 2, pivot: [cx + 22 * s, top + 104 * s], anim: { rot: .06, speed: 1.3, phase: 1 } });
  r.feet = FY; r.top = top - 10; r.hover = true;
  return r;
}
function soul() {
  const r = new Rig();
  let eyePos;
  r.part('body', g => {
    const cx = 250, top = 230;
    shape(g, [[cx + 10, top], [cx + 54, top + 30], [cx + 60, top + 90], [cx + 40, top + 150], [cx - 10, top + 210], [cx - 90, top + 240, 1], [cx - 40, top + 180], [cx - 46, top + 120], [cx - 40, top + 40]]);
    taper(g, [[cx + 20, top + 110], [cx + 60, top + 140], [cx + 96, top + 120]], 16, 4);
    eyePos = [cx + 34, top + 54];
    cut(g, () => { for (const [dx, dy, rx, ry] of [[0, 0, 7, 10], [-22, 2, 6, 9], [-8, 40, 7, 13]]) { g.beginPath(); g.ellipse(eyePos[0] + dx, eyePos[1] + dy, rx, ry, 0, 0, TAU); g.fill(); } });
  }, { z: 0, pivot: [250, 400], anim: { rot: .05, speed: 1.6, sway: 6 }, glow: g => { glowDot(g, eyePos[0], eyePos[1], 3.5, '#c8e0ff'); glowDot(g, eyePos[0] - 22, eyePos[1] + 2, 3, '#c8e0ff'); } });
  r.feet = FY; r.top = 210; r.hover = true;
  return r;
}

/* ---------- Cerberus: a great hound with three heads ---------- */
function hound() {
  const r = new Rig({ frameH: 560 });
  const fy = 544, back = fy - 220, cx = 230;
  const heads = [];
  r.part('tail', g => taper(g, [[cx - 150, back + 20], [cx - 210, back - 10], [cx - 220, back - 80], [cx - 190, back - 120]], 22, 2), { pivot: [cx - 150, back + 20], z: 0, anim: { rot: .16, speed: 2.2 } });
  r.part('body', g => {
    for (const [x, col, front] of [[cx - 120, INK2, 0], [cx + 60, INK2, 1], [cx - 136, INK, 0], [cx + 76, INK, 1]]) {
      const pts = front ? [[x, back + 40], [x + 10, back + 120], [x - 4, fy - 40], [x + 6, fy - 8]] : [[x, back + 20], [x - 26, back + 110], [x + 10, back + 160], [x - 6, fy - 8]];
      taper(g, pts, t => (front ? 46 : 54) - 34 * t, 0, col);
      claw(g, [x + 8, fy - 8], .3, 28, col, 3);
    }
    shape(g, [[cx + 110, back - 50], [cx + 120, back + 60], [cx + 60, back + 120], [cx - 60, back + 110], [cx - 150, back + 96], [cx - 176, back + 30], [cx - 150, back - 6], [cx - 40, back + 10], [cx + 40, back - 30]]);
    // a mane of spikes along the back
    for (let i = 0; i < 9; i++) { const x = cx - 140 + i * 30, y = back + 4 - Math.max(0, i - 5) * 16; shape(g, [[x - 12, y + 10], [x - 6, y - 24 - (i % 2) * 10, 1], [x + 12, y + 6]]); }
    cut(g, () => { g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx - 20 + i * 18, back + 40); g.quadraticCurveTo(cx - 10 + i * 18, back + 70, cx - 24 + i * 18, back + 96); g.stroke(); } });
  }, { z: 1, anim: { breath: .015, speed: 1.6 } });
  // three necks rising from the shoulders, one high, one forward, one low
  [[cx + 110, back - 160, -.3, INK2], [cx + 170, back - 70, 0, INK], [cx + 150, back + 10, .3, INK]].forEach(([x, y, a, col], i) => {
    const base = [cx + 70, back - 10 + i * 30];
    r.part('head' + i, g => {
      taper(g, [base, [lerp(base[0], x, .5) - 10, lerp(base[1], y, .5) + 10], [x - 30, y + 14]], 70, 40, col);
      g.save(); g.translate(x, y); g.rotate(a);
      heads[i] = head(g, 0, 0, 44, 'wolf', { col, teeth: true });
      heads[i] = [x + Math.cos(a) * heads[i][0] - Math.sin(a) * heads[i][1], y + Math.sin(a) * heads[i][0] + Math.cos(a) * heads[i][1]];
      g.restore();
    }, { pivot: base, z: 2 + i * .1, anim: { rot: .06, speed: 1.6 + i * .3, phase: i * 1.7 }, glow: g => glowDot(g, heads[i][0], heads[i][1], 5, '#ff7a2a') });
  });
  r.feet = fy; r.top = back - 250;
  return r;
}

/* ---------- gluttons and hoarders: a vast sagging body with a face sunk in its front ---------- */
function blob(o) {
  const r = new Rig();
  const eye = [318, 286];
  if (o.coins) r.part('heap', g => { sack(g, 120, 300, 92, INK2); sack(g, 180, 238, 58, INK2); sack(g, 70, 380, 70, INK2); }, { z: 0, pivot: [150, 420], anim: { rot: .02, speed: 1.2 } });
  r.part('body', g => {
    for (const [x, col] of [[150, INK2], [270, INK]]) { taper(g, [[x, FY - 60], [x + 8, FY - 26], [x + 4, FY - 6]], 54, 40, col); taper(g, [[x + 4, FY - 6], [x + 34, FY - 2]], 18, 6, col); }
    const body = curve([[120, FY - 10], [78, 420], [86, 330], [140, 262], [214, 224], [292, 226], [326, 250], [346, 270, 1], [326, 282, 1], [340, 296], [360, 304, 1], [344, 316, 1], [352, 328], [336, 338, 1], [358, 352], [352, 372], [368, 394], [392, 432], [384, 474], [340, FY - 6], [240, FY - 4]]);
    fill(g, body);
    cut(g, () => {
      g.beginPath(); g.ellipse(eye[0], eye[1], 9, 4, -.2, 0, TAU); g.fill();
      g.lineWidth = 3.4; g.beginPath(); g.moveTo(352, 330); g.quadraticCurveTo(320, 342, 286, 334); g.stroke();
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(340 - i * 14, 334 + i); g.lineTo(336 - i * 14, 344 + i); g.lineTo(332 - i * 14, 335 + i); g.fill(); }
      g.lineWidth = 1.3; for (const [y0, w] of [[360, 50], [384, 70]]) { g.beginPath(); g.moveTo(358, y0); g.quadraticCurveTo(340 - w * .3, y0 + 14, 350 - w, y0 + 4); g.stroke(); }
      g.beginPath(); g.arc(250, 380, 110, -.3, .9); g.stroke();
    });
    if (o.horns) for (const [x, y] of [[230, 232], [272, 228]]) taper(g, [[x, y + 10], [x - 6, y - 26], [x - 28, y - 44]], 18, 0);
  }, { z: 1, anim: { breath: .03, speed: 1.2 }, glow: g => glowDot(g, eye[0], eye[1], 4.5, o.eye ?? '#e8ff5a') });
  r.part('arm', g => { const s = [330, 384]; arm(g, s, [s[0] + 26, s[1] + 40], [s[0] + 70, s[1] + 36], 34, 18); claw(g, [s[0] + 72, s[1] + 36], -.3, 30);
    if (o.coins) ell(g, s[0] + 86, s[1] + 22, 15, 15); }, { z: 3, pivot: [330, 384], anim: { rot: .06, speed: 1.4, phase: 1 }, glow: o.coins ? g => glowDot(g, 416, 406, 7, '#ffd84a', '#fff4c0') : null });
  r.feet = FY; r.top = 220;
  return r;
}

/* ---------- the great leech of the Styx: rearing out of the mud, a round mouth ringed with teeth ---------- */
function leech() {
  const r = new Rig();
  r.part('body', g => {
    const pts = [[70, FY - 6], [170, FY - 10], [260, FY - 40], [300, 380], [300, 290], [330, 230]];
    const s = taper(g, pts, t => 36 + Math.sin(t * Math.PI) * 52, 44);
    // a ridge of small spines down its back
    for (let i = 10; i < s.length - 8; i += 3) { const a = s[i - 1], c = s[i + 1], q = s[i]; const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy), w = (36 + Math.sin(i / s.length * Math.PI) * 52) / 2; const bx = q[0] + dy / l * w, by = q[1] - dx / l * w; g.beginPath(); g.moveTo(bx - dx / l * 6, by - dy / l * 6); g.lineTo(bx + dy / l * 12, by - dx / l * 12); g.lineTo(bx + dx / l * 6, by + dy / l * 6); g.fill(); }
    cut(g, () => { g.lineWidth = 1.2; for (let i = 14; i < s.length - 10; i += 9) { const a = s[i - 1], c = s[i + 1], q = s[i]; const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy), w = (36 + Math.sin(i / s.length * Math.PI) * 52) * .38; g.beginPath(); g.moveTo(q[0] - dy / l * w, q[1] + dx / l * w); g.quadraticCurveTo(q[0] + dx / l * 6, q[1] + dy / l * 6, q[0] + dy / l * w, q[1] - dx / l * w); g.stroke(); } });
    // the mouth, turned toward her
    const m = s[s.length - 1];
    ell(g, m[0] + 14, m[1] + 4, 44, 40);
    cut(g, () => { g.beginPath(); g.ellipse(m[0] + 34, m[1] + 6, 18, 28, .25, 0, TAU); g.fill(); });
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; shape(g, [[m[0] + 34 + Math.cos(a - .18) * 18, m[1] + 6 + Math.sin(a - .18) * 28], [m[0] + 34 + Math.cos(a) * 7, m[1] + 6 + Math.sin(a) * 10, 1], [m[0] + 34 + Math.cos(a + .18) * 18, m[1] + 6 + Math.sin(a + .18) * 28]]); }
  }, { z: 0, pivot: [250, FY], anim: { rot: .03, speed: 1.2, breath: .02 }, glow: g => { glowDot(g, 356, 240, 5, '#ffb04a'); } });
  r.feet = FY; r.top = 170;
  return r;
}

/* ---------- carrion flies ---------- */
function fly() {
  const r = new Rig();
  const c = [250, 330];
  r.part('wingFar', g => insectWing(g, [c[0] - 10, c[1] - 30], 120, {}), { pivot: [c[0] - 10, c[1] - 30], z: 0, anim: { rot: .4, speed: 22 } });
  r.part('body', g => {
    ell(g, c[0] - 40, c[1] + 6, 56, 32, INK, .2);
    ell(g, c[0] + 20, c[1] - 6, 34, 30);
    for (let i = 0; i < 3; i++) taper(g, [[c[0] + i * 14 - 10, c[1] + 20], [c[0] + i * 20 - 4, c[1] + 70], [c[0] + i * 26 - 20, c[1] + 110]], 6, 2);
    ell(g, c[0] + 60, c[1] - 10, 26, 24);
    taper(g, [[c[0] + 76, c[1] + 6], [c[0] + 90, c[1] + 30], [c[0] + 84, c[1] + 46]], 7, 3);
    cut(g, () => { g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(c[0] - 40, c[1] + 6, 18 + i * 14, -.8, .8); g.stroke(); } });
  }, { z: 1, anim: { bob: 3, speed: 3 }, glow: g => { glowDot(g, c[0] + 66, c[1] - 16, 9, '#ff4a2a'); } });
  r.part('wingNear', g => insectWing(g, [c[0] - 4, c[1] - 34], 140, {}), { pivot: [c[0] - 4, c[1] - 34], z: 2, anim: { rot: -.4, speed: 22 } });
  r.feet = FY; r.top = 200; r.hover = true;
  return r;
}

/* ---------- the Devil: frozen to the chest in the ice, six wings, three faces ---------- */
function devil() {
  const r = new Rig({ frameH: 600 });
  const fy = 584, cx = 256, sh = 300, hs = 46;
  const eyes = [];
  // six bat wings, three to a side
  for (const side of [-1, 1]) for (const [k, up, len] of [[0, 1.25, 250], [1, .9, 230], [2, .5, 200]]) {
    const root = [cx + side * 30, sh + 20 + k * 30];
    r.part(`wing${side}${k}`, g => batWing(g, root, len, { side: -side, up, col: k === 1 ? INK2 : INK, tatter: 3 + k }), { pivot: root, z: k * .1, anim: { rot: .1 * side, speed: 1.4, phase: k * .5 } });
  }
  r.part('body', g => {
    // a great chest and shoulders, rising out of the ice
    shape(g, [[cx - 120, fy - 60], [cx - 130, sh + 60], [cx - 90, sh], [cx - 40, sh - 20], [cx + 40, sh - 20], [cx + 90, sh], [cx + 130, sh + 60], [cx + 120, fy - 60]]);
    cut(g, () => { g.lineWidth = 2.4; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - 60, sh + 60 + i * 26); g.quadraticCurveTo(cx, sh + 80 + i * 26, cx + 60, sh + 60 + i * 26); g.stroke(); } g.beginPath(); g.moveTo(cx, sh + 30); g.lineTo(cx, sh + 150); g.stroke(); });
    // the side faces, looking left and right
    for (const s of [-1, 1]) { g.save(); g.translate(cx + s * 64, sh - 50); g.scale(s, 1); eyes.push(head(g, 0, 0, hs * .78, 'demon', { horns: 'straight', teeth: true })); g.restore(); }
    eyes[0] = [cx - 64 - eyes[0][0], sh - 50 + eyes[0][1]]; eyes[1] = [cx + 64 + eyes[1][0], sh - 50 + eyes[1][1]];
  }, { z: 1, anim: { breath: .012, speed: 1.2 } });
  for (const s of [-1, 1]) r.part('arm' + s, g => {
    const a = [cx + s * 110, sh + 40], el = [cx + s * 170, sh + 140], wr = [cx + s * 150, sh + 230];
    arm(g, a, el, wr, 52, 30);
    claw(g, wr, Math.PI / 2 + s * .3, 50, INK, 4);
  }, { pivot: [cx + s * 110, sh + 40], z: 2, anim: { rot: .04 * s, speed: 1.2, phase: s } });
  r.part('head', g => {
    // the middle face, frontal: a long horned skull with a gaping mouth
    shape(g, [[cx - 40, sh - 130], [cx - 46, sh - 70], [cx - 30, sh - 20], [cx, sh + 14, 1], [cx + 30, sh - 20], [cx + 46, sh - 70], [cx + 40, sh - 130], [cx, sh - 152]]);
    for (const s of [-1, 1]) taper(g, [[cx + s * 30, sh - 130], [cx + s * 70, sh - 190], [cx + s * 66, sh - 250], [cx + s * 40, sh - 290]], 26, 0);
    cut(g, () => {
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 8, sh - 92); g.lineTo(cx + s * 34, sh - 104); g.lineTo(cx + s * 30, sh - 86); g.closePath(); g.fill(); }
      g.beginPath(); g.moveTo(cx - 20, sh - 40); g.lineTo(cx + 20, sh - 40); g.lineTo(cx, sh - 10); g.closePath(); g.fill();
    });
    shape(g, [[cx - 20, sh - 40], [cx - 12, sh - 28, 1], [cx - 6, sh - 40], [cx, sh - 26, 1], [cx + 6, sh - 40], [cx + 12, sh - 28, 1], [cx + 20, sh - 40]]);
    eyes.push([cx - 22, sh - 96], [cx + 22, sh - 96]);
  }, { pivot: [cx, sh], z: 3, anim: { bob: 2, speed: 1.2, rot: .02 }, glow: g => { for (const e of eyes) glowDot(g, e[0], e[1], 6, '#ffd84a'); glowDot(g, cx, sh - 24, 8, '#ff5a1a'); } });
  r.part('ice', g => iceBlock(g, cx, fy, 210, 200), { z: 4, paper: true });
  r.feet = fy; r.top = sh - 300;
  return r;
}

const LOOKS = {
  angel: () => angel(),
  imp: () => imp({ fork: true }),
  bloat: () => imp({ belly: 1.6, wingS: .6, eye: '#e8ff6a', hs: .9 }),
  coinDevil: () => imp({ coins: true, eye: '#ffe27a', hs: 1.05 }),
  wrathling: () => imp({ flame: true, fists: true, eye: '#ffffff', wingS: .8, hs: 1.1, tatter: 4 }),
  fly: () => fly(),
  soul: () => soul(),
  shade: () => wraith({ eye: '#b8d8ff' }),
  wraith: () => wraith({ eye: '#ff8ad0', size: 1.08, seed: 7, wind: 1 }),
  iceWraith: () => wraith({ eye: '#e0f8ff', ice: true, size: 1.1, seed: 11, skull: true }),
  succubus: () => demon({ fem: true, head: 'human', horns: 'curl', hair: 'long', wings: 'bat', wingS: .95, tail: 'arrow', bulk: .82, lower: 'human', eye: '#ff7ad0', lean: 4, pose: 'reach' }),
  lover: () => demon({ head: 'human', hair: 'short', lower: 'robe', bulk: .8, hover: true, eye: '#c8e0ff', wind: .8, pose: 'reach', pose2: 'reach', lean: 14, seed: 4 }),
  lover2: () => demon({ fem: true, head: 'human', hair: 'long', wind: 1, lower: 'robe', bulk: .74, hover: true, eye: '#ffc8e0', pose: 'reach', lean: 12, seed: 9 }),
  minos: () => demon({ head: 'demon', horns: 'big', lower: 'serpent', crown: true, bulk: 1.3, h: 1.05, eye: '#ffb03a', weapon: 'scale', pose: 'raise', teeth: true }),
  cerberus: () => hound(),
  glutton: () => blob({ eye: '#e8ff5a' }),
  flylord: () => demon({ head: 'fly', hs: 1.2, wings: 'insect', wingS: 1.1, bulk: 1.1, crown: true, eye: '#ff5a3a', lower: 'robe', weapon: 'staff', staffGlow: '#b8ff5a' }),
  hoarder: () => blob({ coins: true, horns: true, eye: '#fff07a' }),
  leech: () => leech(),
  heretic: () => demon({ head: 'hood', lower: 'robe', flames: true, eye: '#ffa03a', bulk: .9, weapon: 'staff', staffGlow: '#ff7a2a', lean: 14 }),
  cleric: () => demon({ head: 'human', mitre: true, lower: 'robe', halo: 'broken', eye: '#c0a8ff', bulk: .86, weapon: 'crosier', lean: 6, h: 1.04 }),
  plutus: () => demon({ head: 'wolf', hs: 1.15, bulk: 1.2, chest: 1.2, h: 1.05, crown: true, eye: '#ffd04a', weapon2: 'sack', lower: 'robe', teeth: true, pose: 'reach', lean: 16, seed: 3 }),
  phlegyas: () => demon({ head: 'demon', horns: 'curl', bulk: 1.2, h: 1.05, weapon: 'oar', eye: '#ff7a3a', lower: 'boat', hs: 1.05, lean: 16, hump: true, teeth: true }),
  fallenSeraph: () => demon({ head: 'human', hair: 'long', wings: 'six', wingS: .95, halo: 'broken', lower: 'robe', eye: '#d8c8ff', weapon: 'sword', pose: 'raise', bulk: .9, h: 1.05, hover: true }),
  fury1: () => demon({ fem: true, head: 'hag', hair: 'snakes', wings: 'bat', wingS: .9, tatter: 5, lower: 'robe', eye: '#ff5a3a', weapon: 'whip', bulk: .78, hover: true, lean: 10 }),
  fury2: () => demon({ fem: true, head: 'hag', hair: 'snakes', wings: 'bat', wingS: .95, tatter: 9, lower: 'robe', eye: '#aaff6a', weapon: 'whip', bulk: .78, hover: true, lean: 14, pose: 'raise', seed: 8 }),
  fury3: () => demon({ fem: true, head: 'hag', hair: 'snakes', wings: 'bat', wingS: .85, tatter: 13, lower: 'robe', eye: '#c8a8ff', weapon: 'whip', bulk: .8, hover: true, lean: 6, seed: 12 }),
  centaur: () => demon({ head: 'human', hair: 'long', lower: 'horse', bulk: .95, eye: '#ffb04a', weapon: 'bow', pose: 'reach', h: 1, horns: 'small', cx: 290 }),
  harpy: () => demon({ fem: true, head: 'hag', hair: 'long', wings: 'feather', wingS: 1.05, lower: 'bird', bulk: .7, eye: '#ffea5a', hover: true, backArm: false, pose: 'reach', torso: .8 }),
  malebranche: () => demon({ head: 'demon', horns: 'straight', wings: 'bat', wingS: .8, tail: 'arrow', weapon: 'hook', eye: '#7affd8', bulk: .9, lower: 'legs', teeth: true, ribs: true }),
  flatterer: () => demon({ head: 'hood', lower: 'robe', eye: '#ffffff', bulk: .9, weapon: 'mask', pose: 'raise', wang: .1, lean: 14, hump: true }),
  traitor: () => demon({ head: 'human', lower: 'ice', eye: '#e0f8ff', bulk: 1, pose: 'raise', backArm: false, hair: 'short' }),
  minotaur: () => demon({ head: 'bull', horns: 'bull', hs: 1.1, bulk: 1.25, chest: 1.3, h: 1.05, weapon: 'axe', pose: 'hold', wang: .62, eye: '#ff5a3a', lower: 'human', lean: 8, ribs: true }),
  geryon: () => demon({ head: 'human', hair: 'short', lower: 'serpent', wings: 'bat', bulk: 1.05, eye: '#ffffff', tail: 'scorpion', pose: 'reach' }),
  nimrod: () => demon({ head: 'demon', horns: 'small', crown: true, bulk: 1.4, chest: 1.25, h: 1.1, weapon: 'horn', pose: 'raise', wang: -.9, lower: 'ice', eye: '#bfefff', hs: 1.2, teeth: true }),
  devil: () => devil(),
};
export const lookFor = id => (LOOKS[id] ?? LOOKS.imp)();
export { FW, FH };
