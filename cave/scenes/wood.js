/* Fernlight Wood · a moonlit forest east of the hollow. The cave tunnel comes out on a rocky porch at the left;
   a gap in the canopy leads up to Duskcrag Peaks. */
'use strict';
SCENES.wood = E => {
const { p, light, spawn, sparkle, ring, sr, srnd, line, dot, rect } = E;

/* ---------- shape of the place ---------- */
const PORCH = 118, TUN0 = 104, GX = WAYS.peaks[1];
const FL = new Int16Array(W), CAN = new Int16Array(W);
for (let x = 0; x < W; x++) { FL[x] = Math.round(201 + 4 * fbm(x * .03, 2.2)); CAN[x] = Math.round(26 + 10 * fbm(x * .045, 5.5) + 5 * fbm(x * .2, 8)); }
const cliffX = y => 20 + 7 * fbm(y * .06, 1.1) + (y > 93 ? 5 * smooth(clamp((y - 93) / 10, 0, 1)) : 0);
const faceX = y => 39 + 5 * fbm(y * .07, 2.3) - (y < PORCH + 4 ? (PORCH + 4 - y) * .8 : 0);
const rock = (x, y) => (y < TUN0 && y > 20 && x < cliffX(y)) || (y >= PORCH + (x > 26 ? Math.round(fbm(x * .3, 3)) : 0) && x < faceX(y));
let opened = false;
const HOLES = [[108, 17, 4.5], [292, 21, 3.2], [160, 11, 2.6], [58, 14, 2.4], [248, 9, 2]];
const hole = (x, y) => { for (const [hx, hy, r] of HOLES) if (Math.hypot(x - hx, (y - hy) * .8) < r + fbm(x * .5, y * .5) * 1.5) return true; return false; };
const gap = (x, y) => opened ? Math.abs(x - GX) < 9 + 3 * fbm(y * .25, 4) + Math.max(0, 14 - y) * .25 : x >= GX - 1 && x <= GX + 1 + (y < 12 ? 1 : 0) && y < CAN[x] - 1;
const FR = new Int8Array(W); for (let x = 0; x < W; x++) FR[x] = Math.round(Math.max(0, fbm(x * .35, 9) - .44) * 11);
const sky = (x, y) => y < CAN[x] && (gap(x, y) || hole(x, y));
const canopy = (x, y) => y < CAN[x] + (x > GX - 12 && x < GX + 12 ? 0 : FR[x]) && !sky(x, y);
// the old oak on the right, with a branch for the owl
const TRX = 258, trunkC = y => TRX + (200 - y) * .025;
const trunkW = y => 8 + (y > 184 ? (y - 184) ** 2 / 26 : 0) + (y < 50 ? (50 - y) * .35 : 0);
const trunk = (x, y) => y < FL[x] + 1 && Math.abs(x - trunkC(y)) < trunkW(y);
const branch = (x, y) => x >= 220 && x <= 252 && y >= 92 - (252 - x) * .03 && y <= 93 + (x - 220) * .06;
const LOG = { x0: 148, x1: 198 };
const logTop = x => FL[x] - 9 + (x < LOG.x0 + 2 ? 2 - (x - LOG.x0) : 0);
const log = (x, y) => x >= LOG.x0 && x <= LOG.x1 && y >= logTop(x) && y < FL[x];
const T = terrain(), solid = (x, y) => rock(x, y) || y >= FL[x] || canopy(x, y) || log(x, y);
T.fill(solid);
E.isSolid = (x, y) => T.at(x, y) || y >= H;

/* ---------- painted background ---------- */
const bg = mk(W, H);
const BACK = ['#040909', '#060d0e', '#081214', '#0b181a', '#0f1f22', '#13272a', '#18302f'];
const FAR = [[86, 5, .03], [132, 3, -.02], [176, 6, .01], [224, 3, .04], [306, 5, -.03], [52, 3, .02], [118, 2, 0], [196, 2, -.01]];
const open = (x, y) => x < 0 || x >= W || y < 0 || y >= H || !T.m[y * W + x];
function paintBG() {
  T.fill(solid);
  paint((x, y) => {
    const n = hash(x, y);
    if (y < CAN[x] && sky(x, y)) { const s = starAt(x, y, .985); return s ? (s > 1 ? '#e8f0ff' : '#8aa8d8') : band(['#0a1230', '#0e1840', '#132250', '#1a2c62'], .15 + y / 40, x, y); }
    if (canopy(x, y)) {
      if (!canopy(x, y + 1) && y + 1 < H) return n > .5 ? '#2a5a3c' : '#1e4630';
      if ((y > 0 && sky(x, y - 1)) || sky(x - 1, y) || sky(x + 1, y)) return n > .4 ? '#4a8a60' : '#35704c';
      const c = fbm(x * .16, y * .16 + 3);
      return c > .6 ? (n > .7 ? '#1d3e2a' : '#16301f') : c > .45 ? '#10241a' : '#0a1812';
    }
    if (rock(x, y)) {
      if (open(x, y - 1)) return n > .6 ? '#4fae62' : n > .2 ? '#3f9a58' : '#2f7a45';
      if (open(x, y - 2)) return '#1d4a2e';
      if (open(x, y + 1)) return '#0f1315';
      if (open(x - 1, y) || open(x + 1, y)) return n > .5 ? '#1f262b' : '#161c20';
      return fbm(x * .1, y * .1) > .55 ? (n > .9 ? '#1f262b' : '#141a1d') : '#0d1114';
    }
    if (y >= FL[x]) {
      const d = y - FL[x];
      if (d === 0) return n > .75 ? '#5fc070' : n > .3 ? '#3f9a58' : '#2f7a45';
      if (d === 1) return n > .5 ? '#24583a' : '#1d4a2e';
      if (n > .985) return '#2a2420';
      const r = fbm(x * .09, y * .2 + 11);
      if (Math.abs(r - .5) < .025) return '#261b15';
      return d > 20 ? (n > .5 ? '#0a0807' : '#0c0908') : (fbm(x * .1, y * .1) > .5 ? '#16110e' : '#120e0c');
    }
    if (log(x, y)) {
      const top = logTop(x), cy = (top + FL[x]) / 2;
      if (x >= LOG.x1 - 2) { const d = Math.hypot((x - LOG.x1 + 1) * 1.6, y - cy); return d < 1.2 ? '#8a6a48' : Math.floor(d) % 2 ? '#6a5038' : '#4a3626'; }
      if (y === top) return n > .4 ? '#4fae62' : '#3f9a58';
      if (y === top + 1) return n > .6 ? '#2f7a45' : '#2a201a';
      return (hash(x, Math.floor(y / 2)) > .8) ? '#140e0b' : y > cy + 2 ? '#1a130f' : '#2a1f18';
    }
    if (trunk(x, y) || branch(x, y)) {
      if (branch(x, y) && !trunk(x, y)) { if (!branch(x, y - 1)) return n > .5 ? '#3f9a58' : '#2e5a3e'; return branch(x, y + 1) ? '#241c18' : '#150f0d'; }
      if (Math.hypot(x - 253, (y - 131) * .7) < 2.6) return '#050303';
      if (Math.hypot(x - 253, (y - 131) * .7) < 3.4) return '#3a2e28';
      const rel = (x - trunkC(y)) / trunkW(y);
      if (rel < -.55 && fbm(x * .2, y * .08) > .5) return n > .6 ? '#3a7050' : '#2e5a3e';
      const st = hash(x * 3.1, Math.floor(y / 4)) > .78;
      return rel < -.5 ? (st ? '#241c18' : '#3a2e28') : rel < .35 ? (st ? '#150f0d' : '#241c18') : '#130d0b';
    }
    let v = .12 + .45 * fbm(x * .02 + 5, y * .03) + .35 * Math.exp(-(((y - 178) / 32) ** 2)) - .15 * Math.max(0, (80 - y) / 80);
    for (const [fx, fw, lean] of FAR) if (Math.abs(x - fx - (y - 120) * lean) < fw + (y > 185 ? (y - 185) * .25 : 0)) { v -= .26; break; }
    return band(BACK, v, x, y);
  }, bg);
}
paintBG();

/* ---------- plants ---------- */
// ferns with glowing tips, pre-drawn at four sway angles
const FERN = { stem: '#1f5a36', leaf: '#2f7a45', lite: '#4fae62', tip: '#b8ffd8' };
function fernFrames(len, n, seed) {
  const rnd = seeded(seed), fronds = [];
  for (let f = 0; f < n; f++) fronds.push({ a: -Math.PI / 2 + (n > 1 ? (f / (n - 1) - .5) : 0) * 2.3 + (rnd() - .5) * .3, L: len * (.6 + .4 * rnd()), k: .07 + rnd() * .05 });
  const tips = [];
  const frames = [-1.5, -.5, .5, 1.5].map(sw => {
    const c = mk(len * 2 + 6, len + 3), x = c.getContext('2d'), ox = len + 3, oy = len + 2, tp = [];
    for (const fr of fronds) {
      let a = fr.a + sw * .1, px0 = ox, py0 = oy; const side = fr.a < -Math.PI / 2 ? -1 : 1;
      for (let i = 0; i < fr.L; i++) {
        px0 += Math.cos(a); py0 += Math.sin(a); a += fr.k * side + sw * .012;
        const X = Math.round(px0), Y = Math.round(py0), u = i / fr.L;
        x.fillStyle = u > .85 ? FERN.lite : FERN.stem; x.fillRect(X, Y, 1, 1);
        if (i % 2 === 1 && u < .85) { x.fillStyle = u > .5 ? FERN.lite : FERN.leaf; x.fillRect(X + Math.round(Math.sin(a)), Y - Math.round(Math.cos(a)), 1, 1); x.fillRect(X - Math.round(Math.sin(a)), Y + Math.round(Math.cos(a)), 1, 1); }
      }
      tp.push([Math.round(px0) - ox, Math.round(py0) - oy]);
    }
    tips.push(tp);
    return c;
  });
  return { frames, tips, ox: len + 3, oy: len + 2 };
}
const ferns = [];
[[6, 12, 4], [16, 9, 3], [48, 14, 5], [58, 10, 4], [96, 11, 4], [140, 13, 5], [206, 12, 4], [232, 9, 3], [284, 14, 5], [300, 10, 4], [314, 12, 4], [118, 7, 3]].forEach(([x, len, n], i) => {
  const base = x < 34 ? PORCH - 1 : FL[x] - 1;
  ferns.push({ x, base, ph: sr(0, TAU), glow: srnd() < .7, ...fernFrames(len, n, 300 + i) });
});
function drawFerns(t) {
  for (const f of ferns) {
    const s = Math.sin(t * .9 + f.ph + f.x * .05), k = clamp(Math.floor((s + 1) * 2), 0, 3);
    p.drawImage(f.frames[k], f.x - f.ox, f.base - f.oy + 1);
    if (!f.glow) continue;
    const tp = f.tips[k];
    for (let i = 0; i < tp.length; i += 2) {
      const [dx, dy] = tp[i], pu = .5 + .5 * Math.sin(t * 1.3 + i + f.ph);
      dot(f.x + dx, f.base + dy + 1, pu > .6 ? FERN.tip : '#6fe8a8');
      light(f.x + dx + .5, f.base + dy + 1.5, 3 + pu * 2, '#5fffb0', .16 + .16 * pu);
    }
  }
}
// bluebells
const bells = [88, 102, 109, 128, 276, 293, 222].map(x => ({ x, base: FL[x] - 1, h: Math.round(sr(6, 10)), ph: sr(0, TAU), n: srnd() < .5 ? 2 : 3 }));
function drawBells(t) {
  for (const b of bells) {
    const sw = Math.sin(t * .8 + b.ph) * .8; let tx = b.x, ty = b.base;
    for (let i = 0; i < b.h; i++) { tx = b.x + Math.round(sw * (i / b.h) ** 2); ty = b.base - i; dot(tx, ty, '#1f5a36'); }
    dot(tx + 1, ty, '#1f5a36');
    for (let k = 0; k < b.n; k++) {
      const bx = tx + 1 + (k === 2 ? -2 : k), by = ty + 1 + k * 2, pu = .5 + .5 * Math.sin(t * 1.1 + k + b.ph);
      dot(bx, by, pu > .7 ? '#c8d8ff' : '#6f8fff'); light(bx + .5, by + .5, 4 + pu * 2, '#4f7fff', .22 + .18 * pu);
    }
  }
}
// foxfire: glowing fungus on the log, the oak's roots and the foot of the cliff
const FOX = [];
for (let i = 0; i < 16; i++) { const x = Math.round(sr(LOG.x0 + 4, LOG.x1 - 4)); FOX.push({ x, y: Math.round(sr(logTop(x) + 3, FL[x] - 2)), ph: sr(0, TAU) }); }
for (let i = 0; i < 9; i++) { const y = Math.round(sr(186, 199)), x = Math.round(trunkC(y) + (srnd() < .5 ? -1 : 1) * (trunkW(y) - 1)); FOX.push({ x, y, ph: sr(0, TAU) }); }
for (let i = 0; i < 6; i++) { const y = Math.round(sr(170, 198)); FOX.push({ x: Math.floor(faceX(y)), y, ph: sr(0, TAU) }); }
function drawFox(t) {
  for (const f of FOX) { const pu = .5 + .5 * Math.sin(t * .7 + f.ph); p.globalAlpha = .5 + .5 * pu; dot(f.x, f.y, pu > .6 ? '#c8ffe0' : '#6fe8a8'); p.globalAlpha = 1; light(f.x + .5, f.y + .5, 3 + pu * 2, '#4fff9a', .12 + .14 * pu); }
  light(174, 188, 26, '#3fe88a', .05); light(258, 192, 22, '#3fe88a', .05);
}
// little orange caps on the log
const caps = [[160, 0], [165, 1], [186, 0]].map(([x, big]) => ({ x, y: logTop(x) - 1, big, ph: sr(0, TAU) }));
function drawCaps(t) {
  for (const c of caps) {
    const pu = .5 + .5 * Math.sin(t * .9 + c.ph);
    dot(c.x, c.y, '#a89880'); if (c.big) dot(c.x, c.y - 1, '#a89880');
    const top = c.y - 1 - c.big; rect(c.x - 1, top, 3, 1, mix('#b8602a', '#ffb060', pu)); dot(c.x, top - 1, '#ffd8a0');
    light(c.x + .5, top, 6 + pu * 2, '#ff9a3a', .22 + .14 * pu);
  }
}
// vines from the canopy
const vines = [[70, 42], [128, 30], [300, 52], [182, 22]].map(([x, len]) => ({ x, top: CAN[x] - 1, len, ph: sr(0, TAU), drops: [len - 1, Math.round(len * .6)] }));
function drawVines(t) {
  for (const v of vines) {
    const sw = Math.sin(t * .6 + v.ph) * 1.4, at = k => v.x + Math.round(sw * (k / v.len) ** 2);
    for (let k = 0; k < v.len; k++) { dot(at(k), v.top + k, '#1b4a30'); if (k % 3 === 2) dot(at(k) + (k % 6 === 2 ? -1 : 1), v.top + k, '#2f7a45'); }
    for (const k of v.drops) { const pu = .5 + .5 * Math.sin(t * 1.6 + k + v.ph); dot(at(k), v.top + k + 1, pu > .5 ? '#d8fff0' : '#8fe8c8'); light(at(k) + .5, v.top + k + 1.5, 3 + pu * 2, '#8fffd8', .2 + .2 * pu); }
  }
}
// leaves drifting down
let leafT = 0;
function updLeaves(dt) {
  leafT -= dt; if (leafT > 0) return; leafT = rr(.8, 2.4);
  const x = rr(40, 310); spawn({ x, y: CAN[x | 0] + 1, vx: rr(-3, 3), vy: rr(5, 9), wob: 8, life: 20, col: pick(['#2f7a45', '#4fae62', '#8a9a40']), kind: 3, fin: .5, fout: 1 });
}

/* ---------- moonbeams + motes ---------- */
const BEAMS = [[108, 20, 142, 204, 2, 13, .05], [292, 24, 276, 204, 2, 10, .04]];
const motes = Array.from({ length: 30 }, () => ({ b: R() < .5 ? 0 : 1, u: R(), v: rr(-1, 1), du: rr(.006, .014), ph: rr(0, TAU) }));
function beamOf(m) { return m.b === 2 ? [GX, 2, GX - 18, 204, 7, 24] : BEAMS[m.b]; }
function updMotes(dt, t) { for (const m of motes) { m.u += m.du * dt; m.v = clamp(m.v + Math.sin(t * .4 + m.ph) * .05 * dt, -1, 1); if (m.u > 1) { m.u = 0; m.v = rr(-1, 1); m.b = opened && R() < .5 ? 2 : R() < .5 ? 0 : 1; } } }
function drawMotes(t) {
  p.fillStyle = '#c8e8ff';
  for (const m of motes) {
    const [x0, y0, x1, y1, w0, w1] = beamOf(m), dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const hw = lerp(w0, w1, m.u), x = x0 + dx * m.u + nx * m.v * hw, y = y0 + dy * m.u + ny * m.v * hw;
    if (T.at(x, y)) continue;
    p.globalAlpha = (1 - Math.abs(m.v)) * (1 - m.u * .6) * (.25 + .5 * (.5 + .5 * Math.sin(t * 1.5 + m.ph * 3))); p.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  p.globalAlpha = 1;
}

/* ---------- fireflies ---------- */
const flyOk = (x, y) => x > 44 && x < 314 && y > CAN[clamp(x | 0, 0, W - 1)] + 6 && y < FL[clamp(x | 0, 0, W - 1)] - 4 && !T.at(x, y);
function pickFly(f) { do { f.tx = rr(46, 312); f.ty = rr(40, 196); } while (!flyOk(f.tx, f.ty)); f.tt = rr(2, 5); }
function newFly() { const f = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, tt: 0, ph: rr(0, TAU), rate: rr(1.2, 2.4), a: 0, home: null }; do { f.x = rr(46, 312); f.y = rr(40, 196); } while (!flyOk(f.x, f.y)); pickFly(f); return f; }
const flies = Array.from({ length: 14 }, newFly);
function updFlies(dt, t) {
  for (const f of flies) {
    f.a = Math.min(1, f.a + dt * .6);
    let tx, ty, acc = 16, max = 13;
    if (f.home) { tx = f.home.x + Math.cos(t * 1.1 + f.ph) * 2; ty = f.home.y + Math.sin(t * 1.4 + f.ph) * 2; acc = 40; max = 22; }
    else { f.tt -= dt; tx = f.tx; ty = f.ty; if (f.tt <= 0 || Math.hypot(tx - f.x, ty - f.y) < 4) pickFly(f); }
    const dx = tx - f.x, dy = ty - f.y, dl = Math.hypot(dx, dy) || 1;
    f.vx += (dx / dl * acc + Math.sin(t * 1.7 + f.ph) * 9) * dt; f.vy += (dy / dl * acc + Math.cos(t * 1.3 + f.ph * 2) * 9) * dt;
    if (f.home && dl < 6) { const k = Math.exp(-3 * dt); f.vx *= k; f.vy *= k; }
    const s = Math.hypot(f.vx, f.vy); if (s > max) { f.vx *= max / s; f.vy *= max / s; }
    const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
    if (!f.home && !flyOk(nx, ny)) { f.vx *= -.6; f.vy *= -.6; pickFly(f); } else { f.x = nx; f.y = ny; }
  }
}
function drawFlies(t, sync) {
  for (const f of flies) {
    let b = Math.pow(Math.max(0, Math.sin(t * f.rate + f.ph)), 3);
    if (sync >= 0) b = sync;
    p.globalAlpha = f.a; dot(f.x, f.y, b > .3 ? '#f0ffa0' : '#7a9a40'); p.globalAlpha = 1;
    light(f.x + .5, f.y + .5, 4 + 6 * b, '#c8ff58', (.12 + .6 * b) * f.a);
  }
}

/* ---------- the gap in the canopy ---------- */
let glintT = 0, burst = 0;
function updWay(dt) {
  burst = Math.max(0, burst - dt * .5);
  glintT -= dt * (1 + E.hot * 3); if (glintT > 0) return; glintT = rr(.4, 1.1);
  spawn({ x: GX + rr(-1, 1) * (opened ? 8 : 1), y: CAN[GX] + rr(-2, 1), vx: rr(-2, 2), vy: rr(3, 8), wob: 3, life: rr(2, 4), col: '#e0f0ff', gc: '#9fc8ff', glow: 2.5, ga: .5, fin: .3, fout: 1.2 });
}
function drawWay(t) {
  const pul = .5 + .5 * Math.sin(t * 2), cy = CAN[GX];
  if (opened) { light(GX, 6, 22, '#9fc8ff', .25 + burst * .6); light(GX - 4, cy + 4, 12, '#c8e0ff', .12 + burst * .5); return; }
  light(GX + .5, cy - 2, 6 + pul * 3 + E.hot * 5, '#b8d8ff', .4 + .25 * pul + E.hot * .45);
  light(GX + .5, cy - 12, 10 + E.hot * 6, '#6f9fff', .14 + E.hot * .2);
  p.globalAlpha = .5 + .5 * pul; dot(GX, cy - 1, '#e8f4ff'); dot(GX + 1, cy - 1, '#b8d8ff'); p.globalAlpha = 1;
}
function openWay() {
  opened = true; paintBG(); burst = 1;
  for (let i = 0; i < 36; i++) spawn({ x: GX + rr(-10, 10), y: rr(4, CAN[GX]), vx: rr(-30, 30), vy: rr(-20, 20), ay: 14, drag: 1.2, wob: 7, life: rr(3, 6), col: pick(['#2f7a45', '#4fae62', '#1d4a2e', '#8a9a40']), kind: 3, fin: .05, fout: 1 });
  ring(GX, CAN[GX] - 6, 30, '#b8d8ff', 1.4);
}

/* ---------- OWL on the oak branch ---------- */
const owl = (() => {
  const X = 227, FY = 91, C = { B: '#4e3e34', b: '#382a22', F: '#9a8a74', f: '#6e5e4e', C: '#b8aa90', y: '#ffc84a', beak: '#d8b060', o: '#c8a040' };
  const o = { name: 'owl', caption: 'The owl turns its head right around', busy: false, tt: 0, look: 0, bl: 0, puff: 0, h1: false, h2: false };
  o.box = () => [X - 1, FY - 12, 11, 13];
  o.update = (dt, t) => {
    tick(o, 'bl', 2.5, 6, .15, dt); o.puff = Math.max(0, o.puff - dt * 2.5);
    if (!o.busy) { const s = Math.sin(t * .23); o.look = s > .85 ? 1 : s < -.9 ? -1 : 0; return; }
    o.tt += dt; const T0 = o.tt, seq = [0, -1, -2, 3, 3, 2, 1, 0];
    o.look = T0 < 2 ? seq[Math.min(7, Math.floor(T0 / .25))] : 0;
    if (T0 > 2.3 && !o.h1) { o.h1 = true; o.puff = 1; ring(X + 4.5, FY - 7, 20, '#c8d8ff', 1.3); }
    if (T0 > 2.95 && !o.h2) { o.h2 = true; o.puff = 1; ring(X + 4.5, FY - 7, 26, '#c8d8ff', 1.5); }
    if (T0 > 4) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.h1 = o.h2 = false; };
  o.draw = t => {
    const x = X, y = FY - 10, L = o.look;
    // body
    rect(x + 1, y + 5, 7, 5, C.B); rect(x, y + 6, 9, 3, C.B); rect(x, y + 6, 1, 3, C.b); rect(x + 8, y + 6, 1, 3, C.b);
    for (const [a, b] of [[2, 6], [4, 7], [6, 6], [3, 8], [5, 8], [4, 5]]) dot(x + a, y + b, C.C);
    if (o.puff > 0) rect(x + 3, y + 5, 3, 1, mix(C.C, '#f0e8d8', o.puff));
    rect(x + 3, y + 10, 3, 2, C.b); dot(x + 3, FY, C.o); dot(x + 5, FY, C.o);
    // head
    const s = L === 3 ? 0 : clamp(L, -1, 1);
    rect(x, y + 1, 9, 4, C.B); rect(x + 1, y, 7, 1, C.B); dot(x + 1 + s, y - 1, C.B); dot(x + 7 + s, y - 1, C.B);
    if (L === 3) { dot(x + 3, y + 2, C.b); dot(x + 5, y + 3, C.b); dot(x + 4, y + 1, C.b); return; }
    const eyes = L === -2 ? [1] : L === 2 ? [7] : L === -1 ? [1, 5] : L === 1 ? [3, 7] : [2, 6];
    for (const e of eyes) {
      rect(x + e - 1, y + 1, 3, 3, C.F);
      dot(x + e, y + 2, o.bl > 0 ? C.f : C.y);
      if (!o.bl) light(x + e + .5, y + 2.5, 3, '#ffb03a', .3 + (o.busy ? .2 : 0));
    }
    dot(x + (L === -2 ? 0 : L === 2 ? 8 : 4 + s), y + 3, C.beak);
  };
  return o;
})();

/* ---------- FAWN that leaps the log ---------- */
const fawn = (() => {
  const C = { b: '#8a5a3c', d: '#6a4430', l: '#b08a68', s: '#eadcc6', k: '#140c08', h: '#1a1210' };
  const SPOT = { L: 124, R: 222 };
  const o = { name: 'fawn', caption: 'The fawn leaps the fallen log', busy: false, tt: 0, x: SPOT.L, dir: 1, air: 0, head: 'down', ear: 0, tail: 0, legs: 0, tuck: false, from: 0, to: 0 };
  o.box = () => [Math.round(o.x) - 7, FL[Math.round(o.x)] - 17 + Math.round(o.air), 15, 17];
  o.update = (dt, t) => {
    tick(o, 'ear', 2, 5, .25, dt); tick(o, 'tail', 1.5, 4, .3, dt);
    if (!o.busy) { o.head = Math.sin(t * .35 + 1) > .7 ? 'up' : 'down'; o.legs = 0; return; }
    o.tt += dt; const T0 = o.tt, d = o.dir;
    const run0 = o.from, runEnd = o.from + d * 14, landAt = o.to - d * 12;
    if (T0 < .9) { o.head = 'up'; if (T0 > .5) o.ear = .1; }
    else if (T0 < 1.3) { const k = (T0 - .9) / .4; o.x = lerp(run0, runEnd, k); o.legs = Math.floor(T0 * 14) % 2 + 1; }
    else if (T0 < 2.05) {
      const k = (T0 - 1.3) / .75; o.x = lerp(runEnd, landAt, k); o.air = -hop(k) * 20; o.tuck = k > .15 && k < .85; o.legs = 0;
    } else if (T0 < 2.5) {
      if (o.air !== 0) { o.air = 0; o.tuck = false; E.rubble(o.x, FL[Math.round(o.x)] - 1, 5, ['#2f7a45', '#3a2a20'], 3); }
      const k = (T0 - 2.05) / .45; o.x = lerp(landAt, o.to, k); o.legs = Math.floor(T0 * 10) % 2 + 1;
    } else if (T0 < 3.1) { o.legs = 0; if (T0 > 2.8 && o.dir === d && ((d > 0 && o.to === SPOT.R) || (d < 0 && o.to === SPOT.L))) o.dir = -d; }
    else { o.head = 'down'; if (T0 > 3.6) o.busy = false; }
  };
  o.trigger = () => {
    const left = o.x < 180; o.dir = left ? 1 : -1; o.from = o.x; o.to = left ? SPOT.R : SPOT.L; o.busy = true; o.tt = 0;
  };
  o.draw = t => {
    const d = o.dir, X = Math.round(o.x), Y = FL[X] - 1 + Math.round(o.air);
    const P = (dx, dy, c) => { p.fillStyle = c; p.fillRect(d > 0 ? X + dx : X - dx, Y + dy, 1, 1); };
    const Hl = (a, b, dy, c) => { for (let i = a; i <= b; i++) P(i, dy, c); };
    // legs
    const legs = [[-4, 0], [-3, 1], [2, 0], [3, 1]];
    for (const [lx, pair] of legs) {
      if (o.tuck) { const back = lx < 0; P(lx + (back ? -1 : 1), -5, C.d); P(lx + (back ? -2 : 2), -4, C.d); P(lx + (back ? -2 : 2), -3, C.h); continue; }
      const sh = o.legs ? ((o.legs === 1) === !!pair ? 1 : -1) : 0, lift = o.legs && ((o.legs === 1) === !!pair) ? 1 : 0;
      for (let k = -5; k < -1 - lift; k++) P(lx + (k > -4 ? sh : 0), k, C.d);
      P(lx + sh, -1 - lift, C.h);
    }
    // body + spots + tail
    Hl(-4, 3, -9, C.d); Hl(-5, 4, -8, C.b); Hl(-5, 4, -7, C.b); Hl(-4, 3, -6, C.l);
    for (const [a, b] of [[-3, -8], [0, -8], [2, -7], [-1, -7], [-4, -7]]) P(a, b, C.s);
    P(-6, o.tail > 0 ? -9 : -8, C.s); if (o.tail > 0) P(-6, -8, C.l);
    // neck + head
    if (o.head === 'up') {
      P(3, -10, C.b); P(4, -10, C.b); P(4, -11, C.b); P(5, -11, C.b);
      Hl(4, 7, -13, C.b); Hl(5, 8, -12, C.b); Hl(4, 6, -14, C.b);
      P(6, -13, C.k); P(8, -12, C.h); P(5, -12, C.l);
      const e = o.ear > 0 ? 1 : 0; P(3 - e, -15, C.d); P(4, -15, C.b); P(6, -15, C.d); P(6 + e, -16, C.d);
    } else {
      P(4, -8, C.b); P(5, -7, C.b); P(5, -6, C.b); P(6, -5, C.b);
      Hl(6, 9, -4, C.b); Hl(7, 9, -3, C.b); P(10, -3, C.h); P(8, -4, C.k); P(6, -5, C.d); P(7, -6, C.d);
    }
    light(X, Y - 8, 12, '#b08a68', .05);
  };
  return o;
})();

/* ---------- HEDGEHOG that curls into a ball ---------- */
const hedge = (() => {
  const pal = { s: '#4a3c32', S: '#8a7a66', f: '#a88c70', k: '#0a0806', n: '#1a1210' };
  const body = spr(['...sSsS...', '.sSsSsSs..', 'sSsSsSsff.', 'SsSsSsffkf', '.sSsSffffn', '..f...f...'], pal);
  const sniff = spr(['...sSsS...', '.sSsSsSs..', 'sSsSsSsff.', 'SsSsSsffkf', '.sSsSfffff', '..f...f..n'], pal);
  const ball = [spr(['..SsS..', '.SsSsS.', 'SsSsSsS', 'sSsSsSs', 'SsSsSsS', '.sSsSs.'], pal), spr(['..sSs..', '.sSsSs.', 'sSsSsSs', 'SsSsSsS', 'sSsSsSs', '.SsSsS.'], pal)];
  const o = { name: 'hedgehog', caption: 'The hedgehog curls up and rolls', busy: false, tt: 0, x: 70, dir: 1, sn: 0, curl: false, roll: 0, from: 0, sneeze: false };
  o.box = () => [Math.round(o.x) - 1, FL[Math.round(o.x) + 5] - 7, 12, 7];
  o.update = (dt, t) => {
    tick(o, 'sn', .6, 1.8, .2, dt);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    o.curl = T0 > .5 && T0 < 2.7;
    if (T0 > .9 && T0 < 2.3) { const k = (T0 - .9) / 1.4; o.x = o.from + o.dir * 22 * smooth(k); o.roll = Math.floor(T0 * 10); if (R() < dt * 12) spawn({ x: o.x + 3, y: FL[Math.round(o.x) + 3] - 1, vx: -o.dir * rr(4, 12), vy: rr(-10, -3), ay: 40, life: rr(.4, .8), col: '#3a2a20', fin: .01, fout: .3 }); }
    if (T0 > 3.1 && !o.sneeze) { o.sneeze = true; spawn({ x: o.dir > 0 ? o.x + 11 : o.x - 1, y: FL[Math.round(o.x) + 5] - 3, vx: o.dir * 14, vy: -4, drag: 3, life: .6, col: '#e8f0ff', w: 1, fin: .01, fout: .4 }); }
    if (T0 > 3.6) { o.busy = false; o.dir = -o.dir; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.from = o.x; o.sneeze = false; if (o.x > 88) o.dir = -1; else if (o.x < 58) o.dir = 1; };
  o.draw = () => {
    const X = Math.round(o.x), base = FL[X + 5];
    if (o.curl) { const b = ball[o.roll % 2]; p.drawImage(b, X + 2, base - 6); if (o.tt < .9) dot(X + (o.dir > 0 ? 8 : 1), base - 2, '#a88c70'); }
    else E.blit(o.sn > 0 ? sniff : body, X, base - 6, o.dir < 0);
    light(X + 5, base - 3, 8, '#a8b8a0', .05);
  };
  return o;
})();

/* ---------- SQUIRREL on the oak ---------- */
const squirrel = (() => {
  const pal = { T: '#8a4a2a', t: '#b86a3a', R: '#a0582e', b: '#e0c0a0', k: '#0a0604', n: '#2a1610', e: '#7a3e22' };
  const A = spr(['TT........', 'TtT....e..', '.TtT..RRR.', '..TTRRRkRn', '..TRRRRRR.', '...RbbRR..', '...R..R...'], pal);
  const B = spr(['TT........', 'TtT....e..', '.TtT..RRR.', '..TTRRRkRn', '..TRRRRRR.', '...RbbRR..', '..R....R..'], pal);
  const Y0 = 162, xOn = y => Math.round(trunkC(y) - trunkW(y)) - 4;
  const o = { name: 'squirrel', caption: 'The squirrel dashes up the oak', busy: false, tt: 0, y: Y0, up: true, hid: false, fl: 0, acorns: [], dropped: 0 };
  o.box = () => o.hid ? null : [xOn(o.y) - 3, o.y - 5, 8, 11];
  o.update = (dt, t) => {
    tick(o, 'fl', 2, 5, .3, dt);
    for (let i = o.acorns.length - 1; i >= 0; i--) {
      const a = o.acorns[i]; a.t += dt; a.vy += 260 * dt; a.x += a.vx * dt; a.y += a.vy * dt;
      const gy = T.ground(a.x, 40) - 1;
      if (a.y >= gy && a.vy > 0) { a.y = gy; if (a.b++ < 2) { a.vy *= -.45; a.vx *= .6; if (a.b === 1) E.rubble(a.x, gy, 3, ['#3f9a58', '#2a201a'], 1); } else { a.vy = 0; a.vx = 0; } }
      if (a.t > 4) o.acorns.splice(i, 1);
    }
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt, top = 44;
    if (T0 < .3) {}
    else if (T0 < 2.2) { o.up = true; const k = (T0 - .3) / 1.9; o.y = Y0 - (Y0 - top) * (k < .45 ? k / .45 * .55 : k < .6 ? .55 : .55 + (k - .6) / .4 * .45); }
    else if (T0 < 3.6) { o.hid = true; if (T0 > 2.5 + o.dropped * .4 && o.dropped < 3) { o.dropped++; o.acorns.push({ x: rr(226, 250), y: CAN[238] + 2, vx: rr(-10, 6), vy: rr(0, 20), t: 0, b: 0 }); } }
    else if (T0 < 5.4) { o.hid = false; o.up = false; const k = (T0 - 3.6) / 1.8; o.y = lerp(top, Y0, smooth(k)); }
    else { o.up = true; if (T0 > 5.8) o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.dropped = 0; };
  o.draw = t => {
    for (const a of o.acorns) { rect(a.x, a.y - 1, 2, 2, '#8a5a30'); dot(a.x, a.y - 2, '#4a3020'); }
    if (o.hid) return;
    const moving = o.busy && o.tt > .3 && o.tt < 5.4 && !(o.tt > 1.14 && o.tt < 1.44);
    const s = moving && Math.floor(t * 12) % 2 ? B : A;
    E.spin(s, xOn(o.y) + 1, o.y, o.up ? -Math.PI / 2 : Math.PI / 2, !o.up);
    if (o.fl > 0 && !moving) dot(xOn(o.y) - 3, o.y + 4, '#b86a3a');
  };
  return o;
})();

/* ---------- FIREFLIES blinking together ---------- */
const swarm = (() => {
  const o = { name: 'fireflies', caption: 'The fireflies blink in time', busy: false, tt: 0, c: null };
  o.box = () => o.busy ? [o.c.x - 14, o.c.y - 12, 28, 24] : null;
  o.sync = () => {
    if (!o.busy) return -1; const T0 = o.tt;
    if (T0 < 1.8) return T0 > 1.1 ? .02 : -1;
    const u = (T0 - 1.8) / .75; if (u > 4.2) return -1;
    return Math.pow(Math.max(0, Math.sin(u * TAU - Math.PI / 2 + Math.PI / 2)), 5);
  };
  o.update = (dt) => {
    if (!o.busy) return;
    o.tt += dt;
    if (o.tt > 1.8 && o.tt < 5) { const u = (o.tt - 1.8) / .75, k = Math.floor(u); if (k !== o.k && u % 1 < .3) { o.k = k; if (k < 4) ring(o.c.x, o.c.y, 22, '#c8ff58', .8); } }
    if (o.tt > 5.2) { for (const f of flies) { f.home = null; pickFly(f); } o.busy = false; }
  };
  o.trigger = () => {
    o.c = { x: rr(90, 200), y: rr(90, 150) }; o.busy = true; o.tt = 0; o.k = -1;
    flies.forEach((f, i) => { const a = i / flies.length * TAU + rr(-.3, .3), r = rr(4, 13); f.home = { x: o.c.x + Math.cos(a) * r, y: o.c.y + Math.sin(a) * r * .7 }; });
  };
  o.draw = () => {};
  return o;
})();

/* ---------- render ---------- */
const critters = [owl, fawn, hedge, squirrel, swarm];
function ambient(dt, t) { updFlies(dt, t); updMotes(dt, t); updLeaves(dt); updWay(dt); }
return {
  critters,
  entry: { x: 0, y: 111 },
  exit: { x: GX, y: 16, r: 14 },
  ambient,
  update(dt, t) { ambient(dt, t); for (const c of critters) c.update(dt, t); },
  draw(t) {
    p.globalAlpha = 1; p.drawImage(bg, 0, 0);
    drawWay(t); drawVines(t); drawFox(t); drawCaps(t); drawBells(t);
    owl.draw(t); squirrel.draw(t); hedge.draw(t); fawn.draw(t);
    drawFerns(t);
    drawFlies(t, swarm.sync()); E.drawParts(); drawMotes(t);
    light(20, 111, 10, '#7fe6d6', .08);
  },
  under(g, t) {
    for (const [x0, y0, x1, y1, w0, w1, a] of BEAMS) E.beam(g, x0, y0, x1, y1, w0, w1, '#9ab8ff', a + .012 * Math.sin(t * .4 + x0));
    if (opened) E.beam(g, GX, 0, GX - 18, 204, 7, 24, '#b0c8ff', .07 + burst * .2 + .015 * Math.sin(t * .35));
    else E.beam(g, GX + .5, CAN[GX], GX - 6, 150, 1, 6, '#b0c8ff', .04 + .02 * Math.sin(t * 2) + E.hot * .08);
  },
  openExit: openWay
};
};
