// A to Z. Each entry is { color (the letter's own colour), bg (what floods the page), dur (seconds, before it shrinks
// away), back(a, t) (its environment, under the text), draw(a, t) (its characters and confetti, over everything) }.
// Scenes draw around 0,0 (their own centre) and are pure functions of t; the letter itself is drawn inside
// a.begin() … a.end(), which is what lands in the text when the scene is over.
import {
  K, E, S, C, TAU, PI, sat, clamp, seg, lerp, pop, spring, wob, rays, disc, ring, oval, ovalO, box, boxO, line, pline, poly, tri, star, spark, leaf,
  arcS, blob, wave, band, spiral, cloud, flower, eye, eyes, ngon, spray, fall, pulse, legs, glyph, glyphInk, gx, gy, alpha
} from './kit.js';
import { pointAt } from './font.js';

export const LETTERS = {
  /* A: struts down a runway on long legs, in the flashbulbs */
  A: {
    color: K.pink, bg: K.blue, dur: 2.8,
    back(a, t) {
      const { u, k, w, h } = a, s = 0.74, groundY = h * 0.33, unit = k * s * a.hs, rw = a.bw;
      rays(0, 0, 24, Math.hypot(a.bw, a.bh) / 2, t * 0.3, K.blueM, 0.5);
      alpha(0.2);                                                   // spotlights swinging in from the top corners
      for (const sd of [-1, 1]) { const sw = S(t * 2.1 + sd * 1.3) * w * 0.16, x = sd * w * 0.45; poly([x, -h / 2 - 200, x + sw - u * 0.45, groundY, x + sw + u * 0.45, groundY], K.white); }
      alpha(1);
      box(0, groundY + 22 * unit, rw, 40 * unit, K.white, 0, 20 * unit);   // the runway, its dashes sliding by
      box(0, groundY + 42 * unit, rw, 8 * unit, K.pinkD, 0, 4 * unit);
      const span = u * 2.4;
      for (let i = 0; i < 14; i++) box(-rw / 2 + (((i / 14) * rw - t * u * 1.1) % span + span) % span, groundY + 24 * unit, 32 * unit, 6 * unit, K.pinkL, 0, 3 * unit);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 0.74, hs = a.hs, groundY = h * 0.33, y0 = groundY - 91 * k * s * hs, unit = k * s * hs;
      const walk = E.io(seg(t, 0.12, 1.75)), mv = 1 - E.io(seg(t, 1.6, 1.85)), spin = E.io(seg(t, 1.8, 2.3));
      const phase = walk * 15, hx = lerp(-w * 0.31, 0, walk), bob = -Math.abs(C(phase)) * 9 * unit * mv, intro = pop(t, 0.02, 0.32);
      spray(a, t, { x: hx, y: y0, n: a.n(30), t0: 1.85, life: 1.1, v0: u * 0.8, v1: u * 2, seed: 11, cols: [K.pink, K.yellow, K.white, K.sky, K.lime] });
      fall(a, t, { n: a.n(26), t0: 1.75, cols: [K.pink, K.yellow, K.white, K.skyL, K.lime], seed: 300 });
      a.begin(hx, y0 + bob, s * intro, S(phase) * 0.06 * mv, C(spin * TAU), 1);
      legs(g, k, { phase, stride: 17 * mv, lift: 16 * mv, len: 56, dir: 1, col: K.cream, shoe: K.red, heel: true, k: a.ak });
      glyph(g, k, { color: K.pink });
      a.end();
      for (let i = 0, n = a.n(13); i < n; i++) {                     // flashbulbs going off all round
        const tb = 0.3 + i * 1.7 / n + a.r(i) * 0.08, p = seg(t, tb, tb + 0.26);
        if (p <= 0 || p >= 1) continue;
        const x = (a.r(i, 1) < 0.5 ? -1 : 1) * (0.16 + a.r(i, 2) * 0.32) * w, y = (-0.4 + a.r(i, 3) * 0.55) * h, sz = u * 0.2 * S(p * PI) * (0.6 + a.r(i, 4) * 0.7);
        spark(x, y, sz, a.r(i, 5), K.white); disc(x, y, sz * 0.2, K.yellow);
      }
    },
  },

  /* B: a bee zooms figure-eights over flowers that pop up as it passes */
  B: {
    color: K.yellow, bg: K.sky, dur: 2.9,
    back(a, t) {
      const { u, k, w, h } = a, bw = a.bw;
      for (let i = 0; i < 3; i++) cloud(((-0.35 + i * 0.38) * w - t * u * 0.12 + w * 1.4) % (w * 1.2) - w * 0.6, -h * (0.3 - i * 0.03), u * (0.16 + i * 0.03), K.white);
      const hill = x => h * 0.31 + h * 0.03 * S(x / (w * 0.6) * TAU + 0.5);
      band(-bw / 2, bw / 2, h * 0.29, h * 0.02, w * 0.9, 2, K.lime, a.bh);
      band(-bw / 2, bw / 2, h * 0.31, h * 0.03, w * 0.6, 0.5, K.green, a.bh);
      const nf = a.n(7);                                            // flowers spring up one after another
      for (let i = 0; i < nf; i++) {
        const x = (-0.44 + 0.88 * (i + 0.5) / nf) * w, gr = pop(t, 0.3 + i * 0.5 / nf * 1.6, 0.4), top = hill(x) - (0.11 + 0.06 * a.r(i)) * h * gr, sw = S(t * 2.2 + i) * 4 * k;
        line(x, hill(x) + 6, x + sw, top, 6 * k, K.greenD);
        leaf(x + sw * 0.5 + 8 * k, (top + hill(x)) / 2, 9 * k * gr, 1.1, K.greenD);
        flower(x + sw, top, 15 * k * gr, t * (i & 1 ? 0.6 : -0.6), 6, [K.pink, K.white, K.orange, K.red, K.purple][i % 5], K.yellow);
      }
      for (let i = 0; i < a.n(6); i++) {                            // honeycomb floating up
        const y = h * 0.4 - (((t * u * 0.28 + a.r(i, 2) * h) % (h * 0.9))), x = (a.r(i, 1) - 0.5) * w * 0.9 + S(t * 2 + i) * 10;
        ngon(x, y, u * (0.05 + a.r(i, 3) * 0.04), 6, 0.3, K.yellowL);
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 0.7, X = a.X;
      const amp = 0.3 * (1 + (X - 1) * 0.25), pos = tt => [amp * w * S(tt * 1.15), -0.06 * h + 0.17 * h * S(tt * 2.3 + 0.6)];
      const tt = t * 2.0, home = E.io(seg(t, 1.75, 2.3)), p0 = pos(tt), p1 = pos(tt + 0.03);
      const bx = lerp(p0[0], 0, home), by = lerp(p0[1], -0.02 * h, home), tilt = clamp((p1[0] - p0[0]) / 0.03 * 0.0006, -0.5, 0.5) * (1 - home);
      for (let j = 1; j < 26; j += 2) { const q = pos(tt - j * 0.07), fade = 1 - j / 26; if (t - j * 0.035 > 0) disc(lerp(q[0], 0, home), lerp(q[1], -0.02 * h, home), 7 * k * fade, K.white); }
      spray(a, t, { x: bx, y: by, n: a.n(26), t0: 1.9, life: 1.1, v0: u * 0.8, v1: u * 1.9, seed: 21, cols: [K.yellow, K.white, K.pink, K.orange] });
      const flap = Math.abs(S(t * 42));
      a.begin(bx, by, s * pop(t, 0.02, 0.3), tilt, 1, 1);
      for (const [wx, wy, wa, wl] of [[24, 6, -1.05, 30], [36, 4, -0.5, 34]]) wing(gx(g, k, wx), gy(k, wy), wl * k * a.ak, (6 + 11 * flap) * k * a.ak, wa);
      glyph(g, k, { color: K.yellow });
      for (const [sx, sy] of [[8.5, 28], [8.5, 70], [58.5, 29], [64, 71]]) box(gx(g, k, sx), gy(k, sy), 18 * k * a.ak, 5.5 * k, K.ink);       // the stripes
      line(gx(g, k, 16), gy(k, 8), gx(g, k, 4), gy(k, -16), 3.5 * k, K.ink); disc(gx(g, k, 4), gy(k, -16), 4.5 * k, K.ink);
      line(gx(g, k, 30), gy(k, 8), gx(g, k, 40), gy(k, -18), 3.5 * k, K.ink); disc(gx(g, k, 40), gy(k, -18), 4.5 * k, K.ink);
      eye(gx(g, k, 50), gy(k, 29), 9 * k * a.ak + 0.1, 0.6, 0.05);
      tri(gx(g, k, 72), gy(k, 82), 7 * k * a.ak, 0, K.ink);
      a.end();
    },
  },

  /* S: a snake grows out of nothing and slithers in front of a hypnotic spiral */
  S: {
    color: K.green, bg: K.violet, dur: 2.8,
    back(a, t) { spiral(0, 0, 0, Math.hypot(a.bw, a.bh) / 2, 8, t * 1.6, a.u * 0.13, K.violetD); },
    draw(a, t) {
      const { u, k, g } = a, s = 1.0;
      fall(a, t, { n: a.n(20), t0: 0.6, cols: [K.yellow, K.white, K.lime, K.pinkL], shape: 'spark', vy0: 120, vy1: 300, seed: 50 });
      spray(a, t, { x: 0, y: 0, n: a.n(24), t0: 0.85, life: 1.0, v0: u * 0.7, v1: u * 1.6, seed: 61, cols: [K.yellow, K.lime, K.white, K.pinkL] });
      const grow = E.out(seg(t, 0.1, 0.8)), amp = 7 * seg(t, 0.7, 1.1) * a.x(0.3), ph = -t * 9;
      const o = { t1: grow, slither: { amp, k: 19, ph } }, sway = S(t * 2.3) * 0.05;
      a.begin(S(t * 1.7) * u * 0.03, 0, s * pop(t, 0.02, 0.3), sway, 1, 1);
      glyph(g, k, { color: K.green, ...o });
      glyphInk(g, k, o, K.yellow, 6.5, [0.1, 17]);
      const hd = pointAt(g, grow);
      if (grow > 0.02) snakeHead(gx(g, k, hd[0]), gy(k, hd[1]), hd[2], k, t, a.ak);
      a.end();
    },
  },

  /* O: an octopus swims up, pulses about, squirts ink and waves eight arms */
  O: {
    color: K.pink, bg: K.teal, dur: 2.9,
    back(a, t) {
      const { u, k, w, h } = a;
      rays(0, -h * 0.8, 16, h * 2.4, S(t * 0.5) * 0.08, K.tealM, 0.32);
      for (let i = 0; i < 7; i++) {                                 // seaweed swaying along the bottom
        const x = (-0.48 + i * 0.16) * w, gr = pop(t, 0.05 + i * 0.05, 0.4), pts = [];
        for (let j = 0; j <= 7; j++) { const f = j / 7; pts.push(x + S(f * 3.2 - t * 2.4 + i) * 16 * k * f, h * 0.55 - f * h * (0.24 + 0.08 * a.r(i)) * gr); }
        pline(pts, 12 * k, i & 1 ? K.limeD : K.green);
      }
      for (let i = 0; i < 3; i++) star((-0.3 + i * 0.3) * w, h * 0.46, u * 0.11 * pop(t, 0.3 + i * 0.1, 0.4), 5, u * 0.05, i + t * 0.2, K.orange);
      for (let i = 0; i < a.n(12); i++) {                           // bubbles rising
        const r = u * (0.02 + a.r(i, 3) * 0.035), y = h * 0.5 - ((t * u * (0.3 + a.r(i, 2) * 0.3) + a.r(i, 4) * h) % (h * 1.05)), x = (a.r(i, 1) - 0.5) * w * 0.95 + S(t * 3 + i) * 12;
        ring(x, y, r, 3.5, K.white);
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 0.8;
      const ink = seg(t, 1.3, 2.0);                                 // an inky cloud
      for (let i = 0; i < 5 && ink > 0; i++) {
        const tb = 1.3 + i * 0.08, p = seg(t, tb, tb + 0.55), q = 1 - seg(t, 2.1, 2.5);
        blob((a.r(i, 1) - 0.5) * u * 1.4, u * 0.1 + (a.r(i, 2) - 0.4) * u * 0.7, u * (0.28 + 0.2 * a.r(i, 3)) * E.out(p) * q * a.x(0.3), i, 0.14, t, K.indigoD);
      }
      spray(a, t, { x: 0, y: 0, n: a.n(26), t0: 1.9, life: 1.1, v0: u * 0.7, v1: u * 1.7, seed: 71, cols: [K.pink, K.white, K.sky, K.yellow] });
      const rise = E.out(seg(t, 0, 0.55)), pulse = 0.5 + 0.5 * S(t * 6.5), yy = lerp(h * 0.5, -0.02 * h, rise) - Math.abs(S(t * 3.2)) * u * 0.04 * seg(t, 0.5, 0.7);
      a.begin(S(t * 1.6) * u * 0.05 * seg(t, 0.4, 0.7), yy, s * pop(t, 0.02, 0.3), S(t * 2.1) * 0.05, 1 + 0.05 * (1 - pulse), 1 - 0.06 * (1 - pulse));
      const N = 8, ol = 3.2 * k;                                    // the arms: each a wavy chain of segments, thick to thin
      for (let i = 0; i < N; i++) {
        const th = (22 + i * 136 / (N - 1)) * PI / 180, bx = gx(g, k, 39 + 30.5 * C(th)), by = gy(k, 50 + 41.5 * S(th)), dx = C(th) * 0.75, dy = 1, dl = Math.hypot(dx, dy);
        const len = (64 + 26 * a.r(i, 7)) * k * (1 + 0.12 * S(t * 6.5 + i)) * a.ak, pts = [];
        for (let j = 0; j <= 7; j++) { const f = j / 7, off = S(f * 5.5 - t * 7 + i * 1.1) * 15 * k * f; pts.push(bx + dx / dl * len * f - dy / dl * off, by + dy / dl * len * f + dx / dl * off); }
        for (let pass = 0; pass < 2; pass++) for (let j = 0; j < 7; j++) { const wdt = (13 - 8.5 * (j / 7)) * k; line(pts[2 * j], pts[2 * j + 1], pts[2 * j + 2], pts[2 * j + 3], wdt + (pass ? 0 : ol * 2), pass ? K.pink : K.ink); }
        for (let j = 1; j < 6; j += 2) disc(pts[2 * j], pts[2 * j + 1], 2.6 * k, K.pinkL);
      }
      glyph(g, k, { color: K.pink });
      const blink = (t % 1.2) < 0.1 ? 0.12 : 1;
      eyes(gx(g, k, 39), gy(k, 44), 21 * k, 9.5 * k * a.ak + 0.1, S(t * 2.1), 0.3 * C(t * 1.7), blink);
      arcS(gx(g, k, 39), gy(k, 62), 8 * k * a.ak + 0.1, 0.2 * PI, 0.8 * PI, 3.5 * k, K.ink);
      a.end();
    },
  },

  /* T: walks a tightrope under the big top, wobbles, and holds it */
  T: {
    color: K.yellow, bg: K.red, dur: 2.9,
    back(a, t) {
      const { u, k, w, h } = a, ropeY = h * 0.3, px = w * 0.44, top = ropeY - u * 0.55, nf = a.n(11);
      rays(0, h * 0.1, 22, Math.hypot(a.bw, a.bh) / 2, t * 0.18, K.redL, 0.5);
      for (const sd of [-1, 1]) {                                   // poles, with bunting strung between their tops
        box(sd * px, (ropeY + h / 2) / 2 + 20, 16 * k, h / 2 - ropeY + 40, K.cream, 0, 6 * k); disc(sd * px, ropeY - u * 0.02, 12 * k, K.yellow);
      }
      pline([-px, top, 0, top + u * 0.14, px, top], 4 * k, K.ink);
      for (let i = 0; i < nf; i++) {
        const f = (i + 0.5) / nf, x = lerp(-px, px, f), y = top + u * 0.14 * 4 * f * (1 - f) * 0.5 + 2, sc = pop(t, 0.1 + i * 0.05, 0.3);
        poly([x - 13 * k * sc, y, x + 13 * k * sc, y, x, y + 30 * k * sc], [K.yellow, K.sky, K.white, K.lime, K.pink][i % 5]);
      }
      wave(-px, px, ropeY + 3, 3 * k * (1 - E.io(seg(t, 1.9, 2.3))), 260, t * 12, 7 * k, K.ink);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 0.72, hs = a.hs, ropeY = h * 0.3, foot = 91 * k * s * hs;
      const walk = E.io(seg(t, 0.15, 1.8)), mv = 1 - E.io(seg(t, 1.7, 1.95)), fx = lerp(-w * 0.32, 0, walk), phase = walk * 13;
      const rot = (0.05 * S(t * 5) + 0.42 * wob(t - 1.0, 2.1, 2.3) * a.x(0.5)) * (1 - seg(t, 2.1, 2.4)), intro = pop(t, 0.02, 0.3);
      fall(a, t, { n: a.n(30), t0: 1.9, cols: [K.yellow, K.white, K.sky, K.pinkL, K.lime], seed: 400 });
      a.begin(fx + S(rot) * foot, ropeY - C(rot) * foot, s * intro, rot, 1, 1);
      legs(g, k, { feet: [[26, 92], [38, 92]], phase, stride: 11 * mv, lift: 12 * mv, len: 56, dir: 1, col: K.cream, shoe: K.ink, k: a.ak });
      glyph(g, k, { color: K.yellow });
      a.end();
      for (let i = 0, n = a.n(7); i < n; i++) {
        const tb = 1.9 + i * 0.07, p = seg(t, tb, tb + 0.3);
        if (p > 0 && p < 1) spark((a.r(i, 1) - 0.5) * w * 0.8, -h * (0.05 + a.r(i, 2) * 0.35), u * 0.16 * S(p * PI), a.r(i, 3), K.white);
      }
    },
  },

  /* K: a karate kick that splits a board */
  K: {
    color: K.white, bg: K.yellow, dur: 2.8,
    back(a, t) { disc(0, -a.h * 0.03, a.u * 0.78 * pop(t, 0.02, 0.5) * a.x(0.15), K.red); },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 0.85, hs = a.hs, unit = k * s * hs;
      const wind = E.io(seg(t, 0.35, 0.85)), kick = E.out(seg(t, 0.88, 1.02)), back = E.io(seg(t, 1.35, 1.8));
      let th = 0.32 * wind; th = lerp(th, -1.35, kick); th = lerp(th, 0, back);
      const jump = -u * 0.1 * S(PI * seg(t, 0.95, 1.7)), lean = -0.12 * kick * (1 - back), y0 = u * 0.02, x0 = -u * 0.12;
      const bx = x0 + 78 * unit, by = y0 - 26 * unit, brk = seg(t, 0.97, 1.6);                       // the board it hits
      if (brk <= 0) boxO(bx, by, 16 * unit, 100 * unit, K.cream, 0, 3 * unit, 3 * k);
      else {
        for (const sd of [-1, 1]) {
          const p = E.out(brk), fy = brk * brk;
          boxO(bx + p * 90 * unit, by + sd * 25 * unit + sd * p * 40 * unit + fy * 220 * unit * (sd > 0 ? 1 : 0.6) - (sd < 0 ? p * 80 * unit : 0), 16 * unit, 50 * unit, K.cream, sd * p * 1.6, 3 * unit, 3 * k);
        }
      }
      for (let i = 0; i < 7; i++) {                                 // cherry blossom
        const y = -h / 2 - 20 + (((t * (60 + a.r(i, 2) * 70) * k * 1.6 + a.r(i, 3) * h) % (h + 40))), x = (a.r(i, 1) - 0.5) * w + S(t * 2 + i) * 20;
        oval(x, y, 9 * k, 5 * k, K.pinkL, t * 2 + i);
      }
      spray(a, t, { x: bx, y: by, n: a.n(20), t0: 0.98, life: 1.0, v0: u * 0.8, v1: u * 1.9, seed: 81, cols: [K.cream, K.orange, K.white, K.red] });
      spray(a, t, { x: 0, y: 0, n: a.n(26), t0: 1.9, life: 1.1, v0: u * 0.8, v1: u * 1.9, seed: 91, cols: [K.red, K.white, K.orange, K.pink] });
      a.begin(x0, y0 + jump, s * pop(t, 0.02, 0.3), lean, 1, 1);
      glyph(g, k, { color: K.white, parts: [null, null, { r: th, px: 27, py: 39 }] });
      box(gx(g, k, 8.5), gy(k, 56), 27 * k, 9 * k, K.ink, 0, 2 * k); disc(gx(g, k, 8.5), gy(k, 56), 6.5 * k, K.red);
      box(gx(g, k, 13), gy(k, 68), 6 * k, 20 * k, K.ink, 0.25, 2 * k); box(gx(g, k, 5), gy(k, 67), 6 * k, 18 * k, K.ink, -0.3, 2 * k);
      a.end();
      const imp = seg(t, 0.97, 1.3);                                // the impact, over everything
      if (imp > 0 && imp < 1) {
        const r = u * 0.34 * E.outBack(sat(imp * 2.2)) * (1 - imp * 0.4);
        star(bx, by, r, 12, r * 0.5, 0.3, K.white); star(bx, by, r * 0.72, 12, r * 0.36, 0.3, K.orange);
        for (let i = 0; i < 9; i++) { const an = i / 9 * TAU + 0.2; line(bx + C(an) * r * 1.15, by + S(an) * r * 1.15, bx + C(an) * r * (1.5 + imp * 0.9), by + S(an) * r * (1.5 + imp * 0.9), 6 * k * (1 - imp), K.ink); }
      }
    },
  },
};

// a bee's wing: a long oval, hinged at one end
function wing(x, y, len, wid, ang) { ovalO(x + C(ang) * len, y + S(ang) * len, len, Math.max(1, wid), K.white, ang, 3); }

// the snake's head, drawn on the end of its body
function snakeHead(hx, hy, ang, k, t, ak) {
  const cs = C(ang), sn = S(ang), hl = 17 * k * ak;
  const P = (px, py) => [hx + px * cs - py * sn, hy + px * sn + py * cs];
  ovalO(...P(hl * 0.55, 0), hl * 1.25, hl * 0.95, K.green, ang, 3 * k);
  if (S(t * 14) > 0) {
    const [x1, y1] = P(hl * 1.7, 0), [x2, y2] = P(hl * 1.7 + 20 * k, 0);
    line(x1, y1, x2, y2, 3 * k, K.red); line(x2, y2, ...P(hl * 1.7 + 30 * k, -8 * k), 3 * k, K.red); line(x2, y2, ...P(hl * 1.7 + 30 * k, 8 * k), 3 * k, K.red);
  }
  for (const sd of [-1, 1]) { const [ex, ey] = P(hl * 0.65, sd * hl * 0.5); disc(ex, ey, hl * 0.42, K.white); disc(...P(hl * 0.78, sd * hl * 0.5), hl * 0.2, K.ink); }
}
