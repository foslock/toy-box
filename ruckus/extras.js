// The scenes that aren't a letter, digit or mark: the fallback for anything else you type (accents, emoji, other
// alphabets), and the short ones for the space bar and Enter, which don't have a letter to land.
import { K, E, S, C, TAU, PI, sat, seg, lerp, pop, unpop, wob, rays, disc, oval, box, poly, line, spark, star, arcS, alpha, glyph, spray, raw } from './kit.js';

/* Anything without a scene of its own: the character itself, spinning and hopping in a kaleidoscope. */
export const FALLBACK = {
  color: K.yellow, bg: K.magenta, dur: 2.5,
  draw(a, t) {
    const { u, k, g, w, h } = a, R = Math.hypot(w, h) / 2, X = a.X;
    rays(0, 0, 18, R * 1.1, t * 0.55, K.magentaM, 0.5);
    for (let r = 0; r < 3; r++) {                                   // rings of shapes turning against each other
      const n = 8 + r * 4, rad = u * (0.5 + r * 0.3) * pop(t, 0.04 + r * 0.08, 0.45), dir = r & 1 ? -1 : 1, cols = [[K.yellow, K.sky], [K.white, K.lime], [K.orange, K.white]][r];
      for (let i = 0; i < n; i++) {
        const an = i / n * TAU + t * (0.8 + r * 0.25) * dir, x = C(an) * rad, y = S(an) * rad * 0.8, sz = u * (0.075 - r * 0.012) * (1 + 0.25 * S(t * 6 + i));
        if (i & 1) disc(x, y, sz * 0.8, cols[0]); else star(x, y, sz * 1.3, 5, sz * 0.55, an * 2, cols[1]);
      }
    }
    const p = pop(t, 0.03, 0.4), hop = Math.abs(S(t * 5.2)) * u * 0.07 * X;
    a.begin(0, -hop, p * (1 + 0.05 * S(t * 11)), S(t * 3.4) * 0.16 * (1 + (X - 1) * 0.4), 1 + 0.06 * S(t * 10.4), 1 - 0.06 * S(t * 10.4));
    glyph(g, k, { color: K.yellow });
    a.end();
    spray(a, t, { x: 0, y: 0, n: a.n(26), t0: 0.12, life: 1.2, v0: u * 0.9, v1: u * 2.1, g: 1200, seed: 40 });
    spray(a, t, { x: 0, y: 0, n: a.n(22), t0: 1.0, life: 1.2, v0: u * 0.9, v1: u * 2.1, g: 1200, seed: 90 });
  },
};

/* The space bar: a little rocket zooms across, leaving stars. It has no letter, so it doesn't collapse when it ends. */
function rocket(x, y, s, ang, t) {
  const fl = 0.75 + 0.25 * S(t * 60);
  const cs = C(ang), sn = S(ang), P = (px, py) => [x + px * cs - py * sn, y + px * sn + py * cs];
  poly([...P(-s * 1.7, 0), ...P(-s * 3.3 * fl, -s * 0.28), ...P(-s * 2.6, 0), ...P(-s * 3.3 * fl, s * 0.28)], K.yellow);
  poly([...P(-s * 1.7, -s * 0.16), ...P(-s * 2.4 * fl, 0), ...P(-s * 1.7, s * 0.16)], K.white);
  poly([...P(-s * 0.7, -s * 0.6), ...P(-s * 1.7, -s * 1.35), ...P(-s * 1.5, -s * 0.5)], K.red);
  poly([...P(-s * 0.7, s * 0.6), ...P(-s * 1.7, s * 1.35), ...P(-s * 1.5, s * 0.5)], K.red);
  const [bx, by] = P(0, 0);
  oval(bx, by, s * 1.8, s * 0.7, K.white, ang);
  const [nx, ny] = P(s * 1.3, 0);
  oval(nx, ny, s * 0.75, s * 0.7, K.red, ang);
  const [wx, wy] = P(s * 0.15, 0);
  disc(wx, wy, s * 0.36, K.ink); disc(wx, wy, s * 0.26, K.sky);
}
export const LIGHT = {
  space: {
    light: true, color: K.white, bg: K.indigo, dur: 1.15,
    draw(a, t) {
      const { w, h, u } = a, s = u * 0.11, ang = -0.32, sx = -w * 0.62, sy = h * 0.2, ex = w * 0.62, ey = -h * 0.3;
      const f = E.io(seg(t, 0.02, 0.95)), px = lerp(sx, ex, f), py = lerp(sy, ey, f);
      for (let i = 1; i < 16; i++) {                                // stars left in its wake, each twinkling out
        const tf = f - i * 0.03;
        if (tf < 0) break;
        const q = E.io(sat(tf)), x = lerp(sx, ex, q), y = lerp(sy, ey, q) + S(i * 2.3) * s * 0.9, life = 1 - i / 16;
        spark(x, y, s * 0.55 * life * (1 + 0.5 * S(t * 20 + i)), t * 3 + i, i & 1 ? K.yellow : K.white);
      }
      line(px - s * 4, py + s * 1.1 + 12, px - s * 9, py + s * 2.5 + 30, 6, K.white); line(px - s * 3, py - s * 1.6, px - s * 8, py - s * 0.6, 4, K.skyL);
      rocket(px, py, s, ang, t);
      if (t > 0.98) alpha(1);
    },
  },
  nl: {
    light: true, color: K.white, bg: K.orange, dur: 1.2,
    draw(a, t) {                                                    // the carriage returns: three bars sweep back across, and a bell dings
      const { w, h, u } = a, L = w * 0.85, bh = h * 0.12;
      [K.yellow, K.pink, K.sky].forEach((col, i) => {
        const p = E.io(seg(t, 0.02 + i * 0.08, 0.62 + i * 0.08));
        box(lerp(w * 0.5 + L / 2 + 40, -w * 0.5 - L / 2 - 40, p), (i - 1) * bh * 1.2 + h * 0.05, L, bh, col, 0, bh / 2);
      });
      const s = u * 0.17, bp = pop(t, 0.4, 0.3) * unpop(t, 0.95, 0.22), sw = wob(t - 0.45, 3.4, 3.5) * 0.7;
      if (bp > 0.02) {
        bell(0, -h * 0.02, s * bp, sw);
        for (let i = 0; i < 2; i++) {
          const p2 = seg(t, 0.5 + i * 0.13, 1.0), r = s * (1.9 + p2 * 1.9);
          if (p2 > 0 && p2 < 1) { arcS(0, -h * 0.02, r, -PI * 0.86, -PI * 0.62, 7 * (1 - p2), K.white); arcS(0, -h * 0.02, r, -PI * 0.38, -PI * 0.14, 7 * (1 - p2), K.white); }
        }
      }
    },
  },
};
// a bell hung from its top, swinging
function bell(x, y, s, swing) {
  const c = raw();
  c.save(); c.translate(x, y - s * 0.4); c.rotate(swing); c.translate(0, s * 0.4);
  c.fillStyle = K.yellow; c.beginPath();
  c.moveTo(-s * 1.3, s * 0.8); c.quadraticCurveTo(-s * 0.95, s * 0.15, -s * 0.9, -s * 0.3); c.arc(0, -s * 0.3, s * 0.9, PI, 0); c.quadraticCurveTo(s * 0.95, s * 0.15, s * 1.3, s * 0.8); c.closePath(); c.fill();
  oval(0, s * 0.82, s * 1.3, s * 0.2, K.orangeD); disc(0, s * 1.05, s * 0.26, K.ink); disc(0, -s * 1.28, s * 0.2, K.ink);
  c.restore();
}
