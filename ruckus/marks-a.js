// Punctuation, part one: ! ? . , ' " - _ : ;
// The marks are tiny in the font, so each scene builds a big body around (or out of) the real glyph. That body is scaled by
// a.ak, so it shrinks away while the hero flies down and only the glyph itself lands in the text.
import {
  K, E, S, C, TAU, PI, sat, clamp, seg, lerp, pop, wob, hash, rays, disc, discO, ring, oval, ovalO, box, boxO, line, pline, poly, star, spark, heart, drop, leaf, pie, arcS,
  crescent, blob, bolt, wave, band, spiral, flower, eye, bits, addDisc, addStar, spray, fall, pulse, glyph, gpath, gx, gy, alpha, raw, P, HERO,
} from './kit.js';

export const SCENES = {
  /* !: a lit fuse burns down, the bar slams onto the dot and throws it up, and the whole screen goes BOOM */
  '!': {
    color: K.red, bg: K.indigo, dur: 2.8,
    back(a, t) {
      const { u, k, w, h } = a, q = t - 0.62, R = Math.hypot(w, h) * 0.5, y0 = u * 0.06, shake = q > 0 ? Math.exp(-7 * q) : 0;
      const d = u * 0.15, c = raw();                                // Ben-Day dots, swelling as the shock wave passes
      c.fillStyle = K.indigoM; c.beginPath();
      for (let j = -9; j <= 9; j++) for (let i = -13; i <= 13; i++) {
        const x = (i + (j & 1) * 0.5) * d, y = j * d * 0.87 + y0, dist = Math.hypot(x, y - y0);
        if (q > 0.3 && dist < R * 0.45) continue;                   // (the burst hides these)
        addDisc(x, y, d * (0.17 + 0.13 * (0.5 + 0.5 * S(dist / d * 0.5 - t * 5))));
      }
      c.fill();
      for (let i = 0; i < 2; i++) {                                 // pressure building: rings squeezing in on the bar
        const p = seg(t, 0.06 + i * 0.22, 0.5 + i * 0.1);
        if (p > 0 && q < 0) ring(0, y0, R * (1 - E.io(p) * 0.8), u * 0.03 * (1 - p * 0.5), K.indigoL);
      }
      if (q <= 0) return;
      const x = S(t * 83) * shake * 10 * k, y = y0 + C(t * 97) * shake * 8 * k;
      blast(x, y, R * 1.2 * seg(q, 0, 0.1) * (1 - seg(q, 0.1, 0.32)), 16, 5, 0.1, t, K.white);          // the flash
      for (let i = 0; i < 3; i++) blast(x, y, R * BURST[i][1] * E.outBack(seg(q, 0.03 + i * 0.05, 0.36 + i * 0.05)), BURST[i][2], i + 1, (i - 1) * q * 0.06, t, BURST[i][0]);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 0.85, q = t - 0.62, y0 = u * 0.06, R = Math.hypot(w, h) * 0.5;
      const wind = E.out(seg(t, 0.12, 0.5)), slam = E.in(seg(t, 0.5, 0.62)), jolt = q > 0 ? Math.exp(-6 * q) * C(TAU * 3.2 * q) : 0, shake = q > 0 ? Math.exp(-7 * q) : 0;
      const barDy = q > 0 ? 8 * jolt : -22 * wind * (1 - slam) + 8 * slam;
      const dotDy = -bounce(q - 0.04, 0.8, 92, 0.28) + (q > 0 && q < 0.04 ? 6 : 0), dotDx = 34 * S(PI * sat((q - 0.04) / 0.8));
      spray(a, t, { x: 0, y: y0, n: a.n(34), t0: 0.62, life: 1.3, v0: u * 1.0, v1: u * 3.0, g: 1000, s0: 8, s1: 24, seed: 31, cols: [K.white, K.ink, K.sky, K.lime, K.pinkL] });
      if (q > 0) {
        pulse(0, y0, t, 0.62, 0.55, R * 0.95, u * 0.09, K.white);
        pulse(0, y0, t, 0.69, 0.6, R * 0.8, u * 0.055, K.yellow);
        pulse(0, y0, t, 0.78, 0.6, R * 0.55, u * 0.035, K.white);
        const sp = seg(q, 0, 0.6);
        spokes(0, y0, a.n(22), u * (0.4 + 1.1 * E.out(sp)), u * 0.5 * (1 - sp) + u * 0.05, 0.12, u * 0.03 * (1 - sp), K.white, K.ink);
        for (let i = 0; i < 6; i++) {                               // smoke rolling out along the ground
          const p = E.out(seg(q, 0.05 + i * 0.04, 0.95)), r = u * (0.07 + 0.06 * a.r(i)) * p * (1 - seg(q, 1.5, 1.9) * 0.35);
          puff((i & 1 ? 1 : -1) * u * (0.22 + 0.2 * (i >> 1) * p) * (0.5 + p * 0.5), u * s * 0.5 - u * 0.05 - p * u * (0.06 + 0.05 * (i >> 1)), r, i * 2.3, i & 2 ? K.white : K.cream, 3 * k);
        }
        fall(a, t, { n: a.n(22), t0: 1.5, cols: [K.yellow, K.white, K.orange, K.pinkL], seed: 500 });
      }
      a.begin(S(t * 83) * shake * 9 * k, h * 0.02 + C(t * 97) * shake * 7 * k, s * pop(t, 0.02, 0.3), 0.09 * wob(q, 2.2, 3.4), 1 - 0.05 * wind + 0.16 * jolt, 1 + 0.1 * wind - 0.22 * jolt);
      glyph(g, k, { color: q > 0 && q < 0.09 ? K.white : K.red, parts: [{ px: 8.5, py: 8.5, dy: barDy }, { px: 8.5, py: 91.5, dx: dotDx, dy: dotDy }] });
      fuse(g, k, t, barDy, a.ak);
      a.end();
      const dizzy = seg(q, 0.55, 0.75) * (1 - seg(t, 2.1, 2.35));    // seeing stars
      for (let i = 0; i < 5 && dizzy > 0; i++) {
        const an = t * 5 + i * TAU / 5, x = C(an) * u * 0.2, y = h * 0.02 - u * s * 0.55 + S(an) * u * 0.045, r = u * 0.05 * dizzy;
        star(x, y, r * 1.3, 5, r * 0.6, an, K.ink); star(x, y, r, 5, r * 0.45, an, K.white);
      }
    },
  },

  /* ?: a magician's hat on a curtained stage; the ? shoots out spinning, with cards, doves and scarves, and a ta-da */
  '?': {
    color: K.yellow, bg: K.magenta, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a, L = magicLayout(a), fy = L.hb + u * 0.05, top = -a.bh / 2, bot = a.bh / 2, c = raw();
      bits([K.white, K.yellowL], a.n(16), i => addStar((a.r(i, 1) - 0.5) * w * 0.95, (a.r(i, 2) - 0.7) * h * 0.8, u * 0.05 * (0.55 + 0.45 * S(t * 3 + i * 2)), u * 0.012, 4, 0));
      const ta = E.outBack(seg(t, 1.05, 1.55));                     // the ta-da sunburst
      if (ta > 0) rays(0, L.hov, 18, Math.hypot(w, h) * 0.62 * ta, t * 0.35, K.magentaL, 0.5);
      box(0, (fy + bot) / 2, a.bw, bot - fy, K.orange);              // the stage floor, its boards running toward the audience
      c.strokeStyle = K.orangeD; c.lineWidth = 0.02 * u; c.lineCap = 'round'; c.beginPath();
      for (let i = -6; i <= 6; i++) { c.moveTo(i * u * 0.28, fy + 0.03 * u); c.lineTo(i * u * 0.72, bot); }
      c.stroke();
      box(0, fy, a.bw, 0.024 * u, K.orangeD);
      const sw = S(t * 1.3) * w * 0.03;                              // the spotlight
      alpha(0.2 * seg(t, 0.05, 0.5));
      poly([sw - u * 0.06, top, sw + u * 0.06, top, sw * 0.4 + u * 0.62, fy + 0.02 * u, sw * 0.4 - u * 0.62, fy + 0.02 * u], K.white);
      oval(sw * 0.4, fy + u * 0.05, u * 0.66, u * 0.1, K.white);
      alpha(1);
      const open = E.outBack(seg(t, 0, 0.55)), tie = h * 0.02, xin = y => w * (0.09 + 0.29 * open) + w * 0.06 * Math.exp(-(((y - tie) / (h * 0.14)) ** 2)) + S(y / (u * 0.4) + t * 1.6) * w * 0.006;
      for (const sd of [-1, 1]) {                                    // the curtains sweep open, tied back
        c.fillStyle = K.indigo; c.beginPath(); c.moveTo(sd * a.bw / 2, top);
        for (let i = 0; i <= 12; i++) { const y = top + (fy - top) * i / 12; c.lineTo(sd * xin(y), y); }
        c.lineTo(sd * a.bw / 2, fy); c.closePath(); c.fill();
      }
      c.strokeStyle = K.indigoD; c.lineWidth = 0.04 * w; c.lineCap = 'butt'; c.beginPath();
      for (const sd of [-1, 1]) for (let f = 1; f <= 3; f++) for (let i = 0; i <= 12; i++) { const y = top + (fy - top) * i / 12, x = sd * (xin(y) + w * 0.075 * f); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
      for (const sd of [-1, 1]) line(sd * (xin(tie) - 0.01 * w), tie, sd * (xin(tie) + 0.2 * w), tie - h * 0.03, 0.03 * u, K.yellow);
      const vy = -h * 0.4;                                           // the valance, scalloped, with gold trim
      box(0, (top + vy) / 2, a.bw, vy - top, K.indigo);
      c.fillStyle = K.indigo; c.beginPath();
      for (let i = -14; i <= 14; i++) addDisc(i * w * 0.075, vy, w * 0.045);
      c.fill();
      box(0, vy - 0.008 * h, a.bw, 0.016 * h, K.yellow);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, { s, hb, ty, hov } = magicLayout(a), ch = hb - ty, hp = pop(t, 0, 0.22), sq = 1 - 0.2 * wob(t - 0.03, 2.6, 5), ix = 0, iy = ty + u * 0.02;
      for (let i = 0; i < 4; i++) {                                  // scarves streaming out of the hat
        const gr = E.out(seg(t, 0.4 + i * 0.09, 1.0 + i * 0.09)), dir = (i - 1.5) * 0.7, len = u * (i === 1 || i === 2 ? 0.78 : 0.95), pts = [];
        for (let j = 0; j <= 9; j++) { const f = j / 9 * gr, off = S(f * 7 - t * 8 + i * 1.7) * u * 0.05 * f; pts.push(ix + S(dir) * len * f + C(dir) * off, iy - C(dir) * len * f + S(dir) * off); }
        if (gr > 0.02) scarf(pts, u * 0.035, u * 0.085, SCARF[i], 3 * k);
      }
      for (let i = 0; i < 6; i++) {                                  // cards flick out and hang in fans either side of the ?
        const p = seg(t, 0.3 + i * 0.07, 0.95 + i * 0.07), f = E.outBack(p), cd = CARDS[i], sd = i < 3 ? -1 : 1;
        if (p > 0) card(lerp(ix, Math.sign(cd[0]) * Math.min(Math.abs(cd[0]) * u, w * 0.43), f), lerp(iy, hov + cd[1] * u, f), u * (0.75 + 0.25 * f), cd[2] * f + sd * (1 - E.out(p)) * 4 + 0.06 * S(t * 3 + i) * p, i, k);
      }
      for (let i = 0; i < 4; i++) {                                  // doves take off
        const p = seg(t, 0.55 + i * 0.25, 1.95 + i * 0.25), sd = i & 1 ? 1 : -1;
        if (p <= 0 || p >= 1) continue;
        const f = E.out2(p), x = ix + sd * w * (0.06 + 0.5 * f) * (1 - 0.25 * (i >> 1)), y = iy - h * (0.08 + 0.36 * f) * (0.8 + 0.3 * (i >> 1)) - S(f * PI * 3 + i) * u * 0.05;
        dove(x, y, u * 0.075 * (0.6 + 0.4 * E.out(sat(p * 4))), 0.5 + 0.5 * S(t * 30 + i), sd, k);
      }
      spray(a, t, { x: ix, y: iy, n: a.n(18), t0: 0.08, life: 1.2, a0: -PI * 0.95, a1: -PI * 0.05, v0: u * 0.8, v1: u * 2.0, g: 700, s0: 8, s1: 20, seed: 12, shape: 'spark', cols: [K.white, K.yellow, K.pinkL, K.skyL] });
      fall(a, t, { n: a.n(12), t0: 0.6, shape: 'spark', cols: [K.white, K.yellow], vy0: 50, vy1: 140, s0: 6, s1: 14, seed: 88 });
      oval(0, hb + u * 0.075, u * 0.46 * hp, u * 0.075 * hp, K.orangeD);
      hat(u, k, hb, ch, hp, sq, false);
      const up = seg(t, 0.05, 0.75), rise = (E.out(up) + E.outBack(up)) / 2, yc = lerp(ty + 44 * k * s, hov, rise), spin = 2 * TAU * E.out(seg(t, 0.05, 1.05)) + TAU * E.io(seg(t, 1.55, 2.15)), stretch = 0.2 * S(PI * seg(t, 0.05, 0.5));
      const hero = () => {
        a.begin(S(t * 2.1) * u * 0.02 * seg(t, 0.8, 1.2), yc - Math.abs(S(t * 2.6)) * u * 0.012 * seg(t, 0.8, 1.0), s, 0.06 * S(t * 3.7) * seg(t, 0.7, 1.0), C(spin) * (1 - 0.1 * stretch), 1 + stretch);
        glyph(g, k, { color: K.yellow });
        a.end();
      }, low = a.land > 0.02, c = raw();
      if (!low) { c.save(); c.beginPath(); c.rect(-a.bw, -a.bh, a.bw * 2, a.bh + hb); c.clip(); hero(); c.restore(); }      // nothing of the ? shows below the hat's rim while it comes out
      hat(u, k, hb, ch, hp, sq, true);
      for (let i = 0; i < 3; i++) {                                  // a poof of smoke as the wand taps
        const p = seg(t, 0.08 + i * 0.04, 0.7);
        if (p > 0 && p < 1) puff(ix + (i - 1) * u * 0.17 * E.out(p), iy - u * 0.04 - E.out(p) * u * (0.1 + 0.07 * (i & 1)), u * (0.06 + 0.02 * i) * S(PI * Math.min(1, p * 1.4)), i * 2.1, POOF[i], 3 * k);
      }
      if (t > 1.05) {                                                // ta-da
        pulse(0, hov, t, 1.05, 0.5, u * 0.8, u * 0.05, K.white);
        pulse(0, hov, t, 1.13, 0.55, u * 1.1, u * 0.03, K.yellow);
        spray(a, t, { x: 0, y: hov, n: a.n(22), t0: 1.05, life: 1.2, v0: u * 0.9, v1: u * 2.2, g: 800, s0: 9, s1: 22, seed: 33, shape: 'star', cols: [K.yellow, K.white, K.pinkL, K.sky, K.lime] });
      }
      const wp = seg(t, 0, 0.12), wa = seg(t, 0.12, 0.4), wo = seg(t, 0.4, 0.9);      // the wand taps the hat, flicks up, and leaves
      if (wo < 1) {
        const tx = u * 0.14 + u * 0.7 * E.in(wo), tipY = iy - u * 0.02 - u * 0.3 * (1 - E.in(wp)) - u * 0.35 * E.out(wa) - u * 0.4 * E.in(wo);
        wand(tx, tipY, u * 0.55, -0.9 + 0.5 * wob(t - 0.1, 3, 5), u, k);
        if (t > 0.09 && t < 0.4) spark(tx, tipY, u * 0.12 * S(PI * seg(t, 0.09, 0.4)), t * 8, K.white);
      }
      if (low) hero();                                               // (on its way down to the text it flies in front of everything)
    },
  },

  /* .: a huge ball bounces four times; every landing throws a ring and paints a big coloured circle on the backdrop; then it shrinks to the period */
  '.': {
    color: K.red, bg: K.yellow, dur: 2.8,
    back(a, t) {
      const { u, w, h } = a, G = h * 0.2;
      for (let i = 0; i < 4; i++) {                                 // the paint, blooming where each landing was
        const r = u * DISC[i] * pop(t, BT[i], 0.45) * (1 + 0.02 * S(t * 4 + i)), x = BXF[i] * w, y = G - u * DISC[i] * 0.35;
        disc(x, y, r, PAINT[i]); disc(x, y, r * 0.66 * pop(t, BT[i] + 0.07, 0.45), PAINT_L[i]); disc(x, y, r * 0.34 * pop(t, BT[i] + 0.14, 0.45), PAINT[i]);
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, G = h * 0.2, ak = a.ak, R = (12.7 + 26 * ak) * k;
      for (let i = 0; i < 4; i++) {
        groundRing(BXF[i] * w, G, t, BT[i], 0.55, u * 1.0, u * 0.08, PAINT[i]);
        groundRing(BXF[i] * w, G, t, BT[i] + 0.06, 0.5, u * 0.7, u * 0.03, K.ink);
        spray(a, t, { x: BXF[i] * w, y: G - R * 0.3, n: a.n(12), t0: BT[i], life: 1.0, a0: -PI * 0.92, a1: -PI * 0.08, v0: u * 0.8, v1: u * 2.0, g: 1300, s0: 7, s1: 16, seed: 60 + i * 20, shape: 'dot', cols: [PAINT[i], PAINT_L[i]] });
      }
      bits([K.ink], 44, i => {                                      // dotted trails of the hops so far
        const n = 1 + (i / 11 | 0), tt = BT[n - 1] + ((i % 11) + 0.5) / 11 * (BT[n] - BT[n - 1]);
        if (tt < t - 0.04) { ballAt(tt, w, h); addDisc(BALL[0], G - BALL[1] - R * 0.15, u * 0.012); }
      });
      ballAt(t, w, h);
      const bx = BALL[0], sq = BALL[2], st = BALL[3], sy = 1 + 0.16 * st - 0.34 * sq, sx = 1 - 0.07 * st + 0.3 * sq, hn = BALL[1] / (h * 0.26), by = G - R * sy - BALL[1];
      oval(bx, G + R * 0.22, R * (1.05 - 0.5 * hn) * (0.8 + 0.4 * sx), R * 0.2 * (1 - 0.4 * hn), K.yellowD);
      if (st > 0.3 && ak > 0.5) for (let i = -1; i <= 1; i++) line(bx + i * R * 0.55, by + BALL[4] * R * (1.1 + 0.1 * (i & 1)), bx + i * R * 0.55, by + BALL[4] * R * (1.1 + 1.0 * st), u * 0.014, K.ink);
      a.begin(bx, by - 41.5 * k * sy, pop(t, 0.02, 0.28), 0, sx, sy);
      glyph(g, k, { color: K.red, sw: 17 + 52 * ak });                // the real dot, fattened into the ball
      if (ak > 0.03) { arcS(0, 41.5 * k, R * 0.66, PI * 1.12, PI * 1.5, 8 * k * ak, K.white); disc(-R * 0.52, 41.5 * k - R * 0.5, 4.5 * k * ak, K.white); }
      a.end();
      fall(a, t, { n: a.n(14), t0: 1.0, shape: 'dot', cols: PAINT, vy0: 100, vy1: 240, s0: 8, s1: 16, seed: 700 });
    },
  },

  /* ,: a comet with a rainbow tail swoops in from a corner in a big curve, loops, and settles as the comma */
  ',': {
    color: K.orange, bg: K.blueD, dur: 2.8,
    back(a, t) {
      const { u, w, h } = a, R = Math.hypot(a.bw, a.bh) / 2;
      spiral(0, 0, 0, R, 5, t * 0.25, u * 0.1, K.blue);              // a slow galaxy swirl
      bits([K.white, K.yellowL], a.n(30), i => { const r = u * (0.02 + 0.03 * a.r(i, 3)) * (0.6 + 0.4 * S(t * 3 + i * 2.3)); addStar((a.r(i, 1) - 0.5) * w * 1.3, (a.r(i, 2) - 0.5) * h * 1.15, r, r * 0.28, 4, 0); });
      const pr = u * 0.17 * pop(t, 0.1, 0.5);                       // a ringed planet, and a moon
      disc(w * 0.36, -h * 0.28, pr, K.pink); oval(w * 0.36, -h * 0.28, pr * 1.75, pr * 0.42, K.pinkL, -0.4); disc(w * 0.36, -h * 0.28 + pr * 0.15, pr * 0.72, K.pink);
      disc(-w * 0.4, h * 0.22, u * 0.07 * pop(t, 0.2, 0.5), K.yellowL);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 0.8, ks = k * s, ak = a.ak, grow = E.out(seg(t, 0.02, 0.4)), NT = 48, dt = 0.0225;
      for (let j = 0; j < NT; j++) { cometAt(t - j * dt, w, h); TRX[j] = CM[0]; TRY[j] = CM[1]; }
      cometAt(t, w, h);
      const hx = CM[0], hy = CM[1], dx = TRX[6] - hx, dy = TRY[6] - hy, wt = sat(Math.hypot(dx, dy) / (u * 0.06)), ha = Math.atan2(dy, dx), hb = CM[2] + PI;
      const back = Math.atan2(wt * S(ha) + (1 - wt) * S(hb), wt * C(ha) + (1 - wt) * C(hb));      // the way the tail streams: toward where it has just been
      const an = back - 1.993, rot = Math.atan2(S(an), C(an)) * (1 - E.io(seg(t, 1.75, 2.1)));    // (the comma's tail points 114 degrees round)
      ribbon(NT, 24 * ks * grow * ak, t, RAINBOW);
      bits([K.white, K.yellow, K.pinkL, K.skyL], a.n(28), i => {      // sparkle dust drifting off the tail
        const j = (i * 7 + 3) % (NT - 4) + 1, hw = u * 0.09 * (1 - j / NT) + u * 0.02, r = u * 0.022 * (0.6 + 0.4 * S(t * 9 + i)) * (1 - j / NT * 0.5);
        addStar(TRX[j] + (a.r(i, 1) - 0.5) * hw * 3, TRY[j] + (a.r(i, 2) - 0.5) * hw * 3, r * grow, r * 0.28 * grow, 4, t * 2 + i);
      });
      bits([K.white, K.yellow, K.pinkL], 15, i => {                  // stars left behind along the path
        const t0 = 0.12 + i * 0.12, age = (t - t0) / 0.9;
        if (age <= 0 || age >= 1) return;
        cometAt(t0, w, h);
        const r = u * 0.075 * S(PI * age) * (0.7 + 0.3 * a.r(i, 4));
        addStar(CM[0] + (a.r(i, 1) - 0.5) * u * 0.25, CM[1] + (a.r(i, 2) - 0.5) * u * 0.25 + age * u * 0.15, r, r * 0.3, 4, age * 3 + i);
      });
      const m = 1 + 1.6 * ak, co = C(rot), si = S(rot), ox = 2.5 * ks, oy = 34 * ks;
      spark(hx, hy, u * 0.55 * grow * ak * (0.8 + 0.2 * S(t * 8)), t * 0.7, K.white);
      disc(hx, hy, 42 * ks * (1 + 0.04 * S(t * 12)) * grow * ak, K.yellowL);
      a.begin(hx - (ox * co - oy * si), hy - (ox * si + oy * co), s * pop(t, 0.02, 0.3), rot, 1, 1);      // the comma's dot rides the path: a fat head, its tail stretched out behind
      glyphW(g, k, [17 + 2 * ak, 17 + 46 * ak], { color: K.orange, fn: (x, y) => { P.x = 14 + (x - 14) * m; P.y = 84 + (y - 84) * m; } });
      a.end();
    },
  },

  /* ': the tick glints as a big four-point star; stars pop in on a wave across a dusk sky, with shooting stars, a moon, glitter and a swirl of fairy dust */
  "'": {
    color: K.yellow, bg: K.magentaD, dur: 2.8,
    back(a, t) {
      const { u, w, h } = a, bw = a.bw;
      for (let i = 0; i < 4; i++) disc(0, h * 0.36, u * (1.5 - i * 0.28) * (1 + 0.012 * S(t * 2 + i)) * pop(t, 0.02 + i * 0.07, 0.6), DUSK[i]);       // the sunset glow, band by band
      band(-bw / 2, bw / 2, h * 0.3, h * 0.03, w * 0.8, 1.2 + t * 0.05, K.indigoD, a.bh);
      band(-bw / 2, bw / 2, h * 0.37, h * 0.025, w * 0.5, 3.4, K.indigo, a.bh);
      const mp = pop(t, 0.3, 0.5);                                   // the crescent moon, rocking a little
      crescent(-w * 0.33, -h * 0.27, u * 0.27 * mp, -0.5 + 0.08 * S(t * 2) - 1.5 * (1 - mp), K.yellowL, 0.7);
      spiral(0, -h * 0.03, u * 0.06, u * 0.95, 2.2, t * 1.3, u * 0.02, K.pinkL);
      spiral(0, -h * 0.03, u * 0.06, u * 0.95, 2.2, t * 1.3 + PI, u * 0.02, K.magentaL);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, ak = a.ak, s = 1.7, cy = -h * 0.05;
      bits([K.white, K.yellow, K.pinkL, K.skyL], a.n(40), i => {       // stars of every size, popping in as a wave sweeps from left to right
        const x = (a.r(i, 1) - 0.5) * w * 0.98, y = -h * 0.5 + a.r(i, 2) * h * 0.74, p = pop(t, 0.06 + (x / w + 0.5) + a.r(i, 5) * 0.15, 0.35);
        if (p <= 0) return;
        const r = u * (0.014 + 0.07 * a.r(i, 3) ** 2) * p * (0.8 + 0.2 * S(t * (3 + a.r(i, 6) * 3) + i * 1.9));
        addStar(x, y, r, r * (i & 1 ? 0.24 : 0.42), i & 1 ? 4 : 5, a.r(i, 4) * TAU + t * 0.4);
      });
      for (let i = 0; i < 3; i++) {                                  // shooting stars
        const p = seg(t, 0.45 + i * 0.6, 1.0 + i * 0.6), sd = i & 1 ? -1 : 1;
        if (p <= 0 || p >= 1) continue;
        const x0 = -sd * w * 0.5, y0 = -h * (0.42 - i * 0.06), x1 = sd * w * 0.36, y1 = y0 + h * 0.3, e = E.io(p);
        shooter(lerp(x0, x1, e), lerp(y0, y1, e), Math.atan2(y1 - y0, x1 - x0), u * 0.9 * S(PI * p), u * 0.07, t);
      }
      fall(a, t, { n: a.n(26), t0: 0.5, shape: 'spark', cols: [K.yellow, K.white, K.pinkL, K.skyL], vy0: 50, vy1: 150, s0: 6, s1: 16, sway: 40, seed: 130 });
      bits([K.pinkL, K.yellow, K.white, K.skyL], a.n(36), i => {       // fairy dust spiralling out of the star
        const f = ((i / 36 + t * 0.32) % 1 + 1) % 1, an = (i % 3) * TAU / 3 + f * TAU * 1.1 - t * 1.3, r = u * (0.08 + 0.9 * f), sz = u * 0.03 * S(PI * f) * (0.6 + 0.6 * a.r(i, 3));
        if (t > 0.35) addDisc(C(an) * r, cy + S(an) * r * 0.9, sz);
      });
      const gl = E.outBack(seg(t, 0.02, 0.5)) * ak, fl = 0.85 + 0.15 * S(t * 6) + 0.35 * (wob(t - 0.02, 2, 3) + 0.6 * wob(t - 1.05, 3, 4) + 0.6 * wob(t - 1.75, 3, 4));
      glint(0, cy, u * 0.6 * gl * fl, u * 0.95 * gl * fl, 0.06 * S(t * 2), K.white);       // the tick is the spine of a big sparkle
      glint(0, cy, u * 0.62 * gl * (1.1 - 0.2 * fl), u * 0.62 * gl * (1.1 - 0.2 * fl), PI / 4 + 0.06 * S(t * 2), K.skyL);
      disc(0, cy, u * 0.15 * gl, K.yellowL);
      a.begin(0, cy + 30.75 * k * s, s * pop(t, 0.02, 0.3), 0.08 * S(t * 4), 1 + 0.05 * S(t * 11), 1 - 0.05 * S(t * 11));
      glyph(g, k, { color: K.yellow });
      const gf = Math.max(0, S(t * 5.5 + 1)) * ak;                     // and a glint slides across its face
      glint(-4 * k, -29 * k, 20 * k * gf, 20 * k * gf, 0, K.white);
      a.end();
    },
  },

  /* ": speech bubbles of every colour pop in round the quote marks and jabber, pile up, then all pop; the ticks nod along */
  '"': {
    color: K.yellow, bg: K.green, dur: 2.8,
    back(a, t) {
      const { u, w, h } = a, R = Math.hypot(w, h) / 2;
      for (let j = 0; j < 3; j++) ring(0, -h * 0.05, ((t * 0.45 + j / 3) % 1) * R * 1.1, u * 0.03, K.greenM);               // ripples of chatter
      for (let i = 0; i < 4; i++) {                                  // huge pale bubbles behind everything
        const B = BIG[i], p = pop(t, 0.05 + i * 0.1, 0.5), x = B[0] * w, y = B[1] * h, bw = u * B[2] * p, bh = bw * 0.68;
        if (p <= 0) continue;
        poly([x - B[4] * bw * 0.28, y + bh * 0.4, x - B[4] * bw * 0.06, y + bh * 0.4, x - B[4] * bw * 0.36, y + bh * 0.8], B[5]);
        box(x, y, bw, bh, B[5], B[3] + 0.04 * S(t * 1.5 + i), bh * 0.4);
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, s = 1.6, cy = -h * 0.06, c = raw(), nb = Math.min(11, a.n(11));
      for (let i = 0; i < nb; i++) {
        const B = CHAT[i], bx = B[0] * w, by = cy + B[1] * h, bh = u * B[2] * 0.62, t0 = 0.12 + i * 0.1, tp = 1.95 + i * 0.025;
        const p = pop(t, t0, 0.35), sc = t < tp ? p * (1 + 0.05 * S(t * 9 + i * 1.7)) : 1 + 0.5 * seg(t, tp, tp + 0.1);
        if (p <= 0 || t > tp + 0.1) continue;
        c.save(); c.translate(bx, by); c.scale(sc, sc); c.translate(-bx, -by);
        bubble(bx, by, bh * 1.5, bh, B[3] + 0.07 * S(t * 6 + i * 1.7), -bx, cy - by, BCOL[i], Math.floor(t * 2.4 + i * 1.3) % 5, t, k);
        c.restore();
      }
      bits(BCOL, nb * 5, i => {                                      // the pops: bits of bubble flying off
        const j = i / 5 | 0, B = CHAT[j], age = seg(t, 1.95 + j * 0.025, 2.45 + j * 0.025);
        if (age <= 0 || age >= 1) return;
        const an = (i % 5) * TAU / 5 + j, r = u * B[2] * 0.4 + E.out(age) * u * 0.32;
        addDisc(B[0] * w + C(an) * r, cy + B[1] * h + S(an) * r * 0.75, u * 0.024 * (1 - age));
      });
      const talk = seg(t, 0.3, 0.6) * (1 - seg(t, 2.05, 2.3)), nod = i => 0.26 * S(t * 7.5 + i * 0.8) * talk, bob = i => 5 * S(t * 7.5 + i * 0.8 + 1.2) * talk;
      a.begin(0, cy + 30.75 * k * s, s * pop(t, 0.02, 0.3), 0, 1, 1);
      glyph(g, k, { color: K.yellow, parts: [{ px: 8.5, py: 8.5, r: nod(0), dy: bob(0) }, { px: 31.5, py: 8.5, r: nod(1), dy: bob(1) }] });
      a.end();
      spray(a, t, { x: 0, y: cy, n: a.n(20), t0: 1.95, life: 1.0, v0: u * 0.8, v1: u * 2.0, g: 900, seed: 140, cols: [K.white, K.pink, K.yellow, K.sky, K.orange] });
    },
  },

  /* -: a caterpillar whose spine is the hyphen itself inches across in a wave of squeezes, rears up to eat a leaf, then straightens out and shrinks into the dash */
  '-': {
    color: K.lime, bg: K.pink, dur: 2.9,
    back(a, t) {
      const { u, k, w, h } = a, G = h * 0.2, bw = a.bw, d = u * 0.24, c = raw();
      c.fillStyle = K.pinkL; c.beginPath();                          // polka dots, drifting
      for (let j = -5; j <= 4; j++) for (let i = -7; i <= 7; i++) addDisc((i + (j & 1) * 0.5) * d + (t * u * 0.05) % d, j * d * 0.87, d * 0.2);
      c.fill();
      band(-bw / 2, bw / 2, G + h * 0.03, h * 0.014, w * 0.3, 0.5, K.limeD, a.bh);
      band(-bw / 2, bw / 2, G + h * 0.055, h * 0.012, w * 0.22, 2.1, K.green, a.bh);
      band(-bw / 2, bw / 2, G + h * 0.2, h * 0.015, w * 0.4, 4.0, K.greenD, a.bh);
      for (let i = 0; i < 7; i++) {                                  // flowers springing up along the grass
        const F = FLOWERS[i], p = pop(t, 0.15 + i * 0.14, 0.45), x = F[0] * w, top = G + h * 0.03 - h * F[1] * p, sw = S(t * 2.2 + i) * 4 * k;
        if (p <= 0) continue;
        line(x, G + h * 0.05, x + sw, top, 5 * k, K.greenD);
        leaf(x + sw * 0.4 + 9 * k, (top + G) / 2 + 4 * k, 9 * k * p, 1.1 + i, K.greenD);
        flower(x + sw, top, u * F[2] * p, t * (i & 1 ? 0.6 : -0.6) + i, 6, FCOL[i][0], FCOL[i][1]);
      }
    },
    draw(a, t) {
      const { u, k, w, h } = a, ak = a.ak, G = h * 0.2, NB = w > h ? 9 : 7, L = (NB - 1) * 15, ks = Math.min(1.25 * k, (w > h ? 0.6 : 0.8) * w / (L + 30)), s = ks / k;
      const mv = E.io(seg(t, 0.1, 1.2)), amp = (1 - seg(t, 1.8, 2.05)) * (1 - 0.6 * seg(t, 1.15, 1.3)), rear = E.io(seg(t, 1.05, 1.3)) * (1 - E.io(seg(t, 1.85, 2.05)));
      const x0 = lerp(-w * 0.2, 0, mv), y0 = G - 20.5 * ks, eat = seg(t, 1.25, 1.85) * 4, bites = eat >= 4 ? 4 : Math.floor(eat) + E.out(sat((eat - Math.floor(eat)) * 3));
      caterpillar(NB, t, amp * ak, rear * ak, ak);
      const hx = x0 + gx(CAT, ks, BEADX[NB - 1]), hy = y0 + gy(ks, BEADY[NB - 1]), lx = x0 + (L / 2 + 34) * ks, ls = u * 0.25 * (1 - 0.2 * bites) * pop(t, 0.3, 0.5);
      if (ls > 1) { line(lx + ls * 0.2, G + h * 0.05, lx, y0 - 26 * ks, 8 * k, K.greenD); leaf(lx, y0 - 30 * ks, ls, 1.15, K.limeL, K.green); }      // the leaf, eaten in four bites
      for (let i = 0; i < 4; i++) {                                  // crumbs from every bite
        spray(a, t, { x: hx + 12 * ks, y: hy + 8 * ks, n: a.n(6), t0: 1.3 + i * 0.15, life: 0.55, a0: -PI * 0.9, a1: -PI * 0.1, v0: u * 0.3, v1: u * 0.9, g: 900, s0: 5, s1: 11, seed: 150 + i * 10, shape: 'tri', cols: [K.lime, K.green] });
      }
      const c = raw(), grow = pop(t, 0.02, 0.3), fat = 1 + 0.035 * bites;
      if (ak > 0.04) {                                               // legs, then the beads from tail to head
        c.strokeStyle = K.ink; c.lineWidth = 3.4 * ks * ak * grow; c.lineCap = 'round'; c.beginPath();
        for (let j = 0; j < NB; j++) { const bx = x0 + gx(CAT, ks, BEADX[j]), by = y0 + gy(ks, BEADY[j]); c.moveTo(bx, by + 8 * ks * ak); c.lineTo(bx + 1.5 * ks * S(t * 9 + j * 1.3) * amp, lerp(by, y0 + 20.5 * ks, ak * grow)); }
        c.stroke();
      }
      a.begin(x0, y0, s * grow, 0, 1, 1);                            // the spine: the real glyph, stretched along the beads
      glyph(CAT, k, { color: K.lime, fn: (x, y) => { const f = clamp((x - 8.5) / 27, 0, 1) * (NB - 1), i = Math.min(NB - 2, f | 0), q = f - i; P.x = lerp(BEADX[i], BEADX[i + 1], q); P.y = lerp(BEADY[i], BEADY[i + 1], q) + (y - 50); } });
      a.end();
      for (let j = 0; j < NB; j++) {
        const head = j === NB - 1, r = (head ? 16.5 : 13.5) * ks * ak * fat * pop(t, 0.02 + j * 0.012, 0.3), bx = x0 + gx(CAT, ks, BEADX[j]), by = y0 + gy(ks, BEADY[j]);
        discO(bx, by, r, head ? K.green : BEAD[j % 4], 3 * k * sat(r / (6 * ks)));
        if (!head) disc(bx - r * 0.3, by - r * 0.35, r * 0.2, BEAD_L[j % 4]);
      }
      face(hx, hy, 16.5 * ks * ak * fat * grow, ks * grow, t, eat);
      fall(a, t, { n: a.n(10), t0: 1.9, shape: 'dot', cols: [K.yellow, K.white, K.lime], vy0: 60, vy1: 160, s0: 6, s1: 12, seed: 900 });
    },
  },

  /* _: the underscore is a skateboard deck: it drops into a half-pipe, grinds a rail in a shower of sparks, kickflips, airs off the lip and rolls to a stop, with graffiti going up behind */
  '_': {
    color: K.sky, bg: K.orange, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a, bw = a.bw, c = raw(), d = u * 0.3;
      rays(0, -h * 0.12, 22, Math.hypot(a.bw, a.bh) / 2, t * 0.12, K.orangeM, 0.5);
      c.fillStyle = K.yellowL; c.strokeStyle = K.orangeD; c.lineWidth = 0.024 * u; c.lineJoin = 'round'; c.beginPath();        // the half-pipe: a big U with a platform each side
      c.moveTo(-bw / 2, a.bh / 2);
      for (let i = 0; i <= 60; i++) { const x = -bw / 2 + bw * i / 60; c.lineTo(x, surf(x, w, h)); }
      c.lineTo(bw / 2, a.bh / 2); c.closePath(); c.fill(); c.stroke();
      c.save(); c.translate(0, h * 0.05); c.strokeStyle = K.yellow; c.lineWidth = 0.012 * u; c.stroke(); c.restore();
      c.fillStyle = K.yellow; c.beginPath();                         // polka dots on the concrete
      for (let j = 0; j < 14; j++) for (let i = -9; i <= 9; i++) { const x = (i + (j & 1) * 0.5) * d, y = -h * 0.5 + j * d * 0.87; if (Math.abs(x) < a.bw / 2 && y > surf(x, w, h) + h * 0.05) addDisc(x, y, d * 0.16); }
      c.fill();
      for (let i = 0; i < 3; i++) {                                  // graffiti splats, each with drips
        const p = pop(t, SPL[i][3], 0.4), x = SPL[i][0] * w, y = SPL[i][1] * h, r = u * SPL[i][2] * p, col = SPL_COL[i];
        if (p <= 0) continue;
        blob(x, y, r, i, 0.12, t * 0.5, col);
        for (let j = 0; j < 6; j++) { const an = j * 1.05 + i, rr = r * (1.35 + 0.35 * ((j * 7 + i) % 3)); disc(x + C(an) * rr, y + S(an) * rr, r * (0.09 + 0.05 * (j % 2)) * p, col); }
        for (let j = -1; j <= 1; j++) {
          const dl = r * (0.5 + 0.22 * ((j + 3 + i) % 3)) * E.out(seg(t, SPL[i][3] + 0.2, SPL[i][3] + 0.8));
          line(x + j * r * 0.45, y + r * 0.5, x + j * r * 0.45, y + r * 0.5 + dl, r * 0.16, col); disc(x + j * r * 0.45, y + r * 0.5 + dl, r * 0.11, col);
        }
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, ak = a.ak, G = h * 0.22, ks = Math.min(1.5 * k, 0.42 * w / 64), ry = G - h * 0.1, r0 = -w * 0.06, r1 = w * 0.16;
      skate(t, w, h, ks);
      const cx = SK[0], cy = SK[1], rot = SK[2], fl = SK[3], vx = SK[4], spd = Math.min(1, Math.abs(vx) / (w * 0.7)), col = fl >= 0 ? K.sky : K.magenta, off = 46 * ks * fl;
      if (spd > 0.3 && ak > 0.5) {                                    // speed lines
        const c = raw(), dir = Math.sign(vx); c.strokeStyle = K.white; c.lineWidth = u * 0.014; c.lineCap = 'round'; c.beginPath();
        for (let i = 0; i < 4; i++) { const yy = cy + (i - 1.5) * u * 0.08, xx = cx - dir * (u * 0.28 + (i & 1) * u * 0.1); c.moveTo(xx, yy); c.lineTo(xx - dir * u * 0.32 * spd, yy); }
        c.stroke();
      }
      a.begin(cx + S(rot) * off, cy - C(rot) * off, ks / k * pop(t, 0.02, 0.25), rot, 1, fl);
      if (ak > 0.03) { boxO(gx(g, k, -4), gy(k, 91), 12 * k * ak, 9 * k * ak, col, 0.55, 3.5 * k * ak, 2.4 * k); boxO(gx(g, k, 68), gy(k, 91), 12 * k * ak, 9 * k * ak, col, -0.55, 3.5 * k * ak, 2.4 * k); }       // the kicks
      glyph(g, k, { color: col, sh: 4.6 * k * (1 - 0.55 * ak) });     // the deck itself, then its trucks, wheels and graphic in front
      if (ak > 0.03) {
        const r = 9 * k * ak, wy = gy(k, 117), spin = SK[5] / (9 * ks) + t * 2, c = raw();
        for (const wx of [14, 50]) {
          box(gx(g, k, wx), gy(k, 108), 9 * k * ak, 9 * k * ak, K.ink);
          discO(gx(g, k, wx), wy, r, K.yellow, 2.6 * k * ak); disc(gx(g, k, wx), wy, r * 0.32, K.ink);
          c.strokeStyle = K.orange; c.lineWidth = 2.4 * k * ak; c.lineCap = 'round'; c.beginPath();
          for (let i = 0; i < 3; i++) { const an = spin + i * TAU / 3; c.moveTo(gx(g, k, wx), wy); c.lineTo(gx(g, k, wx) + C(an) * r * 0.78, wy + S(an) * r * 0.78); }
          c.stroke();
        }
        if (fl > 0) bolt(gx(g, k, 32), gy(k, 96), 7 * k * ak, 0.3, K.yellow);
      }
      a.end();
      for (const rx of [r0 + 0.02 * w, r1 - 0.02 * w]) { line(rx, ry, rx, G + 6, 0.022 * u + 6 * k, K.ink); line(rx, ry, rx, G + 6, 0.022 * u, K.white); }       // the rail, in front of the wheels
      line(r0, ry, r1, ry, 0.038 * u + 6 * k, K.ink); line(r0, ry, r1, ry, 0.038 * u, K.white);
      bits([K.yellow, K.white, K.orange], 24, i => {                  // grinding sparks, thrown back and up off the rail
        const te = 0.64 + i * 0.019, age = t - te;
        if (age <= 0 || age >= 0.45) return;
        skate(te, w, h, ks);
        const f = 0.5 + a.r(i, 1), r = u * 0.018 * (1 - age / 0.45);
        addStar(SK[5] - 42 * ks - u * 1.1 * f * age + (a.r(i, 2) - 0.5) * u * 0.08, ry - u * (1.2 * f * age - 2.6 * age * age), r * 1.6, r * 0.45, 4, i);
      });
      for (let i = 0; i < 2; i++) {                                   // the two landings on the wall
        const x = LAND[i][0] * w, y = surf(x, w, h);
        pulse(x, y, t, LAND[i][1], 0.4, u * 0.4, u * 0.05, K.white);
        spray(a, t, { x, y, n: a.n(14), t0: LAND[i][1], life: 0.9, a0: -PI * 0.95, a1: -PI * 0.05, v0: u * 0.7, v1: u * 1.8, g: 1200, seed: 160 + i * 10, cols: [K.pink, K.lime, K.white, K.purple, K.yellow] });
      }
    },
  },

  /* :: the two dots turn on their side and become huge googly eyes: they look around, narrow their eyes, blink, bulge, and finally turn to hearts, with brows for every mood */
  ':': {
    color: K.pink, bg: K.lime, dur: 2.9,
    back(a, t) { rays(0, -a.h * 0.05, 20, Math.hypot(a.bw, a.bh) / 2, t * 0.12, K.limeM, 0.5); },
    draw(a, t) {
      const { u, k, g, w, h } = a, ak = a.ak, s = Math.min(1.45, 0.8 * w / (94 * k)), ks = k * s, cy = -h * 0.02, D = 23 * ks, c = raw();
      const susp = E.io(seg(t, 0.35, 0.5)) * (1 - E.io(seg(t, 1.0, 1.1))), surp = E.outBack(seg(t, 1.2, 1.32)) * (1 - E.io(seg(t, 1.6, 1.75))), joy = E.io(seg(t, 1.7, 1.9)), hearts = E.outElastic(seg(t, 1.75, 2.2));
      const blink = S(PI * seg(t, 1.05, 1.2)), look = lookAt(t), jit = surp > 0.05 ? S(t * 70) * 3 * surp * k : 0, re = 24 * k * ak * (1 + 0.25 * surp);
      if (surp > 0.3 && surp < 1.1) spokes(0, cy, 18, u * 0.62, u * 0.35, 0.1, u * 0.02, K.ink, K.ink);
      a.begin(7 * ks + jit, cy, s * pop(t, 0.02, 0.3), PI / 2, 1, 1);
      const Rr = PI / 2 * (1 - a.land), sn = S(Rr), cs = C(Rr), ex0 = 16 * k * sn, ex1 = -30 * k * sn, ey0 = -16 * k * cs, ey1 = 30 * k * cs;     // where the dots are, seen upright
      c.save(); c.rotate(-Rr);                                        // (drawn upright: the eyeballs, then the real dots as pupils, then lids and brows)
      if (re > 1) { discO(ex0, ey0, re, K.white, 3.2 * k); discO(ex1, ey1, re, K.white, 3.2 * k); }
      c.restore();
      const lx = look[0] * (1 - 0.5 * surp), ly = look[1] * (1 - 0.5 * surp), gdx = lx * cs + ly * sn, gdy = -lx * sn + ly * cs;
      glyph(g, k, { color: K.pink, sw: lerp(17, 17 - 6 * surp - 7 * hearts, ak), sh: 4.6 * k * (1 - ak), parts: [{ px: 8.5, py: 34, dx: gdx, dy: gdy }, { px: 8.5, py: 80, dx: gdx, dy: gdy }] });
      c.save(); c.rotate(-Rr);
      const pr = (8.5 - 3 * surp) * k * ak;
      for (let i = 0; i < 2; i++) {
        const ex = i ? ex1 : ex0, ey = i ? ey1 : ey0, x = ex + lx * k, y = ey + ly * k;
        if (hearts > 0.02) { const hr = 15 * k * ak * hearts * (1 + 0.1 * S(t * 12)); heart(x, y, hr * 1.18, 0, K.ink); heart(x, y, hr, 0, K.red); }
        else disc(x - pr * 0.35, y - pr * 0.4, pr * 0.28, K.white);
        const cover = Math.max(0.36 * susp * (i ? 0.7 : 1), blink);
        if (cover > 0.02) lid(ex, ey, re, cover, k);
        if (joy > 0.05) oval(ex, ey + re * 1.02, re * 0.5 * joy, re * 0.26 * joy, K.pinkL);
        brow(ex, ey - re * lerp(1.3, 1.0, susp * (1 - i * 0.3)) - re * (0.2 * surp + 0.15 * joy), re, i ? 1 : -1, susp, surp, joy, k, i);
      }
      c.restore();
      a.end();
      for (let i = 0; i < 3; i++) {                                   // sweat drops flung off at the shock
        const p = seg(t, 1.22 + i * 0.07, 1.8 + i * 0.07);
        if (p > 0 && p < 1) drop(D * (1.6 + i * 0.5) * E.out(p) * (i === 1 ? -1 : 1), cy - D * 1.4 + D * (2.7 * p * p - 1.2 * p), u * 0.035 * (1 - p * 0.4), (i - 1) * 0.5, K.sky);
      }
      for (let i = 0; i < 7; i++) {                                   // hearts drifting up
        const p = seg(t, 1.85 + i * 0.09, 2.6 + i * 0.09);
        if (p > 0 && p < 1) heart((a.r(i, 1) - 0.5) * u * 1.3 + S(p * 6 + i) * u * 0.05, cy - D * 0.6 - E.out(p) * u * (0.4 + 0.5 * a.r(i, 2)), u * (0.03 + 0.04 * a.r(i, 3)) * S(PI * Math.min(1, p * 1.4)), 0.3 * S(p * 5 + i), i & 1 ? K.red : K.white);
      }
      bits([K.white, K.yellow], a.n(14), i => {
        const p = seg(t, 1.9 + i * 0.05, 2.5 + i * 0.05);
        if (p > 0 && p < 1) { const an = i * 2.4, r = u * (0.4 + 0.35 * a.r(i, 1)), z = u * 0.05 * S(PI * p); addStar(C(an) * r * 1.3, cy + S(an) * r * 0.8, z, z * 0.25, 4, t * 2 + i); }
      });
    },
  },

  /* ;: the semicolon is a big smiley's eyes: the dot stares while the comma swings up into a wink; tongue out, the face bounces, blows kisses and radiates happy lines */
  ';': {
    color: K.indigo, bg: K.purple, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a;
      rays(0, -h * 0.03, 22, Math.hypot(a.bw, a.bh) / 2, -t * 0.15, K.purpleM, 0.5);
      for (let i = 0; i < 5; i++) {                                  // big pale hearts floating up behind
        const p = ((t * 0.16 + i * 0.21) % 1 + 1) % 1;
        heart((a.r(i, 1) - 0.5) * w * 0.95, h * 0.5 - p * h * 1.05, u * (0.14 + 0.1 * a.r(i, 2)) * pop(t, 0.05 + i * 0.05, 0.4), 0.3 * S(t + i * 2), i & 1 ? K.purpleL : K.magentaM);
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, ak = a.ak, s = 1.2, ks = k * s, cy = -h * 0.03, c = raw();
      const on = t > 0.35 && t < 2.1 ? 1 : 0, q = on ? ((t - 0.35) / 0.6) % 1 : 0, hopH = 4 * q * (1 - q) * h * 0.06, gnd = Math.min(q, 1 - q) * 0.6, sq = on * 0.12 * Math.max(0, 1 - gnd / 0.09) ** 1.5;
      const wk = Math.min(1, E.io(seg(t, 0.4, 0.55)) * (1 - E.io(seg(t, 0.95, 1.1))) + E.io(seg(t, 1.45, 1.6))), lines = pop(t, 0.1, 0.4);
      spokes(0, cy - hopH, a.n(16), u * 0.5 * s * (1.06 + 0.06 * S(t * 8)) * lines, u * 0.16 * (0.7 + 0.3 * S(t * 8)) * lines, t * 0.3, u * 0.028, K.white, K.yellowL);
      a.begin(0, cy - hopH, s * pop(t, 0.02, 0.3), 0.05 * S(t * 3.3), 1 + sq, 1 - sq + 0.04 * (hopH / (h * 0.06)));
      if (ak > 0.03) {                                                // the face
        discO(0, 0, 50 * k * ak, K.yellow, 3.6 * k);
        oval(-32 * k * ak, 6 * k * ak, 10 * k * ak, 6 * k * ak, K.pink); oval(32 * k * ak, 6 * k * ak, 10 * k * ak, 6 * k * ak, K.pink);
        c.save(); c.translate(12 * k * ak, 26 * k * ak); c.rotate(0.18 * S(t * 9));       // the tongue, waggling
        boxO(0, 10 * k * ak, 15 * k * ak, 22 * k * ak, K.pink, 0, 7 * k * ak, 3 * k); line(0, 3 * k * ak, 0, 14 * k * ak, 2.2 * k, K.pinkD);
        c.restore();
        arcS(2 * k, -2 * k, 27 * k * ak, 0.1 * PI, 0.9 * PI, 5.5 * k * ak, K.ink);
        arcS(18 * k * ak, -20 * k * ak, 11 * k * ak, 1.15 * PI, 1.85 * PI, 3.8 * k * ak, K.ink);       // one cheeky eyebrow
      }
      glyphW(g, k, [17 + 5 * ak, lerp(17, 12, ak), lerp(17, lerp(22, 12, wk), ak)], {      // the eyes are the real glyph: the top dot stares, the comma swings up from a dangling drop into a winking arch
        color: K.indigo, sh: 4.6 * k * (1 - 0.6 * ak),
        fn: (x, y) => {
          if (y < 60) { P.x = x + 21 * ak; P.y = y + 6 * ak; return; }
          const vx = x - 14, vy = y - 76, an = -1.955 * wk, m = 1 + 0.25 * wk, cs = C(an), sn = S(an), rx = m * (vx * cs - vy * sn), ry = m * (vx * sn + vy * cs);
          P.x = lerp(x, lerp(-6.5, -21.4, wk) + rx, ak); P.y = lerp(y, lerp(40, 43, wk) + ry - 7 * wk * S(PI * clamp(rx / 29, 0, 1)), ak);
        },
      });
      if (ak > 0.03) disc(16 * k, -13 * k, 3.4 * k * ak, K.white);
      a.end();
      for (let i = 0; i < 7; i++) {                                  // kisses blown off to the right
        const p = seg(t, 0.75 + i * 0.2, 1.75 + i * 0.2);
        if (p <= 0 || p >= 1) continue;
        heart(8 * ks + u * (0.15 + 0.7 * p) + S(p * 7 + i) * u * 0.03, cy + 26 * ks - u * (0.95 * p - 0.25 * p * p) * (0.6 + 0.5 * a.r(i, 2)) - u * 0.05, u * 0.11 * (0.6 + 0.4 * a.r(i, 1)) * S(PI * p ** 0.7), 0.4 * S(p * 6 + i), KISS[i % 3]);
      }
      bits([K.white, K.yellow], a.n(12), i => {
        const p = seg(t, 1.0 + i * 0.07, 1.6 + i * 0.07);
        if (p > 0 && p < 1) { const an = i * 2.3, r = u * (0.62 + 0.25 * a.r(i, 1)), z = u * 0.05 * S(PI * p); addStar(C(an) * r * 1.2, cy + S(an) * r * 0.75, z, z * 0.25, 4, t * 2 + i); }
      });
    },
  },
};

/* ---------- shared helpers ---------- */

// n radial dashes from radius r0 out to r0 + r1, alternately in two colours (two strokes in all)
function spokes(x, y, n, r0, r1, rot, lw, col0, col1) {
  if (lw < 0.5) return;
  const c = raw(); c.lineCap = 'round';
  for (let par = 0; par < 2; par++) {
    c.strokeStyle = par ? col1 : col0; c.lineWidth = lw; c.beginPath();
    for (let i = par; i < n; i += 2) { const an = rot + i / n * TAU + hash(i, 4) * 0.1; c.moveTo(x + C(an) * r0, y + S(an) * r0); c.lineTo(x + C(an) * (r0 + r1), y + S(an) * (r0 + r1)); }
    c.stroke();
  }
}

// a polygon in a colour with a dark outline
function polyO(pts, col, ol) {
  const c = raw(); c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); c.lineJoin = 'round'; c.lineWidth = ol * 2; c.strokeStyle = K.ink; c.stroke(); c.fillStyle = col; c.fill();
}

// a glyph whose strokes each have their own weight (sws, in units): shadow, then outlines, then fills, so they still merge into one sticker
function glyphW(g, k, sws, o) {
  const c = raw(), un = HERO.un, ol = 4.2 * k, sh = o.sh ?? 4.6 * k, ps = sws.map((_, i) => gpath(g, k, { only: [i], fn: o.fn }));
  if (un !== 1) { c.save(); c.scale(1 / un, 1 / un); }                    // as the letter lands, the frame it's drawn in shrinks but the letter itself doesn't
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = K.ink;
  c.save(); c.translate(sh, sh * 1.1);
  for (let i = 0; i < ps.length; i++) { c.lineWidth = sws[i] * k + ol * 2; c.stroke(ps[i]); }
  c.restore();
  for (let i = 0; i < ps.length; i++) { c.lineWidth = sws[i] * k + ol * 2; c.stroke(ps[i]); }
  c.strokeStyle = o.color;
  for (let i = 0; i < ps.length; i++) { c.lineWidth = sws[i] * k; c.stroke(ps[i]); }
  if (un !== 1) c.restore();
}

// a shock ring lying on the ground: an ellipse that grows and thins from time t0
function groundRing(x, y, t, t0, dur, r1, lw, col) {
  const p = seg(t, t0, t0 + dur);
  if (p <= 0 || p >= 1) return;
  const c = raw(), r = r1 * E.out(p);
  c.strokeStyle = col; c.lineWidth = Math.max(1, lw * (1 - p)); c.beginPath(); c.ellipse(x, y, r, r * 0.3, 0, 0, TAU); c.stroke();
}

/* ---------- ! ---------- */

const BURST = [[K.red, 1, 15], [K.orange, 0.76, 13], [K.yellow, 0.53, 11]];     // the layers of the explosion: colour, size, spikes

// a ball's height above rest, thrown up at t = 0: the first hop lasts d seconds and reaches hgt; each later one is e times as high (and quicker)
function bounce(t, d, hgt, e) {
  if (t <= 0) return 0;
  let len = d, hh = hgt;
  for (let n = 0; n < 7; n++) { if (t < len) { const p = t / len; return hh * 4 * p * (1 - p); } t -= len; len *= Math.sqrt(e); hh *= e; }
  return 0;
}

// a jagged comic starburst: n spikes of uneven length, as one polygon
function blast(x, y, r, n, seed, rot, t, col) {
  if (r < 2) return;
  const c = raw(); c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 2 * n; i++) {
    const an = rot + (i + (hash(seed, i, 1) - 0.5) * 0.45) * PI / n;
    const rr = r * (i & 1 ? 0.5 + 0.12 * hash(seed, i, 3) : 0.72 + 0.28 * hash(seed, i, 2)) * (1 + 0.035 * S(t * 4 + i * 1.9));
    if (i) c.lineTo(x + C(an) * rr, y + S(an) * rr); else c.moveTo(x + C(an) * rr, y + S(an) * rr);
  }
  c.closePath(); c.fill();
}

// a cauliflower of smoke: a few overlapping discs with one outline round the lot
function puff(x, y, r, seed, col, ol) {
  if (r < 2) return;
  const c = raw();
  for (let pass = 0; pass < 2; pass++) {
    c.fillStyle = pass ? col : K.ink; c.beginPath();
    for (let i = 0; i < 5; i++) { const an = i * 1.26 + seed; addDisc(x + (i ? C(an) * r * 0.75 : 0), y + (i ? S(an) * r * 0.55 : 0), r * (i ? 0.62 : 0.85) + (pass ? 0 : ol)); }
    c.fill();
  }
}

// the lit fuse on top of the bar (hero frame): it burns down toward the bar, spitting sparks
function fuse(g, k, t, barDy, ak) {
  const fb = 1 - E.io(seg(t, 0.06, 0.56));
  if (fb < 0.03 || ak < 0.03) return;
  const pts = [];
  for (let i = 0; i <= 8; i++) { const f = i / 8 * fb; pts.push(gx(g, k, 8.5 + 11 * S(f * 5.2)), gy(k, barDy - 1 - 24 * f * ak)); }
  pline(pts, 8 * k * ak, K.ink); pline(pts, 3.6 * k * ak, K.cream);
  const ex = pts[16], ey = pts[17];
  spark(ex, ey, 22 * k * ak * (0.8 + 0.3 * S(t * 40)), t * 9, K.yellow); spark(ex, ey, 11 * k * ak, -t * 6, K.white);
  for (let i = 0; i < 4; i++) { const an = t * 7 + i * 1.7, r = (16 + 10 * S(t * 30 + i * 2)) * k * ak; disc(ex + C(an) * r, ey + S(an) * r, 2.6 * k * ak, i & 1 ? K.orange : K.white); }
}

/* ---------- ? ---------- */

const SCARF = [K.lime, K.sky, K.orange, K.pinkL], POOF = [K.white, K.cream, K.pinkL];
const CARDS = [[-0.62, -0.04, -0.5], [-0.5, -0.29, -0.22], [-0.88, -0.3, -0.85], [0.62, -0.06, 0.5], [0.5, -0.31, 0.22], [0.88, -0.32, 0.85]];      // where each card hangs: x, y (in u, from the ? at rest) and tilt

// the stage's layout: the ?'s size, the hat's brim (hb) and mouth (ty), and where the ? hovers
function magicLayout(a) {
  const { u, k, h } = a, s = clamp(0.45 * h / u, 0.78, 1), hb = h * 0.285, ty = hb - u * 0.3;
  return { s, hb, ty, hov: ty - 56 * k * s - u * 0.06 };
}

// the top hat: its back (brim and dark inside) is drawn before the ? comes out, its front (crown and band) after, so the ? rises out of it
function hat(u, k, hb, ch, sc, sq, front) {
  if (sc < 0.02) return;
  const c = raw(), bw = u * 0.27, tw = u * 0.235, rt = u * 0.065, rb = u * 0.072, ol = 3 * k;
  c.save(); c.translate(0, hb); c.scale(sc, sc * sq);
  if (!front) {
    ovalO(0, 0, u * 0.42, u * 0.09, K.black, 0, ol);
    ovalO(0, -ch, tw, rt, K.ink, 0, ol);
  } else {
    c.lineJoin = 'round'; c.beginPath(); c.moveTo(-bw, 0); c.lineTo(-tw, -ch); c.ellipse(0, -ch, tw, rt, 0, PI, 0, true); c.lineTo(bw, 0); c.ellipse(0, 0, bw, rb, 0, 0, PI, false); c.closePath();
    c.strokeStyle = K.ink; c.lineWidth = ol * 2; c.stroke(); c.fillStyle = K.black; c.fill();
    const rc = y => lerp(tw, bw, (y + ch) / ch), ry = y => lerp(rt, rb, (y + ch) / ch), y1 = -ch * 0.36, y2 = -ch * 0.06;      // the red band, curved to fit the crown
    c.beginPath(); c.moveTo(-rc(y1), y1); c.ellipse(0, y1, rc(y1), ry(y1), 0, PI, 0, true); c.lineTo(rc(y2), y2); c.ellipse(0, y2, rc(y2), ry(y2), 0, 0, PI, false); c.closePath();
    c.fillStyle = K.red; c.fill();
    const by = (y1 + y2) / 2 + ry((y1 + y2) / 2);
    boxO(0, by, u * 0.08, u * 0.07, K.yellow, 0, u * 0.012, ol * 0.8); box(0, by, u * 0.038, u * 0.028, K.orange, 0, u * 0.006);
    line(-tw * 0.72, -ch * 0.92, -bw * 0.84, -ch * 0.5, u * 0.025, K.indigoD);
  }
  c.restore();
}

// a playing card, turned by rot, with a suit in the middle and in the corner
function card(x, y, u, rot, kind, k) {
  const cw = u * 0.19, chh = u * 0.27, cs = C(rot), sn = S(rot), ox = -cw * 0.3, oy = -chh * 0.34;
  boxO(x, y, cw, chh, K.white, rot, u * 0.025, 2.6 * k);
  suit(x, y, u * 0.055, kind);
  suit(x + ox * cs - oy * sn, y + ox * sn + oy * cs, u * 0.022, kind);
}
function suit(x, y, r, kind) {
  if (kind === 1 || kind === 3) heart(x, y + r * 0.1, r, PI, K.ink);                       // (an upside-down heart passes for a spade)
  else if (kind === 2) poly([x, y - r * 1.2, x + r * 0.9, y, x, y + r * 1.2, x - r * 0.9, y], K.red);
  else heart(x, y - r * 0.1, r, 0, kind === 4 ? K.pink : K.red);
}

// a flat dove flying toward dir (+1 right, -1 left); flap 0..1 swings the wing
function dove(x, y, s, flap, dir, k) {
  const ol = 2.6 * k, al = 1.1 - flap * 1.9, ws = s * 1.25, lx = x - dir * s * 0.1 - dir * S(al) * ws, ly = y - s * 0.25 - C(al) * ws;
  polyO([x - dir * s * 0.8, y - s * 0.1, x - dir * s * 2.1, y - s * 0.45, x - dir * s * 1.9, y + s * 0.4], K.white, ol);
  ovalO(x, y, s * 1.05, s * 0.58, K.white, 0, ol);
  leaf(lx, ly, ws + ol, -dir * al, K.ink); leaf(lx, ly, ws, -dir * al, K.white);
  discO(x + dir * s * 1.1, y - s * 0.32, s * 0.4, K.white, ol);
  poly([x + dir * s * 1.45, y - s * 0.45, x + dir * s * 1.95, y - s * 0.27, x + dir * s * 1.45, y - s * 0.12], K.orange);
  disc(x + dir * s * 1.2, y - s * 0.38, s * 0.08, K.ink);
}

// a magic wand whose tip is at (x, y) and whose body trails off at angle ang
function wand(x, y, len, ang, u, k) {
  const cs = C(ang), sn = S(ang), lw = 0.03 * u;
  line(x, y, x + cs * len, y + sn * len, lw + 5 * k, K.ink); line(x, y, x + cs * len, y + sn * len, lw, K.black);
  line(x, y, x + cs * len * 0.16, y + sn * len * 0.16, lw, K.white); line(x + cs * len * 0.84, y + sn * len * 0.84, x + cs * len, y + sn * len, lw, K.white);
}

// a fluttering scarf along pts (flat x, y pairs): a band that widens toward a swallow-tailed end
function scarf(pts, w0, w1, col, ol) {
  const n = pts.length / 2, out = [], back = [];
  let tx = 0, ty = 0, hw = 0;
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), dx = pts[2 * i1] - pts[2 * i0], dy = pts[2 * i1 + 1] - pts[2 * i0 + 1], l = Math.hypot(dx, dy) || 1;
    tx = dx / l; ty = dy / l; hw = lerp(w0, w1, i / (n - 1)) / 2;
    out.push(pts[2 * i] - ty * hw, pts[2 * i + 1] + tx * hw); back.push(pts[2 * i] + ty * hw, pts[2 * i + 1] - tx * hw);
  }
  out.push(pts[2 * n - 2] - tx * hw * 1.6, pts[2 * n - 1] - ty * hw * 1.6);
  for (let i = n - 1; i >= 0; i--) out.push(back[2 * i], back[2 * i + 1]);
  polyO(out, col, ol);
}

/* ---------- . ---------- */

// the bouncing ball: touch-down times, where it lands (x in stage widths), the height of the hop after each (in stage heights), and the paint it leaves
const BT = [0.33, 0.99, 1.5, 1.87, 2.1], BXF = [-0.32, 0.3, -0.14, 0.03, 0.03], BHT = [0.26, 0.16, 0.085, 0.033], DISC = [0.5, 0.58, 0.46, 0.74];
const PAINT = [K.purple, K.pink, K.green, K.sky], PAINT_L = [K.purpleL, K.pinkL, K.greenL, K.skyL], BALL = [0, 0, 0, 0, 0];
// the ball's height above the ground at time t, in stage heights
function ballHeight(t) {
  if (t < BT[0]) { const p = t / BT[0]; return BHT[0] * (1 - p * p); }
  for (let i = 1; i < 5; i++) if (t < BT[i]) { const p = (t - BT[i - 1]) / (BT[i] - BT[i - 1]); return BHT[i - 1] * 4 * p * (1 - p); }
  return 0;
}
// where the ball is: BALL = [x, height above the ground, squash from a landing (0..1), stretch from its speed (0..1), +1 rising / -1 falling]
function ballAt(t, w, h) {
  let x = BXF[4], sq = 0;
  for (let i = 1; i < 5; i++) if (t >= BT[i - 1] && t < BT[i]) x = lerp(BXF[i - 1], BXF[i], (t - BT[i - 1]) / (BT[i] - BT[i - 1]));
  if (t < BT[0]) x = BXF[0];
  for (let i = 0; i < 4; i++) { const p = (t - BT[i] + 0.05) / 0.2; if (p > 0 && p < 1) sq = Math.max(sq, S(PI * p) * (1 - i * 0.22)); }
  if (t > BT[4]) sq = Math.max(sq, 0.16 * wob(t - BT[4], 3, 5));                      // (a last jelly wobble)
  const v = (ballHeight(t + 0.01) - ballHeight(t - 0.01)) / 0.02;
  BALL[0] = x * w; BALL[1] = ballHeight(t) * h; BALL[2] = sq; BALL[3] = clamp(Math.abs(v) / 1.6, 0, 1); BALL[4] = v > 0 ? 1 : -1;
}

/* ---------- , ---------- */

const RAINBOW = [K.pink, K.orange, K.yellow, K.lime, K.sky];
// the comet's route: waypoints in stage widths and heights, smoothed with a Catmull-Rom spline. cometAt puts CM = [x, y, heading]; TRX, TRY hold the trail, newest first
const ROUTE = [-0.5, -0.42, -0.36, -0.2, -0.14, 0.1, 0.14, 0.26, 0.4, 0.12, 0.5, -0.2, 0.36, -0.4, 0.1, -0.4, -0.08, -0.26, -0.2, -0.08, -0.14, 0.08, 0.04, 0.06, 0.06, -0.04, 0, -0.02];
const NR = ROUTE.length / 2, CM = [0, 0, 0], TRX = new Float32Array(64), TRY = new Float32Array(64), TNX = new Float32Array(64), TNY = new Float32Array(64);
function spline(o, f) {                                              // coordinate o (0 = x, 1 = y) of the route at f waypoints along
  const i = Math.floor(f), q = f - i, at = j => ROUTE[2 * clamp(j, 0, NR - 1) + o], p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
  return 0.5 * (2 * p1 + (p2 - p0) * q + (2 * p0 - 5 * p1 + 4 * p2 - p3) * q * q + (3 * p1 - p0 - 3 * p2 + p3) * q * q * q);
}
function cometAt(t, w, h) {
  const p = seg(t, 0.02, 2.05), tau = clamp((NR - 1) * (0.5 * p + 0.5 * E.out(p)), 0, NR - 1.001), nx = clamp(tau + 0.03, 0, NR - 1.001);
  CM[0] = spline(0, tau) * w; CM[1] = spline(1, tau) * h; CM[2] = Math.atan2((spline(1, nx) - spline(1, tau)) * h, (spline(0, nx) - spline(0, tau)) * w);
}
// a ribbon of colour bands along the trail that thins to a point and ripples
function ribbon(n, hw0, t, cols) {
  for (let j = 0; j < n; j++) {
    const j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1), dx = TRX[j0] - TRX[j1], dy = TRY[j0] - TRY[j1], l = Math.hypot(dx, dy) || 1;
    TNX[j] = -dy / l; TNY[j] = dx / l;
  }
  const c = raw(), nb = cols.length;
  for (let b = 0; b < nb; b++) {
    const o0 = -1 + 2 * b / nb, o1 = -1 + 2 * (b + 1) / nb;
    c.fillStyle = cols[b]; c.beginPath();
    for (let j = 0; j < 2 * n; j++) {
      const jj = j < n ? j : 2 * n - 1 - j, f = jj / (n - 1), hw = hw0 * (1 - f) ** 0.85, off = S(jj * 0.45 - t * 9) * hw0 * 0.3 * f * (1 - f) * 4, o = (j < n ? o0 : o1) * hw + off;
      if (j) c.lineTo(TRX[jj] + TNX[jj] * o, TRY[jj] + TNY[jj] * o); else c.moveTo(TRX[jj] + TNX[jj] * o, TRY[jj] + TNY[jj] * o);
    }
    c.closePath(); c.fill();
  }
}

/* ---------- ' ---------- */

const DUSK = [K.magenta, K.pink, K.orange, K.yellow], GL = [0, -1, 0.27, -0.27, 1, 0, 0.27, 0.27, 0, 1, -0.27, 0.27, -1, 0, -0.27, -0.27];
// a four-point glint with its own reach across (rx) and down (ry)
function glint(x, y, rx, ry, rot, col) {
  if (rx < 1 || ry < 1) return;
  const c = raw(), cs = C(rot), sn = S(rot);
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 16; i += 2) { const px = GL[i] * rx, py = GL[i + 1] * ry, X = x + px * cs - py * sn, Y = y + px * sn + py * cs; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }
  c.closePath(); c.fill();
}
// a shooting star: a five-point head trailing a tapering tail
function shooter(x, y, ang, len, r, t) {
  const cs = C(ang), sn = S(ang);
  poly([x - sn * r * 0.9, y + cs * r * 0.9, x - cs * len, y - sn * len, x + sn * r * 0.9, y - cs * r * 0.9], K.white);
  poly([x - sn * r * 0.5, y + cs * r * 0.5, x - cs * len * 0.55, y - sn * len * 0.55, x + sn * r * 0.5, y - cs * r * 0.5], K.pinkL);
  star(x, y, r * 1.7, 5, r * 0.7, t * 7, K.yellow);
}

/* ---------- " ---------- */

// the chat: where each bubble sits (stage widths, heights), its size (in u) and tilt; the big pale ones behind: x, y, size, tilt, tail side, colour
const CHAT = [[-0.3, -0.27, 0.62, -0.06], [0.28, -0.3, 0.55, 0.05], [-0.38, 0.02, 0.5, 0.04], [0.37, -0.03, 0.56, -0.05], [-0.2, 0.22, 0.46, 0.06], [0.23, 0.2, 0.52, -0.04],
  [-0.06, -0.42, 0.4, 0.03], [0.1, 0.32, 0.38, -0.05], [-0.45, -0.32, 0.3, 0.08], [0.44, 0.15, 0.32, -0.07], [0.07, -0.27, 0.27, 0.06]];
const BCOL = [K.white, K.pink, K.sky, K.yellow, K.orange, K.purple, K.cream, K.pinkL, K.skyL, K.white, K.yellowL];
const BIG = [[-0.32, -0.2, 1.3, -0.12, 1, K.greenM], [0.34, -0.3, 1.1, 0.1, -1, K.limeM], [-0.2, 0.3, 1.0, 0.08, 1, K.limeM], [0.3, 0.22, 1.2, -0.06, -1, K.greenM]];
// a speech bubble: a tail (pointing along dx, dy), a rounded body, and something to say: kind 0 to 4 is jumping dots, a heart, a star, an exclamation mark, squiggles
function bubble(x, y, bw, bh, rot, dx, dy, col, kind, t, k) {
  const c = raw(), ol = 3 * k, m = bh * 0.5, lx = dx * C(rot) + dy * S(rot), ly = -dx * S(rot) + dy * C(rot), l = Math.hypot(lx, ly) || 1, nx = lx / l, ny = ly / l;
  const edge = Math.min(nx ? bw / 2 / Math.abs(nx) : 1e9, ny ? m / Math.abs(ny) : 1e9);
  c.save(); c.translate(x, y); c.rotate(rot);
  polyO([nx * edge * 0.7 - ny * m * 0.45, ny * edge * 0.7 + nx * m * 0.45, nx * (edge + m * 0.95), ny * (edge + m * 0.95), nx * edge * 0.7 + ny * m * 0.45, ny * edge * 0.7 - nx * m * 0.45], col, ol);
  boxO(0, 0, bw, bh, col, 0, m * 0.8, ol);                           // (the tail goes first, so the body's outline closes over its root)
  if (kind === 0) for (let j = 0; j < 3; j++) disc((j - 1) * m * 0.55, m * 0.15 - Math.abs(S(t * 9 + j * 0.9)) * m * 0.4, m * 0.19, K.ink);
  else if (kind === 1) { const r = m * 0.42 * (1 + 0.12 * S(t * 12)); heart(0, m * 0.02, r * 1.2, 0, K.ink); heart(0, m * 0.02, r, 0, K.red); }
  else if (kind === 2) { const r = m * 0.55; star(0, 0, r * 1.18, 5, r * 0.55, t * 3, K.ink); star(0, 0, r, 5, r * 0.45, t * 3, K.yellow); }
  else if (kind === 3) { const sh = 0.15 * S(t * 24); c.rotate(sh); line(0, -m * 0.45, 0, m * 0.08, m * 0.24, K.ink); disc(0, m * 0.44, m * 0.15, K.ink); }
  else { wave(-bw * 0.28, bw * 0.28, -m * 0.24, m * 0.12, m * 0.7, t * 8, m * 0.16, K.ink); wave(-bw * 0.2, bw * 0.28, m * 0.24, m * 0.12, m * 0.7, t * 8 + 1, m * 0.16, K.ink); }
  c.restore();
}

/* ---------- - ---------- */

// the caterpillar's spine: a hyphen glyph with plenty of points, so it can be bent along the beads (at rest it is exactly the real hyphen)
const CAT = (() => {
  const n = 25, p = new Float32Array(2 * n), cum = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[2 * i] = 8.5 + 27 * i / (n - 1); p[2 * i + 1] = 50; cum[i] = 27 * i / (n - 1); }
  return { ch: '-', w: 44, strokes: [{ p, cum, total: 27, off: 0 }], total: 27, feet: [[8.5, 50], [35.5, 50]], bottom: 50 };
})();
const BEADX = new Float32Array(9), BEADY = new Float32Array(9), BEAD = [K.lime, K.yellow, K.orange, K.sky], BEAD_L = [K.limeL, K.yellowL, K.orangeL, K.skyL];
const FLOWERS = [[-0.44, 0.2, 0.075], [-0.3, 0.3, 0.09], [-0.13, 0.16, 0.06], [0.06, 0.3, 0.085], [0.22, 0.18, 0.065], [0.36, 0.28, 0.08], [0.47, 0.17, 0.06]];      // x (stage widths), height (stage heights), size (u)
const FCOL = [[K.yellow, K.orange], [K.white, K.yellow], [K.orange, K.yellow], [K.purple, K.yellow], [K.yellow, K.red], [K.sky, K.white], [K.white, K.orange]];
// where the beads are, in glyph units (the spine runs along y = 50): a wave of squeezing runs from tail to head and the front rears up; ak 0 folds it all back into the plain hyphen
function caterpillar(nb, t, amp, rear, ak) {
  let sum = 0;
  const squeeze = f => S(TAU * (f - t * 1.15));
  for (let j = 0; j < nb; j++) { BEADX[j] = sum; sum += 15 * (1 - 0.3 * amp * squeeze((j + 0.5) / (nb - 1))); }
  const mid = BEADX[nb - 1] / 2;
  for (let j = 0; j < nb; j++) {
    const rest = 8.5 + 27 * j / (nb - 1), lift = 15 * amp * Math.max(0, squeeze(j / (nb - 1))) + 27 * rear * sat((j - (nb - 5)) / 4) ** 1.5;
    BEADX[j] = lerp(rest, 22 + BEADX[j] - mid, ak); BEADY[j] = lerp(50, 50 - lift, ak);
  }
}
// the head's face: eyes, antennae and a mouth that chomps while it eats
function face(x, y, r, ks, t, eat) {
  if (r < 2) return;
  const chomp = eat > 0 && eat < 4 ? 0.5 + 0.5 * S(t * 26) : 0;
  for (let sd = -1; sd <= 1; sd += 2) {                              // two antennae, wiggling, with bobbles on the end
    const ax = x + r * (0.15 + 0.5 * sd), pts = [ax, y - r * 0.85, ax + sd * r * 0.3 + S(t * 6 + sd) * r * 0.12, y - r * 1.5, ax + sd * r * 0.55 + S(t * 6 + sd) * r * 0.22, y - r * 1.85];
    pline(pts, 3.4 * ks, K.ink); discO(pts[4], pts[5], r * 0.16, K.pink, 2 * ks);
  }
  eye(x + r * 0.05, y - r * 0.28, r * 0.34, 0.6, 0.2 + chomp * 0.2); eye(x + r * 0.6, y - r * 0.28, r * 0.34, 0.6, 0.2 + chomp * 0.2);
  arcS(x + r * 0.32, y + r * 0.02, r * 0.4, 0.15 * PI, 0.85 * PI, 3.4 * ks, K.ink);
  if (chomp > 0.05) pie(x + r * 0.32, y + r * 0.1, r * 0.3 * chomp + 1, 0, PI, K.ink);
}

/* ---------- _ ---------- */

const SPL = [[-0.3, -0.22, 0.2, 0.55], [0.08, -0.36, 0.17, 1.15], [0.42, -0.14, 0.18, 1.7]], SPL_COL = [K.pink, K.lime, K.purple];       // graffiti: x, y (stage widths, heights), size (u), when
const LAND = [[0.24, 1.5], [0.33, 2.1]];                                                                                            // the two landings on the wall: x, when
const SK = [0, 0, 0, 1, 0, 0];
// the half-pipe's surface height at x: a flat floor, a curved wall each side, and a platform on top
function surf(x, w, h) {
  const G = h * 0.22, d = (Math.abs(x) - 0.15 * w) / (0.23 * w);
  return d <= 0 ? G : d >= 1 ? G - 0.42 * h : G - 0.42 * h * (1 - Math.sqrt(1 - d * d));
}
// the tilt of the surface at x (radians; rising to the right is negative)
function tilt(x, w, h) { const d = clamp((Math.abs(x) - 0.15 * w) / (0.23 * w), 0, 0.985); return Math.sign(x) * -Math.atan(0.42 * h / (0.23 * w) * d / Math.sqrt(1 - d * d)); }
// how far along the stage (in widths) the board's wheels are at time t: it drops in, ollies onto the rail, grinds, flies to the wall, climbs, airs off the lip and rolls back to a stop
function skateX(t) {
  return t < 0.35 ? lerp(-0.34, -0.12, (t / 0.35) ** 1.5) : t < 0.55 ? lerp(-0.12, -0.04, seg(t, 0.35, 0.55)) : t < 0.68 ? lerp(-0.04, 0, seg(t, 0.55, 0.68)) : t < 1.1 ? lerp(0, 0.14, seg(t, 0.68, 1.1))
    : t < 1.5 ? lerp(0.14, 0.24, seg(t, 1.1, 1.5)) : t < 1.82 ? lerp(0.24, 0.35, E.out(seg(t, 1.5, 1.82))) : t < 2.1 ? lerp(0.35, 0.33, seg(t, 1.82, 2.1)) : 0.33 * (1 - E.out(seg(t, 2.1, 2.4)));
}
// where the deck is: SK = [x, y of its centre, tilt, flip (the cos of the kickflip), speed, x of the wheels]; ks is the deck's pixels per glyph unit
function skate(t, w, h, ks) {
  const G = h * 0.22, ry = G - h * 0.1, up = 26.5 * ks, upR = 14 * ks, x = skateX(t) * w;
  let py = surf(x, w, h), rot = tilt(x, w, h), fl = 1, off = up;
  if (t >= 0.55 && t < 0.68) { const p = seg(t, 0.55, 0.68); py = lerp(G, ry, E.out(p)) - h * 0.24 * p * (1 - p); rot = -0.25 * S(PI * p); off = lerp(up, upR, p); }        // the ollie
  else if (t >= 0.68 && t < 1.1) { py = ry; rot = 0; off = upR; }                                                                                            // the grind
  else if (t >= 1.1 && t < 1.5) { const p = seg(t, 1.1, 1.5), e = E.io(p); py = lerp(ry, surf(0.24 * w, w, h), e) - h * 0.6 * p * (1 - p); rot = lerp(0, tilt(0.24 * w, w, h), e); fl = C(TAU * e); off = lerp(upR, up, p); }   // the kickflip
  else if (t >= 1.82 && t < 2.1) { const p = seg(t, 1.82, 2.1); py -= h * 0.8 * p * (1 - p); rot -= TAU * E.io(p); }                                       // the air off the lip
  SK[0] = x + S(rot) * off; SK[1] = py - C(rot) * off; SK[2] = rot; SK[3] = fl; SK[4] = (skateX(t + 0.02) - skateX(t - 0.02)) / 0.04 * w; SK[5] = x;
}

/* ---------- : ---------- */

const LOOK = [[0.3, 0, 0], [0.45, -9, 0], [0.65, 9, 0], [0.85, 0, -9], [1.0, 7, 6], [1.2, 0, 0]], LK = [0, 0];      // where the eyes look (glyph units, screen directions), by time
function lookAt(t) {
  LK[0] = LK[1] = 0;
  for (let i = 1; i < LOOK.length; i++) if (t < LOOK[i][0]) { const p = E.io(seg(t, LOOK[i - 1][0], LOOK[i][0])); LK[0] = lerp(LOOK[i - 1][1], LOOK[i][1], p); LK[1] = lerp(LOOK[i - 1][2], LOOK[i][2], p); break; }
  return LK;
}
// an eyelid over the top of an eye: cover 0 is open and 1 is shut (a happy lash line appears when it is)
function lid(x, y, r, cover, k) {
  const c = raw(), m = 2 * cover - 1, an = Math.asin(clamp(m, -1, 1));
  c.fillStyle = K.orange; c.beginPath(); c.arc(x, y, r, PI - an, TAU + an); c.closePath(); c.fill();
  if (cover < 0.98) { const hx = Math.sqrt(Math.max(0, 1 - m * m)) * r; line(x - hx, y + r * m, x + hx, y + r * m, 3.6 * k, K.ink); }
  if (cover > 0.9) arcS(x, y - r * 0.1, r * 0.6, 0.12 * PI, 0.88 * PI, 4 * k, K.ink);
}
// a thick eyebrow above an eye (side -1 left, 1 right) that slides between neutral, suspicious, surprised and joyful
function brow(x, y, re, side, susp, surp, joy, k, i) {
  const an = side * (-(i ? 0.02 : 0.42) * susp) + side * 0.18 * joy, arch = re * (0.16 + 0.25 * surp + 0.32 * joy), hw = re * 0.62, pts = [];
  if (re < 1) return;
  for (let j = 0; j <= 6; j++) { const f = j / 6 * 2 - 1, px = f * hw, py = -arch * (1 - f * f); pts.push(x + px * C(an) - py * S(an), y + px * S(an) + py * C(an)); }
  pline(pts, 9 * k, K.ink);
}

/* ---------- ; ---------- */

const KISS = [K.red, K.pink, K.white];
