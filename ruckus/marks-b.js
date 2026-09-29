// Punctuation, part B: ( ) [ ] { } / \ @ #. Every mark is a little film in flat colour and the glyph itself takes part: the bow that
// shoots, the magnet that pulls, the moustache that twirls, the slide, the ski hill, the record, the board. The pairs come from a
// factory and a.flip (the way the mark opens or points), so both members share their code and differ in colours and props.
import {
  K, E, S, C, TAU, PI, sat, clamp, seg, lerp, pop, unpop, wob, hop, hash, mixHex, rays, disc, discO, ring, oval, ovalO, box, boxO, line, pline, poly,
  star, spark, heart, drop, wave, band, pie, arcS, cloud, gear, note, ngon, eye, bits, addDisc, addBox, addStar, spray, fall, pulse, limbO,
  glyph, glyphInk, gx, gy, raw, P,
} from './kit.js';

const SILVER = mixHex(K.ink, K.white, 0.8), STEEL = mixHex(K.ink, K.white, 0.58);      // the greys the palette lacks, lifted from the ink
const V = [0, 0];                                                                        // the point the helpers below hand back: read it at once
// a point of the hero frame (its px) in the stage, for a hero drawn by a.begin(x, y, sc, rot)
function toStage(px, py, x, y, sc, rot) { const cs = C(rot), sn = S(rot); V[0] = x + sc * (px * cs - py * sn); V[1] = y + sc * (px * sn + py * cs); return V; }
// a polygon with the dark outline
function polyO(p, col, ol) {
  const c = raw();
  c.fillStyle = col; c.strokeStyle = K.ink; c.lineWidth = ol * 2; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); c.stroke(); c.fill();
}
// a wavy ribbon from (x0, y0) to (x1, y1): a sine across the way it runs, held still at both ends
function ribbon(x0, y0, x1, y1, amp, ph, lw, col) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, pts = [];
  for (let i = 0; i <= 10; i++) { const f = i / 10, o = amp * S(f * PI) * S(f * 9 - ph); pts.push(x0 + dx * f + nx * o, y0 + dy * f + ny * o); }
  pline(pts, lw, col);
}
// little four-point sparkles that blink on and off all over the stage, from t0 on
function twinkle(a, t, n, t0, cols, seed) {
  if (t < t0) return;
  bits(cols, n, i => {
    const ph = (t - t0) / (0.6 + 0.5 * a.r(seed + i, 1)) + a.r(seed + i, 2), cyc = Math.floor(ph), r = a.u * 0.07 * S((ph - cyc) * PI) * (0.6 + 0.6 * hash(seed + i, cyc, 3));
    addStar((hash(seed + i, cyc, 4) - 0.5) * a.w * 0.95, (hash(seed + i, cyc, 5) - 0.5) * a.h * 0.85, r, r * 0.24, 4, hash(seed + i, cyc, 6) * 1.5);
  });
}

/* ---------- ( and ): a bow shoots three arrows into bullseyes; the glyph is the bow and its string draws back to the nock ---------- */
const SHOTS = [                                                    // where each arrow lands (fractions of the stage) and when it is let go
  { x: 0.26, y: -0.3, tr: 0.72 },
  { x: 0.1, y: 0.24, tr: 1.2 },
  { x: 0.36, y: 0.05, tr: 1.68 },
];
const FLIGHT = 0.2, DRAW = 0.27, BURST = 0.36;                     // seconds: an arrow's flight, drawing the bow, and the target's wobble before it bursts

// an arrow with its tail at (x, y) pointing along ang, z px per unit, fletched in the colours fl; drawn in whatever frame is current
function arrow(x, y, ang, len, z, fl) {
  const c = raw();
  c.save(); c.translate(x, y); c.rotate(ang);
  line(0, 0, len, 0, 4.6 * z, K.ink); line(0, 0, len, 0, 2 * z, K.cream);
  polyO([len - 2 * z, -4.6 * z, len + 9 * z, 0, len - 2 * z, 4.6 * z], SILVER, 1.5 * z);
  for (let sd = -1; sd <= 1; sd += 2) polyO([1.5 * z, sd * z, 15 * z, sd * z, 10 * z, sd * 7.5 * z, -2 * z, sd * 7.5 * z], fl[sd < 0 ? 0 : 1], 1.4 * z);
  c.restore();
}
// a bullseye hanging on a rope from (x0, top); (x, y) is its centre
function target(x, y, x0, top, r, cols, k) {
  line(x0, top, x, y - r * 0.9, 5 * k, K.ink); line(x0, top, x, y - r * 0.9, 2.2 * k, K.cream);
  discO(x, y, r, cols[0], r * 0.08);
  disc(x, y, r * 0.78, cols[1]); disc(x, y, r * 0.58, cols[0]); disc(x, y, r * 0.38, cols[1]); discO(x, y, r * 0.17, K.yellow, r * 0.05);
}

function bowScene(look) {
  return {
    flip: look.dir, color: look.color, bg: look.bg, dur: 2.8,
    back(a, t) {                                                    // a giant bullseye that jolts with every hit, and rays behind it
      const { w } = a, f = a.flip, cx = f * 0.2 * w;
      rays(cx, 0, 18, Math.hypot(a.bw, a.bh) / 2, t * 0.2 * f, look.ray, 0.5);
      let thump = 0;
      for (const s of SHOTS) if (t > s.tr + FLIGHT) thump = 0.05 * Math.exp(-9 * (t - s.tr - FLIGHT)) * C((t - s.tr - FLIGHT) * 30);
      for (let j = 4; j >= 0; j--) disc(cx, 0, w * (0.1 + j * 0.13) * (1 + thump) * pop(t, 0.02 + (4 - j) * 0.06, 0.5), look.ring[j & 1]);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, f = a.flip, s = Math.min(1.12, 0.8 * h / (1.09 * u)), sc = s * a.hs, Ub = Math.min(u, w * 0.6), ak = a.ak;
      const top = -h / 2 - 60, L = 0.62 * Ub, z = 1.05 * k * sc, rt = 0.3 * Ub, bx = -f * Math.min(0.2 * w, w / 2 - 48 * k * sc);
      const p = g.strokes[0].p, tipX = p[0], tipY0 = p[1], tipY1 = p[p.length - 1];
      // aim: the bow steps to each target's height and turns to it in turn
      let rot = 0, by = 0.02 * h, cur = -1;
      const byS = SHOTS.map(sh => 0.55 * sh.y * h), aims = SHOTS.map((sh, i) => Math.atan2(f * (sh.y * h - byS[i]), f * (f * sh.x * w - bx)));
      SHOTS.forEach((sh, i) => {
        const m = E.io(seg(t, sh.tr - DRAW - 0.2, sh.tr - DRAW));
        rot = lerp(rot, aims[i], m); by = lerp(by, byS[i], m);
        if (t >= sh.tr - DRAW) cur = i;
      });
      // how far the string is drawn: 0 at rest, 1 fully drawn, then a springy overshoot after the release
      let pl = 0, rel = 9;
      if (cur >= 0) {
        const sh = SHOTS[cur], dw = seg(t, sh.tr - DRAW, sh.tr);
        if (t < sh.tr) pl = E.out(dw) + 0.02 * S(t * 90) * E.in(dw); else { rel = t - sh.tr; pl = Math.exp(-7 * rel) * C(TAU * 4 * rel); }
      }
      const bend = 7 * pl, pull = 30 * pl, kick = rel < 9 ? wob(rel, 5, 7) : 0;                            // in glyph units
      // the targets, and each arrow: nocked (in the hero frame, further down), flying, stuck in its target, then dropping away
      SHOTS.forEach((sh, i) => {
        const tx = f * sh.x * w, ty = sh.y * h, th = sh.tr + FLIGHT, tb = th + BURST, ps = pop(t, sh.tr - DRAW - 0.35, 0.4);
        const disp = t > th ? f * 0.15 * (ty - top) * wob(t - th, 1.9, 2.6) : 0;
        if (t < tb && ps > 0) target(tx + disp, ty, tx, top, rt * ps, look.rings, k);
        if (t < sh.tr) return;
        const ang = (f > 0 ? 0 : PI) + aims[i], dx = C(ang), dy = S(ang), q = toStage(gx(g, k, tipX) - f * 37 * k, 0, bx, byS[i], sc, aims[i]);
        const q0x = q[0], q0y = q[1], fp = seg(t, sh.tr, th);
        let ax = lerp(q0x, tx - dx * L, fp), ay = lerp(q0y, ty - dy * L, fp), aa = ang;
        if (t > th) ax += disp;
        if (t > tb) { const age = t - tb; ay += 1400 * k * age * age; aa += f * 2.5 * age; }
        if (t < th + 0.3) {                                         // two ribbons of colour the arrow leaves, wriggling as they go
          const sp = seg(t, th - 0.05, th + 0.3), sx0 = lerp(q0x, ax, sp), sy0 = lerp(q0y, ay, sp);
          for (let j = 0; j < 2; j++) ribbon(sx0, sy0, ax, ay, 16 * k * (1 - sp), t * 30 + j * PI, (7 - j * 2) * k * (1 - sp * 0.6), look.fletch[j]);
        }
        if (ay < h) arrow(ax, ay, aa, L, z, look.fletch);
        const hp = seg(t, th, th + 0.34);                           // the hit: a star, then confetti when the target goes
        if (hp > 0 && hp < 1) { const r = rt * 1.5 * E.outBack(sat(hp * 3)) * (1 - hp * 0.5); star(tx, ty, r, 8, r * 0.5, hp * 2, K.yellow); star(tx, ty, r * 0.6, 8, r * 0.3, -hp * 2, K.white); }
        pulse(tx, ty, t, th, 0.4, rt * 2.6, rt * 0.2, K.white);
        spray(a, t, { x: tx, y: ty, n: a.n(20), t0: tb, life: 1.0, v0: u * 0.5, v1: u * 1.7, g: 1000, s0: 7, s1: 18, seed: 100 + i * 50, cols: look.confetti });
        pulse(tx, ty, t, tb, 0.45, rt * 3.4, rt * 0.16, look.confetti[0]);
      });
      for (let i = 0; i < 3; i++) {                                 // the score: a star lights for every hit
        const x = bx + (i - 1) * 0.4 * Ub, y = -0.4 * h, r = 0.12 * Ub, lit = pop(t, SHOTS[i].tr + FLIGHT, 0.45);
        star(x, y, r, 5, r * 0.45, 0, look.dim);
        if (lit > 0) { star(x, y, r * 1.3 * lit, 5, r * 0.6 * lit, (1 - lit) * 2, K.ink); star(x, y, r * 1.1 * lit, 5, r * 0.46 * lit, (1 - lit) * 2, K.yellow); }
      }
      fall(a, t, { n: a.n(12), t0: 0.3, shape: 'spark', cols: [K.white, K.yellow, look.fletch[0]], vy0: 60, vy1: 170, s0: 6, s1: 13, seed: 60 });
      // the bow: the glyph, bending as the string is drawn, with a grip, the string and the nocked arrow
      a.begin(bx, by, s * pop(t, 0.02, 0.3), rot, 1 - 0.13 * kick, 1 + 0.09 * kick);
      const warp = (x, y) => { const q = (y - 50) / 46; P.x = x - f * bend * q * q; P.y = y; };
      glyph(g, k, { color: look.color, fn: warp });
      if (ak > 0.02) {
        const tsx = gx(g, k, tipX - f * bend), ty0 = gy(k, tipY0), ty1 = gy(k, tipY1), nx = tsx - f * pull * k;
        glyphInk(g, k, { t0: 0.5 - 0.08 * ak, t1: 0.5 + 0.08 * ak, fn: warp }, look.grip, 17, null, 'butt');
        pline([tsx, ty0, nx, 0, tsx, ty1], 4.6 * k * ak, K.ink); pline([tsx, ty0, nx, 0, tsx, ty1], 2 * k * ak, K.white);
        disc(tsx, ty0, 4.5 * k * ak, K.ink); disc(tsx, ty1, 4.5 * k * ak, K.ink);
        if (cur >= 0 && t < SHOTS[cur].tr) { arrow(nx, 0, f > 0 ? 0 : PI, L / sc, k * 1.05, look.fletch); discO(nx, 0, 5 * k * ak, K.cream, 2.4 * k); }
      }
      a.end();
    },
  };
}

/* ---------- [ and ]: a magnet pulls a shower of bits onto its prongs along curving paths, flips polarity and blasts them away ---------- */
const TF = 1.72, TB = 1.85, FL = 0.5;                              // the polarity flips, the blast lets go, and how long a bit takes to arrive
const KEY = [0.7548776662, 0.5698402910];                          // a low-discrepancy sequence: scattered, never clumped
const frac = v => v - Math.floor(v);
const SLOTS = [[-90, 1], [-35, 1], [20, 1], [-62, 2], [-8, 2], [45, 1.6]];   // where bits sit round a prong: [degrees from straight out, how far out]
const sway = tt => 0.04 * S(tt * 3.1) * (1 - seg(tt, TF - 0.15, TF)) + 0.3 * wob(tt - TF, 3.4, 4.5);   // the magnet's turn: a lean, then a shake at the flip

// a curve from (x0, y0) to (x1, y1) that bows sideways by `bow` (a fraction of the distance), p of the way along; the point is left in V
function curve(x0, y0, x1, y1, bow, p) {
  const o = 1 - p, cx = (x0 + x1) / 2 - (y1 - y0) * bow, cy = (y0 + y1) / 2 + (x1 - x0) * bow;
  V[0] = o * o * x0 + 2 * o * p * cx + p * p * x1; V[1] = o * o * y0 + 2 * o * p * cy + p * p * y1;
  return V;
}
// electricity between two points; the zigzag re-rolls fourteen times a second
function crackle(x1, y1, x2, y2, seed, t, amp, lw, col) {
  const c = raw(), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, tk = Math.floor(t * 14), n = Math.max(3, Math.round(L / (amp * 1.4)));
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x1, y1);
  for (let i = 1; i < n; i++) { const q = i / n, o = (hash(seed + i, tk, 3) - 0.5) * 2 * amp * S(q * PI) / L; c.lineTo(x1 + dx * q - dy * o, y1 + dy * q + dx * o); }
  c.lineTo(x2, y2); c.stroke();
}
const CLIP = [-0.6, 0.15, 1.4, 0.15, 1.75, 0.02, 1.75, -0.5, 1.4, -0.75, -1.4, -0.75, -1.75, -0.5, -1.75, 0.4, -1.4, 0.65, 1, 0.65, 1.25, 0.5, 1.25, -0.15, 1, -0.3, -0.3, -0.3];   // a paperclip's path, in units of its size
// The bits a magnet picks up. Each draws itself round (0, 0) at size z in colour col; sp turns it over as it flies.
const BITS_A = [
  (z, sp, col) => {                                                // a coin
    const w = Math.max(0.22, Math.abs(C(sp))) * z;
    ovalO(0, 0, w, z, K.orange, 0, 0.14 * z); oval(0, 0, w * 0.72, z * 0.72, col);
    if (w > 0.45 * z) star(0, 0, z * 0.42, 5, z * 0.18, 0, K.orange);
  },
  (z, sp, col) => {                                                // a screw
    const c = raw();
    line(-z * 0.9, 0, z * 1.5, 0, z * 1.1, K.ink); line(-z * 0.9, 0, z * 1.5, 0, z * 0.8, STEEL);
    c.strokeStyle = K.ink; c.lineWidth = 0.13 * z; c.lineCap = 'butt'; c.beginPath();
    for (let i = 0; i < 3; i++) { c.moveTo(z * (0.1 + i * 0.4), -z * 0.4); c.lineTo(z * (0.1 + i * 0.4) + 0.2 * z, z * 0.4); }
    c.stroke();
    ngon(-z * 1.15, 0, z * 1.15, 6, 0, K.ink); ngon(-z * 1.15, 0, z * 0.92, 6, 0, col); line(-z * 1.15, -z * 0.5, -z * 1.15, z * 0.5, 0.16 * z, K.ink);
  },
  (z, sp, col) => { star(0, 0, z * 1.4, 5, z * 0.62, 0, K.ink); star(0, 0, z * 1.15, 5, z * 0.5, 0, col); },
  (z, sp, col) => { const c = raw(); c.save(); c.scale(z, z); pline(CLIP, 0.42, K.ink); pline(CLIP, 0.2, col); c.restore(); },   // a paperclip
];
const BITS_B = [
  (z, sp, col) => { gear(0, 0, z * 1.5, 8, sp * 0.1, K.ink); gear(0, 0, z * 1.3, 8, sp * 0.1, col, K.ink); },                                   // a gear
  (z, sp, col) => { ngon(0, 0, z * 1.4, 6, 0, K.ink); ngon(0, 0, z * 1.15, 6, 0, col); disc(0, 0, z * 0.55, K.ink); disc(0, 0, z * 0.32, STEEL); },   // a nut
  (z, sp, col) => { heart(0, -z * 0.1, z * 1.1, 0, K.ink); heart(0, -z * 0.05, z * 0.85, 0, col); },                                          // a heart
  (z, sp, col) => { disc(0, 0, z * 1.25, K.ink); disc(0, 0, z * 1.05, STEEL); disc(-z * 0.3, -z * 0.3, z * 0.34, K.white); },                    // a ball bearing
];
// a pole mark on a prong: a plus (scaled by pl) and a minus (scaled by mi), which swap when the polarity flips
function pole(x, y, r, pl, mi) {
  if (mi > 0.02) box(x, y, 2 * r * mi, 0.62 * r * mi, K.blue, 0, 0.2 * r);
  if (pl > 0.02) { box(x, y, 2 * r * pl, 0.62 * r * pl, K.red, 0, 0.2 * r); box(x, y, 0.62 * r * pl, 2 * r * pl, K.red, 0, 0.2 * r); }
}
const MG = {};                                                     // the magnet's pose for this frame: its prongs (hero px), where it stands, its scale
// where a prong (lo: the bottom one) is in the stage when the magnet has turned as it does at time tt, written to out
function prong(lo, tt, out) { const q = toStage(MG.tipX, lo ? MG.tipY1 : MG.tipY0, MG.bx, MG.by, MG.sc, sway(tt)); out[0] = q[0]; out[1] = q[1]; }
// where a bit sits on its prong: ang round it, rad out from it
function perch(lo, ang, rad, tt, out) { prong(lo, tt, out); out[0] += C(ang + sway(tt)) * rad; out[1] += S(ang + sway(tt)) * rad; }

function magnetScene(look) {
  const size = (u, h, w) => Math.min(1.2 + 0.5 * Math.max(0, h / w - 1), 0.66 * h / (1.09 * u));   // bigger on a tall screen
  const stand = (w, h) => lerp(0.2, 0.09, sat((h / w - 0.8) / 0.8)) * w;                          // how far off the middle it stands: nearer on a tall screen
  return {
    flip: look.dir, color: look.color, bg: look.bg, dur: 2.9,
    back(a, t) {                                                    // field rings: they close in on the mouth, then the flip sends them out again
      const { u, k, w, h } = a, f = a.flip, R = 0.7 * w, ph = -0.55 * Math.min(t, TF) + 1.3 * Math.max(0, t - TF), mx = -f * stand(w, h) + f * 8.5 * k * size(u, h, w);
      for (let j = 0; j < 7; j++) { const q = frac(j / 7 + ph); ring(mx, 0, R * q * pop(t, 0.02, 0.4), u * 0.05 * S(q * PI) + 1, look.rings[j & 1]); }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, f = a.flip, s = size(u, h, w), sc = s * a.hs, Ub = Math.min(u, w * 0.6), z = 0.08 * Ub, n = a.n(12), ak = a.ak, c = raw();
      const pp = g.strokes[0].p, tipX = gx(g, k, pp[0]), tipY0 = gy(k, pp[1]), tipY1 = gy(k, pp[pp.length - 1]), rot = sway(t), tk = Math.floor(t * 14);
      MG.tipX = tipX; MG.tipY0 = tipY0; MG.tipY1 = tipY1; MG.bx = -f * stand(w, h); MG.by = 0; MG.sc = sc;
      const T0 = [0, 0], T1 = [0, 0], here = [0, 0], gone = [0, 0], shine = (x, y) => { P.x = x - 4.5; P.y = y; }; prong(0, t, T0); prong(1, t, T1);
      // the magnet: red, with silver prongs marked + and -, which swap at the flip
      a.begin(MG.bx, 0, s * pop(t, 0.02, 0.3), rot, 1 + 0.1 * wob(t - TF, 6, 6), 1 - 0.08 * wob(t - TF, 6, 6));
      glyph(g, k, { color: look.color });
      if (ak > 0.02) {
        const tipCol = t > TF && t < TF + 0.18 ? K.yellow : SILVER, bxg = tipX - f * 12.4 * k, out = unpop(t, TF - 0.08, 0.1), inn = pop(t, TF + 0.02, 0.3), sx = tipX - f * 3 * k;
        glyphInk(g, k, { t0: 0.14, t1: 0.86, fn: shine }, look.shine, 3.6 * ak, null);                                            // a highlight down the lit (left) side of the spine
        glyphInk(g, k, { t1: 0.1 * ak }, tipCol, 17, null, 'butt'); glyphInk(g, k, { t0: 1 - 0.1 * ak }, tipCol, 17, null, 'butt');
        disc(tipX, tipY0, 8.5 * k * ak, tipCol); disc(tipX, tipY1, 8.5 * k * ak, tipCol);
        for (const ty of [tipY0, tipY1]) line(bxg, ty - 8.5 * k * ak, bxg, ty + 8.5 * k * ak, 3 * k * ak, K.ink);
        pole(sx, tipY0, 5.5 * k * ak, out, inn); pole(sx, tipY1, 5.5 * k * ak, inn, out);
      }
      a.end();
      // the arc across the mouth, and the flip's burst
      if (t > 0.3 && t < TF && hash(1, tk, 9) < 0.8) { crackle(T0[0], T0[1], T1[0], T1[1], 5, t, 0.16 * Ub, 6.5 * k, K.ink); crackle(T0[0], T0[1], T1[0], T1[1], 5, t, 0.16 * Ub, 3.4 * k, K.white); }
      const mx = (T0[0] + T1[0]) / 2, my = (T0[1] + T1[1]) / 2, fp = seg(t, TF, TF + 0.4);
      pulse(mx, my, t, TF, 0.5, 0.9 * Ub, 0.06 * Ub, K.white); pulse(mx, my, t, TF + 0.06, 0.6, 1.4 * Ub, 0.04 * Ub, look.color);
      if (fp > 0 && fp < 1) { const r = 0.55 * Ub * E.outBack(sat(fp * 2.5)) * (1 - fp * 0.6); star(mx, my, r, 10, r * 0.55, fp * 2, K.yellow); star(mx, my, r * 0.62, 10, r * 0.34, -fp * 2, K.white); }
      spray(a, t, { x: mx, y: my, n: a.n(24), t0: TB, life: 1.0, v0: u * 0.8, v1: u * 2.4, a0: f > 0 ? -1.3 : PI - 1.3, a1: f > 0 ? 1.3 : PI + 1.3, seed: 300, cols: look.cols });
      for (let i = 0; i < 6; i++) {                                 // pluses and minuses blown out of the mouth
        const age = t - TB - 0.02 * i;
        if (age <= 0 || age >= 0.9) continue;
        const dir = (f > 0 ? 0 : PI) + (i - 2.5) * 0.42, dist = 0.9 * u * (1 - Math.exp(-3 * age)), r = 0.05 * u * (1 - seg(age, 0.6, 0.9));
        pole(mx + C(dir) * dist, my + S(dir) * dist + 0.3 * u * age * age, r, i & 1, 1 - (i & 1));
      }
      // the bits
      for (let i = 0; i < n; i++) {
        const L0 = 0.3 + 0.7 * i / n, lo = i & 1, [ad, rd] = SLOTS[(i >> 1) % SLOTS.length], col = look.cols[i % look.cols.length], tx = lo ? T1[0] : T0[0], ty = lo ? T1[1] : T0[1];
        const ang = (f > 0 ? ad : 180 - ad) * (lo ? -1 : 1) * PI / 180, rad = 8.5 * k * sc + z * 0.9 * rd + 4 * k;
        const sx = f * (0.02 + 0.4 * frac(0.5 + i * KEY[0])) * w, sy = (frac(0.5 + i * KEY[1]) - 0.5) * 0.85 * h;
        const p = seg(t, L0, L0 + FL), pe = p ** 2.2, wind = seg(t, L0 - 0.25, L0);
        let x, y, r = a.r(i, 3) * TAU, zz = z * pop(t, 0.05 + i * 0.03, 0.4);
        perch(lo, ang, rad, t, here);
        if (p < 1) {                                                // waiting, shivering, then off along a curve that quickens as it nears
          const bow = (i & 2 ? 1 : -1) * 0.32, sh = 5 * k * wind * (1 - p);
          curve(sx, sy, here[0], here[1], bow, pe);
          x = V[0] + sh * S(t * 61 + i); y = V[1] + sh * C(t * 53 + i) + (1 - wind) * 5 * k * S(t * 3 + i); r += 0.6 * S(t * 3 + i) + pe * 5;
          if (p > 0 && t < TB) { curve(sx, sy, here[0], here[1], bow, Math.max(0, pe - 0.12)); line(x, y, V[0], V[1], 4 * k, K.white); }
        } else { x = here[0]; y = here[1]; r = ang + PI / 2 + rot; zz *= 1 + 0.35 * wob(t - L0 - FL, 4, 8); }
        if (t < TF && p > 0.3 && hash(i, tk, 8) < 0.8) {            // sparks jump from the prong to the bit
          crackle(tx, ty, x, y, i * 17, t, 0.05 * Ub, 4.6 * k, K.ink); crackle(tx, ty, x, y, i * 17, t, 0.05 * Ub, 2.4 * k, K.yellow);
        }
        if (t > TB) {                                               // the blast: away from the prongs, spinning
          perch(lo, ang, rad, TB, gone);
          const age = t - TB, dir = (f > 0 ? 0 : PI) + (a.r(i, 5) - 0.5) * 1.7, dist = (0.55 + 0.6 * a.r(i, 6)) * 1.1 * w * (1 - Math.exp(-3.5 * age));
          x = gone[0] + C(dir) * dist; y = gone[1] + S(dir) * dist + 260 * k * age * age; r += age * 18 * (a.r(i, 7) - 0.5);
          line(x, y, x - C(dir) * dist * 0.25, y - S(dir) * dist * 0.25, 4 * k, K.white);
        }
        if (zz > 0.5) { c.save(); c.translate(x, y); c.rotate(r); look.bits[i % 4](zz, r * 1.7, col); c.restore(); }
      }
      twinkle(a, t, 10, 0.4, [K.white, K.yellow], 400);
    },
  };
}

/* ---------- { and }: the curly brace on its side is a big handlebar moustache that twirls on a face: a gentleman and a cowboy ---------- */
// The faces are drawn in glyph units round the moustache's centre (y down); vs stretches them upward on tall screens.
function eyeO(x, y, r, lx, ly, sq) {
  const c = raw(); c.save(); c.translate(x, y); c.scale(1, Math.max(0.05, sq));
  discO(0, 0, r, K.white, 2.4); disc(lx * r * 0.42, ly * r * 0.42, r * 0.5, K.ink); disc(lx * r * 0.42 - r * 0.14, ly * r * 0.42 - r * 0.16, r * 0.14, K.white);
  c.restore();
}
function face(t, vs, look) {
  const pf = pop(t, 0.34, 0.4), pe = pop(t, 0.5, 0.4), blush = 1 + 0.12 * S(t * 7), cy = -30 * vs, ey = cy - 12 * vs;
  if (pf < 0.02) return;
  ovalO(-52 * pf, cy + 2, 8 * pf, 12 * pf, look.skin, 0, 3); ovalO(52 * pf, cy + 2, 8 * pf, 12 * pf, look.skin, 0, 3);
  ovalO(0, cy, 52 * pf, 48 * vs * pf, look.skin, 0, 3.4);
  disc(-36 * pf, cy + 12 * vs, 9 * pf * blush, look.blush); disc(36 * pf, cy + 12 * vs, 9 * pf * blush, look.blush);
  ovalO(0, cy + 10 * vs, 9 * pf, 7 * pf, look.nose, 0, 2.4);
  if (pe < 0.02) return;
  const lx = 0.7 * C(t * 2.3), ly = 0.5 * S(t * 3.3), sq = (t % 1.3 < 0.1 ? 0.12 : 1) * look.squint, wg = seg(t, 0.85, 1.05) * (1 - seg(t, 2.1, 2.3)), tilt = look.fierce * 4;
  for (let sd = -1; sd <= 1; sd += 2) {
    eyeO(sd * 19, ey, 12 * pe, lx, ly, sq);
    const by = ey - 17 * vs * pe - 8 * wg * S(t * 11 + (sd > 0 ? PI : 0));                 // the brows waggle in turn
    line(sd * 31, by - tilt, sd * 7, by + tilt, 5.6, K.ink);
  }
}
function topHat(t, vs, lift, plunk) {                                // the gentleman's hat, which can lift off (lift 0..1) and drop in, and his bow tie
  const c = raw();
  c.save(); c.translate(0, -76 * vs - 22 * lift + plunk); c.rotate(0.3 * lift);
  boxO(0, -19, 46, 38, K.black, 0, 5, 2.6); box(0, -6, 46, 10, K.red); box(-14, -22, 5, 20, K.indigoD, 0, 2.5); ovalO(0, 0, 60, 9, K.black, 0, 2.6);
  c.restore();
  const y = 16 * vs + 22, p = pop(t, 0.7, 0.4);
  if (p < 0.02) return;
  polyO([0, y, -22 * p, y - 12 * p, -22 * p, y + 12 * p], K.red, 2.4); polyO([0, y, 22 * p, y - 12 * p, 22 * p, y + 12 * p], K.red, 2.4); discO(0, y, 5.5 * p, K.redD, 2.2);
}
function monocle(t, vs) {
  const y = -42 * vs, p = pop(t, 0.85, 0.35);
  if (p < 0.02) return;
  const chain = [24 + 10 * p, y + 11 * p, 44, -20 * vs, 40, 16 * vs + 6];
  pline(chain, 4.2, K.ink); pline(chain, 1.8, K.yellow); ring(19, y, 15 * p, 6, K.ink); ring(19, y, 15 * p, 2.6, K.yellow);
}
const BRIM = [-84, -9, -56, 2, -28, 7, 0, 8, 28, 7, 56, 2, 84, -9];  // the cowboy hat's brim, curling up at the ends
function cowboyHat(t, vs, lift, plunk, bs) {                         // bs narrows the brim on a narrow screen
  const c = raw();
  c.save(); c.translate(0, -76 * vs - 22 * lift + plunk); c.rotate(-0.35 * lift);
  boxO(0, -21, 48, 42, K.orangeD, 0, 14, 2.6); box(0, -6, 48, 9, K.yellow); pline([-15, -37, 0, -28, 15, -37], 3.4, K.ink);
  c.scale(bs, 1); pline(BRIM, 20, K.ink); pline(BRIM, 14.4, K.orangeD);
  c.restore();
}
const DOTS = [-30, 6, 30, 6, 0, 8, -12, 24, 12, 24, 0, 36];         // the bandana's polka dots
function bandana(t, vs) {
  const y = 8 * vs, p = pop(t, 0.34, 0.4), c = raw();
  if (p < 0.02) return;
  c.save(); c.translate(0, y); c.scale(p, p);
  polyO([-54, -4, 54, -4, 0, 46], K.blue, 2.8);
  for (let i = 0; i < DOTS.length; i += 2) disc(DOTS[i], DOTS[i + 1], 3.2, K.white);
  c.restore();
}
function straw(t) {                                                 // a stalk of straw in the cowboy's mouth
  const p = pop(t, 0.9, 0.3);
  if (p < 0.02) return;
  line(4, 20, 4 + 32 * p, 20 + 14 * p, 4.6, K.ink); line(4, 20, 4 + 32 * p, 20 + 14 * p, 2, K.yellow);
}
// the curl at each end of the moustache: a spiral carrying on from the end of the brace. pass 0 is its dark outline, 1 its fill
function curls(g, k, f, wag, ak, col, pass) {
  const p = g.strokes[0].p, n = p.length, R = 13 * ak;
  for (let e = 0; e < 2; e++) {
    const ex = (e ? p[n - 2] : p[0]) + f * wag, ey = e ? p[n - 1] : p[1], sd = e ? -1 : 1, cy = ey + sd * R, pts = [];       // the top end curls down, the bottom end up
    for (let i = 0; i <= 30; i++) {
      const q = i / 30, an = sd * (-PI / 2 + f * q * 7.2), r = R * (1 - 0.6 * q);
      pts.push(gx(g, k, ex + C(an) * r), gy(k, cy + S(an) * r));
    }
    pline(pts, (pass ? 7.5 : 14.3) * k * ak, pass ? col : K.ink);
  }
}
// a tumbleweed: a tangle of rings and chords, turning by rot
function tumbleweed(x, y, r, rot, ol) {
  const c = raw();
  for (let pass = 0; pass < 2; pass++) {
    const lw = r * 0.13 + (pass ? 0 : ol * 2), col = pass ? K.orangeD : K.ink;
    ring(x, y, r, lw, col); ring(x, y, r * 0.55, lw * 0.8, col);
    c.strokeStyle = col; c.lineWidth = lw * 0.8; c.lineCap = 'round'; c.beginPath();
    for (let i = 0; i < 3; i++) { const a = rot + i * 1.05; c.moveTo(x + C(a) * r, y + S(a) * r); c.lineTo(x - C(a) * r, y - S(a) * r); }
    c.stroke();
  }
}

function mustacheScene(look) {
  return {
    flip: look.dir, color: look.color, bg: look.bg, dur: 2.9,
    back: look.back,
    draw(a, t) {
      const { u, k, g, w, h } = a, f = a.flip, vs = clamp(0.35 + 0.7 * h / w, 1, 1.7), M = Math.min(0.9 * w / 124, 0.86 * h / (90 * vs + 100)), s = M / (k * a.hs);
      const mx = 0, my = (29 * vs + 15) * M, ak = a.ak, c = raw();
      const lift = S(PI * seg(t, 1.85, 2.25)), plunk = -260 * (1 - E.outBounce(seg(t, 0.6, 1.05)));
      const tw = seg(t, 1.2, 1.75), twirl = f * TAU * E.io(tw), wag = 7 * S(t * 10) * seg(t, 0.85, 1.05) * (1 - seg(t, 2.1, 2.3));
      spray(a, t, { x: mx, y: my - 60 * M * vs, n: a.n(22), t0: 2.0, life: 1.1, v0: u * 0.7, v1: u * 1.8, seed: 200, cols: look.confetti });
      if (ak > 0.02) { c.save(); c.translate(mx, my); c.scale(M * ak, M * ak); look.behind(t, vs); face(t, vs, look); look.hat(t, vs, lift, plunk, Math.min(1, (0.5 * w / M - 6) / 84)); c.restore(); }
      // the moustache is the glyph turned on its side: it pops in upright, tips over into place, wags its curls and twirls
      const stand = (dx, dy) => a.begin(mx + dx, my + dy, s * pop(t, 0.02, 0.3), -f * PI / 2 * E.outBack(seg(t, 0.28, 0.7)) + twirl, 1 + 0.16 * S(PI * tw), 1 - 0.1 * S(PI * tw));
      const warp = (x, y) => { const q = Math.abs((y - 50) / 46); P.x = x + f * wag * q * q * q; P.y = y; }, sh = 4.6 * k * s * (1 - a.land);
      stand(sh, sh * 1.1);                                          // first its hard shadow, kept falling down and right whichever way it turns
      if (ak > 0.02) curls(g, k, f, wag, ak, K.ink, 0);
      glyph(g, k, { color: K.ink, sh: 0, fn: warp });
      a.end(); stand(0, 0);
      if (ak > 0.02) curls(g, k, f, wag, ak, K.ink, 0);
      glyph(g, k, { color: look.color, sh: 4.6 * k * a.land, fn: warp });
      if (ak > 0.02) curls(g, k, f, wag, ak, look.color, 1);
      a.end();
      if (ak > 0.02) { c.save(); c.translate(mx, my); c.scale(M * ak, M * ak); look.front(t, vs); c.restore(); }
      look.extras(a, t);
      twinkle(a, t, 10, 0.9, [K.white, K.yellow, K.pink], 410);
      if (tw > 0 && tw < 1) for (let j = 0; j < 2; j++) arcS(mx, my, 66 * M, twirl + j * PI, twirl + j * PI + 1.1, 5 * k * S(PI * tw), K.white);
    },
  };
}
const GENTLEMAN = {
  dir: 1, color: K.orangeD, bg: K.purple, skin: K.orangeL, blush: K.pinkM, nose: K.orange, squint: 1, fierce: -0.4, confetti: [K.yellow, K.white, K.pink, K.sky],
  back(a, t) {                                                      // wallpaper stripes drifting, and a spotlight
    const { u, h } = a, R = Math.hypot(a.bw, a.bh) / 2, step = u * 0.44, c = raw();
    c.save(); c.rotate(-0.5);
    for (let i = -14; i <= 14; i += 2) box(i * step + (t * u * 0.12) % (2 * step), 0, step, R * 2, K.purpleD);
    c.restore();
    disc(0, 0.04 * h, 0.5 * h * pop(t, 0.05, 0.5), K.purpleL); disc(0, 0.04 * h, 0.4 * h * pop(t, 0.12, 0.5), K.purpleM);
  },
  behind() {},
  hat: topHat,
  front: monocle,
  extras() {},
};
const COWBOY = {
  dir: -1, color: K.red, bg: K.yellow, skin: K.orangeL, blush: K.red, nose: K.orangeD, squint: 0.55, fierce: 0.8, confetti: [K.yellow, K.white, K.red, K.orangeD],
  back(a, t) {                                                      // a big sun behind him, dunes, and a cactus either side
    const { u, w, h } = a;
    rays(0, 0.02 * h, 16, Math.hypot(a.bw, a.bh) / 2, t * 0.25, K.orange, 0.5);
    disc(0, 0.02 * h, 0.5 * h * pop(t, 0.05, 0.5), K.orange); disc(0, 0.02 * h, 0.4 * h * pop(t, 0.12, 0.5), K.yellowL);
    band(-a.bw / 2, a.bw / 2, 0.3 * h, 0.02 * h, w * 0.8, 1, K.orangeD, a.bh);
    for (const sd of [-1, 1]) {
      const x = sd * w * 0.4, y = 0.3 * h, gr = pop(t, 0.15 + (sd > 0 ? 0.1 : 0), 0.5), tall = 0.36 * u * gr, wd = 0.07 * u;
      box(x, y - tall / 2 + 10, wd, tall, K.green, 0, wd / 2);
      box(x - sd * wd * 1.2, y - tall * 0.5, wd * 1.5, wd * 0.8, K.green, 0, wd * 0.4); box(x - sd * wd * 1.75, y - tall * 0.5 - wd * 0.9, wd * 0.8, wd * 1.8, K.green, 0, wd * 0.4);
      box(x + sd * wd * 1.1, y - tall * 0.3, wd * 1.4, wd * 0.8, K.green, 0, wd * 0.4); box(x + sd * wd * 1.6, y - tall * 0.3 - wd * 0.8, wd * 0.8, wd * 1.6, K.green, 0, wd * 0.4);
    }
  },
  behind: bandana,
  hat: cowboyHat,
  front: straw,
  extras(a, t) {                                                    // a tumbleweed bounces across the dunes
    const { u, w, h } = a, r = 0.1 * u, x = lerp(-0.62 * w, 0.62 * w, seg(t, 0.4, 2.3));
    tumbleweed(x, 0.3 * h - r - hop(t - 0.4, 0.42, 0.09 * u, 0.9), r, x / r, 3);
  },
};

/* ---------- / : a playground slide (the ramp is the glyph): balls and little kids whoosh down it and splash into the pool ---------- */
const LY = {};                                                     // the slide's layout for this frame, shared by back() and draw()
function slideLayout(a) {
  const { u, k, g, w, h } = a, rot = lerp(0.3, 0.08, sat((h / w - 0.7) / 1)), reach = 35.5 * C(rot) + 88 * S(rot);      // steeper on a tall screen, so it can be bigger
  const s = Math.min(1.5, 0.72 * h / (88 * k), (0.65 * w - 0.46 * u) / (reach * k)), sc = s * a.hs, yg = 0.3 * h;
  const bx = 0.5 * w - (0.5 * reach * k * sc + 0.46 * u), b0 = toStage(gx(g, k, 8.5), gy(k, 94), 0, 0, sc, rot), by = yg - 0.05 * h - b0[1];
  const b = toStage(gx(g, k, 8.5), gy(k, 94), bx, by, sc, rot); LY.bx = bx; LY.by = by; LY.bX = b[0]; LY.bY = b[1];         // the ramp's foot,
  const q = toStage(gx(g, k, 44), gy(k, 6), bx, by, sc, rot); LY.tX = q[0]; LY.tY = q[1];                                   // and its top
  LY.s = s; LY.sc = sc; LY.rot = rot; LY.yg = yg; LY.yp = yg + 0.012 * h; LY.xe = LY.bX - 0.03 * u;                          // the deck, the water and the pool's edge
  const dx = LY.bX - LY.tX, dy = LY.bY - LY.tY, L = Math.hypot(dx, dy);
  LY.L = L; LY.dx = dx / L; LY.dy = dy / L; LY.off = 8.5 * k * sc + 2 * k;                                                   // the ramp's length, downhill direction, and its surface above the stroke's middle
  return LY;
}
// a kid sitting on the ground line y = 0 facing left, z px per unit, leaning back and waving both arms
function kid(z, shirt, hair, skin, pants, wave) {
  const c = raw();
  line(0.1 * z, -0.4 * z, -1.9 * z, -0.4 * z, 1.25 * z, K.ink); line(0.1 * z, -0.4 * z, -1.9 * z, -0.4 * z, 0.93 * z, pants);
  ovalO(-2.2 * z, -0.45 * z, 0.55 * z, 0.38 * z, K.white, 0, 0.16 * z);
  c.save(); c.translate(0.1 * z, -0.4 * z); c.rotate(0.4);
  ovalO(0, -1.0 * z, 0.85 * z, 1.15 * z, shirt, 0, 0.16 * z);
  for (let sd = -1; sd <= 1; sd += 2) {
    const hx = sd * 1.75 * z + 0.2 * z * S(wave + sd), hy = -4.1 * z - 0.2 * z * C(wave * 1.3 + sd);
    line(0, -1.6 * z, hx, hy, 0.85 * z, K.ink); line(0, -1.6 * z, hx, hy, 0.5 * z, skin); disc(hx, hy, 0.4 * z, skin);
  }
  discO(0, -2.55 * z, 0.9 * z, skin, 0.16 * z); pie(0, -2.55 * z, 0.9 * z, PI, TAU, hair); disc(-0.35 * z, -2.55 * z, 0.13 * z, K.ink); arcS(-0.25 * z, -2.1 * z, 0.25 * z, 0.1 * PI, 0.9 * PI, 0.13 * z, K.ink);
  c.restore();
}
// a beach ball, turned by rot
function beach(z, rot, cols) {
  discO(0, 0, z, K.white, 0.16 * z);
  for (let i = 0; i < 3; i++) pie(0, 0, z, rot + i * TAU / 3, rot + i * TAU / 3 + TAU / 6, cols[i]);
  disc(0, 0, z * 0.2, cols[0]);
}
// a swimmer's head and waving arms, poking out of the water at (0, 0)
function swimmer(z, hair, skin, wave) {
  for (let sd = -1; sd <= 1; sd += 2) {
    const hx = sd * 1.5 * z + 0.2 * z * S(wave + sd), hy = -1.9 * z - 0.2 * z * C(wave * 1.3 + sd);
    line(sd * 0.8 * z, -0.2 * z, hx, hy, 0.85 * z, K.ink); line(sd * 0.8 * z, -0.2 * z, hx, hy, 0.5 * z, skin); disc(hx, hy, 0.4 * z, skin);
  }
  discO(0, -0.9 * z, 0.9 * z, skin, 0.16 * z); pie(0, -0.9 * z, 0.9 * z, PI, TAU, hair); disc(-0.3 * z, -0.85 * z, 0.13 * z, K.ink); disc(0.3 * z, -0.85 * z, 0.13 * z, K.ink);
}
function duck(z, rot) {
  const c = raw(); c.save(); c.rotate(rot);
  ovalO(0, 0, 1.4 * z, 0.95 * z, K.yellow, 0, 0.2 * z); discO(1.15 * z, -1.0 * z, 0.7 * z, K.yellow, 0.2 * z); polyO([1.75 * z, -1.05 * z, 2.5 * z, -0.85 * z, 1.75 * z, -0.6 * z], K.orange, 0.2 * z);
  disc(1.3 * z, -1.2 * z, 0.13 * z, K.ink); arcS(-0.2 * z, 0.05 * z, 0.6 * z, 0.1 * PI, 0.9 * PI, 0.22 * z, K.orange);
  c.restore();
}
function tube(x, y, r, col) {                                       // a swim ring floating, seen from the side
  const c = raw(); c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) { c.strokeStyle = pass ? col : K.ink; c.lineWidth = r * 0.55 + (pass ? 0 : r * 0.24); c.beginPath(); c.ellipse(x, y, r, r * 0.45, 0, 0, TAU); c.stroke(); }
  c.strokeStyle = K.white; c.lineWidth = r * 0.55; c.beginPath();
  for (let i = 0; i < 4; i++) { c.moveTo(x + C(i * PI / 2 + 0.3) * r, y + S(i * PI / 2 + 0.3) * r * 0.45); c.ellipse(x, y, r, r * 0.45, 0, i * PI / 2 + 0.3, i * PI / 2 + 0.75); }
  c.stroke();
}
function ripple(x, y, r, lw, col) { const c = raw(); c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(x, y, Math.max(1, r), Math.max(0.5, r * 0.22), 0, 0, TAU); c.stroke(); }
const SPLASH = [K.white, K.skyL, K.sky];                            // the colours of water
const SHIRT = [K.pink, K.lime, K.white, K.orange, K.violet, K.sky], HAIR = [K.ink, K.red, K.yellow, K.orangeD], SKIN = [K.orangeL, K.orangeD, K.cream, K.orangeM];
const BALLS = [[K.red, K.blue, K.yellow], [K.pink, K.lime, K.violet], [K.orange, K.sky, K.red], [K.green, K.yellow, K.pink]];

const RD = {};                                                     // one rider's state at this moment, filled by rider()
// Rider i of n: down the ramp, off its foot in an arc, and into the water at RD.xl at time RD.tl. Even riders are balls, the last one a big kid.
function rider(a, ly, i, n, t) {
  const { u, k } = a, big = i === n - 1, ball = i % 2 === 0 && !big, zz = 0.07 * u * (big ? 1.5 : 1), L0 = 0.55 + 1.2 * i / n, dur = 0.42, tau = t - L0;
  const nx = -ly.dy, ny = ly.dx, off = ly.off + (ball ? zz : 0.15 * zz), vel = 1.7 * ly.L / dur * (0.6 + 0.8 * a.r(i, 1)), vx = ly.dx * vel, vy = ly.dy * vel;
  const bx = ly.bX + nx * off, by = ly.bY + ny * off, g2 = 650 * k, tf = (-vy + Math.sqrt(vy * vy + 2 * g2 * Math.max(1, ly.yp - by))) / g2;
  RD.big = big; RD.ball = ball; RD.zz = zz; RD.tau = tau; RD.dur = dur; RD.L0 = L0; RD.tl = L0 + dur + tf; RD.xl = bx + vx * tf;
  let x, y, rot = Math.atan2(-ly.dy, -ly.dx);
  if (tau < dur) { const p = Math.pow(sat(tau / dur), 1.7); x = ly.tX + nx * off + ly.dx * ly.L * p; y = ly.tY + ny * off + ly.dy * ly.L * p; }
  else { const q = tau - dur; x = bx + vx * q; y = by + vy * q + 0.5 * g2 * q * q; rot += q * (ball ? 6 : 7) * (i & 2 ? 1 : -1); }
  RD.x = x; RD.y = y; RD.rot = rot;
  return RD;
}

const SLIDE = {
  color: K.yellow, bg: K.magenta, dur: 2.8,
  back(a, t) {                                                      // rays, clouds, the deck and the pool
    const { u, k, w, h } = a, ly = slideLayout(a), x0 = -a.bw / 2, wat = pop(t, 0.05, 0.4), c = raw(), sp = 0.24 * u, off = (t * u * 0.05) % sp;
    c.fillStyle = K.magentaM; c.beginPath();                        // big polka dots drifting across the sky
    for (let row = 0, y = -a.bh / 2; y < ly.yg; row++, y += sp * 0.866) for (let x = x0 + (row & 1 ? sp / 2 : 0) + off; x < a.bw / 2; x += sp) addDisc(x, y, 0.075 * u * pop(t, 0.05 + row * 0.03, 0.4));
    c.fill();
    for (let i = 0; i < 3; i++) cloud(((-0.3 + i * 0.4) * w - t * u * 0.1 + w * 1.4) % (w * 1.2) - w * 0.6, -h * (0.32 - i * 0.04), u * (0.14 + i * 0.03), K.white);
    box(0, (ly.yg + a.bh / 2) / 2, a.bw, a.bh / 2 - ly.yg, K.magentaD); box(0, ly.yg + 0.012 * h, a.bw, 0.024 * h, K.cream);
    box((x0 + ly.xe) / 2, ly.yp + (a.bh / 2 - ly.yp) / 2 * wat, ly.xe - x0, (a.bh / 2 - ly.yp) * wat, K.sky);
    if (wat > 0.02) for (let j = 0; j < 4; j++) wave(x0, ly.xe, ly.yp + (0.05 + j * 0.05) * h * wat, 5 * k, 90 * k, t * 2 + j * 1.7, 4 * k, K.skyL);
  },
  draw(a, t) {
    const { u, k, g, h } = a, ly = slideLayout(a), n = a.n(8), c = raw(), rise = pop(t, 0.12, 0.45), yg = ly.yg, yp = ly.yp;
    // the platform, its posts and the ladder
    const py = ly.tY + 0.05 * u, ax = ly.tX + 0.26 * u, fx = ax + 0.1 * u, rw = 0.075 * u;
    if (rise > 0.02) {
      for (const x of [ly.tX + 0.02 * u, ly.tX + 0.2 * u]) { line(x, py, x, py + (yg - py) * rise, 9 * k, K.ink); line(x, py, x, py + (yg - py) * rise, 5 * k, K.cream); }
      for (const o of [0, rw]) { line(ax + o, py, lerp(ax, fx, rise) + o, py + (yg - py) * rise, 9 * k, K.ink); line(ax + o, py, lerp(ax, fx, rise) + o, py + (yg - py) * rise, 5 * k, K.cream); }
      c.strokeStyle = K.ink; c.lineWidth = 6 * k; c.lineCap = 'round'; c.beginPath();
      for (let i = 1; i < 7; i++) { const q = i / 7 * rise, y = py + (yg - py) * q, x = lerp(ax, fx, q); c.moveTo(x, y); c.lineTo(x + rw, y); }
      c.stroke(); c.strokeStyle = K.cream; c.lineWidth = 2.6 * k; c.stroke();
      boxO(ly.tX + 0.11 * u, py, 0.36 * u * rise, 0.05 * u, K.cream, 0, 0.02 * u, 3 * k);
    }
    // the ramp: it pops in upright and tips into place, with rollers across it
    a.begin(ly.bx, ly.by, ly.s * pop(t, 0.02, 0.3), ly.rot * E.outBack(seg(t, 0.15, 0.5)), 1, 1);
    glyph(g, k, { color: K.yellow });
    if (a.ak > 0.02) glyphInk(g, k, {}, K.orange, 13 * a.ak, [3.5, 12], 'butt');
    a.end();
    // the riders on the ramp and in the air, and the ones afloat
    for (let i = 0; i < n; i++) {
      const r = rider(a, ly, i, n, t), zz = r.zz, dx = ly.dx, dy = ly.dy, shirt = SHIRT[i % SHIRT.length], hair = HAIR[i % HAIR.length], skin = SKIN[i % SKIN.length];
      if (t < r.tl && r.tau > -0.3) {
        if (r.tau > 0 && r.tau < r.dur) for (let j = 0; j < 2; j++) {   // speed lines
          const d0 = zz * (2 + j * 1.5), d1 = zz * (4.5 + j * 2), sy = (j - 0.5) * zz * 1.5;
          line(r.x - dx * d0, r.y - dy * d0 + sy, r.x - dx * d1, r.y - dy * d1 + sy, 0.35 * zz, K.white);
        }
        const pp = pop(t, r.L0 - 0.25, 0.3);
        c.save(); c.translate(r.x, r.y); c.rotate(r.rot); c.scale(pp, pp);
        if (r.ball) beach(zz, r.tau * 9, BALLS[(i >> 1) % 4]); else kid(zz, shirt, hair, skin, K.blueD, t * 12 + i);
        c.restore();
      }
      const age = t - r.tl, x2 = r.xl - 0.4 * u * (0.2 + 0.8 * a.r(i, 2)) * E.out(seg(age, 0, 1.4)), em = pop(t, r.tl + 0.3, 0.35);
      if (age > 0 && r.ball) { c.save(); c.translate(x2, yp - zz * 0.35 - hop(age, 0.55, 0.28 * u, 0.3) + 0.05 * zz * S(t * 4 + i)); beach(zz, age * 2 + i, BALLS[(i >> 1) % 4]); c.restore(); }
      if (age > 0 && !r.ball && em > 0.02) { c.save(); c.translate(x2, yp + zz * 0.5 * (1 - em)); c.scale(em, em); swimmer(zz, hair, skin, t * 9 + i); c.restore(); }
    }
    const pw = ly.xe + a.w / 2, fl = pop(t, 0.5, 0.4);              // a duck and a swim ring float about
    if (fl > 0.02) {
      c.save(); c.translate(-a.w / 2 + 0.55 * pw, yp - 0.03 * u + 0.012 * u * S(t * 3)); c.scale(fl, fl); duck(0.05 * u, 0.08 * S(t * 2.4)); c.restore();
      tube(-a.w / 2 + 0.2 * pw, yp + 0.02 * u + 0.012 * u * S(t * 2.6 + 1), 0.1 * u * fl, K.red);
    }
    // the water in front, hiding whatever has gone under; then the splashes on top of it
    band(-a.bw / 2, ly.xe, yp + 0.01 * h, 4 * k, 120 * k, t * 3, K.sky, yp + 0.09 * h); wave(-a.bw / 2, ly.xe, yp + 0.01 * h, 4 * k, 120 * k, t * 3, 5 * k, K.skyL);
    for (let i = 0; i < n; i++) {
      const r = rider(a, ly, i, n, t), zz = r.zz, age = t - r.tl, sz = r.big ? 1.6 : 1;
      if (age <= 0) continue;
      spray(a, t, { x: r.xl, y: yp, n: a.n(r.big ? 22 : 12), t0: r.tl, life: 0.9, a0: -PI * 0.92, a1: -PI * 0.08, v0: u * 0.5 * sz, v1: u * 1.5 * sz, g: 1800, s0: 6, s1: 13, shape: 'dot', seed: 500 + i * 40, cols: SPLASH });
      for (let j = 0; j < 5 && age < 0.45; j++) {                   // a crown of drops
        const an = -PI * (0.18 + 0.16 * j), rr = zz * 3 * E.out(seg(age, 0, 0.3)) * sz, sd = zz * 0.38 * (1 - age * 2.2) * sz;
        if (sd > 0) drop(r.xl + C(an) * rr, yp + S(an) * rr * 1.6, sd, an + PI / 2, K.white);
      }
      for (let j = 0; j < 2; j++) { const q = seg(age, j * 0.12, 0.9 + j * 0.12); if (q > 0 && q < 1) ripple(r.xl, yp + 6 * k, zz * (1 + 6 * q) * sz, 4 * k * (1 - q), K.white); }
    }
  },
};

/* ---------- \ : a ski hill (the glyph is the piste): a skier slaloms down it between gates, jumping, in a cloud of snow ---------- */
const SKI = {};                                                    // the hill's layout for this frame, shared by back() and draw()
const SNOW = [K.white, K.skyL];
function skiLayout(a) {
  const { k, g, w, h } = a, rot = -lerp(0.3, 0.1, sat((h / w - 0.7) / 1)), reach = 35.5 * C(rot) + 88 * Math.abs(S(rot));
  const s = Math.min(1.5, 0.72 * h / (88 * k), 0.75 * w / (reach * k)), sc = s * a.hs, bx = -0.06 * w, by = 0.01 * h;
  const t0 = toStage(gx(g, k, 8.5), gy(k, 6), bx, by, sc, rot); SKI.tX = t0[0]; SKI.tY = t0[1];               // the top of the run
  const b0 = toStage(gx(g, k, 44), gy(k, 94), bx, by, sc, rot); SKI.bX = b0[0]; SKI.bY = b0[1];               // and its foot
  const dx = SKI.bX - SKI.tX, dy = SKI.bY - SKI.tY, L = Math.hypot(dx, dy);
  SKI.s = s; SKI.rot = rot; SKI.bx = bx; SKI.by = by; SKI.L = L; SKI.dx = dx / L; SKI.dy = dy / L;              // its length and downhill direction
  SKI.nx = SKI.dy; SKI.ny = -SKI.dx;                                                                          // the way out of the snow, into the sky
  return SKI;
}
// a point p of the way down the run (p may pass 0..1), off to the side by o (positive is up into the sky); left in V
function onRun(ly, p, o) { V[0] = ly.tX + ly.dx * ly.L * p + ly.nx * o; V[1] = ly.tY + ly.dy * ly.L * p + ly.ny * o; return V; }
// how far the skier is off the middle of the run at p: it swings from gate to gate, the sky side being positive
const skiSide = (p, u, A) => -0.09 * u + A * C(PI * (p - 0.16) / 0.2) * sat(p * 8);
// a pine tree standing on (x, y), z tall, swaying
function pine(x, y, z, sway) {
  box(x, y - z * 0.1, z * 0.16, z * 0.3, K.orangeD);
  for (let i = 0; i < 3; i++) {
    const yy = y - z * (0.2 + i * 0.28), ww = z * (0.52 - i * 0.12), sx = sway * (i + 1);
    poly([x - ww + sx * 0.3, yy, x + ww + sx * 0.3, yy, x + sx * 0.6, yy - z * 0.5], i & 1 ? K.greenD : K.green);
  }
}
// a slalom gate: a pole with a flag streaming to one side
function gate(x, y, z, side, col, ph) {
  line(x, y, x, y - z, 0.09 * z, K.ink); line(x, y, x, y - z, 0.05 * z, K.white);
  poly([x, y - z, x + side * z * 0.6, y - z * 0.86 + z * 0.05 * S(ph), x, y - z * 0.68], col);
}
// the finish: two poles either side of the run with a chequered banner across their tops
function finish(ly, u, k, gp) {
  const a = onRun(ly, 1.0, -0.2 * u), x0 = a[0], y0 = a[1], b = onRun(ly, 1.0, 0.14 * u), x1 = b[0], y1 = b[1];
  const hh = 0.34 * u * gp, bh = 0.09 * u * gp, ang = Math.atan2(y1 - y0, x1 - x0), cs = Math.hypot(x1 - x0, y1 - y0) / 8, ux = C(ang), uy = S(ang), c = raw();
  for (const [x, y] of [[x0, y0], [x1, y1]]) { line(x, y, x, y - hh, 8 * k, K.ink); line(x, y, x, y - hh, 4 * k, K.white); }
  polyO([x0, y0 - hh, x1, y1 - hh, x1, y1 - hh + bh, x0, y0 - hh + bh], K.white, 2 * k);
  c.fillStyle = K.ink; c.beginPath();
  for (let i = 0; i < 8; i++) addBox(x0 + ux * cs * (i + 0.5), y0 - hh + uy * cs * (i + 0.5) + bh * (i & 1 ? 0.75 : 0.25), cs, bh / 2, ang);
  c.fill();
}
// the skier, standing on (0, 0): skis along the slope at angle gam, the body a little more upright than the slope, swaying by lean
function skier(z, gam, lean, jacket, t) {
  const c = raw();
  c.save(); c.rotate(gam);
  boxO(-0.4 * z, -0.28 * z, 4.6 * z, 0.4 * z, K.yellow, 0, 0.2 * z, 0.16 * z); boxO(0, 0, 4.6 * z, 0.44 * z, K.red, 0, 0.22 * z, 0.16 * z);
  c.restore();
  c.save(); c.rotate(gam - 0.3 + lean);
  ribbon(0.3 * z, -4.7 * z, -2.6 * z, -3.6 * z, 0.5 * z, t * 25, 0.6 * z, K.yellow);                                    // a scarf streaming behind
  limbO(-0.1 * z, -3.0 * z, 0.5 * z, -0.5 * z, 1.4 * z, 1.4 * z, -1, 0.95 * z, K.blue, 0.17 * z);
  ovalO(0.7 * z, -0.4 * z, 0.75 * z, 0.4 * z, K.ink, 0, 0.1 * z);
  line(-0.15 * z, -3.0 * z, 0.75 * z, -4.7 * z, 2.1 * z, K.ink); line(-0.15 * z, -3.0 * z, 0.75 * z, -4.7 * z, 1.75 * z, jacket);
  limbO(0.7 * z, -4.4 * z, 1.9 * z, -3.3 * z, 1.0 * z, 1.0 * z, 1, 0.6 * z, jacket, 0.15 * z);
  line(1.9 * z, -3.3 * z, -1.4 * z, -0.4 * z, 0.4 * z, K.ink); line(1.9 * z, -3.3 * z, -1.4 * z, -0.4 * z, 0.14 * z, K.white);
  discO(1.35 * z, -5.6 * z, 0.95 * z, K.yellow, 0.17 * z); box(1.85 * z, -5.55 * z, 0.75 * z, 0.5 * z, K.ink, 0, 0.25 * z); disc(1.9 * z, -5.55 * z, 0.17 * z, K.skyL);
  c.restore();
}

const SKIHILL = {
  color: K.sky, bg: K.indigo, dur: 2.8,
  back(a, t) {                                                      // a sun in sunglasses, far peaks, the snowy mountain and its pines
    const { u, w, h } = a, ly = skiLayout(a), sx = 0.3 * w, sy = -0.2 * h, rise = pop(t, 0.05, 0.5), sp = pop(t, 0.1, 0.5), bob = 0.012 * u * S(t * 3);
    rays(sx, sy, 16, Math.hypot(a.bw, a.bh) / 2, t * 0.2, K.indigoM, 0.5);
    disc(sx, sy + bob, 0.5 * u * sp, K.orange); disc(sx, sy + bob, 0.42 * u * sp, K.yellow);
    if (sp > 0.5) {
      const gl = sp * 0.12 * u;
      for (let sd = -1; sd <= 1; sd += 2) oval(sx + sd * 0.16 * u, sy + bob - 0.03 * u, gl * 1.05, gl * 0.72, K.ink);
      line(sx - 0.05 * u, sy + bob - 0.05 * u, sx + 0.05 * u, sy + bob - 0.05 * u, 0.025 * u, K.ink);
      arcS(sx, sy + bob + 0.02 * u, 0.2 * u * sp, 0.18 * PI, 0.82 * PI, 0.03 * u, K.ink);
      spark(sx - 0.2 * u, sy + bob - 0.06 * u, 0.05 * u * (0.5 + 0.5 * S(t * 5)), 0, K.white);
    }
    const by = a.bh / 2, my = y => by + (y - by) * rise;             // everything rises from the bottom of the screen
    poly([0.12 * w, my(by), 0.37 * w, my(0.1 * h), 0.62 * w, my(by)], K.violet); poly([0.35 * w, my(by), 0.6 * w, my(0.22 * h), 0.85 * w, my(by)], K.purple);
    const ex = -0.9 * a.bw / 2, top = onRun(ly, -0.25, 0), px = top[0], py = top[1], e1 = onRun(ly, 1.6, 0), qx = e1[0], qy = e1[1];
    poly([ex, my(by), ex, my(py + 0.3 * h), px, my(py), qx, my(qy), qx, my(by)], K.white);                   // the mountain: everything below the run
    poly([ex, my(by), ex, my(py + 0.3 * h), px, my(py), lerp(px, ex, 0.45), my(by)], K.skyL);                 // and its shaded side
    const nt = a.n(7);                                              // pines on the slope, popping up in turn
    for (let i = 0; i < nt; i++) {
      const p = (i + 0.5) / nt * 1.25 + 0.02, o = -(0.36 + 0.3 * a.r(i, 1)) * u, q = onRun(ly, p, o), gr = pop(t, 0.3 + i * 0.09, 0.4);
      pine(q[0], q[1] + 0.02 * u, (0.22 + 0.12 * a.r(i, 2)) * u * gr, 3 * S(t * 2 + i));
    }
  },
  draw(a, t) {
    const { u, k, g } = a, ly = skiLayout(a), c = raw(), z = 0.078 * u, T0 = 0.55, T1 = 2.15, A = 0.12 * u, p = 1.02 * seg(t, T0, T1);
    const ride = pp => onRun(ly, pp, skiSide(pp, u, A));            // where the skier is when pp of the way down, in the snow
    a.begin(ly.bx, ly.by, ly.s * pop(t, 0.02, 0.3), ly.rot * E.outBack(seg(t, 0.15, 0.5)), 1, 1);
    glyph(g, k, { color: K.sky });
    if (a.ak > 0.02) glyphInk(g, k, {}, K.skyL, 5 * a.ak, null);
    a.end();
    const fg = pop(t, 0.5, 0.4);
    if (fg > 0.02) finish(ly, u, k, fg);
    for (let j = 0; j < 4; j++) {                                   // the slalom gates, on the outside of each turn
      const pj = 0.16 + 0.2 * j, side = j & 1 ? -1 : 1, q = onRun(ly, pj, skiSide(pj, u, A) + side * 0.06 * u), gp = pop(t, 0.3 + j * 0.1, 0.35);
      if (gp > 0.02) gate(q[0], q[1], 0.26 * u * gp, side, j & 1 ? K.blue : K.red, t * 9 + j);
    }
    if (t > T0 - 0.1) {
      // the track behind the skier, and the snow it kicks up
      const trk = [];
      for (let i = 0; i <= 44; i++) { const q = ride(p * i / 44); trk.push(q[0], q[1]); }
      pline(trk, 0.02 * u, K.skyL);
      const now = ride(p), px = now[0], py = now[1], nd = a.n(14);
      bits(SNOW, nd, i => { const q = ride(Math.max(0, p - (i + 1) * 0.013)); addDisc(q[0] + (a.r(i, 1) - 0.5) * 0.06 * u, q[1] - a.r(i, 2) * 0.05 * u - 0.01 * u, 0.017 * u * (1 - i / nd) * (0.6 + a.r(i, 3))); });
      for (let j = 0; j < 4; j++) {                                 // a burst of snow at every gate
        const q = ride(0.16 + 0.2 * j), tg = T0 + (0.16 + 0.2 * j) / 1.02 * (T1 - T0);
        spray(a, t, { x: q[0], y: q[1] - 0.02 * u, n: a.n(10), t0: tg, life: 0.7, a0: -PI * 0.95, a1: -PI * 0.05, v0: 0.3 * u, v1: 0.9 * u, g: 1100, s0: 5, s1: 11, shape: 'dot', seed: 700 + j * 30, cols: SNOW });
      }
      // the skier: leaning into each turn, hopping, flipping, then off the end with another flip
      const turn = clamp((skiSide(p + 0.01, u, A) - skiSide(p, u, A)) / (0.15708 * A), -1, 1), gam = Math.atan2(ly.dy, ly.dx) + 0.3 * turn;   // the skis follow the run, swinging out in each turn
      const j1 = S(PI * seg(t, 1.05, 1.4)), j2 = seg(t, 1.65, 2.05), j3 = seg(t, 2.05, 2.4), air = 0.16 * u * j1 + 0.2 * u * S(PI * j2) + 0.3 * u * S(PI * j3), pp = pop(t, T0 - 0.1, 0.3);
      if (t < 2.45) {
        c.save(); c.translate(px + (t > T1 ? (t - T1) * 0.6 * u : 0), py - air + (t > T1 ? (t - T1) * 0.5 * u : 0)); c.scale(pp, pp);
        c.translate(0, -2.2 * z); c.rotate(TAU * (E.io(j2) + E.io(j3))); c.translate(0, 2.2 * z);
        skier(z, gam, -0.3 * turn - 0.15 * j1 - 0.3 * j2, K.red, t);
        c.restore();
      }
    }
    const fin = onRun(ly, 1.0, -0.03 * u);
    spray(a, t, { x: fin[0], y: fin[1] - 0.2 * u, n: a.n(26), t0: T1 - 0.05, life: 1.2, v0: u * 0.8, v1: u * 2, seed: 850, cols: [K.yellow, K.white, K.red, K.skyL, K.lime] });
    fall(a, t, { n: a.n(22), t0: 0.3, shape: 'dot', cols: SNOW, vy0: 40, vy1: 130, sway: 20, s0: 5, s1: 10, seed: 800 });
  },
};

/* ---------- @ : the @ is a vinyl record on a turntable: the arm swings in, the record spins up, is scratched, and notes and bars bounce ---------- */
// a smooth spiral out from (x, y): turns times round to radius r1 (the kit's is too faceted at this size)
function groove(x, y, r1, turns, rot, lw, col) {
  const c = raw(), n = Math.ceil(turns * 72);
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y);
  for (let i = 1; i <= n; i++) { const f = i / n, an = rot + f * turns * TAU; c.lineTo(x + C(an) * f * r1, y + S(an) * f * r1); }
  c.stroke();
}
// how far the record has turned: it spins up, runs, is scratched back and forth, and stops upright
function spin(t) {
  const w0 = 12, up = seg(t, 0.3, 1.0), th = 0.5 * (w0 / 0.7) * (up * 0.7) ** 2 + w0 * Math.max(0, Math.min(t, 1.5) - 1.0);
  const scratch = 0.7 * S(TAU * 3 * Math.max(0, t - 1.5)) * seg(t, 1.5, 1.6) * (1 - seg(t, 1.9, 2.05));
  return lerp(th + scratch, 2 * TAU, E.io(seg(t, 1.95, 2.35)));
}
const NOTES = [K.pink, K.yellow, K.white, K.lime, K.sky], METER = [K.lime, K.yellow, K.pink], ROW0 = [0, 6, 8], ROW1 = [6, 8, 10];   // note colours; the meter's colours and the rows each covers
const VINYL = {
  color: K.pink, bg: K.teal, dur: 2.8,
  back(a, t) {                                                      // rays, and the level meter along the bottom: lime below, then yellow, then pink on top
    const { u, h } = a, c = raw(), nb = 16, bw = a.w / nb;
    groove(0, -0.02 * h, Math.hypot(a.bw, a.bh) / 2, 8, -t * 0.6, 0.07 * u, K.tealM);
    for (let j = 0; j < 3; j++) {
      c.fillStyle = METER[j]; c.beginPath();
      for (let i = 0; i < nb; i++) {
        const rows = Math.round((0.3 + 0.7 * Math.abs(S(t * (3 + 2 * a.r(i, 1)) + i * 1.7))) * pop(t, 0.1 + i * 0.02, 0.4) * 10);
        for (let r = ROW0[j]; r < ROW1[j] && r < rows; r++) addBox(-a.w / 2 + bw * (i + 0.5), h / 2 - (r + 0.5) * 0.034 * h, bw * 0.74, 0.026 * h, 0);
      }
      c.fill();
    }
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, D = Math.min(0.72 * h, 0.66 * w), s = D / (112 * k * a.hs), cy = -0.02 * h, ak = a.ak, c = raw(), dp = pop(t, 0.03, 0.4);
    const ang = lerp(75, 160, E.io(seg(t, 0.35, 0.9))) * PI / 180 + 0.03 * wob(t - 0.9, 3, 5), rot = ((spin(t) + PI) % TAU + TAU) % TAU - PI, scr = seg(t, 1.5, 1.6) * (1 - seg(t, 1.9, 2.05));      // how hard the record is being scratched
    // the deck
    if (dp > 0.02) {
      boxO(0, cy, 1.24 * D * dp, 1.1 * D * dp, K.cream, 0, 0.07 * D, 4 * k);
      discO(0, cy, 0.52 * D * dp, SILVER, 3 * k);
      for (let i = 0; i < 2; i++) discO(-0.5 * D + i * 0.09 * D, cy + 0.42 * D, 0.032 * D * dp, i ? K.lime : K.red, 2 * k);
    }
    // the record, turning: black, with grooves, strobe dots round the rim, and the glyph's rings and label on top
    a.begin(0, cy, s * dp, rot, 1 + 0.04 * S(TAU * 3 * (t - 1.5)) * scr, 1);
    const cx0 = gx(g, k, 50), r0 = 56 * k * ak;
    discO(cx0, 0, r0, K.black, 2.5 * k * ak);
    for (const rr of [27.5, 29.5, 31.5]) ring(cx0, 0, rr * k * ak, 0.7 * k * ak, K.indigoD);
    pie(cx0, 0, r0 * 0.97, -0.95, -0.4, K.indigoD); pie(cx0, 0, r0 * 0.97, 2.19, 2.74, K.indigoD);
    c.fillStyle = K.white; c.beginPath();
    for (let i = 0; i < 24; i++) addDisc(cx0 + C(i * TAU / 24) * 53.5 * k * ak, S(i * TAU / 24) * 53.5 * k * ak, k * ak);
    c.fill();
    glyph(g, k, { color: K.pink });
    disc(gx(g, k, 52), 0, 9 * k * ak, K.yellow); disc(gx(g, k, 52), 0, 2.6 * k * ak, K.ink);
    a.end();
    // the tonearm, swinging in from its rest
    const px = 0.5 * D, py = cy - 0.45 * D, La = 0.42 * D, nx = px + La * C(ang), ny = py + La * S(ang), bx = px - 0.13 * D * C(ang), by = py - 0.13 * D * S(ang);
    line(bx, by, nx, ny, 0.05 * D, K.ink); line(bx, by, nx, ny, 0.032 * D, K.white);
    boxO(nx, ny, 0.09 * D, 0.045 * D, K.orange, ang + 0.3, 0.012 * D, 2.5 * k); discO(px, py, 0.05 * D, K.white, 3 * k); disc(px, py, 0.02 * D, K.ink);
    // notes burst from the needle
    for (let i = 0, n = a.n(9); i < n; i++) {
      const age = t - (0.95 + i * 0.13);
      if (age <= 0 || age >= 1.1) continue;
      const vx = (a.r(i, 1) - 0.5) * 1.4 * u, vy = (0.5 + 0.6 * a.r(i, 2)) * 1.1 * u, sz = u * (0.07 + 0.04 * a.r(i, 3)) * (1 - seg(age, 0.8, 1.1));
      note(nx + vx * age + 0.02 * u * S(age * 9 + i), ny - vy * age + 0.9 * u * age * age, sz, 0.4 * S(age * 6 + i), NOTES[i % NOTES.length]);
    }
    for (let i = 0; i < 4; i++) pulse(0, cy, t, 1.0 + i * 0.4, 0.55, 0.62 * D, 0.03 * D, i & 1 ? K.white : K.yellow);
    twinkle(a, t, 10, 0.5, [K.white, K.yellow, K.pink], 420);
  },
};

/* ---------- # : the # is the board: a game of noughts and crosses plays out, mark by bouncing mark, and the crosses win along the diagonal ---------- */
const CROWN = [-6, 3, -6, -5, -3, -1, 0, -7, 3, -1, 6, -5, 6, 3];                // the winner's crown, in glyph units
const GAME = [[4, 0], [1, 1], [0, 0], [8, 1], [6, 0], [3, 1], [2, 0]];         // [cell, 0 for X or 1 for O]: X wins with 2, 4 and 6
const COLS = [12, 38, 64], ROWS = [16, 50, 84];                                 // where the cells are in the glyph, in units
const MOVE0 = 0.5, MOVE_DT = 0.19, WIN0 = 1.95;                                 // when the first mark lands, the gap between marks, when the winning line is drawn
// An X or an O in glyph units (the context is scaled to them) with two googly eyes looking to (lx, ly), and a crown (0..1) if it has won.
function mark(o, col, lx, ly, blink, crown) {
  const c = raw();
  if (o) { c.save(); c.translate(1.9, 2.1); ring(0, 0, 6.4, 10.4, K.ink); c.restore(); ring(0, 0, 6.4, 10.4, K.ink); ring(0, 0, 6.4, 5.4, col); }
  else {
    c.lineCap = 'round'; c.beginPath(); c.moveTo(-6, -8.2); c.lineTo(6, 8.2); c.moveTo(6, -8.2); c.lineTo(-6, 8.2);
    c.save(); c.translate(1.9, 2.1); c.strokeStyle = K.ink; c.lineWidth = 11.2; c.stroke(); c.restore();
    c.strokeStyle = K.ink; c.lineWidth = 11.2; c.stroke(); c.strokeStyle = col; c.lineWidth = 6; c.stroke();
  }
  eye(-2.5, o ? -0.4 : -1, 2.4, lx, ly, K.white, K.ink, blink); eye(2.5, o ? -0.4 : -1, 2.4, lx, ly, K.white, K.ink, blink);
  if (crown > 0.02) { c.save(); c.translate(0, -14.5 - 3 * (1 - crown)); c.scale(crown, crown); polyO(CROWN, K.yellow, 1.3); c.restore(); }
}
// the two players cheer for their marks from either side of the board: crosses on the left, noughts on the right
function players(a, t, cy) {
  const { u, w, h } = a, wide = w > 0.9 * h, sz = (wide ? 0.5 : 0.3) * u / 22 * a.ak, px = wide ? 0.33 * w : 0.26 * w, py = wide ? cy : -0.4 * h, tw = t - WIN0 - 0.35, c = raw();
  if (sz < 0.01) return;
  for (let o = 0; o < 2; o++) {
    const side = o ? 1 : -1, pp = pop(t, 0.2 + o * 0.06, 0.4);
    let jump = 0;
    for (let m = o; m < GAME.length; m += 2) jump = Math.max(jump, S(PI * seg(t, MOVE0 + m * MOVE_DT, MOVE0 + m * MOVE_DT + 0.3)));      // a hop for each of its marks
    if (!o && tw > 0) jump = Math.abs(S(tw * 9)) * (1 - seg(tw, 0.5, 0.75));                                                            // the winners' dance
    const slump = o && tw > 0 ? E.out(seg(tw, 0, 0.3)) : 0;                                                                              // the losers slump
    c.save(); c.translate(side * px, py - 0.07 * u * jump - 0.012 * u * Math.abs(S(t * 4 + o * 2)));
    c.rotate(0.15 * S(t * 8) * jump - side * 0.3 * slump); c.scale(sz * pp * (1 - 0.15 * slump), sz * pp * (1 - 0.15 * slump));
    mark(o, o ? K.yellow : K.pink, -side * (1 - slump), slump * 0.8, (t + o * 0.6) % 1.7 < 0.1 ? 0.15 : 1, !o ? pop(t, WIN0 + 0.3, 0.35) : 0);
    c.restore();
  }
}
const NOUGHTS = {
  color: K.white, bg: K.blue, dur: 3.0,
  back(a, t) {                                                      // squared paper drifting by, with giant crosses and noughts floating on it
    const { u, w, h } = a, c = raw(), sp = 0.1 * u, off = (t * u * 0.04) % sp, R = a.bw / 2, Rh = a.bh / 2, big = 0.13 * u, gp = pop(t, 0.1, 0.5);
    c.strokeStyle = K.blueM; c.lineWidth = 2; c.beginPath();
    for (let x = -R + off; x < R; x += sp) { c.moveTo(x, -Rh); c.lineTo(x, Rh); }
    for (let y = -Rh + off; y < Rh; y += sp) { c.moveTo(-R, y); c.lineTo(R, y); }
    c.stroke();
    c.lineCap = 'round'; c.lineWidth = 0.035 * u; c.strokeStyle = K.blueL; c.beginPath();
    for (let i = 0; i < 12; i++) {
      const x = (((i % 4) + 0.5) / 4 - 0.5) * w * 1.1 + 0.03 * u * S(t * 1.3 + i), y = ((Math.floor(i / 4) + 0.5) / 3 - 0.5) * h * 1.05 + 0.03 * u * C(t * 1.1 + i * 2);
      const r = big * gp * (0.8 + 0.4 * a.r(i, 1)), an = t * 0.3 * (i & 1 ? 1 : -1), cs = C(an) * r * 0.8, sn = S(an) * r * 0.8;
      if ((i + Math.floor(i / 4)) & 1) { c.moveTo(x + cs, y + sn); c.lineTo(x - cs, y - sn); c.moveTo(x - sn, y + cs); c.lineTo(x + sn, y - cs); }
      else { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
    }
    c.stroke();
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, s = Math.min(1.6, 0.8 * h / (100 * k), 0.85 * w / (76 * k)), cy = -0.02 * h, c = raw(), ak = a.ak, wb = 4 * Math.exp(-4 * t), bounce = 0.03 * S(PI * seg(t, WIN0 + 0.3, WIN0 + 0.6));
    // the board: its lines draw themselves on, wobbling into place
    a.begin(0, cy, s * pop(t, 0.02, 0.3), 0, 1 + bounce, 1 - bounce);
    glyph(g, k, { color: K.white, t1: E.out(seg(t, 0.05, 0.5)), sw: lerp(6.5, 17, a.land), ol: lerp(2.6, 4.2, a.land) * k, sh: lerp(1.9, 4.6, a.land) * k, wave: { ax: wb, ay: wb, kx: 0.14, ky: 0.14, ph: -t * 26 } });
    for (let m = 0; m < GAME.length; m++) {
      const [cell, o] = GAME[m], age = t - (MOVE0 + m * MOVE_DT), win = !o && (cell === 2 || cell === 4 || cell === 6);
      if (age <= 0) continue;
      const x = gx(g, k, COLS[cell % 3]), y = gy(k, ROWS[Math.floor(cell / 3)]), next = GAME[m + 1] ? GAME[m + 1][0] : cell, sq = wob(age, 4.5, 7), tw = t - WIN0 - 0.35, won = tw > 0;
      const jump = win && won ? Math.abs(S(tw * 9)) * 8 * (1 - seg(tw, 0.5, 0.75)) : 0, big = win && won ? 1 + 0.25 * seg(tw, 0, 0.2) : 1, pp = E.outBack(seg(age, 0, 0.28)) * big * k * ak;
      const lx = won && o ? 0 : clamp(((next % 3) - (cell % 3)) * 0.7, -1, 1), ly = won && o ? 1 : clamp((Math.floor(next / 3) - Math.floor(cell / 3)) * 0.7, -1, 1);   // the losers look glum
      c.save(); c.translate(x, y - (1 - E.outBounce(seg(age, 0, 0.36))) * 22 * k * ak - jump * k * ak); c.scale(pp * (1 + 0.25 * sq), pp * (1 - 0.25 * sq));
      mark(o, o ? K.yellow : K.pink, lx, ly, (t + m * 0.37) % 1.5 < 0.1 ? 0.15 : 1, 0);
      c.restore();
    }
    const wl = E.out(seg(t, WIN0, WIN0 + 0.3));                     // the winning line, drawn on through the three crosses
    if (wl > 0 && ak > 0.02) {
      const x0 = gx(g, k, COLS[2]), y0 = gy(k, ROWS[0]), ex = lerp(x0, gx(g, k, COLS[0]), wl), ey = lerp(y0, gy(k, ROWS[2]), wl);
      line(x0, y0, ex, ey, 11 * k * ak, K.ink); line(x0, y0, ex, ey, 6 * k * ak, K.lime);
    }
    a.end();
    players(a, t, cy);
    spray(a, t, { x: 0, y: cy, n: a.n(28), t0: WIN0 + 0.3, life: 1.2, v0: u * 0.9, v1: u * 2.2, seed: 900, cols: [K.pink, K.yellow, K.white, K.lime, K.sky] });
    fall(a, t, { n: a.n(24), t0: WIN0 + 0.3, cols: [K.pink, K.yellow, K.white, K.lime], seed: 950 });
  },
};

export const SCENES = {
  '(': bowScene({ dir: -1, color: K.orange, bg: K.green, ray: K.greenD, ring: [K.lime, K.green], rings: [K.red, K.white], dim: K.greenD, grip: K.red, fletch: [K.pink, K.yellow], confetti: [K.red, K.white, K.yellow, K.pink] }),
  ')': bowScene({ dir: 1, color: K.yellow, bg: K.red, ray: K.redD, ring: [K.orange, K.red], rings: [K.blue, K.white], dim: K.redD, grip: K.blue, fletch: [K.lime, K.sky], confetti: [K.blue, K.white, K.yellow, K.lime] }),
  '[': magnetScene({ dir: 1, color: K.red, shine: K.redL, bg: K.lime, rings: [K.limeL, K.green], bits: BITS_A, cols: [K.yellow, K.sky, K.pink, K.white] }),
  ']': magnetScene({ dir: -1, color: K.blue, shine: K.blueL, bg: K.orange, rings: [K.orangeL, K.red], bits: BITS_B, cols: [K.pink, K.yellow, K.white, K.sky] }),
  '{': mustacheScene(GENTLEMAN),
  '}': mustacheScene(COWBOY),
  '/': SLIDE,
  '\\': SKIHILL,
  '@': VINYL,
  '#': NOUGHTS,
};
