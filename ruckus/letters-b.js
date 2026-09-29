// C to I: Chomp, Disco, Electric, Fireworks, Gum, Hula, Inchworm. Same contract as letters.js: each entry is
// { color, bg, dur, back(a, t), draw(a, t) }, pure functions of t, drawn around the scene's centre.
import {
  K, E, S, C, TAU, PI, sat, clamp, seg, lerp, pop, unpop, wob, rays, disc, discO, ring, oval, ovalO, box, boxO, line, pline, poly, star, spark, leaf, spiral, bolt,
  crescent, arcS, blob, flower, band, wave, P, note, eye, bits, addDisc, addBox, addStar, spray, fall, pulse, limbO, glyph, glyphInk, glyphOf, gx, gy, alpha, raw, hash,
  mixHex, trace,
} from './kit.js';

const DEG = PI / 180;

export const SCENES = {
  /* C: a hungry mouth chomps a line of sweets, grows with every bite and ends with a burp */
  C: {
    color: K.yellow, bg: K.pink, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a, R = Math.hypot(a.bw, a.bh) / 2, ang = 0.5, sw = u * 0.16;
      const N = Math.ceil(R / sw) + 2, off = (t * u * 0.12) % (sw * 2);                                   // candy stripes sliding by
      bits([K.pinkM], N, i => { const d = (i - N / 2) * sw * 2 + off; addBox(C(ang) * d, S(ang) * d, sw, R * 2.2, ang); });
      const cell = u * 0.1, ty = h * 0.335 + (1 - E.out(seg(t, 0, 0.4))) * u * 0.3, nc = Math.ceil(a.bw / cell), nr = Math.ceil((h * 0.62 - ty) / cell);
      box(0, (ty + h * 0.62) / 2, a.bw, h * 0.62 - ty, K.white);                                          // a checked tablecloth along the bottom
      bits([K.red], nc * nr, i => { const cx = i % nc, cy = (i / nc) | 0; if ((cx + cy) & 1) addBox((cx - nc / 2 + 0.5) * cell, ty + (cy + 0.5) * cell, cell, cell, 0); });
      bits([K.white], nc + 1, i => addDisc((i - nc / 2) * cell, ty, cell * 0.55));
      for (let i = 0; i < 3; i++) {                                                                       // big lollipops turning in the corners
        const x = [-0.4, 0.42, 0.34][i] * w, y = [-0.3, -0.34, 0.36][i] * h, r = u * 0.3 * pop(t, 0.08 + i * 0.1, 0.5), tilt = [0.25, -0.2, 0.1][i];
        box(x - S(tilt) * (r + u * 0.3), y + C(tilt) * (r + u * 0.3), r * 0.14, u * 0.6, K.white, tilt);
        disc(x, y, r, [K.white, K.cream, K.sky][i]);
        spiral(x, y, r * 0.06, r * 0.82, 2.2, t * 0.7 + i * 2, r * 0.17, [K.red, K.lime, K.white][i]);
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, side = w > h, n = a.n(side ? 5 : 4);
      const fit = Math.min(0.36 * h, 0.9 * u, (side ? 0.5 : 0.42) * w) * a.x(0.2), s0 = fit / (u * hs), G = 0.35 * a.x(0.4);          // the C's height at the start, and how much it grows in all
      // the sweets lie along a slope, the C climbs it; one bite every dt seconds, the burp after the last
      const xa = -0.44 * w + 0.42 * fit, xb = Math.min(0.44 * w - 0.42 * fit * (1 + G), w * 0.15), yA = h * (side ? 0.08 : 0.16), dy = -h * (side ? 0.18 : 0.3) / n;
      const t0 = 0.45, dt = 1.3 / n, spacing = (xb - xa) / n, phi = Math.atan2(dy, spacing), r = Math.min(fit * 0.2, Math.hypot(spacing, dy) * 0.55);
      const tb = i => t0 + (i + 0.7) * dt, tE = tb(n - 1) + 0.24;
      let bites = 0;
      for (let i = 0; i < n; i++) bites += E.outBack(seg(t, tb(i), tb(i) + Math.min(0.22, dt * 0.9)));
      const s = s0 * (1 + G * bites / n), grow = k * hs * s0;
      fall(a, t, { n: a.n(22), t0: 0.15, shape: 'rect', cols: [K.white, K.yellow, K.lime, K.sky, K.orange], seed: 300, vy0: 160, vy1: 360, s0: 5, s1: 9 });
      for (let i = 0; i < n; i++) {                                                                       // the sweets, each gone with its bite in a burst of crumbs
        const reach = 31 * grow * (1 + G * i / n), xi = xa + spacing * (i + 1) + C(phi) * reach, yi = yA + dy * (i + 1) + S(phi) * reach, ti = tb(i), sc = pop(t, 0.06 + i * 0.05, 0.35);
        if (t < ti) sweet(i, xi, yi + S(t * 4 + i) * 0.03 * u, r * sc, t * 1.5 + i);
        spray(a, t, { x: xi, y: yi, n: a.n(9), t0: ti, life: 0.8, v0: u * 0.4, v1: u * 1.3, g: 1500, s0: 5, s1: 12, seed: 200 + i * 17, cols: [CANDY[i % CANDY.length], K.white, K.cream] });
        const p = seg(t, ti, ti + 0.3);
        if (p > 0 && p < 1) { star(xi, yi, r * (1.1 + 1.3 * E.out(p)), 8, r * 0.6 * (1 + p), p * 2, K.white); star(xi, yi, r * (0.6 + 0.8 * E.out(p)), 8, r * 0.3, p * 2, K.yellow); }
      }
      // where we are in the current bite: open wide, snap shut, chew
      const u_ = (t - t0) / dt, ci = clamp(Math.floor(u_), 0, n - 1), f = u_ - ci, fm = u_ - Math.floor(u_), lunge = E.out2(sat(f / 0.7)), q = Math.min(n, ci + lunge);
      let half = fm < 0.55 ? lerp(10, 66, E.out(fm / 0.55)) : fm < 0.7 ? lerp(66, 13, E.in((fm - 0.55) / 0.15)) : 13 + 9 * S((fm - 0.7) / 0.3 * PI);
      const bite = f >= 0.7 ? (f - 0.7) * dt : ci > 0 ? (f + 0.3) * dt : 9, jolt = wob(bite, 3.5, 7), lift = 4 * sat(f / 0.7) * (1 - sat(f / 0.7));
      let x = xa + spacing * q, y = yA + dy * q - u * 0.07 * lift, rot = phi + 0.14 * S(PI * sat(f / 0.7)) * (u_ < n ? 1 : 0), sx = 1 + 0.16 * jolt, sy = 1 - 0.16 * jolt;
      const be = t - tE, bj = wob(be, 4, 5);
      if (t >= tb(n - 1)) half = be < 0 ? 13 + 8 * S(sat((t - tb(n - 1)) / 0.14) * PI) : be < 0.3 ? lerp(13, 62, E.outBack(sat(be / 0.14))) : lerp(62, 45, E.io(seg(t, tE + 0.3, a.exitAt - 0.05)));
      if (be > 0) { rot = phi * (1 - E.out(seg(t, tE, tE + 0.3))) - 0.3 * bj; sx = 1 - 0.14 * bj; sy = 1 + 0.14 * bj; }                  // the burp
      x -= u * 0.06 * E.out(sat(be / 0.2));                                                               // knocks it back
      a.begin(x, y, s * pop(t, 0.02, 0.3), rot, sx, sy);
      glyph(mouthGlyph(g, lerp(half, 45, a.land)), k, { color: K.yellow });   // a scene cut short still lands on the plain C
      chompFace(g, k, half, a.ak, t);
      a.end();
      if (be > 0) {
        const gk = k * hs * s, Rf = u * 0.3 * a.x(0.35), bp = pop(t, tE + 0.03, 0.3) * unpop(t, tE + 0.42, 0.2), R = Rf * bp;
        const bx = side ? Math.min(x + 45 * gk + Rf * 0.9, w * 0.5 - Rf * 1.1) : x + w * 0.05, by = side ? y - Rf * 0.4 : y - 50 * gk - Rf * 0.75;
        spray(a, t, { x: x + 40 * gk, y, n: a.n(16), t0: tE, life: 0.9, v0: u * 0.6, v1: u * 1.6, g: 900, seed: 500, cols: [K.yellow, K.white, K.lime, K.pinkL] });
        pulse(x + 40 * gk, y, t, tE, 0.5, u * 0.4, 6 * k, K.lime); pulse(x + 40 * gk, y, t, tE + 0.1, 0.5, u * 0.6, 4 * k, K.white);
        if (R > 1) { starO(bx, by, R * 1.1, 14, R * 0.72, be * 1.5, K.orange, 1.3 * k); starO(bx, by, R * 0.86, 14, R * 0.56, -be, K.white, 1.3 * k); word('BURP', bx, by, R * 0.0048, K.red, -0.14); }
      }
    },
  },

  /* D: a mirror ball drops in over a pulsing dance floor and the D dances: sways, hops, slides and twirls */
  D: {
    color: K.pink, bg: K.teal, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a, R = Math.hypot(a.bw, a.bh) / 2, [bx, by] = ballAt(a, t), on = pop(t, 0.3, 0.5), c = raw();
      // the dance floor: big tiles in perspective, rolling out from the horizon, colours running across them in waves
      const yh = -h * 0.04, yb = yh + h * 0.66 * E.out(seg(t, 0.03, 0.45)), nR = 6, nC = 16, cw = Math.max(w * 1.9, 2.2 * h * 0.66) / nC;
      for (let ci = 0; ci < 4 && yb - yh > 1; ci++) {
        c.fillStyle = FLOOR[ci]; c.beginPath();
        for (let j = 0; j < nR; j++) {
          const y0 = yh + (yb - yh) * (j / nR) ** 1.6, y1 = yh + (yb - yh) * ((j + 1) / nR) ** 1.6, f0 = (y0 - yh) / (yb - yh), f1 = (y1 - yh) / (yb - yh);
          for (let i = 0; i < nC; i++) {
            if (((Math.floor(t * 1.5 - i * 0.5 - j * 0.9) % 4) + 4) % 4 !== ci) continue;
            const xa = (i - nC / 2) * cw, xb = xa + cw;
            c.moveTo(xa * f0 + 1, y0 + 1); c.lineTo(xb * f0 - 1, y0 + 1); c.lineTo(xb * f1 - 1, y1 - 1); c.lineTo(xa * f1 + 1, y1 - 1); c.closePath();
          }
        }
        c.fill();
      }
      for (let i = 0; i < 3; i++) {                                                                       // spotlight cones sweeping the floor (white beams, flat coloured pools where they land)
        const ax = (i - 1) * w * 0.42, tx = ax * 0.3 + S(t * (1.3 + i * 0.35) + i * 2) * w * 0.3, ty = h * (0.22 + 0.04 * i), hw = w * 0.07, pp = pop(t, 0.2 + i * 0.12, 0.4);
        alpha(0.22 * pp); poly([ax - 8, -h / 2 - 30, ax + 8, -h / 2 - 30, tx + hw, ty, tx - hw, ty], K.white); alpha(1);
        oval(tx, ty, hw * 1.5 * pp, hw * 0.42 * pp, [K.yellow, K.skyL, K.pinkL][i]);
      }
      alpha(0.14 * on); rays(bx, by, 16, R, t * 0.35, K.white, 0.3); alpha(1);
      alpha(0.55 * on);                                                                                   // light spots from the ball wheeling over everything
      bits([K.white], 26, i => {
        const an = a.r(i, 1) * TAU + t * (0.2 + 0.3 * a.r(i, 2)) * (i & 1 ? 1 : -1), rad = R * (0.12 + 0.85 * a.r(i, 3)), sz = u * (0.025 + 0.03 * a.r(i, 4));
        addBox(bx + C(an) * rad, by + S(an) * rad, sz, sz, an);
      });
      alpha(1);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, ak = a.ak, s = (w < h ? 0.95 : 0.68) * (a.big && w < h ? 0.92 : 1), beat = 0.5, X = a.x(0.5), [bx, by, r] = ballAt(a, t);
      line(bx, -h / 2 - 40, bx, by - r, 4 * k, K.white); disc(bx, by - r - 3 * k, 5 * k, K.white);        // the ball, on its string
      mirrorBall(bx, by, r, t * 1.5, t, k);
      for (let i = 0; i < 5; i++) {                                                                       // glints on the ball
        const p = seg((t * 1.7 + i * 0.37) % 1, 0, 0.5);
        if (p > 0 && p < 1 && t > 0.5) { const an = i * 2.1 + Math.floor(t * 1.7 + i * 0.37) * 1.3; spark(bx + C(an) * r * 0.85, by + S(an) * r * 0.85, r * 0.3 * S(p * PI), 0.4, K.white); }
      }
      // the dance: a bounce on every beat and a sway, then a slide across the floor and a twirl
      const ph = t / beat, bounce = Math.abs(S(PI * ph)), calm = 1 - seg(t, 2.25, 2.4);
      const sl = tt => E.io(seg(tt, 1.0, 1.25)) - 2 * E.io(seg(tt, 1.25, 1.6)) + E.io(seg(tt, 1.6, 1.8)), tw = E.io(seg(t, 1.75, 2.25));
      const sway = lerp(0.3, 0.1, E.io(seg(t, 0.95, 1.1))) * S(PI * ph) * calm * (1 - seg(t, 1.75, 1.85)), lean = clamp(-(sl(t + 0.03) - sl(t - 0.03)) * 3, -0.25, 0.25);
      const sy = 1 + (0.1 * bounce - 0.17 * (1 - bounce) ** 4) * calm, sx = 1 / Math.sqrt(sy);
      const px = sl(t) * w * 0.16 * a.x(0.3), py = h * 0.25, hopY = bounce * u * 0.07 * X * calm + S(PI * tw) * u * 0.16 * X;
      const foot = 46 * k * s * hs, rot = sway + lean, turn = C(tw * TAU), tx = Math.abs(turn) < 0.08 ? 0.08 * Math.sign(turn || 1) : turn;
      const age = (ph % 1) * beat, rp = E.out(sat(age / 0.4));
      if (t > 0.3 && t < a.exitAt) for (let j = 0; j < (a.big ? 2 : 1); j++) floorRing(px, py + 6 * k, u * (0.15 + 0.4 * sat(rp - j * 0.25)), Math.max(0, 6 * k * (1 - rp)), j ? K.yellow : K.white);
      a.begin(px + S(rot) * foot * sy, py - hopY - C(rot) * foot * sy, s * pop(t, 0.02, 0.3), rot, sx * tx, sy);
      const bi = Math.floor(ph), snap = E.outBack(sat((ph - bi) / 0.35)), upR = bi % 2 ? 1 - snap : snap;   // the arms swap the disco point on every beat
      for (let i = 0; i < 2 && ak > 0.05; i++) {
        const sd = i ? -1 : 1, up = i ? 1 - upR : upR, sx0 = i ? 2 : 66, hx = lerp(i ? 0 : 72, i ? -34 : 100, up), hy = lerp(84, 4, up);
        const handX = lerp(gx(g, k, sx0), gx(g, k, hx), ak), handY = lerp(gy(k, 46), gy(k, hy), ak);
        limbO(gx(g, k, sx0), gy(k, 46), handX, handY, 27 * k, 27 * k, -sd, 6.5 * k, K.pink, 3 * k);
        discO(handX, handY, 7.5 * k * ak, K.white, 2.6 * k);
      }
      glyph(g, k, { color: K.pink });
      a.end();
      for (let i = 0; i < a.n(7); i++) {                                                                  // notes and stars rising off the dancer
        const age = t - (0.5 + i * 0.24);
        if (age < 0 || age > 1.3) continue;
        const sc = pop(age, 0, 0.3) * (1 - seg(age, 1.0, 1.3)), x = px + (i & 1 ? 1 : -1) * (0.16 + 0.06 * a.r(i, 1)) * u + S(age * 4 + i) * 0.03 * u, y = py - u * (0.3 + age * 0.35);
        if (i % 3 === 2) spark(x, y, u * 0.09 * sc, age * 3, K.white); else note(x, y, u * 0.085 * sc, S(age * 4 + i) * 0.4, [K.yellow, K.white, K.sky, K.pink][i % 4]);
      }
      spray(a, t, { x: px, y: py - u * 0.2, n: a.n(20), t0: 1.98, life: 1.0, v0: u * 0.6, v1: u * 1.6, seed: 700, cols: [K.yellow, K.white, K.pink, K.sky, K.lime], shape: 'star' });
    },
  },

  /* E: a giant plug on the mains: it buzzes, lightning crackles between its prongs and out to the edges, bulbs pop on all round */
  E: {
    color: K.yellow, bg: K.indigo, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a, sp = pop(t, 0.05, 0.5), X = a.x(0.3);
      star(0, 0, u * 0.98 * sp * X, 14, u * 0.6 * sp * X, t * 0.25, K.indigoD);
      star(0, 0, u * 0.7 * sp * X, 14, u * 0.42 * sp * X, -t * 0.35, K.violetD);
      for (let i = 0; i < 4; i++) {                                                                       // big bolts in the corners
        const bp = pop(t, 0.2 + i * 0.12, 0.45);
        bolt((i & 1 ? 1 : -1) * w * 0.4, (i < 2 ? -1 : 1) * h * 0.3, u * 0.3 * bp, (i & 1 ? 0.3 : -0.3) + S(t * 2 + i) * 0.08, i % 3 === 0 ? K.yellow : K.violet);
      }
      for (let i = 0; i < 3; i++) pulse(0, 0, t, 0.35 + i * 0.7, 0.9, u * 1.3 * X, u * 0.04, K.violetL);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, ak = a.ak, s = w < h ? 0.95 * (a.big ? 0.9 : 1) : 0.78, Sc = s * hs, buzz = 1.2 * pop(t, 0.05, 0.3) * (1 - seg(t, 2.1, 2.35));
      const tips = [[77, 8.5], [68, 50], [77, 91.5]], pos = i => [(tips[i][0] - g.w / 2) * k * Sc, (tips[i][1] - 50) * k * Sc];      // prong ends, in glyph units and on the stage
      a.begin(0, 0, s * pop(t, 0.02, 0.3), 0, 1, 1);
      const cord = [];                                                                                    // the cord trailing off to the left
      for (let i = 0; i <= 10; i++) { const f = i / 10; cord.push(gx(g, k, 0) - f * (w * 0.55 / Sc) * ak, gy(k, 50) + S(f * 7 - t * 5) * 12 * k * f * ak); }
      if (ak > 0.05) { pline(cord, 11 * k * ak, K.ink); pline(cord, 6 * k * ak, K.violetL); }
      const o = { jit: buzz, jt: t };
      glyph(g, k, { color: K.yellow, ...o });
      raw().lineDashOffset = -t * 110 * k; glyphInk(g, k, o, K.white, 4, [3, 28]); raw().lineDashOffset = 0;      // current running along the strokes
      for (let i = 0; i < 3 && ak > 0.05; i++) {                                                          // the prongs slide out of the arm tips
        const pp = pop(t, 0.15 + i * 0.08, 0.35) * ak;
        boxO(gx(g, k, tips[i][0] - 9 + 9 * pp), gy(k, tips[i][1]), 26 * k * pp, 8 * k, K.white, 0, 2 * k, 2.5 * k);
      }
      a.end();
      if (t > 0.35) {                                                                                     // lightning: between the prongs, and out to the edges of the screen
        const lw = 5 * k * pop(t, 0.35, 0.3) * a.x(0.3), [p0, p1, p2] = [pos(0), pos(1), pos(2)], reach = w * 0.53;
        crackle(p0[0], p0[1], p1[0], p1[1], 5, 9 * k * Sc, 1, t, lw, K.violetL);
        crackle(p1[0], p1[1], p2[0], p2[1], 5, 9 * k * Sc, 2, t, lw, K.violetL);
        crackle(p0[0], p0[1], p2[0], p2[1], 8, 14 * k * Sc, 3, t, lw, K.yellow);
        crackle(p0[0], p0[1], reach, -h * 0.38 + S(t * 3) * h * 0.05, 11, u * 0.05, 4, t, lw, K.violetL);
        crackle(p1[0], p1[1], reach, S(t * 2.3) * h * 0.08, 11, u * 0.05, 5, t, lw, K.yellow);
        crackle(p2[0], p2[1], reach, h * 0.38 + S(t * 3.3) * h * 0.05, 11, u * 0.05, 6, t, lw, K.violetL);
        if (a.big) {
          crackle(p0[0] - 77 * k * Sc, p0[1], -reach, -h * 0.4, 11, u * 0.05, 7, t, lw, K.yellow);
          crackle(p2[0] - 77 * k * Sc, p2[1], -reach, h * 0.4, 11, u * 0.05, 8, t, lw, K.yellow);
          crackle(p1[0], p1[1], p1[0] + w * 0.2, -h * 0.5, 9, u * 0.05, 9, t, lw, K.violetL);
        }
      }
      for (let m = 0; m < 3; m++) {                                                                       // sparks fizzing off the prongs
        const [px, py] = pos(m);
        bits([K.yellow, K.white], a.n(6), j => {
          const age = (t * 1.8 + j * 0.37 + m * 0.21) % 1, an = -0.9 + (a.r(j + m * 9, 1) - 0.5) * 2.4 + (m - 1) * 0.5, d = u * (0.05 + 0.32 * age * a.r(j + m * 9, 2));
          if (t > 0.4) addStar(px + C(an) * d, py + S(an) * d + age * age * u * 0.1, u * 0.032 * (1 - age), u * 0.008, 4, an * 3);
        });
      }
      const nb = a.n(10), bx = w * 0.44, by = h * 0.42, per = 4 * (bx + by), r = Math.min(u * 0.055, per / nb * 0.3);      // the bulbs pop on one after another round the edge
      raw().strokeStyle = K.indigoD; raw().lineWidth = 3 * k; raw().lineJoin = 'round'; raw().strokeRect(-bx, -by, bx * 2, by * 2);
      for (let i = 0; i < nb; i++) bulb(i, (i + 0.5) / nb * per, bx, by, r, t, 0.55 + i * 1.4 / nb, k);
      spray(a, t, { x: 0, y: 0, n: a.n(24), t0: 2.0, life: 1.0, v0: u * 0.8, v1: u * 2, seed: 800, cols: [K.yellow, K.white, K.violetL, K.pink], shape: 'spark' });
    },
  },

  /* F: blasts off like a rocket, bursts into a huge firework, then falls back bouncing while more shells go off all round */
  F: {
    color: K.orange, bg: K.black, dur: 3.0,
    back(a, t) {
      const { u, w, h } = a, ground = h * 0.43;
      bits([K.white, K.yellowL, K.skyL], a.n(44), i => {                                                  // twinkling stars
        const x = (a.r(i, 1) - 0.5) * w * 1.5, y = -h * 0.5 + a.r(i, 2) * h * 0.72, so = u * (0.008 + 0.014 * a.r(i, 3)) * (0.55 + 0.45 * S(t * (2 + 3 * a.r(i, 4)) + i * 3));
        addStar(x, y, so, so * 0.22, 4, 0);
      });
      crescent(-w * 0.38, -h * 0.34, u * 0.16 * pop(t, 0.1, 0.5), -0.5, K.cream);
      const nb = 12, bwid = a.bw / nb, bh = i => h * (0.05 + 0.1 * a.r(i, 7)) * pop(t, 0.03 + 0.02 * Math.abs(i - nb / 2), 0.4);      // the city the rocket takes off from, its buildings rising
      for (let i = 0; i < nb; i++) box(-a.bw / 2 + (i + 0.5) * bwid, ground - bh(i) / 2 + 1, bwid * 0.9, bh(i) + 2, K.indigoD);
      box(0, ground + a.bh * 0.25, a.bw, a.bh * 0.5, K.indigoD);
      bits([K.yellow], nb * 5, i => {                                                                     // lit windows
        const b = (i / 5) | 0, r = i % 5, wy = h * 0.015 + Math.floor(r / 2) * h * 0.03;
        if (a.r(b, 8 + r) > 0.5 || wy + bwid * 0.12 > bh(b)) return;
        addBox(-a.bw / 2 + (b + 0.5) * bwid + (r % 2 - 0.5) * bwid * 0.4, ground - wy, bwid * 0.12, bwid * 0.12, 0);
      });
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, ak = a.ak, s = (w < h ? 0.7 : 0.62) * (a.big ? 0.92 : 1), Sc = s * hs, X = a.x(0.4);
      const yTop = -h * (a.big ? 0.2 : 0.22), yBot = h * 0.3, tUp = 0.3, tBoom = 1.0, tFall = 1.05, up = seg(t, tUp, tBoom);
      const fy = tt => tt < tFall ? lerp(yBot, yTop, E.in(seg(tt, tUp, tBoom))) : lerp(yTop, 0, E.outBounce(seg(tt, tFall, 1.9)));      // the middle of the letter: up, then falling back and bouncing
      const nb = Math.min(BURSTS.length, a.n(4));
      for (let i = 0; i < nb; i++) {                                                                      // the shells that rise to the other bursts, and the bursts
        const b = BURSTS[i], t0 = 1.15 + i * 0.16, x = b[1] * w, y = b[2] * h, p = seg(t, t0 - 0.36, t0);
        if (p > 0 && p < 1) {                                                                             // a comet climbing to its burst
          const yy = lerp(h * 0.45, y, E.out(p));
          poly([x - 2.6 * k, yy + h * 0.15, x + 2.6 * k, yy + h * 0.15, x, yy], K.yellowL); poly([x - 1.2 * k, yy + h * 0.08, x + 1.2 * k, yy + h * 0.08, x, yy], K.white); disc(x, yy, 3.4 * k, K.white);
        }
        firework(a, t, { style: b[0], x, y, t0, R: u * b[3] * X, cols: b[4], n: a.n(b[5]), life: 1.5, seed: 100 + i * 50 });
      }
      firework(a, t, { style: 0, x: 0, y: yTop, t0: tBoom, R: u * 0.72 * a.x(0.35), cols: [K.yellow, K.pink, K.white, K.orange], n: a.n(32), life: 1.8, seed: 5 });
      firework(a, t, { style: 5, x: 0, y: yTop, t0: tBoom + 0.1, R: u * 0.36 * a.x(0.35), cols: [K.white, K.sky], n: a.n(20), life: 1.4, seed: 6 });
      fall(a, t, { n: a.n(22), t0: 1.1, cols: [K.yellow, K.white, K.pinkL, K.skyL], shape: 'spark', vy0: 60, vy1: 180, s0: 6, s1: 13, seed: 90 });
      const padX = -22 * k * Sc;                                                                          // the launch: smoke on the pad, and sparks thrown off behind the rocket
      for (let j = 0; j < 6; j++) {
        const tj = 0.32 + j * 0.07, r = u * (0.03 + 0.05 * a.r(j, 1)) * E.out(seg(t, tj, tj + 0.4)) * (1 - seg(t, 1.0, 1.5)), drift = E.out(seg(t, tj, tj + 0.6));
        disc(padX + (a.r(j, 2) - 0.5) * u * 0.5 * drift, yBot + 55 * k * Sc - drift * u * 0.06, r, j & 1 ? K.white : K.skyL);
      }
      if (t > tUp && t < tBoom + 0.4) {
        bits([K.white, K.yellow, K.orange, K.red], 20, j => {
          const age = (j + 1) * 0.03, tj = t - age;
          if (tj < tUp) return;
          const sz = u * (0.008 + 0.024 * (1 - j / 20)) * (0.6 + 0.8 * a.r(j, 3));
          addDisc(padX + (a.r(j, 1) - 0.5) * u * 0.6 * age * 2 + S(tj * 30 + j) * u * 0.01, fy(tj) + 52 * k * Sc + a.r(j, 2) * u * 0.25 * age, sz);
        });
      }
      // the rocket: stretched on the way up, squashing on every bounce (it pivots on its feet)
      let sq = 0;
      for (const [ti, am] of [[0.364, 0.22], [0.727, 0.12], [0.909, 0.06]]) sq += am * wob(t - (tFall + 0.85 * ti), 4.5, 9);
      const sy = t < tBoom ? 1 + 0.12 * E.out(up) : 1 - sq, sx = 1 / Math.sqrt(sy), rot = t < tBoom ? 0.05 * S(t * 40) * up : 0.08 * (1 - seg(t, 1.05, 1.9)) * S(t * 9);
      const foot = 41.5 * k * Sc, launch = 1 - E.out(seg(t, 0.02, 0.3)), fl = gx(g, k, 8.5);
      a.begin(S(rot) * foot * sy, fy(t) + foot - C(rot) * foot * sy + launch * u * 0.05, s * pop(t, 0.02, 0.3), rot, sx, sy);
      if (t < tBoom + 0.1) flame(fl, gy(k, 96), (t > tUp ? 62 + 22 * S(t * 55) : 14) * k * ak, k);
      if (ak > 0.05) for (const sd of [-1, 1]) polyO([fl + sd * 8.5 * k, gy(k, 70), fl + sd * 26 * k * ak, gy(k, 103), fl + sd * 8.5 * k, gy(k, 96)], K.red, 1.6 * k);         // fins
      glyph(g, k, { color: K.orange });
      if (ak > 0.05) { discO(fl, gy(k, 30), 6.2 * k * ak, K.sky, 2.2 * k); disc(fl - 2 * k, gy(k, 28), 1.8 * k * ak, K.white); }                                          // porthole
      a.end();
    },
  },

  /* G: blows a small bubble that goes back in, then a huge one that wobbles up and POPS: shards, goo and sticky strings */
  G: {
    color: K.white, bg: K.blue, dur: 2.9,
    back(a, t) {
      const { u } = a, d = u * 0.2, nx = Math.ceil(a.bw / d), ny = Math.ceil(a.bh / d), off = (t * u * 0.05) % (d * 2), c = raw();
      for (let pass = 0; pass < 2; pass++) {                                                              // big and little polka dots on a checkerboard, drifting
        c.fillStyle = pass ? K.yellow : K.sky; c.beginPath();
        for (let i = 0; i < nx * ny; i++) {
          const ix = i % nx, iy = (i / nx) | 0;
          if (((ix + iy) & 1) !== pass) continue;
          const x = (ix - nx / 2) * d + off, y = (iy - ny / 2) * d + off, r = d * (pass ? 0.17 : 0.5) * pop(t, 0.02 + Math.hypot(x, y) * 0.0006, 0.4);
          if (r > 0.5) addDisc(x, y, r);
        }
        c.fill();
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, ak = a.ak, s = (w < h ? 0.74 : 0.68) * (a.big ? 0.92 : 1), Sc = s * hs, tPop = 1.8, be = t - tPop, tall = w < h;
      const Rmax = Math.min(0.74 * u * a.x(0.3), 0.36 * w * a.x(0.15), 0.4 * h), hx = tall ? -0.2 * w : -0.26 * w, hy = tall ? 0.16 * h : 0.12 * h;
      // the small bubble that goes back in, then the big one in three puffs
      const r1 = 0.12 * u * E.outBack(seg(t, 0.25, 0.52)) * (1 - E.in(seg(t, 0.56, 0.72)));
      const r2 = Rmax * (0.5 * E.outBack(seg(t, 0.8, 1.06)) + 0.3 * E.outBack(seg(t, 1.18, 1.4)) + 0.2 * E.outBack(seg(t, 1.52, 1.74)));
      const R = t < tPop ? Math.max(r1, r2, 0) : 0, thin = sat(R / Rmax);
      const wb = 0.05 * (wob(t - 0.8, 3, 5) + wob(t - 1.18, 3.4, 5) + wob(t - 1.52, 3.8, 5)) + 0.02 * S(t * 38) * seg(t, 1.6, tPop);       // the bubble wobbles after each puff, then trembles
      const puff = wob(t - 0.8, 3, 6) + wob(t - 1.18, 3, 6) + wob(t - 1.52, 3, 6);
      const lean = E.io(seg(t, 0.7, 1.0)) * (1 - seg(t, 1.6, tPop)), rot = -0.1 * lean + (be > 0 ? 0.12 * wob(be, 3, 6) : 0) - (tall ? 0.35 * E.io(seg(t, 0.7, 1.2)) * (1 - E.in(seg(t, 1.6, tPop))) : 0);
      const sx = 1 + 0.05 * puff + (be > 0 ? 0.16 * wob(be, 3.5, 7) : 0) + 0.03 * S(t * 30) * seg(t, 0.05, 0.25), sy = 1 / sx;
      const mx = gx(g, k, 68), my = gy(k, 36.6), cb = Rh => [mx + 0.94 * Rh * 0.95, my - 0.34 * Rh * 0.95];         // the bubble's centre in the hero frame: out of the gap in the G, up and to the right
      const cR = cb(Rmax / Sc), cs = C(rot), sn = S(rot), px = hx + Sc * (cR[0] * cs - cR[1] * sn), py = hy + Sc * (cR[0] * sn + cR[1] * cs);         // where it was, on the stage, for the pop
      a.begin(hx, hy, s * pop(t, 0.02, 0.3), rot, sx, sy);
      if (R > 0.5) {
        const Rh = R / Sc, [bx, by] = cb(Rh), film = mixHex(K.pink, K.pinkL, thin * 0.7);                   // the film thins toward the pop
        ovalO(bx, by, Rh * (1 + wb), Rh * (1 - wb), film, 0.3, 3.2 * k);
        arcS(bx, by, Rh * 0.84, 0.15, 1.35, Rh * 0.07, mixHex(K.pink, K.pinkD, 0.6 - thin * 0.4));
        oval(bx - Rh * 0.42, by - Rh * 0.42, Rh * 0.3, Rh * 0.13, K.white, -0.75); oval(bx - Rh * 0.66, by - Rh * 0.14, Rh * 0.06, Rh * 0.06, K.white);
      }
      glyph(g, k, { color: K.white });
      if (R > 0.5 && ak > 0.05) for (const [ex, ey] of [[64.1, 23.3], [71.5, 50]]) discO(gx(g, k, ex), gy(k, ey), 7 * k * ak * Math.min(1, R / (0.06 * u)), K.pink, 2.6 * k);        // gum stuck to both ends of the gap
      if (be > 0) goo(g, k, be, ak);
      a.end();
      const bp = pop(t, tPop, 0.25) * unpop(t, tPop + 0.4, 0.2), sr = Rmax * 0.55 * bp;                   // the pop, over everything: rings, the comic star, then the shards
      if (be > 0) { pulse(px, py, t, tPop, 0.5, Rmax * 1.15, u * 0.05, K.pinkL); pulse(px, py, t, tPop + 0.07, 0.5, Rmax * 0.8, u * 0.03, K.white); }
      if (bp > 0.02) { starO(px, py, sr, 12, sr * 0.62, be * 1.4, K.yellow, 3 * k); word('POP', px, py, sr * 0.0058, K.pink, -0.12); }
      spray(a, t, { x: px, y: py, n: a.n(26), t0: tPop, life: 1.1, v0: u * 0.7, v1: u * 2.4, g: 1000, s0: 10, s1: 26, seed: 900, shape: 'tri', cols: [K.pink, K.pinkL, K.pinkD, K.white] });
      spray(a, t, { x: px, y: py, n: a.n(16), t0: tPop, life: 1.0, v0: u * 0.5, v1: u * 1.8, g: 900, seed: 950, cols: [K.yellow, K.sky, K.white, K.pinkL] });
    },
  },

  /* H: a hula dancer: the hoop orbits its waist (back half behind the letter, front half over it), the hips swing, a grass skirt and a hibiscus */
  H: {
    color: K.pink, bg: K.orange, dur: 2.9,
    back(a, t) {
      const { u, k, w, h } = a, hz = h * 0.07, sunR = Math.min(0.56 * u, 0.44 * w) * a.x(0.15) * pop(t, 0.05, 0.6), sy = hz - sunR * 0.5, c = raw();
      disc(0, sy, sunR * 1.75, K.orangeM); disc(0, sy, sunR * 1.38, K.orangeL); disc(0, sy, sunR, K.yellow);
      c.save(); c.beginPath(); c.arc(0, sy, sunR, 0, TAU); c.clip();                                      // the striped sun: bands that fatten toward the bottom
      for (let i = 0; i < 5; i++) box(0, sy + sunR * (0.02 + i * 0.16), sunR * 2.2, sunR * (0.025 + 0.03 * i), i > 2 ? K.red : K.orange);
      c.restore();
      band(-a.bw / 2, a.bw / 2, hz, 5 * k, u * 0.9, t * 1.6, K.teal, a.bh);                               // sea, then sand
      for (let i = 0; i < 3; i++) wave(-w / 2 - 20, w / 2 + 20, hz + (0.045 + i * 0.05) * h, 4 * k, u * (0.5 + i * 0.1), t * (2 + i) + i, 5 * k, K.tealL);
      band(-a.bw / 2, a.bw / 2, h * 0.245, 6 * k, u * 1.2, 1, K.yellowL, a.bh);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) {                                           // palm fronds swaying in from the top corners
        const sd = i ? 1 : -1, ang = (i ? PI - 0.35 - j * 0.32 : 0.35 + j * 0.32) + S(t * 1.6 + j + i * 2) * 0.05;
        frond(sd * w * 0.52, -h * 0.5, ang, u * (0.78 - j * 0.06) * pop(t, 0.08 + j * 0.06, 0.5), i ? -1 : 1, j & 1 ? K.green : K.lime, K.greenD);
      }
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {                                           // big leaves at the bottom corners
        const sd = i ? 1 : -1;
        leaf(sd * (w * 0.5 - j * u * 0.13), h * 0.5 - j * u * 0.02, u * 0.34 * pop(t, 0.2 + j * 0.08, 0.5), sd * (0.5 + j * 0.35), j & 1 ? K.greenD : K.green, K.limeD);
      }
      for (let i = 0; i < 3; i++) hibiscus([-0.38, 0.4, 0.34][i] * w, [-0.3, -0.34, 0.26][i] * h, u * 0.1 * pop(t, 0.3 + i * 0.12, 0.5), t * 0.4 + i, [K.red, K.white, K.magenta][i]);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, ak = a.ak, s = (w < h ? 0.98 : 0.72) * (a.big ? 0.92 : 1), Sc = s * hs, X = a.x(0.4), footY = h * 0.27;
      const sw = E.io(seg(t, 0.2, 0.7)) * (1 - E.io(seg(t, 2.15, 2.4))), ph = t * 10, A = 9 * sw * X, bob = Math.abs(S(ph)) * u * 0.012 * sw;       // how hard it is swinging, the beat, the hips' reach
      const rot = -0.12 * S(ph) * sw * a.x(0.3), foot = 50 * k * Sc, sh = S(ph) * A, nh = a.big ? 3 : 1, fit = Math.min(1, 0.46 * w / ((50 + (nh - 1) * 9) * k * Sc));
      const bump = y => Math.max(0, S(PI * y / 100)) ** 1.5;                                              // the waist moves most, the feet not at all
      petals(a, t);
      a.begin(S(rot) * foot, footY - C(rot) * foot - bob, s * pop(t, 0.02, 0.3), rot, 1, 1);
      for (let m = 0; m < nh; m++) hoop(k, t, ph + m * 2.1, sh, m, false, ak, fit);                       // the back of the hoops, behind the letter
      glyph(dense(g), k, { color: K.pink, fn: (x, y) => { P.x = x + sh * (bump(y) - 0.3 * Math.max(0, 1 - y / 40)); P.y = y; } });
      skirt(g, k, ph, sh, ak);
      for (let m = 0; m < nh; m++) hoop(k, t, ph + m * 2.1, sh, m, true, ak, fit);                        // and the front, over it
      hibiscus(gx(g, k, 4), gy(k, 2), 15 * k * ak * pop(t, 0.3, 0.4), t * 0.6, K.red);
      a.end();
    },
  },

  /* I: an inchworm inches along a ruler, arching at every stride, then munches a leaf and rears up as the letter */
  I: {
    color: K.green, bg: K.lime, dur: 2.9,
    back(a, t) {
      const { u, k, w, h } = a, { sg, ox, oy, gk, p0 } = ground(a), R = Math.hypot(a.bw, a.bh) / 2, c = raw(), th = u * 0.12, d = stride(a);
      rays(-w * 0.42, -h * 0.44, 18, R, t * 0.12, K.limeM, 0.5);
      disc(-w * 0.42, -h * 0.44, u * 0.19 * pop(t, 0.05, 0.5), K.yellow); disc(-w * 0.42, -h * 0.44, u * 0.12 * pop(t, 0.1, 0.5), K.orange);
      band(-a.bw / 2, a.bw / 2, -h * 0.08, h * 0.03, w * 0.8, 1, K.greenL, a.bh);
      c.save(); c.translate(ox, oy); c.rotate(sg);
      for (let i = 0; i < 5; i++) { c.fillStyle = i & 1 ? K.greenD : K.green; c.fillRect(-R, th + i * u * 0.3, 2 * R, u * 0.3 + 2); }      // the hillside, in mown stripes
      c.fillStyle = K.ink; c.fillRect(-R, -3 * k, 2 * R, th + 6 * k);                                     // the ruler
      c.fillStyle = K.yellow; c.fillRect(-R, 0, 2 * R, th);
      bits([K.ink], 60, i => { const m = i - 24, p = p0 + gk * (WORM_L + m * d / 2); if (Math.abs(p) < R) addBox(p, th * (m & 1 ? 0.15 : 0.25), 2.5 * k, th * (m & 1 ? 0.3 : 0.5), 0); });
      for (let j = 1; j <= WORM_N; j++) {                                                                 // the inches count up as the head arrives
        const kk = th * 0.0088 * pop(t, 0.3 + 0.44 * j, 0.3);
        if (kk > 0.001) { c.save(); c.translate(p0 + gk * (WORM_L + j * d) + 9 * k, th * 0.58); glyph(glyphOf(String(j)), kk, { color: K.ink, ol: 0, sh: 0 }); c.restore(); }
      }
      c.restore();
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, ak = a.ak, gd = ground(a), { sg, gk, p0 } = gd, Sc = gk / k, s = Sc / hs, L = WORM_L, n = WORM_N, d = stride(a);
      const t0 = 0.3, cyc = 0.44, tp = 0.24, tBite = 1.68, tUp = 1.98;
      // where the two ends of the body are, in glyph units along the ground: the tail pulls forward, then the head reaches
      const cph = (t - t0) / cyc, ci = clamp(Math.floor(cph), 0, n - 1), f = cph - ci, pull = E.io(seg(f, 0, tp / cyc)), reach = E.io(seg(f, tp / cyc, 1));
      const Tu = d * (ci + pull), Hu = L + d * (ci + reach), chord = Hu - Tu, A = Math.sqrt(Math.max(0, 3 * chord * (L - chord) / 8)), up = E.outBack(seg(t, tUp, tUp + 0.4));
      const warp = (x, y) => {                                                                            // bends the straight I into an arch over the chord, feet turned to follow
        const sN = clamp((91.5 - y) / L, 0, 1), uu = x - 23, dx = -4 * A * (1 - 2 * sN), nl = Math.hypot(dx, chord);
        P.x = 23 - 4 * A * sN * (1 - sN) + chord / nl * uu; P.y = 50 + chord / 2 - sN * chord - dx / nl * uu;
      };
      const pc = p0 + gk * (Hu + Tu) / 2, qc = gk * 23 * chord / Math.hypot(chord, 4 * A) + 4 * k * Sc, lie = gd.at(pc, qc);
      const standP = gd.at(p0 + gk * (n * d + 10), 0), stand = [standP[0], standP[1] - 50 * gk - 4 * k * Sc];
      const nod = -0.05 * S((t - tBite) * 32) * seg(t, tBite, tBite + 0.3) * (1 - seg(t, tBite + 0.28, tBite + 0.32));
      const x = lerp(lie[0], stand[0], up), y = lerp(lie[1], stand[1], up) - S(PI * sat(up)) * u * 0.05, rot = lerp(PI / 2 + sg + nod, 0, up);
      for (let j = 0, nt = a.n(6); j < nt; j++) {                                                         // grass and flowers spring up behind the tail
        const uj = -0.2 * d + j * (n * d + 0.6 * d) / nt, gr = pop(t, t0 + cyc * uj / d + 0.05, 0.4) * (ak > 0.05 ? 1 : ak);
        if (gr < 0.02) continue;
        const [bx, by] = gd.at(p0 + gk * uj, 0), col = [K.pink, K.white, K.orange, K.magenta, K.red, K.purple][j % 6], fh = (26 + 22 * a.r(j, 1)) * gk;
        if (j & 1) { line(bx, by, bx + S(t * 2 + j) * 3 * k, by - fh * gr, 4 * k, K.greenD); flower(bx + S(t * 2 + j) * 3 * k, by - fh * gr, 13 * gk * gr, t * 0.5 + j, 6, col, K.yellow); }
        bits([K.greenD, K.green, K.greenL], 5, i => { const lean = (i - 2) * 0.28 + S(t * 2 + j + i) * 0.06, bh = (16 + 10 * ((i + j) % 3)) * gk * gr; blade(bx + (i - 2) * 4.5 * gk * gr, by, bh, lean, 4.5 * gk * gr); });
      }
      for (let i = 0, nbf = a.n(2); i < nbf; i++) {                                                       // butterflies wander over the meadow
        const ph = t * (1.1 + 0.3 * i) + i * 2.4, bx = (-0.15 + 0.4 * i - 0.25 * (i & 1)) * w + S(ph) * w * 0.14, by = (-0.2 - 0.06 * i) * h + S(ph * 2.1) * h * 0.06;
        butterfly(bx, by, u * 0.05 * pop(t, 0.5 + i * 0.15, 0.4), S(ph) * 0.3, t * 14 + i * 2, [K.pink, K.orange, K.white][i % 3], [K.yellow, K.magenta, K.sky][i % 3]);
      }
      // the plant with the leaf it eats: three bites and the leaf is gone
      const stem = gd.at(p0 + gk * (n * d + L + 42), 0), lp = pop(t, 0.35, 0.4) * ak, sl = 0.16 * u * lp;
      const bites = 0.3 * E.out(seg(t, tBite, tBite + 0.1)) + 0.3 * E.out(seg(t, tBite + 0.14, tBite + 0.24)) + 0.4 * E.out(seg(t, tBite + 0.28, tBite + 0.38));
      if (lp > 0.02) {
        line(stem[0], stem[1], stem[0], stem[1] - 0.3 * u * lp, 7 * k, K.ink); line(stem[0], stem[1], stem[0], stem[1] - 0.3 * u * lp, 3.5 * k, K.greenD);
        for (const [len, hgt, dir, col] of [[sl * (1 - bites), 26 * gk, -1, K.green], [0.15 * u * lp, 0.22 * u * lp, 1, K.greenL], [0.1 * u * lp, 0.3 * u * lp, -1, K.teal]]) {
          const ang = dir * (1.15 + 0.1 * S(t * 3 + hgt)), bx = stem[0], by = stem[1] - hgt - (dir < 0 && len > 1 ? len * 0.4 : 0);
          leaf(bx + S(ang) * len, by - C(ang) * len, len + 2.4 * k, ang, K.ink); leaf(bx + S(ang) * len, by - C(ang) * len, len, ang, col, K.greenD);
        }
      }
      for (let j = 0; j < 3; j++) {                                                                       // crumbs of leaf with each bite
        spray(a, t, { x: stem[0] - 0.13 * u * (1 - bites), y: stem[1] - 34 * gk, n: a.n(8), t0: tBite + j * 0.14, life: 0.6, v0: u * 0.3, v1: u * 0.9, g: 1200, s0: 4, s1: 10, seed: 1000 + j * 30, cols: [K.lime, K.green, K.yellow] });
      }
      spray(a, t, { x, y, n: a.n(20), t0: tUp + 0.25, life: 1.0, v0: u * 0.7, v1: u * 1.8, seed: 1100, shape: 'star', cols: [K.yellow, K.pink, K.white, K.orange] });
      a.begin(x, y, s * pop(t, 0.02, 0.3), rot, 1, 1);
      const dg = dense(g), o = { fn: warp };
      glyph(dg, k, { color: K.green, ...o });
      if (ak > 0.05) glyphInk(dg, k, o, K.limeL, 5.5 * ak, [2.5, 12]);                                    // rings round the body
      // the face: two eyes on the head bar, antennae curling off its top
      const wp = (px, py) => { warp(px, py); return [gx(g, k, P.x), gy(k, P.y)]; }, look = lerp(-0.8, 0.5, up);
      if (ak > 0.05) for (const uu of [-5.5, 7]) { const [ex, ey] = wp(23 + uu, 8.5); eyeO(ex, ey, ak * 6.6 * k + 0.1, 0.2, look, (t + uu * 0.1) % 2.1 < 0.1 ? 0.1 : 1, 2 * k); }
      for (const [uu, bend] of [[-11, -0.7], [-3, 0.5]]) {
        const [bx, by] = wp(23 + uu, 6), tx = bx + (-16 + bend * 6) * k * ak, ty = by - 30 * k * ak, sw = S(t * 6 + uu) * 4 * k;
        pline([bx, by, bx + (tx - bx) * 0.5 + sw, by + (ty - by) * 0.55, tx + sw, ty], 3.2 * k * ak, K.ink); disc(tx + sw, ty, 4.4 * k * ak, K.ink);
      }
      a.end();
    },
  },
};

/* ---------- shared bits ---------- */

// a polygon with the dark outline
function polyO(p, col, ol) {
  const c = raw();
  poly(p, col); c.strokeStyle = K.ink; c.lineWidth = ol * 2; c.lineJoin = 'round'; c.stroke();
}
// a star with the dark outline
function starO(x, y, ro, n, ri, rot, col, ol) {
  star(x, y, ro, n, ri, rot, col);
  const c = raw();
  c.strokeStyle = K.ink; c.lineWidth = ol * 2; c.lineJoin = 'round'; c.stroke();
}
// a googly eye with the dark outline, blinking when `blink` drops toward 0
function eyeO(x, y, r, lx, ly, blink, ol) {
  const c = raw();
  c.save(); c.translate(x, y); c.scale(1, Math.max(0.08, blink));
  disc(0, 0, r + ol, K.ink); eye(0, 0, r, lx, ly);
  c.restore();
}
// a word in the stroke font, as stickers, centred on (x, y); kk is pixels per glyph unit
function word(str, x, y, kk, col, rot = 0) {
  const gs = [...str].map(glyphOf), gap = 9, c = raw();
  let px = 0;
  for (const g of gs) px += g.w + gap;
  px = -(px - gap) / 2 * kk;
  c.save(); c.translate(x, y); c.rotate(rot);
  for (const g of gs) { c.save(); c.translate(px + g.w / 2 * kk, 0); glyph(g, kk, { color: col }); c.restore(); px += (g.w + gap) * kk; }
  c.restore();
}
// a glyph with every stroke cut into short pieces, so that a warp (fn) can bend the straight ones
const DENSE = new Map();
function dense(g, step = 4) {
  if (DENSE.has(g.ch)) return DENSE.get(g.ch);
  let off = 0;
  const strokes = g.strokes.map(s => {
    const pts = [], n = s.p.length / 2;
    for (let i = 0; i < n - 1; i++) {
      const x0 = s.p[2 * i], y0 = s.p[2 * i + 1], x1 = s.p[2 * i + 2], y1 = s.p[2 * i + 3], m = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let j = 0; j < m; j++) pts.push(lerp(x0, x1, j / m), lerp(y0, y1, j / m));
    }
    pts.push(s.p[2 * n - 2], s.p[2 * n - 1]);
    const p = Float32Array.from(pts), cum = new Float32Array(p.length / 2);
    for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
    const st = { p, cum, total: cum[cum.length - 1], off };
    off += st.total;
    return st;
  });
  const d = { ch: g.ch, w: g.w, strokes, total: off, feet: g.feet, bottom: g.bottom };
  DENSE.set(g.ch, d);
  return d;
}

/* ---------- C ---------- */

const CANDY = [K.lime, K.sky, K.white, K.orange, K.purple, K.red, K.yellow];
// a sweet: a wrapped one, a round swirly one or a cookie, in turn
function sweet(i, x, y, r, rot) {
  const c = raw(), col = CANDY[i % CANDY.length], kind = i % 3;
  if (kind === 0) {
    c.save(); c.translate(x, y); c.rotate(rot * 0.2);
    for (const sd of [-1, 1]) polyO([sd * r * 0.7, 0, sd * r * 1.7, -r * 0.75, sd * r * 1.7, r * 0.75], K.white, r * 0.1);
    ovalO(0, 0, r * 1.05, r * 0.78, col, 0, r * 0.1);
    line(-r * 0.3, -r * 0.6, -r * 0.3, r * 0.6, r * 0.18, K.white); line(r * 0.3, -r * 0.6, r * 0.3, r * 0.6, r * 0.18, K.white);
    c.restore();
  } else if (kind === 1) {
    discO(x, y, r, col, r * 0.1);
    spiral(x, y, r * 0.05, r * 0.76, 1.6, rot, r * 0.2, K.white);
  } else {
    discO(x, y, r, K.orangeL, r * 0.1);
    bits([K.orangeD], 5, j => { const an = j * 2.4 + rot * 0.2; addDisc(x + C(an) * r * (0.25 + 0.4 * (j % 2)), y + S(an) * r * (0.25 + 0.4 * (j % 2)), r * 0.15); });
  }
}
// the C's stroke with the mouth open `half` degrees either side of the right (45 is the letter itself)
function mouthGlyph(g, half) {
  const a0 = -half * DEG, a1 = -(360 - half) * DEG, n = 40, p = new Float32Array(n * 2 + 2), cum = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const an = a0 + (a1 - a0) * i / n;
    p[2 * i] = 38.5 + 30 * C(an); p[2 * i + 1] = 50 + 41.5 * S(an);
    if (i) cum[i] = cum[i - 1] + Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
  }
  return { w: g.w, total: cum[n], strokes: [{ p, cum, total: cum[n], off: 0 }] };
}
// the C's eye and teeth, in the hero frame: the fangs interlock as the jaws shut
function chompFace(g, k, half, ak, t) {
  if (ak < 0.05) return;
  for (let j = 0; j < 4; j++) {
    const up = j < 2, phi = (half + (up ? 8 : 16) + (j & 1) * 16) * DEG * (up ? -1 : 1), p = [];
    for (const [rx, ry, an] of [[23, 34.5, phi - 8 * DEG], [23, 34.5, phi + 8 * DEG], [10 + (1 - ak) * 12, 20 + (1 - ak) * 12, phi]]) p.push(gx(g, k, 38.5 + rx * C(an)), gy(k, 50 + ry * S(an)));
    polyO(p, K.white, 1.1 * k);
  }
  eyeO(gx(g, k, 27), gy(k, 15), 9 * k * ak, 0.75, 0.25, (t + 0.4) % 1.7 < 0.1 ? 0.1 : 1, 2.5 * k);
}

/* ---------- D ---------- */

const FLOOR = [K.violet, K.magenta, K.indigo, K.purple], FACET = [K.white, K.skyL, K.pinkL, K.yellowL];
// where the mirror ball hangs: [x, y, radius]
function ballAt(a, t) {
  const tall = a.w < a.h, r = Math.min(a.u * 0.21, a.w * 0.15) * (tall ? 1.35 : 1) * a.x(0.3), y0 = -a.h * (tall ? 0.39 : 0.36) - (a.big ? a.h * 0.03 : 0);
  return [S(t * 2.3) * a.w * 0.008, y0 + (E.outBack(seg(t, 0.15, 0.8)) - 1) * a.h * 0.4 + S(t * 3) * a.h * 0.006, r];
}
// a flattened ring on the floor, for the beat
function floorRing(x, y, r, lw, col) {
  if (r <= 0 || lw <= 0) return;
  const c = raw();
  c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(x, y, r, r * 0.28, 0, 0, TAU); c.stroke();
}
// a mirror ball: a grid of facets that turns, drawn flat
function mirrorBall(x, y, r, spin, t, k) {
  const c = raw(), n = 12, tk = Math.floor(t * 2.2);
  discO(x, y, r, K.indigoD, 3 * k);
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  for (let pass = 0; pass < 4; pass++) {
    c.fillStyle = FACET[pass]; c.beginPath();
    for (let j = 0; j < 6; j++) {
      const lat = (j - 2.5) * PI / 6, cl = C(lat), d = PI / 6 * 0.42;
      for (let i = 0; i < n; i++) {
        const lon = i / n * TAU + spin;
        if (C(lon) * cl < 0.06 || (i * 7 + j * 3 + tk) % 4 !== pass) continue;                            // only the facets that face us, colours shifting round
        const dl = TAU / n * 0.42;
        for (let q = 0; q < 4; q++) {
          const lo = lon + (q === 0 || q === 3 ? -dl : dl), la = lat + (q < 2 ? -d : d), px = x + r * C(la) * S(lo), py = y + r * S(la);
          if (q) c.lineTo(px, py); else c.moveTo(px, py);
        }
        c.closePath();
      }
    }
    c.fill();
  }
  c.restore();
}

/* ---------- E ---------- */

// a crackling bolt from (x1, y1) to (x2, y2): a zigzag that re-rolls seven times a second, a coloured glow round a white core
function crackle(x1, y1, x2, y2, n, amp, seed, t, lw, col) {
  if (lw < 0.5) return;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, tk = Math.floor(t * 7), p = [x1, y1];
  for (let i = 1; i < n; i++) { const f = i / n, o = (hash(seed * 31 + i, tk) - 0.5) * 2 * amp; p.push(x1 + dx * f + nx * o, y1 + dy * f + ny * o); }
  p.push(x2, y2);
  pline(p, lw * 1.8, col); pline(p, lw * 0.7, K.white);
}
// the i-th bulb on a string round a rectangle (half sizes bx, by), at distance s along it: dark until it pops on at t0, then lit with glow rings
function bulb(i, s, bx, by, r, t, t0, k) {
  let x, y, nx, ny;
  if (s < 2 * bx) { x = -bx + s; y = -by; nx = 0; ny = 1; }
  else if (s < 2 * bx + 2 * by) { x = bx; y = -by + s - 2 * bx; nx = -1; ny = 0; }
  else if (s < 4 * bx + 2 * by) { x = bx - (s - 2 * bx - 2 * by); y = by; nx = 0; ny = -1; }
  else { x = -bx; y = by - (s - 4 * bx - 2 * by); nx = 1; ny = 0; }
  const p = pop(t, t0, 0.3), on = t > t0, gxp = x + nx * r * 1.9, gyp = y + ny * r * 1.9;
  boxO(x + nx * r * 0.7, y + ny * r * 0.7, nx ? r * 1.2 : r * 1.1, nx ? r * 1.1 : r * 1.2, K.violetL, 0, r * 0.15, 2 * k);
  discO(gxp, gyp, r * (on ? 0.8 + 0.4 * p : 1), on ? K.yellow : K.indigoD, 2.5 * k);
  if (!on) return;
  disc(gxp - r * 0.25, gyp - r * 0.25, r * 0.28, K.white);
  ring(gxp, gyp, r * (1.7 + 0.15 * S(t * 5 + i)) * p, r * 0.22, K.yellowL);
  ring(gxp, gyp, r * (2.5 + 0.2 * S(t * 4 + i * 2)) * p, r * 0.12, K.yellow);
  pulse(gxp, gyp, t, t0, 0.4, r * 4, r * 0.3, K.white);
}

/* ---------- F ---------- */

// the shells that go off round the screen: [style, x, y (fractions of the stage), radius (of u), colours, particles]
const BURSTS = [
  [1, -0.3, -0.26, 0.4, [K.sky, K.white], 30],
  [2, 0.32, -0.08, 0.5, [K.yellow, K.orange, K.white], 20],
  [3, -0.28, 0.0, 0.4, [K.lime, K.white], 40],
  [4, 0.3, -0.34, 0.45, [K.white, K.pinkL, K.skyL], 26],
  [6, 0.0, -0.35, 0.36, [K.pink, K.red, K.white], 32],
  [0, -0.38, -0.08, 0.38, [K.purple, K.magenta, K.white], 22],
  [1, 0.36, -0.3, 0.3, [K.lime, K.yellow], 24],
];
const PT = [0, 0];
// One firework, analytic in its age: 0 peony (streaks), 1 tilted rings, 2 willow (dots with trails), 3 star outline, 4 sparkle, 5 small radial (dots), 6 heart
function firework(a, t, o) {
  const age = t - o.t0, L = o.life;
  if (age <= 0 || age >= L) return;
  const c = raw(), R = o.R, n = o.n, cols = o.cols, nc = cols.length, st = o.style, shrink = 1 - sat((age / L - 0.5) / 0.5) ** 2;
  if (age < 0.14) disc(o.x, o.y, R * 0.36 * (1 - age / 0.14) + 2, K.white);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let ci = 0; ci < nc; ci++) {
    c.fillStyle = c.strokeStyle = cols[ci]; c.lineWidth = Math.max(0.5, R * (st === 0 ? 0.04 : 0.06) * shrink); c.beginPath();
    for (let i = ci; i < n; i += nc) {
      if (st === 2) {                                                                                     // willow: each piece drags a trail of dots
        for (let j = 0; j < 6; j++) {
          const ag = age - j * 0.055;
          if (ag <= 0) break;
          spot(o, i, n, ag, st, a);
          const r = R * 0.05 * shrink * (1 - j * 0.15);
          if (r > 0.5) { c.moveTo(o.x + PT[0] + r, o.y + PT[1]); c.arc(o.x + PT[0], o.y + PT[1], r, 0, TAU); }
        }
      } else if (st === 0) {                                                                              // peony: streaks along the way
        spot(o, i, n, age, st, a);
        const x1 = o.x + PT[0], y1 = o.y + PT[1];
        spot(o, i, n, Math.max(0, age - 0.22), st, a);
        c.moveTo(o.x + PT[0], o.y + PT[1]); c.lineTo(x1, y1);
      } else if (st === 4) {                                                                              // sparkle: twinkling four-point stars
        spot(o, i, n, age, st, a);
        const sz = R * 0.15 * shrink * (0.35 + 0.65 * Math.abs(S(age * 11 + i * 2.3)));
        addStar(o.x + PT[0], o.y + PT[1], sz, sz * 0.22, 4, i);
      } else {                                                                                            // the others: dots
        spot(o, i, n, age, st, a);
        const r = R * 0.06 * shrink * (st === 3 ? 1.15 : 1);
        if (r > 0.5) { c.moveTo(o.x + PT[0] + r, o.y + PT[1]); c.arc(o.x + PT[0], o.y + PT[1], r, 0, TAU); }
      }
    }
    if (st === 0) c.stroke(); else c.fill();
  }
}
// where piece i of n of a firework has got to after ag seconds, relative to the burst centre (written into PT)
function spot(o, i, n, ag, st, a) {
  const R = o.R, sd = o.seed, e = 1 - Math.exp(-2.6 * ag);
  let dx, dy;
  if (st === 0 || st === 5) {
    const an = (i + 0.4 * a.r(sd + i, 1)) / n * TAU, f = 0.65 + 0.35 * (i & 1 ? 1 : a.r(sd + i, 2));
    dx = C(an) * R * e * f; dy = S(an) * R * e * f + R * 0.3 * ag * ag;
  } else if (st === 1) {
    const half = n >> 1, big = i < half, an = (big ? i / half : (i - half + 0.5) / half) * TAU, rr = R * e * (big ? 1 : 0.55), ex = C(an) * rr, ey = S(an) * rr * 0.45;
    dx = ex * C(0.5) - ey * S(0.5); dy = ex * S(0.5) + ey * C(0.5) + R * 0.12 * ag * ag;
  } else if (st === 2) {
    const an = -PI + (0.08 + 0.84 * (i + 0.5) / n) * PI, v = 0.45 + 0.55 * a.r(sd + i, 3), ee = 1 - Math.exp(-1.8 * ag);
    dx = C(an) * R * ee * v * 1.2; dy = S(an) * R * ee * v * 1.2 + R * 1.3 * ag * ag;
  } else if (st === 3) {
    const q = i / n * 10, ed = Math.floor(q), f = q - ed, a0 = -PI / 2 + ed * PI / 5, a1 = a0 + PI / 5, r0 = ed & 1 ? 0.42 : 1, r1 = ed & 1 ? 1 : 0.42, ee = 1 - Math.exp(-3 * ag);
    dx = lerp(C(a0) * r0, C(a1) * r1, f) * R * ee; dy = lerp(S(a0) * r0, S(a1) * r1, f) * R * ee + R * 0.2 * ag * ag;
  } else if (st === 4) {
    const an = a.r(sd + i, 1) * TAU, v = 0.15 + 0.85 * a.r(sd + i, 2), ee = 1 - Math.exp(-1.8 * ag);
    dx = C(an) * R * ee * v; dy = S(an) * R * ee * v + R * 0.5 * ag * ag;
  } else {
    const th = i / n * TAU, ee = 1 - Math.exp(-3 * ag), s3 = S(th);
    dx = 16 * s3 * s3 * s3 * R / 17 * ee; dy = -(13 * C(th) - 5 * C(2 * th) - 2 * C(3 * th) - C(4 * th)) * R / 17 * ee + R * 0.2 * ag * ag;
  }
  PT[0] = dx; PT[1] = dy;
}
// the rocket's exhaust, pointing down from (x, y)
function flame(x, y, len, k) {
  poly([x - 8 * k, y, x + 8 * k, y, x, y + len], K.red); poly([x - 5.5 * k, y, x + 5.5 * k, y, x, y + len * 0.72], K.orange);
  poly([x - 3.2 * k, y, x + 3.2 * k, y, x, y + len * 0.45], K.yellow); poly([x - 1.5 * k, y, x + 1.5 * k, y, x, y + len * 0.22], K.white);
}

/* ---------- G ---------- */

// the gum left on the letter after the pop: drips run down from splats, and strings stretch toward where the bubble was, thin, and snap back
function goo(g, k, age, ak) {
  if (ak < 0.05) return;
  const c = raw();
  c.lineCap = 'round'; c.strokeStyle = K.pink;
  for (let j = 0; j < 7; j++) {
    const [x, y] = trace(g, k, 0.05 + 0.9 * hash(j, 3)), r = (6 + 5 * hash(j, 6)) * k * ak * E.outBack(sat(age / 0.2)), len = (12 + 34 * hash(j, 5)) * k * ak * E.out(sat((age - 0.15) / 0.6));
    if (len > 1) { c.lineWidth = 5 * k * ak; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (hash(j, 8) - 0.5) * 4 * k, y + len); c.stroke(); disc(x + (hash(j, 8) - 0.5) * 4 * k, y + len, 3.6 * k * ak, K.pink); }
    blob(x, y, r + 2 * k, j, 0.25, age * 0.6, K.ink, 10); blob(x, y, r, j, 0.25, age * 0.6, K.pink, 10);
  }
  for (let j = 0; j < 5; j++) {
    const [x, y] = trace(g, k, j & 1 ? 0.97 - 0.02 * j : 0.01 + 0.02 * j), an = -0.35 + (hash(j, 4) - 0.5) * 1.2;
    const len = (40 + 50 * hash(j, 5)) * k * ak * E.out(sat(age / 0.28)) * (1 - E.in(seg(age, 0.3 + 0.03 * j, 0.46 + 0.03 * j)));
    if (len > 1) { c.lineWidth = 5 * k * ak * (1 - 0.7 * sat(age / 0.4)); c.beginPath(); c.moveTo(x, y); c.lineTo(x + C(an) * len, y + S(an) * len); c.stroke(); disc(x + C(an) * len, y + S(an) * len, 3.4 * k * ak, K.pink); }
  }
}

/* ---------- H ---------- */

// a hula hoop round the waist: a striped ellipse ring, drawn as its back half (behind the letter) or its front half, wobbling as it orbits
const HOOP = [[K.teal, K.white, K.yellow], [K.red, K.white, K.pinkL], [K.lime, K.white, K.purple]];
function hoop(k, t, ph, sh, m, front, ak, fit) {
  const c = raw(), grow = pop(t, 0.12 + m * 0.08, 0.45) * ak;
  if (grow < 0.02) return;
  const rx = (50 + m * 9) * k * grow * fit, ry = (13 + m * 2) * k * grow * fit, ox = sh * k + 12 * k * C(ph) * grow, oy = 4 * k * S(ph), th = 0.24 * C(ph + 0.6), lw = 8.5 * k * grow, cols = HOOP[m % 3];
  const cs = C(th), sn = S(th), lo = front ? 0 : PI, hi = front ? PI : TAU, spin = t * 4 + m, n = 18, da = TAU / n;
  c.lineCap = 'butt';
  c.strokeStyle = K.ink; c.lineWidth = lw + 5 * k; c.beginPath(); c.ellipse(ox, oy, rx + 0.5, ry + 0.5, th, lo - 0.02, hi + 0.02); c.stroke();
  for (let ci = 0; ci < 3; ci++) {                                                                        // the stripes turn round the ring, three colours in turn
    c.strokeStyle = cols[ci]; c.lineWidth = lw; c.beginPath();
    for (let i = ci; i < n; i += 3) {
      const s0 = ((spin + i * da) % TAU + TAU) % TAU;
      for (let wrap = 0; wrap < 2; wrap++) {                                                              // (a stripe can straddle the seam at 2 pi)
        const e0 = Math.max(s0 - wrap * TAU, lo), e1 = Math.min(s0 + da - wrap * TAU, hi);
        if (e1 - e0 > 0.001) { c.moveTo(ox + rx * C(e0) * cs - ry * S(e0) * sn, oy + rx * C(e0) * sn + ry * S(e0) * cs); c.ellipse(ox, oy, rx, ry, th, e0, e1); }
      }
    }
    c.stroke();
  }
}
// a grass skirt of leaves hanging from the crossbar, swinging
function skirt(g, k, ph, sh, ak) {
  if (ak < 0.05) return;
  for (let i = 0; i < 7; i++) {
    const sw = 0.35 * S(ph * 0.5 - i * 0.55 + 1), s = 15 * k * ak, px = gx(g, k, 21 + i * 4.7) + sh * k, py = gy(k, 56);
    leaf(px - S(sw) * s, py + C(sw) * s, s + 2.4 * k, sw, K.ink);
    leaf(px - S(sw) * s, py + C(sw) * s, s, sw, i & 1 ? K.lime : K.green);
  }
}
// a hibiscus: five petals, a yellow heart and a long stamen
function hibiscus(x, y, r, rot, col) {
  if (r < 1) return;
  const sx = x + C(rot - 0.9) * r * 0.95, sy = y + S(rot - 0.9) * r * 0.95;
  flower(x, y, r, rot, 5, col, K.yellow);
  line(x, y, sx, sy, Math.max(1, r * 0.09), K.orangeD); disc(sx, sy, r * 0.11, K.yellow);
}
// a palm frond as one comb-shaped polygon (leaflets on both sides of a curving stem), from (x, y) along ang, curling by `curl`
function frond(x, y, ang, len, curl, col, stem) {
  if (len < 2) return;
  const n = 9, pts = [], back = [], cs = C(ang), sn = S(ang);
  for (let j = 0; j <= n; j++) {
    const f = j / n, px = x + cs * len * f - sn * curl * len * 0.3 * f * f, py = y + sn * len * f + cs * curl * len * 0.3 * f * f, ll = len * 0.2 * S(PI * (0.1 + 0.9 * f)) + len * 0.02;
    const ta = ang + curl * 0.6 * f, tx = -S(ta), ty = C(ta), ax = C(ta) * len * 0.05, ay = S(ta) * len * 0.05;
    pts.push(px, py, px + tx * ll + ax * 2, py + ty * ll + ay * 2); back.push(px - tx * ll + ax * 2, py - ty * ll + ay * 2, px, py);
  }
  for (let j = back.length - 2; j >= 0; j -= 2) pts.push(back[j], back[j + 1]);
  poly(pts, col);
  line(x, y, x + cs * len - sn * curl * len * 0.3, y + sn * len + cs * curl * len * 0.3, Math.max(2, len * 0.02), stem);
}
// petals drifting down over everything
function petals(a, t) {
  const c = raw(), n = a.n(16), u = a.u, age = t - 0.2;
  if (age <= 0) return;
  for (let ci = 0; ci < 3; ci++) {
    c.fillStyle = [K.pinkL, K.white, K.yellow][ci]; c.beginPath();
    for (let i = ci; i < n; i += 3) {
      const sp = 90 + 160 * a.r(i, 2), y = -a.h / 2 - 30 + (age * sp * 1.5 + a.r(i, 6) * (a.h + 60)) % (a.h + 60), x = (a.r(i, 1) - 0.5) * a.w + S(age * (1 + a.r(i, 7)) + i) * 40;
      const r = u * (0.02 + 0.02 * a.r(i, 3)), rot = age * (a.r(i, 5) - 0.5) * 5 + i;
      c.moveTo(x + r * C(rot), y + r * S(rot)); c.ellipse(x, y, r, r * 0.55, rot, 0, TAU);
    }
    c.fill();
  }
}

/* ---------- I ---------- */

// the inchworm is the I's stem, 83 long: it takes WORM_N strides across the ruler, each a fraction of its length (deeper arches for capitals)
const WORM_L = 83, WORM_N = 3, stride = a => WORM_L * (a.big ? 0.58 : 0.5);
// the ground the worm crawls on: a slope with a ruler along it. p is the distance along the slope from (ox, oy), q the height above it, p0 where the tail starts.
// Tall screens get a steeper slope, so that the worm can be bigger.
function ground(a) {
  const asp = clamp((a.h / a.w - 0.7) / 1.1, 0, 1), sg = -(0.2 + 0.7 * asp), cs = C(sg), sn = S(sg), d = stride(a);
  const gk = Math.min(a.k * 0.8 * (a.big ? 1.1 : 1), 0.9 * 0.94 * a.w / cs / (WORM_L + WORM_N * d + 45)), ox = 0, oy = a.h * 0.14 * (1 - asp);
  return { sg, gk, ox, oy, p0: -0.43 * a.w / cs, at: (p, q) => [ox + p * cs + q * sn, oy + p * sn - q * cs] };
}
// a butterfly seen from above: two pairs of wings that flap, and a body
function butterfly(x, y, s, rot, flap, col, spot) {
  if (s < 1) return;
  const c = raw(), fl = Math.abs(C(flap)) * 0.8 + 0.2;
  c.save(); c.translate(x, y); c.rotate(rot);
  for (const sd of [-1, 1]) { ovalO(sd * s * 0.9 * fl, -s * 0.55, s * 0.95 * fl, s * 0.7, col, sd * -0.4, s * 0.12); ovalO(sd * s * 0.7 * fl, s * 0.6, s * 0.65 * fl, s * 0.5, spot, sd * 0.4, s * 0.12); }
  ovalO(0, 0, s * 0.16, s * 0.85, K.ink, 0, 0);
  c.restore();
}
// a grass blade for a bits() path: a thin triangle standing on (x, y), bh tall, leaning by lean, bw wide at the foot
function blade(x, y, bh, lean, bw) {
  const c = raw();
  c.moveTo(x - bw, y); c.lineTo(x + S(lean) * bh, y - C(lean) * bh); c.lineTo(x + bw, y); c.closePath();
}
