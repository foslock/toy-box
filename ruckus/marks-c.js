// Marks, part C: $ % ^ & * + = < > ~ ` |. Same contract as letters.js: each entry is { color, bg, dur, back, draw }, pure functions of t.
import {
  K, E, S, C, TAU, PI, sat, seg, lerp, pop, wob, hop, mixHex, rays, disc, discO, oval, ovalO, box, boxO, line, poly, pline, tri, star, spark, heart, pie, arcS, band, spiral, cloud, balloon, bird, eyes,
  bits, addDisc, addBox, addTri, spray, fall, pulse, glyph, glyphInk, gx, gy, raw, P, hash,
} from './kit.js';

const smooth = p => p * p * (3 - 2 * p);
// a spin in radians that lands upright even if the scene is cut short: whole turns stay, the part-turn left over eases away as the hero lands (ak goes 1 to 0)
const settle = (th, ak) => { const w = ((th + PI) % TAU + TAU) % TAU - PI; return th - w + w * ak; };

// What each scene draws with, in the order of the scenes. Shared scratch values (TIP, JT, LEND, PTS) only carry a helper's result to its caller within one frame.
const BILL = [K.limeL, K.cream, K.limeM];                                                    // $: the colours of the banknotes
const PIE_COLS = [K.yellow, K.lime, K.sky, K.purple, K.orange, K.teal];                      // %: the wedges
const PIE_N = [0.819, 0.573];                                                                // %: the normal of the slash, which way the two halves part
const RANGES = [[K.pink, 0.1, 0.3, 1.1, 0.03, 0.02], [K.purple, 0.2, 0.24, 0.85, -0.06, 0.12], [K.violet, 0.29, 0.2, 0.6, 0.1, 0.22], [K.indigo, 0.36, 0.06, 1.6, 0, 0.32]];    // ^: colour, valley height, peak height, wavelength, drift, start
const HEARTS = [K.red, K.pink, K.white, K.pinkL];                                            // &
const PAL = [K.pink, K.orange, K.lime, K.teal, K.sky, K.purple];                             // *: neighbours blend into pleasant in-betweens
const KCOL = [0, 2, 3, 5];                                                                   // where each of its four colours starts in PAL
const KBAND = [K.indigoD, K.indigo, K.violetD];                                              // the bands the rings sit on
const KAL = [[0, 1, 0, 0.12, 0], [1, 0.5, 3, 0.05, 2], [1, 1.5, 3, 0.05, 2], [2, 1, 2, 0.1, 3], [2, 0, 1, 0.07, 1], [3, 0.5, 0, 0.12, 1], [3, 1.5, 0, 0.12, 1], [4, 1, 1, 0.13, 0], [4, 2, 3, 0.07, 2], [5, 0.5, 2, 0.11, 2], [5, 1.5, 2, 0.11, 2],
  [6, 1, 0, 0.19, 3], [6, 0, 3, 0.09, 0], [6, 2, 3, 0.09, 0], [7, 0.5, 1, 0.11, 1], [7, 1.5, 1, 0.11, 1], [8, 1, 2, 0.18, 0], [8, 0, 3, 0.1, 3], [8, 2, 3, 0.1, 3], [9, 0.5, 0, 0.17, 2], [9, 1.5, 0, 0.17, 2]];   // ring, turn from the middle of its 60 degree wedge (in 15 degree steps, mirrored in the next wedge), shape (petal, triangle, diamond, dot), size, colour slot
const PINCOL = [[K.yellow, K.sky, K.orange, K.purple], [K.pinkL, K.teal, K.yellow, K.white], [K.orange, K.white, K.purple, K.sky], [K.sky, K.yellow, K.pinkL, K.teal]];    // +: the four sails of a pinwheel
const PIN = [[-0.38, -0.3, 0.2, 1, 1, 0.15], [0.38, -0.28, 0.16, -1, 2, 0.28], [-0.42, 0.14, 0.14, -1, 3, 0.4], [0.42, 0.16, 0.21, 1, 0, 0.52], [-0.2, 0.34, 0.11, 1, 2, 0.64], [0.22, -0.4, 0.1, -1, 3, 0.76], [0.06, 0.38, 0.13, -1, 1, 0.88]];     // the little ones: x and y in stage fractions, size in u, turn direction, colours, pop time
const BUNTING = [K.red, K.yellow, K.white, K.pink, K.lime, K.orange];                        // =
const WAGON = [K.yellow, K.purple, K.lime];
const RIBS = [[K.pink, K.pinkL, -0.32, 0.16, 1.6, 2.2, 0, 0.05, 0.12], [K.yellow, K.yellowL, -0.14, 0.2, 1.3, -2.6, 1.3, 0.15, 0.11], [K.lime, K.limeL, 0.04, 0.18, 1.9, 2.0, 2.4, 0.25, 0.12],
  [K.orange, K.yellowL, 0.2, 0.17, 1.5, -2.4, 3.6, 0.35, 0.11], [K.teal, K.skyL, 0.34, 0.14, 1.8, 2.8, 4.7, 0.45, 0.1], [K.red, K.pinkL, -0.02, 0.15, 1.1, -3.0, 5.9, 0.55, 0.09]];   // ~: colour, centre colour, height, swing (u), wavelength (u), speed, phase, start, width (u)
const RIB_L = [K.orange, K.yellow, K.white], RIB_R = [K.teal, K.lime, K.white];              // the stripes of the two ribbons the dancer trails, outermost first
const TOES = [[-0.62, -0.3, -0.5], [-0.22, -0.66, -0.15], [0.22, -0.66, 0.15], [0.62, -0.3, 0.5]];    // `: the toes of the paw print (x, y, tilt)
const JOLTS = [0.2, 0.62, 1.04, 1.6];                                                        // when the picture is jolted: three claws land and the paw stamps
const BROWS = [[-0.38, 0.42], [-0.25, 0.3], [0, 0.26], [0.25, 0.32], [0.38, 0.44]];               // < >: where the racing rows sit (of the stage height) and how tall their chevrons are (in u)
const DOM = [K.pink, K.yellow, K.sky, K.lime, K.orange, K.purple, K.red];                    // |
const PIP = [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];    // where the dots go for 0 to 6
const TIP = [0, 0], JT = [0, 0], LEND = [0, 0], PTS = [];

export const SCENES = {
  /* $: a coin toss in a rain of banknotes: the $ flips like a coin, lands, and the till goes cha-ching */
  $: {
    color: K.yellow, bg: K.green, dur: 2.9,
    back(a, t) {
      const { u, h } = a, R = Math.hypot(a.bw, a.bh) / 2, per = u * 0.52, sh = (t * u * 0.15) % per, c = raw();
      c.save(); c.rotate(-0.42);                                    // green and gold stripes sliding by
      for (let i = -Math.ceil(R / per); i <= Math.ceil(R / per); i++) {
        const x = i * per + sh;
        box(x, 0, per * 0.4, R * 2, K.greenD); box(x - per * 0.26, 0, per * 0.045, R * 2, K.yellow); box(x + per * 0.26, 0, per * 0.045, R * 2, K.yellow);
      }
      c.restore();
      const fy = h * 0.37, r = u * 0.062, nc = Math.ceil(a.bw / (r * 1.5));   // the floor is a heap of gold coins
      box(0, fy + h * 0.3, a.bw, h * 0.6, K.greenD);
      for (let row = 0; row < 2; row++) {
        bits([K.yellow, K.orange], nc, i => {
          const x = (i - nc / 2 + row * 0.5) * r * 1.5, q = pop(t, 0.1 + i * 0.012 + row * 0.15, 0.3);
          addDisc(x, fy - r * 0.2 + row * r * 0.75, r * q);
        });
      }
    },
    draw(a, t) {
      const { u, k, g, h } = a, s = 0.8, fy = h * 0.37 - u * 0.09, rest = h * 0.06, TL = 1.6;
      const toss = seg(t, 0.06, TL), flip = C(smooth(toss) * TAU * 2);       // up, two turns, and down again
      const land = t - TL, sq = land > 0 ? Math.exp(-7 * land) * C(TAU * 3.2 * land) : 0;
      const y0 = rest - 4 * toss * (1 - toss) * u * 0.42, R = 61 * k * a.ak;
      bills(a, t, 0, 14);
      bounceCoins(a, t, fy);
      if (land > 0 && land < 0.8) {                                 // cha-ching: a starburst and rings round the coin
        const r = u * 1.0 * E.outBack(sat(land / 0.22)) * (1 - E.in(seg(land, 0.5, 0.8)));
        star(0, rest, r, 16, r * 0.66, land * 0.9, K.yellowL); star(0, rest, r * 0.78, 16, r * 0.5, -land * 0.9, K.orange);
        pulse(0, rest, t, TL, 0.5, u * 1.05, u * 0.05, K.white); pulse(0, rest, t, TL + 0.08, 0.5, u * 1.3, u * 0.03, K.yellow);
      }
      a.begin(0, y0 + 0.24 * sq * R * s, s * pop(t, 0.02, 0.3), 0, flip * (1 + 0.16 * sq), 1 - 0.24 * sq);
      box(0, 0, 0.15 * R / Math.max(Math.abs(flip), 0.06), R * 1.96, K.orange, 0, 0.07 * R);   // the edge shows when it is turned side-on
      discO(0, 0, R, K.orange, 3.4 * k);
      disc(0, 0, R * 0.86, K.yellowL);
      bits([K.orange], 22, i => addBox(C(i / 22 * TAU) * R * 0.93, S(i / 22 * TAU) * R * 0.93, R * 0.1, R * 0.05, i / 22 * TAU + PI / 2));
      glyph(g, k, { color: K.yellow });
      a.end();
      for (let i = 0; i < 9; i++) {                                 // sparkles twinkling round the coin
        const p = (t * 1.05 + a.r(i, 1)) % 1, an = a.r(i, 2) * TAU, rr = u * (0.5 + 0.3 * a.r(i, 3)) * (1 + 0.1 * S(t * 3 + i)), sz = u * 0.1 * S(p * PI) * pop(t, 0.2, 0.3);
        if (sz > 1) { spark(C(an) * rr * 1.15, y0 + S(an) * rr * 0.95, sz, an, K.white); disc(C(an) * rr * 1.15, y0 + S(an) * rr * 0.95, sz * 0.16, K.yellow); }
      }
      spray(a, t, { x: 0, y: rest, n: a.n(26), t0: TL, life: 1.3, v0: u * 1.0, v1: u * 2.3, a0: -PI * 0.92, a1: -PI * 0.08, g: 1500, shape: 'dot', s0: 8, s1: 17, seed: 31, cols: [K.yellow, K.orange, K.white, K.limeL] });
      spray(a, t, { x: 0, y: rest, n: a.n(10), t0: TL, life: 1.2, v0: u * 0.8, v1: u * 1.8, g: 1200, shape: 'star', s0: 12, s1: 22, seed: 37, cols: [K.white, K.yellow] });
      bills(a, t, 14, 19);
    },
  },

  /* %: two pies are built from wedges that fly in and bounce into place, then the slash of the % cuts them apart and they burst */
  '%': {
    color: K.white, bg: K.pink, dur: 2.9,
    back(a, t) {
      const { u } = a, sq = u * 0.34, nx = Math.ceil(a.bw / 2 / sq) + 2, ny = Math.ceil(a.bh / 2 / sq) + 2, off = (t * u * 0.06) % (sq * 2), c = raw();
      c.fillStyle = K.pinkM; c.beginPath();                         // a gingham tablecloth drifting by
      for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) if ((i + j) & 1) c.rect(i * sq + off, j * sq + off, sq, sq);
      c.fill();
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 1.25, y0 = -h * 0.03, R = Math.hypot(w, h) / 2, cut = 1.5, boom = cut + 0.22;
      const D = 15 * E.outBack(seg(t, cut, cut + 0.18)) * (1 - E.out(seg(t, boom, boom + 0.5))) * a.ak;     // the two halves are shoved apart, in glyph units
      const kn = seg(t, cut - 0.6, cut - 0.25), zip = E.in(seg(t, cut - 0.25, cut + 0.15));
      const L = lerp(lerp(-1.5 * R, -0.5 * R, E.outBack(kn)), 1.5 * R, zip);                         // the knife's place along the slash
      a.begin(0, y0, s * pop(t, 0.02, 0.3), 0, 1 + 0.06 * wob(t - boom, 3.5, 5), 1 - 0.06 * wob(t - boom, 3.5, 5));
      glyph(g, k, { color: K.white, parts: [{ px: 0, py: 0, dx: -PIE_N[0] * D, dy: -PIE_N[1] * D }, { px: 0, py: 0, dx: PIE_N[0] * D, dy: PIE_N[1] * D }, null] });
      a.end();
      for (let side = 0; side < 2; side++) {                        // the two pies: the halves of the % are their plates
        const sd = side ? 1 : -1, cx = gx(g, k, side ? 68 : 22) * s + sd * PIE_N[0] * D * k * s, cy = y0 + gy(k, side ? 76 : 24) * s + sd * PIE_N[1] * D * k * s;
        for (let j = 0; j < 6; j++) {
          const m = j * 2 + side, t0 = 0.1 + m * 0.07, land = t0 + 0.42, an = j * TAU / 6 - PI / 2, am = an + PI / 6;
          if (t < t0) continue;
          let x = cx, y = cy, rot = 0, rf = E.outBack(seg(t, t0, t0 + 0.15));
          if (t < boom) {
            const p = E.out(seg(t, t0, land)), fa = a.r(m, 1) * TAU, fd = R * 1.15, spin = (a.r(m, 2) < 0.5 ? -1 : 1) * (2.5 + 3 * a.r(m, 3));
            x = cx + C(fa) * fd * (1 - p); y = cy + S(fa) * fd * (1 - p); rot = spin * (1 - p);
            if (t > land) rf *= 1 + 0.2 * wob(t - land, 3.4, 5.5);
          } else {                                                  // burst: every wedge flies off its own way
            const age = t - boom, v = u * (1.1 + 0.9 * a.r(m, 4)), dist = (1 - Math.exp(-1.5 * age)) / 1.5;
            x = cx + C(am) * v * dist; y = cy + S(am) * v * dist + 0.5 * u * 3.2 * age * age; rot = age * (a.r(m, 2) - 0.5) * 12;
            rf *= 1 - seg(age, 0.4, 0.68);
          }
          wedge(x, y, 31 * k * s * rf, an + rot, an + PI / 3 + rot, PIE_COLS[(j + side * 3) % 6], 3 * k);
        }
      }
      spray(a, t, { x: gx(g, k, 22) * s, y: y0 + gy(k, 24) * s, n: a.n(20), t0: boom, life: 1.1, v0: u * 0.7, v1: u * 1.7, seed: 5, cols: PIE_COLS });
      spray(a, t, { x: gx(g, k, 68) * s, y: y0 + gy(k, 76) * s, n: a.n(20), t0: boom, life: 1.1, v0: u * 0.7, v1: u * 1.7, seed: 55, cols: PIE_COLS });
      for (let i = 0; i < 8; i++) {                                 // sparkles when the pies are done
        const p = seg(t, 1.1 + i * 0.05, 1.45 + i * 0.05), an = i / 8 * TAU + 0.4, rr = u * (0.55 + 0.25 * a.r(i, 1));
        if (p > 0 && p < 1) spark(C(an) * rr * 1.2, y0 + S(an) * rr * 1.1, u * 0.1 * S(p * PI), an, K.white);
      }
      const cutStar = seg(t, cut, cut + 0.32);                      // where the blade goes through
      if (cutStar > 0 && cutStar < 1) { const r = u * 0.4 * E.outBack(sat(cutStar * 2.2)) * (1 - cutStar * 0.6); star(0, y0, r * 1.1, 12, r * 0.5, 0.2, K.ink); star(0, y0, r, 12, r * 0.5, 0.2, K.white); }
      if (t > cut - 0.6 && t < cut + 0.5) {
        const cs = C(2.18), sn = S(2.18), kx = cs * L, ky = y0 + sn * L, wide = u * 0.1 * (1 - seg(t, cut + 0.05, cut + 0.4));
        if (wide > 1 && L > -R) poly([cs * -R * 1.2, y0 - sn * R * 1.2, -sn * wide, y0 + cs * wide, cs * R * 1.2, y0 + sn * R * 1.2, sn * wide, y0 - cs * wide], K.white);   // the streak it leaves
        knife(kx, ky, 2.18, u * 0.95, 3 * k);
      }
    },
  },

  /* ^: the caret is a mountain peak that pogos up a sunrise: ranges bounce up behind it, a flag goes in at the top, birds fly by */
  '^': {
    color: K.teal, bg: K.orange, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a, x0 = -a.bw / 2, x1 = a.bw / 2, rise = E.out(seg(t, 0.1, 1.5)), sunX = w * 0.03, sunY = lerp(h * 0.62, -h * 0.13, rise);
      rays(sunX, sunY, 16, Math.hypot(a.bw, a.bh), t * 0.25, K.orangeM, 0.5);
      disc(sunX, sunY, u * 0.56, K.orangeM); disc(sunX, sunY, u * 0.42, K.yellow);
      for (let i = 0; i < 3; i++) cloud(((-0.4 + i * 0.4) * w - t * u * (0.05 + 0.03 * i) + w * 1.5) % (w * 1.3) - w * 0.65, -h * (0.34 - i * 0.07), u * (0.15 + 0.03 * i) * pop(t, 0.3 + i * 0.15, 0.4), K.white);
      RANGES.forEach(([col, base, amp, len, vel, t0], i) => {         // each range bounces up on its own beat and drifts at its own speed
        const lift = (1 - E.outBack(seg(t, t0, t0 + 0.7))) * h * 0.75;
        peaks(x0, x1, h * base + lift, h * amp, u * len, -t * u * vel + i * 3.1, col, a.bh);
      });
      for (let i = 0; i < 6; i++) {                                 // pines popping up on the front hill
        const x = (i < 3 ? -1 : 1) * w * (0.2 + 0.09 * (i % 3) + 0.05 * a.r(i, 1)), sc = pop(t, 0.5 + i * 0.09, 0.4) * u * (0.1 + 0.05 * a.r(i, 2)), y = h * 0.4;
        for (let j = 0; j < 3; j++) tri(x, y - sc * (0.9 + j * 0.85), sc * (1.5 - j * 0.3), -PI / 2, i & 1 ? K.green : K.lime);
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 1.25, gy0 = h * 0.32, y0 = gy0 - 18.5 * k * s, T = 0.55, t0 = 0.3, end = t0 + 3 * T;
      const n = t < t0 ? 0 : Math.min(3, Math.floor((t - t0) / T)), p = t < t0 || t >= end ? 0 : (t - t0) / T - n, air = 4 * p * (1 - p) * 0.78 ** n, after = t - end;
      const sq = (t < t0 ? E.io(seg(t, t0 - 0.15, t0)) : t >= end ? 0 : Math.max(0, 1 - Math.min(p, 1 - p) / 0.17)) + (after > 0 ? Math.exp(-6 * after) * C(TAU * 3.2 * after) : 0);     // it crouches, is squashed at each landing, and rings like a spring at the end
      const sy = 1 + (t < end ? 0.14 * S(p * PI) : 0) - 0.3 * sq, sx = 1 / Math.sqrt(sy);
      oval(0, gy0 + 3 * k, u * 0.3 * (1 - 0.4 * air), u * 0.035, K.indigoD);                  // its shadow on the hill
      for (let i = 0; i < 5; i++) {                                 // birds crossing the sun
        const tb = 0.4 + i * 0.14, x = lerp(w * 0.6, -w * 0.6, (t - tb) * 0.4), y = -h * (0.3 - 0.03 * (i & 1) - 0.02 * i) + S(t * 3 + i) * u * 0.03;
        if (t > tb && x > -w * 0.6) bird(x, y, u * 0.09, S(t * 13 + i * 2), K.ink);
      }
      a.begin(0, y0 - air * u * 0.1 + (1 - sy) * 18.5 * k * s, s * pop(t, 0.02, 0.3), 0, sx, sy);
      const m = a.ak, ax = gx(g, k, 32), ay = gy(k, 12), sc = (x, y) => [ax + (x - ax) * m, ay + (y - ay) * m];       // (things on the peak shrink toward its tip as it lands)
      poly([...sc(gx(g, k, 8.5), gy(k, 60)), ax, ay, ...sc(gx(g, k, 55.5), gy(k, 60))], K.tealD);
      glyph(g, k, { color: K.teal });
      if (m > 0.03) glyphInk(g, k, { t0: 0.5 }, K.tealD, 17 * m, null, 'butt');               // the far face of the peak in shade
      polyO([ax, ay + (gy(k, 1.5) - ay) * m, ...sc(gx(g, k, 49.5), gy(k, 30)), ...sc(gx(g, k, 43), gy(k, 25.5)), ...sc(gx(g, k, 38), gy(k, 33)), ax, ay + (gy(k, 26) - ay) * m, ...sc(gx(g, k, 26), gy(k, 33)), ...sc(gx(g, k, 21), gy(k, 25.5)), ...sc(gx(g, k, 14.5), gy(k, 30))], K.white, 3 * k * m);
      const fl = pop(t, 0.9, 0.4) * m, top = gy(k, 4) - 20 * k * fl;     // the flag goes in
      if (m > 0.03) line(ax, gy(k, 4), ax, top, 3.6 * k * m, K.ink);
      PTS.length = 0;                                                    // a swallow-tailed flag, rippling
      for (let i = 0; i < 4; i++) PTS.push(ax + i * 8 * k * fl, top + 2 * k + 2.6 * k * S(t * 11 - i * 1.2) * i / 3);
      PTS.push(ax + 19 * k * fl, top + 10 * k * fl + 2.6 * k * S(t * 11 - 2.9) * 0.8);
      for (let i = 3; i >= 0; i--) PTS.push(ax + i * 8 * k * fl, top + 18 * k * fl + 2.6 * k * S(t * 11 - i * 1.2) * i / 3);
      polyO(PTS, K.red, 2.6 * k * m);
      a.end();
      spray(a, t, { x: 0, y: y0 + gy(k, 4) * s, n: a.n(30), t0: end, life: 1.2, v0: u * 0.8, v1: u * 2, seed: 8, cols: [K.yellow, K.white, K.pink, K.sky, K.lime] });
    },
  },

  /* &: two blobby buddies run in from opposite sides, bonk, bounce, hug and flip; the & draws itself round them and they swap colours */
  '&': {
    color: K.violet, bg: K.yellow, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a;
      rays(0, h * 0.1, 22, Math.hypot(a.bw, a.bh) / 2, t * 0.15, K.yellowM, 0.5);
      for (let i = 0; i < a.n(9); i++) {                            // big hearts drifting up behind
        const sz = u * (0.09 + 0.1 * a.r(i, 1)) * pop(t, 0.05 + i * 0.07, 0.4), y = h * 0.5 - (t * u * (0.16 + 0.12 * a.r(i, 2)) + a.r(i, 3) * h * 1.2) % (h * 1.1) + sz;
        heart((a.r(i, 4) - 0.5) * w * 0.98 + S(t * 1.6 + i) * u * 0.04, y, sz, S(t * 1.3 + i * 2) * 0.25, i & 1 ? K.orange : K.pinkL);
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 1.5, sz = u * 0.2, yb = h * 0.12, fy = yb + 1.3 * sz, y0 = yb - gy(k, 68) * s, hit = 0.95;
      const dh = tt => lerp(0.62 * w, 0.95 * sz, seg(tt, 0.02, hit)) + (tt > hit ? sz * S(PI * seg(tt, hit, 1.3)) - 0.23 * sz * E.io(seg(tt, 1.25, 1.5)) : 0);   // half the gap between them
      const imp = t > hit ? Math.exp(-7 * (t - hit)) * C(TAU * 2.2 * (t - hit)) : 0, imp2 = t > 2.25 ? Math.exp(-7 * (t - 2.25)) * C(TAU * 2.2 * (t - 2.25)) : 0;
      const jump = seg(t, 1.85, 2.25), lift = sz * 0.6 * S(PI * seg(t, hit, 1.3)) + 4 * jump * (1 - jump) * sz * 1.1, running = t < hit, hug = pop(t, 1.3, 0.4);
      const mood = running ? 1 : t < 1.3 ? 2 : t < 1.85 ? 3 : t < 2.3 ? 1 : 3, flip = E.io(jump) * TAU, swapped = t > 2.05;
      const sx = 1 - 0.3 * imp + 0.3 * imp2 - 0.05 * hug * S(t * 13), sy = 1 + 0.3 * imp - 0.3 * imp2, run = t * 24, bob = running ? Math.abs(S(run)) * sz * 0.14 : 0;
      a.begin(-gx(g, k, 34) * s, y0, s * pop(t, 0.02, 0.3), 0, 1, 1);
      glyph(g, k, { color: K.violet, sw: 10 + 7 * (1 - a.ak), t1: lerp(lerp(0.45, 1, E.io(seg(t, 0.5, 1.95))), 1, 1 - a.ak) });
      a.end();
      const st = { run, amt: running ? 1 : 0, mood, hug, up: jump > 0 && jump < 1 ? 1 : 0, t };
      for (let pass = 0; pass < 2; pass++) {                        // the arms first, so a hug goes round the friend's back
        for (let i = 0; i < 2; i++) {
          const dir = i ? -1 : 1, x = -dir * dh(t);
          if (pass) oval(x, fy + 0.05 * sz, sz * 0.85 * (1 - 0.3 * lift / sz), sz * 0.16, K.yellowD);
          buddy(x, fy - lift - bob, sz, dir * (running ? 0.1 : 0) + (i ? -1 : 1) * flip, sx, sy, (i ^ swapped) ? K.blue : K.pink, (i ^ swapped) ? K.skyL : K.pinkL, i ? K.indigo : K.white, i, dir, st, pass);
        }
      }
      const bang = seg(t, hit, hit + 0.3);                          // bonk
      if (bang > 0 && bang < 1) { const r = u * 0.24 * E.outBack(sat(bang * 2)) * (1 - bang * 0.5); star(0, yb, r * 1.14, 9, r * 0.6, 0.3, K.ink); star(0, yb, r, 9, r * 0.55, 0.3, K.white); }
      for (let i = 0; i < 9; i++) {                                 // hearts float up from the hug
        const tb = 1.35 + i * 0.1, age = t - tb, hs = u * (0.07 + 0.04 * a.r(i, 1)) * pop(t, tb, 0.3) * (1 - seg(age, 0.9, 1.3));
        if (age > 0 && hs > 0.5) heart((a.r(i, 2) - 0.5) * u * 0.7 + S(age * 4 + i) * u * 0.04, yb - sz * 1.2 - age * u * (0.4 + 0.2 * a.r(i, 3)), hs, S(age * 3 + i) * 0.3, HEARTS[i & 3]);
      }
      spray(a, t, { x: 0, y: yb, n: a.n(34), t0: 1.95, life: 1.2, v0: u * 0.9, v1: u * 2.1, seed: 12, cols: [K.pink, K.sky, K.violet, K.white, K.orange, K.lime] });
    },
  },

  /* *: the asterisk spins at the heart of a kaleidoscope: rings of petals, triangles and diamonds pop in and turn against each other */
  '*': {
    color: K.yellow, bg: K.indigo, dur: 2.9,
    back(a, t) {
      const { u } = a, cy = -a.h * 0.03, R = Math.hypot(a.bw, a.bh) / 2, c = raw();
      rays(0, cy, 12, R, t * 0.2, K.indigoD, 0.5);
      for (let i = 8; i >= 0; i--) disc(0, cy, u * (0.7 + i * 0.32) * E.outElastic(seg(t, 0.03 + i * 0.07, 0.7 + i * 0.07)), KBAND[i % 3]);   // bands under the pattern
      c.save(); c.lineCap = 'round'; c.strokeStyle = K.white; c.lineWidth = u * 0.014;
      for (let i = 0; i < 3; i++) {                                 // dashed rings turning against each other
        const r = u * (0.56 + 0.62 * i) * E.outElastic(seg(t, 0.05 + i * 0.1, 0.7 + i * 0.1));
        if (r <= 0) continue;
        c.setLineDash([u * 0.045, u * 0.06]); c.lineDashOffset = t * u * (i & 1 ? 0.35 : -0.35);
        c.beginPath(); c.arc(0, cy, r, 0, TAU); c.stroke();
      }
      c.restore();
      for (let cg = 0; cg < 4; cg++) {                              // four colours drifting slowly round the palette, each on its own beat
        const q = (t + cg * 0.4) / 1.6, ci = (KCOL[cg] + Math.floor(q)) % PAL.length;
        c.fillStyle = mixHex(PAL[ci], PAL[(ci + 1) % PAL.length], smooth(seg(q % 1, 0.65, 1))); c.beginPath();
        for (const [ring, ai, kind, size, col] of KAL) {              // each entry is one shape, copied to a mirrored set of places round the wheel
          if (col !== cg) continue;
          const r = u * (0.58 + 0.23 * ring), p = E.outElastic(seg(t, 0.02 + ring * 0.06, 0.6 + ring * 0.06)), sz = u * size * p, spin = t * (ring & 1 ? -1 : 1) * (0.42 - 0.025 * ring);
          for (let m = 0; m < 12; m++) {
            const an = PI / 6 + (m >> 1) * PI / 3 + (m & 1 ? 1 : -1) * ai * PI / 12 + spin, x = C(an) * r * p, y = cy + S(an) * r * p;
            if (kind === 0) addPetal(c, x, y, sz * 1.5, sz * 0.5, an); else if (kind === 1) addTri(x, y, sz, an); else if (kind === 2) addPetal(c, x, y, sz * 1.2, sz * 0.7, an, true); else addDisc(x, y, sz * 0.6);
          }
        }
        c.fill();
      }
    },
    draw(a, t) {
      const { u, k, g, h } = a, s = 1.55, cy = -h * 0.03, cx = gx(g, k, 31), cyy = gy(k, 32), th = settle(3 * TAU * smooth(seg(t, 0.05, 2.0)) + 0.14 * wob(t - 2.0, 3, 5), a.ak);
      spray(a, t, { x: 0, y: cy, n: a.n(30), t0: 2.0, life: 1.2, v0: u * 0.9, v1: u * 2.1, seed: 14, cols: PAL });
      a.begin(-cx * s, cy - cyy * s, s * pop(t, 0.02, 0.3), 0, 1 + 0.04 * S(t * 8), 1 - 0.04 * S(t * 8));
      const c = raw();
      c.translate(cx, cyy); c.rotate(th); c.translate(-cx, -cyy);           // it turns about its own middle, and stops in the same picture it started
      disc(cx, cyy, 36 * k * a.ak, K.indigoD);
      glyph(g, k, { color: K.yellow, sh: 4.6 * k * seg(t, 1.9, 2.1) });
      a.end();
      for (let i = 0; i < 8; i++) {                                 // twinkles
        const p = (t * 0.9 + a.r(i, 1)) % 1, an = a.r(i, 2) * TAU, rr = u * (0.5 + 1.1 * a.r(i, 3)), sz = u * 0.09 * S(p * PI) * pop(t, 0.3, 0.3);
        if (sz > 1) spark(C(an) * rr, cy + S(an) * rr, sz, an, K.white);
      }
    },
  },

  /* +: the plus is a pinwheel spinning up in a gale, with little pinwheels popping in round it, wind streaks, floating crosses and confetti gusts */
  '+': {
    color: K.pink, bg: K.lime, dur: 2.9,
    back(a, t) {
      const { u } = a, c = raw(), sp = u * 0.42, nx = Math.ceil(a.bw / 2 / sp) + 2, ny = Math.ceil(a.bh / sp) + 2, off = (t * u * 0.08) % sp, r = u * 0.07;
      c.fillStyle = K.limeM; c.beginPath();                         // a wallpaper of plus signs drifting by
      for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) {
        const x = i * sp + (j & 1 ? sp / 2 : 0) + off, y = j * sp * 0.5 + off * 0.6;
        c.rect(x - r, y - r * 0.3, r * 2, r * 0.6); c.rect(x - r * 0.3, y - r, r * 0.6, r * 2);
      }
      c.fill();
      const cy = -a.h * 0.03, top = cy + u * 0.3;                   // the stick the big pinwheel turns on
      boxO(0, (top + a.h * 0.5) / 2, u * 0.05, a.h * 0.5 - top, K.cream, 0, u * 0.025, Math.max(3, u * 0.008));
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 1.15, cy = -h * 0.03, th = 4 * TAU * smooth(seg(t, 0.03, 2.0));
      for (let i = 0; i < 9; i++) {                                 // wind streaks blowing across, drawn on at the head and rubbed out at the tail
        const per = 0.9 + 0.5 * a.r(i, 1), p = (((t - 0.1 - i * 0.16) / per) % 1 + 1) % 1, y = (a.r(i, 2) - 0.5) * h * 0.95, x0 = -w * 0.6, x1 = w * 0.6;
        if (t < 0.1 + i * 0.16) continue;
        const xh = lerp(x0, x1, E.out(p)), xt = lerp(x0, x1, E.in(p));
        PTS.length = 0;
        for (let j = 0; j <= 12; j++) { const x = lerp(xt, xh, j / 12); PTS.push(x, y + S(x / (u * 0.5) + i) * u * 0.06 + (j > 9 ? (j - 9) * (j - 9) * u * 0.006 : 0)); }
        pline(PTS, u * 0.034, i & 1 ? K.white : K.limeL);
      }
      PIN.forEach(([fx, fy, fr, dir, cs, t0], i) => {               // little pinwheels on sticks, turning against each other
        const sc = E.outElastic(seg(t, t0, t0 + 0.6)), r = u * fr * sc, x = fx * w, y = fy * h, cols = PINCOL[cs];
        const c = raw(), sw = S(t * 3 + i * 1.7) * 0.12;                      // each sways on its stick in the wind
        c.save(); c.translate(x, y + r * 2.6); c.rotate(sw); c.translate(-x, -y - r * 2.6);
        line(x, y, x, y + r * 2.6, r * 0.2 + 5, K.ink); line(x, y, x, y + r * 2.6, r * 0.2, K.cream);
        pinwheel(x, y, r, dir * (t * (6 + i) + i), cols, Math.max(2, 2.6 * k));
        c.restore();
      });
      bits([K.white, K.yellow, K.pink, K.sky], a.n(14), i => {      // crosses floating up like bubbles
        const y = h * 0.55 - (t * u * (0.35 + 0.3 * a.r(i, 2)) + a.r(i, 3) * h * 1.2) % (h * 1.15), x = (a.r(i, 1) - 0.5) * w + S(t * 2 + i) * u * 0.05, sz = u * (0.035 + 0.05 * a.r(i, 4)) * sat(t * 4 - a.r(i, 5)), rt = t * (a.r(i, 6) - 0.5) * 3;
        addBox(x, y, sz * 2.6, sz * 0.8, rt); addBox(x, y, sz * 0.8, sz * 2.6, rt);
      });
      for (let i = 0; i < 3; i++) spray(a, t, { x: -w * 0.56, y: -h * (0.25 - i * 0.2), n: a.n(30), t0: 0.35 + i * 0.6, life: 1.5, v0: u * 1.4, v1: u * 3, a0: -0.35, a1: 0.35, g: 200, drag: 0.6, s0: 10, s1: 24, seed: 20 + i * 9, cols: PINCOL[i] });
      const fast = S(PI * seg(t, 0.03, 2.0));                       // swirl arcs show how fast it is going
      for (let i = 0; i < 3; i++) arcS(0, cy, u * (0.62 + 0.11 * i) * s, th * 1.3 + i * 2.1, th * 1.3 + i * 2.1 + 1.1, u * 0.03 * fast, K.white);
      a.begin(0, cy, s * pop(t, 0.02, 0.3), 0.1 * wob(t - 2.0, 3, 5), 1, 1);
      raw().rotate(settle(th, a.ak));                               // sails, plus and pin turn together, and stop where they started
      pinwheel(0, 0, 40 * k * a.ak, 0, PINCOL[0], 3.4 * k);
      glyph(g, k, { color: K.pink });
      discO(0, 0, 8 * k * a.ak, K.yellow, 3 * k * a.ak);
      a.end();
    },
  },

  /* =: the equals sign is a pair of rails: sleepers pop in between, then a little train chugs in, stops for a whistle and leaves; the rails stay */
  '=': {
    color: K.white, bg: K.sky, dur: 2.9,
    back(a, t) {
      const { u, k, w, h } = a, s = 1.2, y0 = h * 0.13, x0 = -a.bw / 2, x1 = a.bw / 2, R = Math.hypot(a.bw, a.bh) / 2;
      rays(w * 0.28, -h * 0.2, 14, R, t * 0.12, K.skyM, 0.5);
      disc(w * 0.28, -h * 0.2, u * 0.3 * pop(t, 0.05, 0.5), K.yellow);
      for (let i = 0; i < 3; i++) cloud(((-0.4 + i * 0.4) * w - t * u * (0.06 + 0.03 * i) + w * 1.5) % (w * 1.3) - w * 0.65, -h * (0.3 - i * 0.05), u * (0.14 + 0.03 * i) * pop(t, 0.2 + i * 0.1, 0.4), K.white);
      band(x0, x1, h * 0.24, h * 0.03, w * 0.9, 1, K.lime, a.bh);
      band(x0, x1, h * 0.31, h * 0.025, w * 0.6, 3, K.green, a.bh);
      const top = -h * 0.43, sag = h * 0.045, nf = a.n(13);                       // bunting strung across the top
      pline([-w * 0.5, top, 0, top + sag, w * 0.5, top], 3 * k, K.ink);
      for (let i = 0; i < nf; i++) {
        const f = (i + 0.5) / nf, x = lerp(-w * 0.5, w * 0.5, f), y = top + sag * 4 * f * (1 - f) * 0.5 + 1, sc = pop(t, 0.1 + i * 0.04, 0.35), sw = S(t * 3 + i) * 0.12;
        tri(x, y + u * 0.06 * sc, u * 0.07 * sc, PI / 2 + sw, BUNTING[i % 6]);
      }
      for (let i = 0, nb = a.n(9); i < nb; i++) {                   // round bushes along the front hill, bouncing up one by one
        const x = ((i + 0.5) / nb - 0.5) * w * 1.04, r = u * (0.05 + 0.04 * a.r(i, 1)) * pop(t, 0.3 + i * 0.07, 0.4), y = h * (0.43 - 0.02 * a.r(i, 2));
        disc(x, y, r, i & 1 ? K.greenD : K.lime); disc(x - r * 0.3, y - r * 0.35, r * 0.28, K.pinkL);
      }
      const gap = 50 * k * s;                                       // the sleepers, popping in from the middle outwards
      for (let x = -w * 0.5; x < w * 0.52; x += u * 0.3) {
        const q = pop(t, 0.08 + Math.abs(x) / w * 0.5, 0.35);
        if (q > 0.02) boxO(x, y0, u * 0.055, gap * q, K.orange, 0, u * 0.02, Math.max(2, 2.4 * k));
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 1.2, y0 = h * 0.13, yb = y0 - 32 * k * s, T = Math.min(u * 0.4, w * 0.18), r0 = T * 0.2, fy = 1 + 0.8 * a.ak;
      const xf = tt => tt < 1.05 ? lerp(-0.62 * w, 2.5 * T, E.outBack(seg(tt, 0.3, 1.05))) : lerp(2.5 * T, 0.62 * w + 5 * T, E.in(seg(tt, 1.55, 2.3)));     // the engine's nose: in, stopped, away
      const x = xf(t), v = (xf(t + 0.02) - x) / 0.02, chug = Math.min(1, Math.abs(v) / (u * 1.2)), ang = -x / r0, blur = Math.abs(v) / r0 > 26;
      const bobf = (i) => -Math.abs(S(x / (T * 0.9) * PI + i * 1.3)) * u * 0.012 * chug - Math.abs(S(t * 22 + i)) * u * 0.004 * (1 - chug);
      bits([K.white], 16, i => {                                    // steam puffs rising from the chimney, each left where it was made
        const te = 0.4 + i * 0.13, age = t - te;
        if (age > 0 && age < 1.2) addDisc(xf(te) - 0.25 * T - age * u * 0.12, yb - 1.05 * T - age * u * 0.3, T * 0.1 * (1 + 3 * age) * (1 - seg(age, 0.7, 1.2)));
      });
      const xs = 1.1, p = seg(t, xs, xs + 0.5);                     // the whistle
      if (p > 0 && p < 1) { const wx = x - 1.35 * T + 0.62 * T, wy = yb - 0.95 * T; pulse(wx, wy, t, xs, 0.5, u * 0.3, u * 0.03, K.white); pulse(wx, wy, t, xs + 0.1, 0.5, u * 0.45, u * 0.02, K.yellow); }
      if (x - 5 * T < w * 0.55) {                                   // (once it has left it stays gone, however the exit squeezes the stage)
        for (let i = 0; i < 3; i++) wagon(x - 1.35 * T - (i + 1) * 1.24 * T + 0.14 * T, yb + bobf(i + 1), T, i, ang, blur);
        engine(x - 1.35 * T, yb + bobf(0), T, ang, blur);
      }
      a.begin(0, y0, s * pop(t, 0.02, 0.3), 0, a.bw * 0.92 / (50 * k * s), 1);
      glyph(g, k, { color: K.white, sw: 8 + 9 * (1 - a.ak), sh: (1.6 + 3 * (1 - a.ak)) * k, ol: (3 + 1.2 * (1 - a.ak)) * k, fn: (x, y) => { P.x = x; P.y = 50 + (y - 50) * fy; } });      // the rails pulled apart
      a.end();
    },
  },

  '<': boost(-1, K.lime, K.indigo, [K.pink, K.orange, K.yellow, K.lime, K.teal, K.sky, K.white], K.indigoD),
  '>': boost(1, K.yellow, K.magenta, [K.yellow, K.orange, K.red, K.lime, K.teal, K.sky, K.white], K.magentaM),

  /* ~: a ribbon dancer: the tilde swoops and wiggles through a figure of eight with a long striped ribbon streaming from each end, in a swirl of sine ribbons and spirals */
  '~': {
    color: K.sky, bg: K.purple, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a;
      RIBS.forEach(([col, lite, yc, amp, len, sp, ph, t0, wid]) => {   // sine ribbons weaving across, each drawn on from the left
        const grow = E.out(seg(t, t0, t0 + 0.9)), n = 44;
        PTS.length = 0;
        for (let j = 0; j <= n && j / n <= grow; j++) { const x = lerp(-a.bw / 2, a.bw / 2, j / n); PTS.push(x, yc * h + amp * u * S(x / (len * u) * TAU + ph + t * sp)); }
        if (PTS.length > 3) { pline(PTS, wid * u, col); pline(PTS, wid * u * 0.34, lite); }
      });
      spiral(-w * 0.36, -h * 0.26, 0, u * 0.36 * pop(t, 0.2, 0.5), 3, t * 1.4, u * 0.08, K.pinkL);
      spiral(w * 0.38, h * 0.2, 0, u * 0.32 * pop(t, 0.35, 0.5), 3, -t * 1.6, u * 0.07, K.yellow);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 1.15, N = 44, dt = 0.026;
      const env = tt => E.out(seg(tt, 0.02, 0.5)) * (1 - E.io(seg(tt, 1.9, 2.4)));
      const tip = (tt, sd) => {                                     // where an end of the tilde was at time tt
        const e = env(tt), cx = S(tt * 2.9 + 0.3) * 0.27 * w * e, cy = -h * 0.02 + S(tt * 5.8) * 0.2 * h * e, r = (0.15 + 0.22 * C(tt * 2.9)) * e, ox = sd * 26.5 * k * s, oy = -sd * 4 * k * s;
        TIP[0] = cx + ox * C(r) - oy * S(r); TIP[1] = cy + ox * S(r) + oy * C(r);
      };
      for (let side = -1; side <= 1; side += 2) {                   // the two ribbons: the ends' own trails, fluttering more toward the tail
        const pts = PTS, cols = side < 0 ? RIB_L : RIB_R;
        pts.length = 0;
        for (let i = 0; i < N; i++) { if (t - i * dt < 0.05) break; tip(t - i * dt, side); pts.push(TIP[0], TIP[1]); }
        const n = pts.length / 2;
        if (n < 3) continue;
        for (let i = 1; i < n - 1; i++) { const tx = pts[2 * i + 2] - pts[2 * i - 2], ty = pts[2 * i + 3] - pts[2 * i - 1], tl = Math.hypot(tx, ty) || 1, fl = S(i * 0.55 - t * 11 + side) * u * 0.05 * i / N; pts[2 * i] += -ty / tl * fl; pts[2 * i + 1] += tx / tl * fl; }
        ribbon(pts, n, u * 0.15, cols, 2.6 * k);
        for (let i = 4; i < n; i += 5) spark(pts[2 * i], pts[2 * i + 1], u * 0.08 * (0.6 + 0.4 * S(t * 12 + i * 2)) * (1 - i / N), t * 2 + i, K.white);
      }
      const e = env(t), rot = (0.15 + 0.22 * C(t * 2.9)) * e;
      a.begin(S(t * 2.9 + 0.3) * 0.27 * w * e, -h * 0.02 + S(t * 5.8) * 0.2 * h * e, s * pop(t, 0.02, 0.3), rot, 1, 1);
      glyph(g, k, { color: K.sky, sw: 11 + 6 * (1 - a.ak), slither: { amp: 1.8 * e * a.ak, k: 18, ph: -t * 12 } });
      a.end();
      fall(a, t, { n: a.n(16), t0: 0.3, cols: [K.yellow, K.white, K.pinkL, K.lime], shape: 'spark', vy0: 100, vy1: 260, seed: 61 });
    },
  },

  /* `: three claw slashes rip across the screen one after another, each tearing open a new colour, with impact stars, sparks and a paw print; the backtick is the first slash */
  '`': {
    color: K.yellow, bg: K.orange, dur: 2.8,
    back(a, t) {
      const { u, w, h } = a, c = raw();
      jolt(u, t);
      c.save(); c.translate(JT[0], JT[1]);
      for (let i = 0; i < 9; i++) {                                 // tiger stripes growing in from both edges
        const sd = i & 1 ? 1 : -1, y = (a.r(i, 1) - 0.5) * h * 0.95, len = u * (0.28 + 0.34 * a.r(i, 2)) * E.outElastic(seg(t, 0.03 + i * 0.06, 0.6 + i * 0.06)), th = u * (0.05 + 0.05 * a.r(i, 3)), x0 = sd * (w * 0.5 + 12), bend = (a.r(i, 4) - 0.5) * len * 0.3;
        poly([x0, y - th, x0 - sd * len * 0.55, y - th * 0.35 + bend * 0.6, x0 - sd * len, y + bend, x0 - sd * len * 0.55, y + th * 0.45 + bend * 0.6, x0, y + th], K.ink);
      }
      for (let i = 0; i < a.n(11); i++) {                           // long streaks of darker fur running the way the claws do
        const cx = (a.r(i, 5) - 0.5) * w * 0.9, cyy = (a.r(i, 6) - 0.5) * h * 0.9, len = u * (0.3 + 0.35 * a.r(i, 7)) * E.outElastic(seg(t, 0.1 + i * 0.05, 0.7 + i * 0.05)), th = u * (0.03 + 0.04 * a.r(i, 8)), an = 0.95 + (a.r(i, 9) - 0.5) * 0.3, dx = C(an) * len, dy = S(an) * len, nx = -S(an) * th, ny = C(an) * th;
        poly([cx - dx + nx * 0.2, cyy - dy + ny * 0.2, cx + nx, cyy + ny, cx + dx, cyy + dy, cx - nx, cyy - ny], K.orangeD);
      }
      c.restore();
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 1.4, ang = 0.95, cs = C(ang), sn = S(ang), cy = h * 0.04, L = u * 1.7, c = raw();
      const ax = -cs * L * 0.5, ay = cy - sn * L * 0.5;           // where the middle claw starts
      jolt(u, t);
      c.save(); c.translate(JT[0], JT[1]);
      for (let i = 0; i < 3; i++) {                                 // the slashes, the first through the backtick, the other two either side of it
        const t0 = 0.14 + i * 0.42, off = (i === 0 ? 0 : i === 1 ? 1 : -1) * u * 0.46, p = E.out(seg(t, t0, t0 + 0.3));
        if (p <= 0) continue;
        const x0 = ax - sn * off, y0 = ay + cs * off;
        tear(x0, y0, ang, L * (i ? 1 : 1.05), u * 0.27, p, i + 1, i === 0 ? K.yellow : i === 1 ? K.pink : K.sky, k);
        const st = seg(t, t0, t0 + 0.32);                           // impact star where the claw goes in, sparks from the tip
        if (st > 0 && st < 1) { const r = u * 0.2 * E.outBack(sat(st * 2.5)) * (1 - st * 0.5); star(x0, y0, r * 1.15, 9, r * 0.6, 0.3 + i, K.ink); star(x0, y0, r, 9, r * 0.55, 0.3 + i, K.white); }
        spray(a, t, { x: x0 + cs * L * p, y: y0 + sn * L * p, n: a.n(14), t0: t0 + 0.28, life: 0.8, v0: u * 0.6, v1: u * 1.7, a0: ang - 0.7, a1: ang + 0.7, g: 900, seed: 70 + i * 7, cols: [K.yellow, K.white, K.orange, K.ink] });
      }
      const pp = pop(t, 1.55, 0.45);                                // a paw print stamps down
      if (pp > 0) paw(Math.min(u * 0.62, w * 0.26), cy + u * 0.22, Math.min(u * 0.5, w * 0.21) * pp, -0.25 * (1 - pp) - 0.15);
      c.restore();
      const jab = S(PI * seg(t, 0.14, 0.34)) + S(PI * seg(t, 0.56, 0.76)) + S(PI * seg(t, 0.98, 1.18));
      const hx = ax + cs * L * 0.07 + cs * u * 0.05 * jab, hy = ay + sn * L * 0.07 + sn * u * 0.05 * jab;
      a.begin(hx + 0.25 * k * s, hy + 32.75 * k * s, s * pop(t, 0.02, 0.3), 0, 1, 1);
      glyph(g, k, { color: K.yellow });
      a.end();
      spray(a, t, { x: 0, y: cy, n: a.n(30), t0: 1.95, life: 1.1, v0: u * 0.8, v1: u * 2, seed: 77, cols: [K.yellow, K.white, K.ink, K.pink, K.sky] });
    },
  },

  /* |: the pipe is the first domino of a field of dominoes that topples in a wave, pops confetti and balloons at the far end, and springs back upright in a wave */
  '|': {
    color: K.white, bg: K.teal, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a, top = a.w > a.h ? -0.04 : -0.1;
      rays(0, -h * 0.25, 18, Math.hypot(a.bw, a.bh) / 2, t * 0.1, K.tealM, 0.4);
      for (let i = 0; i < a.n(14); i++) {                           // big polka dots drifting up, like pips
        const r = u * (0.05 + 0.1 * a.r(i, 1)) * pop(t, 0.05 + i * 0.04, 0.4), x = (a.r(i, 2) - 0.5) * w * 1.05, y = h * 0.5 - (t * u * (0.06 + 0.06 * a.r(i, 3)) + a.r(i, 4) * h) % (h * 1.1);
        disc(x, y, r, K.tealM);
      }
      box(0, h * top + a.bh / 2, a.bw, a.bh, K.tealD);              // the table the dominoes stand on
      box(0, h * top, a.bw, u * 0.04, K.tealM);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, land = w > h, R = land ? 4 : 5, N = land ? 8 : 5, DHF = Math.min(w * 0.94 / (1.15 + 0.56 * (N - 1)), u * 0.55), tau = 0.6 / (N - 1), s = DHF / (121.4 * k);
      const last = N - 1, tHit = 0.65 + last * tau + 0.3, tBack = tHit + 0.1;
      for (let r = 0; r < R; r++) {                                 // rows in perspective, back to front: smaller and higher at the back, each a beat later
        const f = r / (R - 1), sc = 0.62 + 0.38 * f, base = land ? lerp(-0.04, 0.32, f) : lerp(-0.1, 0.36, f), dly = (1 - f) * 0.16, front = r === R - 1;
        const DH = DHF * sc, DW = DH * 0.305, sp = DH * 0.56, xs = -((last * sp + DH * 1.15) / 2) + DW / 2 + (front ? 0 : 0.5 * ((R - 1 - r) & 1) * sp), by = h * base;
        const ang = i => {                                          // how far domino i has toppled: a wave down the row, then back up the other way
          const fall = 0.65 + dly + i * tau, rise = tBack + f * 0.08 + (last - i) * tau * 0.5, lean = i === last ? 1.5 : 0.66;
          let th = lean * E.in(seg(t, fall, fall + (i === last ? 0.3 : 0.24))) + (i === last ? 0.07 * wob(t - fall - 0.3, 3, 6) : 0.05 * wob(t - fall - 0.24, 3.5, 7));
          if (!i && front) th -= 0.08 * S(PI * seg(t, 0.45, 0.65));   // the first one rocks back before it goes
          return t > rise ? th * (1 - E.outBack(seg(t, rise, rise + 0.28))) : th;
        };
        for (let i = front ? 1 : 0; i < N; i++) domino(xs + i * sp + DW / 2, by, ang(i), DW, DH, pop(t, 0.02 + i * 0.035 + (1 - f) * 0.1, 0.3), DOM[(i + r * 3) % DOM.length], k, i + r * 2);
        const ex = xs + last * sp + DH * 0.65, ey = by - DW * 0.5, tp = tHit + dly;
        spray(a, t, { x: ex, y: ey, n: a.n(front ? 24 : 10), t0: tp, life: 1.1, v0: u * 0.8, v1: u * 2, a0: -PI * 0.95, a1: -PI * 0.05, g: 1200, seed: 91 + r * 13, cols: DOM });
        if (front) pulse(ex, ey, t, tp, 0.5, u * 0.5, u * 0.05, K.white);
        for (let i = 0; i < (front ? 3 : 2); i++) {                  // balloons let go at the far end
          const age = t - tp - i * 0.06;
          if (age > 0) balloon(ex + (i - 1) * u * 0.12 * sc + S(age * 4 + i + r) * u * 0.03, ey - DH * 0.3 - age * u * (0.7 + 0.15 * i), u * 0.08 * sc * pop(t, tp + i * 0.06, 0.3), S(age * 3 + i) * 0.15, DOM[(r * 3 + i * 2) % DOM.length]);
        }
        if (front) {                                                // the hero: the pipe itself, turning about its bottom corner
          const th0 = ang(0), px = xs + DW / 2, cs = C(th0), sn = S(th0), q = pop(t, 0.02, 0.3);
          a.begin(px + (-DW / 2) * cs + (DH / 2) * sn, by + (-DW / 2) * sn - (DH / 2) * cs, s * q, th0, DW / (25.4 * k * s), 1);
          glyph(g, k, { color: K.white, sh: (2 + 2.6 * (1 - a.ak)) * k });
          a.end();
          dominoPips(px, by, th0, DW, DH, q * a.ak, 0, K.ink);
        }
      }
    },
  },
};

// a banknote turning over as it falls: fl (-1..1) is its sideways squash, so it flaps
function bill(x, y, w, h, rot, fl, face, back) {
  if (h < 2) return;
  const c = raw(), sx = Math.max(0.1, Math.abs(fl));
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(sx, 1);
  boxO(0, 0, w, h, fl > 0 ? face : back, 0, h * 0.16, Math.max(3, h * 0.08));
  if (sx > 0.25) { disc(0, 0, h * 0.28, K.green); disc(-w * 0.37, 0, h * 0.08, K.green); disc(w * 0.37, 0, h * 0.08, K.green); }
  c.restore();
}
// notes i0..i1 of the rain, falling and swaying at their own speeds
function bills(a, t, i0, i1) {
  const { u, w, h } = a, n = Math.min(i1, a.n(20));
  for (let i = i0; i < n; i++) {
    const bw = u * (i < 14 ? 0.24 + 0.14 * a.r(i, 3) : 0.36 + 0.12 * a.r(i, 3)), span = h + bw * 2, vy = u * (0.7 + 0.6 * a.r(i, 2)), sc = E.outBack(sat(t * 4 - a.r(i, 8) * 0.7));
    const y = -h / 2 - bw + (t * vy + a.r(i, 6) * span) % span, sway = S(t * (1.2 + a.r(i, 7)) + i) * u * 0.07;
    const x = (i < 14 ? (a.r(i, 1) - 0.5) * w * 1.02 : (i & 1 ? 1 : -1) * (0.3 + 0.2 * a.r(i, 1)) * w) + sway;     // the big ones in front keep to the sides
    bill(x, y, bw * sc, bw * 0.5 * sc, S(t * (1.6 + a.r(i, 4)) + i * 1.7) * 0.7, C(t * (3.5 + 3 * a.r(i, 5)) + i * 2), BILL[i % 3], BILL[(i + 1) % 3]);
  }
}
// gold coins that drop in, bounce on the heap and wobble as they spin
function bounceCoins(a, t, fy) {
  const { u, w } = a, n = a.n(7);
  for (let i = 0; i < n; i++) {
    const t0 = 0.15 + a.r(i, 1) * 0.9, T = 0.5 + 0.2 * a.r(i, 2), H = u * (0.35 + 0.25 * a.r(i, 3)), r = u * (0.07 + 0.05 * a.r(i, 4)), age = t - t0;
    if (age < 0) continue;
    const x = ((i + 0.5) / n - 0.5) * w * 0.92 + (a.r(i, 5) - 0.5) * u * 0.2, y = fy - hop(age + T / 2, T, H, 0.72), sp = age * (5 + 4 * a.r(i, 6)) + i;
    const q = pop(t, t0, 0.3), cw = Math.max(0.12, Math.abs(C(sp))) * r * q;
    oval(x, y, cw + 3, r * q + 3, K.ink); oval(x, y, cw, r * q, K.yellow); oval(x, y, cw * 0.66, r * q * 0.66, K.orange);
  }
}

// a pie wedge with the dark outline round it, its point at (x, y)
function wedge(x, y, r, a0, a1, col, ol) {
  if (r <= 0) return;
  const c = raw();
  c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, a0, a1); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = ol * 2; c.strokeStyle = K.ink; c.stroke(); c.fillStyle = col; c.fill();
}
// a big chef's knife pointing along ang, its middle at (x, y), len long
function knife(x, y, ang, len, ol) {
  const c = raw(), bh = len * 0.2;
  c.save(); c.translate(x, y); c.rotate(ang);
  const blade = [-len * 0.08, -bh * 0.5, len * 0.4, -bh * 0.5, len * 0.55, bh * 0.15, len * 0.36, bh * 0.5, -len * 0.08, bh * 0.5];
  c.beginPath(); c.moveTo(blade[0], blade[1]); for (let i = 2; i < blade.length; i += 2) c.lineTo(blade[i], blade[i + 1]); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = ol * 2; c.strokeStyle = K.ink; c.stroke(); c.fillStyle = K.white; c.fill();
  poly([-len * 0.08, bh * 0.16, len * 0.42, bh * 0.16, len * 0.36, bh * 0.5, -len * 0.08, bh * 0.5], K.skyL);
  boxO(-len * 0.32, 0, len * 0.4, bh * 0.62, K.red, 0, bh * 0.2, ol);
  disc(-len * 0.22, 0, bh * 0.09, K.yellow); disc(-len * 0.4, 0, bh * 0.09, K.yellow);
  c.restore();
}

// a range of pointy peaks: two triangle waves added, filled down to y1
function peaks(x0, x1, base, amp, len, ph, col, y1) {
  const c = raw(), n = Math.ceil((x1 - x0) / 14), saw = v => 1 - Math.abs(((v % 1) + 1) % 1 * 2 - 1);
  c.fillStyle = col; c.beginPath(); c.moveTo(x0, y1);
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; c.lineTo(x, base - amp * (0.68 * saw(x / len + ph / len) + 0.32 * saw(x / (len * 0.43) + ph / len * 2.3))); }
  c.lineTo(x1, y1); c.closePath(); c.fill();
}
// a filled polygon with the dark outline round it
function polyO(p, col, ol) {
  const c = raw();
  c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = Math.max(0.01, ol * 2); c.strokeStyle = K.ink; c.stroke(); c.fillStyle = col; c.fill();
}

// A round little buddy with a face, legs and arms. (x, y) is between its feet, sz is its body's radius in px, sx and sy squash it about its feet, dir is
// which way its friend is. o: run (leg phase), amt (how far the legs swing), mood (1 yelling, 2 shocked, 3 happy), hug (0..1), up (arms cheering).
// pass 0 draws the arms (behind both bodies, so a hug goes round the friend's back), pass 1 the rest.
function buddy(x, y, sz, rot, sx, sy, col, lt, dk, kind, dir, o, pass) {
  const c = raw(), BY = -1.3, ol = 0.085;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(sz * sx, sz * sy);
  if (!pass) {
    for (let si = 0; si < 2; si++) {                                // arms: swinging as it runs, round its friend for the hug (the far one waves), or up in a cheer
      const sd = si * 2 - 1, p = o.run + (sd > 0 ? 0 : PI), near = sd === dir;
      let hx = sd * 1.6, hy = BY + 0.05 + 0.4 * S(p) * o.amt;
      hx = lerp(hx, near ? dir * 2.35 : -dir * 1.4, o.hug); hy = lerp(hy, near ? BY + 0.2 : BY - 0.5 + 0.3 * S(o.t * 11), o.hug);
      hx = lerp(hx, sd * 1.0, o.up); hy = lerp(hy, BY - 1.55 + 0.12 * S(o.t * 14 + sd), o.up);
      const e = limbL(sd * 0.8, BY + 0.15, hx, hy, 0.8, 0.8, sd, 0.22, col, ol); discO(e[0], e[1], 0.19, col, ol);
    }
    c.restore();
    return;
  }
  for (let si = 0; si < 2; si++) {                                  // legs and shoes
    const sd = si * 2 - 1, p = o.run + (sd > 0 ? PI : 0), fx = sd * 0.36 + 0.34 * S(p) * o.amt, fyy = -0.03 - 0.3 * Math.max(0, -C(p)) * o.amt;
    limbL(sd * 0.32, BY + 0.8, fx, fyy, 0.3, 0.3, 1, 0.22, col, ol);
    ovalO(fx + dir * 0.1, fyy, 0.32, 0.16, K.white, 0, ol);
  }
  if (kind) for (let i = -1; i <= 1; i++) tri(i * 0.32, BY - 1.15 + Math.abs(i) * 0.08, 0.22, -PI / 2 + i * 0.35, dk);   // a tuft of hair
  else { tri(-0.34, BY - 1.0, 0.3, PI * 0.5 + 0.2, dk); tri(0.3, BY - 1.0, 0.3, PI * 0.5 - 0.2, dk); disc(0, BY - 0.98, 0.13, K.yellow); }    // a bow
  ovalO(0, BY, 0.88, 1, col, 0, ol);
  oval(0, BY + 0.36, 0.52, 0.5, lt);
  disc(-0.58, BY + 0.14, 0.11, lt); disc(0.58, BY + 0.14, 0.11, lt);
  const look = dir * 0.7, blink = (o.t * 0.8 + kind * 0.5) % 1.6 < 0.09 ? 0.1 : 1;
  if (o.mood === 3) { arcS(-0.3, BY - 0.25, 0.2, PI * 1.1, PI * 1.9, 0.1, K.ink); arcS(0.3, BY - 0.25, 0.2, PI * 1.1, PI * 1.9, 0.1, K.ink); }
  else eyes(0, BY - 0.28, 0.6, o.mood === 2 ? 0.3 : 0.25, look, 0.1, blink);
  if (o.mood === 1) { pie(0, BY + 0.12, 0.36, 0, PI, K.ink); disc(0, BY + 0.42, 0.13, K.red); }
  else if (o.mood === 2) disc(0, BY + 0.28, 0.17, K.ink);
  else arcS(0, BY + 0.06, 0.4, PI * 0.12, PI * 0.88, 0.1, K.ink);
  c.restore();
}
// a two-bone limb with the dark outline that also works in small units (the kit's ik keeps half a pixel spare); returns where it ends
function limbL(hx, hy, fx, fy, l1, l2, dir, lw, col, ol) {
  const c = raw(), dx = fx - hx, dy = fy - hy, len = Math.hypot(dx, dy) || 1e-6, d = Math.min(len, (l1 + l2) * 0.98), ux = dx / len, uy = dy / len;
  const q = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - q * q)), kx = hx + ux * q - uy * hh * dir, ky = hy + uy * q + ux * hh * dir;
  LEND[0] = hx + ux * d; LEND[1] = hy + uy * d;
  c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.lineTo(LEND[0], LEND[1]);
  c.strokeStyle = K.ink; c.lineWidth = lw + ol * 2; c.stroke(); c.strokeStyle = col; c.lineWidth = lw; c.stroke();
  return LEND;
}

// a petal (or, with pointy, a diamond) lying along ang, len long from its middle each way, for bits()
function addPetal(c, x, y, len, wid, ang, pointy) {
  if (pointy) { const cs = C(ang), sn = S(ang); c.moveTo(x + cs * len, y + sn * len); c.lineTo(x - sn * wid, y + cs * wid); c.lineTo(x - cs * len, y - sn * len); c.lineTo(x + sn * wid, y - cs * wid); c.closePath(); return; }
  c.moveTo(x + C(ang) * len, y + S(ang) * len); c.ellipse(x, y, len, wid, ang, 0, TAU);
}

// four sails of a pinwheel, r long from the middle to each arm tip, turned by rot, each with the dark outline
function pinwheel(x, y, r, rot, cols, ol) {
  if (r <= 0) return;
  const c = raw();
  c.lineJoin = 'round'; c.lineWidth = ol * 2; c.strokeStyle = K.ink;
  for (let i = 0; i < 4; i++) {
    const an = rot + i * PI / 2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + C(an) * r, y + S(an) * r); c.lineTo(x + C(an + PI / 4) * r * 1.4142, y + S(an + PI / 4) * r * 1.4142); c.closePath();
    c.stroke(); c.fillStyle = cols[i]; c.fill();
  }
}

// a spoked wheel turned to ang
function wheel(x, y, r, ang, blur) {
  const c = raw();
  discO(x, y, r, K.white, Math.max(2, r * 0.18));
  if (blur) { disc(x, y, r * 0.5, K.skyL); disc(x, y, r * 0.24, K.ink); return; }
  c.strokeStyle = K.ink; c.lineWidth = Math.max(2, r * 0.18); c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i < 3; i++) { const an = ang + i * PI / 3; c.moveTo(x + C(an) * r * 0.72, y + S(an) * r * 0.72); c.lineTo(x - C(an) * r * 0.72, y - S(an) * r * 0.72); }
  c.stroke(); disc(x, y, r * 0.24, K.ink);
}
// the engine, its left edge at x0 and its wheels on the rail at yb; T is the length of a car's worth
function engine(x0, yb, T, ang, blur) {
  const ol = Math.max(2, T * 0.05);
  polyO([x0 + 1.02 * T, yb - 0.74 * T, x0 + 1.2 * T, yb - 0.74 * T, x0 + 1.27 * T, yb - 1.04 * T, x0 + 0.95 * T, yb - 1.04 * T], K.indigo, ol);
  discO(x0 + 0.62 * T, yb - 0.73 * T, 0.13 * T, K.yellow, ol);
  boxO(x0 + 0.9 * T, yb - 0.5 * T, 0.9 * T, 0.46 * T, K.red, 0, 0.2 * T, ol);
  box(x0 + 0.72 * T, yb - 0.5 * T, 0.05 * T, 0.42 * T, K.yellow); box(x0 + 1.24 * T, yb - 0.5 * T, 0.05 * T, 0.42 * T, K.yellow);
  eyes(x0 + 0.98 * T, yb - 0.55 * T, 0.3 * T, 0.11 * T, 0.8, 0.1); arcS(x0 + 0.98 * T, yb - 0.5 * T, 0.16 * T, PI * 0.15, PI * 0.85, 0.035 * T, K.ink);
  boxO(x0 + 0.26 * T, yb - 0.63 * T, 0.48 * T, 0.72 * T, K.redD, 0, 0.05 * T, ol);
  boxO(x0 + 0.26 * T, yb - 1.02 * T, 0.6 * T, 0.09 * T, K.yellow, 0, 0.03 * T, ol);
  boxO(x0 + 0.26 * T, yb - 0.72 * T, 0.24 * T, 0.26 * T, K.skyL, 0, 0.04 * T, ol * 0.7);
  box(x0 + 0.68 * T, yb - 0.25 * T, 1.36 * T, 0.12 * T, K.indigo);
  polyO([x0 + 1.34 * T, yb - 0.3 * T, x0 + 1.56 * T, yb - 0.02 * T, x0 + 1.34 * T, yb - 0.02 * T], K.yellow, ol);
  discO(x0 + 1.37 * T, yb - 0.56 * T, 0.07 * T, K.yellow, ol);
  wheel(x0 + 0.3 * T, yb - 0.2 * T, 0.2 * T, ang, blur); wheel(x0 + 0.78 * T, yb - 0.2 * T, 0.2 * T, ang, blur); wheel(x0 + 1.18 * T, yb - 0.14 * T, 0.14 * T, ang * 1.4, blur);
  const rx = 0.09 * T;                                              // the connecting rod between the two big wheels
  line(x0 + 0.3 * T + C(ang) * rx, yb - 0.2 * T + S(ang) * rx, x0 + 0.78 * T + C(ang) * rx, yb - 0.2 * T + S(ang) * rx, 0.07 * T + ol * 2, K.ink);
  line(x0 + 0.3 * T + C(ang) * rx, yb - 0.2 * T + S(ang) * rx, x0 + 0.78 * T + C(ang) * rx, yb - 0.2 * T + S(ang) * rx, 0.07 * T, K.yellow);
}
// a wagon 1.1 T long with its left edge at x0: 0 carries presents, 1 a barrel, 2 passengers
function wagon(x0, yb, T, kind, ang, blur) {
  const ol = Math.max(2, T * 0.05), col = WAGON[kind];
  box(x0 - 0.07 * T, yb - 0.26 * T, 0.2 * T, 0.05 * T, K.ink);
  box(x0 + 0.55 * T, yb - 0.24 * T, 1.1 * T, 0.1 * T, K.indigo);
  if (kind === 0) { boxO(x0 + 0.25 * T, yb - 0.76 * T, 0.3 * T, 0.3 * T, K.pink, 0, 0.03 * T, ol); boxO(x0 + 0.62 * T, yb - 0.72 * T, 0.32 * T, 0.22 * T, K.sky, 0, 0.03 * T, ol); boxO(x0 + 0.9 * T, yb - 0.8 * T, 0.24 * T, 0.38 * T, K.orange, 0, 0.03 * T, ol); }
  else if (kind === 1) { ovalO(x0 + 0.55 * T, yb - 0.72 * T, 0.5 * T, 0.2 * T, K.orange, 0, ol); box(x0 + 0.3 * T, yb - 0.72 * T, 0.05 * T, 0.36 * T, K.ink); box(x0 + 0.8 * T, yb - 0.72 * T, 0.05 * T, 0.36 * T, K.ink); }
  boxO(x0 + 0.55 * T, yb - 0.44 * T, 1.06 * T, 0.3 * T, col, 0, 0.05 * T, ol);
  box(x0 + 0.55 * T, yb - 0.34 * T, 1.0 * T, 0.05 * T, K.white);
  if (kind === 2) { boxO(x0 + 0.55 * T, yb - 0.74 * T, 1.0 * T, 0.32 * T, K.limeD, 0, 0.05 * T, ol); for (let i = 0; i < 3; i++) { discO(x0 + (0.25 + 0.3 * i) * T, yb - 0.76 * T, 0.09 * T, K.white, ol * 0.7); disc(x0 + (0.25 + 0.3 * i) * T, yb - 0.75 * T, 0.03 * T, K.ink); } }
  wheel(x0 + 0.22 * T, yb - 0.16 * T, 0.15 * T, ang, blur); wheel(x0 + 0.88 * T, yb - 0.16 * T, 0.15 * T, ang, blur);
}

/* < and >: a chevron boosts across the screen leaving a rainbow of echoes, bounces off the far side and comes home while rows of chevrons race by in staggered bounces */
function boost(dir, color, bg, rb, tone) {
  return {
    flip: dir, color, bg, dur: 2.7,
    back(a, t) {                                                    // a wallpaper of chevrons sliding in the direction of travel
      const { u } = a, d = a.flip, c = raw(), sp = u * 0.55, hgt = u * 0.34, n = Math.ceil(Math.hypot(a.bw, a.bh) / 2 / sp), off = (t * u * 0.9 * d) % sp;
      c.strokeStyle = tone; c.lineWidth = u * 0.07 * pop(t, 0.05, 0.4); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
        const x = i * sp + (j & 1 ? sp / 2 : 0) + off, y = j * sp * 0.6;
        c.moveTo(x - d * hgt * 0.32, y - hgt / 2); c.lineTo(x + d * hgt * 0.32, y); c.lineTo(x - d * hgt * 0.32, y + hgt / 2);
      }
      c.stroke();
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, d = a.flip, s = 1.05, y0 = -h * 0.02, far = 0.34 * w, hitT = 0.95;
      const hx = tt => d * (tt < 0.36 ? -0.3 * w - 0.04 * w * S(PI * seg(tt, 0.2, 0.36)) : tt < hitT ? lerp(-0.3 * w, far, E.in(seg(tt, 0.36, hitT))) : lerp(far, 0, E.outElastic(seg(tt, hitT, 1.75))));
      const x = hx(t), vs = (hx(t + 0.02) - hx(t - 0.02)) / 0.04, fast = Math.min(1, Math.abs(vs) / (u * 2.2)), hit = t - hitT, kick = hit > 0 ? Math.exp(-7 * hit) * C(TAU * 2.6 * hit) : 0;
      const wind = 0.8 * S(PI * seg(t, 0.2, 0.36));                 // it squashes back before the dash
      for (let i = 0; i < 14; i++) {                                // speed lines
        const y = (a.r(i, 1) - 0.5) * h * 0.95, len = w * (0.25 + 0.3 * a.r(i, 2)), p = ((t * (1.4 + a.r(i, 3)) + a.r(i, 4)) % 1), xx = d * lerp(-0.75 * w - len, 0.75 * w, p);
        if (t > 0.3 && t < 2.1) line(xx - d * len / 2, y, xx + d * len / 2, y, u * (0.014 + 0.02 * a.r(i, 5)), i % 3 ? K.white : rb[i % 7]);
      }
      for (let r = 0; r < 5; r++) {                                 // rows of chevrons racing across in a bounce, each on its own beat
        const t0 = 0.45 + r * 0.14;
        for (let j = 0; j < 4; j++) {
          const p = seg(t, t0 + j * 0.05, t0 + 1.15 + j * 0.05), sc = E.outBack(sat((t - t0 - j * 0.05) * 6));
          if (p <= 0 || p >= 1) continue;
          const cx = d * lerp(-0.72 * w, 0.72 * w, p), cyy = BROWS[r][0] * h - Math.abs(S(p * PI * 3 + j)) * u * 0.035;
          chev(cx, cyy, u * BROWS[r][1] * sc, d, rb[(r * 2 + j) % 7], u * BROWS[r][1] * 0.22 * sc, 3 * k);
        }
      }
      const gap = u * 0.17 * fast, back = vs > 0 ? -1 : 1;           // the echoes trail behind, spaced by how fast it is going
      if (gap > 3) {
        for (let i = 0; i < 7; i++) line(x + back * gap * 7, y0 + (i - 3) * u * 0.05, x, y0 + (i - 3) * u * 0.05, u * 0.056, rb[i]);       // a rainbow streak through them
        const c = raw();
        for (let i = 7; i >= 1; i--) {                              // the echoes: copies of the chevron, one rainbow colour each
          c.save(); c.translate(x + back * gap * i, y0); c.scale(s * (1 - 0.04 * i) * (1 + 0.5 * fast), s * (1 - 0.04 * i)); glyph(g, k, { color: rb[i - 1], sh: 0 }); c.restore();
        }
      }
      const bang = seg(t, hitT, hitT + 0.35);                       // impact on the far side
      if (bang > 0 && bang < 1) { const r = u * 0.36 * E.outBack(sat(bang * 2.5)) * (1 - bang * 0.4); star(d * far, y0, r * 1.12, 10, r * 0.55, 0.2, K.ink); star(d * far, y0, r, 10, r * 0.5, 0.2, K.white); }
      spray(a, t, { x: d * far, y: y0, n: a.n(26), t0: hitT, life: 1.1, v0: u * 0.8, v1: u * 2.2, a0: d > 0 ? PI * 0.55 : -PI * 0.5, a1: d > 0 ? PI * 1.45 : PI * 0.5, g: 1000, seed: 41, cols: rb });
      a.begin(x, y0, s * pop(t, 0.02, 0.3), 0, (1 + 0.5 * fast - 0.25 * wind) * (1 - 0.3 * kick), (1 - 0.1 * fast + 0.15 * wind) * (1 + 0.3 * kick));
      glyph(g, k, { color });
      a.end();
      spray(a, t, { x: 0, y: y0, n: a.n(26), t0: 1.85, life: 1.1, v0: u * 0.8, v1: u * 2, seed: 43, cols: rb });
      for (let i = 0; i < 6; i++) {                                 // twinkles on the way
        const p = (t * 1.2 + a.r(i, 6)) % 1, sx = (a.r(i, 7) - 0.5) * w * 0.9, sy = (a.r(i, 8) - 0.5) * h * 0.8, sz = u * 0.09 * S(p * PI) * pop(t, 0.5, 0.3);
        if (sz > 1) spark(sx, sy, sz, a.r(i, 9) * 3, rb[i % 7]);
      }
    },
  };
}
// a chevron pointing the way d, hgt tall, with the dark outline
function chev(x, y, hgt, d, col, lw, ol) {
  if (hgt <= 0) return;
  PTS.length = 0; PTS.push(x - d * hgt * 0.32, y - hgt / 2, x + d * hgt * 0.32, y, x - d * hgt * 0.32, y + hgt / 2);
  pline(PTS, lw + ol * 2, K.ink); pline(PTS, lw, col);
}

// a ribbon along the n points in pts, wide at the head and tapering to nothing, striped in the colours cols (widest first), with a dark outline round the whole
function ribbon(pts, n, wid, cols, ol) {
  const c = raw(), L = [], R = [];
  for (let layer = 0; layer < cols.length; layer++) {
    const f = 1 - layer * 0.34;
    L.length = 0; R.length = 0;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), tx = pts[2 * i1] - pts[2 * i0], ty = pts[2 * i1 + 1] - pts[2 * i0 + 1], tl = Math.hypot(tx, ty) || 1, hw = wid * f * (1 - i / n) ** 0.6 / 2;
      L.push(pts[2 * i] - ty / tl * hw, pts[2 * i + 1] + tx / tl * hw); R.push(pts[2 * i] + ty / tl * hw, pts[2 * i + 1] - tx / tl * hw);
    }
    c.beginPath(); c.moveTo(L[0], L[1]);
    for (let i = 2; i < L.length; i += 2) c.lineTo(L[i], L[i + 1]);
    for (let i = R.length - 2; i >= 0; i -= 2) c.lineTo(R[i], R[i + 1]);
    c.closePath();
    if (!layer) { c.lineJoin = 'round'; c.lineWidth = ol * 2; c.strokeStyle = K.ink; c.stroke(); }
    c.fillStyle = cols[layer]; c.fill();
  }
}

// a torn streak from (x0, y0) along ang, L long and W wide at its widest, tapering to a point, grown to p of its length: a ragged pale edge round a colour
function tear(x0, y0, ang, L, W, p, seed, col, k) {
  const c = raw(), cs = C(ang), sn = S(ang), m = Math.max(3, Math.ceil(26 * p)), A = [], B = [], I = [], J = [];
  for (let i = 0; i <= m; i++) {
    const f = p * i / m, env = Math.min(1, f / 0.08 + 0.1) * (1 - f) ** 0.8 * Math.min(1, (p - f) / 0.14 + 0.05), hw = W * env / 2, jag = (hash(seed, i, 1) - 0.5) * W * 0.09, jag2 = (hash(seed, i, 2) - 0.5) * W * 0.09;
    const px = x0 + cs * L * f, py = y0 + sn * L * f;
    A.push(px - sn * (hw + jag), py + cs * (hw + jag)); B.push(px + sn * (hw + jag2), py - cs * (hw + jag2));
    I.push(px - sn * hw * 0.66, py + cs * hw * 0.66); J.push(px + sn * hw * 0.66, py - cs * hw * 0.66);
  }
  const trace = (P1, P2) => { c.beginPath(); c.moveTo(P1[0], P1[1]); for (let i = 2; i < P1.length; i += 2) c.lineTo(P1[i], P1[i + 1]); for (let i = P2.length - 2; i >= 0; i -= 2) c.lineTo(P2[i], P2[i + 1]); c.closePath(); };
  trace(A, B); c.lineJoin = 'round'; c.lineWidth = 3.4 * k * 2; c.strokeStyle = K.ink; c.stroke(); c.fillStyle = K.cream; c.fill();
  trace(I, J); c.fillStyle = col; c.fill();
}
// a paw print: a three-lobed pad and four toes, r tall
function paw(x, y, r, rot) {
  const c = raw();
  c.save(); c.translate(x, y); c.rotate(rot);
  for (const [dx, dy, an] of TOES) { oval(dx * r, dy * r, r * 0.2, r * 0.28, K.ink, an); oval(dx * r - r * 0.07, dy * r - r * 0.1, r * 0.04, r * 0.08, K.orange, an); }
  disc(0, r * 0.28, r * 0.42, K.ink); disc(-r * 0.4, r * 0.3, r * 0.26, K.ink); disc(r * 0.4, r * 0.3, r * 0.26, K.ink); disc(0, r * 0.5, r * 0.32, K.ink);
  oval(-r * 0.22, r * 0.14, r * 0.07, r * 0.12, K.orange, 0.5);
  c.restore();
}
// a short shake for the claw scene: every impact jolts the picture, dying away (the result is in JT)
function jolt(u, t) {
  let x = 0, y = 0;
  for (let i = 0; i < JOLTS.length; i++) {
    const age = t - JOLTS[i];
    if (age > 0 && age < 0.5) { const e = Math.exp(-14 * age) * u * 0.014; x += e * S(age * 90); y += e * C(age * 77); }
  }
  JT[0] = x; JT[1] = y;
}
// a domino with its bottom right corner (the pivot it topples about) at (px, py), turned by th, DW by DH, grown to q
function domino(px, py, th, DW, DH, q, col, k, seed) {
  if (q <= 0.01) return;
  const c = raw(), ol = 2.6 * k;
  c.save(); c.translate(px, py); c.rotate(th); c.scale(q, q);
  boxO(-DW / 2, -DH / 2, DW - ol * 2, DH - ol * 2, col, 0, DW * 0.3, ol);
  c.restore();
  dominoPips(px, py, th, DW, DH, q, seed, K.white);
}
// the dots and the dividing line on a domino
function dominoPips(px, py, th, DW, DH, q, seed, col) {
  if (q <= 0.02) return;
  const c = raw();
  c.save(); c.translate(px, py); c.rotate(th); c.translate(-DW / 2, -DH / 2); c.scale(q, q);
  box(0, 0, DW * 0.72, DW * 0.05, col);
  c.fillStyle = col; c.beginPath();
  for (let half = 0; half < 2; half++) for (const [ox, oy] of PIP[1 + (seed * 2 + half * 3 + 1) % 6]) addDisc(ox * DW * 0.2, (half ? 1 : -1) * DH * 0.24 + oy * DH * 0.085, DW * 0.085);
  c.fill();
  c.restore();
}
