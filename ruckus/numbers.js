// 0 to 9: ten little stages, one per digit, with the digit as the hero (see letters.js for the contract). Digits have no capital form, so they
// always play at normal strength, which is already big and loud.
import {
  K, E, S, C, TAU, PI, sat, clamp, seg, lerp, pop, rays, disc, discO, ring, oval, ovalO, box, boxO, line, pline, poly, tri, star, spark, heart, leaf, arcS, flower,
  band, cloud, wave, pie, drop, eye, eyes, spiral, coin, bird, addDisc, spray, fall, pulse, limbO, ik, KNEE, glyph, glyphInk, gx, gy, alpha, raw, mixHex, P,
} from './kit.js';

/* ---------- shared bits ---------- */
const tall = a => clamp(a.h / a.u / 1.8, 1, 1.5);                     // portrait stages are tall for their width: vertical layouts stretch by this
const boing = dt => dt > 0 ? Math.exp(-10 * dt) * C(TAU * 2.6 * dt) : 0;   // a landing's squash: 1 at impact, wobbling out
// a stroked ellipse: ripples on the water, hoops, rings rolling out along a floor
function ell(x, y, rx, ry, lw, col) { if (rx <= 0 || ry <= 0 || lw <= 0) return; const c = raw(); c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.stroke(); }
const SPRINK = [K.yellow, K.white, K.lime, K.red, K.purple, K.orange];

// the donut: a stroked ring that starts as the tall oval of the 0, and has the glyph's sticker outline and hard shadow
function donutRing(k, rx, ry, sw, col, roll) {
  const c = raw(), ol = 4.2 * k, sh = 4.6 * k;
  c.lineJoin = 'round'; c.beginPath(); c.ellipse(0, 0, rx * k, ry * k, 0, 0, TAU); c.closePath();
  c.save(); c.translate(sh * C(roll) + sh * 1.1 * S(roll), -sh * S(roll) + sh * 1.1 * C(roll)); c.strokeStyle = K.ink; c.lineWidth = sw * k + ol * 2; c.stroke(); c.restore();   // the shadow stays put as the ring rolls
  c.strokeStyle = K.ink; c.lineWidth = sw * k + ol * 2; c.stroke();
  c.strokeStyle = col; c.lineWidth = sw * k; c.stroke();
}
// steam curling up: two strokes (a darker one under a white one) along a wavering S
function steam(x, y, len, t, ph, lw) {
  if (len < 2) return;
  const pts = [];
  for (let j = 0; j <= 8; j++) { const f = j / 8; pts.push(x + S(f * 5 - t * 4 + ph) * len * 0.14 * (0.3 + f), y - f * len); }
  pline(pts, lw + 5, K.skyD); pline(pts, lw, K.white);
}
// wobbly icing over the ring: an annulus with a drippy outer edge
function icing(k, rx, ry, hw, ph, col) {
  const c = raw(); c.fillStyle = col; c.beginPath();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i <= 48; i++) {
      const th = i / 48 * TAU, d = pass ? -hw * 0.82 + 0.16 * hw * S(th * 5 + ph + 1) : hw + 0.3 * hw * S(th * 7 + ph) + 0.18 * hw * S(th * 11 - ph * 1.3);
      const px = C(th) * (rx + d) * k, py = S(th) * (ry + d) * k;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath();
  }
  c.fill('evenodd');
}
// sprinkles: short round-capped dashes lying on the icing, one stroke per colour
function sprinkles(a, k, rx, ry, n, sc) {
  const c = raw(); c.lineCap = 'round'; c.lineWidth = 3.3 * k * sc;
  for (let col = 0; col < SPRINK.length; col++) {
    c.strokeStyle = SPRINK[col]; c.beginPath();
    for (let i = col; i < n; i += SPRINK.length) {
      const th = a.r(i, 1) * TAU, rho = (a.r(i, 2) - 0.5) * 9, an = a.r(i, 3) * PI, px = C(th) * (rx + rho) * k, py = S(th) * (ry + rho) * k, dx = C(an) * 4.4 * k * sc, dy = S(an) * 4.4 * k * sc;
      c.moveTo(px - dx, py - dy); c.lineTo(px + dx, py + dy);
    }
    c.stroke();
  }
}

/* ---------- 0: a pink-iced donut bounces and rolls across the counter like a wheel, squashing on every landing and fountaining sprinkles ---------- */
const D_T0 = 0.3, D_HOP = 0.48, D_H = [0.24, 0.26, 0.28, 0.36];        // the hops: when they start, how long each takes, how high (in u)
const D_MINI = [[-0.4, -0.1], [-0.27, 0.16], [0.31, -0.17], [0.42, 0.1], [0.05, -0.31]];

const ZERO = {
  color: K.orangeL, bg: K.sky, dur: 2.8,
  back(a, t) {
    const { u, k, w, h, bw, bh } = a, fy = h * 0.3, dy = -h * 0.5 + h * 0.05, nd = 16;
    rays(0, 0, 22, Math.hypot(bw, bh) / 2, t * 0.2, K.skyM, 0.5);
    band(-bw / 2, bw / 2, dy, h * 0.012, w * 0.2, 1, K.pink, -bh / 2);                    // frosting drips from the ceiling
    for (let i = 0; i < nd; i++) {
      const x = (-0.75 + 1.5 * (i + 0.5) / nd) * w, len = h * (0.05 + 0.13 * a.r(i, 1)) * pop(t, 0.04 + 0.03 * ((i * 7) % nd), 0.5), wd = u * 0.055;
      box(x, dy + len / 2, wd, len, K.pink, 0, wd / 2);
      if (len > wd) box(x - wd * 0.2, dy + len * 0.45, wd * 0.22, len * 0.5, K.pinkL, 0, wd * 0.11);
    }
    D_MINI.forEach(([mx, my], i) => {                                                    // little donuts floating about
      const r = u * (0.05 + 0.025 * a.r(i, 2)) * pop(t, 0.2 + i * 0.09, 0.4), x = mx * w, y = my * h + S(t * 1.7 + i * 2) * u * 0.02;
      ring(x, y, r, r * 0.7, K.orangeL); ring(x, y, r, r * 0.38, K.pink);
    });
    box(0, (fy + bh / 2) / 2, bw, bh / 2 - fy, K.blue);                                  // the counter
    box(0, fy + h * 0.006, bw, h * 0.012, K.white);
    for (let i = -12; i <= 12; i++) disc(i * u * 0.3, fy + h * 0.06, u * 0.028, K.skyM);
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, s = 0.8, fy = h * 0.3, X0 = -w * 0.26, X1 = w * 0.26, tEnd = D_T0 + 4 * D_HOP;
    const xf = seg(t, D_T0, tEnd), x = lerp(X0, X1, xf), m = clamp(Math.floor((t - D_T0) / D_HOP), 0, 4);
    const air = t >= D_T0 && m < 4, p = air ? (t - D_T0) / D_HOP - m : 0, st = air ? S(PI * p) : 0, lift = air ? D_H[m] * u * 4 * p * (1 - p) : 0;
    const sqz = m >= 1 ? boing(t - (D_T0 + m * D_HOP)) : -0.5 * boing(t - 0.02);
    const sx = 1 + 0.32 * sqz - 0.07 * st, sy = 1 - 0.34 * sqz + 0.11 * st, ak = a.ak;
    const rnd = E.io(seg(t, 0.28, 0.62)) * (1 - E.io(seg(t, 2.05, 2.3))) * ak, rx = 25.5 + 9 * rnd, ry = 41.5 - 6 * rnd, sw = 17 + 13 * ak * (0.4 + 0.6 * rnd);
    const roll = PI * Math.max(1, Math.round((X1 - X0) / (PI * 57.7 * k * s))) * xf;       // a whole number of half turns, so it lands upright
    const sn = S(roll), cs = C(roll), rad = Math.hypot((rx + sw / 2 + 4.2) * sn, (ry + sw / 2 + 4.2) * cs) * k * s;
    const yc = fy - rad * sy - lift;
    // its shadow on the counter
    const sr = rad * sx * (1.05 - 0.45 * sat(lift / (0.4 * u))) * pop(t, 0.02, 0.3);
    oval(x, fy + h * 0.012, sr, sr * 0.16, K.blueD);
    fall(a, t, { n: a.n(26), t0: 0.6, shape: 'rect', cols: SPRINK, vy0: 150, vy1: 340, s0: 5, s1: 10, sway: 26, seed: 100 });
    for (let j = 1; j <= 4; j++) {                                                          // every landing: a ring rolls out along the counter, sparkles pop, sprinkles fountain up
      const tl = D_T0 + j * D_HOP, xl = X0 + (X1 - X0) * j / 4, age = seg(t, tl, tl + 0.5);
      if (age > 0 && age < 1) {
        ell(xl, fy + h * 0.012, rad * (0.8 + 1.5 * E.out(age)), rad * (0.13 + 0.2 * E.out(age)), 6 * k * (1 - age), K.white);
        const c = raw(); c.fillStyle = K.white; c.beginPath();                              // and two puffs of dust roll away either side
        for (const sd of [-1, 1]) for (let q = 0; q < 2; q++) addDisc(xl + sd * rad * (0.9 + q * 0.4 + 0.9 * E.out(age)), fy - u * (0.04 + 0.03 * q) * (1 + age), u * (0.09 + 0.035 * q) * (1 - age));
        c.fill();
      }
      spray(a, t, { x: xl, y: fy - rad, n: a.n(20), t0: tl, life: 1.0, a0: -PI * 0.86, a1: -PI * 0.14, v0: u * 0.7, v1: u * 1.9, g: 1500, shape: 'rect', cols: SPRINK, s0: 6, s1: 12, seed: 300 + j * 40 });
      spray(a, t, { x: xl, y: fy - rad, n: a.n(5), t0: tl, life: 0.7, a0: -PI * 0.95, a1: -PI * 0.05, v0: u * 0.5, v1: u * 1.1, g: 300, shape: 'spark', cols: [K.white, K.yellow], s0: 12, s1: 22, seed: 500 + j * 40 });
    }
    for (let i = 0; i < 3; i++) steam(x + (i - 1) * rad * 0.5, yc - rad * sy * 0.96, u * 0.5 * pop(t, 0.5 + i * 0.12, 0.5) * ak * (1 - 0.6 * sat(lift / (0.2 * u))), t, i * 2.1, 6 * k);
    a.begin(x, yc, s * pop(t, 0.02, 0.3), 0, sx, sy);
    const c = raw();
    c.rotate(roll * (1 - a.land));
    if (ak < 0.02) glyph(g, k, { color: K.orangeL });
    else {
      donutRing(k, rx, ry, sw, K.orangeL, roll * (1 - a.land));
      icing(k, rx, ry, 0.63 * sw * 0.5 * ak + 0.001, 0.7, K.pink);
      sprinkles(a, k, rx, ry, a.n(26), ak);
    }
    a.end();
  },
};

/* ---------- 1: the 1 wins: three blocks bounce up, cannons fire streamers, and the 1 jumps for joy holding the trophy ---------- */
const P_RISE = [0.12, 0.3, 0.5], P_HT = [0.24, 0.33, 0.17], P_COL = [K.white, K.orange, K.orangeD], P_MED = [K.skyL, K.yellow, K.orangeL];   // 2nd, 1st, 3rd
const CANNON_AT = [0.95, 1.65, 2.05], STREAM = [K.pink, K.yellow, K.sky, K.lime, K.white];

// a streamer thrown from (x, y) at angle ang and speed v, `age` seconds after the shot: a wriggling ribbon in flight
function streamer(x, y, ang, v, age, col, lw, ph, life) {
  if (age <= 0 || age >= life) return;
  const c = raw(), tail = Math.max(0, age - 0.5);
  c.strokeStyle = col; c.lineWidth = lw * (1 - sat((age - life * 0.6) / (life * 0.4))); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  for (let j = 0; j <= 10; j++) {
    const tt = lerp(tail, age, j / 10), d = (1 - Math.exp(-2.4 * tt)) / 2.4 * v, wig = S(tt * 14 + ph) * lw * 2.2 * sat(tt * 4);
    const px = x + C(ang) * d - S(ang) * wig, py = y + S(ang) * d + C(ang) * wig + 170 * tt * tt;
    if (j) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.stroke();
}
// a trophy cup centred on (x, y), s tall
function trophy(x, y, s, rot) {
  if (s < 1) return;
  const c = raw(), ol = s * 0.05;
  c.save(); c.translate(x, y); c.rotate(rot);
  for (const sd of [-1, 1]) { ring(sd * 0.36 * s, -0.27 * s, 0.13 * s, 0.07 * s + ol * 2, K.ink); ring(sd * 0.36 * s, -0.27 * s, 0.13 * s, 0.07 * s, K.yellow); }
  boxO(0, 0.16 * s, 0.11 * s, 0.2 * s, K.yellow, 0, 0, ol); boxO(0, 0.34 * s, 0.46 * s, 0.13 * s, K.orange, 0, s * 0.03, ol);
  c.beginPath(); c.moveTo(-0.34 * s, -0.5 * s); c.lineTo(0.34 * s, -0.5 * s); c.bezierCurveTo(0.34 * s, -0.12 * s, 0.17 * s, 0.08 * s, 0, 0.08 * s); c.bezierCurveTo(-0.17 * s, 0.08 * s, -0.34 * s, -0.12 * s, -0.34 * s, -0.5 * s); c.closePath();
  c.lineJoin = 'round'; c.strokeStyle = K.ink; c.lineWidth = ol * 2; c.stroke(); c.fillStyle = K.yellow; c.fill();
  box(0, -0.5 * s, 0.68 * s, 0.07 * s, K.orange, 0, s * 0.03);
  star(0, -0.27 * s, 0.15 * s, 5, 0.07 * s, 0, K.white);
  line(-0.22 * s, -0.4 * s, -0.17 * s, -0.16 * s, s * 0.05, K.white);
  c.restore();
}
// a medal: a disc with a ring and a star
function medal(x, y, r, col) {
  discO(x, y, r, col, r * 0.12); ring(x, y, r * 0.72, r * 0.09, K.white); star(x, y, r * 0.5, 5, r * 0.22, -PI / 2, K.white);
}

const ONE = {
  color: K.yellow, bg: K.red, dur: 2.9,
  back(a, t) {
    const { u, k, w, h, bw, bh } = a, fy = h * 0.36;
    rays(0, 0, 26, Math.hypot(bw, bh) / 2, t * 0.25, K.orange, 0.42);
    alpha(0.2);                                                       // two spotlights leaning in on the podium, and the pool of light they make
    for (const sd of [-1, 1]) { const sw = S(t * 1.7 + sd) * w * 0.05, x = sd * w * 0.5; poly([x + sw, -h * 0.6, x + sw - sd * u * 0.25, -h * 0.6, sd * u * 0.18, fy, -sd * u * 0.32, fy], K.white); }
    disc(0, -h * 0.02, u * 0.6 * pop(t, 0.1, 0.5), K.white);
    alpha(1);
    box(0, (fy + bh / 2) / 2, bw, bh / 2 - fy, K.redD);              // the stage
    box(0, fy + 4 * k, bw, 8 * k, K.yellow);
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, vs = tall(a), U = u * vs, s = Math.min(0.56 * vs, 0.8), fy = h * 0.36, ak = a.ak, bwd = Math.max(0.34 * u, 46 * k * s), cx = Math.min(bwd * 1.5 + 0.2 * u, w * 0.46);
    // the podium blocks spring up in turn: 2nd, 1st, 3rd
    let top1 = fy;
    for (let i = 0; i < 3; i++) {
      const ht = P_HT[i] * U * pop(t, P_RISE[i], 0.45), x = (i - 1) * bwd;
      if (ht > 2) { boxO(x, fy - ht / 2, bwd - 2 * k, ht, P_COL[i], 0, 0, 3 * k); if (ht > 0.14 * U) medal(x, fy - ht * 0.45, bwd * 0.28, P_MED[i]); }
      if (i === 1) top1 = fy - ht;
    }
    // the cannons at both sides, and what they fire
    for (const sd of [-1, 1]) {
      const rec = CANNON_AT.reduce((m, tf) => Math.max(m, t > tf ? Math.exp(-14 * (t - tf)) : 0), 0), ang = sd < 0 ? -1.25 : -PI + 1.25, cs = clamp(w / (u * 3.2), 0.6, 1), len = 0.4 * u * cs, wid = 0.13 * u * cs, pp = pop(t, 0.35, 0.4) * ak;
      const bx = sd * cx, by = fy - 0.02 * u, mx = bx + C(ang) * len * 0.5 * pp, my = by + S(ang) * len * 0.5 * pp;
      CANNON_AT.forEach((tf, j) => {
        for (let i = 0; i < 4; i++) streamer(mx, my, ang + (i - 1.5) * 0.2 + (a.r(j * 9 + i, 1) - 0.5) * 0.1, u * (1.2 + 0.5 * a.r(j * 9 + i, 2)), t - tf, STREAM[(i + j + (sd > 0 ? 2 : 0)) % 5], 3 * k, i * 1.7 + j, 1.5);
        spray(a, t, { x: mx, y: my, n: a.n(12), t0: tf, life: 1.2, a0: ang - 0.4, a1: ang + 0.4, v0: u * 0.9, v1: u * 2.3, g: 1000, seed: 30 + j * 20 + (sd > 0 ? 7 : 0), cols: STREAM });
      });
      if (pp < 0.03) continue;
      const c = raw(); c.save(); c.translate(bx - C(ang) * rec * 0.05 * u * pp, by - S(ang) * rec * 0.05 * u * pp); c.rotate(ang);
      boxO(0, 0, len * pp, wid * pp, K.sky, 0, wid * 0.2, 3 * k); box(-len * 0.12 * pp, 0, wid * 0.4 * pp, wid * pp, K.white); boxO(len * 0.5 * pp, 0, wid * 0.42 * pp, wid * 1.28 * pp, K.skyD, 0, wid * 0.12, 3 * k);
      c.restore();
      discO(bx, fy - 0.03 * u, 0.075 * u * cs * pp, K.blueD, 3 * k); disc(bx, fy - 0.03 * u, 0.028 * u * cs * pp, K.skyL);
    }
    // the winner
    const j1 = seg(t, 1.05, 1.55), j2 = seg(t, 1.75, 2.3), lift = U * (0.08 * 4 * j1 * (1 - j1) + 0.11 * 4 * j2 * (1 - j2)), st = S(PI * j1) + S(PI * j2);
    const sqz = -0.5 * boing(t - 0.02) + (t < 1.75 ? boing(t - 1.55) : 0) + boing(t - 2.3), sx = 1 + 0.3 * sqz - 0.1 * st, sy = 1 - 0.3 * sqz + 0.14 * st;
    const yc = top1 - 51.5 * k * s * sy - lift, up = E.out(seg(t, 0.85, 1.1)), cheer = j1 > 0 && j1 < 1 || j2 > 0 && j2 < 1 ? 1 : 0, wig = S(t * 16) * 3 * k * cheer;
    a.begin(0, yc, s * pop(t, 0.02, 0.3), j2 < 1 ? TAU * E.io(seg(j2, 0.1, 0.9)) : 0, sx, sy);
    const hand = sd => [gx(g, k, lerp(30 + sd * 24, 30 + sd * 22, up)) + wig * sd, gy(k, lerp(68, -44, up)) + wig * 0.5];
    if (ak > 0.02) for (const sd of [-1, 1]) {                           // arms, behind the letter: down at its sides, then up to hold the trophy
      const [hx, hy] = hand(sd), l = lerp(26, 40, up) * k * ak;
      limbO(gx(g, k, 30 + sd * 7), gy(k, 34), hx, hy, l, l, sd * lerp(-1, 1, E.io(seg(up, 0.3, 0.8))), 8 * k * ak, K.yellow, 3.2 * k * ak);
    }
    glyph(g, k, { color: K.yellow });
    if (ak > 0.02) {
      trophy(gx(g, k, 30), gy(k, -30), 58 * k * pop(t, 0.85, 0.4) * ak, S(t * 9) * 0.06 * cheer);
      for (const sd of [-1, 1]) { const [hx, hy] = hand(sd); discO(hx, hy, 7 * k * ak, K.white, 3 * k * ak); }
      for (let i = 0; i < 4; i++) { const p = seg(t, 1.0 + i * 0.09, 1.35 + i * 0.09); if (p > 0 && p < 1) spark(gx(g, k, 30 + (i % 2 ? 1 : -1) * (30 + 8 * i)), gy(k, -40 - 14 * (i >> 1) + 8 * i), 15 * k * S(p * PI) * ak, i + t * 4, i & 1 ? K.white : K.yellow); }
    }
    a.end();
    fall(a, t, { n: a.n(26), t0: 1.0, cols: STREAM, seed: 600 });
    for (let i = 0, n = a.n(10); i < n; i++) {                                     // flashbulbs going off all round
      const tb = 0.5 + i * 1.7 / n + a.r(i, 5) * 0.1, p = seg(t, tb, tb + 0.26);
      if (p <= 0 || p >= 1) continue;
      const x = (a.r(i, 1) < 0.5 ? -1 : 1) * (0.28 + a.r(i, 2) * 0.2) * w, y = (-0.4 + a.r(i, 3) * 0.55) * h, sz = u * 0.2 * S(p * PI) * (0.6 + a.r(i, 4) * 0.7);
      spark(x, y, sz, a.r(i, 6), K.white); disc(x, y, sz * 0.2, K.yellow);
    }
  },
};

/* ---------- 2: the 2 is a swan gliding over a pond: wake ripples, lotus flowers, dragonflies, and a cygnet who comes to say hello ---------- */
const POND = [[-0.37, 0.33, 0.2], [0.3, 0.36, 0.24], [-0.08, 0.45, 0.14], [0.44, 0.24, 0.12], [-0.46, 0.22, 0.11], [0.08, 0.28, 0.1]];   // lily pads: x (of w), y (of h), radius (of u)
const LOTUS = [[0, 0.5], [1, 0.75], [3, 1.0]];                        // which pad, and when it blooms
const DRAGON = [[-0.38, -0.2, K.magenta], [0.4, -0.06, K.purple], [-0.16, -0.36, K.orange]];    // dragonflies patrol these patches of sky: x (of w), y (of h), colour
const NK = [0, 0, 0];                                                 // where the swan's head is: x, y (px) and its tilt

// a lily pad: a flat green disc with a notch cut out
function pad(x, y, rx, ry, n) {
  oval(x, y, rx, ry, K.green); oval(x, y - ry * 0.1, rx * 0.82, ry * 0.72, K.lime);
  poly([x, y, x + C(n) * rx * 1.05, y + S(n) * ry * 1.05, x + C(n + 0.22) * rx * 1.05, y + S(n + 0.22) * ry * 1.05], K.teal);
}
// a lotus opening: two rows of pointed petals fanning out of a yellow heart
function lotus(x, y, r, bloom) {
  if (bloom <= 0.02) return;
  for (let j = 0; j < 5; j++) { const an = (j - 2) * 0.55 * bloom; leaf(x + S(an) * r * 0.95, y - C(an) * r * 0.95, r * bloom, an, K.pink, K.pinkD); }
  for (let j = 0; j < 3; j++) { const an = (j - 1) * 0.42 * bloom; leaf(x + S(an) * r * 0.78, y - C(an) * r * 0.78, r * 0.8 * bloom, an, K.pinkL); }
  disc(x, y - r * 0.12, r * 0.2 * bloom, K.yellow);
}
// a dragonfly seen from the side: a long body and four blurring wings
function dragonfly(x, y, s, rot, t, col) {
  const dx = C(rot), dy = S(rot), fl = 0.3 + 0.7 * Math.abs(S(t * 36));
  line(x - dx * s * 1.9, y - dy * s * 1.9, x + dx * s * 0.6, y + dy * s * 0.6, s * 0.34, col); disc(x + dx * s * 0.8, y + dy * s * 0.8, s * 0.4, col);
  for (const o of [0.3, -0.25]) for (const sd of [-1, 1]) oval(x + dx * s * o - dy * sd * s * 0.75, y + dy * s * o + dx * sd * s * 0.75, s * 0.9, s * 0.26 * fl, K.white, rot + sd * 1.3);
}
// the neck bends forward and down (bow 0..1): points higher up the neck swing further round the shoulder
const bendFn = bow => (x, y) => { const q = bow * 0.95 * sat((75 - y) / 60), cs = C(q), sn = S(q), dx = x - 32, dy = y - 75; P.x = 32 + dx * cs + dy * sn; P.y = 75 - dx * sn + dy * cs; };
// where the head is (px, in the frame of the glyph) once the neck has swayed and bowed: writes NK
function headPose(g, k, wv, bow) { bendFn(bow)(10.5 + wv.ax * S(32 * wv.kx + wv.ph), 32); NK[0] = gx(g, k, P.x); NK[1] = gy(k, P.y); NK[2] = bow * 0.95 * 0.72; }
// the swan: the 2's hook is its neck; a body and tail are added under the base of the 2, all in one sticker outline
function swan(g, k, o) {
  const c = raw(), sc = o.ak, ol = 4.2 * k, sh = 4.6 * k, wv = { ax: (o.ax || 3.2) * sc, ay: 0, kx: o.kx || 0.07, ph: o.ph }, bow = o.bow || 0, fn = bendFn(bow);
  const X = x => (x - 32.5) * sc * k, Y = y => (92 + (y - 92) * sc - 50) * k;
  headPose(g, k, wv, bow);
  const hx = NK[0], hy = NK[1], hr = 12.5 * k * sc, tilt = NK[2];
  const body = () => {
    c.beginPath(); c.moveTo(X(-3), Y(78)); c.bezierCurveTo(X(-6), Y(92), X(6), Y(101), X(26), Y(101)); c.lineTo(X(66), Y(101)); c.bezierCurveTo(X(80), Y(101), X(92), Y(92), X(99), Y(68));
    c.bezierCurveTo(X(84), Y(74), X(68), Y(66), X(52), Y(66)); c.bezierCurveTo(X(38), Y(66), X(22), Y(68), X(10), Y(72)); c.bezierCurveTo(X(2), Y(74), X(-3), Y(74), X(-3), Y(78)); c.closePath();
  };
  c.lineJoin = 'round';
  if (o.refl) { body(); c.fillStyle = o.col; c.fill(); disc(hx, hy, hr, o.col); glyph(g, k, { color: o.col, ol: 0, sh: 0, wave: wv, fn }); return; }
  for (const off of [sh, 0]) {                                        // the hard shadow, then the outline, both in ink: one silhouette for body, head and neck
    c.save(); c.translate(off, off * 1.1);
    body(); c.fillStyle = K.ink; c.fill(); c.strokeStyle = K.ink; c.lineWidth = ol * 2 * sc; c.stroke();
    disc(hx, hy, hr + ol * sc, K.ink); glyph(g, k, { color: K.ink, ol, sh: 0, wave: wv, fn });
    c.restore();
  }
  body(); c.fillStyle = o.col; c.fill(); disc(hx, hy, hr, o.col); glyph(g, k, { color: o.col, ol: 0, sh: 0, wave: wv, fn });
  if (sc < 0.03) return;
  c.strokeStyle = K.ink; c.lineWidth = 2.6 * k * sc; c.lineCap = 'round';                                       // a wing folded on the back
  c.beginPath(); c.moveTo(X(24), Y(87)); c.bezierCurveTo(X(30), Y(64), X(60), Y(62), X(84), Y(80)); c.moveTo(X(36), Y(90)); c.bezierCurveTo(X(44), Y(76), X(60), Y(74), X(74), Y(84)); c.stroke();
  const cs = C(tilt), sn = S(tilt), bk = (x, y) => { const dx = (x - 10.5) * k * sc, dy = (y - 32) * k * sc; return [hx + dx * cs + dy * sn, hy - dx * sn + dy * cs]; };   // the beak, eye and cheek hang off the head, tilting with it
  const b0 = bk(1, 26), b1 = bk(-15, 38), b2 = bk(3, 40);
  c.beginPath(); c.moveTo(b0[0], b0[1]); c.lineTo(b1[0], b1[1]); c.lineTo(b2[0], b2[1]); c.closePath(); c.fillStyle = K.orange; c.fill(); c.lineWidth = 2.8 * k * sc; c.stroke();
  disc(...bk(-3, 32), 1.7 * k * sc, K.ink); disc(...bk(4.5, 39), 3.6 * k * sc, K.pinkL); disc(...bk(13, 28), 3.6 * k * sc, K.ink); disc(...bk(14.2, 26.8), 1.2 * k * sc, K.white);
}

const TWO = {
  color: K.white, bg: K.teal, dur: 2.9,
  back(a, t) {
    const { u, k, w, h, bw, bh } = a, yH = -h * 0.04, sky = E.out(seg(t, 0, 0.4)), top = -bh / 2;
    box(0, (top + yH) / 2, bw, yH - top, K.skyL);                                           // the sky, with a sun and clouds
    rays(w * 0.3, -h * 0.28, 14, u * 2.4, t * 0.12, K.white, 0.4); disc(w * 0.3, -h * 0.28, u * 0.2 * pop(t, 0.05, 0.5), K.yellow);
    for (let i = 0; i < 3; i++) cloud(((-0.3 + i * 0.4) * w - t * u * 0.08 + w * 1.5) % (w * 1.2) - w * 0.6, -h * (0.36 - i * 0.07), u * (0.15 + i * 0.03) * sky, K.white);
    box(0, (yH + bh / 2) / 2, bw, bh / 2 - yH, K.teal);                                     // the water, over the foot of the sky
    band(-bw / 2, bw / 2, yH, h * 0.02, w * 0.7, 2, K.lime, yH + h * 0.05);                   // far bank, and reeds along the near edges
    band(-bw / 2, bw / 2, yH + h * 0.012, h * 0.015, w * 0.4, 0.5, K.green, yH + h * 0.05);
    for (let i = 0; i < 8; i++) {
      const sd = i < 4 ? -1 : 1, j = i & 3, x = sd * (0.36 + 0.06 * j + 0.03 * a.r(i)) * w, gr = pop(t, 0.1 + j * 0.06, 0.45), base = yH + h * 0.07, top2 = base - (0.2 + 0.12 * a.r(i, 1)) * h * gr, sw = S(t * 1.8 + i) * 6 * k;
      pline([x, base, x + sw * 0.4, (base + top2) / 2, x + sw, top2], 7 * k, j & 1 ? K.green : K.greenD);
      if (j & 1) oval(x + sw, top2 + 14 * k, 7 * k, 20 * k * gr, K.orangeD);
    }
    for (let i = 0; i < 6; i++) wave(-bw / 2, bw / 2, yH + h * (0.06 + 0.11 * i * (1 + i * 0.14)), (2 + i) * k, w * (0.22 + i * 0.05), t * (1.4 + i * 0.3) * (i & 1 ? -1 : 1) + i, (3 + i * 0.8) * k, K.tealM);   // ripples on the water
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, s = clamp(w / (u * 2.3), 0.55, 1), ak = a.ak, wy = h * 0.17, off = 15 * k * s, sc = 0.55 * s;
    const glide = tt => lerp(w * (w < h ? 0.27 : 0.22), w * (w < h ? 0.15 : 0.1), seg(tt, 0.2, 2.3)), sx = glide(t), bob = S(t * 3) * h * 0.006, intro = pop(t, 0.02, 0.3), ph = -t * 2.6, hy = wy + bob - 49 * k * s * intro, hxp = sx - off;
    const bow = E.io(seg(t, 1.4, 1.85)) * ak, meet = seg(t, 1.05, 1.85);
    // wake: ripples left behind where the swan has been
    for (let i = 0; i < 9; i++) {
      const tb = 0.25 + i * 0.26, age = t - tb;
      if (age <= 0 || age > 1.5) continue;
      const x0 = glide(tb) - off, r = u * (0.08 + 0.34 * E.out(age / 1.5)), lw = 4 * k * (1 - age / 1.5);
      ell(x0 + u * 0.35 * s, wy + h * 0.005, r * 1.5, r * 0.2, lw, i & 1 ? K.white : K.tealL);
    }
    // where the swan's beak is once it has bowed, and so where the cygnet meets it
    headPose(g, k, { ax: 3.2, kx: 0.07, ph }, bow); const bx = hxp + s * (NK[0] + (-25.5 * C(NK[2]) + 6 * S(NK[2])) * k), by = hy + s * (NK[1] + (25.5 * S(NK[2]) + 6 * C(NK[2])) * k);
    const cxo = lerp(-w * 0.62, bx - 4 * k * s - 62.5 * k * sc + 15 * k * sc, E.out(meet)), cbob = S(t * 3.4 + 1) * h * 0.005, cyo = wy + cbob - 49 * k * sc;
    // the reflections: darker copies, upside down under the waterline
    const c = raw(), live = intro * ak > 0.02;
    if (live) { c.save(); c.translate(hxp, wy + bob); c.scale(s * intro, -s * 0.62 * intro * ak); c.translate(0, -49 * k); swan(g, k, { col: K.tealD, ak, ph, refl: true, ax: 3, kx: 0.3, bow }); c.restore(); }
    if (t > 1.0 && ak > 0.02) { c.save(); c.translate(cxo, wy + cbob); c.scale(-sc * ak, -sc * 0.62 * ak); c.translate(0, -49 * k); swan(g, k, { col: K.tealD, ak: 1, ph: ph + 2, refl: true, ax: 3, kx: 0.3 }); c.restore(); }
    for (let i = 0; i < 6; i++) { const [px, py, pr] = POND[i], gr = pop(t, 0.12 + i * 0.07, 0.4) * ak, rx = pr * u * gr; pad(px * w, py * h, rx, rx * 0.3, 0.3 + i * 1.1); }
    for (const [pi, tb] of LOTUS) { const [px, py, pr] = POND[pi]; lotus(px * w, py * h - pr * u * 0.1, pr * u * 0.75 * ak, E.outBack(seg(t, tb, tb + 0.5))); }
    a.begin(hxp, hy, s * intro, S(t * 1.6) * 0.02, 1, 1);
    swan(g, k, { col: K.white, ak, ph, bow });
    a.end();
    if (t > 1.0 && ak > 0.02) { c.save(); c.translate(cxo, cyo); c.scale(-sc * ak, sc * ak); swan(g, k, { col: K.yellowL, ak: 1, ph: ph + 2 }); c.restore(); }
    if (ak > 0.02) for (let i = 0; i < 3; i++) dragonfly(w * (DRAGON[i][0] + 0.07 * S(t * (0.9 + i * 0.2) + i * 2.1)), h * (DRAGON[i][1] + 0.05 * S(t * (1.4 + i * 0.3) + i * 1.7)), u * 0.1 * ak, 0.3 * C(t * 1.1 + i), t + i, DRAGON[i][2]);
    for (let i = 0; i < 6; i++) {                                       // hearts float up where the two meet
      const tb = 1.8 + i * 0.1, p = seg(t, tb, tb + 1.0);
      if (p > 0 && p < 1) heart(bx - 8 * k * s + S(p * 5 + i * 2) * u * 0.08 + (i - 2.5) * u * 0.03, by - p * u * 0.5 - u * 0.05, u * 0.075 * pop(t, tb, 0.3) * (1 - p * p) * ak, S(p * 4 + i) * 0.4, [K.pink, K.red, K.magenta][i % 3]);
    }
  },
};

/* ---------- 3: the 3 juggles three balls in a cascade, riding a big ball under the big top; hoops pop in on 1, 2, 3 ---------- */
const J_B = 0.34, J_F = 0.72, J_T0 = 0.55, J_H = 98;               // a throw every J_B seconds, alternating hands; each flight lasts J_F and rises J_H glyph units
const J_BALL = [K.pink, K.lime, K.sky], J_BALLL = [K.pinkL, K.limeL, K.skyL];
const J_HOOP = [[-0.36, -0.1, K.red, 0.4], [0.36, -0.1, K.white, 0.72], [0, 0, K.orange, 1.04]];       // hoops: position (of w, h; the last is worked out to sit where the balls peak), colour, when it pops in
const JH = [0, 0], JB = [0, 0];                                     // shared results: a hand's and a ball's place, in glyph units

// where a hand is (0 left, 1 right) at time tt: the hands bob in opposite time, up to throw and down to catch
function jhand(hh, tt) {
  const sd = hh ? 1 : -1;
  JH[0] = 30 + sd * 46; JH[1] = lerp(62 + S(tt * 6 + hh) * 2, 62 - sd * 9 * C(PI * Math.max(0, tt - J_T0) / J_B), sat((tt - J_T0 + 0.15) / 0.15));
}
// where ball i is at time tt: in a hand until it is thrown, then in a parabola to the other hand
function jball(i, tt) {
  const m = Math.floor((tt - J_T0) / J_B);
  let hh = i & 1, n = -1;
  if (m >= i) { n = i + 3 * Math.floor((m - i) / 3); hh = n & 1; }
  if (n >= 0) {
    const ts = J_T0 + n * J_B, p = (tt - ts) / J_F;
    if (p < 1) {
      jhand(hh, ts); const xa = JH[0], ya = JH[1]; jhand(1 - hh, ts + J_F);
      JB[0] = lerp(xa, JH[0], p); JB[1] = lerp(ya, JH[1], p) - J_H * 4 * p * (1 - p);
      return;
    }
    hh = 1 - hh;                                                      // caught: it rides in the other hand until it is thrown again
  }
  jhand(hh, tt); JB[0] = JH[0] + (i === 2 ? (hh ? 5 : -5) : 0); JB[1] = JH[1] - 10 - (i === 2 ? 6 : 0);
}

const THREE = {
  color: K.yellow, bg: K.indigo, dur: 2.9,
  back(a, t) {
    const { u, k, w, h, bw, bh } = a, fy = h * 0.32, rw = Math.min(w * 0.5, u * 1.15), rh = h * 0.12, R = Math.hypot(bw, bh) / 2, r1 = pop(t, 0.05, 0.5);
    rays(0, -h * 0.75, 22, R * 1.4, 0, K.indigoM, 0.5);                       // the tent's seams, meeting at the peak
    alpha(0.14); poly([-u * 0.2, -h * 0.9, u * 0.2, -h * 0.9, u * 0.95, fy, -u * 0.95, fy], K.white); alpha(1);       // the spotlight
    oval(0, fy, rw * r1, rh * r1, K.red); oval(0, fy, rw * 0.95 * r1, rh * 0.86 * r1, K.white); oval(0, fy, rw * 0.9 * r1, rh * 0.78 * r1, K.yellowL);     // the ring: a red curb round a sandy floor
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, vs = tall(a), s = Math.min(0.64 * vs, 0.9), ak = a.ak, fy = h * 0.32, on = t > J_T0, intro = pop(t, 0.02, 0.3);
    const bp = on ? Math.abs(S(PI * (t - J_T0) / (2 * J_B))) : 0, sqz = on ? 1 - bp : 0, Rb = 0.15 * u * ak * intro;
    const bx = w * 0.07 * S(t * 1.9) * ak, by = fy - Rb * 0.85 - bp * u * 0.02, y0 = by - Rb - 60 * k * s * (1 - 0.05 * sqz) - bp * u * 0.02;
    for (const [hx, hy, col, tp] of J_HOOP) {                                // hoops, spinning about their vertical axis
      const p = pop(t, tp, 0.4) * ak, r = u * (hx ? 0.2 : 0.14) * p, sq = 0.4 + 0.6 * Math.abs(C(t * 2.6 + tp * 7)), x = hx * w, y = hx ? hy * h : fy - 0.2775 * u - (48 + J_H) * k * s;
      ell(x, y, r * sq, r, 9 * k + 6, K.ink); ell(x, y, r * sq, r, 9 * k, col);
      spray(a, t, { x, y, n: a.n(10), t0: tp, life: 0.9, v0: u * 0.5, v1: u * 1.4, g: 900, seed: 500 + tp * 90, cols: [col, K.yellow, K.white, K.pink] });
    }
    oval(bx, fy + 2 * k, Rb * 1.1, Rb * 0.2, K.indigoD);                    // the big ball, its stripes turning as it rolls
    if (Rb > 2) {
      const rot = bx / Rb;
      discO(bx, by, Rb, K.white, 3 * k * intro);
      for (let i = 0; i < 4; i++) pie(bx, by, Rb, rot + i * PI / 2, rot + i * PI / 2 + PI / 4, K.red);
      disc(bx, by, Rb * 0.16, K.yellow);
    }
    a.begin(bx, y0, s * intro, 0.03 * S(t * 4.5) * (on ? 1 : 0), 1 + 0.03 * sqz, 1 - 0.05 * sqz);
    if (ak > 0.02) {
      for (const sd of [-1, 1]) {                                                // legs and shoes, pedalling
        const fx = gx(g, k, 30 + sd * 9) + S(t * 6 + sd * 1.4) * 4 * k * ak, fy2 = gy(k, 104), l = 8 * k * ak;
        limbO(gx(g, k, 30 + sd * 9), gy(k, 90), fx + sd * 3 * k, fy2 - 6 * k * ak, l, l, sd, 6 * k * ak, K.yellow, 3 * k * ak);
        ovalO(fx + sd * 8 * k * ak, fy2 + 1 * k * ak, 11 * k * ak, 6 * k * ak, K.orange, 0, 3 * k * ak);
      }
      for (const sd of [-1, 1]) {                                                // arms, from the waist out to the hands
        jhand(sd < 0 ? 0 : 1, t);
        limbO(gx(g, k, 30 + sd * 6), gy(k, 50), gx(g, k, JH[0]), gy(k, JH[1]), 30 * k * ak, 30 * k * ak, sd, 7 * k * ak, K.yellow, 3.2 * k * ak);
      }
    }
    glyph(g, k, { color: K.yellow });
    const c = raw();                                                             // a clown hat, tipped
    if (ak > 0.05) {
      c.beginPath(); c.moveTo(gx(g, k, 30 - 18 * ak), gy(k, 3)); c.lineTo(gx(g, k, 30 + 12 * ak), gy(k, 0)); c.lineTo(gx(g, k, 30 + 4 * ak), gy(k, 3 - 37 * ak)); c.closePath();
      c.lineJoin = 'round'; c.strokeStyle = K.ink; c.lineWidth = 6 * k * ak; c.stroke(); c.fillStyle = K.red; c.fill(); discO(gx(g, k, 30 + 4 * ak), gy(k, 3 - 39 * ak), 5.5 * k * ak, K.white, 2.4 * k * ak);
    }
    if (ak > 0.02) for (const sd of [-1, 1]) { jhand(sd < 0 ? 0 : 1, t); discO(gx(g, k, JH[0]), gy(k, JH[1]), 8 * k * ak, K.white, 3 * k * ak); }
    for (let i = 0; i < 3; i++) {                                                // the balls, each with a fading trail
      const pr = pop(t, 0.3 + i * 0.12, 0.35) * ak;
      if (pr < 0.02) continue;
      c.fillStyle = J_BALLL[i]; c.beginPath();
      for (let j = 4; j >= 1; j--) { jball(i, t - j * 0.04); addDisc(gx(g, k, JB[0]), gy(k, JB[1]), (12 - j * 1.8) * k * pr); }
      c.fill();
      jball(i, t); const bx2 = gx(g, k, JB[0]), by2 = gy(k, JB[1]);
      discO(bx2, by2, 12 * k * pr, J_BALL[i], 3 * k * pr); disc(bx2 - 4.4 * k * pr, by2 - 4.4 * k * pr, 3.4 * k * pr, K.white);
    }
    a.end();
    if (ak > 0.02) for (let n = Math.max(0, Math.floor((t - J_T0 - J_F) / J_B) - 1); n <= Math.floor((t - J_T0 - J_F) / J_B); n++) {         // a twinkle in the hand that catches each ball
      const tc = J_T0 + n * J_B + J_F, p = seg(t, tc, tc + 0.22);
      if (p > 0 && p < 1) { jhand(1 - (n & 1), tc); spark(bx + (JH[0] - 30) * k * s, y0 + (JH[1] - 60) * k * s, u * 0.09 * S(p * PI), n, n & 1 ? K.white : K.yellow); }
    }
    fall(a, t, { n: a.n(24), t0: 1.0, cols: [K.pink, K.yellow, K.lime, K.white, K.sky], seed: 700 });
  },
};

/* ---------- 4: four colour-block quadrants bounce in one after another, a season each, while the 4 turns in the middle ---------- */
const F_T = [0.06, 0.28, 0.5, 0.72], F_TURN = [0.7, 1.1, 1.5, 1.9];      // when each quadrant bounces in, and when the 4 makes each of its quarter turns
const F_Q = [[-1, -1, K.lime, K.limeL], [1, -1, K.yellow, K.yellowL], [1, 1, K.orange, K.orangeL], [-1, 1, K.sky, K.skyL]];      // spring, summer, autumn, winter
const F_LEAF = [K.red, K.yellow, K.orangeD, K.redD, K.yellowL];

// a butterfly: a slim body and four wings that beat
function butterfly(x, y, r, t, col, col2) {
  if (r < 1) return;
  const f = 0.25 + 0.75 * Math.abs(S(t * 13));
  line(x, y - r * 0.5, x, y + r * 0.5, r * 0.16, K.ink);
  for (const sd of [-1, 1]) { oval(x + sd * r * 0.55 * f, y - r * 0.28, r * 0.6 * f + 0.1, r * 0.42, col, sd * 0.5); oval(x + sd * r * 0.4 * f, y + r * 0.3, r * 0.42 * f + 0.1, r * 0.3, col2, -sd * 0.4); }
}
// a six-armed snowflake
function snowflake(x, y, r, rot, lw) {
  if (r < 1) return;
  const c = raw(); c.strokeStyle = K.white; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i < 3; i++) { const an = rot + i * PI / 3; c.moveTo(x - C(an) * r, y - S(an) * r); c.lineTo(x + C(an) * r, y + S(an) * r); }
  c.stroke();
}
// a snowman, a hat on top, hopping
function snowman(x, y, r, sq) {
  discO(x, y + r * 0.55, r * 0.4 * (1 + 0.08 * sq), K.white, r * 0.04); discO(x, y + r * 0.02, r * 0.29, K.white, r * 0.04); discO(x, y - r * 0.4, r * 0.21, K.white, r * 0.04);
  boxO(x, y - r * 0.6, r * 0.34, r * 0.05, K.ink, 0, 0, r * 0.03); boxO(x, y - r * 0.73, r * 0.22, r * 0.2, K.ink, 0, 0, r * 0.03); box(x, y - r * 0.65, r * 0.22, r * 0.04, K.red);
  box(x, y - r * 0.24, r * 0.4, r * 0.08, K.red, 0, r * 0.04); box(x + r * 0.16, y - r * 0.12, r * 0.08, r * 0.2, K.red, 0.1, r * 0.03);
  tri(x + r * 0.17, y - r * 0.4, r * 0.09, 0, K.orange); disc(x - r * 0.07, y - r * 0.45, r * 0.03, K.ink); disc(x + r * 0.07, y - r * 0.45, r * 0.03, K.ink);
  for (let i = 0; i < 3; i++) disc(x, y + r * (0.13 + 0.16 * i), r * 0.035, K.ink);
}

const FOUR = {
  color: K.white, bg: K.pink, dur: 2.9,
  back(a, t) {
    const { u, bw, bh } = a, gap = u * 0.022, W = bw / 2 - gap, H = bh / 2 - gap;
    F_Q.forEach(([sx, sy, col], i) => {                                          // the four blocks burst out of the middle, each with a bounce
      const p = pop(t, F_T[i], 0.5) * (1 + 0.035 * boing(t - F_TURN[i] - 0.08));
      if (p > 0.01) box(sx * (gap + W / 2) * p, sy * (gap + H / 2) * p, W * p, H * p, col, 0, u * 0.1 * p);
    });
    disc(0, 0, u * 0.44 * pop(t, 0.02, 0.4), K.pink);                          // a hub for the 4
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, qx = Math.min(w * 0.27, u * 0.85), qy = h * 0.26, r = Math.min(qx * 0.9, qy * 0.95);
    F_Q.forEach(([sx, sy, , lite], i) => {                                       // a lighter disc behind each season's picture
      const cx = sx * qx, cy = sy * qy, p = pop(t, F_T[i] + 0.12, 0.5);
      if (p < 0.02) return;
      disc(cx, cy, r * 1.02 * p, lite);
      if (i === 0) {                                                             // spring: a flower blooms in the rain
        const gr = pop(t, F_T[0] + 0.2, 0.5), bl = pop(t, F_T[0] + 0.5, 0.5), fx = cx + S(t * 2) * r * 0.03, fy = cy - r * 0.18 * gr;
        if (gr > 0.02) line(cx, cy + r * 0.85, fx, lerp(cy + r * 0.85, fy, gr), r * 0.075 * gr, K.greenD);
        leaf(cx - r * 0.24, cy + r * 0.45, r * 0.3 * gr, -1.0, K.green); leaf(cx + r * 0.24, cy + r * 0.6, r * 0.26 * gr, 1.0, K.green);
        flower(fx, fy, r * 0.62 * bl, t * 0.4, 8, K.magenta, K.magenta); flower(fx, fy, r * 0.5 * bl, t * 0.4 + PI / 8, 8, K.pink, K.pink); discO(fx, fy, r * 0.17 * bl, K.yellow, r * 0.03 * bl);
        for (let j = 0; j < 2; j++) butterfly(cx + r * (0.62 + 0.1 * j) * C(t * 1.4 + j * 3), cy - r * (0.2 + 0.32 * j) + r * 0.22 * S(t * 2.1 + j * 2), r * 0.26 * bl, t + j, j ? K.yellow : K.white, j ? K.orange : K.pinkL);
        const cp = pop(t, F_T[0] + 0.4, 0.4); cloud(cx - r * 0.5, cy - r * 0.78, r * 0.26 * cp, K.white);
        for (let j = 0; j < 4; j++) { const q = (t * 0.9 + j * 0.25) % 1; if (cp > 0.5) drop(cx - r * (0.78 - j * 0.15), cy - r * 0.62 + q * r * 1.3, r * 0.045, PI, K.sky); }
      } else if (i === 1) {                                                      // summer: a sun in shades, its rays turning
        const sp = pop(t, F_T[1] + 0.2, 0.5);
        rays(cx, cy, 14, r * 0.95 * sp, t * 0.7, K.orange, 0.5); discO(cx, cy, r * 0.5 * sp, K.orange, r * 0.04 * sp);
        for (const d of [-1, 1]) oval(cx + d * r * 0.2, cy - r * 0.06, r * 0.17 * sp, r * 0.12 * sp, K.ink); if (sp > 0.02) line(cx - r * 0.06 * sp, cy - r * 0.08, cx + r * 0.06 * sp, cy - r * 0.08, r * 0.03 * sp, K.ink);
        arcS(cx, cy + r * 0.06, r * 0.26 * sp, 0.15 * PI, 0.85 * PI, r * 0.05, K.ink);
        for (let j = 0; j < 4; j++) { const q = seg((t + j * 0.31) % 1.2, 0, 0.6); if (sp > 0.9 && q > 0 && q < 1) spark(cx + C(j * 1.7 + 0.5) * r * 0.8, cy + S(j * 1.7 + 0.5) * r * 0.8, r * 0.14 * S(q * PI), j, K.white); }
      } else if (i === 2) {                                                      // autumn: leaves tumbling down round a big red one
        const lp = pop(t, F_T[2] + 0.2, 0.5);
        if (lp > 0.02) { star(cx, cy, r * 0.5 * lp + r * 0.03, 5, r * 0.26 * lp, t * 0.6 - PI / 2, K.ink); star(cx, cy, r * 0.46 * lp, 5, r * 0.24 * lp, t * 0.6 - PI / 2, K.red); }
        for (let j = 0; j < 9; j++) { const q = (t * 0.5 + a.r(j, 1)) % 1; if (lp > 0.5) leaf(cx + (a.r(j, 2) - 0.5) * r * 1.7 + S(t * 2 + j) * r * 0.1, cy - r * 1.05 + q * r * 2.1, r * 0.13, t * 2 + j, F_LEAF[j % 5], K.orangeD); }
      } else {                                                                   // winter: a snowman hops on a snowy hill
        oval(cx, cy + r * 1.05, r * 1.3, r * 0.5, K.white);
        const sp = pop(t, F_T[3] + 0.2, 0.5), hp = Math.abs(S(t * 4.2)); snowman(cx, cy - r * 0.05 - hp * r * 0.12, r * 0.85 * sp, 1 - hp);
        for (let j = 0; j < 3; j++) snowflake(cx + (a.r(j, 3) - 0.5) * r * 1.6, cy - r * 0.9 + (((t * 0.35 + j / 3) % 1) * r * 2), r * 0.11 * sp, t + j, r * 0.03);
      }
    });
    fall(a, t, { n: a.n(14), t0: 1.0, x0: -qx * 1.2, x1: -qx * 0.2, y0: qy * 0.2, y1: qy * 1.6, shape: 'dot', cols: [K.white], vy0: 60, vy1: 140, s0: 5, s1: 9, sway: 12, seed: 40 });
    const turn = F_TURN.reduce((m, tt) => m + E.outBack(seg(t, tt, tt + 0.34)), 0), tb = F_TURN.reduce((m, tt) => m + boing(t - tt - 0.3) * 0.5, 0);
    const bounce = F_TURN.reduce((m, tt) => Math.max(m, Math.abs(S(PI * seg(t, tt - 0.05, tt + 0.34)))), 0);
    F_TURN.forEach((tt, i) => { const p = seg(t, tt, tt + 0.34); if (p > 0 && p < 1) arcS(0, 0, u * 0.47, i * PI / 2 - PI * 0.6, i * PI / 2 - PI * 0.6 + PI / 2 * (0.4 + 0.6 * p) + PI * 0.3 * p, u * 0.035 * (1 - p) + 1, K.white); });          // a swoosh follows each quarter turn round the hub
    a.begin(0, -bounce * u * 0.05, 0.85 * pop(t, 0.02, 0.3), (turn * PI / 2) % TAU, 1 + 0.06 * tb, 1 - 0.06 * tb);
    glyph(g, k, { color: K.white });
    a.end();
  },
};

/* ---------- 5: two big hands fly in from both sides and high-five with the 5 between them, then again, bigger ---------- */
const H_T1 = 0.55, H_T2 = 1.6;                                      // when the two slaps land
const H_FING = [[-0.36, 0.64, -0.24], [-0.12, 0.78, -0.08], [0.12, 0.72, 0.08], [0.36, 0.54, 0.24]];      // fingers: where they start across the palm (of hs), how long, how far they fan out

// how far the palm's centre is from the middle: it rushes in, is slapped back, winds up and rushes in again
function handD(t, far, cl, hs) {
  if (t < H_T1) return lerp(far, cl, E.in(seg(t, 0.05, H_T1)));
  if (t < H_T2 - 0.45) return cl + hs * 0.5 * E.out(seg(t, H_T1, H_T1 + 0.22)) + hs * 0.03 * S(t * 11);
  if (t < H_T2 - 0.12) return lerp(cl + hs * 0.5, cl + hs * 1.5, E.io(seg(t, H_T2 - 0.45, H_T2 - 0.12)));
  if (t < H_T2) return lerp(cl + hs * 1.5, cl, E.in(seg(t, H_T2 - 0.12, H_T2)));
  return cl + hs * 0.4 * E.out(seg(t, H_T2, H_T2 + 0.25)) + hs * 0.03 * S(t * 11);
}
// an open hand in the current frame: palm centred on the origin, fingers up, thumb on the -x side, hs wide; wig wiggles the fingers
function hand(hs, t, wig, sleeve) {
  const c = raw(), ol = hs * 0.045, fw = hs * 0.25, ph = hs * 0.95;
  boxO(0, hs * 2.1, hs * 0.62, hs * 3.2, sleeve, 0, hs * 0.1, ol); boxO(0, hs * 0.66, hs * 0.66, hs * 0.2, K.red, 0, hs * 0.05, ol);     // the sleeve, and its cuff
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {                                                  // one outline round the whole hand: ink first, then skin
    if (pass === 0) box(0, 0, hs + ol * 2, ph + ol * 2, K.ink, 0, hs * 0.3 + ol);
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const f = H_FING[i], an = f[2] + wig * 0.16 * S(t * 19 + i * 1.4), bx = f[0] * hs, by = -hs * 0.32;
      c.moveTo(bx, by); c.lineTo(bx + S(an) * f[1] * hs, by - C(an) * f[1] * hs);
    }
    const ta = -1.15 + wig * 0.12 * S(t * 17 + 2);
    c.moveTo(-hs * 0.42, hs * 0.02); c.lineTo(-hs * 0.42 + S(ta) * hs * 0.56, hs * 0.02 - C(ta) * hs * 0.56);
    c.strokeStyle = pass ? K.yellow : K.ink; c.lineWidth = fw + (pass ? 0 : ol * 2); c.stroke();
    if (pass) box(0, 0, hs, ph, K.yellow, 0, hs * 0.3);
  }
  line(-hs * 0.12, -hs * 0.05, hs * 0.14, hs * 0.02, hs * 0.035, K.yellowD);
}

const FIVE = {
  color: K.pink, bg: K.blue, dur: 2.9,
  back(a, t) {
    const { u, k, w, h, bw, bh } = a, c = raw(), R = Math.hypot(bw, bh) / 2;
    c.fillStyle = K.blueM; c.beginPath();                                          // halftone dots, big in the middle
    for (let iy = -5; iy <= 5; iy++) for (let ix = -8; ix <= 8; ix++) { const x = ix * u * 0.32 + (iy & 1) * u * 0.16, y = iy * u * 0.3, d = Math.hypot(x / w, y / h) * 1.7, r = u * 0.1 * sat(1 - d) * pop(t, 0.05, 0.5); if (r > 0.5) addDisc(x, y - h * 0.05, r); }
    c.fill();
    for (const tt of [H_T1, H_T2]) { const p = seg(t, tt, tt + 0.5); if (p > 0 && p < 1) rays(0, -h * 0.05, 36, R, tt, K.blueL, 0.16 * (1 - p)); }      // action lines at each slap
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, hs0 = Math.min(0.46 * u, w * 0.3), bu = Math.min(u, w * 0.55), hs = hs0 * (1 + 0.18 * E.io(seg(t, 1.1, 1.5))), cy = -0.05 * u, far = w * 0.5 + hs * 1.6, cl = hs * 0.6;
    const T = [H_T1, H_T2];
    for (const sd of [-1, 1]) {
      const D = handD(t, far, cl, hs), D1 = handD(t - 0.03, far, cl, hs), sp = sat((D1 - D) / 0.03 / (hs * 14)), tilt = lerp(0.95, 0.42, sat((far - D) / (far - cl))) + 0.1 * S(t * 9);
      if (sp > 0.03) for (let j = 0; j < 4; j++) line(sd * (D + hs * (0.8 + j * 0.16)), cy + (j - 1.5) * hs * 0.32, sd * (D + hs * (0.8 + j * 0.16 + 1.6 * sp)), cy + (j - 1.5) * hs * 0.32, hs * 0.05 * sp, K.white);     // speed lines behind the hand
      const c = raw(); c.save(); c.translate(sd * D, cy); c.scale(-sd, 1); c.rotate(tilt);
      hand(hs, t, seg(t, H_T1, 2.4), K.white);
      c.restore();
    }
    for (let n = 0; n < 2; n++) {                                                  // the slap: a starburst, shock rings and clap lines
      const tt = T[n], big = 1 + 0.6 * n, p = seg(t, tt, tt + 0.6);
      spray(a, t, { x: 0, y: cy, n: a.n(16 + 8 * n), t0: tt, life: 1.1, v0: u * 0.9, v1: u * 2.4, g: 900, shape: 'star', s0: 8, s1: 18, seed: 200 + n * 50, cols: [K.yellow, K.white, K.pinkL, K.limeL, K.orange] });
      pulse(0, cy, t, tt, 0.5, bu * 0.9 * big, u * 0.05, K.white); pulse(0, cy, t, tt + 0.06, 0.5, bu * 1.25 * big, u * 0.035, K.yellow); pulse(0, cy, t, tt + 0.12, 0.5, bu * 1.6 * big, u * 0.022, K.white);
      if (p > 0 && p < 1) {
        const r = bu * 0.62 * big * E.outBack(sat(p * 4)) * (1 - E.in(seg(p, 0.35, 1)));
        star(0, cy, r, 14, r * 0.62, tt * 3, K.white); star(0, cy, r * 0.78, 14, r * 0.5, tt * 3 + 0.2, K.yellow); star(0, cy, r * 0.5, 12, r * 0.32, tt * 3 + 0.4, K.orange);
        for (let i = 0; i < 12; i++) { const an = i / 12 * TAU + 0.13, r0 = bu * 0.7 * big * (0.95 + 0.4 * E.out(p)); line(C(an) * r0, cy + S(an) * r0, C(an) * (r0 + bu * 0.2 * big * (1 - p)), cy + S(an) * (r0 + bu * 0.2 * big * (1 - p)), u * 0.025 * (1 - p), K.white); }
      }
    }
    for (let i = 0; i < 6; i++) { const q = pop(t, H_T2 + 0.25 + i * 0.05, 0.3) * a.ak, an = t * 3 + i * TAU / 6; star(C(an) * bu * 0.62, cy + S(an) * bu * 0.42, bu * 0.06 * q, 5, bu * 0.026 * q, an * 2, i & 1 ? K.white : K.yellow); }        // stars circle the 5
    const sqz1 = boing(t - H_T1), sqz2 = boing(t - H_T2), j1 = seg(t, H_T1 + 0.08, H_T1 + 0.6), j2 = seg(t, H_T2 + 0.08, H_T2 + 0.75), lift = u * (0.14 * 4 * j1 * (1 - j1) + 0.26 * 4 * j2 * (1 - j2));
    const sq = t < H_T2 ? sqz1 : sqz2, spin = j2 > 0 && j2 < 1 ? TAU * E.io(j2) : 0, sc = Math.min(0.92, 0.92 * w / (u * 1.5)) * pop(t, 0.02, 0.3) * (1 + 0.12 * E.out(seg(t, H_T1, H_T1 + 0.1)) * (1 - E.io(seg(t, H_T1 + 0.1, H_T1 + 0.5))));
    a.begin(0, cy + u * 0.05 - lift, sc, spin, 1 - 0.28 * sq + 0.06 * S(PI * j1) + 0.06 * S(PI * j2), 1 + 0.26 * sq - 0.08 * S(PI * j1) - 0.08 * S(PI * j2));
    glyph(g, k, { color: K.pink });
    a.end();
  },
};

/* ---------- 6: the 6 is a snail: its loop is the shell; it inches along leaving a shiny trail, flowers and mushrooms pop up behind it, then it zooms off ---------- */
const SN_T0 = 0.15, SN_T1 = 1.6, SN_T2 = 1.78, SN_T3 = 2.3;         // the crawl starts, ends, the wind-up ends, the dash ends
const SN_PROPS = [-0.24, -0.12, 0, 0.11, 0.2, 0.3];                 // where (of w) a flower or mushroom waits by the path; they alternate
const SN_LEAF = [K.pink, K.white, K.orange, K.pinkL, K.yellowL, K.magenta];
const RAINBOW = [K.red, K.orange, K.yellow, K.lime, K.sky, K.violet];

// how far along the snail is: a steady crawl, a step back to wind up, then an accelerating dash
function snailX(t, w) {
  const X0 = -w * 0.3, X1 = w * 0.06, Xb = X1 - w * 0.03, X2 = w * 0.22;
  if (t < SN_T1) return lerp(X0, X1, seg(t, SN_T0, SN_T1));
  if (t < SN_T2) return lerp(X1, Xb, E.io(seg(t, SN_T1, SN_T2)));
  return lerp(Xb, X2, E.in(seg(t, SN_T2, SN_T3)));
}
// when the snail gets to x: props pop up right behind it
function snailPass(x, w) {
  const X0 = -w * 0.3, X1 = w * 0.06, Xb = X1 - w * 0.03, X2 = w * 0.22;
  return x <= X1 ? lerp(SN_T0, SN_T1, (x - X0) / (X1 - X0)) : lerp(SN_T2, SN_T3, Math.cbrt((x - Xb) / (X2 - Xb)));
}
// the snail's foot and head, stretched by the gait: head pushes forward by hd, tail follows by tl (glyph units)
function snailBody(k, hd, tl) {
  const c = raw(), X = x => (x + lerp(tl, hd, sat((x + 16) / 124)) - 33) * k, Y = y => (y - 50) * k;
  c.beginPath(); c.moveTo(X(-16), Y(106));
  c.bezierCurveTo(X(-6), Y(96), X(4), Y(92), X(14), Y(92)); c.lineTo(X(60), Y(88)); c.bezierCurveTo(X(72), Y(86), X(80), Y(72), X(92), Y(72));
  c.bezierCurveTo(X(104), Y(72), X(110), Y(82), X(108), Y(90)); c.bezierCurveTo(X(107), Y(100), X(104), Y(108), X(94), Y(108)); c.lineTo(X(6), Y(108)); c.bezierCurveTo(X(-4), Y(108), X(-12), Y(108), X(-16), Y(106)); c.closePath();
}
// a mushroom or a flower standing on the ground at (x, y), r tall
function sprout(x, y, r, kind, col, t) {
  if (r < 1) return;
  if (kind) { box(x, y - r * 0.28, r * 0.24, r * 0.56, K.cream, 0, r * 0.08); pie(x, y - r * 0.5, r * 0.5, PI, TAU, col); box(x, y - r * 0.5, r, r * 0.06, K.redD); disc(x - r * 0.2, y - r * 0.68, r * 0.09, K.white); disc(x + r * 0.16, y - r * 0.6, r * 0.07, K.white); }
  else { line(x, y, x + S(t * 2 + x) * r * 0.05, y - r * 0.62, r * 0.09, K.greenD); flower(x + S(t * 2 + x) * r * 0.05, y - r * 0.7, r * 0.42, t * 0.6, 6, col, K.yellow); }
}

const SIX = {
  color: K.purple, bg: K.yellow, dur: 2.9,
  back(a, t) {
    const { u, k, w, h, bw, bh } = a, fy = h * 0.3, c = raw();
    rays(-w * 0.3, -h * 0.3, 16, u * 2.6, t * 0.15, K.yellowL, 0.4); disc(-w * 0.3, -h * 0.3, u * 0.24 * pop(t, 0.05, 0.5), K.orange);
    const rr = Math.min(w * 0.42, u * 0.9), rp = E.out(seg(t, 0.15, 1.0));                                     // a rainbow paints itself across the sky
    for (let i = 0; i < 6; i++) arcS(w * 0.1, fy - h * 0.05, rr - i * u * 0.05, PI, PI + PI * rp, u * 0.052, RAINBOW[i], 'butt');
    for (let i = 0; i < 3; i++) cloud(((0.1 + i * 0.4) * w - t * u * 0.1 + w * 1.5) % (w * 1.3) - w * 0.65, -h * (0.34 - i * 0.08), u * (0.16 + i * 0.03), K.white);
    band(-bw / 2, bw / 2, fy - h * 0.12, h * 0.03, w * 0.8, 1.5, K.lime, bh / 2); band(-bw / 2, bw / 2, fy - h * 0.06, h * 0.025, w * 0.5, 4, K.green, bh / 2);    // hills
    box(0, (fy + bh / 2) / 2, bw, bh / 2 - fy, K.greenD);                                                          // the path
    box(0, fy + 3 * k, bw, 6 * k, K.limeD);
    c.fillStyle = K.green; c.beginPath();                                                                            // polka dots on the path, and tufts of grass along its edge
    for (let iy = 1; iy <= 5; iy++) for (let ix = -12; ix <= 12; ix++) addDisc(ix * u * 0.3 + (iy & 1) * u * 0.15, fy + iy * h * 0.07, u * 0.02 * iy);
    for (let i = -14; i <= 14; i++) { const x = i * u * 0.24; c.moveTo(x - 8 * k, fy); c.lineTo(x, fy - 16 * k * (0.7 + 0.3 * S(i * 3.1))); c.lineTo(x + 8 * k, fy); c.closePath(); }
    c.fill();
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, s = clamp(w * 0.62 / (126 * k), 0.5, 0.8), ak = a.ak, fy = h * 0.3, intro = pop(t, 0.02, 0.3);
    const x = snailX(t, w), sp = sat((snailX(t, w) - snailX(t - 0.03, w)) / 0.03 / (w * 1.4)), dash = seg(t, SN_T2, SN_T3), c = raw();
    const ph = t * 2.6, hd = 9 * S(TAU * ph) * (1 - dash) + 14 * dash, tl = 9 * S(TAU * ph - 1.5) * (1 - dash) - 10 * dash;       // the gait: head reaches, tail catches up
    const sq = 0.06 * S(TAU * ph - 0.8) * (1 - dash) + 0.16 * seg(t, SN_T1, SN_T2) * (1 - dash), yc = fy - 56 * k * s;
    // the slime trail: shiny, and it twinkles
    if (t > SN_T0) {
      const x0 = -w * 0.3 - 6 * k, x1 = x - 14 * k * s;
      line(x0, fy - 4 * k, x1, fy - 4 * k, 12 * k, K.skyL); line(x0, fy - 7 * k, x1, fy - 7 * k, 4 * k, K.white);
      for (let i = 0; i < 6; i++) { const q = seg((t * 1.3 + i * 0.37) % 1, 0, 1), sx = lerp(x0, x1, a.r(i, 1)); if (sx < x1 - 20 * k && sx > x0) spark(sx, fy - 4 * k - 6 * k * a.r(i, 2), 12 * k * S(q * PI), i + t, K.white); }
    }
    SN_PROPS.forEach((px, i) => { const tp = snailPass(px * w, w) - 0.05, r = u * (0.16 + 0.05 * a.r(i, 3)) * pop(t, tp, 0.4); sprout(px * w, fy + 2 * k, r, i & 1, i & 1 ? K.red : SN_LEAF[i], t); });
    if (t > SN_T2) {                                                                       // dust puffs and speed lines
      c.fillStyle = K.cream; c.beginPath();
      for (let j = 0; j < 9; j++) { const tb = SN_T2 + j * 0.06, age = t - tb; if (age > 0 && age < 0.55) addDisc(snailX(tb, w) - 22 * k * s - age * u * 0.15, fy - 10 * k - age * u * 0.16 - (j & 1) * 6 * k, u * 0.06 * (1 + 2 * age) * (1 - age / 0.55)); }
      c.fill();
      if (sp > 0.03) for (let j = 0; j < 5; j++) line(x - u * 0.2 * s - j * u * 0.03, fy - 20 * k - j * 22 * k * s, x - u * (0.5 + 0.8 * a.r(j, 5)) * sp * 1.5 - u * 0.2, fy - 20 * k - j * 22 * k * s, u * 0.02 * sp, K.white);
    }
    a.begin(x, yc, s * intro, -0.14 * dash, 1 + sq + 0.25 * dash, 1 - sq * 0.9 - 0.05 * dash);
    if (ak > 0.02) {                                                                    // the body, which shrinks away into the letter as it lands
      c.save(); c.scale(ak, ak);
      for (const off of [4.6 * k, 0]) {                                                 // the foot: hard shadow, then outline, then skin
        c.save(); c.translate(off, off * 1.1); snailBody(k, hd, tl); c.fillStyle = K.ink; c.fill(); c.strokeStyle = K.ink; c.lineWidth = 8.4 * k; c.lineJoin = 'round'; c.stroke(); c.restore();
      }
      snailBody(k, hd, tl); c.fillStyle = K.orangeL; c.fill();
      for (const [ex, tx] of [[88, 84], [98, 101]]) {                                   // eyestalks with eyes that look ahead and blink
        const bx = (ex + hd - 33) * k, by = (74 - 50) * k, tx2 = (tx + hd - 33 + 4 * S(t * 5 + ex)) * k, ty = (2 + 3 * S(t * 4 + ex)) * k, bl = (t + ex) % 2.3 < 0.1 ? 0.15 : 1;
        c.lineCap = 'round'; c.strokeStyle = K.ink; c.lineWidth = 8 * k; c.beginPath(); c.moveTo(bx, by); c.lineTo(tx2, ty); c.stroke(); c.strokeStyle = K.orangeL; c.lineWidth = 4.2 * k; c.stroke();
        oval(tx2, ty, 10.5 * k, 10.5 * k * bl, K.ink); eye(tx2, ty, 8 * k, 0.7, 0.1 + 0.2 * S(t * 3), K.white, K.ink, bl);
      }
      arcS((hd + 98 - 33) * k, (86 - 50) * k, 6 * k, 0.15 * PI, 0.85 * PI, 2.6 * k, K.ink); disc((hd + 102 - 33) * k, (92 - 50) * k, 3.4 * k, K.pinkL);
      c.restore();
    }
    glyph(g, k, { color: K.purple });
    if (ak > 0.02) {                                                                    // the shell: a spiral in the loop, and dots along the whorl
      disc(gx(g, k, 33), gy(k, 66), 16 * k * ak, K.yellowL); spiral(gx(g, k, 33), gy(k, 66), 1.5 * k, 14 * k * ak, 2.2, t * 0.5, 3.2 * k * ak, K.ink);
      glyphInk(g, k, {}, K.pinkL, 4.2 * ak, [0.1, 15]);
    }
    a.end();
    for (let i = 0; i < 2; i++) { const tt = SN_T2 + 0.05 + i * 0.13, p = seg(t, tt, tt + 0.3); if (p > 0 && p < 1) spark(x + u * (0.1 + 0.05 * i), yc - u * 0.3, u * 0.12 * S(p * PI), i, K.yellow); }
  },
};

/* ---------- 7: lucky 7: a slot machine with chasing bulbs, three reels that land on sevens, and a fountain of coins ---------- */
const J7_STOP = [1.1, 1.4, 1.7], J7_LEVER = 0.35;                 // when each reel lands, and when the lever is pulled
const REEL = [0, 1, 2, 3, 4, 5, 6, 1];                              // the strip: cherry, lemon, bell, seven, star, bar, diamond, lemon
const REEL_D = [27, 35, 43];                                        // how far each reel travels (in symbols) to end on the seven (3 mod 8)

// one flat symbol centred on (x, y), r high
function symbol(kind, x, y, r) {
  if (kind === 0) { line(x - r * 0.05, y - r * 0.15, x - r * 0.3, y + r * 0.45, r * 0.09, K.green); line(x - r * 0.05, y - r * 0.15, x + r * 0.35, y + r * 0.4, r * 0.09, K.green); discO(x - r * 0.32, y + r * 0.5, r * 0.3, K.red, r * 0.06); discO(x + r * 0.38, y + r * 0.45, r * 0.3, K.red, r * 0.06); }
  else if (kind === 1) ovalO(x, y, r * 0.62, r * 0.42, K.yellow, -0.3, r * 0.06);
  else if (kind === 2) { pie(x, y + r * 0.2, r * 0.55, PI, TAU, K.ink); pie(x, y + r * 0.2, r * 0.46, PI, TAU, K.orange); boxO(x, y + r * 0.32, r * 1.1, r * 0.2, K.orange, 0, r * 0.08, r * 0.06); disc(x, y + r * 0.6, r * 0.14, K.yellow); }
  else if (kind === 3) { pline([x - r * 0.42, y - r * 0.6, x + r * 0.46, y - r * 0.6, x - r * 0.2, y + r * 0.7], r * 0.42, K.ink); pline([x - r * 0.42, y - r * 0.6, x + r * 0.46, y - r * 0.6, x - r * 0.2, y + r * 0.7], r * 0.3, K.red); }
  else if (kind === 4) { star(x, y, r * 0.75, 5, r * 0.34, -PI / 2, K.ink); star(x, y, r * 0.62, 5, r * 0.28, -PI / 2, K.orange); }
  else if (kind === 5) { boxO(x, y, r * 1.3, r * 0.6, K.ink, 0, r * 0.1, r * 0.05); box(x, y - r * 0.12, r * 1.1, r * 0.1, K.white); box(x, y + r * 0.12, r * 1.1, r * 0.1, K.white); }
  else { poly([x, y - r * 0.7, x + r * 0.5, y, x, y + r * 0.7, x - r * 0.5, y], K.ink); poly([x, y - r * 0.56, x + r * 0.38, y, x, y + r * 0.56, x - r * 0.38, y], K.sky); }
}

const SEVEN = {
  color: K.red, bg: K.green, dur: 2.9,
  back(a, t) {
    const { u, k, w, h, bw, bh } = a, c = raw(), vs = tall(a), Wm = Math.min(w * 0.86, 1.5 * u), Hm = Math.min(h * 0.94, 1.6 * u * vs, Wm * 1.35), Wf = Wm + 0.16 * u, Hf = Hm + 0.16 * u, cyM = Hm * 0.12;
    const Ww = Wm * 0.86, Hw = Ww * 0.44, Ls = Hw / 3, mp = pop(t, 0.02, 0.45), jp = seg(t, J7_STOP[2], J7_STOP[2] + 0.5);
    rays(0, 0, 20, Math.hypot(bw, bh) / 2, t * 0.12, K.greenL, 0.4);
    if (jp > 0) rays(0, 0, 16, Math.hypot(bw, bh) / 2 * E.out(jp), -t * 0.5, K.yellow, 0.34);                     // the jackpot flares out from behind the machine
    if (mp < 0.02) return;
    c.save(); c.scale(mp, mp);
    boxO(0, cyM, Wf, Hf, K.yellow, 0, 0.12 * u, 4 * k); boxO(0, cyM, Wm, Hm, K.purple, 0, 0.09 * u, 4 * k);          // the cabinet in its gold frame
    boxO(0, cyM - Hm * 0.39, Wm * 0.7, Hm * 0.13, K.yellow, 0, 0.05 * u, 3 * k); star(0, cyM - Hm * 0.39, Hm * 0.06 * (1 + 0.15 * S(t * 9)), 5, Hm * 0.028, t * 0.8, K.red);      // the sign
    for (const d of [-1, 1]) star(d * Wm * 0.26, cyM - Hm * 0.39, Hm * 0.035, 5, Hm * 0.016, -t * 0.8, K.orange);
    boxO(0, 0, Ww + 0.05 * u, Hw + 0.05 * u, K.ink, 0, 0.04 * u, 0); box(0, 0, Ww, Hw, K.cream, 0, 0.03 * u);           // the reel window
    c.save(); c.beginPath(); c.rect(-Ww / 2, -Hw / 2, Ww, Hw); c.clip();
    for (let i = 0; i < 3; i++) {
      const p = seg(t, J7_LEVER + 0.15, J7_STOP[i]), pos = REEL_D[i] * E.outBack(p), rx = (i - 1) * Ww / 3, m0 = Math.round(-pos);
      for (let j = -3; j <= 3; j++) { const m = m0 + j, y = (m + pos) * Ls; if (Math.abs(y) < Hw / 2 + Ls) symbol(REEL[(((-m) % 8) + 8) % 8], rx, y, Ls * 0.52); }
      if (p > 0 && p < 0.7) for (let j = 0; j < 4; j++) box(rx + (j - 1.5) * Ww * 0.06, 0, Ww * 0.008, Hw, K.white);         // blur streaks while it spins
    }
    for (const d of [-1, 1]) box(d * Ww / 6, 0, Ww * 0.012, Hw, K.ink);
    line(-Ww / 2, 0, Ww / 2, 0, 3 * k, K.red);
    c.restore();
    boxO(0, cyM + Hm * 0.36, Wm * 0.84, Hm * 0.16, K.violetD, 0, 0.04 * u, 3 * k);                                        // the control panel: buttons, and a coin tray
    for (let i = 0; i < 3; i++) discO((i - 1) * Wm * 0.2, cyM + Hm * 0.33, Hm * 0.035, [K.yellow, K.white, K.sky][i], 3 * k);
    boxO(0, cyM + Hm * 0.41, Wm * 0.34, Hm * 0.05, K.ink, 0, 0.02 * u, 2 * k);
    const lv = -1.1 + 1.6 * E.io(seg(t, J7_LEVER, J7_LEVER + 0.2)) - 1.6 * E.outBack(seg(t, J7_LEVER + 0.3, J7_LEVER + 0.6)), lx = Wm / 2, ly = cyM - Hm * 0.02, ll = Math.max(Hm * 0.26, 0.2 * u);      // the lever
    line(lx, ly, lx + C(lv) * ll, ly + S(lv) * ll, 0.05 * u + 6, K.ink); line(lx, ly, lx + C(lv) * ll, ly + S(lv) * ll, 0.05 * u, K.white);
    discO(lx + C(lv) * ll, ly + S(lv) * ll, 0.055 * u, K.red, 3 * k);
    c.restore();
    const P = 2 * (Wf + Hf), nb = 44, step = Math.floor(t * 9);                                                     // the bulbs, chasing round the gold frame
    c.save(); c.scale(mp, mp);
    for (let pass = 0; pass < 2; pass++) {
      c.fillStyle = pass ? K.white : K.orangeD; c.beginPath();
      for (let i = 0; i < nb; i++) {
        if (((((i - step) % 3) + 3) % 3 === 0) !== (pass === 1)) continue;                                  // every third bulb is lit, and the lit ones run round
        let d = i / nb * P, x, y;
        if (d < Wf) { x = -Wf / 2 + d; y = -Hf / 2; } else if ((d -= Wf) < Hf) { x = Wf / 2; y = -Hf / 2 + d; } else if ((d -= Hf) < Wf) { x = Wf / 2 - d; y = Hf / 2; } else { d -= Wf; x = -Wf / 2; y = Hf / 2 - d; }
        addDisc(x * (1 - 0.04 * u / Wf), y * (1 - 0.04 * u / Hf) + cyM, 0.024 * u * (pass ? 1.25 : 1));
      }
      c.fill();
    }
    c.restore();
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, vs = tall(a), Wm = Math.min(w * 0.86, 1.5 * u), Hm = Math.min(h * 0.94, 1.6 * u * vs, Wm * 1.35), ak = a.ak, Ww = Wm * 0.86, s = clamp(Wm * 0.86 / 3 / (62 * k), 0.4, 0.8), jp = seg(t, J7_STOP[2], J7_STOP[2] + 0.5);
    const yT = Hm * 0.12 + Hm * 0.41, pulse7 = 1 + 0.06 * Math.abs(S(PI * t * 3.2)) * seg(t, 0.4, 0.6), big = 1 + 0.3 * E.outBack(seg(t, J7_STOP[2], J7_STOP[2] + 0.3)) * (1 - 0.4 * E.io(seg(t, J7_STOP[2] + 0.3, J7_STOP[2] + 0.8)));
    if (jp > 0 && jp < 1) { const r = u * 0.7 * E.outBack(sat(jp * 2.5)) * (1 - jp * 0.5); star(0, 0, r, 14, r * 0.62, t * 0.6, K.white); star(0, 0, r * 0.8, 14, r * 0.5, t * 0.6 + 0.2, K.yellow); }
    for (let i = 0, n = a.n(34); i < n; i++) {                                                                   // the coin fountain
      const tb = J7_STOP[2] + 0.02 + i * 0.032, age = t - tb;
      if (age <= 0 || age > 1.8) continue;
      const an = -2.55 + 1.95 * a.r(i, 1), v = u * (1.5 + 0.9 * a.r(i, 2));
      coin(C(an) * v * age, yT + S(an) * v * age + 0.5 * u * 3.4 * age * age, u * 0.08, age * 13 + i, K.yellow, K.orange);
    }
    for (let i = 0; i < 9; i++) { const p = pop(t, J7_STOP[2] + 0.15 + i * 0.07, 0.35) * ak, x = (a.r(i, 4) - 0.5) * Wm * 0.5, y = yT + Hm * 0.02 - Math.abs(x) * 0.1 - (i % 3) * u * 0.05; coin(x, y, u * 0.09 * p, 0, K.yellow, K.orange); }         // and they pile up in the tray
    J7_STOP.forEach((ts, i) => spray(a, t, { x: (i - 1) * Wm * 0.29, y: 0, n: a.n(6), t0: ts, life: 0.7, a0: -PI * 0.9, a1: -PI * 0.1, v0: u * 0.5, v1: u * 1.2, g: 900, seed: 120 + i * 9, cols: [K.yellow, K.white, K.red] }));
    spray(a, t, { x: 0, y: -Hm * 0.3, n: a.n(24), t0: J7_STOP[2], life: 1.2, a0: -PI * 0.95, a1: -PI * 0.05, v0: u * 0.9, v1: u * 2.2, g: 1000, seed: 77, cols: [K.yellow, K.white, K.pink, K.sky, K.lime] });
    a.begin(0, 0, s * pop(t, 0.02, 0.3) * pulse7 * big, 0, 1, 1);
    glyph(g, k, { color: K.red });
    a.end();
    for (let i = 0; i < 4; i++) {                                                                                // the frame's corners glint
      const q = seg((t * 1.1 + i * 0.27) % 1, 0, 0.5), mp = pop(t, 0.3 + i * 0.05, 0.3);
      if (q > 0 && q < 1) spark((i & 1 ? 1 : -1) * (Wm / 2 + 0.08 * u), Hm * 0.12 + (i & 2 ? 1 : -1) * (Hm / 2 + 0.08 * u), u * 0.12 * S(q * PI) * mp * ak, i + t, K.white);
    }
    for (let i = 0; i < 8; i++) { const tb = J7_STOP[2] + 0.1 + i * 0.1, p = seg(t, tb, tb + 0.4); if (p > 0 && p < 1) spark((a.r(i, 1) - 0.5) * u * 1.6, (a.r(i, 2) - 0.5) * u * 1.4, u * 0.2 * S(p * PI), a.r(i, 3), i & 1 ? K.white : K.yellow); }
  },
};

/* ---------- 8: the 8 is a neon spider: it scuttles along a beam, drops on a silk thread that bounces, and spins a web with dew on it ---------- */
const NIGHT = mixHex(K.violet, K.black, 0.62), NIGHTL = mixHex(K.violet, K.black, 0.5);
const SP_HIP = [[13, -10], [14, -3], [15, 4], [16, 11]], SP_REACH = [52, 78, 104, 128];          // where each pair of legs starts on the body, and how far out its foot stands (glyph units from the middle)
const SP_STAR = [[-0.4, -0.3], [-0.3, 0.05], [-0.12, -0.4], [0.12, -0.22], [0.4, -0.38], [0.44, 0.2], [-0.45, 0.32], [0.2, 0.35]];
const SP_KIDS = [[-0.4, 0.3, 1.55], [0.37, 0.4, 1.75], [-0.27, 0.2, 1.95]];      // spiderlings dangling from the beam: x (of w), how far they drop (of h), when
const SP_DEW = [[0, 2], [3, 3], [6, 2], [9, 4], [2, 4], [5, 5], [8, 3], [11, 2], [1, 5], [10, 5]];       // dew: which spoke and which turn of the spiral

// the web's parts, in a frame centred on the hub: spokes grow out, then a polygon spiral winds round
function web(t, R, hubY, k) {
  const c = raw(), n = 12, lw = 3.4 * k;
  c.save(); c.translate(0, hubY); c.lineCap = 'round'; c.lineJoin = 'round';
  const spokes = () => { c.beginPath(); for (let j = 0; j < n; j++) { const g = E.out(seg(t, 1.5 + j * 0.03, 1.85 + j * 0.03)), an = (j + 0.5) / n * TAU + 0.2; c.moveTo(0, 0); c.lineTo(C(an) * R * g, S(an) * R * g); } };
  const turns = 6, total = n * turns, prog = E.out(seg(t, 1.7, 2.35)) * total;
  const spiralPath = () => {
    c.beginPath();
    for (let m = 0; m <= Math.ceil(prog); m++) {
      const f = Math.min(m, prog), an = (f + 0.5) / n * TAU + 0.2, r = R * (0.07 + 0.93 * f / total);
      if (m) c.lineTo(C(an) * r, S(an) * r); else c.moveTo(C(an) * r, S(an) * r);
    }
  };
  for (let pass = 0; pass < 2; pass++) {                                 // a neon tube: a dark edge and a bright core
    c.strokeStyle = pass ? K.skyL : K.indigo; c.lineWidth = lw * (pass ? 1 : 2.4);
    spokes(); c.stroke(); spiralPath(); c.stroke();
  }
  // dew drops sitting on the threads
  const dp = seg(t, 2.0, 2.4);
  if (dp > 0) {
    c.fillStyle = K.white; c.beginPath();
    for (let i = 0; i < SP_DEW.length; i++) {
      const [sp, tn] = SP_DEW[i], m = sp + tn * n; if (m > prog) continue;
      const an = (m + 0.5) / n * TAU + 0.2, r = R * (0.07 + 0.93 * m / total), q = pop(t, 2.0 + i * 0.04, 0.35);
      addDisc(C(an) * r, S(an) * r + 5 * k * q, 6.5 * k * q);
    }
    c.fill();
  }
  c.restore();
}

const EIGHT = {
  color: K.lime, bg: NIGHT, dur: 2.9,
  back(a, t) {
    const { u, k, w, h, bw, bh } = a, beamY = -h * 0.36, hubY = h * 0.17, R = h * 0.5;
    rays(0, hubY, 22, Math.hypot(bw, bh) / 2, t * 0.06, NIGHTL, 0.4);
    const mp = pop(t, 0.1, 0.5);                                                                     // the moon, with its craters
    disc(w * 0.32, -h * 0.14, u * 0.22 * mp, K.yellowL); disc(w * 0.32 - u * 0.06 * mp, -h * 0.14 + u * 0.04 * mp, u * 0.05 * mp, K.yellow); disc(w * 0.32 + u * 0.08 * mp, -h * 0.14 - u * 0.07 * mp, u * 0.035 * mp, K.yellow);
    const c = raw(); c.fillStyle = K.yellow; c.beginPath();                                      // fireflies drift about
    for (let i = 0; i < 7; i++) addDisc(w * (a.r(i, 1) - 0.5) * 0.9 + S(t * 0.9 + i * 2) * u * 0.08, h * (a.r(i, 2) - 0.4) * 0.9 + S(t * 1.3 + i) * u * 0.08, u * 0.014 * (0.6 + 0.4 * S(t * 5 + i * 3)));
    c.fill();
    SP_STAR.forEach(([x, y], i) => { const q = 0.5 + 0.5 * S(t * 3 + i * 2); spark(x * w, y * h, u * 0.05 * q * pop(t, 0.1 + i * 0.05, 0.3), i, i & 1 ? K.white : K.skyL); });
    web(t, R, hubY, k);
    line(-bw / 2, beamY, bw / 2, beamY, 0.2 * u, NIGHTL); line(-bw / 2, beamY, bw / 2, beamY, 0.08 * u, K.indigo); line(-bw / 2, beamY, bw / 2, beamY, 0.05 * u, K.pink); line(-bw / 2, beamY - 0.012 * u, bw / 2, beamY - 0.012 * u, 0.016 * u, K.pinkL);    // the neon beam
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, ak = a.ak, s = clamp(w * 0.36 / (130 * k), 0.35, 0.6), beamY = -h * 0.36, hubY = h * 0.17, Lb = 84, intro = pop(t, 0.02, 0.3), c = raw();
    const X0 = -w * 0.22, xh = lerp(X0, 0, E.io(seg(t, 0.25, 1.15))), yHang = beamY + Lb * k * s, drop = seg(t, 1.15, 1.45), yExt = hubY + h * 0.07, tau = Math.max(0, t - 1.45);
    const yh = drop < 1 ? lerp(yHang, yExt, E.in(drop)) : hubY + (yExt - hubY) * Math.exp(-3.4 * tau) * C(TAU * 1.5 * tau);
    const hang = E.io(seg(t, 1.1, 1.4)), walk = (xh - X0) / (40 * k * s), rot = PI + (drop >= 1 ? 0.14 * Math.exp(-2.4 * tau) * S(TAU * 1.1 * tau) : 0);
    // the silk thread, from the beam to the top of its abdomen
    if (t > 1.12) { const d = 52 * k * s * ak, tx = xh + d * S(rot - PI), ty = yh - d * C(rot - PI); line(0, beamY, tx, ty, 3.2 * k, K.white); }
    for (const [kx, kd, kt] of SP_KIDS) {                                                   // little ones drop on their own threads and bounce
      const tau2 = t - kt, dropY = tau2 > 0 ? kd * h * (1 - Math.exp(-6 * tau2) * C(TAU * 1.7 * tau2)) : 0, yk = beamY + 0.03 * h + dropY;
      if (tau2 > 0) { line(kx * w, beamY, kx * w, yk, 2 * k, K.white); discO(kx * w, yk, u * 0.04 * ak, K.lime, 2.4 * k * ak); disc(kx * w, yk + u * 0.05 * ak, u * 0.03 * ak, K.lime); eyes(kx * w, yk, u * 0.045, u * 0.02 * ak + 0.1, 0, 0.6); }
    }
    for (let i = 0; i < 2; i++) { const q = ((t * 0.4 + i * 0.5) % 1); bird(lerp(-w * 0.6, w * 0.6, q), -h * (0.43 + 0.03 * i) + S(q * 12 + i) * h * 0.015, u * 0.06, S(t * 14 + i), K.violet); }
    a.begin(xh, yh, s * intro, rot, 1, 1);
    // eight legs, one stroke of ink and one of neon
    const lw = 4 * k * ak + 0.1;
    c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    for (let i = 0; i < 4; i++) for (let sd = -1; sd <= 1; sd += 2) {
      const cy = (((walk + i * 0.25 + (sd > 0 ? 0.5 : 0)) % 1) + 1) % 1, st = cy < 0.6, off = 12 * (st ? lerp(-1, 1, cy / 0.6) : lerp(1, -1, (cy - 0.6) / 0.4)), lift = st ? 0 : 12 * S(PI * (cy - 0.6) / 0.4);
      const cfx = sd * SP_REACH[i] + off, cfy = Lb - lift, hfx = sd * (66 + 18 * i + 6 * S(t * 7 + i + sd * 2)), hfy = 26 + 6 * i + 22 * S(t * 6 + i * 1.7 + sd);
      const hx = sd * SP_HIP[i][0] * k, hy = SP_HIP[i][1] * k, fx = lerp(cfx, hfx, hang) * k, fy = lerp(cfy, hfy, hang) * k, l = 70 * k * ak;
      ik(hx, hy, fx * ak + hx * (1 - ak), fy * ak + hy * (1 - ak), l, l, -sd); c.moveTo(hx, hy); c.lineTo(KNEE.x, KNEE.y); c.lineTo(fx * ak + hx * (1 - ak), fy * ak + hy * (1 - ak));
    }
    c.strokeStyle = K.ink; c.lineWidth = lw + 5 * k * ak; c.stroke(); c.strokeStyle = K.lime; c.lineWidth = lw; c.stroke();
    glyph(g, k, { color: K.lime });
    if (ak > 0.02) {
      oval(gx(g, k, 33), gy(k, 70), 15 * k * ak, 12 * k * ak, K.pink); glyphInk(g, k, { only: [1] }, K.pinkL, 3.6 * ak, [0.1, 11]);
      const look = seg(t, 1.2, 1.5), lx = lerp(-0.8, S(t * 3), look), ly = lerp(0.1, C(t * 3) * 0.8, look), bl = (t % 1.7) < 0.1 ? 0.15 : 1;
      eyes(gx(g, k, 33), gy(k, 27), 19 * k * ak, 8.2 * k * ak, lx, ly, bl);
    }
    a.end();
  },
};

/* ---------- 9: the 9 is a balloon (its tail the string) floating up through a sunrise among other balloons, some of which pop; then it bounces down on a cloud ---------- */
const B_COL = [K.pink, K.yellow, K.lime, K.sky, K.purple, K.red, K.white, K.teal, K.magenta];
const B_UP = 0.3, B_TOP = 1.55, B_LAND = 2.0;                                 // it starts to rise, reaches the top, and drops onto the cloud

// a balloon with the sticker outline, a knot, a shine and a curly string; (x, y) is the middle of the balloon
function balloonO(x, y, r, col, t, ph) {
  const c = raw(), sw = S(t * 3 + ph) * r * 0.25;
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = K.cream; c.lineWidth = Math.max(2, r * 0.07);
  c.beginPath(); c.moveTo(x, y + r * 1.3); c.bezierCurveTo(x - r * 0.5 + sw, y + r * 1.8, x + r * 0.5 + sw, y + r * 2.3, x + sw, y + r * 2.9); c.stroke();
  ovalO(x, y, r, r * 1.18, col, 0, Math.max(2, r * 0.09)); tri(x, y + r * 1.32, r * 0.2, PI / 2, K.ink); tri(x, y + r * 1.28, r * 0.14, PI / 2, col);
  oval(x - r * 0.38, y - r * 0.4, r * 0.15, r * 0.3, K.white, 0.5);
}

const NINE = {
  color: K.blue, bg: K.orange, dur: 2.9,
  back(a, t) {
    const { u, w, h, bw, bh } = a, R = Math.hypot(bw, bh) / 2, sy = lerp(h * 0.56, h * 0.3, E.out(seg(t, 0, 2.3)));
    band(-bw / 2, bw / 2, -h * 0.05, h * 0.02, w * 0.8, 1, K.pink, -bh / 2);                              // the sky's bands: rose above, orange, then a golden glow
    band(-bw / 2, bw / 2, h * 0.2, h * 0.02, w * 0.9, 3, K.yellowM, bh / 2);
    rays(0, sy, 20, R, t * 0.15, K.yellowL, 0.36); disc(0, sy, u * 0.42, K.yellow); disc(0, sy, u * 0.3, K.yellowL);            // the sun comes up
    for (let i = 0; i < 4; i++) cloud(((0.05 + i * 0.3) * w - t * u * 0.12 + w * 1.5) % (w * 1.3) - w * 0.65, ((-0.32 + i * 0.17) * h + t * h * 0.08 * (1 + i * 0.4) + h * 1.2) % (h * 1.3) - h * 0.65, u * (0.14 + 0.03 * (i & 1)), i & 1 ? K.cream : K.white);
    band(-bw / 2, bw / 2, h * 0.42, h * 0.02, w * 0.7, 0.5, K.magenta, bh / 2); band(-bw / 2, bw / 2, h * 0.48, h * 0.015, w * 0.5, 2, K.purple, bh / 2);      // hills
  },
  draw(a, t) {
    const { u, k, g, w, h } = a, vs = tall(a), s = Math.min(0.72 * vs, 1.0), ak = a.ak, yTop = -h * 0.17, yCl = h * 0.2, intro = pop(t, 0.02, 0.3);
    // the other balloons rise past; the ones that pop burst into confetti
    for (let i = 0, n = a.n(11); i < n; i++) {
      const tb = 0.05 + a.r(i, 3) * 1.1, v = h * (0.5 + 0.45 * a.r(i, 4)), r = u * (0.075 + 0.06 * a.r(i, 2)), x = (a.r(i, 1) - 0.5) * w * 0.92 + S(t * 1.6 + i * 2) * u * 0.05, col = B_COL[i % 9];
      const tp = i % 3 === 1 ? tb + h * (0.62 + 0.05 + 0.4 * a.r(i, 5)) / v : 99, y = h * 0.66 - v * (t - tb);
      if (t < tb || t > tp && t > tp + 0.02) { if (t > tp) { spray(a, t, { x, y: h * 0.66 - v * (tp - tb), n: a.n(12), t0: tp, life: 0.9, v0: u * 0.5, v1: u * 1.5, g: 800, seed: 900 + i * 13, cols: [col, K.white, K.yellow] }); const p = seg(t, tp, tp + 0.18); if (p < 1) star(x, h * 0.66 - v * (tp - tb), r * 1.6 * E.out(p), 9, r * 0.9 * E.out(p), i, K.white); } continue; }
      if (y < -h * 0.62) continue;
      balloonO(x, y, r, col, t, i);
    }
    // the hero: rises wobbling, hangs, then drops and bounces on a cloud
    const rise = E.io(seg(t, B_UP, B_TOP)), drop = E.in(seg(t, B_TOP + 0.2, B_LAND)), tl = t - B_LAND, n = Math.max(0, Math.floor(tl / 0.4)), bnc = tl > 0 ? 0.13 * h * 0.42 ** n * 4 * (tl / 0.4 - n) * (1 - (tl / 0.4 - n)) : 0;
    const yb = h * 0.2 - (h * 0.2 - yTop) * rise, yh = t < B_TOP + 0.2 ? yb : lerp(yTop, yCl - 0.09 * u, drop) - bnc, sway = seg(t, 0.2, 0.6) * (1 - seg(t, B_TOP, B_TOP + 0.3));
    const sqz = tl > 0 ? boing(tl - n * 0.4) * (n < 4 ? 0.42 ** n : 0) : 0, x = S(t * 2.3) * w * 0.05 * sway * (1 - seg(t, B_TOP + 0.2, B_LAND)), rot = 0.55 + 0.1 * S(t * 3.1) * sway;
    // the cloud it bounces on
    const cp = pop(t, B_TOP, 0.4) * ak, csq = tl > 0 ? boing(tl - n * 0.4) * 0.5 ** n : 0;
    if (cp > 0.02) { cloud(0, yCl + u * 0.1 + csq * u * 0.03, u * 0.42 * cp, K.white); cloud(-u * 0.3, yCl + u * 0.16, u * 0.22 * cp, K.cream); }
    a.begin(x, yh, s * intro, rot, 1 - 0.04 * S(t * 7) * sway + 0.28 * sqz - 0.05 * drop, 1 + 0.05 * S(t * 7) * sway - 0.3 * sqz + 0.08 * drop);
    if (ak < 0.03) glyph(g, k, { color: K.blue });
    else {                                                                            // the loop fills out into a balloon and the tail thins to a string
      const fn = (px, py) => { P.x = px + ak * 7 * S(py * 0.13 - t * 7) * sat((py - 38) / 40); P.y = py; };
      glyph(g, k, { color: mixHex(K.blue, K.cream, ak), only: [1], sw: 17 - 14 * ak, ol: (4.2 - 3.2 * ak) * k, sh: (4.6 - 4 * ak) * k, fn });
      glyph(g, k, { color: K.blue, only: [0] });
      oval(gx(g, k, 33), gy(k, 34), 21 * k * ak, 22 * k * ak, K.blue); oval(gx(g, k, 19), gy(k, 20), 4.4 * k * ak, 9 * k * ak, K.white, 0.6); oval(gx(g, k, 26), gy(k, 9), 2 * k * ak, 3 * k * ak, K.white, 0.9);
      tri(gx(g, k, 54.5), gy(k, 68), 7.5 * k * ak, 1.9, K.ink); tri(gx(g, k, 54.5), gy(k, 68), 5.4 * k * ak, 1.9, K.blue);
    }
    a.end();
    for (let i = 0; i < 3; i++) { const q = seg((t * 0.45 + i * 0.33) % 1, 0, 1); bird(lerp(-w * 0.6, w * 0.6, q), -h * (0.3 + 0.08 * i) + S(q * 9 + i) * h * 0.02, u * 0.07, S(t * 9 + i), K.ink); }
  },
};

export const SCENES = { 0: ZERO, 1: ONE, 2: TWO, 3: THREE, 4: FOUR, 5: FIVE, 6: SIX, 7: SEVEN, 8: EIGHT, 9: NINE };
