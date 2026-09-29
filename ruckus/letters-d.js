// U to Z: a flying saucer, a volcano, a whale's tail, a treasure map, a slingshot and a zipper. Same contract as
// letters.js: each entry is { color, bg, dur, back(a, t), draw(a, t) }, pure functions of t, drawn around the scene's centre.
import {
  K, E, S, C, TAU, PI, sat, clamp, seg, lerp, pop, unpop, spring, wob, rays, disc, discO, ring, oval, ovalO, box, boxO, line, pline, poly, star, spark, crescent,
  drop, leaf, cloud, bird, blob, wave, balloon, band, pie, arcS, bits, addDisc, addBox, addStar, spray, fall, pulse, glyph, gpath, gx, gy, alpha, raw,
} from './kit.js';

export const SCENES = {
  /* U: a flying saucer wobbles in, beams up a cow, some people and stars while an alien peeks out, zooms off and comes back */
  U: {
    color: K.lime, bg: K.indigo, dur: 3.0,
    back(a, t) {
      const { u, k, w, h } = a, R = Math.hypot(a.bw, a.bh) / 2, cy = -h * 0.12, ground = h * 0.3;
      rays(0, cy, 20, R, S(t * 0.25) * 0.12, K.indigoM, 0.4);                     // a slow searchlight sunburst behind the saucer
      bits([K.white, K.yellowL, K.skyL], a.n(34), i => {                          // twinkling stars
        const tw = 0.5 + 0.5 * S(t * (2 + a.r(i, 4) * 3) + i * 1.9), r = u * (0.02 + a.r(i, 3) * 0.05) * tw;
        addStar((a.r(i, 1) - 0.5) * w * 1.5, (a.r(i, 2) * 1.3 - 0.62) * h, r, r * 0.3, 4, a.r(i, 5) * PI);
      });
      for (let i = 0; i < (a.big ? 3 : 0); i++) miniUfo((((t * 0.3 + i * 0.37) % 1.2) - 0.1) * w * (i & 1 ? -1 : 1) + (i & 1 ? w * 0.5 : -w * 0.5), -h * (0.4 - i * 0.12) + S(t * 3 + i) * u * 0.02, u * 0.11, t * 8 + i);   // friends
      const bob = i => S(t * 1.3 + i * 2) * h * 0.008;
      ringedPlanet(-w * 0.34, -h * 0.25 + bob(0), u * 0.3 * pop(t, 0.05, 0.5), K.orange, K.orangeD, K.yellowL, -0.35);
      ringedPlanet(-w * 0.42, h * 0.08 + bob(1), u * 0.09 * pop(t, 0.2, 0.5), K.teal, K.tealD, K.white, 0.4);
      const pr = u * 0.2 * pop(t, 0.12, 0.5), px = w * 0.37, py = -h * 0.02 + bob(2);
      disc(px, py, pr, K.pinkD); disc(px - pr * 0.1, py - pr * 0.1, pr * 0.88, K.pink);
      bits([K.pinkD], 3, i => addDisc(px + [-0.3, 0.25, 0][i] * pr, py + [-0.2, -0.05, 0.42][i] * pr, pr * [0.16, 0.11, 0.13][i]));
      crescent(w * 0.31, -h * 0.34 + bob(3), u * 0.13 * pop(t, 0.25, 0.4), -0.6, K.yellowL);
      for (let i = 0; i < 2; i++) {                                               // shooting stars
        const f = ((t * 0.5 + i * 0.55) % 2.2) / 1.1;
        if (f < 1) { const x = w * (0.5 - f * 1.1 - i * 0.3), y = -h * (0.42 - f * 0.25 + i * 0.1); line(x, y, x + u * 0.5, y - u * 0.16, 4 * k * (1 - f), K.white); disc(x, y, 5 * k * (1 - f), K.yellow); }
      }
      band(-a.bw / 2, a.bw / 2, ground - h * 0.03, h * 0.03, w * 0.55, 1.2, K.greenD, a.bh);       // the fields, with a barn
      band(-a.bw / 2, a.bw / 2, ground, h * 0.015, w * 0.9, 2, K.green, a.bh);
      const bx = -w * 0.36, by = ground + h * 0.015 * S(bx / (w * 0.9) * TAU + 2);
      poly([bx - 0.11 * u, by - 0.1 * u, bx, by - 0.19 * u, bx + 0.11 * u, by - 0.1 * u], K.redD);
      box(bx, by - 0.05 * u, 0.2 * u, 0.1 * u, K.red); box(bx, by - 0.035 * u, 0.06 * u, 0.07 * u, K.cream, 0, 3 * k);
      for (let i = -6; i < 6; i += 2) poly([i * w * 0.02, ground + h * 0.03, (i + 1) * w * 0.02, ground + h * 0.03, (i + 1) * w * 0.3, ground + h * 0.7, i * w * 0.3, ground + h * 0.7], K.greenD);       // furrows fanning out
      for (let i = 0, m = Math.min(u, w * 0.5); i < 4; i++) ringE(0, ground + h * 0.075, m * (0.2 + i * 0.22 + 0.05 * S(t * 2 - i)), m * (0.03 + i * 0.03), 0, 5 * k, K.lime);      // a crop circle under the beam
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, ak = a.ak, N = a.n(6), c = raw();
      const unit = Math.min(k * 0.68 * hs, w * 0.8 / 140, h * 0.56 / 136), s = unit / (k * hs);
      const homeY = -h * 0.46 + 78 * unit, ground = h * 0.3;
      // where the saucer is: it wobbles in, hovers, winds up, zooms off up and to the right and comes back from the left
      const arrive = 1 - E.out(seg(t, 0.03, 0.95)), wind = seg(t, 1.8, 1.92), away = seg(t, 1.9, 2.08), back = seg(t, 2.14, 2.5);
      let px = -w * 0.3 * arrive, py = homeY + h * 0.2 * arrive * arrive + S(t * 4.4) * u * 0.012, rot = 0.4 * arrive * S(t * 8) + 0.05 * S(t * 3.1), sx = 1, sy = 1, dx = 0, dy = 0;
      if (t > 1.8 && t < 2.1) {
        const f = E.in(away);
        px = lerp(-w * 0.03 * wind, w * 1.1, f); py = lerp(homeY + h * 0.02 * wind, homeY - h * 0.8, f); rot = lerp(-0.14 * wind, 0.5, f);
        sx = 1 + 0.1 * wind + 0.5 * f; sy = 1 - 0.16 * wind - 0.2 * f; dx = 1; dy = -0.7;
      } else if (t >= 2.1) {
        const f = E.outBack(back), r = 1 - f;
        px = -w * 1.1 * r; py = homeY - h * 0.7 * r; rot = 0.45 * r + 0.2 * wob(t - 2.4, 2.4, 3.5) + (a.big ? TAU * r : 0); sx = 1 + 0.4 * r; sy = 1 - 0.14 * r;
        dx = 1; dy = 0.6;
      }
      const yB = py + 46 * unit;
      // the tractor beam: a wide translucent cone, energy rings running up it, a lit patch of grass
      const grow = E.out(seg(t, 0.52, 0.86)), shut = 1 - E.in(seg(t, 1.78, 1.9)), bm = grow * shut, tw = 24 * unit, bwd = u * 0.5 * a.x(0.25) * (0.94 + 0.06 * S(t * 9));
      const hwAt = y => lerp(tw, bwd, sat((y - yB) / Math.max(1, ground - yB))), L = (ground - yB) * bm;
      if (bm > 0.01) {
        const hb = lerp(tw, bwd, bm);
        alpha(0.3); poly([px - tw, yB, px - hb, yB + L, px + hb, yB + L, px + tw, yB], K.white);
        alpha(0.24); poly([px - tw * 0.5, yB, px - hb * 0.55, yB + L, px + hb * 0.55, yB + L, px + tw * 0.5, yB], K.white);
        alpha(0.5); line(px - tw, yB, px - hb, yB + L, 3 * k, K.white); line(px + tw, yB, px + hb, yB + L, 3 * k, K.white);
        alpha(0.3); oval(px, ground + h * 0.02, hb * 1.05, h * 0.05 * bm, K.white); alpha(1);
        for (let i = 0; i < 5; i++) { const f = (t * 1.1 + i / 5) % 1, y = yB + L * (1 - f), hw = hwAt(y) * bm; alpha(0.55 * S(f * PI)); ringE(px, y, hw, hw * 0.16, 0, 3 * k, K.white); }
        alpha(1);
      }
      // what it picks up: each item rises in a spiral, shrinking into the hull, which bumps as it lands
      let bump = 0;
      for (let i = 0; i < N; i++) {
        const ts = 0.62 + i * 0.5 / N, D = 0.6 + 0.14 * a.r(i, 7), tau = (t - ts) / D, kind = ITEMS[i % ITEMS.length];
        if (tau > 1) { const q = (t - ts - D) / 0.25; if (q > 0 && q < 1) { bump += 0.08 * S(q * PI); const r = u * 0.16 * S(q * PI); spark(px, yB, r, q * 3 + i, K.yellow); spark(px, yB, r * 0.5, q * 2, K.white); } }
        if (tau <= 0 || tau >= 1 || bm < 0.5) continue;
        const f = lerp(tau, tau * tau, 0.6), y = lerp(ground - u * 0.02, yB, f), x0 = (a.r(i, 1) - 0.5) * bwd * 1.3;
        const x = px + x0 * (1 - f) + S(tau * TAU * 1.4 + i * 2) * hwAt(y) * 0.5 * S(f * PI), sc = 1 - E.in(seg(tau, 0.72, 1)), tumble = S(tau * 9 + i) * 0.4 + tau * (a.r(i, 2) - 0.5) * 8;
        if (kind === 'cow') cow(x, y, u * 0.0125 * sc, tumble * 0.6, t * 9 + i);
        else if (kind === 'person') person(x, y, u * 0.0068 * sc, tumble * 0.5, SHIRTS[i % 5], SKINS[i % 4], t * 12 + i);
        else starO(x, y, u * 0.08 * sc, tumble * 2, K.yellow, 3 * k);
      }
      // the saucer itself
      const legOut = t < 2 ? pop(t, 0.25, 0.4) * (1 - E.in(seg(t, 1.8, 1.92))) : pop(t, 2.36, 0.25), peek = pop(t, 0.95, 0.35) * unpop(t, 1.75, 0.2) + pop(t, 2.3, 0.25);      // the alien ducks for the zoom and pops up again when it is back
      const zoom = t < 2.1 ? E.in(away) : 1 - seg(back, 0.3, 0.75);
      if (zoom > 0.05) speedLines(a, px, py, dx, dy, u * 1.1 * zoom, 9, u * 0.28, 5 * k, K.white, 40);
      const X = v => gx(g, k, v), Y = v => gy(k, v), ol = 3 * k;
      a.begin(px, py, s * pop(t, 0.02, 0.3), rot, sx, sy - bump);
      if (ak > 0.03) {
        c.save(); c.scale(ak, ak);
        for (const sd of [0, 1]) {                                                // landing legs, and a flame while it flies
          const x1 = (sd ? 76 : -6) + 4 * S(t * 3 + sd), y1 = 72 + 38 * legOut;
          line(X(sd ? 58 : 12), Y(72), X(x1), Y(y1), 9 * k, K.ink); line(X(sd ? 58 : 12), Y(72), X(x1), Y(y1), 4 * k, K.cream);
          ovalO(X(x1), Y(y1 + 1), 9 * k * legOut, 3.6 * k * legOut, K.orange, 0, 2.4 * k);
        }
        if (zoom > 0.05) poly([X(20), Y(92), X(35), Y(92 + 40 * zoom * (0.8 + 0.2 * S(t * 60))), X(50), Y(92)], K.yellow);
        c.fillStyle = K.greenD; c.fill(gpath(g, k));                              // the hull's hollow
        ovalO(X(35), Y(14), 68 * k, 13 * k, K.pinkD, 0, ol); oval(X(35), Y(9), 68 * k, 12 * k, K.pink);
        c.restore();
      }
      glyph(g, k, { color: K.lime });
      if (ak > 0.03) {
        c.save(); c.scale(ak, ak);
        const dome = () => { c.beginPath(); c.ellipse(X(35), Y(8), 29 * k, 36 * k, 0, PI, TAU); c.closePath(); };
        dome(); c.fillStyle = K.skyL; c.fill();
        c.save(); dome(); c.clip(); alien(X(35), Y(lerp(34, -3, peek)), k, S(t * 2.7) * 0.8, (t % 1.3) < 0.1 ? 0.15 : 1); c.restore();
        dome(); c.strokeStyle = K.ink; c.lineWidth = ol; c.lineJoin = 'round'; c.stroke();
        c.beginPath(); c.ellipse(X(35), Y(8), 22.5 * k, 29 * k, 0, PI * 1.1, PI * 1.42); c.strokeStyle = K.white; c.lineWidth = 4 * k; c.lineCap = 'round'; c.stroke();
        const nl = Math.max(2, a.n(9)), lit = i => (((i - t * 9) % 3) + 3) % 3 < 1, lx = i => X(35 + 63 * C((0.06 + 0.88 * i / (nl - 1)) * PI)), ly = i => Y(12 + 11 * S((0.06 + 0.88 * i / (nl - 1)) * PI));
        bits([K.ink], nl, i => addDisc(lx(i), ly(i), 7 * k));                   // the ring of lights round the rim, chasing
        bits([K.pinkL], nl, i => { if (!lit(i)) addDisc(lx(i), ly(i), 5.2 * k); });
        bits([K.yellow, K.white, K.sky, K.lime], nl, i => { if (lit(i)) addDisc(lx(i), ly(i), 5.4 * k); });
        c.restore();
      }
      a.end();
      spray(a, t, { x: 0, y: homeY, n: a.n(20), t0: 2.4, life: 1.0, v0: u * 0.6, v1: u * 1.6, seed: 31, shape: 'spark', cols: [K.yellow, K.white, K.lime, K.pinkL] });
    },
  },

  /* V: a volcano rumbles, then erupts: lava, fireballs, smoke and an ash cloud, the sky glowing and lava running down its flanks */
  V: {
    color: K.red, bg: K.magenta, dur: 2.8,
    back(a, t) {
      const { u, k, w, h } = a, L = volcano(a), { rim, ground, rx, W1 } = L, R = Math.hypot(a.bw, a.bh) / 2, c = raw(), q = quake(a, t), mt = pop(t, 0, 0.4);
      const flank = x => ground - (ground - (rim + (ground - rim) * (1 - (1 - sat((Math.abs(x) - rx) / (W1 - rx))) ** 2))) * mt;
      const gl = E.out(seg(t, 0.95, 1.9));
      if (gl > 0.01) { rays(0, rim, 18, R, t * 0.12, K.orangeL, 0.42); disc(0, rim, u * 1.15 * gl, K.orange); disc(0, rim, u * 0.6 * gl, K.orangeL); }
      const nc = a.n(5);                                                        // the ash cloud spreading across the top
      for (let i = 0; i < nc; i++) {
        const f = (i + 0.5) / nc, gr = pop(t, 1.0 + i * 0.1, 0.8), x = (f - 0.5) * w * 1.3 + S(t * 0.7 + i) * u * 0.05, y = -h * (0.42 - 0.08 * S(f * PI * 2 + 1)) + (1 - gr) * h * 0.2;
        cloud(x, y, u * (0.28 + 0.14 * a.r(i, 1)) * gr * a.x(0.4), i & 1 ? K.violetD : K.indigoD);
      }
      palm(-w * 0.4, ground + h * 0.13, u * 0.5 * pop(t, 0.05, 0.45), -0.3, t, 0);                   // palms, frantic during the rumble
      palm(w * 0.41, ground + h * 0.11, u * 0.42 * pop(t, 0.12, 0.45), 0.35, t, 1);
      c.save(); c.translate(q[0], q[1]);
      const pts = [];                                                            // the mountain
      for (let i = 10; i >= 1; i--) { const x = -rx - (W1 - rx) * i / 10; pts.push(x, flank(x)); }
      pts.push(-rx, flank(rx), rx, flank(rx));
      for (let i = 1; i <= 10; i++) { const x = rx + (W1 - rx) * i / 10; pts.push(x, flank(x)); }
      pts.push(W1 + 200, ground + h, -W1 - 200, ground + h);
      poly(pts, K.indigoD);
      const lit = [rx, flank(rx)];                                               // its lit right side
      for (let i = 1; i <= 10; i++) { const x = rx + (W1 - rx) * i / 10; lit.push(x, flank(x)); }
      lit.push(W1 + 200, ground + h, 0, ground + h, 0, flank(0));
      poly(lit, K.indigo);
      for (let j = 0; j < 4; j++) {                                              // lava running down the flanks, and pooling
        const dir = j & 1 ? 1 : -1, f = E.out(seg(t, 1.12 + j * 0.13, 2.25)), wd = 6.5 * k * a.x(0.35) * (j < 2 ? 1.2 : 0.8);
        if (f <= 0.01) continue;
        const m = Math.ceil(14 * f), rp = [];
        for (let i = 0; i <= m; i++) {
          const fr = f * i / m, x = dir * lerp(rx * (j < 2 ? 0.95 : 1.6), W1 * (j < 2 ? 0.9 : 0.5), fr) + S(fr * 11 + j * 2) * 0.012 * w * fr;
          rp.push(x, flank(x) + wd * 2 + 3 * k);
        }
        pline(rp, wd * 1.6, K.red); pline(rp, wd, K.orange); pline(rp, wd * 0.4, K.yellow);
        disc(rp[rp.length - 2], rp[rp.length - 1], wd * 1.05, K.yellow);
      }
      c.restore();
      band(-a.bw / 2, a.bw / 2, ground, h * 0.01, w * 0.5, 1, K.violetD, a.bh);
      for (const sd of [-1, 1]) { const p = E.out(seg(t, 1.9, 2.4)) * a.x(0.3); oval(sd * W1 * 0.9, ground + h * 0.02, u * 0.13 * p, u * 0.035 * p, K.orange); oval(sd * W1 * 0.9, ground + h * 0.02, u * 0.07 * p, u * 0.02 * p, K.yellow); }   // pools of lava
      c.save(); c.translate(q[0], q[1]);
      for (let i = 0; i < a.n(6) && t < 1.4; i++) {                              // dust shaken loose by the rumble
        const p = seg(t, 0.3 + i * 0.1, 0.9 + i * 0.1), sd = i & 1 ? 1 : -1;
        if (p > 0 && p < 1) cloud(sd * (rx * 2 + a.r(i, 1) * w * 0.3 + p * u * 0.2), ground - u * 0.04 * p, u * 0.07 * S(p * PI), K.magentaL);
      }
      c.restore();
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, L = volcano(a), { unit, rim, y0 } = L, hs = a.hs, ak = a.ak, c = raw(), q = quake(a, t), cx = 0, cy = rim, px0 = q[0];
      const ts = SALVOS[a.big ? 1 : 0], ns = ts.length;
      // the rumble: little arcs shivering out from the mountain, and first wisps of smoke
      if (t > 0.3 && t < 1.05) for (let i = 0; i < 3; i++) if ((Math.floor(t * 6) + i) % 2) for (const sd of [0, PI]) arcS(px0, y0, unit * (58 + 13 * i), sd - 0.45, sd + 0.45, 5 * k, K.white);
      for (let j = 0; j < 4; j++) { const age = t - (0.4 + j * 0.16); if (age > 0 && age < 1.2) cloud(cx + (j - 1.5) * u * 0.03 + u * 0.08 * age, cy - u * 0.5 * age, u * 0.05 * (1 + age * 1.5), K.pinkL); }
      // smoke puffs growing and drifting up and away from the crater
      for (let j = 0, n = a.n(9); j < n; j++) {
        const age = t - (0.95 + j * 1.1 / n), r = u * (0.06 + 0.24 * E.out(sat(age / 1.3))) * a.x(0.3);
        if (age > 0) cloud(cx + (a.r(j, 1) - 0.3) * u * 0.5 * age + u * 0.16 * age, cy - u * (0.1 + 0.62 * age) * a.x(0.2), r / 1.4, [K.indigoD, K.violetD, K.violet][j % 3]);
      }
      // a fat jet of lava standing up out of the crater
      const col = E.out(seg(t, 0.95, 1.2)) * (1 - E.in(seg(t, 1.6, 2.0))), Hc = u * 0.55 * a.x(0.4) * col, bwid = 21 * unit;
      if (col > 0.02) {
        for (const [sc, cl] of [[1, K.red], [0.7, K.orange], [0.4, K.yellow]]) {
          const pts = [], m = 8;
          for (let i = 0; i <= m; i++) { const f = i / m; pts.push(cx - bwid * sc * (0.7 + 0.5 * f + 0.1 * S(f * 9 - t * 16)), cy - Hc * f); }
          for (let i = m; i >= 0; i--) { const f = i / m; pts.push(cx + bwid * sc * (0.7 + 0.5 * f + 0.1 * S(f * 9 - t * 16 + 2)), cy - Hc * f); }
          poly(pts, cl); disc(cx, cy - Hc, bwid * sc * 1.05, cl);
        }
      }
      // lava blobs and fireballs thrown in salvos
      for (let j = 0; j < ns; j++) {
        const t0 = ts[j];
        spray(a, t, { x: cx, y: cy, n: a.n(10), t0, life: 1.6, a0: -0.86 * PI, a1: -0.14 * PI, v0: u * 1.2, v1: u * 2.6, g: 1400, s0: 18, s1: 34, seed: 100 + j * 13, shape: 'dot', cols: [K.red, K.yellow, K.orange] });
        spray(a, t, { x: cx, y: cy, n: a.n(16), t0, life: 1.5, a0: -0.9 * PI, a1: -0.1 * PI, v0: u * 1.0, v1: u * 3.2, g: 1400, s0: 7, s1: 15, seed: 150 + j * 13, shape: 'dot', cols: [K.yellowL, K.orange, K.white, K.red] });
        for (let m = 0, nf = a.n(3); m < nf; m++) fireball(a, t, t0 + m * 0.05, cx, cy, -PI / 2 + (a.r(j * 5 + m, 3) - 0.5) * 1.7, u * (1.7 + 1.1 * a.r(j * 5 + m, 4)), u * 0.09 * a.x(0.3), 1400);
        pulse(cx, cy, t, t0, 0.45, u * 0.55 * a.x(0.3), 8 * k * (j ? 0.6 : 1), K.white);
      }
      fall(a, t, { n: a.n(16), t0: 1.0, vy0: -120, vy1: -320, shape: 'spark', x0: -w * 0.35, x1: w * 0.35, y0: -h * 0.2, y1: h * 0.4, s0: 5, s1: 11, cols: [K.yellow, K.orangeL, K.white], seed: 1300 });
      // the volcano itself: it shakes, swells, and jolts with every salvo
      const ramp = seg(t, 0.25, 0.95), e = t - ts[0];
      let sy = 1 - 0.09 * ramp * (0.5 + 0.5 * S(t * 21)), sx = 1 + 0.06 * ramp * (0.5 + 0.5 * S(t * 21)), jolt = e > 0 ? 1 - spring(e, 2.6, 5) : 0;
      for (let j = 1; j < ns; j++) if (t > ts[j]) jolt += 0.3 * (1 - spring(t - ts[j], 3, 6));
      sy += 0.34 * jolt; sx -= 0.2 * jolt;
      const yh = y0 + 41.5 * unit * (1 - sy) + q[1], lvl = E.io(seg(t, 0.1, 0.95)), yL = lerp(66, 3, lvl), Xg = v => gx(g, k, v), Yg = v => gy(k, v);
      a.begin(q[0], yh, (unit / k / hs) * pop(t, 0.02, 0.3), 0.035 * S(t * 33) * ramp, sx, sy);
      if (ak > 0.03) {
        c.save(); c.scale(ak, ak);
        const xl = y => 16.45 + 0.3795 * (y - 5.48), lava = [Xg(xl(yL) - 4), Yg(yL)];
        for (let i = 1; i < 6; i++) { const y = yL + 1.8 * S(i * 2.1 + t * 13); lava.push(Xg(lerp(xl(yL) - 4, 84 - xl(yL), i / 6)), Yg(y)); }
        lava.push(Xg(84 - xl(yL)), Yg(yL), Xg(40), Yg(72));
        poly(lava, K.orange);
        const yi = lerp(72, yL, 0.55);
        poly([Xg(xl(yi) + 3), Yg(yi), Xg(74 - xl(yi)), Yg(yi), Xg(40), Yg(70)], K.yellow);
        bits([K.yellowL], 4, i => { const f = (t * 0.9 + i / 4) % 1; addDisc(Xg(40 + S(i * 5.1) * 9), Yg(lerp(70, yL + 4, f)), (2 + 3 * S(f * PI)) * k); });
        c.restore();
      }
      glyph(g, k, { color: K.red });
      if (ak > 0.03 && lvl > 0.7) {
        c.save(); c.scale(ak, ak);
        for (const sd of [-1, 1]) disc(Xg(40 + sd * 31.5), Yg(6), 7.5 * k * E.out(sat((lvl - 0.7) * 4)) * (1 + 0.08 * S(t * 9 + sd)), K.orange);
        c.restore();
      }
      a.end();
    },
  },

  /* W: a whale's tail rises out of the sea, slaps the water with a giant splash and a rainbow, and stands on the waves */
  W: {
    color: K.orange, bg: K.sky, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a, R = Math.hypot(a.bw, a.bh) / 2, wy = h * 0.325, sp = pop(t, 0.1, 0.5), sx = w * 0.36, sy = -h * 0.3;
      rays(sx, sy, 14, R, t * 0.3, K.skyL, 0.5);                                 // the sun, with its rays
      disc(sx, sy, u * 0.2 * sp, K.yellow); disc(sx, sy, u * 0.14 * sp, K.yellowL);
      for (let i = 0; i < 3; i++) cloud((((-0.3 + i * 0.4) * w - t * u * 0.05 * (1 + i * 0.3) + w * 1.5) % (w * 1.3)) - w * 0.65, -h * (0.34 - i * 0.07), u * (0.15 + i * 0.03), K.white);
      const r0 = Math.min(w * 0.46, h * 0.58), bwid = r0 * 0.05, rp = E.out(seg(t, 1.2, 1.95));                 // the rainbow, drawn on left to right
      for (let i = 0; i < 6; i++) arcS(0, wy, r0 - i * bwid * 0.98, PI, PI + PI * rp, bwid * 1.02, RAINBOW[i], 'butt');
      for (let j = 0; j < 3; j++) sea(a, t, j, wy - h * (0.17 - j * 0.06), BACK_SEA[j]);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, ak = a.ak, c = raw(), wy = h * 0.325;
      const unit = Math.min(h * 0.5 / 100, w * 0.66 / (104 * hs)) * hs, raise = clamp((wy + h * 0.5) / unit - 106, 8, 34);
      // the tail: rises, winds back, whips down onto the water (t = 1.15), squashes, settles, and flicks again
      const rise = E.outBack(seg(t, 0.02, 0.55)), windup = E.io(seg(t, 0.8, 1.0)), hit = E.in(seg(t, 1.0, 1.15)), f2 = seg(t, 1.72, 1.96);
      let Hb = lerp(-62, raise, rise) + (t > 0.55 ? 2.5 * S((t - 0.55) * 7) : 0) + 7 * windup, rot = -0.3 * windup;
      if (t > 1.0) { Hb = lerp(Hb, 0, hit); rot = lerp(rot, 0.1, hit); }
      if (t > 1.15) { Hb = 0.8 + 0.8 * S(t * 5) + 16 * a.x(0.8) * S(f2 * PI); rot = 0.1 * (1 - spring(t - 1.15, 2, 5)) - 0.1 * S(f2 * PI); }
      const j1 = t > 1.15 ? 1 - spring(t - 1.15, 2.4, 6) : 0, j2 = t > 1.96 ? 0.5 * a.x(0.5) * (1 - spring(t - 1.96, 2.4, 6)) : 0, sy = 1 - 0.4 * (j1 + j2) + 0.1 * S(PI * seg(t, 0.02, 0.4)), sx = 1 + 0.25 * (j1 + j2);
      const L = (Hb + 50 * sy) * unit, hx = S(rot) * L, hy = wy - C(rot) * L;
      for (let i = 0, n = a.n(4); i < n; i++) {                                    // water dripping off the flukes while the tail is up
        const age = t - (0.55 + i * 0.11), y = wy - raise * unit + 0.5 * 1300 * age * age;
        if (age > 0 && y < wy) drop((i & 1 ? 1 : -1) * (24 + 8 * a.r(i, 1)) * unit, y, u * (0.03 + 0.012 * a.r(i, 2)), 0, i & 2 ? K.white : K.skyL);
      }
      for (let i = 0, n = a.n(3); i < n; i++) {                                    // seagulls, startled by the slap
        const f = i / n, kick = E.out(seg(t, 1.15, 1.7)), x = ((0.2 + f * 0.6 + t * 0.06 * (1 + i * 0.3)) % 1 - 0.5) * w * 1.1 + (i & 1 ? 1 : -1) * kick * w * 0.2;
        bird(x, -h * (0.3 - f * 0.2) - kick * h * 0.08, u * 0.09 * a.x(0.3), S(t * (8 + kick * 8) + i * 2), K.white);
      }
      for (const [t0, m] of [[1.15, 1], [1.96, 0.55 * a.x(0.5)]]) {                          // a comic burst behind the tail, and plumes of water shooting up
        const bp = seg(t, t0, t0 + 0.3);
        if (bp > 0 && bp < 1) { const r = u * 0.85 * m * E.out(bp) * a.x(0.3); star(hx, wy, r, 12, r * 0.6, 0.2, K.white); star(hx, wy, r * 0.7, 12, r * 0.42, 0.2, K.skyL); }
        for (const sd of [-1, 1]) for (let i = 0, n = a.n(3); i < n; i++) {
          const p = seg(t, t0 + i * 0.03, t0 + 0.8), up = E.out(seg(p, 0, 0.3)) * (1 - E.in(seg(p, 0.45, 1))), an = -PI / 2 + sd * (0.12 + i * 0.3), len = u * (0.6 + 0.5 * a.r(i, 5)) * m * up * a.x(0.3);
          if (up > 0.02) spike(hx + sd * 24 * unit, wy, an, len, i & 1 ? K.white : K.skyL);
        }
      }
      const tail = (stalk, flukes) => {                                            // the flukes on their stalk, which shrinks away as the letter lands
        a.begin(hx, hy, (unit / k / hs) * pop(t, 0.02, 0.3), rot, sx, sy);
        if (stalk && ak > 0.03) { c.save(); c.scale(ak, ak); const yb = 100 + (Hb + 70) / sy; polyO([gx(g, k, 43), gy(k, 34), gx(g, k, 61), gy(k, 34), gx(g, k, 70), gy(k, yb), gx(g, k, 34), gy(k, yb)], K.orange, 3.4 * k); c.restore(); }
        if (flukes) glyph(g, k, { color: K.orange });
        a.end();
      };
      tail(true, a.land <= 0);                                                     // the flukes stand in the water while the scene runs, and go on top of it once the letter leaves
      for (let i = 0, n = a.n(2); i < n; i++) {                                    // fish leaping out of the sea, startled by the slap
        const age = t - (1.3 + i * 0.2), sd = i & 1 ? 1 : -1, vx = sd * u * (0.5 + 0.4 * a.r(i, 2)), vy = -u * (1.4 + 0.5 * a.r(i, 3));
        if (age > 0 && age < 1.1) fish(sd * w * (0.28 + 0.1 * a.r(i, 1)) + vx * age, wy + h * 0.04 + vy * age + 0.5 * u * 3.6 * age * age, u * 0.07, Math.atan2(vy + u * 3.6 * age, vx), [K.pink, K.yellow, K.lime, K.white][i % 4], S(t * 20 + i));
      }
      const swell = j => -h * 0.012 * wob(t - 1.15 - 0.06 * j, 2.2, 2.6) * 3;
      sea(a, t, 3, wy + h * 0.004 + swell(0), FRONT_SEA[0]);
      sea(a, t, 4, wy + h * 0.06 + swell(1), FRONT_SEA[1]);
      for (const [t0, m] of [[1.15, 1], [1.96, 0.55 * a.x(0.5)]]) {
        for (const sd of [-1, 1]) {
          const x0 = hx + sd * 24 * unit;
          spray(a, t, { x: x0, y: wy, n: a.n(10), t0, life: 1.4, a0: -0.95 * PI, a1: -0.05 * PI, v0: u * 1.0 * m, v1: u * 2.4 * m, g: 1300, s0: 10, s1: 26, seed: 500 + sd * 30 + t0 * 10, shape: 'dot', cols: [K.white, K.skyL, K.white, K.tealL] });
        }
        waterDrops(a, t, { x: hx, y: wy, t0, n: a.n(12), a0: -0.9 * PI, a1: -0.1 * PI, v0: u * 1.1 * m, v1: u * 2.7 * m, g: 1300, s0: 12, s1: 26, seed: 700 + t0 * 10, life: 1.4 });
        for (let i = 0; i < 2; i++) { const p = seg(t, t0 + i * 0.12, t0 + 0.8 + i * 0.12); if (p > 0 && p < 1) ringE(hx, wy + h * 0.035, u * (0.3 + 1.0 * E.out(p)) * m, u * (0.05 + 0.15 * E.out(p)) * m, 0, 4.5 * k * (1 - p), K.white); }
        bits([K.white, K.skyL], a.n(8), i => { const p = seg(t, t0, t0 + 0.9), r = u * (0.03 + 0.05 * a.r(i, 3)) * S(p * PI) * m; addDisc(hx + (a.r(i, 1) - 0.5) * u * 1.6 * m * E.out(p), wy + h * (0.005 + 0.03 * a.r(i, 2)), r); });
      }
      if (a.land > 0) tail(false, true);
    },
  },

  /* X: a treasure map slides in and draws its dotted trail, a big X stamps down, and a chest bursts out of the ground in a fountain of coins */
  X: {
    color: K.red, bg: K.purple, dur: 2.9,
    back(a, t) {
      const { u, k, w, h } = a, L = mapLayout(a), { Wm, Hm } = L, c = raw(), slide = E.outBack(seg(t, 0.1, 0.62)), jolt = t > 1.34 ? wob(t - 1.34, 3, 5) * h * 0.012 * a.x(0.4) : 0;
      rays(L.spot.x, L.spot.y, 16, Math.hypot(a.bw, a.bh) / 2, -t * 0.1, K.magentaM, 0.4);
      c.save(); c.translate(L.sx + (1 - slide) * w * 0.8, L.sy + jolt); c.rotate(-0.035 + 0.35 * (1 - slide));
      const ph = t * 2;
      const edge = (dx, dy) => {                                                    // the parchment: a wavy-edged rectangle
        const pts = [];
        for (let i = 0; i < 16; i++) pts.push(dx + (i / 16 - 0.5) * Wm, dy - Hm / 2 + S(i * 1.2 + ph) * Hm * 0.012);
        for (let i = 0; i < 12; i++) pts.push(dx + Wm / 2 + S(i * 1.3 + ph + 1) * Wm * 0.008, dy + (i / 12 - 0.5) * Hm);
        for (let i = 0; i < 16; i++) pts.push(dx + (0.5 - i / 16) * Wm, dy + Hm / 2 + S(i * 1.1 + ph + 2) * Hm * 0.012);
        for (let i = 0; i < 12; i++) pts.push(dx - Wm / 2 + S(i * 1.4 + ph + 3) * Wm * 0.008, dy + (0.5 - i / 12) * Hm);
        return pts;
      };
      poly(edge(u * 0.03, u * 0.035), K.purpleD); poly(edge(0, 0), K.cream);
      c.setLineDash([Hm * 0.03, Hm * 0.025]); c.strokeStyle = K.orangeL; c.lineWidth = 3 * k; c.lineCap = 'round';
      c.strokeRect(-Wm * 0.46, -Hm * 0.44, Wm * 0.92, Hm * 0.88); c.setLineDash([]);
      for (const [x0, y0, x1] of [[-0.44, 0.15, -0.28], [-0.3, 0.4, -0.1], [0.26, 0.37, 0.42], [-0.44, -0.3, -0.26], [0.3, 0.02, 0.44]]) wave(x0 * Wm, x1 * Wm, y0 * Hm, 3.5 * k, Wm * 0.08, ph, 3.5 * k, K.sky);   // sea
      const ix = L.spot.x - L.sx + Wm * 0.02, iy = L.spot.y - L.sy - Hm * 0.02, ir = Hm * 0.27 * pop(t, 0.3, 0.45);                                   // the island
      blob(ix, iy, ir * 1.14, 1, 0.06, t * 0.3, K.yellowL); blob(ix, iy, ir, 2, 0.08, t * 0.3, K.lime);
      poly([ix - ir * 0.7, iy - ir * 0.15, ix - ir * 0.45, iy - ir * 0.62, ix - ir * 0.2, iy - ir * 0.15], K.green);
      poly([ix + ir * 0.15, iy - ir * 0.4, ix + ir * 0.4, iy - ir * 0.8, ix + ir * 0.65, iy - ir * 0.4], K.orange);
      disc(ix - ir * 0.45, iy + ir * 0.4, ir * 0.16, K.sky);
      line(ix + ir * 0.5, iy + ir * 0.5, ix + ir * 0.56, iy + ir * 0.1, ir * 0.07, K.orangeD);
      for (let i = 0; i < 5; i++) leaf(ix + ir * 0.56 + C(i * 1.26) * ir * 0.2, iy + ir * 0.1 + S(i * 1.26) * ir * 0.12, ir * 0.16, i * 1.26 + PI / 2, K.green);
      // the compass rose, spinning in
      const cxr = Wm * 0.36, cyr = -Hm * 0.28, cr = Hm * 0.11 * pop(t, 0.5, 0.5), spin = 3 * (1 - E.outElastic(seg(t, 0.55, 1.3)));
      ring(cxr, cyr, cr * 1.12, 3 * k, K.orangeD); star(cxr, cyr, cr, 4, cr * 0.18, spin - PI / 2, K.red); star(cxr, cyr, cr * 0.7, 4, cr * 0.16, spin - PI / 4, K.orange); disc(cxr, cyr, cr * 0.16, K.cream);
      // the trail: dots drawn one after another from the ship to the spot
      const prog = E.io(seg(t, 0.65, 1.3)), N = 30, r0 = Hm * 0.016 * (1 + 0.3 * (a.X - 1) / 0.85);
      bits([K.red], N, i => { const f = (i + 1) / N, rr = r0 * sat((prog - f + 0.08) * 12); if (rr > 0.4) { trailAt(L, f); addDisc(TRL.x, TRL.y, rr); } });
      const sp = pop(t, 0.55, 0.4);
      trailAt(L, 0);
      poly([TRL.x - Hm * 0.09 * sp, TRL.y, TRL.x + Hm * 0.09 * sp, TRL.y, TRL.x + Hm * 0.06 * sp, TRL.y + Hm * 0.06 * sp, TRL.x - Hm * 0.06 * sp, TRL.y + Hm * 0.06 * sp], K.orangeD);
      poly([TRL.x, TRL.y - Hm * 0.02 * sp, TRL.x, TRL.y - Hm * 0.2 * sp, TRL.x + Hm * 0.11 * sp, TRL.y - Hm * 0.02 * sp], K.white);
      poly([TRL.x - Hm * 0.01 * sp, TRL.y - Hm * 0.03 * sp, TRL.x - Hm * 0.01 * sp, TRL.y - Hm * 0.15 * sp, TRL.x - Hm * 0.08 * sp, TRL.y - Hm * 0.03 * sp], K.skyL);
      c.restore();
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, L = mapLayout(a), hs = a.hs, px = L.spot.x, py = L.spot.y;
      const unit = Math.min(h * 0.38 / 100, w * 0.44 / 76) * hs, s = unit / (k * hs), cy = py + 45 * unit, mouth = py - 3 * unit;
      // the X: pops in, lifts like a rubber stamp and waits at the side while the trail draws, slams down (t = 1.34), squashes, then the chest launches it into the air
      const lift = E.io(seg(t, 0.32, 0.8)), pre = E.out(seg(t, 1.1, 1.2)), slam = E.in(seg(t, 1.2, 1.34)), fly = E.out(seg(t, 1.5, 1.95)), hx = Math.max(px - w * 0.32, -w / 2 + 54 * unit * 1.1), hy = Math.max(py - h * 0.27, -h * 0.44 + 62 * unit * 1.1);
      let x = lerp(px, hx, lift), y = lerp(py, hy, lift) - h * 0.03 * pre, z = lerp(1, 1.1, lift), rot = lerp(0, -0.25, lift) - 0.15 * pre + 0.04 * S(t * 6) * lift * (1 - slam);
      x = lerp(x, px, slam); y = lerp(y, py, slam); z = lerp(z, 1, slam); rot = lerp(rot, 0, slam);
      const e = t - 1.34, j = e > 0 ? 1 - spring(e, 2.6, 5.5) : 0, sy = 1 - 0.42 * j * (1 - fly) + 0.15 * S(PI * fly), sx = 1 + 0.3 * j * (1 - fly) - 0.1 * S(PI * fly);
      if (t > 1.5) { x = lerp(px, hx, fly); y = lerp(py, hy, fly) - h * 0.12 * S(PI * fly) + 6 * S(t * 6) * fly; z = lerp(1, 1.1, fly); rot = lerp(0, -0.25, fly) + (fly < 1 ? TAU * fly : 0); }
      const yc = y + 50 * unit * z * (1 - sy);
      // the ground bursts: shockwave, a jagged hole, an ink splat, flying dirt
      pulse(px, cy, t, 1.34, 0.55, u * 1.1 * a.x(0.3), 12 * k, K.white); pulse(px, cy, t, 1.42, 0.5, u * 0.8 * a.x(0.3), 8 * k, K.yellow);
      const gl = E.out(seg(t, 1.7, 2.0)), hp = E.outBack(seg(t, 1.36, 1.52));
      if (gl > 0.01) rays(px, mouth, 14, u * 0.85 * gl * a.x(0.3), t * 0.7, K.skyL, 0.4);
      if (hp > 0.01) { star(px, cy, 60 * unit * hp, 11, 40 * unit * hp, 0.3, K.orangeD); star(px, cy, 44 * unit * hp, 11, 28 * unit * hp, 0.3, K.ink); }
      const sp = pop(t, 1.34, 0.3);
      if (sp > 0.01) splat(a, t, px, py, u * 0.4 * sp * a.x(0.3));
      spray(a, t, { x: px, y: cy, n: a.n(14), t0: 1.4, life: 1.1, a0: -0.95 * PI, a1: -0.05 * PI, v0: u * 0.8, v1: u * 2.0, g: 1600, s0: 8, s1: 20, seed: 900, cols: [K.orangeD, K.cream, K.creamD, K.orange] });
      chest(px, cy, unit, E.outBack(seg(t, 1.68, 1.95)), pop(t, 1.42, 0.35), k);
      treasure(a, t, {
        n: a.n(30), t0: 1.75, span: 0.6, life: 1.5, seed: 950, g: u * 2.8, v0: u * 1.3, v1: u * 2.5, spread: 1.7, s0: u * 0.07, s1: u * 0.11,
        fn: i => { TH[0] = px + (a.r(950 + i, 6) - 0.5) * 24 * unit; TH[1] = mouth; TH[2] = -PI / 2; },
      });
      a.begin(x, yc, s * z * pop(t, 0.02, 0.3), rot, sx, sy);
      glyph(g, k, { color: K.red });
      a.end();
      if (a.big) fall(a, t, { n: a.n(14), t0: 1.9, shape: 'star', cols: [K.yellow, K.orange, K.white], s0: 8, s1: 18, vy0: 250, vy1: 500, seed: 990 });
      for (let i = 0, n = a.n(8); i < n; i++) {                                     // sparkles round the chest
        const tb = 1.78 + i * 0.09, p = seg(t, tb, tb + 0.4);
        if (p > 0 && p < 1) spark(px + (a.r(i, 1) - 0.5) * u * 1.5, cy - a.r(i, 2) * u * 0.9, u * 0.17 * S(p * PI) * (0.6 + a.r(i, 4) * 0.7), a.r(i, 3), i & 1 ? K.white : K.yellow);
      }
    },
  },

  /* Y: the Y is a slingshot: a big ball is pulled back, twangs off and pops a bunch of balloons; three shots, three different balls */
  Y: {
    color: K.orange, bg: K.lime, dur: 2.9,
    back(a, t) {
      const { u, w, h } = a, L = slingLayout(a), cy = BY[2];
      let bump = 0;
      for (const sh of SHOTS) bump += t > sh.hit ? 0.05 * wob(t - sh.hit, 4, 5) : 0;
      const sc = 1 + bump + 0.03 * S(t * 2);
      for (let i = 0; i < RINGS.length; i++) disc(0, cy, u * RINGS[i][0] * sc * pop(t, 0.02 + i * 0.03, 0.4), RINGS[i][1]);      // the bullseye
      band(-a.bw / 2, a.bw / 2, L.ground, h * 0.012, w * 0.6, 1, K.green, a.bh);                                                   // hills to stand on
      band(-a.bw / 2, a.bw / 2, L.ground + h * 0.07, h * 0.02, w * 0.45, 3, K.greenD, a.bh);
    },
    draw(a, t) {
      const { u, k, g, h } = a, L = slingLayout(a), hs = a.hs, ak = a.ak, c = raw(), { unit } = L;
      solveShots(a, L);
      // the three bunches of balloons: they float up into a row, bob, and pop when a ball reaches them
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < L.nb; i++) {
          const pt = SHOTS[j].hit + 0.05 * i, alive = t < pt;
          bunchAt(a, L, j, i, t);
          if (alive) balloon(BP.x, BP.y, L.sb * pop(t, 0.03 + 0.05 * (i + j), 0.4), BP.r, BALLOON[(i + j * 2) % BALLOON.length]);
          else if (t < pt + 0.6) {
            const p = (t - pt) / 0.6, col = BALLOON[(i + j * 2) % BALLOON.length];
            if (p < 0.35) ring(BP.x, BP.y, L.sb * (1 + 1.8 * E.out(p / 0.35)), 6 * k * (1 - p / 0.35), K.white);
            spray(a, t, { x: BP.x, y: BP.y, n: a.n(8), t0: pt, life: 1.1, v0: u * 0.5, v1: u * 1.5, g: 1100, s0: 6, s1: 15, seed: 1100 + j * 40 + i * 7, cols: [col, K.white, K.yellow] });
          }
        }
        const hp = seg(t, SHOTS[j].hit, SHOTS[j].hit + 0.3);
        if (hp > 0 && hp < 1) { const r = u * 0.55 * E.out(hp) * a.x(0.3); star(BX[j], BY[j], r, 10, r * 0.6, hp * 2, K.white); star(BX[j], BY[j], r * 0.62, 10, r * 0.4, hp * 2, K.yellow); }
      }
      // the slingshot
      const ps = slingPose(t), Y_ = v => gy(k, v), vp = seg(t, SHOTS[2].hit + 0.12, SHOTS[2].hit + 0.55);      // and a victory flip after the last hit
      const turn = vp < 1 ? (a.big ? 2 : 1) * TAU * E.io(vp) : 0, thud = 0.15 * wob(t - SHOTS[2].hit - 0.55, 3, 6);
      heroAt(L, ps);
      a.begin(HERO.x, HERO.y - h * 0.56 * vp * (1 - vp), (unit / k / hs) * pop(t, 0.02, 0.3), ps.rot + turn, ps.sx * (1 + thud), ps.sy * (1 - thud));
      glyph(g, k, { color: K.orange });
      if (ak > 0.03) {                                                                // the rubber band, from prong to prong through the pouch
        c.save(); c.scale(ak, ak);
        const px = gx(g, k, 38), py = Y_(8.5 + ps.pull), sag = ps.bow * k;
        for (const tx of [8.5, 67.5]) {
          const mx = (gx(g, k, tx) + px) / 2 + (tx < 38 ? -sag : sag) * 0.5, my = (Y_(8.5) + py) / 2 + sag;
          pline([gx(g, k, tx), Y_(8.5), mx, my, px, py], 9 * k, K.ink); pline([gx(g, k, tx), Y_(8.5), mx, my, px, py], 5 * k, K.red);
          discO(gx(g, k, tx), Y_(8.5), 5.5 * k, K.red, 2.4 * k);
        }
        boxO(px, py, 26 * k, 14 * k, K.orangeD, 0, 6 * k, 2.4 * k);
        c.restore();
      }
      a.end();
      // the balls: in the pouch, then in flight
      for (let j = 0; j < 3; j++) {
        const sh = SHOTS[j], age = t - sh.tl;
        if (t < sh.pull - 0.1 || (j < 2 && t > sh.hit + 0.45)) continue;
        const sc = pop(t, sh.pull - 0.1, 0.25) * (j < 2 ? 1 - E.in(seg(t, sh.hit, sh.hit + 0.45)) : 1 + 0.25 * wob(t - sh.hit, 3, 5));
        if (t < sh.tl) { pouchAt(L, ps, ps.pull, POUCH); ball(POUCH.x, POUCH.y, L.rb * sc, j, t * 3); }
        else {
          const fa = j < 2 ? age : Math.min(age, sh.T), x = SOL.fx[j] + SOL.vx[j] * fa, y = SOL.fy[j] + SOL.vy[j] * fa + 0.5 * L.g * fa * fa;
          if (age < sh.T + 0.1) speedLines(a, x, y, SOL.vx[j], SOL.vy[j] + L.g * age, u * 0.22 * sat(age * 8), 6, L.rb * 0.7, 3 * k, K.white, 60 + j * 10);
          ball(x, y, L.rb * sc, j, t * 9);
        }
      }
      const fin = SHOTS[2].hit;                                                        // the last hit: streamers and a rain of confetti
      streamers(a, t, { n: a.n(10), t0: fin, span: 0.25, life: 1.4, seed: 1500, g: u * 2.2, v0: u * 0.4, v1: u * 1.2, spread: 2.4, lw: 6 * k, cols: BALLOON, fn: (i, te) => { TH[0] = BX[2]; TH[1] = BY[2]; TH[2] = PI / 2; } });
      fall(a, t, { n: a.n(50), t0: fin, cols: [K.pink, K.yellow, K.sky, K.white, K.purple, K.red], s0: 9, s1: 20, seed: 1400 });
    },
  },

  /* Z: the Z is a zipper: a slider runs along its path opening a bright seam that pours out confetti, streamers and coins, then zips it shut again */
  Z: {
    color: K.yellow, bg: K.blue, dur: 2.9,
    back(a, t) {
      const { u, k, w, h } = a, R = Math.hypot(a.bw, a.bh) / 2, c = raw(), ang = 0.62, sw = u * 0.2, N = Math.ceil(R / sw) + 2, off = (t * u * 0.06) % (sw * 2);
      bits([K.blueM], N, i => { const d = (i - N / 2) * sw * 2 + off; addBox(C(ang) * d, S(ang) * d, sw, R * 2.2, ang + PI / 2); });         // denim twill, sliding by
      bits([K.blueD], N, i => { const d = (i - N / 2) * sw * 2 + off + sw * 0.9; addBox(C(ang) * d, S(ang) * d, sw * 0.28, R * 2.2, ang + PI / 2); });
      const pk = pop(t, 0.06, 0.5), bx = -w * 0.38, by = -h * 0.3;                                                                       // a jeans button, half out of the picture
      disc(bx, by, u * 0.36 * pk, K.orangeD); disc(bx, by, u * 0.32 * pk, K.orange); ring(bx, by, u * 0.23 * pk, 5 * k, K.orangeD); disc(bx, by, u * 0.11 * pk, K.orangeL);
      c.setLineDash([12 * k, 8 * k]);                                                                                                    // topstitching
      for (const [x0, y0, x1, y1, col] of [[-R, h * 0.3, R, h * 0.3 - R * 0.5, K.orange], [-R, h * 0.3 + 16 * k, R, h * 0.3 - R * 0.5 + 16 * k, K.orange]]) line(x0, y0, x1, y1, 4 * k, col);
      const pw = u * 0.62, ph = u * 0.7, px = w * 0.3, py = h * 0.2 + (1 - pk) * h;                                                       // a back pocket, stitched
      for (const m of [1, 0.9]) pline([px - pw / 2 * m, py - ph / 2 * m, px + pw / 2 * m, py - ph / 2 * m, px + pw / 2 * m, py + ph * 0.15 * m, px, py + ph / 2 * m, px - pw / 2 * m, py + ph * 0.15 * m, px - pw / 2 * m, py - ph / 2 * m], 4 * k, K.orange);
      c.setLineDash([]);
      for (const sd of [-1, 1]) discO(px + sd * pw / 2 * 0.95, py - ph / 2 * 0.95, 8 * k, K.yellow, 3 * k);
    },
    draw(a, t) {
      const { u, k, g, w, h } = a, hs = a.hs, ak = a.ak, c = raw(), unit = Math.min(h * 0.5 / 100, w * 0.6 / 68) * hs, hx = 0, hy = -0.02 * h;
      const ns = a.big ? 2 : 1, half = a.big ? ZT / 2 : ZT, spd = Math.min(2, Math.abs(zprog(t + 0.03) - zprog(t - 0.03)) / 0.06);       // capitals: a second slider comes from the far end
      const ks = ZK[ns - 1], kick = (i, m) => t > ks[i] ? wob(t - ks[i], 4, 6) * m : 0, j1 = ns > 1 ? kick(0, 0.08) + kick(1, 0.08) : kick(0, 0.06) + kick(1, -0.06) + kick(2, 0.07);   // a jolt at each corner
      const X = v => gx(g, k, v), Y = v => gy(k, v);
      // streamers, coins, gems and confetti pouring out of the seam as the sliders pass, then a burst where they end
      const org = (i, te) => { zpos(slideAt(te, i % ns, half), ZO); TH[0] = hx + (ZO.x - 34) * unit; TH[1] = hy + (ZO.y - 50) * unit; TH[2] = ZO.a + ((i / ns | 0) & 1 ? PI / 2 : -PI / 2); };
      streamers(a, t, { n: a.n(15), t0: 0.4, span: 1.45, life: 1.3, seed: 1600, g: u * 3.4, v0: u * 0.5, v1: u * 1.5, spread: 1.1, lw: 7 * k, cols: ZSTREAM, fn: org });
      treasure(a, t, { n: a.n(44), t0: 0.4, span: 1.45, life: 1.3, seed: 1700, g: u * 3.4, v0: u * 0.5, v1: u * 1.7, spread: 1.3, s0: u * 0.06, s1: u * 0.11, fn: org });
      zpos(half, ZO);
      spray(a, t, { x: hx + (ZO.x - 34) * unit, y: hy + (ZO.y - 50) * unit, n: a.n(16), t0: 1.86, life: 1.1, v0: u * 0.7, v1: u * 1.8, g: 1200, seed: 1800, cols: [K.pink, K.yellow, K.white, K.sky, K.lime] });
      a.begin(hx + S(t * 23) * spd * u * 0.006, hy, (unit / k / hs) * pop(t, 0.02, 0.3), 0.03 * S(t * 19) * spd + j1, 1 + 0.03 * S(t * 31) * spd, 1);
      glyph(g, k, { color: K.yellow });
      if (ak > 0.03) {
        c.save(); c.scale(ak, ak);
        const HW = 4.2 * a.x(0.15), L0 = 14, dz = 7, tp = pop(t, 0.12, 0.35), sl = [slideAt(t, 0, half), ns > 1 ? slideAt(t, 1, half) : ZT + 99];
        for (let q = 0; q < ns; q++) {                                                        // the bright seam behind each slider
          const d = sl[q], reach = q ? ZT - d : d;
          if (reach < 0.5) continue;
          const dfull = q ? Math.min(ZT, d + L0) : Math.max(0, d - L0), pts = [];
          zpos(q ? ZT : 0, ZO); pts.push(X(ZO.x), Y(ZO.y));
          for (let ci = q ? 1 : 0; q ? ci >= 0 : ci < 2; ci += q ? -1 : 1) if (q ? ZC[ci] > dfull : ZC[ci] < dfull) { zpos(ZC[ci], ZO); pts.push(X(ZO.x), Y(ZO.y)); }
          zpos(dfull, ZO); pts.push(X(ZO.x), Y(ZO.y));
          pline(pts, 2 * HW * k, K.pink); pline(pts, 1.3 * HW * k, K.pinkL);
          for (let m = 0; m < 6; m++) {                                                       // the wedge where the teeth part
            const d0 = lerp(dfull, d, m / 6), d1 = lerp(dfull, d, (m + 1) / 6);
            zpos(d0, ZO); const x0 = X(ZO.x), y0 = Y(ZO.y); zpos(d1, ZO);
            line(x0, y0, X(ZO.x), Y(ZO.y), Math.max(1, 2 * HW * E.out(sat(Math.abs((d0 + d1) / 2 - d) / L0)) * k), K.pink);
          }
        }
        // the teeth: two rows that interlock ahead of the sliders and stand apart behind them
        let nt = 0;
        for (let sd = -1; sd <= 1; sd += 2) for (let d = (sd > 0 ? 0.5 : 0.1) * dz; d < ZT; d += dz) {
          const hw = Math.max(sl[0] > d ? HW * E.out(sat((sl[0] - d) / L0)) : 0, sl[1] < d ? HW * E.out(sat((d - sl[1]) / L0)) : 0);
          zpos(d, ZO); const off = sd * (hw + 2.2) * (0.6 + 0.4 * tp);
          TB[nt++] = X(ZO.x - S(ZO.a) * off); TB[nt++] = Y(ZO.y + C(ZO.a) * off); TB[nt++] = ZO.a;
        }
        c.fillStyle = K.ink; c.beginPath(); for (let i = 0; i < nt; i += 3) addBox(TB[i], TB[i + 1], 7.6 * k * tp, 6.8 * k * tp, TB[i + 2]); c.fill();
        c.fillStyle = K.white; c.beginPath(); for (let i = 0; i < nt; i += 3) addBox(TB[i], TB[i + 1], 5.4 * k * tp, 4.4 * k * tp, TB[i + 2]); c.fill();
        for (let q = 0; q < ns; q++) {                                                        // the sliders with their pull tabs, and zip lines trailing them
          zhead(sl[q], ZO); const sa = ZO.a + (q ? PI : 0); zpos(sl[q], ZO);
          const sx = X(ZO.x), sy = Y(ZO.y), sc = pop(t, 0.06, 0.35);
          if (spd > 0.05) {
            for (let m = 0; m < 4; m++) {
              const o = (m - 1.5) * 6.5 * k, l0 = 20 * k, l1 = (34 + 10 * m % 3) * k, cs = C(sa), sn = S(sa);
              line(sx - cs * l0 - sn * o, sy - sn * l0 + cs * o, sx - cs * l1 - sn * o, sy - sn * l1 + cs * o, 2.6 * k, K.white);
            }
          }
          c.save(); c.translate(sx, sy); c.rotate(sa); c.scale(sc, sc);
          c.save(); c.translate(-8 * k, 0); c.rotate(PI + 0.7 * S(t * 11 + q) * spd);
          boxO(11 * k, 0, 24 * k, 12 * k, K.red, 0, 6 * k, 2.6 * k); disc(16 * k, 0, 2.6 * k, K.ink);
          c.restore();
          boxO(0, 0, 32 * k, 26 * k, K.white, 0, 9 * k, 2.8 * k); disc(-2 * k, 0, 6 * k, K.orange); ring(-2 * k, 0, 6 * k, 2 * k, K.ink);
          c.restore();
        }
        c.restore();
      }
      a.end();
    },
  },
};

/* ---------- shared: things thrown out along arcs, and a few small shapes ---------- */

const TH = [0, 0, 0], BUF = new Float32Array(5 * 96), GEMS = [K.pink, K.sky, K.lime, K.white], KIND = [0, 1, 0, 2];       // items alternate: coin, gem, coin, bit of confetti
// Treasure thrown up in arcs: coins that spin (their width follows the cosine of the spin), gems and bits of confetti. o.fn(i, te) says where and which way
// item i is thrown from, by writing TH = [x, y, angle]. Everything is batched: one fill per colour.
function treasure(a, t, o) {
  const c = raw(), life = o.life, drag = 1.2;
  let m = 0;
  for (let i = 0; i < o.n && m < BUF.length; i++) {
    const te = o.t0 + o.span * i / o.n, age = t - te;
    if (age <= 0 || age >= life) continue;
    o.fn(i, te);
    const an = TH[2] + (a.r(o.seed + i, 1) - 0.5) * o.spread, v = o.v0 + (o.v1 - o.v0) * a.r(o.seed + i, 2), dist = (1 - Math.exp(-drag * age)) / drag;
    BUF[m++] = TH[0] + C(an) * v * dist; BUF[m++] = TH[1] + S(an) * v * dist + 0.5 * o.g * age * age;
    BUF[m++] = (o.s0 + (o.s1 - o.s0) * a.r(o.seed + i, 3)) * (1 - seg(age / life, 0.65, 1)) * Math.min(1, age * 10);
    BUF[m++] = age * (4 + 8 * a.r(o.seed + i, 4)) + i; BUF[m++] = i;
  }
  for (const [col, sc] of [[K.orangeD, 1], [K.yellow, 0.74]]) {
    c.fillStyle = col; c.beginPath();
    for (let q = 0; q < m; q += 5) if (KIND[BUF[q + 4] % 4] === 0) { const r = BUF[q + 2] * sc, rx = Math.abs(C(BUF[q + 3])) * BUF[q + 2] * sc; if (rx > 1.2) { c.moveTo(BUF[q] + rx, BUF[q + 1]); c.ellipse(BUF[q], BUF[q + 1], rx, r, 0, 0, TAU); } }
    c.fill();
  }
  for (let gi = 0; gi < 4; gi++) {
    c.fillStyle = GEMS[gi]; c.beginPath();
    for (let q = 0; q < m; q += 5) if (KIND[BUF[q + 4] % 4] === 1 && ((BUF[q + 4] / 4) | 0) % 4 === gi) addBox(BUF[q], BUF[q + 1], BUF[q + 2] * 1.5, BUF[q + 2] * 1.5, PI / 4 + BUF[q + 3] * 0.2);
    c.fill();
  }
  for (let ci = 0; ci < 3; ci++) {
    c.fillStyle = [K.pink, K.sky, K.lime][ci]; c.beginPath();
    for (let q = 0; q < m; q += 5) if (KIND[BUF[q + 4] % 4] === 2 && ((BUF[q + 4] / 4) | 0) % 3 === ci) addBox(BUF[q], BUF[q + 1], BUF[q + 2] * 1.7, BUF[q + 2] * 0.7, BUF[q + 3]);
    c.fill();
  }
}
// ribbons thrown out along a path, each a trail of the last little while of its flight
function streamers(a, t, o) {
  const c = raw(), nc = o.cols.length;
  for (let ci = 0; ci < nc; ci++) {
    c.strokeStyle = o.cols[ci]; c.lineWidth = o.lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    for (let i = ci; i < o.n; i += nc) {
      const te = o.t0 + o.span * i / o.n, age = t - te;
      if (age <= 0.02 || age >= o.life) continue;
      o.fn(i, te);
      const an = TH[2] + (a.r(o.seed + i, 1) - 0.5) * o.spread, v = o.v0 + (o.v1 - o.v0) * a.r(o.seed + i, 2), x0 = TH[0], y0 = TH[1], pts = 9 - Math.floor(6 * seg(age / o.life, 0.65, 1));
      for (let m = 0; m < pts; m++) {
        const ag = Math.max(0, age - m * 0.035), dist = (1 - Math.exp(-1.2 * ag)) / 1.2, wig = S(ag * 14 + i) * o.lw * 1.6 * m / 8;
        const x = x0 + C(an) * v * dist - S(an) * wig, y = y0 + S(an) * v * dist + 0.5 * o.g * ag * ag + C(an) * wig;
        if (m) c.lineTo(x, y); else c.moveTo(x, y);
      }
    }
    c.stroke();
  }
}

// speed lines trailing behind something heading (dx, dy)
function speedLines(a, x, y, dx, dy, len, n, spread, lw, col, seed) {
  const L = Math.hypot(dx, dy) || 1;
  dx /= L; dy /= L;
  for (let i = 0; i < n; i++) {
    const o = (a.r(seed + i, 1) - 0.5) * 2 * spread, l0 = len * (0.3 + 0.5 * a.r(seed + i, 2)), l1 = l0 + len * (0.4 + 0.6 * a.r(seed + i, 3));
    line(x - dx * l0 - dy * o, y - dy * l0 + dx * o, x - dx * l1 - dy * o, y - dy * l1 + dx * o, lw, col);
  }
}
// an ellipse as a stroked line (a full ring, or the stretch from a0 to a1)
function ringE(x, y, rx, ry, rot, lw, col, a0 = 0, a1 = TAU) {
  if (rx <= 0 || ry <= 0 || lw <= 0) return;
  const c = raw();
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'butt'; c.beginPath(); c.ellipse(x, y, rx, ry, rot, a0, a1); c.stroke();
}
// a polygon with the dark outline the letters have
function polyO(p, col, ol) {
  const c = raw();
  poly(p, col); c.strokeStyle = K.ink; c.lineWidth = ol * 2; c.lineJoin = 'round'; c.stroke(); poly(p, col);
}

/* ---------- U ---------- */

const ITEMS = ['cow', 'star', 'person', 'star', 'person', 'star'];       // what the tractor beam picks up, in turn
const SHIRTS = [K.red, K.sky, K.orange, K.pink, K.yellow];
const SKINS = [K.pinkL, K.yellowL, K.orangeL, K.cream];

// a small saucer in the distance: a dome, a plate and a light that blinks
function miniUfo(x, y, r, ph) {
  ovalO(x, y - r * 0.5, r * 0.6, r * 0.55, K.skyL, 0, r * 0.1); ovalO(x, y, r * 1.5, r * 0.4, K.pink, 0, r * 0.1);
  bits([K.yellow, K.white, K.lime], 3, i => addDisc(x + (i - 1) * r * 0.85, y + r * 0.08, r * 0.14 * (1.2 + S(ph + i * 2))));
}
// a planet with a ring round it, the front of the ring over the planet
function ringedPlanet(x, y, r, col, colD, ringCol, tilt) {
  if (r <= 0) return;
  ringE(x, y, r * 1.95, r * 0.42, tilt, r * 0.16, ringCol);
  disc(x, y, r, col);
  for (const dy of [-0.4, 0.05, 0.5]) { const yy = dy * r, hw = Math.sqrt(Math.max(0, r * r - (Math.abs(yy) + r * 0.08) ** 2)); line(x - hw, y + yy, x + hw, y + yy, r * 0.16, colD, 'butt'); }
  ringE(x, y, r * 1.95, r * 0.42, tilt, r * 0.16, ringCol, 0, PI);
}
// a star with the dark outline
function starO(x, y, r, rot, col, ol) { star(x, y, r + ol * 1.3, 5, r * 0.45 + ol, rot, K.ink); star(x, y, r, 5, r * 0.45, rot, col); }
// a flat cow, kicking, seen from the side. s is about a hundredth of its length
function cow(x, y, s, rot, ph) {
  if (s <= 0) return;
  const c = raw(), ol = 2.6 * s;
  c.save(); c.translate(x, y); c.rotate(rot);
  for (const [lx, sw] of [[-11, 0], [-6, 1], [8, 2], [13, 3]]) line(lx * s, 6 * s, (lx + 3 * S(ph + sw * 1.7)) * s, 22 * s, 5 * s, K.ink);   // legs
  line(16 * s, -3 * s, 24 * s, -11 * s + 3 * s * S(ph), 3 * s, K.ink); disc(24 * s, -11 * s + 3 * s * S(ph), 3.4 * s, K.ink);                         // tail
  boxO(0, 0, 36 * s, 20 * s, K.white, 0, 8 * s, ol);
  oval(-5 * s, -3 * s, 5.5 * s, 4 * s, K.ink, 0.3); oval(9 * s, 3 * s, 4.5 * s, 3.4 * s, K.ink, -0.4); oval(4 * s, 12 * s, 4 * s, 3 * s, K.pink);
  boxO(-23 * s, -5 * s, 15 * s, 14 * s, K.white, 0, 6 * s, ol);
  oval(-28 * s, 0, 5 * s, 3.8 * s, K.pink); disc(-22 * s, -8 * s, 1.9 * s, K.ink);
  oval(-16 * s, -13 * s, 4 * s, 2.4 * s, K.pinkL, -0.5); line(-25 * s, -12 * s, -27 * s, -18 * s, 3 * s, K.yellow); line(-20 * s, -12 * s, -18 * s, -18 * s, 3 * s, K.yellow);
  c.restore();
}
// a little person, arms up, legs dangling
function person(x, y, s, rot, shirt, skin, ph) {
  if (s <= 0) return;
  const c = raw();
  c.save(); c.translate(x, y); c.rotate(rot);
  for (const sd of [-1, 1]) {
    line(sd * 3 * s, 12 * s, sd * 4 * s + 3 * s * S(ph + sd), 25 * s, 4 * s, K.ink);                       // legs
    const hx = sd * (11 + 3 * S(ph * 1.3 + sd * 2)) * s, hy = -10 * s + 3 * s * S(ph + sd);
    line(sd * 6 * s, 2 * s, hx, hy, 4 * s, K.ink); disc(hx, hy, 3.4 * s, skin);                             // arms up
  }
  boxO(0, 6 * s, 13 * s, 17 * s, shirt, 0, 5 * s, 2.4 * s);
  discO(0, -9 * s, 7.5 * s, skin, 2.4 * s);
  disc(-2.8 * s, -10 * s, 1.3 * s, K.ink); disc(2.8 * s, -10 * s, 1.3 * s, K.ink); oval(0, -5.5 * s, 1.8 * s, 2.4 * s, K.ink);
  c.restore();
}
// the alien: a big green head with slanted eyes and two antennae
function alien(x, y, s, lx, blink) {
  for (const sd of [-1, 1]) { line(x + sd * 5 * s, y - 12 * s, x + sd * 11 * s, y - 24 * s, 3 * s, K.ink); discO(x + sd * 11 * s, y - 26 * s, 3.6 * s, K.pink, 1.6 * s); }
  ovalO(x, y, 13 * s, 15 * s, K.green, 0, 2.6 * s);
  for (const sd of [-1, 1]) { oval(x + sd * 5.6 * s, y + s, 4.3 * s, 6.6 * s * blink, K.ink, sd * 0.55); disc(x + sd * 5 * s + lx * s, y - s, 1.3 * s * blink, K.white); }
  arcS(x, y + 4 * s, 3.5 * s, 0.15 * PI, 0.85 * PI, 1.8 * s, K.ink);
}

/* ---------- V ---------- */

const SALVOS = [[0.95, 1.4, 1.8], [0.95, 1.3, 1.6, 1.9, 2.15]];          // when the volcano throws lava: lowercase, capital

// where a volcano stands (the same for its backdrop and its foreground): the size of a glyph unit, the crater rim, the hero's middle
function volcano(a) {
  const { w, h } = a, unit = Math.min(w * 0.62 / 80, h * 0.46 / 100) * a.hs, ground = h * 0.32, rim = ground - 0.03 * h - 83 * unit, rx = 38 * unit;
  return { unit, rim, y0: rim + 41.5 * unit, ground, rx, W1: Math.max(w * 0.5, rx + 1.25 * (ground - rim)) };
}
// the ground shaking: a small jitter that grows through the rumble and dies away after the eruption
const Q = [0, 0];
function quake(a, t) {
  const amp = a.u * 0.011 * (0.15 + 0.85 * seg(t, 0.25, 0.95)) * (1 - 0.8 * seg(t, 1.0, 1.9)) * a.x(0.3) * (t < 0.06 ? 0 : 1);
  Q[0] = S(t * 53) * amp; Q[1] = S(t * 71 + 2) * amp;
  return Q;
}
// a fireball thrown from (x0, y0) at ts: a teardrop with embers trailing it
function fireball(a, t, ts, x0, y0, ang, v, r, g) {
  const age = t - ts;
  if (age <= 0 || age > 1.7) return;
  const vx = C(ang) * v, vy = S(ang) * v, s = r * (1 - seg(age, 1.3, 1.7));
  for (let m = 4; m >= 0; m--) {
    const tt = age - m * 0.04, x = x0 + vx * tt, y = y0 + vy * tt + 0.5 * g * tt * tt;
    if (tt <= 0) continue;
    if (m) { disc(x, y, s * (1 - m * 0.17), m & 1 ? K.orange : K.red); continue; }
    const rot = Math.atan2(-vx, -(vy + g * tt));
    drop(x, y, s, rot, K.red); drop(x, y, s * 0.72, rot, K.orange); drop(x, y, s * 0.4, rot, K.yellow);
  }
}

// a palm tree in silhouette that thrashes about while the volcano rumbles
function palm(x, y, s, lean, t, seed) {
  const sway = S(t * 30 + seed * 2) * 0.05 * seg(t, 0.25, 0.95) + 0.05 * S(t * 2 + seed), pts = [];
  for (let i = 0; i <= 6; i++) { const f = i / 6; pts.push(x + (lean * f * f + sway * f) * s, y - f * 1.3 * s); }
  pline(pts, s * 0.1, K.ink);
  const tx = pts[12], ty = pts[13];
  for (let i = 0; i < 6; i++) { const an = -PI + (i + 0.5) / 6 * PI + sway * 2 + S(t * 3 + i + seed) * 0.05; leaf(tx + C(an) * s * 0.3, ty + S(an) * s * 0.3 + s * 0.08, s * 0.34, an + PI / 2, K.ink); }
}

/* ---------- W ---------- */

const RAINBOW = [K.red, K.orange, K.yellow, K.green, K.blue, K.purple];
const BACK_SEA = [K.skyD, K.blue, K.blueD], FRONT_SEA = [K.indigo, K.indigoD];

// one layer of sea: a wavy band from y down, that swells and sloshes harder after each slap; the front layers carry flecks of foam
function sea(a, t, j, y, col) {
  const k1 = t > 1.15 ? Math.exp(-2.6 * (t - 1.15)) : 0, k2 = t > 1.96 ? 0.5 * Math.exp(-3 * (t - 1.96)) : 0, amp = a.h * 0.014 * (1 + 2.6 * (k1 + k2)) * (1 + 0.15 * j);
  const len = a.w * (0.42 + 0.07 * j), ph = t * (1.3 + 0.3 * j) * (j & 1 ? -1 : 1) + j * 1.7 + 3 * (k1 + k2);
  band(-a.bw / 2, a.bw / 2, y, amp, len, ph, col, a.bh);
  if (j > 2) bits([K.white], 14, i => { const x = (((a.r(i, 1) + t * 0.03 * (j - 2)) % 1) - 0.5) * a.w * 1.1; addDisc(x, y + amp * S(x / len * TAU + ph) + a.k * 4, a.k * (2.5 + 4 * a.r(i, 2))); });
}
// a little fish, heading along rot
function fish(x, y, s, rot, col, wag) {
  const c = raw();
  c.save(); c.translate(x, y); c.rotate(rot);
  poly([-s * 0.8, 0, -s * 1.9, -s * (0.75 + 0.15 * wag), -s * 1.9, s * (0.75 - 0.15 * wag)], col);
  ovalO(0, 0, s * 1.2, s * 0.65, col, 0, s * 0.14); poly([-s * 0.2, -s * 0.5, s * 0.3, -s * 1.1, s * 0.5, -s * 0.4], col);
  disc(s * 0.65, -s * 0.12, s * 0.2, K.ink);
  c.restore();
}
// a slim pointed spike of water from (x, y) heading angle ang
function spike(x, y, ang, len, col) {
  const w = len * 0.13, nx = -S(ang), ny = C(ang);
  poly([x + nx * w, y + ny * w, x + C(ang) * len, y + S(ang) * len, x - nx * w, y - ny * w], col); disc(x, y, w, col);
}
// teardrops of water thrown from (x, y) at t0, flying in arcs
function waterDrops(a, t, o) {
  const age = t - o.t0;
  if (age <= 0 || age > o.life) return;
  for (let i = 0; i < o.n; i++) {
    const an = o.a0 + (o.a1 - o.a0) * a.r(o.seed + i, 1), v = o.v0 + (o.v1 - o.v0) * a.r(o.seed + i, 2), vx = C(an) * v, vy = S(an) * v;
    const x = o.x + vx * age, y = o.y + vy * age + 0.5 * o.g * age * age, r = (o.s0 + (o.s1 - o.s0) * a.r(o.seed + i, 3)) * (1 - seg(age / o.life, 0.6, 1));
    drop(x, y, r, Math.atan2(-vx, -(vy + o.g * age)), i & 1 ? K.white : K.skyL);
  }
}

/* ---------- X ---------- */

// where the treasure map lies: its middle, its size, and the spot the X marks
function mapLayout(a) {
  const { w, h } = a, tall = h > w * 1.2, Wm = Math.min(w * 0.9, h * 1.3), Hm = tall ? Math.min(h * 0.62, Wm * 1.35) : Math.min(h * 0.74, Wm * 0.8), sx = 0, sy = -h * 0.03;
  return { Wm, Hm, sx, sy, spot: { x: sx + Wm * 0.06, y: sy + Hm * 0.04 } };
}
// a point on the winding trail (in map coordinates) a fraction f of the way from the ship to the X's spot
const TRL = { x: 0, y: 0 }, WAY = [[-0.36, 0.3], [-0.36, 0.3], [-0.33, 0.02], [-0.2, -0.22], [0.02, -0.27], [0.21, -0.1], [0.2, 0.13], [0.06, 0.04], [0.06, 0.04]];
function trailAt(L, f) {
  const n = WAY.length - 3, q = Math.min(n - 1e-6, f * n), i = Math.floor(q), r = q - i, p0 = WAY[i], p1 = WAY[i + 1], p2 = WAY[i + 2], p3 = WAY[i + 3];
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * r + (2 * a - 5 * b + 4 * c - d) * r * r + (-a + 3 * b - 3 * c + d) * r * r * r);
  TRL.x = cr(p0[0], p1[0], p2[0], p3[0]) * L.Wm; TRL.y = cr(p0[1], p1[1], p2[1], p3[1]) * L.Hm;
}
// a treasure chest with its foot at (x, y), u1 pixels to a unit (92 units wide); open: how far the lid has flipped (0..1, a little over when it bounces); pp: how far it has popped up
function chest(x, y, u1, open, pp, k) {
  if (pp <= 0.01) return;
  const c = raw(), phi = open * PI, lid = Math.abs(C(phi)) * 34 * u1, ol = 3 * k, pile = E.out(seg(open, 0.4, 0.9));
  c.save(); c.translate(x, y); c.scale(1 + 0.14 * (1 - pp), pp);
  if (phi > PI / 2 && lid > 1) { boxO(0, -48 * u1 - lid / 2, 84 * u1, lid, K.orangeD, 0, 12 * u1, ol); for (const sd of [-1, 1]) box(sd * 30 * u1, -48 * u1 - lid / 2, 8 * u1, lid * 0.9, K.yellow, 0, 2 * u1); }
  boxO(0, -23 * u1, 92 * u1, 46 * u1, K.orange, 0, 8 * u1, ol);
  for (const yy of [-15, -31]) line(-40 * u1, yy * u1, 40 * u1, yy * u1, 2.4 * k, K.orangeD);
  for (const sd of [-1, 1]) box(sd * 31 * u1, -23 * u1, 9 * u1, 46 * u1, K.yellow, 0, 2 * u1);
  if (pile > 0.02) { ovalO(0, -46 * u1, 42 * u1, 10 * u1 * pile, K.yellow, 0, ol); bits([K.orange], 3, i => addDisc((i - 1) * 16 * u1, -46 * u1, 4 * u1 * pile)); }
  discO(0, -34 * u1, 7 * u1, K.yellow, 2.4 * k); disc(0, -35 * u1, 2.4 * u1, K.ink); box(0, -32 * u1, 2 * u1, 5 * u1, K.ink);
  if (phi <= PI / 2 && lid > 1) { boxO(0, -46 * u1 - lid / 2, 88 * u1, lid, K.orange, 0, 14 * u1, ol); for (const sd of [-1, 1]) box(sd * 31 * u1, -46 * u1 - lid / 2, 9 * u1, lid, K.yellow, 0, 2 * u1); }
  c.restore();
}
// the ink splat the X leaves: a blot, flying drops and a few drips
function splat(a, t, x, y, r) {
  blob(x, y + r * 0.1, r, 3, 0.18, t, K.redD, 16);
  bits([K.redD], 9, i => { const an = i / 9 * TAU + 0.3, d = r * (1.25 + 0.4 * a.r(i, 1)); addDisc(x + C(an) * d, y + S(an) * d * 0.7, r * (0.04 + 0.08 * a.r(i, 2))); });
  for (let i = 0; i < 3; i++) drop(x + (i - 1) * r * 0.55, y + r * (0.95 + 0.25 * a.r(i, 3)), r * 0.1, PI, K.redD);
}

/* ---------- Y ---------- */

// the three shots: when the ball is pulled back, released, leaves the fork and hits its balloons
const SHOTS = [{ pull: 0.05, rel: 0.28, T: 0.36 }, { pull: 0.6, rel: 0.83, T: 0.36 }, { pull: 1.15, rel: 1.38, T: 0.38 }].map(s => ({ ...s, tl: s.rel + 0.04, hit: s.rel + 0.04 + s.T }));
const BALLOON = [K.pink, K.yellow, K.orange, K.purple, K.red, K.lime, K.green];      // balloon colours, in the order they are handed out
const RINGS = [[2.3, K.skyL], [1.95, K.sky], [1.6, K.skyL], [1.25, K.sky], [0.95, K.white], [0.7, K.blue], [0.45, K.white], [0.22, K.blue]];      // the bullseye, biggest first
const BP = { x: 0, y: 0, r: 0 }, POUCH = { x: 0, y: 0 }, BX = [0, 0, 0], BY = [0, 0, 0];
const SOL = { th: [0, 0, 0], vx: [0, 0, 0], vy: [0, 0, 0], fx: [0, 0, 0], fy: [0, 0, 0] };

// where the slingshot stands and how big everything is; the three bunches of balloons hang in a row above it, kept inside the stage
function slingLayout(a) {
  const { w, h, u } = a, unit = Math.min(h * 0.38 / 100, w * 0.5 / 76) * a.hs, ground = h * 0.3, y0 = ground - 50 * unit, sb = Math.min(u * 0.16, w * 0.11) * a.x(0.15);
  const rowY = Math.max(-0.47 * h + 1.7 * sb + 0.03 * h, Math.min(-0.3 * h, y0 - 50 * unit - 0.14 * h));
  BX[0] = -0.24 * w; BX[1] = 0.26 * w; BX[2] = 0; BY[0] = rowY + 0.05 * h; BY[1] = rowY + 0.09 * h; BY[2] = rowY - 0.03 * h;
  return { unit, ground, y0, sb, nb: Math.min(BALLOON.length - 1, 3 + Math.round((a.X - 1) * 2.4)), rb: Math.min(u * 0.15, w * 0.1) * a.x(0.2), g: u * 3.4 };
}
// balloon i of bunch j at time t (BP: x, y, tilt)
function bunchAt(a, L, j, i, t) {
  const an = i * 2.4 + j, d = i ? L.sb * 1.35 : 0;
  BP.x = BX[j] + C(an) * d + S(t * 1.7 + j * 2 + i) * a.w * 0.008; BP.y = BY[j] + S(an) * d * 0.45 + S(t * 2.1 + i * 1.3 + j) * a.h * 0.01 + (1 - E.outBack(seg(t, 0.03 + 0.05 * (i + j), 0.45))) * a.h * 0.6; BP.r = 0.1 * S(t * 1.9 + i + j);
}
// the slingshot tilts about its foot, which stays on the ground: where its middle is, and where the pouch is (pulled back `pull` glyph units from the fork)
const HERO = { x: 0, y: 0 };
function heroAt(L, ps) { HERO.x = S(ps.rot) * 50 * L.unit * ps.sy; HERO.y = L.ground - C(ps.rot) * 50 * L.unit * ps.sy; }
function pouchAt(L, ps, pull, out) {
  const ly = (8.5 + pull - 50) * L.unit * ps.sy;
  heroAt(L, ps);
  out.x = HERO.x - ly * S(ps.rot); out.y = HERO.y + ly * C(ps.rot);
}
// the slingshot's tilt, squash and pulled-back band at time t, given where each shot must aim
const PS = { rot: 0, sx: 1, sy: 1, pull: 0, bow: 0 };
function slingPose(t, th = SOL.th) {
  let rot = 0, pull = 0, bow = 0, sq = 0;
  for (let j = 0; j < 3; j++) {
    const sh = SHOTS[j];
    if (t < sh.rel) {                                                     // drawing back: the slingshot leans into the shot and squashes
      const p = E.io(seg(t, sh.pull, sh.rel));
      rot += th[j] * E.io(seg(t, sh.pull - 0.05, sh.rel)); pull = Math.max(pull, 58 * p); sq += 0.06 * p;
    } else {                                                              // let go: the frame rocks back and the band twangs
      const tau = t - sh.rel;
      rot += th[j] * Math.exp(-9 * tau) * C(TAU * 2.6 * tau); pull = Math.max(pull, 58 * Math.exp(-13 * tau) * C(TAU * 5 * tau));
      bow += 5 * Math.exp(-8 * tau) * S(TAU * 7 * tau); sq -= 0.16 * Math.exp(-10 * tau) * C(TAU * 2.6 * tau);
    }
  }
  PS.rot = rot; PS.pull = pull; PS.bow = bow; PS.sy = 1 - sq; PS.sx = 1 + sq * 0.7;
  return PS;
}
// aim every shot: from where the fork is at launch to where its bunch will be at the hit, along a parabola (a few rounds, since the fork moves as the slingshot tilts)
function solveShots(a, L) {
  for (let j = 0; j < 3; j++) {
    const sh = SHOTS[j];
    bunchAt(a, L, j, 0, sh.hit); const tx0 = BP.x, ty0 = BP.y;
    let th = Math.atan2(tx0, L.y0 - ty0), fx = 0, fy = 0, vx = 0, vy = 0;
    for (let it = 0; it < 4; it++) {
      SOL.th[j] = th;
      pouchAt(L, slingPose(sh.tl), 0, POUCH);
      fx = POUCH.x; fy = POUCH.y;
      vx = (tx0 - fx) / sh.T; vy = (ty0 - fy) / sh.T - 0.5 * L.g * sh.T;
      th = 0.5 * th + 0.5 * clamp(Math.atan2(vx, -vy), -0.8, 0.8);
    }
    SOL.th[j] = th; SOL.vx[j] = vx; SOL.vy[j] = vy; SOL.fx[j] = fx; SOL.fy[j] = fy;
  }
}
// a big ball, in one of three kinds: a red one with a star, a beach ball, a purple one with spots
function ball(x, y, r, kind, rot) {
  if (r <= 1) return;
  discO(x, y, r, kind === 0 ? K.red : kind === 1 ? K.white : K.purple, r * 0.09);
  if (kind === 0) star(x, y, r * 0.7, 5, r * 0.3, rot, K.white);
  else if (kind === 1) { for (let i = 0; i < 3; i++) pie(x, y, r * 0.98, rot + i * TAU / 3, rot + i * TAU / 3 + PI / 3, [K.sky, K.yellow, K.pink][i]); disc(x, y, r * 0.16, K.white); }
  else bits([K.yellow], 5, i => addDisc(x + C(rot + i * 1.26) * r * 0.52, y + S(rot + i * 1.26) * r * 0.52, r * 0.17));
}

/* ---------- Z ---------- */

// the Z's path (glyph units, from font.js): its four points, how far along the first two corners are, and its total length
const ZP = [[9, 8.5], [59.5, 8.5], [9, 91.5], [59.5, 91.5]], ZO = { x: 0, y: 0, a: 0 }, TB = new Float32Array(3 * 160), ZSTREAM = [K.pink, K.yellow, K.sky, K.lime, K.orange];
const ZC = [0, 0], ZT = (() => { let d = 0; for (let i = 1; i < 4; i++) { d += Math.hypot(ZP[i][0] - ZP[i - 1][0], ZP[i][1] - ZP[i - 1][1]); if (i < 3) ZC[i - 1] = d; } return d; })();
// how far the zipping has got at time t (0 to 1): it opens, waits, then zips shut again
function zprog(t) { return E.io(seg(t, 0.34, 1.85)) * (1 - E.io(seg(t, 2.02, 2.4))); }
// where slider q is on the path: the first runs from the start of the Z, the second (capitals only) from its end, each covering `half` of the way
function slideAt(t, q, half) { return q ? ZT - half * zprog(t) : half * zprog(t); }
// when the sliders take each corner and reach the end, for one slider and for two (found by bisection)
const ZK = [[ZC[0], ZC[1], ZT].map(d => d / ZT), [ZC[0] / (ZT / 2), 1]].map(ps => ps.map(p => { let lo = 0.34, hi = 1.85; for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (zprog(mid) < p) lo = mid; else hi = mid; } return hi; }));
// the point d along the Z's path, and the direction it is heading
function zpos(d, out) {
  let rem = clamp(d, 0, ZT);
  for (let i = 1; i < 4; i++) {
    const dx = ZP[i][0] - ZP[i - 1][0], dy = ZP[i][1] - ZP[i - 1][1], l = Math.hypot(dx, dy);
    if (rem <= l || i === 3) { const f = Math.min(1, rem / l); out.x = ZP[i - 1][0] + dx * f; out.y = ZP[i - 1][1] + dy * f; out.a = Math.atan2(dy, dx); return out; }
    rem -= l;
  }
  return out;
}
// the direction of travel at d, smoothed over the corners
const ZH = { x: 0, y: 0, a: 0 };
function zhead(d, out) {
  zpos(d - 7, ZH); const x0 = ZH.x, y0 = ZH.y; zpos(d + 7, ZH);
  out.a = Math.atan2(ZH.y - y0, ZH.x - x0);
  return out;
}
