// J, L, M, N, P, Q and R. Same contract as letters.js: { color, bg, dur, back(a, t), draw(a, t) }, all pure functions of t.
// Helpers for each scene sit below the table, in the same order.
import {
  K, E, S, C, TAU, PI, sat, clamp, seg, lerp, pop, unpop, hop, mixHex, hash,
  disc, discO, ring, oval, ovalO, box, boxO, line, poly, tri, star, spark, pie, arcS, wave, band, rays, note, cloud, limbO, blob,
  eye, bits, addDisc, addStar, spray, fall, glyph, glyphInk, gx, gy, trace, alpha, raw,
} from './kit.js';

const NIGHT = K.blueD, HALO = [mixHex(K.blueD, K.blue, 0.3), mixHex(K.blueD, K.blue, 0.55)], DUSK = mixHex(K.blueD, K.ink, 0.5), NODE = mixHex(K.ink, K.blue, 0.4);     // N's night sky and what sits in it

export const SCENES = {
  /* J: a gold saxophone bops to the beat, blowing curly notes out of its bell under a swaying spotlight */
  J: {
    color: K.yellow, bg: K.indigo, dur: 2.8,
    back(a, t) {
      const { u, k, h } = a, big = a.x(0.3), floorY = h * 0.17, cy = floorY - 50 * k * JS * a.hs, beat = (t - 0.02) / 0.5, thump = Math.exp(-7 * (beat - Math.floor(beat)));
      rays(0, cy, 18, Math.hypot(a.bw, a.bh) / 2 * E.out(seg(t, 0, 0.45)), S(t * 0.4) * 0.1, K.indigoD, 0.4);
      for (let i = 0; i < 7; i++) {                                 // flat jazz-poster discs and triangles, each popping on its own off-beat
        const an = i / 7 * TAU + 0.4, d = u * (0.78 + 0.3 * (i % 2)) * big, x = C(an) * d * 1.3, y = cy + S(an) * d * 0.85, bt = beat + i * 0.25;
        const r = u * (0.13 + 0.06 * (i % 3)) * pop(t, 0.1 + i * 0.07, 0.4) * (1 + 0.22 * Math.exp(-7 * (bt - Math.floor(bt))));
        if (i % 3 === 2) star(x, y, r * 1.2, 3, r * 0.5, t * 0.6 + i, K.teal); else disc(x, y, r, i & 1 ? K.orange : K.teal);
      }
      const R = u * 0.68 * big * pop(t, 0.02, 0.5) * (1 + 0.04 * thump), rot = t * 1.4;     // a record spinning behind the sax
      disc(0, cy, R, K.ink);
      for (let i = 1; i < 5; i++) ring(0, cy, R * (0.42 + i * 0.11), 1.6 * k, K.indigoD);
      pie(0, cy, R * 0.97, rot, rot + 0.5, K.indigoD); pie(0, cy, R * 0.97, rot + PI, rot + PI + 0.5, K.indigoD);
      disc(0, cy, R * 0.34, K.orange); disc(0, cy, R * 0.25, K.yellow); disc(0, cy, R * 0.05, K.ink);
      for (let i = 0; i < 5; i++) {                                 // five staff lines sweep across, wobbling
        const y = cy - u * 0.5 * big + (i - 2) * u * 0.1, p = E.out(seg(t, 0.05 + i * 0.04, 0.85));
        wave(-a.bw / 2, lerp(-a.bw / 2, a.bw / 2, p), y, u * 0.03, u * 0.9, t * 3 + i * 0.25, 4 * k, K.cream);
      }
      box(0, floorY + h * 0.5, a.bw, h, K.indigoD);                 // the stage
      box(0, floorY + 6 * k, a.bw, 10 * k, K.orange);
      alpha(a.big ? 0.13 : 0.17);                                   // spotlights: translucent cones from above, a pool of light where each lands
      for (let i = 0, n = a.big ? 3 : 1; i < n; i++) {
        const sx = S(t * 1.3 + i * 2.1) * u * 0.25 + (i ? (i - 1.5) * u * 1.6 : 0);
        poly([sx * 0.4 - 10, -h / 2 - 60, sx * 0.4 + 10, -h / 2 - 60, sx + u * 0.62, floorY, sx - u * 0.62, floorY], K.white);
        oval(sx, floorY + 22 * k, u * 0.62, 26 * k, K.white);
      }
      alpha(1);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, n = a.n(9), o = saxPose(a, t, JP);
      fall(a, t, { n: a.n(10), t0: 0.1, vy0: -50, vy1: -140, shape: 'spark', s0: 6, s1: 13, cols: [K.yellow, K.white, K.teal], seed: 40 });
      for (let b = 0; b < 5; b++) {                                 // sound arcs off the bell on every beat
        const tb = 0.02 + b * 0.5, p = seg(t, tb, tb + 0.5);
        if (p <= 0 || p >= 1) continue;
        const bp = toWorld(a, saxPose(a, tb, JQ), gx(g, k, 8.5), gy(k, 32)), ang = -PI / 2 + JQ[2];
        for (let j = 0; j < 2; j++) { const q = seg(p, j * 0.18, 1); if (q > 0) arcS(bp[0], bp[1], u * (0.1 + 0.42 * E.out(q)) * a.x(0.3), ang - 0.95, ang + 0.95, 6 * k * (1 - q), j ? K.orange : K.white); }
      }
      a.begin(o[0], o[1], o[5], o[2], o[3], o[4]);
      saxBody(a, t);
      a.end();
      for (let i = 0; i < n; i++) {                                 // notes curling up out of the bell, spread over the stage by the golden ratio
        const t0 = 0.3 + i * 1.75 / n, age = t - t0, p = age / 1.6;
        if (p <= 0 || p >= 1) continue;
        const bp = toWorld(a, saxPose(a, t0, JQ), gx(g, k, 8.5), gy(k, 34)), e = 0.55 * E.out(p) + 0.45 * p, th = p * TAU * 1.3 + a.r(i, 4) * TAU, lr = u * (0.06 + 0.07 * a.r(i, 6)) * S(p * PI);
        const x = bp[0] - (0.03 + 0.42 * ((i * 0.618) % 1)) * w * e + lr * S(th), y = bp[1] - (bp[1] + h * 0.5 - u * 0.1) * (0.3 + 0.6 * ((i * 0.382 + 0.3) % 1)) * e + lr * (C(th) - 1);
        const sz = u * (0.1 + 0.06 * a.r(i, 5)) * a.x(0.2) * pop(age, 0, 0.3) * (1 - E.inBack(seg(p, 0.82, 1)));
        note(x + sz * 0.12, y + sz * 0.14, sz, 0.5 * S(th), K.ink);
        note(x, y, sz, 0.5 * S(th), NOTE_COLS[i % NOTE_COLS.length]);
      }
      const bell = toWorld(a, saxPose(a, 1.9, JQ), gx(g, k, 8.5), gy(k, 34));                   // a last burst out of the bell
      spray(a, t, { x: bell[0], y: bell[1], n: a.n(26), t0: 1.9, life: 1.1, a0: -PI * 0.95, a1: -PI * 0.05, v0: u * 0.9, v1: u * 2.2, seed: 31, cols: [K.orange, K.teal, K.white, K.yellowL, K.pinkL] });
    },
  },

  /* L: a red L glides down like a falling leaf, swinging through a vortex of autumn leaves, and lands in a gust */
  L: {
    color: K.red, bg: K.green, dur: 2.8,
    back(a, t) {
      const { u, k, w, h } = a, R = Math.hypot(w, h) * 0.62, cy = h * 0.02, spin = t * 0.75 + 1.4 * E.io(seg(t, 1.75, 2.3)), nl = a.n(26), c = raw();
      pinwheel(0, cy, 10, R * E.outBack(seg(t, 0, 0.5)), t * 0.375 + 0.2 * E.io(seg(t, 1.75, 2.3)), -1.3, K.greenD, 0.45);          // (slow, so the stripes never flicker)
      leafBits(LEAVES, VEINS, nl * 3, i => {                        // three arms of leaves, flowing in along a spiral as it turns
        const s0 = ((i / 3 | 0) + a.r(i, 1) * 0.7) / nl, s = (((s0 - t * 0.14) % 1) + 1) % 1, r = R * (0.05 + 0.95 * s ** 0.8), an = (i % 3) * TAU / 3 + spin + 7.5 * (1 - s) + (a.r(i, 2) - 0.5) * 0.14;
        LF.x = C(an) * r; LF.y = cy + S(an) * r; LF.s = u * (0.07 + 0.14 * s) * (0.7 + 0.6 * a.r(i, 3)) * sat(s * 10) * E.outBack(seg(t, 0.05 + 0.3 * s, 0.4 + 0.3 * s));
        LF.r = an + PI + 0.6 * S(t * 3 + i * 1.7); LF.w = 0.55 + 0.45 * Math.abs(C(t * 2.4 + i)); LF.m = i & 1;
      });
      c.lineCap = 'round';                                          // wind streaks curling round the vortex
      for (let j = 0, na = a.n(14); j < 2; j++) {
        c.strokeStyle = j ? K.white : K.cream; c.lineWidth = (j ? 2.6 : 4) * k; c.beginPath();
        for (let i = j; i < na; i += 2) {
          const r = R * (0.12 + 0.85 * a.r(i, 11)), an = a.r(i, 12) * TAU + spin * 1.3 + 4 * (1 - r / R);
          c.moveTo(C(an) * r, cy + S(an) * r); c.arc(0, cy, r, an, an + 0.25 + 0.5 * a.r(i, 13));
        }
        c.stroke();
      }
    },
    draw(a, t) {
      const { u, k, w, h } = a, hs = a.hs, ground = h * 0.15, tg = 1.78, o = leafPose(a, t, LP), near = seg(t, 0.02, tg), sh = 0.25 + 0.75 * near * near;
      oval(o[0], ground + 4 * k, u * 0.3 * hs * LS * sh, u * 0.06 * hs * LS * sh, K.greenD);       // its shadow grows as it comes down
      a.begin(o[0], o[1], LS * pop(t, 0.02, 0.3), o[2], o[3], o[4]);
      leafBody(a);
      a.end();
      leafBits(LEAVES, VEINS, a.n(5), i => {                        // big leaves whipping across, above and below the letter
        const ts = 0.35 + i * 0.36, p = seg(t, ts, ts + 1.1), dir = i & 1 ? -1 : 1;
        LF.x = lerp(-dir * w * 0.62, dir * w * 0.62, p); LF.y = -dir * (0.3 + 0.12 * a.r(i, 1)) * h + S(p * PI * 2 + i) * u * 0.1; LF.s = p > 0 && p < 1 ? u * (0.12 + 0.07 * a.r(i, 2)) * a.x(0.3) : 0;
        LF.r = p * 9 * dir + i; LF.w = 0.5 + 0.5 * Math.abs(C(p * 14 + i)); LF.m = i & 1;
      });
      const gp = seg(t, tg, tg + 0.6), c = raw();                   // the gust when it lands: dust rings, a burst of leaves, wind lines
      if (gp > 0 && gp < 1) {
        c.save(); c.translate(o[0], ground + 4 * k); c.scale(1, 0.24);
        ring(0, 0, u * 0.9 * a.x(0.3) * E.out(gp), Math.max(1, u * 0.08 * (1 - gp)), K.white); ring(0, 0, u * 0.6 * a.x(0.3) * E.out(gp), Math.max(1, u * 0.05 * (1 - gp)), K.yellowL);
        c.restore();
      }
      if (t > tg) leafBits(LEAVES, VEINS, a.n(14), i => {
        const age = t - tg - 0.02, ang = -PI * (0.05 + 0.9 * a.r(i, 21)), v = u * (1.1 + 1.8 * a.r(i, 22)), d = (1 - Math.exp(-2.2 * age)) / 2.2;
        LF.x = o[0] + C(ang) * v * d; LF.y = ground + S(ang) * v * d + 180 * age * age; LF.s = age > 0 && age < 1.2 ? u * (0.08 + 0.07 * a.r(i, 23)) * (1 - seg(age, 0.8, 1.2)) : 0;
        LF.r = age * (a.r(i, 24) - 0.5) * 16 + i; LF.w = 0.5 + 0.5 * Math.abs(C(age * 9 + i)); LF.m = i & 1;
      });
      for (let i = 0, n = a.n(5); i < n; i++) {
        const ts = tg + 0.02 + i * 0.05, p = E.out(seg(t, ts, ts + 0.5)), y = (-0.35 + 0.6 * a.r(i, 31)) * h;
        if (p > 0 && p < 1) wave(lerp(-w * 0.6, w * 0.6, sat(p * 1.2 - 0.2)) - w * 0.5 * (1 - p), lerp(-w * 0.6, w * 0.6, p), y, u * 0.04, u * 0.6, i * 2 + t * 6, (4 + 3 * a.r(i, 32)) * k * (1 - p * 0.6), i & 1 ? K.white : K.cream);
      }
    },
  },

  /* M: a furry purple one-eyed monster waves, tracks a fly with its eye, then ROARS: it stretches, shockwaves ring out and the fly is blown away */
  M: {
    color: K.purple, bg: K.orange, dur: 2.8,
    back(a, t) {
      const { u, k, h } = a, roar = roarAt(t), sp = u * 0.52, rs = sp * 0.87, R = u * 0.19 * (1 + 0.16 * roar), nc = Math.ceil(a.bw / sp) + 2, nr = Math.ceil(a.bh / rs) + 2, cy = h * 0.02;
      const wrap = (v, m) => ((v % m) + m) % m - m / 2;
      const dot = (i, small) => {                                   // polka dots on a hex grid, drifting, popping in from the middle outwards
        const cx = i % nc, cr = i / nc | 0, x = wrap(cx * sp + (cr & 1 ? sp / 2 : 0) + t * u * 0.07 + (small ? sp / 2 : 0), nc * sp), y = wrap(cr * rs + t * u * 0.03 + (small ? sp * 0.29 : 0), nr * rs);
        const d = Math.hypot(x, y) / (u * 6), p = E.outBack(seg(t, 0.04 + d, 0.4 + d));
        addDisc(x, y, Math.max(0, (small ? R * 0.34 : R) * p * (1 + 0.07 * S(t * 5 + i))));
      };
      bits([K.lime], nc * nr, i => dot(i, false));
      bits([K.yellow], nc * nr, i => dot(i, true));
      const bp = roar * a.x(0.3), mp = toWorld(a, monsterPose(a, 1.24, MQ), gx(a.g, k, 45), gy(k, 88));      // a comic-book burst behind it as it roars, and shockwaves from its mouth
      star(0, cy, u * (0.5 + 0.45 * bp), 14, u * (0.34 + 0.28 * bp), t * 0.6, K.yellow);
      star(0, cy, u * (0.3 + 0.3 * bp), 14, u * (0.18 + 0.18 * bp), -t * 0.5, K.yellowL);
      for (let i = 0, n = a.big ? 5 : 3; i < n; i++) shock(mp[0], mp[1], t, 1.24 + i * 0.075, 0.7, u * 0.2, u * (1.05 + 0.3 * i) * a.x(0.5), u * 0.04, ROAR_COLS[i]);
      for (let i = 0, n = a.big ? 3 : 2; i < n; i++) shock(mp[0], mp[1], t, 1.96 + i * 0.07, 0.55, u * 0.15, u * (0.7 + 0.25 * i) * a.x(0.5), u * 0.03, i & 1 ? K.yellow : K.white);
    },
    draw(a, t) {
      const { u, k, g, h } = a, roar = roarAt(t), o = monsterPose(a, t, MP);
      oval(o[0], h * 0.27 + 5 * k, u * 0.42 * a.hs * MS * (1 - 0.15 * roar), u * 0.07 * a.hs * MS, K.orangeD);
      a.begin(o[0], o[1], MS * pop(t, 0.02, 0.32), o[2], o[3], o[4]);
      monsterBody(a, t, roar, inhaleAt(t), pop(t, 0.06, 0.35));
      a.end();
      for (const [t0, n, seed, cols] of SPITS) {                    // spit flying out of the mouth on each roar
        const mp = toWorld(a, monsterPose(a, t0, MQ), gx(g, k, 45), gy(k, 88));
        spray(a, t, { x: mp[0], y: mp[1], n: a.n(n), t0, life: 0.85, a0: -PI * 0.95, a1: -PI * 0.05, v0: u * 0.9, v1: u * 2.3, g: 1500, s0: 5, s1: 12, shape: 'dot', seed, cols });
      }
    },
  },

  /* N: a ninja N teleports between spots in clouds of poof, throws shuriken, flips and spins, and strikes a pose under a huge slash */
  N: {
    color: K.ink, textColor: K.white, bg: NIGHT, dur: 2.8,                 // a black silhouette while it plays, a white letter in the text (ink would vanish into its own outline)
    back(a, t) {
      const { u, w, h } = a, sw = Math.min(w, 2.2 * u), mR = u * 0.62 * a.x(0.25) * pop(t, 0.02, 0.5), mx = 0.2 * sw, my = -0.12 * h, ns = a.n(22);
      disc(mx, my, mR * 1.42, HALO[0]); disc(mx, my, mR * 1.2, HALO[1]);       // the huge red moon, in its halo
      disc(mx, my, mR, K.red);
      disc(mx - mR * 0.32, my - mR * 0.28, mR * 0.2, K.redD); disc(mx + mR * 0.38, my + mR * 0.2, mR * 0.26, K.redD); disc(mx - mR * 0.1, my + mR * 0.5, mR * 0.12, K.redD);
      for (let i = 0; i < 3; i++) {                                 // thin clouds drifting across it
        const x = (((i * 0.43 + t * 0.05) % 1.3) - 0.65) * a.bw * 0.7, y = my + (i - 1) * mR * 0.55, wd = u * (0.9 + 0.4 * i);
        box(x, y, wd, u * 0.07, DUSK, 0, u * 0.035); box(x + wd * 0.2, y - u * 0.05, wd * 0.5, u * 0.06, DUSK, 0, u * 0.03);
      }
      bamboo(a, t);
      bits([K.white, K.yellowL], ns, i => {                         // twinkling stars
        const r = u * (0.012 + 0.03 * a.r(i, 3)) * (0.6 + 0.4 * S(t * 4 + i * 2.1)) * pop(t, 0.1 + a.r(i, 4) * 0.5, 0.3);
        addStar((a.r(i, 1) - 0.5) * a.bw * 0.5, (a.r(i, 2) - 0.5) * a.bh * 0.5, r, r * 0.25, 4, 0);
      });
    },
    draw(a, t) {
      const { u, w, h } = a, o = ninjaPose(a, t, NP), sw = Math.min(w, 2.2 * u), L = Math.hypot(w, h) * 0.6, fs = NSPOTS[4], fx = fs[0] * sw, fy = fs[1] * h, an = -0.72;
      slash(t, 1.86, 0.5, fx - C(an) * L, fy - S(an) * L, fx + C(an) * L, fy + S(an) * L, u * 0.1 * a.x(0.2), K.white, K.red, true);           // the big slash mark the ninja finishes in front of
      for (let i = 0; i < NARR.length; i++) poof(NSPOTS[i][0] * sw, NSPOTS[i][1] * h, u * 0.4 * a.x(0.3), seg(t, NARR[i], NARR[i] + 0.34), i + 5);      // a puff where it lands, behind it
      if (o[5] > 0.02) ninjaTails(a, t, o);
      a.begin(o[0], o[1], o[5], o[2], o[3], o[4]);
      ninjaBody(a, t);
      a.end();
      for (let i = 1; i < NARR.length; i++) poof(NSPOTS[i - 1][0] * sw, NSPOTS[i - 1][1] * h, u * 0.34 * a.x(0.3), seg(t, NARR[i] - 0.1, NARR[i] + 0.3), i);     // and one where it left, in front
      for (let j = 0, n = a.big ? 3 : 1; j < n; j++) {              // shuriken thrown at the start and at the end, each aimed at where the ninja lands next
        for (let f = 0; f < 2; f++) {
          const i0 = f ? 3 : 0, tl = NARR[i0 + 1], p = seg(t, tl - 0.24, tl), A = NSPOTS[i0], B = NSPOTS[i0 + 1], fan = (j - (n - 1) / 2) * 0.22 * h;
          if (p <= 0 || t > tl + 0.06) continue;
          for (let g2 = 5; g2 >= 0; g2--) {
            const q = Math.max(0, p - g2 * 0.06), sx = lerp(A[0] * sw + u * 0.34, B[0] * sw, q), sy = lerp(A[1] * h, B[1] * h + fan, q) - S(q * PI) * h * 0.08;
            if (g2) disc(sx, sy, u * (0.05 - g2 * 0.007), K.white); else shuriken(sx, sy, u * 0.11 * a.x(0.15), t * 44 + j);
          }
        }
      }
      for (let i = 0, n = a.big ? 4 : 2; i < n; i++) {              // diagonal slashes cut across the screen
        const c = SLASHES[i], cx = c[0] * sw, cy = c[1] * h;
        slash(t, c[3], 0.4, cx - C(c[2]) * L, cy - S(c[2]) * L, cx + C(c[2]) * L, cy + S(c[2]) * L, u * 0.07 * a.x(0.2), K.white, K.sky);
      }
      spray(a, t, { x: fx, y: fy + u * 0.35, n: a.n(24), t0: 1.9, life: 1.0, a0: -0.15 * PI, a1: 1.15 * PI, v0: u * 0.8, v1: u * 2, seed: 81, cols: [K.white, K.red, K.sky, K.yellowL] });
    },
  },

  /* P: a fat brush paints the P on, flinging splats and running drips of loud paint while a roller sweeps colour across the backdrop */
  P: {
    color: K.pink, bg: K.lime, dur: 2.8,
    back(a, t) {
      const { u, k, h } = a, nb = a.big ? 6 : 4, bh = h * (a.big ? 0.12 : 0.15), edge = a.bw / 2;
      for (let i = 0; i < nb; i++) {                                // a paint roller sweeps a band of colour across, one way then the other
        const y = (-0.34 + i * (a.big ? 0.14 : 0.22)) * h, dir = i & 1 ? -1 : 1, p = E.io(seg(t, 0.02 + i * 0.16, 0.62 + i * 0.16)), x0 = -dir * edge, x1 = lerp(x0, dir * edge, p);
        if (p <= 0) continue;
        box((x0 + x1) / 2, y, Math.abs(x1 - x0), bh, PCOLS[i], 0, bh * 0.3);
        if (p < 1) {
          line(x1 + dir * u * 0.05, y - bh * 0.5, x1 + dir * u * 0.2, y - bh * 1.1, 0.06 * u, K.ink); line(x1 + dir * u * 0.05, y - bh * 0.5, x1 + dir * u * 0.2, y - bh * 1.1, 0.035 * u, K.orange);
          boxO(x1, y, u * 0.09, bh * 1.08, K.white, 0, u * 0.035, 3 * k); box(x1 - u * 0.02, y, u * 0.016, bh * 0.85, K.skyL, 0, u * 0.008);
        }
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, o = paintPose(a, t, PP), hu = u * a.hs;
      a.begin(o[0], o[1], PS * pop(t, 0.02, 0.3), o[2], o[3], o[4]);
      paintBody(a, t, paintAt(t));
      a.end();
      for (let i = 0, n = a.n(7); i < n; i++) {                     // blobs flung off the brush: each flies, lands as a splat, and drips
        const ts = 0.3 + i * 1.3 / n, ta = ts + 0.2, col = SPL[i % SPL.length];
        if (t < ts) continue;
        const tr = trace(g, k, paintAt(ts)), sp = toWorld(a, paintPose(a, ts, PQ), tr[0], tr[1]), x0 = sp[0], y0 = sp[1];
        const th = i * 2.4 + 0.6, x1 = clamp(C(th) * hu * (0.55 + 0.25 * a.r(i, 1)), -w * 0.46, w * 0.46), y1 = clamp(-h * 0.03 + S(th) * hu * (0.58 + 0.2 * a.r(i, 6)), -h * 0.42, h * 0.22);
        const fp = seg(t, ts, ta), R = u * (0.08 + 0.05 * a.r(i, 2)) * a.x(0.2);
        if (fp < 1) {
          const q = Math.max(0, fp - 0.18), fx = lerp(x0, x1, fp), fy = lerp(y0, y1, fp) - S(fp * PI) * h * 0.1;
          line(lerp(x0, x1, q), lerp(y0, y1, q) - S(q * PI) * h * 0.1, fx, fy, u * 0.04, col); disc(fx, fy, u * 0.032, col);
        } else {
          splat(x1, y1, R, col, i, E.outBack(seg(t, ta, ta + 0.3)));
          drip(x1 - R * 0.25, y1 + R * 0.5, u * (0.14 + 0.16 * a.r(i, 3)), u * 0.028, col, seg(t, ta + 0.15, ta + 1.0));
          if (a.r(i, 4) < 0.6) drip(x1 + R * 0.35, y1 + R * 0.4, u * (0.08 + 0.1 * a.r(i, 5)), u * 0.022, col, seg(t, ta + 0.3, ta + 1.1));
        }
      }
      spray(a, t, { x: 0, y: h * 0.1, n: a.n(26), t0: 1.62, life: 1.1, v0: u * 0.8, v1: u * 2.2, seed: 91, cols: [K.pink, K.yellow, K.sky, K.white, K.orange] });
    },
  },

  /* Q: a rubber-duck Q drops into a pond with a splash, bobs on the waves and QUACKS, while a line of ducklings paddles in behind */
  Q: {
    color: K.yellow, bg: K.sky, dur: 2.8,
    back(a, t) {
      const { u, k, w, h } = a, R = u * 0.17 * pop(t, 0.05, 0.5), sx = w * 0.3, sy = -h * 0.27, len = u * 1.6, bw = a.bw, wy = h * 0.06, c = raw(), o = duckPose(a, t, QP);
      rays(sx, sy, 14, u * 1.6, t * 0.3, K.skyL, 0.4); disc(sx, sy, R * 1.25, K.yellowL); disc(sx, sy, R, K.yellow);
      for (let i = 0; i < 3; i++) cloud(((0.3 + i * 0.38) * w - t * u * 0.1 + w * 1.5) % (w * 1.3) - w * 0.65, -h * (0.3 - i * 0.04), u * (0.18 + 0.03 * i) * pop(t, 0.1 + i * 0.1, 0.4), K.white);
      band(-bw / 2, bw / 2, wy - u * 0.1, u * 0.02, len * 0.7, 1 + t * 1.6, K.blueM, a.bh);           // flat bands of water, each a sine wave of its own
      band(-bw / 2, bw / 2, wy, u * 0.025, len, t * 2.4, K.blue, a.bh);
      wave(-bw / 2, bw / 2, wy, u * 0.025, len, t * 2.4, 5 * k, K.skyL);
      band(-bw / 2, bw / 2, wy + u * 0.16, u * 0.02, len * 0.6, 2 - t * 2, K.blueD, a.bh);
      wave(-bw / 2, bw / 2, wy + u * 0.16, u * 0.02, len * 0.6, 2 - t * 2, 4 * k, K.blueM);
      for (let i = 0; i < 3; i++) wave(-bw / 2, bw / 2, wy + u * (0.5 + 0.4 * i), u * 0.03, len * (0.8 + 0.2 * i), t * (1.6 + i) + i * 2, 3 * k, K.blueM);
      for (let i = 0; i < 3; i++) {                                 // ripples spreading from the duck
        const tt = t - 0.42 - i * 0.28, p = ((tt % 0.84) + 0.84) % 0.84 / 0.84;
        if (tt < 0) continue;
        c.save(); c.translate(o[0], wy + u * 0.03); c.scale(1, 0.22);
        ring(0, 0, u * (0.25 + 0.55 * p) * a.hs, Math.max(1, 6 * k * (1 - p)), K.white);
        c.restore();
      }
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, o = duckPose(a, t, QP), wy = h * 0.06, r = u * 0.055 * pop(t, 0.3, 0.3), start = o[0] + 0.31 * u * hs + r * 1.3;
      const nd = Math.max(1, Math.min(a.n(4), Math.floor((w * 0.46 - start) / (2.4 * u * 0.055)))), sp = Math.min(0.15 * u, (w * 0.46 - start) / nd);
      for (let i = 0; i < nd; i++) {                                // the ducklings paddle in one behind another and bob along
        const fin = start + i * sp, f = E.out(seg(t, 0.4 + i * 0.1, 1.3 + i * 0.1)), x = lerp(fin + w * 0.7, fin, f), ws = surf(a, x, t);
        const ys = ws - r * 0.75 - Math.abs(S(t * 7 + i * 1.3)) * r * 0.25 - hop(t - 1.6 - i * 0.07, 0.35, r * 1.3), sl = 0.5 * S(x / (u * 1.6) * TAU + t * 2.4);
        oval(x, ws + r * 0.1, r * 1.5, r * 0.3, K.white);
        discO(x, ys, r, K.yellow, 2.6 * k); ovalO(x - r * 1.05, ys + r * 0.12, r * 0.5, r * 0.28, K.orange, 0, 2 * k); disc(x - r * 0.3, ys - r * 0.3, r * 0.17, K.ink);
        arcS(x + r * 0.15, ys + r * 0.15, r * 0.5, 0.2 + sl * 0.3, PI * 0.8, 2 * k, K.yellowD);
      }
      a.begin(o[0], o[1], QS * pop(t, 0.02, 0.3), o[2], o[3], o[4]);
      duckBody(a, t, quackAt(t), o[6]);
      a.end();
      wave(o[0] - u * 0.36 * hs, o[0] + u * 0.36 * hs, wy, u * 0.025, u * 1.6, t * 2.4, 7 * k, K.white);         // foam where the duck meets the water
      for (let q = 0; q < QT.length; q++) {                         // sound waves off the beak
        const p = seg(t, QT[q], QT[q] + 0.5);
        if (p <= 0 || p >= 1) continue;
        const bp = toWorld(a, duckPose(a, QT[q], QQ), gx(g, k, -14), gy(k, 17));
        for (let j = 0; j < 3; j++) { const pj = seg(p, j * 0.15, 1); if (pj > 0) arcS(bp[0], bp[1], u * (0.08 + 0.4 * E.out(pj)) * a.x(0.35), PI - 0.85, PI + 0.85, 7 * k * (1 - pj), QUACK_COLS[j]); }
      }
      for (let i = 0, n = a.n(9); i < n; i++) {                     // bubbles rising from the deep
        const cyc = 1.5 + a.r(i, 2), age = ((t * 0.9 + a.r(i, 3) * cyc) % cyc) / cyc, x = (a.r(i, 1) - 0.5) * w * 0.9 + S(t * 3 + i) * 10;
        ring(x, lerp(h * 0.42, -h * 0.35, age), u * (0.018 + 0.03 * a.r(i, 4)) * (1 - 0.3 * age), 3 * k, K.white);
      }
      for (const tw of QW) {                                        // the splash as it lands in the pond, and again as it hops out to the text
        const x = duckPose(a, tw, QQ)[0];
        crown(a, x, wy, seg(t, tw, tw + 0.7));
        spray(a, t, { x, y: wy, n: a.n(20), t0: tw, life: 1.0, a0: -PI * 0.95, a1: -PI * 0.05, v0: u * 1.0, v1: u * 2.6, g: 1700, s0: 6, s1: 14, shape: 'dot', seed: 17, cols: SPLASH_COLS });
      }
      spray(a, t, { x: o[0], y: o[1], n: a.n(24), t0: 1.8, life: 1.1, v0: u * 0.8, v1: u * 2, seed: 27, cols: [K.yellow, K.white, K.orange, K.skyL] });
    },
  },

  /* R: an R on roller skates sweeps along a big S-curve, laying a rainbow ribbon behind it, then spins and strikes a pose */
  R: {
    color: K.sky, bg: K.pink, dur: 2.8,
    back(a, t) {
      const { u, k, h } = a, c = raw(), n = a.n(9);
      rays(0, 0, 20, Math.hypot(a.bw, a.bh) / 2 * E.outBack(seg(t, 0, 0.5)), t * 0.2, K.pinkM, 0.5);
      for (let i = 0, nd = a.n(6); i < nd; i++) {                   // big flat discs streaming past, so the scenery is racing by too
        const r = u * (0.12 + 0.3 * a.r(i, 6)), span = a.bw + r * 2, x = a.bw / 2 + r - ((a.r(i, 8) * span + t * u * (0.3 + 0.6 * a.r(i, 7))) % span);
        disc(x, (a.r(i, 9) - 0.5) * h * 0.95, r * pop(t, 0.05 + 0.05 * i, 0.4), DISCS[i % 3]);
      }
      c.strokeStyle = K.pinkL; c.lineWidth = 3.5 * k; c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i < n; i++) {                                 // speed streaks racing the other way
        const len = u * (0.5 + 0.9 * a.r(i, 2)), span = a.bw + len * 2, x = a.bw / 2 + len - ((a.r(i, 4) * span + t * u * (2.2 + 2 * a.r(i, 3))) % span), y = (a.r(i, 1) - 0.5) * h * 0.95;
        c.moveTo(x, y); c.lineTo(x + len, y);
      }
      c.stroke();
    },
    draw(a, t) {
      const { u, k } = a, o = rollPose(a, t, RP), f = rollF(t), P = rollPath(a, f, RQ), spd = 1 - seg(t, 0.05, 1.55), ns = a.n(40);
      ribbon(a, f);
      for (let i = 0, n = a.n(7); i < n && spd > 0.05; i++) {       // speed lines trailing behind the skater
        const yo = (a.r(i, 1) - 0.5) * u * 0.6 * a.hs + S(t * 9 + i) * u * 0.02, L = u * (0.3 + 0.5 * a.r(i, 2)) * spd, lx = o[0] - u * 0.2 * a.hs;
        line(lx - L, o[1] + yo, lx, o[1] + yo, 3 * k, K.white);
      }
      bits([K.yellow, K.white, K.orange], ns, i => {                // sparks kicked up by the wheels
        const tb = 0.08 + i * 1.5 / ns, age = t - tb;
        if (age < 0 || age > 0.4) return;
        const q = rollPath(a, rollF(tb), RQ), an = -PI * (0.1 + 0.6 * a.r(i, 2)), v = u * (0.6 + 1.2 * a.r(i, 3)), r = u * (0.012 + 0.02 * a.r(i, 4)) * (1 - age / 0.4);
        addStar(q[0] - C(an) * v * age * 0.6 - u * 0.05, q[1] + S(an) * v * age + 600 * age * age, r * 1.6, r * 0.5, 4, age * 9);
      });
      a.begin(o[0], o[1], RS * pop(t, 0.02, 0.3), o[2], o[3], o[4]);
      skateBody(a, t, f);
      a.end();
      spray(a, t, { x: P[0], y: P[1] - u * 0.1, n: a.n(26), t0: 1.55, life: 1.0, v0: u * 0.8, v1: u * 2.2, seed: 37, cols: [K.yellow, K.white, K.sky, K.pinkL, K.lime] });
    },
  },
};

/* ---------- shared: where a hero-frame point is in the scene, and a filled polygon with a dark outline ---------- */
const WP = [0, 0];
// for a hero posed by o = [x, y, rot, sx, sy, size]
function toWorld(a, o, px, py) {
  const m = o[5] * a.hs, X = px * o[3] * m, Y = py * o[4] * m, cs = C(o[2]), sn = S(o[2]);
  WP[0] = o[0] + X * cs - Y * sn; WP[1] = o[1] + X * sn + Y * cs;
  return WP;
}
function polyO(p, col, ol, ink = K.ink) {                          // p is a flat array of x, y
  const c = raw();
  c.beginPath(); c.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
  c.closePath(); c.lineJoin = 'round'; c.lineWidth = ol * 2; c.strokeStyle = ink; c.stroke(); c.fillStyle = col; c.fill();
}

/* ---------- J: the saxophone ---------- */
const NOTE_COLS = [K.orange, K.white, K.teal, K.yellowL, K.pinkL, K.lime];
const JS = 0.72, JP = [0, 0, 0, 1, 1, 1], JQ = [0, 0, 0, 1, 1, 1];
// the sax's pose at time t: bopping about its foot on the stage, tipping to a new side on every beat (o = [x, y, rot, sx, sy, size])
function saxPose(a, t, o) {
  const { u, h, k } = a, H2 = 50 * k * JS * a.hs, amp = sat((t - 0.05) / 0.25), beat = (t - 0.02) / 0.5, fr = beat - Math.floor(beat), thump = Math.exp(-7 * fr);
  const rot = 0.13 * a.x(0.4) * amp * C(PI * beat), sy = 1 - 0.12 * thump * amp + 0.05 * S(fr * PI) * amp, sx = 1 + 0.09 * thump * amp, lift = u * 0.03 * a.x(0.5) * S(fr * PI) * amp;
  o[0] = S(rot) * H2 * sy; o[1] = h * 0.17 - C(rot) * H2 * sy - lift; o[2] = rot; o[3] = sx; o[4] = sy; o[5] = JS * pop(t, 0.02, 0.3);
  return o;
}
// the J is the tube; a flared bell, a neck and mouthpiece and a row of keys hang off it
function saxBody(a, t) {
  const { k, g } = a, q = k * a.ak, beat = (t - 0.02) / 0.5, bx = gx(g, k, 8.5), by = gy(k, 63), nx = gx(g, k, 49.5), ny = gy(k, 4), pts = [];
  for (let i = 0; i <= 6; i++) { const f = i / 6; pts.push(bx - (8.5 + 12.5 * f * f) * q, by - f * 29 * q); }
  for (let i = 6; i >= 0; i--) { const f = i / 6; pts.push(bx + (8.5 + 12.5 * f * f) * q, by - f * 29 * q); }
  glyph(g, k, { color: K.yellow });
  if (a.ak < 0.02) return;
  polyO(pts, K.yellow, 3 * q);
  ovalO(bx, by - 29 * q, 22 * q, 6 * q, K.orange, 0, 2.5 * q);
  oval(bx, by - 29.5 * q, 16 * q, 3.6 * q, K.ink);
  line(nx, ny, nx + 8 * q, ny - 12 * q, 12 * q, K.ink); line(nx, ny, nx + 8 * q, ny - 12 * q, 7 * q, K.yellow);
  boxO(nx + 15 * q, ny - 16 * q, 16 * q, 8 * q, K.ink, -0.35, 2 * q, 2.4 * q); box(nx + 11 * q, ny - 15 * q, 4 * q, 9 * q, K.orange, -0.35);
  line(gx(g, k, 44), gy(k, 14), gx(g, k, 44), gy(k, 56), 3 * q, K.yellowL);          // a shine along the tube
  for (let i = 0; i < 5; i++) discO(nx, gy(k, 17 + i * 11.2), 5.2 * q, (Math.floor(beat * 2) + i) % 2 === 0 ? K.teal : K.white, 2 * q);       // keys that chase each other
}

/* ---------- L: leaves ---------- */
const LEAVES = [K.orange, K.red, K.yellow, K.orangeD, K.yellowL], VEINS = [K.orangeD, K.redD, K.orangeD, K.redD, K.orange];
const LF = { x: 0, y: 0, s: 0, r: 0, w: 1, m: 0 };                 // the leaf a leafBits callback is placing: where, how big, turned, how wide, maple or plain
const MAPLE = [];
for (let i = 0; i < 36; i++) {                                     // a maple outline: three long lobes and two short, with serrations, mirrored
  const d = (i < 18 ? i : 36 - i) * 10, an = d * PI / 180;
  const lobe = Math.max(1 - d / 26, 0.92 * Math.max(0, 1 - Math.abs(d - 62) / 26), 0.62 * Math.max(0, 1 - Math.abs(d - 118) / 24), 0.22), r = (0.34 + 0.66 * lobe) * (i % 2 ? 0.9 : 1);
  MAPLE.push((i < 18 ? 1 : -1) * S(an) * r, -C(an) * r);
}
const MAPLE_VEINS = [0, 0.45, 0, -0.9, 0, 0.45, 0.55, -0.55, 0, 0.45, -0.55, -0.55, 0, 0.45, 0.72, 0.1, 0, 0.45, -0.72, 0.1, 0, 0.45, 0, 1.25];
const PLAIN_VEINS = [0, -0.85, 0, 1.25, 0, 0.35, 0.42, -0.05, 0, 0.35, -0.42, -0.05, 0, -0.15, 0.36, -0.5, 0, -0.15, -0.36, -0.5];
function addLeaf(c, vein) {                                        // adds the leaf described by LF (or its veins) to the current path
  c.save(); c.translate(LF.x, LF.y); c.rotate(LF.r); c.scale(LF.w * LF.s, LF.s);
  if (vein) { const v = LF.m ? MAPLE_VEINS : PLAIN_VEINS; for (let i = 0; i < v.length; i += 4) { c.moveTo(v[i], v[i + 1]); c.lineTo(v[i + 2], v[i + 3]); } }
  else if (LF.m) { c.moveTo(MAPLE[0], MAPLE[1]); for (let i = 2; i < MAPLE.length; i += 2) c.lineTo(MAPLE[i], MAPLE[i + 1]); c.closePath(); }
  else { c.moveTo(0, -1); c.quadraticCurveTo(0.85, -0.15, 0, 1); c.quadraticCurveTo(-0.85, -0.15, 0, -1); }
  c.restore();
}
function leafBits(cols, veins, n, place) {                         // place(i) fills LF for the i-th of n leaves; one fill and one stroke of veins per colour
  const c = raw(), nc = cols.length;
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let j = 0; j < nc && j < n; j++) {
    c.fillStyle = cols[j]; c.beginPath();
    for (let i = j; i < n; i += nc) { place(i); if (LF.s > 0.5) addLeaf(c, false); }
    c.fill();
    c.strokeStyle = veins[j]; c.beginPath();
    let sum = 0, cnt = 0;
    for (let i = j; i < n; i += nc) { place(i); if (LF.s > 0.5) { addLeaf(c, true); sum += LF.s; cnt++; } }
    c.lineWidth = Math.max(1, 0.07 * sum / (cnt || 1)); c.stroke();
  }
}
function pinwheel(x, y, n, r, rot, curl, col, fill) {              // n curved blades out to radius r, each filling `fill` of its slot
  const c = raw();
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + i / n * TAU, a1 = a0 + TAU / n * fill;
    c.moveTo(x, y); c.quadraticCurveTo(x + C(a0 + curl * 0.5) * r * 0.55, y + S(a0 + curl * 0.5) * r * 0.55, x + C(a0 + curl) * r, y + S(a0 + curl) * r);
    c.lineTo(x + C(a1 + curl) * r, y + S(a1 + curl) * r); c.quadraticCurveTo(x + C(a1 + curl * 0.5) * r * 0.55, y + S(a1 + curl * 0.5) * r * 0.55, x, y);
  }
  c.fill();
}
const LS = 0.8, LP = [0, 0, 0, 1, 1, 1];
// the falling L: swings like a pendulum that runs down, drifting in from the left, then squashes on the ground at t = 1.78
function leafPose(a, t, o) {
  const { u, k, w, h } = a, H2 = 50 * k * LS * a.hs, tf = seg(t, 0.02, 1.78), amp = (1 - tf) ** 0.7, Lp = Math.min(0.5 * w, 0.55 * h), age = Math.max(0, t - 1.78), ground = h * 0.15;
  const th = -0.66 * a.x(0.25) * amp * C(4.41 * (t - 0.02)), sq = Math.exp(-6.5 * age) * C(TAU * 2.1 * age) * sat(age / 0.03), sy = 1 - 0.3 * sq;
  const fit = Math.min(1, (0.5 * w - 0.3 * u * LS * a.hs) / (Lp * S(0.66 * a.x(0.25)) + 0.16 * w));       // narrow screens get a smaller swing
  o[0] = fit * (-w * 0.16 * (1 - E.out(tf)) + Lp * S(th));
  o[1] = age > 0 ? ground - H2 * sy : lerp(-0.44 * h + 0.25 * H2, ground - H2, 0.75 * tf + 0.25 * E.out2(tf)) - Lp * (1 - C(th)) * 0.25;
  o[2] = th + 0.1 * S(t * 7) * amp + 0.05 * sq; o[3] = age > 0 ? 1 + 0.22 * sq : 1 - 0.12 * Math.abs(S(t * 3.9)); o[4] = sy; o[5] = LS;
  return o;
}
// the letter is the leaf: veins down its middle and out to the sides, and a stalk
function leafBody(a) {
  const { k, g } = a, q = k * a.ak, c = raw();
  glyph(g, k, { color: K.red });
  if (a.ak < 0.02) return;
  glyphInk(g, k, {}, K.orangeL, 3 * a.ak);
  c.strokeStyle = K.orangeL; c.lineWidth = 2.2 * q; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i < 5; i++) { const y = 20 + i * 14; c.moveTo(gx(g, k, 8.5), gy(k, y)); c.lineTo(gx(g, k, 8.5 + (i & 1 ? -6 : 6)), gy(k, y - 6)); }
  for (let i = 0; i < 3; i++) { const x = 21 + i * 12; c.moveTo(gx(g, k, x), gy(k, 91.5)); c.lineTo(gx(g, k, x + 5), gy(k, 91.5 + (i & 1 ? 6 : -6))); }
  c.stroke();
  const sx = gx(g, k, 8.5), sy = gy(k, 2);                             // the stalk
  line(sx, sy, sx + 4.5 * q, sy - 14 * q, 8 * q, K.ink); line(sx, sy, sx + 4.5 * q, sy - 14 * q, 3.6 * q, K.orangeD);
}

/* ---------- M: the monster ---------- */
const MS = 0.68, MP = [0, 0, 0, 1, 1, 1], MQ = [0, 0, 0, 1, 1, 1], FP = [0, 0], FT = [0, 0], ROAR_COLS = [K.white, K.lime, K.yellow, K.pinkL, K.white];
const SPITS = [[1.26, 16, 61, [K.white, K.lime, K.yellow]], [1.98, 12, 71, [K.lime, K.yellow, K.white, K.purpleL]]];     // spit on each roar: when, how many, seed, colours
const HORN = [-5, 6, -7, -7, -6, -21, 2, -12, 10, -3, 14, 6];                                  // a horn leaning out of the top of a stem (glyph units)
const PEAKS = [[8.5, 1.05], [8.5, 1.3], [8.5, 1.55], [81.5, 1.45], [81.5, 1.7], [81.5, 1.95]];     // fur round the two top corners: where, and which way (in half turns)
const roarAt = t => Math.max(E.out(seg(t, 1.2, 1.32)) * (1 - E.io(seg(t, 1.55, 1.9))), 0.55 * E.out(seg(t, 1.98, 2.08)) * (1 - E.io(seg(t, 2.12, 2.3))));
const inhaleAt = t => Math.max(E.io(seg(t, 0.95, 1.2)) * (1 - seg(t, 1.2, 1.26)), 0.5 * E.io(seg(t, 1.85, 1.98)) * (1 - seg(t, 1.98, 2.02)));
// standing on the ground: squashed as it breathes in, stretched and trembling as it roars
function monsterPose(a, t, o) {
  const { u, k, h } = a, roar = roarAt(t), inh = inhaleAt(t), sy = 1 + 0.17 * a.x(0.1) * roar - 0.13 * inh + 0.015 * S(t * 7), H2 = 50 * k * MS * a.hs;
  o[0] = 0; o[1] = h * 0.27 - H2 * sy - u * 0.03 * roar * a.x(0.3); o[2] = 0.05 * S(t * 4.3) * (1 - roar) + 0.025 * roar * S(t * 66); o[3] = 1 - 0.13 * roar + 0.1 * inh; o[4] = sy; o[5] = MS;
  return o;
}
function shock(x, y, t, t0, dur, r0, r1, lw, col) {               // a ring growing from r0 to r1, thinning as it goes
  const p = seg(t, t0, t0 + dur);
  if (p > 0 && p < 1) ring(x, y, r0 + (r1 - r0) * E.out(p), Math.max(1, lw * (1 - p * p)), col);
}
// the fly that circles the monster (glyph units) until the roar blows it away
function flyPos(t, o) {
  const tb = 1.26, tt = Math.min(t, tb), x = 45 + 64 * C(tt * 3.1), y = 30 + 34 * S(tt * 4.3);
  if (t <= tb) { o[0] = x; o[1] = y; return o; }
  const age = t - tb, dx = x - 45, dy = y - 88, d = Math.hypot(dx, dy) || 1, run = 420 * age * (1 + age * 2);
  o[0] = x + dx / d * run; o[1] = y + dy / d * run;
  return o;
}
function tuft(c, x, y, nx, ny, len, bw, lean, o) {                // a triangle on the edge at (x, y): base across it, tip out along (nx, ny), leaning along the edge
  const tx = -ny, ty = nx;
  c.moveTo(x - tx * (bw + o), y - ty * (bw + o)); c.lineTo(x + nx * (len + o * 1.6) + tx * lean, y + ny * (len + o * 1.6) + ty * lean); c.lineTo(x + tx * (bw + o), y + ty * (bw + o)); c.closePath();
}
function monsterBody(a, t, roar, inhale, grow) {
  const { k, g } = a, q = k * a.ak, c = raw(), X = n => gx(g, k, n), Y = n => gy(k, n);
  if (a.ak < 0.02) { glyph(g, k, { color: K.purple }); return; }
  ovalO(X(4), Y(97), 14 * q, 7 * q, K.violetD, 0, 3 * q); ovalO(X(86), Y(97), 14 * q, 7 * q, K.violetD, 0, 3 * q);          // feet, and arms waving behind the body
  for (let sd = -1; sd <= 1; sd += 2) {
    const ph = t * 9 + (sd > 0 ? 1.7 : 0), sx0 = sd < 0 ? 2 : 88, hx = sd < 0 ? lerp(-30 + 7 * S(ph), -22, roar) : lerp(120 - 7 * S(ph), 112, roar), hy = lerp(26 + 9 * C(ph), 2, roar);
    const px = X(sx0) + (X(hx) - X(sx0)) * a.ak, py = Y(52) + (Y(hy) - Y(52)) * a.ak;             // (the hand comes back to the shoulder as it lands)
    limbO(X(sx0), Y(52), px, py, 24 * q, 24 * q, sd, 12 * q, K.purple, 3 * q);
    discO(px, py, 9 * q, K.purple, 3 * q);
    for (let j = -1; j <= 1; j++) tri(px + sd * 9 * q, py + j * 6 * q, 3.4 * q, j * 0.5 + (sd < 0 ? PI : 0), K.cream);           // claws
  }
  for (let pass = 0; pass < 2; pass++) {                            // fur: tufts along both edges of the stroke and round the peaks, drawn twice (dark outline, then fur)
    const o = pass ? 0 : 1.8 * q;
    c.fillStyle = pass ? K.purple : K.ink; c.beginPath();
    for (let i = 0; i < 120; i++) {
      const side = i & 1 ? 1 : -1, f = ((i >> 1) + 0.5) / 60, tr = trace(g, k, f), hx = tr[0], hy = tr[1], hd = tr[2], nx = -S(hd) * side, ny = C(hd) * side;
      tuft(c, hx + nx * 8 * q, hy + ny * 8 * q, nx, ny, (8 + 9 * a.r(i, 1)) * q * grow * (1 + 0.7 * roar + 0.25 * S(t * 8 + f * 50)), 4 * q * grow, (3 * S(t * 5 + i) - 5 * roar * side) * q, o);
    }
    for (let i = 0; i < PEAKS.length; i++) {
      const an = PEAKS[i][1] * PI;
      tuft(c, X(PEAKS[i][0]) + C(an) * 8 * q, Y(8.5) + S(an) * 8 * q, C(an), S(an), (9 + 5 * a.r(i, 9)) * q * grow * (1 + 0.6 * roar), 5 * q * grow, 0, o);
    }
    c.fill();
  }
  glyph(g, k, { color: K.purple });
  glyphInk(g, k, {}, K.violet, 9 * a.ak, [0.1, 21]);                // spots
  for (let sd = -1; sd <= 1; sd += 2) {                             // horns, leaning out
    const pts = [], rx = X(sd < 0 ? 8.5 : 81.5), ry = Y(8.5);
    for (let j = 0; j < HORN.length; j += 2) pts.push(rx - sd * HORN[j] * q, ry + (HORN[j + 1] - 8.5) * q);
    polyO(pts, K.cream, 2.6 * q);
  }
  const fp = flyPos(t, FP), gz = t > 1.5 ? 0 : 1, lx = clamp((fp[0] - 45) / 38, -1, 1) * gz, ly = clamp((fp[1] - 31) / 38, -1, 1) * gz;
  bigEye(X(45), Y(30), 19 * q, lx, ly, (t % 1.3) < 0.09 ? 0.1 : 1 - 0.45 * roar, 3.4 * q);        // the eye, in the notch of the M, watching the fly
  if (roar > 0.2) line(X(24), Y(6 - 3 * roar), X(62), Y(12 + 3 * roar), 7 * q * roar, K.ink);       // an angry brow
  mouth(g, k, q, clamp(roar + 0.12, 0, 1), inhale);
  if (t < 1.75) {                                                   // the fly, with a trail
    const fx = X(fp[0]), fy = Y(fp[1]);
    for (let j = 4; j >= 1; j--) { const pq = flyPos(t - j * 0.07, FT); disc(X(pq[0]), Y(pq[1]), (3.4 - j * 0.6) * q, K.ink); }
    oval(fx - 3.6 * q, fy - 6 * q, 8 * q, 3.6 * q, K.white, -0.5 + 0.7 * S(t * 90)); oval(fx + 3.6 * q, fy - 6 * q, 8 * q, 3.6 * q, K.white, 0.5 - 0.7 * S(t * 90));
    discO(fx, fy, 5.4 * q, K.red, 2 * q);
  }
}
function bigEye(x, y, r, lx, ly, sq, ol) {                         // a googly eye that squashes shut: white, a lime iris, a big pupil that swings toward (lx, ly)
  const c = raw();
  c.save(); c.translate(x, y); c.scale(1, Math.max(0.06, sq));
  disc(0, 0, r + ol, K.ink); disc(0, 0, r, K.white); disc(lx * r * 0.3, ly * r * 0.3, r * 0.64, K.lime); disc(lx * r * 0.42, ly * r * 0.42, r * 0.36, K.ink); disc(lx * r * 0.42 - r * 0.12, ly * r * 0.42 - r * 0.14, r * 0.12, K.white);
  c.restore();
}
// the grin between the legs: a zigzag of teeth along the top; when it roars, a wide open mouth with a tongue and bottom teeth
function mouth(g, k, q, open, inhale) {
  const c = raw(), cx = gx(g, k, 45), y0 = gy(k, 79), W = (22 + 6 * open) * q, D = (6 + 14 * open - 3 * inhale) * q, th = (4.5 + 4 * open) * q, n = 6;
  c.fillStyle = K.ink; c.beginPath(); c.moveTo(cx + W, y0); c.ellipse(cx, y0, W, Math.max(0.1, D), 0, 0, PI); c.closePath(); c.fill();
  if (open > 0.3) oval(cx, y0 + D * 0.72, W * 0.5, D * 0.28, K.pink);
  c.fillStyle = K.white; c.beginPath(); c.moveTo(cx - W, y0);
  for (let i = 0; i < n; i++) { c.lineTo(cx - W + (i + 0.5) * 2 * W / n, y0 + th); c.lineTo(cx - W + (i + 1) * 2 * W / n, y0); }
  c.closePath();
  if (open > 0.3) for (let i = 0; i < 4; i++) { const an = PI * (0.24 + 0.17 * i), bx = cx + C(an) * W, by = y0 + S(an) * D; c.moveTo(bx - 3.6 * q, by); c.lineTo(bx, by - 6 * q * open); c.lineTo(bx + 3.6 * q, by); c.closePath(); }
  c.fill();
}

/* ---------- N: the ninja ---------- */
// the spots it teleports between (fractions of the stage) and when it arrives at each; the diagonal slashes (x, y, angle, time)
const NSPOTS = [[-0.24, 0.04], [0.24, -0.13], [-0.25, 0.1], [-0.18, -0.2], [0, 0.03]], NARR = [0.02, 0.66, 1.08, 1.5, 1.8];
const SLASHES = [[0.24, -0.13, 0.6, 1.02], [-0.25, 0.1, -0.55, 1.26], [-0.1, -0.1, 0.35, 1.56], [0.1, 0.08, -0.4, 1.66]];
const NS = 0.78, NP = [0, 0, 0, 1, 1, 1, 0], NQ = [0, 0, 0, 1, 1, 1, 0];       // a pose's 7th value is which spot it is at
// crouches and throws at the first spot, somersaults at the second, spins at the third, back-flips at the fourth, then strikes its pose
function ninjaPose(a, t, o) {
  const { u, w, h } = a, sw = Math.min(w, 2.2 * u), x = a.x(0.3), H2 = 50 * a.k * NS * a.hs;
  let i = 0, rot = 0, sx = 1, sy = 1, hopY = 0;
  while (i + 1 < NARR.length && t >= NARR[i + 1]) i++;
  const nxt = i + 1 < NARR.length ? NARR[i + 1] : 9;
  if (i === 0) { const c = E.io(seg(t, 0.28, 0.42)), th = E.out(seg(t, 0.42, 0.5)), rel = 1 - seg(t, 0.5, 0.57); sy = 1 - 0.2 * c + 0.3 * th * rel; sx = 1 + 0.15 * c - 0.15 * th * rel; rot = -0.2 * c * (1 - th); }
  else if (i === 1) { const f = E.io(seg(t, 0.7, 0.96)); rot = -TAU * f; hopY = u * 0.24 * x * S(PI * f); sy = 1 - 0.18 * (1 - E.out(seg(t, 0.66, 0.72))); }
  else if (i === 2) { sx = C(TAU * 2 * E.io(seg(t, 1.14, 1.4))); hopY = u * 0.05 * S(PI * seg(t, 1.14, 1.4)); }
  else if (i === 3) { const f = E.io(seg(t, 1.52, 1.7)); rot = TAU * f; hopY = u * 0.2 * x * S(PI * f); }
  else { const l = E.out(seg(t, 1.8, 1.9)), sq = Math.exp(-7 * (t - 1.8)) * C(TAU * 2 * (t - 1.8)); rot = -0.16 * l; sy = 1 - 0.22 * sq; sx = 1 + 0.16 * sq; }
  o[0] = NSPOTS[i][0] * sw; o[1] = NSPOTS[i][1] * h - hopY + (1 - sy) * H2; o[2] = rot; o[3] = sx; o[4] = sy;
  o[5] = NS * pop(t, NARR[i], 0.22) * (nxt < 9 ? Math.max(0, unpop(t, nxt - 0.09, 0.09)) : 1); o[6] = i;
  return o;
}
// two headband tails streaming from the knot: they hang back on the wind and swing with how the ninja has just moved
function ninjaTails(a, t, o) {
  const { u, k, g } = a, m = o[5] * a.hs * a.ak, kn = toWorld(a, o, gx(g, k, -3), gy(k, 20)), kx = kn[0], ky = kn[1], N = 7;
  const pv = toWorld(a, ninjaPose(a, t - 0.06, NQ), gx(g, k, -3), gy(k, 20)), still = NQ[6] === o[6] ? 1 / 0.06 : 0;       // (a jump to a new spot doesn't count as speed)
  const vx = (kx - pv[0]) * still, vy = (ky - pv[1]) * still;
  for (let ti = 0; ti < 2; ti++) {
    const pts = [];
    for (let j = 0; j <= N; j++) {
      const f = j / N, wig = S(t * 13 - j * 0.9 + ti * 2.1) * u * 0.03 * f * m;
      pts.push(kx - f * N * u * 0.09 * m * 0.85 - vx * f * f * 0.09 + wig * 0.3, ky + (ti ? 1 : -1) * f * u * 0.04 * m + wig - vy * f * f * 0.09 + f * f * u * 0.03 * m);
    }
    const strip = [];
    for (let j = 0; j <= N; j++) strip.push(pts[2 * j], pts[2 * j + 1] - (1 - j / N * 0.8) * 7 * k * m);
    for (let j = N; j >= 0; j--) strip.push(pts[2 * j], pts[2 * j + 1] + (1 - j / N * 0.8) * 7 * k * m);
    polyO(strip, K.red, 2.6 * k * m);
  }
}
function ninjaBody(a, t) {
  const { k, g } = a, q = k * a.ak, X = n => gx(g, k, n), Y = n => gy(k, n), blink = (t % 1.1) < 0.07 ? 0.15 : 1;
  glyph(g, k, { color: K.ink, sw: 17 - 3.5 * a.ak });                // a slimmer suit while it plays, the real glyph's weight when it lands
  if (a.ak < 0.02) return;
  glyphInk(g, k, {}, K.blue, 2.6 * a.ak);                           // a sheen along the suit
  boxO(X(46), Y(35), 27 * q, 16 * q, K.ink, 0, 6 * q, 0);           // the mask, joining the diagonal to the right stem
  for (let sd = -1; sd <= 1; sd += 2) {
    ovalO(X(46 + sd * 6.6), Y(35.5), 5.6 * q, 3.7 * q * blink, K.white, sd * -0.32, 2 * q);
    oval(X(46 + sd * 6.6) + 1.6 * q, Y(35.5), 2.1 * q, 2.3 * q * blink, K.ink);
  }
  boxO(X(37.5), Y(19), 86 * q, 13 * q, K.red, -0.03, 5 * q, 3 * q);   // the headband, with its plate
  boxO(X(38), Y(19), 14 * q, 9 * q, K.cream, -0.03, 2 * q, 2 * q); disc(X(38), Y(19), 2.2 * q, K.red);
}
function bamboo(a, t) {                                            // dark bamboo framing both sides, swaying: stalks, then lighter nodes, then leaves
  const { u, w, h } = a, c = raw(), bb = u * 0.045;
  for (let pass = 0; pass < 3; pass++) {
    c.fillStyle = pass === 1 ? NODE : K.ink; c.beginPath();
    for (let sd = -1; sd <= 1; sd += 2) for (let i = 0; i < 3; i++) {
      const yb = h * 0.5, x = sd * (0.36 + 0.055 * i) * w, yt = lerp(yb, h * BAMBOO_TOPS[i] - u * 0.1, pop(t, 0.05 + i * 0.1 + (sd + 1) * 0.05, 0.5)), sway = S(t * 1.4 + i * 1.7 + sd) * u * 0.025 * (1 + i * 0.3);
      if (pass === 0) { c.moveTo(x - bb / 2, yb); c.lineTo(x - bb / 2 + sway, yt); c.lineTo(x + bb / 2 + sway, yt); c.lineTo(x + bb / 2, yb); c.closePath(); continue; }
      for (let j = 1; j < 6; j++) {
        const nx = x + sway * j / 6, ny = lerp(yb, yt, j / 6), dir = j & 1 ? -1 : 1;
        if (pass === 1) { c.moveTo(nx - bb * 0.62, ny - bb * 0.12); c.lineTo(nx + bb * 0.62, ny - bb * 0.12); c.lineTo(nx + bb * 0.62, ny + bb * 0.12); c.lineTo(nx - bb * 0.62, ny + bb * 0.12); c.closePath(); }
        else if (j > 3) { c.moveTo(nx, ny); c.lineTo(nx + dir * u * 0.3, ny - u * 0.16 + S(t * 2 + j + i) * u * 0.02); c.lineTo(nx + dir * u * 0.06, ny + u * 0.02); c.closePath(); }
      }
    }
    c.fill();
  }
}
const BAMBOO_TOPS = [-0.02, 0.06, 0.2];                             // how high each stalk reaches (fractions of the stage height, from the centre)
function shuriken(x, y, r, rot) { star(x, y, r * 1.18, 4, r * 0.5, rot, K.ink); star(x, y, r, 4, r * 0.4, rot, K.white); disc(x, y, r * 0.2, K.ink); }
function poof(x, y, R, p, seed) {                                  // a cluster of flat white circles that puffs out and shrinks away (p runs 0..1)
  if (p <= 0 || p >= 1) return;
  const c = raw(), e = E.out(p), sh = 1 - p * p;
  for (let pass = 0; pass < 2; pass++) {                           // white, then a pale blue shade on the low side
    c.fillStyle = pass ? K.skyL : K.white; c.beginPath();
    for (let i = 0; i < 9; i++) {
      const an = hash(i, seed, 1) * TAU, d = R * (0.1 + 0.75 * hash(i, seed, 2)) * e, r = R * ((pass ? 0.1 : 0.2) + (pass ? 0.12 : 0.25) * hash(i, seed, 3)) * (0.3 + 0.7 * e) * sh, off = pass ? R * 0.1 : 0;
      addDisc(x + C(an) * d + off, y + S(an) * d * 0.85 - R * 0.3 * p + off, r);
    }
    c.fill();
  }
  for (let i = 0; i < 4; i++) spark(x + C(i * 1.6 + seed) * R * 1.3 * e, y + S(i * 1.6 + seed) * R * 1.1 * e, R * 0.18 * sh, i, K.white);
}
// a blade-shaped streak: its head races along the line from A to B and the tail follows, so it flashes by (or, with `stay`, stays)
function slash(t, t0, dur, x0, y0, x1, y1, wd, col, edge, stay) {
  const hp = E.out(seg(t, t0, t0 + dur * 0.4)), tp = stay ? 0 : E.in(seg(t, t0 + dur * 0.35, t0 + dur));
  if (hp <= 0 || tp >= 1) return;
  const ax = lerp(x0, x1, tp), ay = lerp(y0, y1, tp), bx = lerp(x0, x1, hp), by = lerp(y0, y1, hp), dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L * wd, ny = dx / L * wd;
  poly([ax, ay, ax + dx * 0.72 + nx, ay + dy * 0.72 + ny, bx, by, ax + dx * 0.72 - nx, ay + dy * 0.72 - ny], edge);
  poly([ax + dx * 0.04, ay + dy * 0.04, ax + dx * 0.72 + nx * 0.5, ay + dy * 0.72 + ny * 0.5, bx - dx * 0.02, by - dy * 0.02, ax + dx * 0.72 - nx * 0.5, ay + dy * 0.72 - ny * 0.5], col);
}

/* ---------- P: the painter ---------- */
const PS = 0.82, PP = [0, 0, 0, 1, 1, 1], PQ = [0, 0, 0, 1, 1, 1];
const PCOLS = [K.sky, K.yellow, K.purple, K.orange, K.magenta, K.blue], SPL = [K.sky, K.yellow, K.orange, K.purple, K.white, K.red, K.magenta, K.pink];
const DRIPS = [15, 60, 26, 0.9, 24, 60, 16, 1.0, 33, 60, 26, 1.1, 46, 52, 16, 1.2, 15, 17, 26, 0.75, 27, 17, 16, 0.85];      // drips off the P: where (glyph units), how long, when they start
const paintAt = t => 0.7 * E.out2(seg(t, 0.04, 1.5)) + 0.3 * seg(t, 0.04, 1.5);   // how much of the P is painted on: fast to begin with, slowing round the bowl
function paintPose(a, t, o) {                                      // it jiggles as it is painted, then squashes into place when the last stroke lands
  const H2 = 50 * a.k * PS * a.hs, age = Math.max(0, t - 1.55), sq = Math.exp(-7 * age) * C(TAU * 2.2 * age), sy = 1 - 0.26 * sq * a.x(0.15);
  o[0] = 0; o[1] = -a.h * 0.03 + (1 - sy) * H2; o[2] = t < 1.55 ? 0.03 * S(t * 9) : 0; o[3] = 1 + 0.2 * sq; o[4] = sy; o[5] = PS;
  return o;
}
function paintBody(a, t, t1) {
  const { k, g } = a, q = k * a.ak, X = n => gx(g, k, n), Y = n => gy(k, n), c = raw();
  if (a.ak > 0.02) {
    c.save(); c.translate(X(-23), Y(85)); c.scale(a.ak, a.ak);                           // the paint bucket at the foot of the stem, shrinking as it lands
    polyO([-16 * k, -13 * k, 16 * k, -13 * k, 12 * k, 13 * k, -12 * k, 13 * k], K.sky, 3 * k);
    boxO(0, 0, 26 * k, 8 * k, K.white, 0, 2 * k, 2 * k);
    ovalO(0, -13 * k, 16 * k, 4.6 * k, K.pink, 0, 2.6 * k);
    boxO(-8 * k, -5 * k, 5 * k, 12 * k * pop(t, 0.2, 0.4), K.pink, 0, 2.5 * k, 0);
    c.restore();
    if (t < 1.7) glyphInk(g, k, {}, K.white, 3 * a.ak, [5, 8]);       // a dotted sketch to paint along
    for (let i = 0; i < DRIPS.length; i += 4) {                       // drips run down off the horizontal strokes once the brush has passed
      const gr = E.out(seg(t, DRIPS[i + 3], DRIPS[i + 3] + 0.9)), len = DRIPS[i + 2] * gr;
      if (gr > 0) { boxO(X(DRIPS[i]), Y(DRIPS[i + 1] + len / 2), 6.2 * q, len * q + 6 * q, K.pink, 0, 3.1 * q, 3.4 * q); disc(X(DRIPS[i]), Y(DRIPS[i + 1] + len), 4.4 * q, K.pink); }
    }
  }
  glyph(g, k, { color: K.pink, t1: Math.max(t1, 0.0001) });
  if (a.ak < 0.02) return;
  if (t1 > 0.01) glyphInk(g, k, { t1 }, K.pinkD, 2.4 * a.ak, [9, 8]);      // brush streaks
  const tr = trace(g, k, t1), dip = E.out(seg(t, 0, 0.16)), lift = E.in(seg(t, 1.55, 1.9));       // the brush: wet bristles, a metal ferrule, a wooden handle, its tip on the paint
  c.save(); c.translate(lerp(X(-23), tr[0], dip) + 150 * q * lift, lerp(Y(66), tr[1], dip) - 190 * q * lift); c.rotate(-1.15 + 0.12 * S(t * 11) - 0.5 * lift); c.scale(1 - 0.4 * lift, 1 - 0.4 * lift);
  boxO(11 * q, 0, 22 * q, 23 * q, K.pink, 0, 9 * q, 3 * q);
  boxO(29 * q, 0, 11 * q, 25 * q, K.skyL, 0, 2 * q, 3 * q);
  boxO(62 * q, 0, 56 * q, 15 * q, K.orange, 0, 7 * q, 3 * q);
  c.restore();
}
function splat(x, y, R, col, seed, p) {                            // a flat splat: a blob with fingers and drops radiating from it (p is the pop, 0..1)
  if (p <= 0) return;
  const c = raw();
  blob(x, y, R * p, seed, 0.12, 0, col, 12);
  c.strokeStyle = col; c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    c.lineWidth = R * (pass ? 0.2 : 0.34) * p; c.beginPath();
    for (let i = pass; i < 9; i += 2) { const an = i / 9 * TAU + seed, d = R * ((pass ? 1.5 : 1.3) + (pass ? 0.9 : 0.7) * hash(i, seed, 5 + pass)) * p; c.moveTo(x + C(an) * R * 0.5, y + S(an) * R * 0.5); c.lineTo(x + C(an) * d, y + S(an) * d); }
    c.stroke();
  }
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 7; i++) { const an = i / 7 * TAU + seed * 2 + 0.3, d = R * (1.9 + 0.9 * hash(i, seed, 7)) * E.out(p); addDisc(x + C(an) * d, y + S(an) * d, R * (0.08 + 0.1 * hash(i, seed, 8)) * p); }
  c.fill();
}
function drip(x, y, len, wd, col, g) {                             // a paint drip running down from (x, y): a rounded bar that lengthens (g runs 0..1) with a fat drop at its end
  const e = E.out(g);
  if (g <= 0) return;
  box(x, y + len * e * 0.5, wd, len * e, col, 0, wd / 2); disc(x, y + len * e, wd * 0.85, col);
}

/* ---------- Q: the duck ---------- */
const QS = 0.78, QP = [0, 0, 0, 1, 1, 1, 0], QQ = [0, 0, 0, 1, 1, 1, 0], QT = [0.62, 0.92, 1.5, 1.8], QW = [0.42, 2.3], QUACK_COLS = [K.white, K.yellow, K.orange], SPLASH_COLS = [K.white, K.skyL, K.white, K.blueL];      // QT: when it quacks, QW: when it splashes in and hops out
const quackAt = t => { let v = 0; for (const q of QT) { const x = (t - q) / 0.22; if (x > 0 && x < 1) v = Math.max(v, S(PI * x)); } return v; };
const surf = (a, x, t) => a.h * 0.06 + a.u * 0.025 * S(x / (a.u * 1.6) * TAU + t * 2.4);      // the pond's surface, a sine wave
// a drop from above, a splash at t = 0.42 (QW[0]), then riding the waves (o[6] is how far it has sunk into the water, in pixels)
function duckPose(a, t, o) {
  const { u, k, h } = a, tl = 0.42, age = Math.max(0, t - tl), fall = E.in(seg(t, 0.02, tl)), qk = quackAt(t), x = Math.max(-0.17 * u * a.hs, -0.48 * a.w + 0.566 * u * QS * a.hs);
  const sq = Math.exp(-8 * age) * C(TAU * 2.5 * age), sy = (age > 0 ? 1 - 0.22 * sq : 1 + 0.14 * fall) * (1 + 0.05 * qk), sx = (age > 0 ? 1 + 0.16 * sq : 1 - 0.06 * fall) * (1 - 0.04 * qk);
  const sl = Math.atan(0.098 * C(x / (u * 1.6) * TAU + t * 2.4)), rot = age > 0 ? 0.9 * sl + 0.05 * S(t * 2.7) - 0.05 * qk : 0.3 * (1 - fall);
  const ys = surf(a, x, t), dip = age > 0 ? u * 0.1 * Math.exp(-5 * age) * C(TAU * 1.5 * age) : 0, py = age > 0 ? ys + dip : lerp(-h * 0.15, ys, fall), H = 42 * k * QS * a.hs * sy;
  o[0] = x + S(rot) * H; o[1] = py - C(rot) * H; o[2] = rot; o[3] = sx; o[4] = sy; o[5] = QS; o[6] = dip;
  return o;
}
// a crown of water spikes thrown up where something meets the surface at (x, y); p runs 0..1
function crown(a, x, y, p) {
  if (p <= 0 || p >= 1) return;
  for (let i = 0; i < 9; i++) {
    const an = -PI * (0.1 + 0.8 * i / 8), hgt = a.u * (0.26 + 0.16 * a.r(i, 5)) * S(PI * E.out(p)) * a.x(0.3), bx = x + C(an) * a.u * 0.28 * a.hs;
    poly([bx - 0.06 * a.u, y, bx + C(an) * hgt * 0.5, y + S(an) * hgt, bx + 0.06 * a.u, y], i & 1 ? K.white : K.skyL);
  }
}
// the Q is the duck's body; a head with an eye and a beak that opens, a wing in the ring, and the Q's tail flicking
function duckBody(a, t, qk, dip) {
  const { k, g } = a, q = k * a.ak, X = n => gx(g, k, n), Y = n => gy(k, n), c = raw();
  c.save(); c.beginPath(); c.rect(-9999, -9999, 19998, 9999 + Y(95) - dip / (QS * a.hs) + (1 - a.ak) * 9999); c.clip();      // the bottom of the belly is under the water
  const flick = (0.6 * S(t * 16) * qk + 0.08 * S(t * 3)) * a.ak, tx = 50 + 21 * C(flick) - 28 * S(flick), ty = 62 + 21 * S(flick) + 28 * C(flick);
  glyph(g, k, { color: K.yellow, parts: [null, { r: flick, px: 50, py: 62 }] });
  if (a.ak > 0.02) {
    ovalO(X(tx + 5), Y(ty - 4), 10 * q, 3.8 * q, K.yellow, -0.7 + flick, 2.4 * q); ovalO(X(tx + 6), Y(ty), 9 * q, 3.4 * q, K.yellow, -0.2 + flick, 2.4 * q);         // tail feathers
    const wa = -0.25 - 0.9 * qk + 0.12 * S(t * 5), open = qk * 0.5, bx = X(4), by = Y(15.5);         // the wing flicks up on every quack
    ovalO(X(40) + S(-wa) * 12 * q, Y(40) + C(wa) * 12 * q, 8 * q, 15 * q, K.orange, wa, 2.6 * q);
    line(X(40) + S(-wa) * 5 * q, Y(40) + C(wa) * 5 * q, X(40) + S(-wa) * 17 * q, Y(40) + C(wa) * 17 * q, 2 * q, K.yellow);
    discO(X(17), Y(15), 15 * q, K.yellow, 3.2 * q);                 // the head, with a blush
    disc(X(20), Y(23), 3.6 * q, K.pinkL);
    ovalO(bx - 8 * q, by - 2.5 * q - open * 3 * q, 10 * q, 3.8 * q, K.orange, -0.05 - open * 0.3, 2.6 * q);          // the beak: two halves that open
    ovalO(bx - 6 * q, by + 3.6 * q + open * 3 * q, 8 * q, 3.2 * q, K.orange, 0.05 + open * 0.35, 2.6 * q);
    disc(X(21), Y(9), 6.2 * q, K.ink); eye(X(21), Y(9), 5 * q, -0.5 + 0.9 * S(t * 1.3) * (1 - qk), 0.2);
  }
  c.restore();
}

/* ---------- R: the roller skater ---------- */
const RS = 0.52, RP = [0, 0, 0, 1, 1, 1], RQ = [0, 0, 0], RIB = new Float32Array(5 * 59), RAINBOW = [K.red, K.orange, K.yellow, K.green, K.sky, K.violet], DISCS = [K.pinkD, K.magentaM, K.pinkL];
const rollF = t => { const x = seg(t, 0.05, 1.55); return 0.6 * E.out2(x) + 0.4 * x; };      // how far along the path it has got: a fast start, then gliding to a stop
// a point on the path: [x, y, direction of travel] a fraction f along it (f may run a little either side of 0..1). The path is a sine wave laid along a line
// from the left edge to the right, tilted down toward the bottom right on a tall screen, and never bent tighter than the ribbon is wide.
function rollPath(a, f, o) {
  const { u, w, h, k } = a, hh = 119 * k * RS * a.hs, rw = 0.055 * u * a.x(0.3), yTop = -0.44 * h + hh + 0.03 * h, yBot = 0.3 * h, yc = (yTop + yBot) / 2, tall = clamp((h / w - 0.9) * 1.2, 0, 1);
  const x0 = lerp(-0.44, -0.34, tall) * w, x1 = lerp(0.3, 0, tall) * w, y0 = lerp(yc, yTop + 0.08 * h, tall), y1 = lerp(yc, yBot, tall), dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const A = Math.min(Math.max(0.1 * h, (yBot - yTop) / 2) * (1 - 0.4 * tall), 0.32 * L, L * L / (TAU * TAU * 3.6 * rw)), nx = -dy / L, ny = dx / L, ph = TAU * f + 0.9, wv = A * S(ph), dw = A * TAU * C(ph);
  o[0] = x0 + dx * f + nx * wv; o[1] = y0 + dy * f + ny * wv; o[2] = Math.atan2(dy + ny * dw, dx + nx * dw);
  return o;
}
// riding the path leaning into its slope; at the end it spins (twice, or three times for a capital) and holds a pose
function rollPose(a, t, o) {
  const { k } = a, P = rollPath(a, rollF(t), RQ), D = 69 * k * RS * a.hs, sp = E.io(seg(t, 1.55, 1.95)), pose = E.out(seg(t, 1.9, 2.05)), age = Math.max(0, t - 1.95), rot = (0.55 * P[2] + 0.1) * (1 - pose) - 0.1 * pose;
  o[0] = P[0] + S(rot) * D; o[1] = P[1] - C(rot) * D - a.u * 0.1 * S(PI * sp) * a.x(0.3); o[2] = rot + 0.06 * S(t * 30) * (1 - seg(t, 1.4, 1.6)); o[3] = C(TAU * (a.big ? 3 : 2) * sp);
  o[4] = 1 - 0.1 * Math.exp(-7 * age) * C(TAU * 2 * age); o[5] = RS;
  return o;
}
// six stripes along the path so far, on a dark ribbon, tapering to a point under the skater
function ribbon(a, f) {
  const { k } = a, c = raw(), rw = 0.055 * a.u * a.x(0.3), N = 48, M = 10, f0 = -0.15, dT = 3.4 * rw / (1.1 * (rollPath(a, 1, RQ)[0] - rollPath(a, 0, RQ)[0]));
  for (let i = 0; i <= N + M; i++) {                               // per point: where it is, its normal, and how much the ribbon has narrowed there
    const q = rollPath(a, i <= N ? lerp(f0, f - dT, i / N) : lerp(f - dT, f, (i - N) / M), RQ);
    RIB[5 * i] = q[0]; RIB[5 * i + 1] = q[1]; RIB[5 * i + 2] = -S(q[2]); RIB[5 * i + 3] = C(q[2]); RIB[5 * i + 4] = i <= N ? 1 : Math.sqrt(Math.max(0, 1 - ((i - N) / M) ** 2));
  }
  c.beginPath();
  for (let i = 0; i <= N + M; i++) { const e = 3 * rw * RIB[5 * i + 4] + 3.5 * k; if (i) c.lineTo(RIB[5 * i] + RIB[5 * i + 2] * e, RIB[5 * i + 1] + RIB[5 * i + 3] * e); else c.moveTo(RIB[0] + RIB[2] * e, RIB[1] + RIB[3] * e); }
  for (let i = N + M; i >= 0; i--) { const e = 3 * rw * RIB[5 * i + 4] + 3.5 * k; c.lineTo(RIB[5 * i] - RIB[5 * i + 2] * e, RIB[5 * i + 1] - RIB[5 * i + 3] * e); }
  c.closePath(); c.fillStyle = K.ink; c.fill();
  c.lineCap = 'butt'; c.lineJoin = 'round'; c.lineWidth = rw * 1.04;
  for (let j = 0; j < 6; j++) {
    c.beginPath();
    for (let i = 0; i <= N + M; i++) { const off = (j - 2.5) * rw * RIB[5 * i + 4], x = RIB[5 * i] + RIB[5 * i + 2] * off, y = RIB[5 * i + 1] + RIB[5 * i + 3] * off; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.strokeStyle = RAINBOW[j]; c.stroke();
  }
}
// the R, with a roller skate under each foot (a white boot, a plate and two wheels); the leg kicks up in the final pose
function skateBody(a, t, f) {
  const { k, g } = a, q = k * a.ak, c = raw(), lr = -0.55 * E.out(seg(t, 1.9, 2.05)) * a.ak;
  glyph(g, k, { color: K.sky, parts: [null, { r: lr, px: 33, py: 51.5 }] });
  if (a.ak < 0.02) return;
  for (let i = 0; i < 2; i++) {
    const fx = i ? 33 + 27 * C(lr) - 40 * S(lr) : 8.5, fy = i ? 51.5 + 27 * S(lr) + 40 * C(lr) : 91.5;
    c.save(); c.translate(gx(g, k, fx), gy(k, fy)); c.rotate(i ? lr : 0);
    boxO(0, 12 * q, 26 * q, 5 * q, K.ink, 0, 2 * q, 0);
    ovalO(4 * q, 4 * q, 15 * q, 8 * q, K.white, 0, 2.6 * q); box(4 * q, 7 * q, 26 * q, 3 * q, K.red, 0, 1.5 * q);
    for (let wi = 0; wi < 2; wi++) {
      const wx = (wi ? 12 : -5) * q, wy = 18 * q, ws = f * 90 + wi;
      discO(wx, wy, 5.8 * q, K.yellow, 2.4 * q); line(wx, wy, wx + C(ws) * 4 * q, wy + S(ws) * 4 * q, 1.8 * q, K.ink);
    }
    c.restore();
  }
}
