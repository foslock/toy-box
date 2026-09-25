/* Glowmoss Hollow · the cave in the middle. A crack in the east wall opens into Fernlight Wood. */
'use strict';
SCENES.hollow = E => {
const { p, light, wlight, spawn, splash, sparkle, ring, sr, srnd, blit, line } = E;
const snap = mk(W, H), sp = snap.getContext('2d'); sp.imageSmoothingEnabled = false;

/* ---------- the cave ---------- */
const SURF = 211, POOL_L = 120, POOL_R = 236;
const STAL = [[38,6,20],[92,4,11],[146,5,18],[166,6,27],[204,4,16],[228,7,21],[282,5,13],[306,6,17]];
const CRACK = [61, 67];
const ceilY = x => { let y = 11 + 9 * fbm(x * .035, 1.3); for (const [s, w, h] of STAL) { const d = Math.abs(x - s); if (d < w) y += h * Math.pow(1 - d / w, 1.7); } return y; };
const floorY = x => {
  let y = 204 + 4 * fbm(x * .05, 9.1);
  const c = (POOL_L + POOL_R) / 2, hw = (POOL_R - POOL_L) / 2, d = Math.abs(x - c) / hw;
  if (d < 1.15) { const bed = SURF + 1 + 34 * Math.sqrt(Math.max(0, 1 - d * d)); y = lerp(y, Math.max(y, bed), smooth(clamp((1.15 - d) / .15, 0, 1))); }
  return y;
};
const LW = new Float32Array(H), RW = new Float32Array(H);
for (let y = 0; y < H; y++) { LW[y] = 7 + 11 * fbm(1.7, y * .045) + 6 * smooth(clamp((y - 140) / 60, 0, 1)); RW[y] = W - (7 + 11 * fbm(5.1, y * .045)); }
function ledgeL(x, y) {
  if (x > 113) return false;
  let top = 150 + Math.round(1.4 * fbm(x * .09, 3.3)); const e = x - 104; if (e > 0) top += e * e / 9;
  const bot = 150 + lerp(30, 5, x / 112) + 5 * fbm(x * .08, 4.4); return y >= top && y < bot;
}
function ledgeR(x, y) {
  if (x < 236) return false;
  let top = 118 + Math.round(1.2 * fbm(x * .09, 7.7)); const e = 246 - x; if (e > 0) top += e * e / 9;
  const bot = 118 + lerp(6, 34, (x - 238) / 82) + 5 * fbm(x * .08, 8.8); return y >= top && y < bot;
}
// the way east: a hairline crack through the right wall until it's opened, then a tunnel along the ledge
let opened = false;
const TX = 294;
function tunnel(x, y) {
  if (x < TX) return false;
  if (opened) return y >= 104 + Math.round(2.4 * fbm(x * .21, 2.2)) && y <= 117;
  return y >= 112 + Math.round(1.4 * fbm(x * .5, 6.1)) && y <= 117;
}
const solid = new Uint8Array(W * H), wet = new Uint8Array(W * H), sky = new Uint8Array(W * H), way = new Uint8Array(W * H);
function carve() {
  for (let x = 0; x < W; x++) {
    const cy = ceilY(x), fy = floorY(x), crack = x >= CRACK[0] && x <= CRACK[1];
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      let s = y >= fy || x < LW[y] || x >= RW[y] || ledgeL(x, y) || ledgeR(x, y);
      if (y < cy) { if (crack && !s) sky[i] = 1; else s = true; }
      way[i] = 0;
      if (s && tunnel(x, y)) { s = false; way[i] = 1; }
      solid[i] = s ? 1 : 0;
      if (!s && !sky[i] && y >= SURF) wet[i] = 1;
    }
  }
}
carve();
const isSolid = (x, y) => { x = Math.round(x); y = Math.round(y); return x < 0 || x >= W || y < 0 || y >= H || solid[y * W + x] === 1; };
const isWet = (x, y) => { x = Math.round(x); y = Math.round(y); return x >= 0 && x < W && y >= 0 && y < H && wet[y * W + x] === 1; };
const groundBelow = (x, y0) => { x = Math.round(x); for (let y = Math.max(0, y0 | 0); y < H; y++) if (solid[y * W + x]) return y; return H; };
const ceilAt = x => { x = Math.round(x); for (let y = 0; y < H; y++) if (!solid[y * W + x]) return y; return 0; };
const under = (x, y0) => { let y = y0; while (y < H && !isSolid(x, y)) y++; while (y < H && isSolid(x, y)) y++; return y; };
E.isSolid = isSolid; E.isWet = isWet;

const waterPath = new Path2D();
for (let y = SURF; y < H; y++) {
  let x = 0;
  while (x < W) {
    if (wet[y * W + x]) { const x0 = x; while (x < W && wet[y * W + x]) x++; waterPath.rect(x0, y, x - x0, 1); }
    else x++;
  }
}

/* ---------- painted background (static) ---------- */
const bg = mk(W, H), bx = bg.getContext('2d');
const FAR = ['#06050d','#0a0a1a','#0f1026','#141632','#1a1d3e','#21274e'];
const open = i => !solid[i] && !wet[i];
function rockCol(x, y, i) {
  const up = y > 0 && open(i - W), up2 = y > 1 && open(i - 2 * W), dn = y < H - 1 && open(i + W);
  const lf = x > 0 && open(i - 1), rt = x < W - 1 && open(i + 1);
  const n = hash(x, y), moss = y > 40 && fbm(x * .07, 20 + y * .05) > .52;
  if (up) return moss ? (n > .74 ? '#3fcf9a' : n > .3 ? '#1f7a62' : '#18604e') : (n > .8 ? '#3a3370' : '#2a2552');
  if (up2) return moss ? '#0f3c34' : '#19163a';
  if (dn) return n > .5 ? '#15122c' : '#110f24';
  if (lf || rt) return '#100e20';
  const m = fbm(x * .09, y * .09);
  if (m > .58) return n > .88 ? '#13112a' : '#0c0b18';
  return n > .95 ? '#0f0d1e' : '#070610';
}
const WAY = ['#08081a', '#0d1026', '#141c3a', '#1d2b52', '#2a3e6e', '#3a5488'];
const form = (x, y) => fbm(x * .03, y * .011 + 40) + .22 * Math.exp(-(((y - 205) / 45) ** 2)) - .12 * Math.exp(-(((y - 20) / 30) ** 2));
// violet crystals tucked under the right ledge
const CRYST = [];
for (let k = 0; k < 7; k++) {
  const x = Math.round(sr(272, 296)), y = groundBelow(x, 150), h = Math.round(sr(5, 14)), lean = sr(-.35, .35), hw = srnd() < .5 ? 1 : 2;
  CRYST.push({ x, y, h, lean, hw });
}
CRYST.sort((a, b) => b.h - a.h);
function paintBG() {
  paint((x, y) => {
    const i = y * W + x;
    if (solid[i]) return rockCol(x, y, i);
    if (sky[i]) return y < 6 ? '#3a5488' : y < 11 ? '#2a3e6e' : '#1d2b52';
    if (wet[i]) return '#05121f';
    if (way[i]) return band(WAY, clamp((x - TX) / (W - TX), 0, 1) * (opened ? .75 : 1) + .08, x, y);
    let v = .12 + .6 * fbm(x * .012 + 3, y * .02) + .2 * Math.exp(-(((y - 160) / 70) ** 2)) - .2 * Math.max(0, (70 - y) / 70);
    if (form(x, y) > .6) { v -= .16; if (form(x, y - 2) <= .6) v += .28; }
    let c = FAR[clamp(Math.floor(v * FAR.length + bay(x, y) - .5), 0, FAR.length - 1)];
    const hs = hash(x * 1.31, y * .77); if (y < 170 && hs > .9982) c = hs > .9994 ? '#5a9ac0' : '#2c5a7e';
    return c;
  }, bg);
  for (const c of CRYST) {
    for (let i = 0; i < c.h; i++) {
      const cx = c.x + Math.round(c.lean * i), w = Math.round(c.hw * (1 - i / c.h) + .3);
      for (let dx = -w; dx <= w; dx++) { bx.fillStyle = i >= c.h - 2 ? '#efe4ff' : dx < 0 ? '#5a3aa0' : dx === 0 ? '#9a78ff' : '#c6adff'; bx.fillRect(cx + dx, c.y - 1 - i, 1, 1); }
    }
    c.tx = c.x + Math.round(c.lean * (c.h - 1)); c.ty = c.y - c.h;
  }
}
paintBG();

/* ---------- water ---------- */
const ripples = [];
const ripple = (x, s = 1) => ripples.push({ x, r: 0, t: 0, life: 1.6 * s, s });
function updRipples(dt) { for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; r.r += dt * 14 * r.s; if (r.t > r.life) ripples.splice(i, 1); } }
function drawRipples() {
  p.fillStyle = '#7fd0f0';
  for (const r of ripples) {
    p.globalAlpha = (1 - r.t / r.life) * .8;
    const steps = Math.max(6, Math.round(r.r * 2.4));
    for (let k = 0; k <= steps; k++) { const an = Math.PI * k / steps, xx = Math.round(r.x + Math.cos(an) * r.r), yy = Math.round(SURF + Math.sin(an) * r.r * .28); if (isWet(xx, yy)) p.fillRect(xx, yy, 1, 1); }
  }
  p.globalAlpha = 1;
}
E.drip = q => {
  if (isWet(q.x, q.y)) { splash(q.x, SURF - 1, 4); ripple(q.x, .9); return true; }
  if (isSolid(q.x, q.y)) { splash(q.x, groundBelow(q.x, q.y - 8) - 1, 3); return true; }
  return false;
};

/* ---------- flora ---------- */
// glow-worm silk threads from the ceiling
const threads = [];
for (let i = 0; i < 26 && threads.length < 17; i++) {
  const x = Math.round(sr(22, 298));
  if ((x > 55 && x < 73) || (x > 109 && x < 127) || (x > 252 && x < 274)) continue;
  const top = ceilAt(x), fl = groundBelow(x, top);
  const len = Math.min(Math.round(sr(8, 46)), fl - top - 24); if (len < 5) continue;
  const beads = []; for (let k = 2; k < len; k += Math.round(sr(3, 6))) beads.push(k);
  threads.push({ x, top, len, beads, ph: sr(0, TAU), sp: sr(.5, .9) });
}
function drawThreads(t) {
  for (const th of threads) {
    const sw = Math.sin(t * th.sp + th.ph) * (.6 + th.len / 30), at = k => th.x + Math.round(sw * (k / th.len) ** 2);
    p.fillStyle = '#1a2c48'; for (let k = 0; k <= th.len; k++) p.fillRect(at(k), th.top + k, 1, 1);
    for (const k of th.beads) { const tw = .5 + .5 * Math.sin(t * 2.1 + k * 1.7 + th.ph); p.fillStyle = tw > .75 ? '#bff2ff' : tw > .35 ? '#5fc8f0' : '#2f78a8'; p.fillRect(at(k), th.top + k, 1, 1); }
    const tx = at(th.len), ty = th.top + th.len + 1, tw = .6 + .4 * Math.sin(t * 1.3 + th.ph);
    p.fillStyle = '#d8f8ff'; p.fillRect(tx, ty, 1, 1);
    light(tx + .5, ty + .5, 6, '#4fb8ff', .3 * tw); light(at(th.len >> 1) + .5, th.top + th.len / 2, 9, '#2f6fd0', .07);
  }
}
// mushrooms
const SHROOM = {
  teal:   { cap: ['#1a7a78', '#2fd0c0', '#b0fff4'], gill: '#0d3e44', stem: '#6f8fa0', glow: '#3fe8d8' },
  blue:   { cap: ['#1f4fa0', '#3f8fff', '#c8e4ff'], gill: '#10244f', stem: '#7080a8', glow: '#4a90ff' },
  violet: { cap: ['#4a2f96', '#8f6aff', '#e8dcff'], gill: '#24174f', stem: '#8078a8', glow: '#9a70ff' } };
const shrooms = [];
function cluster(cx, fromY, n, pal, spread) {
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx + sr(-spread, spread)), base = groundBelow(x, fromY) - 1; if (base >= H - 1) continue;
    const big = srnd() < .3;
    shrooms.push({ x, base, h: Math.round(big ? sr(5, 8) : sr(2, 5)), w: big ? (srnd() < .5 ? 7 : 5) : (srnd() < .5 ? 3 : 5), pal: SHROOM[pal], ph: sr(0, TAU), sp: sr(.6, 1.2), spore: sr(0, 5) });
  }
}
cluster(96, 130, 5, 'teal', 8); cluster(40, 185, 7, 'blue', 18); cluster(112, 185, 3, 'teal', 4); cluster(254, 180, 4, 'violet', 8); cluster(300, 90, 2, 'teal', 3);
shrooms.sort((a, b) => b.w - a.w);
function drawShroom(s, t) {
  const pul = .5 + .5 * Math.sin(t * s.sp + s.ph), P = s.pal, top = s.base - s.h, hw = (s.w - 1) / 2;
  p.fillStyle = P.stem; p.fillRect(s.x, top + 1, 1, s.h);
  p.fillStyle = P.gill; p.fillRect(s.x - hw, top, s.w, 1);
  p.fillStyle = mix(P.cap[0], P.cap[1], .35 + .65 * pul);
  p.fillRect(s.x - hw, top - 1, s.w, 1); p.fillRect(s.x - hw + 1, top - 2, s.w - 2, 1); if (s.w >= 7) p.fillRect(s.x - hw + 2, top - 3, s.w - 4, 1);
  p.fillStyle = P.cap[2]; p.fillRect(s.x - hw + 1, top - 2, 1, 1); if (s.w >= 5) p.fillRect(s.x + 1, top - 1, 1, 1);
  light(s.x + .5, top - 1, s.w * 1.6 + 4 + pul * 3, P.glow, .2 + .2 * pul);
  if (s.w >= 5) light(s.x + .5, top, 26, P.glow, .05);
}
function updShrooms(dt) {
  for (const s of shrooms) {
    s.spore -= dt;
    if (s.spore <= 0) { s.spore = rr(2.5, 7); spawn({ x: s.x + rr(-1, 1), y: s.base - s.h - 3, vx: rr(-2, 2), vy: rr(-7, -3), wob: 4, life: rr(4, 8), col: s.pal.cap[2], gc: s.pal.glow, glow: 3, ga: .45, fin: 1, fout: 2 }); }
  }
}
// glowing grass tufts
const tufts = [];
function tuft(cx, fromY, n, spread) {
  for (let i = 0; i < n; i++) { const x = Math.round(cx + sr(-spread, spread)), base = groundBelow(x, fromY) - 1; if (base < H - 2) tufts.push({ x, base, h: Math.round(sr(2, 6)), ph: sr(0, TAU), hue: srnd() < .7 ? 0 : 1 }); }
}
tuft(60, 120, 16, 42); tuft(275, 90, 10, 26); tuft(60, 185, 14, 42); tuft(268, 180, 9, 22); tuft(112, 185, 5, 6); tuft(244, 185, 5, 5);
function drawTufts(t) {
  for (const b of tufts) {
    for (let i = 0; i < b.h; i++) {
      const off = Math.round(Math.sin(t * 1.2 + b.ph + b.x * .2) * .9 * (i / b.h) ** 2);
      p.fillStyle = i === b.h - 1 ? (b.hue ? '#a8ffe0' : '#4fe8a8') : i > b.h * .5 ? '#1b7a5c' : '#12503f';
      p.fillRect(b.x + off, b.base - i, 1, 1);
    }
  }
}
// bulb flowers
const flowers = [];
const flower = (x, fromY, h, lean, col, core, gc) => flowers.push({ x, base: groundBelow(x, fromY) - 1, h, lean, col, core, gc, ph: sr(0, TAU) });
flower(250, 90, 12, -3, '#ff5fc8', '#ffd6f4', '#ff4fb8'); flower(257, 90, 8, 2, '#ff5fc8', '#ffd6f4', '#ff4fb8'); flower(294, 90, 10, -2, '#ff7ad8', '#ffe0f8', '#ff5fc8');
flower(262, 180, 14, 3, '#ff7ad8', '#ffe0f8', '#ff5fc8'); flower(24, 185, 9, 2, '#ffae4f', '#fff0c8', '#ff9a3a'); flower(30, 185, 6, -1, '#ffae4f', '#fff0c8', '#ff9a3a');
function drawFlowers(t) {
  for (const f of flowers) {
    const sw = Math.sin(t * .8 + f.ph) * .9; let lx = f.x, ly = f.base;
    for (let i = 0; i < f.h; i++) {
      const k = i / f.h, x = f.x + Math.round(f.lean * k * k + sw * k);
      p.fillStyle = '#1f5a45'; p.fillRect(x, f.base - i, 1, 1); lx = x; ly = f.base - i;
      if (i === Math.floor(f.h * .45)) { p.fillStyle = '#2f8a60'; p.fillRect(x - 1, ly, 1, 1); p.fillRect(x + 1, ly + 1, 1, 1); }
    }
    const d = Math.sign(f.lean) || 1, bx2 = lx + d, by = ly + 1, pul = .5 + .5 * Math.sin(t * 1.4 + f.ph);
    p.fillStyle = f.col; p.fillRect(bx2 - 1, by, 3, 1); p.fillRect(bx2, by - 1, 1, 3);
    p.fillStyle = mix(f.col, f.core, pul); p.fillRect(bx2, by, 1, 1);
    p.globalAlpha = .4 + .5 * pul; p.fillStyle = f.core; p.fillRect(bx2, by + 3, 1, 1); p.globalAlpha = 1;
    light(bx2 + .5, by + .5, 10 + pul * 4, f.gc, .33 + .2 * pul);
  }
}
// amber-berry vines under the left ledge
const vines = [98, 103, 109].map(x => {
  const top = under(x, 140), len = Math.round(sr(12, 28)), berries = [];
  for (let k = 5; k < len; k += Math.round(sr(5, 9))) berries.push(k);
  return { x, top, len, berries, ph: sr(0, TAU) };
});
function drawVines(t) {
  for (const v of vines) {
    const sw = Math.sin(t * .8 + v.ph) * 1.3, at = k => v.x + Math.round(sw * (k / v.len) ** 2);
    for (let k = 0; k < v.len; k++) {
      p.fillStyle = '#1b4a34'; p.fillRect(at(k), v.top + k, 1, 1);
      if (k % 3 === 1) { p.fillStyle = '#2a6e48'; p.fillRect(at(k) + (k % 6 === 1 ? -1 : 1), v.top + k, 1, 1); }
    }
    for (const k of v.berries) {
      const x = at(k) + (k % 2 ? 1 : -1), y = v.top + k, pu = .5 + .5 * Math.sin(t * 1.2 + k + v.ph);
      p.fillStyle = mix('#c06a20', '#ffc070', pu); p.fillRect(x, y, 1, 1); light(x + .5, y + .5, 4 + pu * 2, '#ff9a3a', .3 + .2 * pu);
    }
  }
}
// crystals: light + sparkles
let crystT = 0;
function updCrystals(dt) {
  crystT -= dt;
  if (crystT <= 0) { crystT = rr(.3, 1.1); const c = CRYST[R() * CRYST.length | 0]; spawn({ x: c.x + Math.round(c.lean * c.h * .5) + rr(-1, 1), y: c.y - rr(1, c.h), life: rr(.4, .8), col: '#ffffff', gc: '#c8a8ff', glow: 4, ga: .7, fin: .1, fout: .3 }); }
}
function drawCrystLights(t) { for (const c of CRYST) light(c.tx + .5, c.y - c.h * .5, 9 + c.h * .5, '#9a70ff', .14 + .06 * Math.sin(t * .7 + c.x)); }

/* ---------- drips ---------- */
const drips = [146, 166, 204, 38, 228].map(x => ({ x, y: ceilAt(x), t: rr(0, 3), dur: rr(2, 6) }));
function updDrips(dt) {
  for (const d of drips) {
    d.t += dt;
    if (d.t > d.dur) { d.t = 0; d.dur = rr(2.5, 7); spawn({ x: d.x, y: d.y + 1, vy: 10, ay: 300, life: 3, col: '#bfefff', glow: 2.5, gc: '#7fd8ff', ga: .5, kind: 1, fin: .01, fout: .01 }); }
  }
}
function drawDrips() {
  for (const d of drips) {
    const k = d.t / d.dur; if (k <= .55) continue;
    const a = (k - .55) / .45; p.globalAlpha = a; p.fillStyle = '#9fe0ff'; p.fillRect(d.x, d.y, 1, 1); if (k > .85) p.fillRect(d.x, d.y + 1, 1, 1); p.globalAlpha = 1;
    light(d.x + .5, d.y + .5, 3, '#7fd8ff', .4 * a);
  }
}

/* ---------- fireflies ---------- */
function pickFly(f) { do { f.tx = rr(30, 295); f.ty = rr(35, 190); } while (isSolid(f.tx, f.ty)); f.tt = rr(2, 5); }
function newFly() {
  const f = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, tt: 0, ph: rr(0, TAU), rate: rr(1.2, 2.4), state: 'fly', a: 0, lure: null };
  do { f.x = rr(30, 295); f.y = rr(35, 190); } while (isSolid(f.x, f.y));
  pickFly(f); return f;
}
const flies = Array.from({ length: 7 }, newFly);
function updFlies(dt, t) {
  for (const f of flies) {
    if (f.state === 'gone') { f.tt -= dt; if (f.tt <= 0) Object.assign(f, newFly()); continue; }
    if (f.state === 'caught') continue;
    f.a = Math.min(1, f.a + dt * .6);
    let tx, ty, acc = 16, max = 13;
    if (f.lure) { tx = f.lure.x + Math.cos(t * 2.3) * 2; ty = f.lure.y + Math.sin(t * 3.1) * 2; acc = 70; max = 34; }
    else { f.tt -= dt; tx = f.tx; ty = f.ty; if (f.tt <= 0 || Math.hypot(tx - f.x, ty - f.y) < 4) pickFly(f); }
    const dx = tx - f.x, dy = ty - f.y, dl = Math.hypot(dx, dy) || 1;
    f.vx += (dx / dl * acc + Math.sin(t * 1.7 + f.ph) * 9) * dt;
    f.vy += (dy / dl * acc + Math.cos(t * 1.3 + f.ph * 2) * 9) * dt;
    if (f.lure && dl < 8) { const k = Math.exp(-4 * dt); f.vx *= k; f.vy *= k; }
    const s = Math.hypot(f.vx, f.vy); if (s > max) { f.vx *= max / s; f.vy *= max / s; }
    const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
    if (!f.lure && (isSolid(nx, ny) || ny > SURF - 3)) { f.vx *= -.6; f.vy *= -.6; pickFly(f); } else { f.x = nx; f.y = ny; }
  }
}
function drawFlies(t) {
  for (const f of flies) {
    if (f.state === 'gone') continue;
    let b = Math.pow(Math.max(0, Math.sin(t * f.rate + f.ph)), 3); if (f.lure || f.state === 'caught') b = Math.max(b, .7);
    p.globalAlpha = f.a; p.fillStyle = b > .3 ? '#f0ffa0' : '#7a9a40'; p.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); p.globalAlpha = 1;
    light(f.x + .5, f.y + .5, 4 + 5 * b, '#c8ff58', (.15 + .55 * b) * f.a);
  }
}

/* ---------- moonlight shaft + dust ---------- */
const SH = { x0: 64, y0: 4, x1: 134, y1: 206, w0: 4, w1: 22 };
const motes = Array.from({ length: 34 }, () => ({ u: R(), v: rr(-1, 1), du: rr(.004, .012), ph: rr(0, TAU) }));
function updMotes(dt, t) { for (const m of motes) { m.u += m.du * dt; m.v = clamp(m.v + Math.sin(t * .4 + m.ph) * .05 * dt, -1, 1); if (m.u > 1) { m.u = 0; m.v = rr(-1, 1); } } }
function drawMotes(t) {
  const dx = SH.x1 - SH.x0, dy = SH.y1 - SH.y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  p.fillStyle = '#c8d8ff';
  for (const m of motes) {
    const hw = lerp(SH.w0, SH.w1, m.u), x = SH.x0 + dx * m.u + nx * m.v * hw, y = SH.y0 + dy * m.u + ny * m.v * hw;
    if (isSolid(x, y) || isWet(x, y)) continue;
    const tw = .5 + .5 * Math.sin(t * 1.5 + m.ph * 3);
    p.globalAlpha = (1 - Math.abs(m.v)) * (1 - m.u * .6) * (.25 + .5 * tw); p.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  p.globalAlpha = 1;
}

/* ---------- the crack in the east wall ---------- */
let glintT = 0, burst = 0;
function updWay(dt, t) {
  burst = Math.max(0, burst - dt * .6);
  glintT -= dt * (1 + E.hot * 3);
  if (glintT <= 0) {
    glintT = rr(.5, 1.4);
    const y = opened ? rr(106, 116) : rr(113, 116);
    spawn({ x: opened ? rr(300, 316) : rr(302, 312), y, vx: rr(-7, -2), vy: rr(-2, 2), wob: 2, life: rr(1.5, 3), col: opened ? '#d8ffe8' : '#cfe8ff', gc: opened ? '#8fe8b0' : '#7fb8ff', glow: 2.5, ga: .5, fin: .3, fout: 1 });
  }
}
function drawWay(t) {
  if (opened) { light(318, 111, 14, '#7fc8ff', .22 + burst * .8); light(306, 114, 7, '#8fe8b0', .12 + burst * .5); return; }
  const pul = .5 + .5 * Math.sin(t * 2.2), a = .45 + .25 * pul + E.hot * .45;
  p.globalAlpha = .45 + .45 * pul + E.hot * .5; p.fillStyle = '#d8f0ff'; p.fillRect(317, 114, 2, 3); p.fillStyle = '#9fd8c0'; p.fillRect(312, 117, 7, 1); p.globalAlpha = 1;
  light(317, 115, 6 + pul * 3 + E.hot * 4, '#9fd0ff', a); light(308, 115, 14 + E.hot * 8, '#4f8fe0', .16 + .06 * pul + E.hot * .22);
}
function openWay() {
  opened = true; carve(); paintBG(); burst = 1;
  E.rubble(308, 110, 26, ['#2a2552', '#3a3370', '#1f7a62', '#15122c'], 6);
  for (let i = 0; i < 14; i++) spawn({ x: rr(300, 318), y: rr(104, 117), vx: rr(-24, -6), vy: rr(-10, 6), drag: 1.4, wob: 3, life: rr(1.5, 3), col: pick(['#d8ffe8', '#f0ffa0', '#cfe8ff']), gc: '#8fe8b0', glow: 3, ga: .55, fin: .05, fout: 1 });
  ring(312, 111, 26, '#8fd0ff', 1.2);
}

/* ---------- FROG on a lily pad ---------- */
const PAD_X = 206, PAD_W = 17;
const frog = (() => {
  const pal = { g: '#2f6e4c', d: '#153826', b: '#a6d48c', w: '#eef6d0', h: '#40905f' };
  const body = spr(['.gg.....gg.', 'gwwgggggwwg', 'ggggggggggg', 'ggggggggggg', 'gggdddddggg', '.ggbbbbbgg.', 'gg.bbbbb.gg', 'hh.......hh'], pal);
  const o = { name: 'frog', caption: 'The frog snaps up a firefly', busy: false, tt: 0, phase: '',
    blinkT: 2, blink: 0, look: 0, fly: null, tongue: null, hopY: 0, flash: 0, glowTh: 0, dip: 0, X: 0, Y: 0, py: 0 };
  o.box = () => [o.X, o.Y, 11, 8];
  o.update = (dt, t) => {
    o.blinkT -= dt; if (o.blinkT <= 0) { o.blink = .13; o.blinkT = rr(2.5, 6); } o.blink = Math.max(0, o.blink - dt);
    o.flash = Math.max(0, o.flash - dt * .7); o.glowTh = Math.max(0, o.glowTh - dt * .5); o.dip = Math.max(0, o.dip - dt * 2.5);
    o.py = SURF - 2 + ((o.dip > 0 || Math.sin(t * 1.1) > .6) ? 1 : 0);
    o.X = PAD_X + 3; o.Y = o.py - 8 + Math.round(o.hopY) + (o.phase === 'aim' ? 1 : 0);
    const cx = o.X + 5.5, mx = o.X + 5, my = o.Y + 4;
    if (!o.busy) {
      let best = null, bd = 80;
      for (const f of flies) { if (f.state !== 'fly') continue; const d = Math.hypot(f.x - cx, f.y - o.Y); if (d < bd) { bd = d; best = f; } }
      o.look = best ? (best.x < cx - 3 ? -1 : best.x > cx + 3 ? 1 : 0) : 0; return;
    }
    o.tt += dt; const f = o.fly;
    if (o.phase === 'lure') {
      o.look = f.x < cx - 2 ? -1 : f.x > cx + 2 ? 1 : 0;
      if ((Math.hypot(f.x - f.lure.x, f.y - f.lure.y) < 3 && o.tt > 1.6) || o.tt > 5) { o.phase = 'aim'; o.tt = 0; }
    } else if (o.phase === 'aim') {
      if (o.tt > .28) { o.phase = 'out'; o.tt = 0; o.tongue = { k: 0, tx: f.x, ty: f.y }; }
    } else if (o.phase === 'out') {
      o.tongue.k = Math.min(1, o.tt / .08); o.tongue.tx = f.x; o.tongue.ty = f.y;
      if (o.tongue.k >= 1) { o.phase = 'back'; o.tt = 0; f.state = 'caught'; f.lure = null; sparkle(f.x, f.y, 6, '#f4ffa0', '#d8ff60'); }
    } else if (o.phase === 'back') {
      const k = Math.min(1, o.tt / .15); o.tongue.k = 1 - k; f.x = lerp(mx, o.tongue.tx, 1 - k); f.y = lerp(my, o.tongue.ty, 1 - k);
      if (k >= 1) { o.phase = 'gulp'; o.tt = 0; o.tongue = null; f.state = 'gone'; f.tt = rr(3, 6); o.glowTh = 1; }
    } else if (o.phase === 'gulp') {
      if (o.tt > .9) { o.phase = 'hop'; o.tt = 0; o.flash = 1; ring(cx, o.Y + 3, 18, '#5fffb0', .9); ripple(cx, .7); }
    } else if (o.phase === 'hop') {
      const k = o.tt / .55; o.hopY = -Math.sin(Math.PI * Math.min(1, k)) * 7;
      if (k >= 1) { o.hopY = 0; o.dip = 1; ripple(PAD_X + 1, 1); ripple(PAD_X + PAD_W - 1, 1); splash(PAD_X - 1, SURF - 1, 3); splash(PAD_X + PAD_W, SURF - 1, 3); o.phase = 'rest'; o.tt = 0; }
    } else if (o.phase === 'rest') {
      if (o.tt > .9) { o.busy = false; o.phase = ''; }
    }
  };
  o.trigger = () => {
    const cx = o.X + 5.5; let f = null, bd = 1e9;
    for (const q of flies) { if (q.state !== 'fly') continue; const d = Math.hypot(q.x - cx, q.y - o.Y); if (d < bd) { bd = d; f = q; } }
    if (!f) { f = flies[0]; Object.assign(f, newFly()); }
    const side = R() < .5 ? -1 : 1;
    f.lure = { x: cx + side * rr(10, 18), y: o.Y - rr(14, 22) };
    o.fly = f; o.busy = true; o.tt = 0; o.phase = 'lure';
  };
  o.draw = t => {
    const py = o.py, X = o.X, Y = o.Y;
    p.fillStyle = '#17503a'; p.fillRect(PAD_X, py + 1, PAD_W, 1);
    p.fillStyle = '#2e8452'; p.fillRect(PAD_X + 1, py, 6, 1); p.fillRect(PAD_X + 8, py, PAD_W - 9, 1);
    p.fillStyle = '#4fb877'; p.fillRect(PAD_X + 10, py, 3, 1);
    p.drawImage(body, X, Y);
    const sc = mix('#2f9a70', '#b0ffd8', .25 + .25 * Math.sin(t * 1.6) + o.flash);
    for (const [sx, sy] of [[2, 3], [8, 3], [5, 2]]) { p.fillStyle = sc; p.fillRect(X + sx, Y + sy, 1, 1); light(X + sx + .5, Y + sy + .5, 3 + o.flash * 5, '#4fffb0', .22 + .5 * o.flash); }
    const puff = o.phase === 'gulp' ? 2 : (Math.sin(t * 2.4) > .55 ? 1 : 0);
    if (puff) { p.fillStyle = o.glowTh > 0 ? mix(pal.b, '#f6ff9a', o.glowTh) : pal.b; p.fillRect(X + 2, Y + 6, 1, 1); p.fillRect(X + 8, Y + 6, 1, 1); if (puff > 1) p.fillRect(X + 3, Y + 7, 5, 1); }
    if (o.glowTh > 0) light(X + 5.5, Y + 6.5, 9, '#d8ff60', .7 * o.glowTh);
    if (o.blink > 0 || (o.phase === 'gulp' && o.tt < .6)) { p.fillStyle = '#23583b'; p.fillRect(X + 1, Y + 1, 2, 1); p.fillRect(X + 8, Y + 1, 2, 1); }
    else { p.fillStyle = '#0a0c10'; p.fillRect(X + (o.look < 0 ? 1 : 2), Y + 1, 1, 1); p.fillRect(X + (o.look > 0 ? 9 : 8), Y + 1, 1, 1); }
    if (o.tongue) {
      const mx = X + 5, my = Y + 4, ex = lerp(mx, o.tongue.tx, o.tongue.k), ey = lerp(my, o.tongue.ty, o.tongue.k);
      line(mx, my, ex, ey, '#ff6f8f'); p.fillStyle = '#ffa6b8'; p.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 2, 2);
    }
    light(X + 5.5, Y + 4, 10, '#3fa070', .07);
  };
  return o;
})();

/* ---------- BAT hanging from the ceiling ---------- */
const bat = (() => {
  const pal = { b: '#2c2346', h: '#4a3c72', f: '#7a6a9a', w: '#3b2f60' };
  const hang = spr(['..f.f..', '..bbb..', '.bbbbb.', 'bbhbhbb', 'bbhbhbb', 'bbbbbbb', '.bbbbb.', '.bbbbb.', '.b...b.'], pal);
  const F = [
    ['w....b.b....w', 'ww...bbb...ww', '.ww.bbbbb.ww.', '..wwbbbbbww..', '....bbbbb....', '.....bbb.....', '......b......'],
    ['.....b.b.....', '.....bbb.....', 'wwwwbbbbbwwww', '.wwwbbbbbwww.', '..w.bbbbb.w..', '.....bbb.....', '......b......'],
    ['.....b.b.....', '.....bbb.....', '....bbbbb....', '...wbbbbbw...', '..wwbbbbbww..', '.ww..bbb..ww.', 'ww....b....ww']
  ].map(r => spr(r, pal));
  const HX = 115, HY = ceilAt(118);
  const o = { name: 'bat', caption: 'The bat takes a lap of the hollow', busy: false, tt: 0, flying: false, blinkT: 3, blink: 0, twT: 5, tw: 0, settle: 0, x: 0, y: 0, pts: null, dur: 6 };
  o.box = () => o.flying ? [o.x - 6, o.y - 3, 13, 7] : [HX, HY, 7, 9];
  const eyes = (x1, x2, y) => { if (o.blink > 0) return; p.fillStyle = '#ff7aa8'; p.fillRect(x1, y, 1, 1); p.fillRect(x2, y, 1, 1); light((x1 + x2) / 2 + .5, y + .5, 4, '#ff4f96', .4); };
  o.update = (dt, t) => {
    o.blinkT -= dt; if (o.blinkT <= 0) { o.blink = .16; o.blinkT = rr(3, 7); } o.blink = Math.max(0, o.blink - dt);
    o.twT -= dt; if (o.twT <= 0) { o.tw = .3; o.twT = rr(4, 9); } o.tw = Math.max(0, o.tw - dt);
    o.settle = Math.max(0, o.settle - dt);
    if (!o.busy) return;
    o.tt += dt;
    if (o.flying) {
      const u = Math.min(1, o.tt / o.dur), q = pathAt(o.pts, u - Math.sin(TAU * u) / TAU);
      o.x = q.x; o.y = q.y;
      if (R() < dt * 22) spawn({ x: o.x + rr(-4, 4), y: o.y + rr(-1, 2), vx: rr(-3, 3), vy: rr(3, 8), life: rr(.7, 1.3), col: '#a88ce8', glow: 2, gc: '#8a6ae0', ga: .25 });
      for (const f of flies) { if (f.state !== 'fly' || f.lure) continue; const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy) || 1; if (d < 24) { f.vx += dx / d * 90 * dt; f.vy += dy / d * 90 * dt; } }
      if (u >= 1) { o.flying = false; o.settle = 1.3; o.tt = 0; }
    } else if (o.settle <= 0 && o.tt > .2) o.busy = false;
  };
  o.trigger = () => {
    const sx = HX + 3, sy = HY + 4;
    const mid = [{ x: rr(170, 205), y: rr(70, 100) }, { x: rr(250, 285), y: rr(48, 80) }, { x: rr(205, 225), y: rr(128, 162) }, { x: rr(145, 175), y: rr(100, 128) }, { x: rr(45, 85), y: rr(75, 115) }, { x: rr(55, 95), y: rr(44, 60) }];
    if (R() < .5) mid.reverse();
    o.pts = [{ x: sx, y: sy }, { x: sx + 2, y: sy + 16 }, ...mid, { x: sx - 16, y: sy + 20 }, { x: sx, y: sy + 9 }, { x: sx, y: sy }];
    o.x = sx; o.y = sy; o.dur = rr(5.5, 6.5); o.flying = true; o.busy = true; o.tt = 0;
  };
  o.draw = t => {
    if (o.flying) { const s = F[[0, 1, 2, 1][Math.floor(t * 14) % 4]], x = Math.round(o.x) - 6, y = Math.round(o.y) - 3; p.drawImage(s, x, y); eyes(x + 5, x + 7, y + 2); return; }
    const sway = o.settle > 0 ? Math.round(Math.sin(o.settle * 12) * o.settle) : (Math.sin(t * .6) > .85 ? 1 : 0);
    p.drawImage(hang, 0, 0, 7, 3, HX, HY, 7, 3); p.drawImage(hang, 0, 3, 7, 6, HX + sway, HY + 3, 7, 6);
    if (o.tw > 0) { p.fillStyle = pal.w; p.fillRect(HX + sway - 1, HY + 4, 1, 2); }
    eyes(HX + sway + 2, HX + sway + 4, HY + 7);
  };
  return o;
})();

/* ---------- SNAIL with a glowing spiral shell ---------- */
const snail = (() => {
  const ROWS = ['.....SSSSS..', '....SLLLLLS.', '....SLSSSLS.', 'bbb.SLSLSLS.', 'bbbbSSSLLLS.', 'bbbbSSSSSSS.', '.bbbbSSSSSbb', 'bbbbbbbbbbbb'];
  const SP = [[1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [5, 2], [5, 3], [5, 4], [4, 4], [3, 4], [3, 3]];
  const SPI = {}; SP.forEach(([a, b], i) => { SPI[(a + 4) + ',' + b] = i; });
  const o = { name: 'snail', caption: "The snail's shell sings with light", busy: false, tt: 0, x: 272, dir: -1, stalk: 2, wig: 0, wigT: 2, wigD: 0, lit: -1, after: 0, trail: [], sx: 272, burst: false, turn: false };
  const baseY = () => groundBelow(Math.round(o.x) + 6, 95);
  const mx = i => o.dir < 0 ? Math.round(o.x) + i : Math.round(o.x) + 11 - i;
  o.box = () => [Math.round(o.x), baseY() - 8, 12, 8];
  o.update = (dt, t) => {
    o.wigT -= dt; if (o.wigT <= 0) { o.wig = R() < .5 ? -1 : 1; o.wigD = .35; o.wigT = rr(1.5, 4); }
    o.wigD -= dt; if (o.wigD <= 0) o.wig = 0;
    for (let i = o.trail.length - 1; i >= 0; i--) { o.trail[i].a -= dt / 30; if (o.trail[i].a <= 0) o.trail.splice(i, 1); }
    o.after = Math.max(0, o.after - dt * .45);
    if (!o.busy) { o.stalk += (2 - o.stalk) * Math.min(1, dt * 3); return; }
    o.tt += dt; const T = o.tt;
    if (T < .5) o.stalk = lerp(2, 0, T / .5);
    if (o.turn && T > .6) { o.dir *= -1; o.turn = false; }
    if (T >= .7 && T < 2.3) o.lit = Math.min(SP.length - 1, Math.floor((T - .7) / 1.6 * SP.length));
    if (T >= 2.3 && !o.burst) {
      o.burst = true; o.lit = -1; o.after = 1;
      const cx = mx(7) + .5, cy = baseY() - 5;
      ring(cx, cy, 40, '#ffb050', 1.5);
      for (let i = 0; i < 16; i++) spawn({ x: cx + rr(-2, 2), y: cy + rr(-2, 2), vx: rr(-14, 14), vy: rr(-26, -8), drag: 1.2, wob: 5, life: rr(2, 4), col: R() < .5 ? '#ffe39a' : '#ffb85a', gc: '#ffa040', glow: 3, ga: .5, fin: .05, fout: 1.5 });
    }
    if (T >= 2.3) o.stalk = Math.min(3.5, o.stalk + dt * 5);
    if (T >= 2.6 && T < 4.6) {
      const nx = o.sx + o.dir * Math.floor((T - 2.6) / 2 * 5);
      if (nx !== o.x) { const back = o.dir < 0 ? Math.round(o.x) + 11 : Math.round(o.x); o.trail.push({ x: back, y: groundBelow(back, 95) - 1, a: 1 }); o.x = nx; }
    }
    if (T > 4.6) o.stalk += (2 - o.stalk) * Math.min(1, dt * 3);
    if (T > 5.2) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.burst = false; o.sx = o.x; o.turn = (o.dir < 0 && o.x <= 252) || (o.dir > 0 && o.x >= 284); };
  const spiralCol = (i, j, t) => {
    const idx = SPI[i + ',' + j], pulse = .5 + .5 * Math.sin(t * .9 - idx * .35);
    if (o.lit >= 0 && idx <= o.lit) return idx === o.lit ? '#ffffff' : '#ffe39a';
    if (o.after > 0) return mix('#b8783a', '#ffe39a', o.after);
    return mix('#5a3a20', '#b8783a', pulse * .8);
  };
  o.draw = t => {
    const Y = baseY() - 8;
    for (let i = 0; i < o.trail.length; i++) { const s = o.trail[i]; p.globalAlpha = s.a * .85; p.fillStyle = '#5fe8c8'; p.fillRect(s.x, s.y, 1, 1); if (i % 2 === 0) light(s.x + .5, s.y + .5, 3, '#3fd8b0', .2 * s.a); }
    p.globalAlpha = 1;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) {
      const k = ROWS[j][i]; if (k === '.') continue;
      p.fillStyle = k === 'L' ? spiralCol(i, j, t) : k === 'S' ? '#2e2350' : j === 7 ? '#62729a' : '#8292b6'; p.fillRect(mx(i), Y + j, 1, 1);
    }
    const sh = Math.round(o.stalk);
    for (const sx of [0, 2]) {
      p.fillStyle = '#8292b6'; for (let k = 1; k <= sh; k++) p.fillRect(mx(sx), Y + 3 - k, 1, 1);
      const tx = mx(sx) + (sx === 0 ? o.wig : 0), ty = Y + 2 - sh;
      p.fillStyle = '#e6f8ff'; p.fillRect(tx, ty, 1, 1); light(tx + .5, ty + .5, 3, '#9fe8ff', .3);
    }
    const lit = o.lit >= 0;
    light(mx(7) + .5, Y + 3, 6 + o.after * 10 + (lit ? 4 : 0), '#ffa040', .14 + .08 * Math.sin(t * .9) + o.after * .5 + (lit ? .3 : 0));
    if (lit) { const [a, b] = SP[o.lit]; light(mx(a + 4) + .5, Y + b + .5, 5, '#fff0b0', .6); }
  };
  return o;
})();

/* ---------- CHINCHILLA on the left ledge ---------- */
const chin = (() => {
  const ROWS = ['......EE.EE.', '......Ep.Ep.', '.....HHHHHH.', '.T..FFFFFkFF', 'TTT.FFFFFFFN', 'TTTFFFFFFFF.', 'TTFFFFFFBBF.', '.TFFFFFFBBF.', '..FFFFFFBBF.', '..DDD..DDD..'];
  const pal = { E: '#9a96b8', p: '#e08aa8', H: '#b0accc', F: '#8a86a8', B: '#cac6de', k: '#0a0812', N: '#e890b0', T: '#6c688c', D: '#58547a' };
  const V = fn => sprv(ROWS, pal, fn);
  const S = {
    base: V(), blink: V(r => { r[3][9] = 'F'; }),
    ear: V(r => { r[0][9] = '.'; r[0][10] = '.'; r[1][10] = 'E'; r[1][11] = 'E'; }),
    tail: V(r => { r[3][1] = '.'; r[2][0] = 'T'; r[3][0] = 'T'; r[7][1] = '.'; }),
    stand: V(r => { r.splice(9, 0, '...F....F...'.split('')); })
  };
  const X0 = 54, GY = groundBelow(60, 120);
  const o = { name: 'chinchilla', caption: 'The chinchilla takes a dust bath', busy: false, tt: 0, blinkT: 2, blink: 0, earT: 3, ear: 0, tailT: 2, tail: 0, flip: false, yoff: 0, rot: 0, jit: 0, stand: false, happy: 0, ev: 0 };
  o.box = () => [X0, GY - 11 + Math.round(o.yoff), 12, 11];
  const dust = (x, y, n) => { for (let i = 0; i < n; i++) spawn({ x: x + rr(-5, 5), y: y + rr(-2, 1), vx: rr(-26, 26), vy: rr(-30, -6), ay: 30, drag: 1.6, life: rr(.8, 1.7), col: ['#d8d0ff', '#b8b0e4', '#fff2d8'][R() * 3 | 0], gc: '#c0b0ff', glow: 2, ga: .4, fin: .02, fout: .8 }); };
  o.update = (dt, t) => {
    o.blinkT -= dt; if (o.blinkT <= 0) { o.blink = .14; o.blinkT = rr(2, 5.5); } o.blink = Math.max(0, o.blink - dt);
    o.earT -= dt; if (o.earT <= 0) { o.ear = .18; o.earT = rr(2.5, 6); } o.ear = Math.max(0, o.ear - dt);
    o.tailT -= dt; if (o.tailT <= 0) { o.tail = .4; o.tailT = rr(3, 7); } o.tail = Math.max(0, o.tail - dt);
    o.happy = Math.max(0, o.happy - dt);
    if (!o.busy) return;
    o.tt += dt; const T = o.tt, cx = X0 + 6;
    o.stand = T < 1.05; o.flip = T > .4 && T < .75; o.yoff = T >= 1.05 && T < 1.25 ? 1 : 0; o.rot = 0; o.jit = 0;
    if (T >= 1.25 && o.ev === 0) { o.ev = 1; dust(cx, GY - 1, 8); }
    if (T >= 1.25 && T < 2.25) {
      const k = (T - 1.25) / 1; o.yoff = -Math.sin(Math.PI * k) * 9; o.rot = Math.floor(k * 4) % 4;
      if (R() < dt * 30) spawn({ x: cx + rr(-4, 4), y: GY - 5 + o.yoff + rr(-3, 3), vx: rr(-8, 8), vy: rr(-4, 6), drag: 2, life: rr(.6, 1.2), col: '#fff2d8', gc: '#d8c8ff', glow: 2, ga: .45 });
    }
    if (T >= 2.25 && o.ev === 1) { o.ev = 2; dust(cx, GY - 1, 14); }
    if (T >= 2.25 && T < 2.95) { o.jit = Math.floor(T * 28) % 2 ? 1 : -1; if (R() < dt * 40) spawn({ x: cx + rr(-6, 6), y: GY - rr(3, 8), vx: rr(-30, 30), vy: rr(-20, 0), ay: 20, drag: 2, life: rr(.5, 1), col: '#d8d0ff', gc: '#c0b0ff', glow: 2, ga: .35 }); }
    if (T >= 2.95 && o.ev === 2) { o.ev = 3; o.happy = .7; }
    if (T > 3.9) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.ev = 0; };
  o.draw = t => {
    let s = S.base;
    if (o.stand) s = S.stand; else if (o.blink > 0 || o.happy > 0) s = S.blink; else if (o.ear > 0) s = S.ear; else if (o.tail > 0) s = S.tail;
    const X = X0 + o.jit, Y = GY - s.height + Math.round(o.yoff);
    if (o.rot) { p.save(); p.translate(X + 6, Y + 5); p.rotate(o.rot * Math.PI / 2); p.drawImage(s, -6, -5); p.restore(); }
    else blit(s, X, Y, o.flip);
    if (!o.rot && !o.stand && Math.sin(t * 11) > .4 && Math.sin(t * .8) > 0) { p.fillStyle = '#ffc0d4'; p.fillRect(o.flip ? X : X + 11, Y + 4, 1, 1); }
    light(X + 6, Y + 5, 12, '#9a90d8', .07);
  };
  return o;
})();

/* ---------- CAVE FISH in the pool ---------- */
const fish = (() => {
  const pal = { b: '#b4cce4', f: '#5ff0ff', t: '#48d8f0', e: '#0a0a18' };
  const A = spr(['...ff...', 't.bbbbb.', 'ttbbbbeb', 't.bbbbb.', '....f...'], pal);
  const B = spr(['...ff...', '.tbbbbb.', 'ttbbbbeb', '.tbbbbb.', '....f...'], pal);
  const o = { name: 'fish', caption: 'The cave fish leaps', busy: false, tt: 0, state: 'swim', x: 165, y: SURF + 14, vx: 5, vy: 0, dir: 1, ldir: 1, tx: 165, ty: SURF + 14, tT: 0, ang: 0 };
  o.box = () => [o.x - 4, o.y - 2, 8, 5];
  const ok = (x, y) => isWet(x - 5, y) && isWet(x + 5, y) && isWet(x, y + 4) && isWet(x, y - 3);
  const pick = () => { for (let i = 0; i < 30; i++) { const x = rr(134, 200), y = rr(SURF + 6, SURF + 22); if (ok(x, y)) { o.tx = x; o.ty = y; break; } } o.tT = rr(3, 7); };
  pick();
  const qa = (vy, vx) => Math.round(Math.atan2(vy, Math.abs(vx)) / (Math.PI / 8)) * (Math.PI / 8);
  o.update = (dt, t) => {
    const py = o.y;
    if (o.state === 'swim' || o.state === 'wind') {
      const fast = o.state === 'wind', acc = fast ? 40 : 6, max = fast ? 24 : 7;
      if (!fast) { o.tT -= dt; if (o.tT <= 0 || Math.hypot(o.tx - o.x, o.ty - o.y) < 2) pick(); }
      const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy) || 1;
      o.vx += dx / d * acc * dt; o.vy += dy / d * acc * dt;
      const k = Math.exp(-(fast ? 1.5 : .8) * dt); o.vx *= k; o.vy *= k;
      const s = Math.hypot(o.vx, o.vy); if (s > max) { o.vx *= max / s; o.vy *= max / s; }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (Math.abs(o.vx) > .8) o.dir = Math.sign(o.vx);
      o.ang = 0;
      if (fast) { o.tt += dt; if (d < 3 || o.tt > 3) { o.state = 'air'; o.tt = 0; o.dir = o.ldir; o.vx = o.dir * rr(36, 44); o.vy = -rr(124, 134); } }
    } else if (o.state === 'air') {
      o.tt += dt; o.vy += 215 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.ang = qa(o.vy, o.vx);
      if (py >= SURF && o.y < SURF) { splash(o.x, SURF - 1, 7); ripple(o.x, 1); ring(o.x, SURF, 14, '#6fe0ff', .7); }
      if (o.y < SURF && R() < dt * 30) spawn({ x: o.x + rr(-2, 2), y: o.y + rr(-1, 1), vx: rr(-6, 6), vy: rr(-4, 10), ay: 60, life: rr(.5, 1), col: '#bff8ff', gc: '#5ff0ff', glow: 2, ga: .4, kind: 2 });
      if (py < SURF && o.y >= SURF && o.vy > 0) { splash(o.x, SURF - 1, 11); ripple(o.x, 1.2); ripple(o.x + rr(-3, 3), .8); ring(o.x, SURF, 20, '#6fe0ff', .9); o.state = 'dive'; o.tt = 0; }
    } else if (o.state === 'dive') {
      o.tt += dt; const k = Math.exp(-7 * dt); o.vx *= k; o.vy *= k; o.x += o.vx * dt; o.y += o.vy * dt;
      if (!isWet(o.x, o.y + 3) || o.y > SURF + 22) { o.vy = Math.min(o.vy, 0); o.y -= .5; }
      o.ang = qa(o.vy, o.vx) * Math.max(0, 1 - o.tt);
      if (o.tt > 1.1) { o.state = 'swim'; o.busy = false; pick(); }
    }
  };
  o.trigger = () => {
    o.ldir = o.x < 168 ? 1 : -1;
    const x0 = o.ldir > 0 ? rr(136, 152) : rr(186, 200);
    o.tx = x0 - o.ldir * 8; o.ty = SURF + 12; o.state = 'wind'; o.tt = 0; o.busy = true;
  };
  const drawFish = (a, t) => {
    const s = o.state === 'air' ? A : (Math.floor(t * (o.state === 'wind' ? 9 : 3)) % 2 ? A : B);
    p.save(); p.globalAlpha = a; p.translate(Math.round(o.x), Math.round(o.y)); if (o.dir < 0) p.scale(-1, 1); if (o.ang) p.rotate(o.ang); p.drawImage(s, -4, -2); p.restore();
  };
  o.drawAbove = t => { if (o.y < SURF) { drawFish(1, t); light(o.x, o.y, 8, '#5ff0ff', .55); } };
  o.drawUnder = t => { if (o.y >= SURF) { drawFish(.6, t); wlight(o.x, o.y, 9, '#40d8ff', .28 + (o.state !== 'swim' ? .2 : 0)); } };
  return o;
})();

/* ---------- LUNA MOTH resting on the back wall ---------- */
const moth = (() => {
  const pal = { W: '#6f9e8a', s: '#fff2a8', b: '#ece6d4', a: '#c8bf9e', T: '#5a8a78' };
  const rows = ['...a...a...', '.WWWabaWWW.', 'WWsWWbWWsWW', 'WWWWWbWWWWW', '.WWWWbWWWW.', '..WWWbWWW..', '..W..b..W..', '..T.....T..'];
  const open = spr(rows, pal);
  const twitch = spr(['..a.....a..', ...rows.slice(1)], pal);
  const mid = spr(['...a...a...', '..WWabaWW..', '.WWsWbWsWW.', '.WWWWbWWWW.', '..WWWbWWW..', '...W.b.W...', '...T...T...', '...........'], pal);
  const shut = spr(['...a...a...', '....WbW....', '...WWbWW...', '...WsbsW...', '....WbW....', '.....b.....', '....T.T....', '...........'], pal);
  const HC = { x: 258 + 5.5, y: 66 + 4 };
  const o = { name: 'moth', caption: 'The luna moth goes wandering', busy: false, tt: 0, flying: false, x: HC.x, y: HC.y, vx: 0, vy: 0, wp: [], wi: 0, wt: 0, settle: 0, twT: 2, tw: 0, brT: 5, br: 0 };
  o.box = () => [o.x - 5.5, o.y - 4, 11, 8];
  o.update = (dt, t) => {
    o.twT -= dt; if (o.twT <= 0) { o.tw = .25; o.twT = rr(1.8, 5); } o.tw = Math.max(0, o.tw - dt);
    o.brT -= dt; if (o.brT <= 0) { o.br = .6; o.brT = rr(4, 8); } o.br = Math.max(0, o.br - dt);
    if (!o.busy) return;
    o.tt += dt;
    if (o.flying) {
      const home = o.wi >= o.wp.length, tg = home ? HC : o.wp[o.wi], dx = tg.x - o.x, dy = tg.y - o.y, d = Math.hypot(dx, dy);
      o.wt += dt;
      if (home) {
        const k = 1 - Math.exp(-3 * dt); o.x += dx * k; o.y += dy * k + Math.sin(t * 9) * .1;
        if (d < .7 || o.wt > 3) { o.x = HC.x; o.y = HC.y; o.flying = false; o.settle = 1.4; }
      } else {
        o.vx += (dx * 3.2 + rr(-90, 90)) * dt; o.vy += (dy * 3.2 + rr(-90, 90)) * dt;
        const k = Math.exp(-2.4 * dt); o.vx *= k; o.vy *= k; o.x += o.vx * dt; o.y += o.vy * dt;
        if (d < 6 || o.wt > 1.6) { o.wi++; o.wt = 0; }
      }
      if (R() < dt * 26) spawn({ x: o.x + rr(-3, 3), y: o.y + rr(-1, 2), vx: rr(-4, 4), vy: rr(3, 9), wob: 3, life: rr(1, 2), col: '#efffd0', gc: '#d8ff9a', glow: 2, ga: .35, fin: .05, fout: .8 });
    } else { o.settle -= dt; if (o.settle <= 0) o.busy = false; }
  };
  o.trigger = () => {
    o.wp = []; for (let i = 0; i < 4; i++) o.wp.push({ x: rr(150, 296), y: rr(34, 108) });
    o.wp.push({ x: HC.x + rr(-12, 12), y: HC.y + rr(10, 20) });
    o.wi = 0; o.wt = 0; o.x = HC.x; o.y = HC.y; o.vx = 0; o.vy = -10; o.flying = true; o.busy = true; o.tt = 0;
  };
  o.draw = t => {
    let s;
    if (o.flying) s = [open, mid, shut, mid][Math.floor(t * 18) % 4];
    else if (o.settle > 0) s = Math.floor(o.settle * 5) % 2 ? mid : open;
    else s = o.br > 0 ? mid : o.tw > 0 ? twitch : open;
    const X = Math.round(o.x - 5.5), Y = Math.round(o.y - 4);
    p.drawImage(s, X, Y);
    const gl = o.flying ? .5 : .22 + .08 * Math.sin(t * 1.3);
    light(X + 2.5, Y + 2.5, 4, '#ffe88a', gl); light(X + 8.5, Y + 2.5, 4, '#ffe88a', gl);
    light(X + 5.5, Y + 4, o.flying ? 12 : 9, '#b8f0c8', o.flying ? .25 : .1);
  };
  return o;
})();

/* ---------- render ---------- */
function waterPass(t) {
  sp.clearRect(0, 0, W, H); sp.drawImage(E.px, 0, 0);
  p.save(); p.clip(waterPath);
  const x0 = POOL_L - 12, w = POOL_R - POOL_L + 24;
  p.fillStyle = '#05121f'; p.fillRect(x0, SURF, w, H - SURF);
  for (let y = SURF; y < H; y++) {
    const dy = y - SURF, src = SURF - 1 - dy; if (src < 0) break;
    const off = Math.round(Math.sin(dy * .9 - t * 2.2) * Math.min(1.6, dy * .15));
    p.globalAlpha = .6 * Math.max(0, 1 - dy / 30); p.drawImage(snap, x0, src, w, 1, x0 + off, y, w, 1);
  }
  p.globalAlpha = 1;
  fish.drawUnder(t);
  p.fillStyle = '#2f7aa0';
  for (let i = 0; i < 18; i++) {
    const x = POOL_L + ((i * 37 + t * 6) % (POOL_R - POOL_L)), y = SURF + 3 + ((i * 13) % 22), a = .5 + .5 * Math.sin(t * 1.3 + i);
    if (a > .7) { p.globalAlpha = (a - .7) * 1.5; p.fillRect(Math.round(x), y, 1, 1); }
  }
  p.globalAlpha = 1; p.restore();
  for (let x = POOL_L - 10; x <= POOL_R + 10; x++) {
    if (!isWet(x, SURF)) continue;
    const s = Math.sin(x * .7 + t * 1.8) + Math.sin(x * .23 - t * 1.1);
    p.fillStyle = s > 1.4 ? '#9fe4f4' : s > .5 ? '#4f9ab8' : '#1f4a62'; p.fillRect(x, SURF, 1, 1);
  }
}
const critters = [frog, bat, snail, chin, fish, moth];
function ambient(dt, t) { updShrooms(dt); updDrips(dt); updFlies(dt, t); updMotes(dt, t); updCrystals(dt); updRipples(dt); updWay(dt, t); }
return {
  critters,
  exit: { x: 312, y: 113, r: 12 },
  ambient,
  update(dt, t) { ambient(dt, t); for (const c of critters) c.update(dt, t); },
  draw(t) {
    p.globalAlpha = 1; p.drawImage(bg, 0, 0);
    drawCrystLights(t); drawThreads(t); drawVines(t);
    for (const s of shrooms) drawShroom(s, t);
    drawTufts(t); drawFlowers(t); drawDrips(); drawWay(t);
    snail.draw(t); chin.draw(t); frog.draw(t); moth.draw(t); bat.draw(t); fish.drawAbove(t);
    drawFlies(t); E.drawParts(); drawMotes(t);
    waterPass(t); drawRipples();
  },
  under(g, t) {
    E.beam(g, SH.x0, SH.y0, SH.x1, SH.y1, SH.w0, SH.w1, '#96b4ff', .055 + .015 * Math.sin(t * .35));
    if (!opened) E.beam(g, 318, 115, 272, 112, 2, 9, '#9fd0ff', .05 + .03 * Math.sin(t * 2.2) + E.hot * .08);
    else E.beam(g, 319, 110, 250, 116, 6, 20, '#a8d8ff', .045 + burst * .15);
    light(64, 7, 14, '#8fb0ff', .4); light(SH.x1, SH.y1 - 4, 26, '#6f8fff', .06);
  },
  post(g) {
    g.save(); g.clip(waterPath);
    for (const L of E.lights) {
      if (L.y >= SURF || L.x < POOL_L - 24 || L.x > POOL_R + 24) continue;
      const dy = SURF - L.y; if (dy > 110) continue;
      drawLight(g, L, 2 * SURF - L.y, .4 * (1 - dy / 110));
    }
    for (const L of E.wlights) drawLight(g, L, L.y, 1);
    g.restore();
  },
  openExit: openWay
};
};
