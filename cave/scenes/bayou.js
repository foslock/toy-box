/* Wisp Bayou · a cypress swamp at night, the last place to be found. The channel from Lantern Reef surfaces through
   the roots on the left; will-o'-wisps drift over the water. */
'use strict';
SCENES.bayou = E => {
const { p, light, spawn, sparkle, ring, sr, srnd, line, dot, rect } = E;

/* ---------- shape of the place ---------- */
const SURF = 176, EY = WAYS.bayou[1];
const MB = new Int16Array(W); for (let x = 0; x < W; x++) MB[x] = Math.round(222 + 6 * fbm(x * .05, 3));
const LB = profile([[0, 171], [50, 172], [62, 178], [70, 198], [78, 224]]), RB = profile([[234, 224], [243, 198], [251, 175], [260, 168], [W, 167]]);
const lbank = (x, y) => x < 78 && y >= Math.round(LB[x] + 1.5 * (fbm(x * .2, 1) - .5)) && !(x < 38 && y >= EY - 11 && y <= EY + 3);
const rbank = (x, y) => x >= 234 && y >= Math.round(RB[x] + 1.5 * (fbm(x * .2, 7) - .5));
const KNEES = [[104, 5], [110, 3], [188, 4], [206, 6], [214, 3]];
const knee = (x, y) => KNEES.some(([kx, h]) => y > SURF - h + Math.abs(x - kx) * 1.4 && y <= SURF + 2);
const solid = (x, y) => lbank(x, y) || rbank(x, y) || y >= MB[x] || knee(x, y);
const T = terrain(solid);
const wet = (x, y) => y >= SURF && !T.at(x, y) && y < H;
E.isSolid = (x, y) => T.at(x, y) || y >= H;
E.isWet = (x, y) => wet(Math.round(x), Math.round(y));

/* ---------- painted background ---------- */
const MOON = { x: 236, y: 42, r: 11 };
const SKY = ['#050908', '#070c0b', '#09100e', '#0c1512', '#101a16', '#141f1a', '#18241e'];
const TREES = [{ x: 44, w: 5, base: 172 }, { x: 284, w: 6, base: 167 }];
const trunk = (x, y) => { for (const t of TREES) { const flare = y > t.base - 26 ? ((y - t.base + 26) / 26) ** 2 * 7 : 0; if (y < t.base + 1 && Math.abs(x - t.x - (t.base - y) * .02) < t.w + flare) return t; } return null; };
const BR = [[[46, 86], [96, 80]], [[46, 60], [12, 50]], [[282, 70], [236, 62]], [[286, 96], [312, 88]], [[283, 50], [258, 30]], [[45, 40], [70, 22]]];
const distSeg = (x, y, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - ax - dx * k, y - ay - dy * k); };
const branch = (x, y) => BR.some(([a, b]) => distSeg(x, y, a, b) < 1.6 - Math.hypot(x - a[0], y - a[1]) / 80);
const canopy = (x, y) => y < 18 + 10 * fbm(x * .05, 4) - (x > 150 && x < 230 ? 12 : 0);
const FAR = [[120, 3, 60], [150, 2, 70], [178, 4, 50], [200, 2, 76], [16, 3, 56], [104, 2, 80], [250, 3, 64]];
const bg = mk(W, H);
paint((x, y) => {
  const n = hash(x, y);
  if (T.m[y * W + x]) {
    if (y >= MB[x]) return y === MB[x] ? '#2a2418' : fbm(x * .1, y * .1) > .5 ? '#16120c' : '#100e0a';
    const open = (a, b) => a < 0 || a >= W || b < 0 || b >= H || !T.m[b * W + a];
    if (knee(x, y)) return open(x - 1, y) ? '#5a4a3a' : '#3a3228';
    if (open(x, y - 1)) return y < SURF ? (n > .5 ? '#5a7a44' : '#4a6a3a') : '#3a3224';
    if (open(x, y - 2) && y < SURF) return '#2e3a24';
    const f = fbm(x * .12, y * .12);
    if (Math.abs(fbm(x * .06, y * .2 + 3) - .5) < .02) return '#3a2e22';
    return f > .55 ? '#241e16' : '#1a1610';
  }
  const tr = trunk(x, y);
  if (tr) { const rel = (x - tr.x) / (tr.w + 1); if (rel < -.5 && fbm(x * .2, y * .1) > .55) return '#4a5a3a'; return hash(x * 2.3, Math.floor(y / 3)) > .8 ? '#1a1614' : rel < -.4 ? '#3a3228' : rel < .4 ? '#2a2420' : '#1a1614'; }
  if (branch(x, y) || canopy(x, y)) return canopy(x, y) && !canopy(x, y + 1) ? '#2a3420' : n > .6 ? '#1e2418' : '#141a12';
  if (y >= SURF) { const d = y - SURF; return band(['#060e0a', '#0a1410', '#0e1a14', '#122018', '#16281e', '#1c3024'], 1 - d / 48 + (fbm(x * .05, y * .08) - .5) * .2, x, y); }
  for (const [fx, fw, top] of FAR) if (y > top && Math.abs(x - fx) < fw + (y > SURF - 14 ? (y - SURF + 14) * .3 : 0)) return y < top + 2 ? '#1e2a20' : '#0e1612';
  const md = Math.hypot(x - MOON.x, y - MOON.y);
  if (md < MOON.r) return md > MOON.r - 1 ? '#c8d0b0' : fbm(x * .3, y * .3) > .6 ? '#c8d4b0' : '#dce4c4';
  let v = y / 150 + .12 * Math.max(0, 1 - md / 60) + (fbm(x * .015, y * .03) - .5) * .12 + .2 * Math.exp(-(((y - 160) / 18) ** 2));
  const s = starAt(x, y, .996); if (s && y < 110 && md > 20) return '#8a9a88';
  return band(SKY, v, x, y);
}, bg);

/* ---------- moss, reeds, lilies, water, mist, wisps ---------- */
const MOSS = [];
for (const [a, b] of BR) for (let k = .2; k < 1; k += .16) MOSS.push({ x: Math.round(lerp(a[0], b[0], k)), y: Math.round(lerp(a[1], b[1], k)) + 1, len: Math.round(sr(6, 18)), ph: sr(0, TAU) });
for (let x = 8; x < W; x += 9) if (!(x > 150 && x < 230)) MOSS.push({ x: x + Math.round(sr(-3, 3)), y: Math.round(18 + 10 * fbm(x * .05, 4)), len: Math.round(sr(8, 26)), ph: sr(0, TAU) });
function drawMoss(t) {
  for (const m of MOSS) {
    const sw = Math.sin(t * .5 + m.ph) * 1.2;
    for (let k = 0; k < m.len; k++) { const x = m.x + Math.round(sw * (k / m.len) ** 2 + (k % 5 === 4 ? 1 : 0)); dot(x, m.y + k, k % 3 === 0 ? '#8a9a78' : k > m.len - 3 ? '#4a5a44' : '#6a7a60'); }
  }
}
const REEDS = [8, 14, 22, 48, 54, 256, 266, 272, 300, 308].map(x => ({ x, h: Math.round(sr(8, 16)), ph: sr(0, TAU), cat: srnd() < .5 }));
function drawReeds(t) {
  for (const r of REEDS) {
    const base = T.ground(r.x, 100) - 1, sw = Math.sin(t * .8 + r.ph) * .8;
    for (let i = 0; i < r.h; i++) dot(r.x + Math.round(sw * (i / r.h) ** 2), base - i, i > r.h - 3 ? '#6a8a4a' : '#3a5a2e');
    if (r.cat) { const tx = r.x + Math.round(sw); rect(tx, base - r.h + 2, 1, 3, '#5a3a22'); }
  }
}
const LILIES = [[132, 1], [148, 0], [196, 1], [120, 0], [178, 1]].map(([x, f]) => ({ x, f, ph: sr(0, TAU) }));
const ripples = [];
const ripple = (x, s = 1) => ripples.push({ x, r: 0, t: 0, life: 1.6 * s, s });
function drawWater(t) {
  for (let x = 0; x < W; x++) { if (!wet(x, SURF)) continue; const s = Math.sin(x * .5 + t * 1.2) + Math.sin(x * .17 - t * .7); dot(x, SURF, s > 1.3 ? '#9ac8a8' : s > .3 ? '#4a7a5a' : '#2a4a3a'); }
  for (let k = 0; k < 4; k++) { const w = 7 - k * 1.5, o = Math.round(Math.sin(t * 1.3 + k) * 1.4); p.globalAlpha = .45 - k * .1; rect(MOON.x + o - w / 2, SURF + 2 + k * 2, Math.round(w), 1, '#d8e4c0'); } p.globalAlpha = 1;
  p.fillStyle = '#9ac8a8';
  for (const r of ripples) { p.globalAlpha = (1 - r.t / r.life) * .8; for (let k = 0; k <= 12; k++) { const an = Math.PI * k / 12, xx = Math.round(r.x + Math.cos(an) * r.r), yy = Math.round(SURF + Math.sin(an) * r.r * .25); if (wet(xx, yy)) p.fillRect(xx, yy, 1, 1); } }
  p.globalAlpha = 1;
  for (const l of LILIES) { const bob = Math.sin(t + l.ph) > .7 ? 1 : 0; rect(l.x - 3, SURF - 1 + bob, 6, 1, '#3a7a44'); dot(l.x - 1, SURF - 1 + bob, '#2a5a34'); if (l.f) { const pu = .5 + .5 * Math.sin(t * 1.2 + l.ph); dot(l.x + 1, SURF - 2 + bob, '#f0f8f0'); dot(l.x, SURF - 2 + bob, '#d8f0e0'); dot(l.x + 2, SURF - 2 + bob, '#d8f0e0'); dot(l.x + 1, SURF - 3 + bob, '#ffffff'); light(l.x + 1.5, SURF - 2 + bob, 5 + pu * 2, '#e0ffe8', .2 + .12 * pu); } }
  for (let i = 0; i < 14; i++) { const x = (i * 23 + 7) % 300 + 10, y = SURF + 4 + (i * 11) % 30; if (wet(x, y)) { const pu = .5 + .5 * Math.sin(t * .9 + i * 1.9); p.globalAlpha = pu; dot(x, y, '#5affb0'); p.globalAlpha = 1; light(x + .5, y + .5, 3, '#3affa0', .15 + .2 * pu); } }
}
// low mist over the water, scrolled slowly
const MIST = mk(W * 2, 26);
{ const m = MIST.getContext('2d'); for (let j = 0; j < 26; j++) for (let i = 0; i < W * 2; i++) { const v = fbm(i * .025, j * .12) * (1 - Math.abs(j - 13) / 13); if (v > .32 + bay(i, j) * .22) { m.fillStyle = v > .5 ? '#6a8a78' : '#4a6a5a'; m.fillRect(i, j, 1, 1); } } }
function drawMist(t) { const o = Math.round((t * 3) % (W * 2)); p.globalAlpha = .28; p.drawImage(MIST, -o, SURF - 18); p.drawImage(MIST, W * 2 - o, SURF - 18); p.globalAlpha = 1; }
const WISPS = Array.from({ length: 6 }, (_, i) => ({ x: rr(30, 290), y: rr(90, 160), ph: rr(0, TAU), sp: rr(.2, .5), c: i % 2 ? '#8affd8' : '#a8e8ff' }));
function drawWisps(t) {
  for (const w of WISPS) {
    const x = w.x + Math.sin(t * w.sp + w.ph) * 26, y = w.y + Math.sin(t * w.sp * 1.7 + w.ph * 2) * 10, pu = .5 + .5 * Math.sin(t * 2.3 + w.ph);
    dot(x, y, '#ffffff'); dot(x - 1, y, w.c); dot(x + 1, y, w.c); dot(x, y - 1, w.c); dot(x, y + 1, w.c);
    light(x + .5, y + .5, 8 + pu * 5, w.c, .4 + .25 * pu); light(x + .5, y + .5, 24, w.c, .06);
    if (R() < .04) spawn({ x, y, vx: rr(-3, 3), vy: rr(-6, -2), life: rr(.8, 1.4), col: w.c, gc: w.c, glow: 2, ga: .4, fin: .05, fout: .8 });
  }
}

/* ---------- ALLIGATOR ---------- */
const gator = (() => {
  const G = '#3a4a2a', g = '#2a3620', y = '#e8d060', k = '#0a0a06', t = '#e8e0c8';
  const o = { name: 'alligator', caption: 'The alligator lunges and snaps', busy: false, tt: 0, x: 200, dir: -1, rise: 0, jaw: 0 };
  o.box = () => [o.x - 8, SURF - 4 - o.rise, 16, 6 + o.rise];
  o.update = (dt, t) => {
    if (!o.busy) { o.x = 196 + Math.sin(t * .12) * 14; o.dir = Math.cos(t * .12) > 0 ? 1 : -1; return; }
    o.tt += dt; const T0 = o.tt;
    if (T0 < .7) o.rise = 0;
    else if (T0 < 1.1) { o.rise = (T0 - .7) / .4 * 6; o.jaw = (T0 - .7) / .4 * 3; if (!o.s) { o.s = true; E.splash(o.x, SURF - 1, 10, '#b8d8c0', '#6ab890'); ripple(o.x, 1.2); } }
    else if (T0 < 1.3) { o.rise = 6; o.jaw = 0; if (!o.snap) { o.snap = true; ring(o.x + o.dir * 8, SURF - 6, 14, '#e8f0d0', .5); E.splash(o.x + o.dir * 6, SURF - 1, 6, '#b8d8c0', '#6ab890'); } }
    else if (T0 < 1.9) o.rise = 6 * (1 - (T0 - 1.3) / .6);
    else { o.rise = 0; if (!o.e) { o.e = true; ripple(o.x, 1.4); ripple(o.x + 3, 1); } if (T0 > 2.4) o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.s = o.snap = o.e = false; };
  o.draw = t => {
    const X = Math.round(o.x), d = o.dir, r = Math.round(o.rise), P = (dx, dy, c) => dot(X + dx * d, SURF + dy, c);
    // dark shape under the water
    p.globalAlpha = .35; for (let i = -12; i <= 6; i++) P(i, 2 + (i < -6 ? 1 : 0), '#0a120a'); p.globalAlpha = 1;
    if (r === 0) { P(-2, -1, G); P(-1, -1, y); P(1, -1, G); P(2, -1, y); P(6, -1, g); P(7, -1, g); light(X - d + .5, SURF - 1, 3, '#e8d060', .25); light(X + 2 * d + .5, SURF - 1, 3, '#e8d060', .25); return; }
    const j = Math.round(o.jaw);
    for (let i = -3; i <= 8; i++) { P(i, -r, G); P(i, -r + 1, g); if (i > 1) { P(i, -r - j, G); if (j > 0 && i % 2) P(i, -r - j + 1, t); } }
    P(-1, -r - 1, G); P(0, -r - 1, y); P(8, -r - j - 1, g); P(1, -r - j - 1, G);
    for (let i = -6; i <= -4; i++) for (let dy = -r + 1; dy <= 0; dy++) P(i, dy, g);
  };
  return o;
})();

/* ---------- HERON in the shallows ---------- */
const heron = (() => {
  const pal = { B: '#6a7a90', b: '#4a5a70', w: '#c8d0dc', k: '#0a0a10', y: '#d8b040', l: '#5a5040' };
  const stand = spr(['..www...', '.wwkyy..', '..ww....', '..B.....', '..B.....', '.BB.....', 'BBBB....', 'BBBBB...', 'bBBBBb..', '.bBBb...', '..l.....', '..l.....', '..l.....', '..l.....', '..l.....'], pal);
  const strike = spr(['........', '........', '........', '........', '...BBB..', '..B...B.', '.BBB...B', 'BBBBB..w', 'bBBBBb.wk', '.bBBb....y', '..l......y', '..l.......', '..l.......', '..l.......', '..l.......'].map(r => r.padEnd(10, '.')), pal);
  const X = 92;
  const o = { name: 'heron', caption: 'The heron spears a fish', busy: false, tt: 0, pose: 'stand', fish: 0 };
  o.box = () => [X - 2, SURF - 15, 10, 16];
  o.update = (dt) => {
    o.fish = Math.max(0, o.fish - dt);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < 1.2) o.pose = 'stand';
    else if (T0 < 1.7) { o.pose = 'strike'; if (!o.s) { o.s = true; E.splash(X + 9, SURF - 1, 8, '#b8d8c0', '#6ab890'); ripple(X + 9, 1); } }
    else if (T0 < 3.2) { o.pose = 'stand'; o.fish = T0 < 2.7 ? 1 : 0; if (T0 > 2.7 && !o.g) { o.g = true; sparkle(X + 4, SURF - 13, 4, '#d8e8ff', '#8ac8ff'); } }
    else o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.s = o.g = false; };
  o.draw = t => {
    const s = o.pose === 'strike' ? strike : stand;
    p.save(); p.beginPath(); p.rect(0, 0, W, SURF + 1); p.clip(); p.drawImage(s, X, SURF - 14); p.restore();
    if (o.pose === 'stand' && !o.busy && Math.sin(t * .4) > .95) dot(X + 4, SURF - 13, '#d8b040');
    if (o.fish > 0) { dot(X + 5, SURF - 13, '#a8c8e8'); dot(X + 6, SURF - 13, '#c8e0f8'); dot(X + 6, SURF - 12, '#88a8c8'); }
  };
  return o;
})();

/* ---------- TURTLES on the log ---------- */
const turtles = (() => {
  const LOG = { x0: 116, x1: 170 };
  const pal = { S: '#3a4a2a', s: '#5a6a3a', h: '#6a7a4a', k: '#0a0a06', y: '#c8b040' };
  const sp = spr(['..SSS..', '.SsSsS.', 'SSSSSShk', '.h...h..'].map(r => r.padEnd(8, '.')), pal);
  const T3 = [124, 136, 150].map((x, i) => ({ x, y: 0, st: 'log', t: 0, i }));
  const o = { name: 'turtles', caption: 'The turtles plop off the log one by one', busy: false, tt: 0 };
  o.box = () => [LOG.x0, SURF - 9, LOG.x1 - LOG.x0, 9];
  o.update = (dt) => {
    for (const q of T3) {
      q.t += dt;
      if (q.st === 'drop') { const k = Math.min(1, q.t / .35); q.y = k * 6; q.x += 8 * dt; if (k >= 1) { q.st = 'under'; q.t = 0; E.splash(q.x + 3, SURF - 1, 6, '#b8d8c0', '#6ab890'); ripple(q.x + 3, 1); } }
      else if (q.st === 'under' && q.t > 2.5 + q.i * .6) { q.st = 'climb'; q.t = 0; ripple(q.x + 3, .8); }
      else if (q.st === 'climb') { const k = Math.min(1, q.t / .8); q.y = 6 * (1 - k); q.x = lerp(q.x, q.home, dt * 3); if (k >= 1) { q.st = 'log'; q.y = 0; q.x = q.home; } }
    }
    if (!o.busy) return;
    o.tt += dt; const k = Math.floor(o.tt / .6);
    if (k < 3 && T3[2 - k].st === 'log') { const q = T3[2 - k]; q.st = 'drop'; q.t = 0; }
    if (o.tt > 1.5 && T3.every(q => q.st === 'log')) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; T3.forEach(q => { q.home = [124, 136, 150][q.i]; }); };
  T3.forEach(q => { q.home = q.x; });
  o.draw = () => {
    // the log
    rect(LOG.x0, SURF - 3, LOG.x1 - LOG.x0, 3, '#3a2e22'); rect(LOG.x0 + 1, SURF - 4, LOG.x1 - LOG.x0 - 2, 1, '#4a3c2c'); rect(LOG.x1 - 1, SURF - 3, 2, 3, '#6a5238'); dot(LOG.x0 + 12, SURF - 5, '#4a6a3a'); dot(LOG.x0 + 30, SURF - 5, '#4a6a3a');
    for (const q of T3) {
      if (q.st === 'under') { p.globalAlpha = .3; p.drawImage(sp, Math.round(q.x), SURF + 3); p.globalAlpha = 1; continue; }
      p.save(); p.beginPath(); p.rect(0, 0, W, SURF); p.clip(); p.drawImage(sp, Math.round(q.x), SURF - 8 + Math.round(q.y)); p.restore();
    }
  };
  return o;
})();

/* ---------- POSSUM hanging from the cypress ---------- */
const possum = (() => {
  const pal = { G: '#a8a0a8', g: '#7a727a', w: '#e8e0e8', k: '#0a0808', n: '#e89aa8', t: '#d8b8c0' };
  const hang = spr(['..t..', '..t..', '.GGG.', 'GGGGG', 'GgGgG', '.GGG.', '.GGG.', '.wkw.', '..w..', '..n..'], pal);
  const dead = spr(['...........', '.g.g.g.g...', 'GGGGGGGGww.', 'GGGGGGGwxwn', '.ttt....w..'], { ...pal, x: '#1a1418' });
  const walk = spr(['.......ww..', '.GGGGGGwkw.', 'GGGGGGGGwwn', 'tG.G..G.G..', 't..........'], pal);
  const BX = 76, BY = 83;
  const o = { name: 'possum', caption: 'The possum drops and plays dead', busy: false, tt: 0, x: BX, y: BY + 1, pose: 'hang', sw: 0 };
  const floor = () => T.ground(Math.round(o.x), 100) - 1;
  o.box = () => o.pose === 'hang' ? [BX - 3, BY, 7, 12] : [o.x - 6, floor() - 5, 12, 6];
  o.update = (dt, t) => {
    o.sw = Math.sin(t * .8) * 1.2;
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt, fl = T.ground(60, 100) - 1;
    if (T0 < .5) o.pose = 'hang';
    else if (T0 < 1.3) { o.pose = 'fall'; const k = (T0 - .5) / .8; o.x = lerp(BX, 60, k); o.y = lerp(BY + 1, fl - 4, k * k); }
    else if (T0 < 4.2) { if (o.pose !== 'dead') { o.pose = 'dead'; E.rubble(o.x, fl, 6, ['#3a3224', '#5a7a44'], 3); ring(o.x, fl - 3, 14, '#e8e0e8', .6); } }
    else if (T0 < 5.6) { o.pose = 'walk'; o.x = lerp(60, 44 + 8, (T0 - 4.2) / 1.4); }
    else if (T0 < 7.2) { o.pose = 'climb'; const k = (T0 - 5.6) / 1.6; o.x = 52; o.y = lerp(fl - 4, BY + 6, k); }
    else { o.pose = 'hang'; o.x = BX; o.y = BY + 1; o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; };
  o.draw = () => {
    if (o.pose === 'hang') { line(BX, BY, BX + Math.round(o.sw * .5), BY + 1, '#d8b8c0'); p.drawImage(hang, BX - 2 + Math.round(o.sw), BY + 1); return; }
    if (o.pose === 'fall') { E.spin(hang, o.x, o.y, Math.PI * (o.tt - .5) * 1.2); return; }
    if (o.pose === 'dead') { p.drawImage(dead, Math.round(o.x) - 5, floor() - 4); return; }
    if (o.pose === 'walk') { E.blit(walk, Math.round(o.x) - 5, floor() - 4, true); return; }
    E.spin(walk, o.x, o.y, -Math.PI / 2);
  };
  return o;
})();

/* ---------- RACCOON washing its supper ---------- */
const raccoon = (() => {
  const pal = { G: '#6a6a70', g: '#4a4a52', w: '#d8d8dc', k: '#0a0a0c', m: '#1a1a20', r: '#2a2a30' };
  const sit = spr(['.g..g...', '.GGGG...', 'wmkmkw..', '.GwGwn..', '..GGG...', '.GGGGG.r', '.GGGGGGr', 'GGGGGGG.', '.g.g.g..'], pal);
  const reach = spr(['........', '.g..g...', '.GGGG...', 'wmkmkw..', '.GwGwn..', '..GGGG..', '.GGGGGG.', 'rGGGGGGG', 'r.g.g.gg'], pal);
  const X = 261;
  const o = { name: 'raccoon', caption: 'The raccoon washes its supper', busy: false, tt: 0, pose: 'sit', snack: false };
  o.box = () => [X - 8, SURF - 16, 10, 10];
  const gy = () => T.ground(X - 4, 100) - 1;
  o.update = (dt) => {
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < .4) o.pose = 'sit';
    else if (T0 < 2.6) { o.pose = 'reach'; if (Math.floor(T0 * 5) !== o.k) { o.k = Math.floor(T0 * 5); E.splash(X - 9, SURF - 1, 2, '#b8d8c0', '#6ab890'); if (o.k % 3 === 0) ripple(X - 9, .6); } }
    else if (T0 < 4.2) { o.pose = 'sit'; o.snack = true; if (Math.floor(T0 * 4) !== o.k2) { o.k2 = Math.floor(T0 * 4); if (T0 > 3.2) spawn({ x: X - 6, y: gy() - 6, vx: rr(-6, 6), vy: rr(-10, -2), ay: 60, life: .5, col: '#e87a4a', fin: .01, fout: .3 }); } }
    else { o.snack = false; o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.k = o.k2 = -1; };
  o.draw = t => {
    const y = gy();
    E.blit(o.pose === 'reach' ? reach : sit, X - 8, y - 8, true);
    // ringed tail
    for (let k = 0; k < 6; k++) dot(X - 8 + 8 + k, y - 1 - (k > 3 ? k - 3 : 0), k % 2 ? '#2a2a30' : '#8a8a90');
    if (o.snack && o.tt < 3.6) { dot(X - 8, y - 5, '#e8603a'); dot(X - 9, y - 5, '#c8402a'); dot(X - 9, y - 6, '#e8603a'); }
  };
  return o;
})();

/* ---------- render ---------- */
const critters = [gator, heron, turtles, possum, raccoon];
function ambient(dt, t) { for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; r.r += dt * 12 * r.s; if (r.t > r.life) ripples.splice(i, 1); } }
return {
  critters,
  entry: { x: 0, y: EY },
  ambient,
  vig: vignette(.62, .25, '2,6,4'),
  update(dt, t) { ambient(dt, t); for (const c of critters) c.update(dt, t); },
  draw(t) {
    p.globalAlpha = 1; p.drawImage(bg, 0, 0);
    light(MOON.x, MOON.y, 22, '#e8f0c8', .22); light(MOON.x, MOON.y, 60, '#8ab890', .05);
    drawMoss(t); drawReeds(t);
    drawWater(t);
    turtles.draw(t); gator.draw(t); heron.draw(t); raccoon.draw(t); possum.draw(t);
    drawMist(t); drawWisps(t);
    E.drawParts();
    light(18, EY - 4, 12, '#6affc0', .12);
  },
  openExit() {}
};
};
