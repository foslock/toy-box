/* Cinder Deep · a volcanic cavern under the dunes. Sand from the sinkhole trickles through the roof; lava falls into a
   glowing pool; a seam of cool blue light in the east wall is the flooded tube to Lantern Reef. */
'use strict';
SCENES.deep = E => {
const { p, light, spawn, sparkle, ring, sr, srnd, line, dot, rect } = E;

/* ---------- shape of the place ---------- */
const SX = WAYS.deep[1], TY = WAYS.reef[1], LX = 112;
const SURF = 206, PL = 88, PR = 172, PC = (PL + PR) / 2;
const STAL = [[40, 5, 14], [74, 4, 9], [150, 6, 18], [186, 4, 11], [262, 5, 15], [292, 4, 8]];
const CY = new Float32Array(W);
for (let x = 0; x < W; x++) { let y = 16 + 10 * fbm(x * .04, 2.2); for (const [s, w, h] of STAL) { const d = Math.abs(x - s); if (d < w) y += h * Math.pow(1 - d / w, 1.6); } CY[x] = y; }
const COLS = [[246, 188], [254, 181], [262, 174], [270, 176], [278, 168], [286, 164], [294, 161], [302, 161]];
const FL = profile([[0, 196], [40, 194], [78, 199], [86, 206], [PL, 208], [PR, 208], [176, 204], [200, 199], [228, 197], [246, 198], [W, 198]]);
for (let x = 0; x < W; x++) { FL[x] = Math.round(FL[x] + (x < PL - 3 || x > PR + 3 ? 2 * (fbm(x * .12, 5) - .5) : 0)); for (const [cx, top] of COLS) if (x >= cx && x < cx + 8) FL[x] = Math.min(FL[x], top); }
const bed = x => SURF + 1 + 20 * Math.sqrt(Math.max(0, 1 - ((x - PC) / 43) ** 2));
const lava = (x, y) => x >= PL - 1 && x <= PR + 1 && y >= SURF && y < bed(x);
const LW = y => 9 + 8 * fbm(1.3, y * .05);
const RW = y => 304 + 6 * fbm(4.4, y * .06);
const shelf = (x, y) => x < 66 - Math.max(0, y - 156) * 1.2 && y >= 150 + Math.round(fbm(x * .2, 3)) && y < 162 + (66 - x) * .1;
let opened = false;
const tube = (x, y) => x > 290 && (opened ? y >= TY - 10 + Math.round(1.5 * fbm(x * .2, 1)) && y <= TY + 10 : x > 300 && Math.abs(y - TY - Math.round(2 * (fbm(x * .5, 6) - .5))) < 1);
const hole = (x, y) => Math.abs(x - SX) < 3 && y < CY[x] + 1;
const solid = (x, y) => ((y < CY[x] && !hole(x, y)) || (y >= FL[x] && !lava(x, y)) || x < LW(y) || x >= RW(y) || shelf(x, y)) && !tube(x, y);
const T = terrain();
E.isSolid = (x, y) => T.at(x, y) || y >= H;
E.isWet = (x, y) => lava(Math.round(x), Math.round(y));

/* ---------- painted background ---------- */
const bg = mk(W, H);
const BACK = ['#070409', '#0c060c', '#12080e', '#1a0a10', '#240e10', '#301210', '#3e1810', '#4e2012'];
const heat = (x, y) => Math.max(0, 1 - Math.hypot(x - PC, (y - SURF) * 1.2) / 190) + Math.max(0, 1 - Math.hypot(x - LX, y - 120) / 110) * .45;
const form = (x, y) => fbm(x * .035, y * .012 + 17) + .2 * Math.exp(-(((y - 190) / 40) ** 2));
function paintBG() {
  T.fill(solid);
  const open = (x, y) => x < 0 || x >= W || y < 0 || y >= H || !T.m[y * W + x];
  paint((x, y) => {
    const n = hash(x, y), h = heat(x, y);
    if (T.m[y * W + x]) {
      const col = COLS.find(([cx, top]) => x >= cx && x < cx + 8 && y >= top);
      if (col) { const [cx, top] = col, dx = x - cx; if (y - top < 2) return y === top ? '#6a3a2a' : '#3a2220'; if (dx === 0) return '#2a1a1a'; if (dx === 7) return '#08060a'; return dx < 3 ? '#1e1418' : '#141016'; }
      const up = open(x, y - 1), dn = open(x, y + 1), side = open(x - 1, y) || open(x + 1, y);
      if (up) return h > .5 ? (n > .5 ? '#b8501a' : '#8a3a18') : h > .25 ? '#6a2a18' : '#3a2220';
      if (dn) return h > .45 ? (n > .5 ? '#9a4018' : '#7a3418') : h > .2 ? '#4a2418' : '#241618';
      if (side) return h > .35 ? '#4a2418' : '#1c1418';
      if (n > .992) return '#6a4a9a';
      if (n > .985) return '#2a1a3a';
      const f = fbm(x * .1, y * .1);
      return f > .58 ? '#1a1418' : f > .45 ? '#120e12' : '#0c0a0e';
    }
    if (tube(x, y)) return opened ? band(['#0a1a2a', '#0e2a40', '#123a58', '#1a4a70'], (x - 290) / 30, x, y) : '#4ab8ff';
    if (lava(x, y)) return band(['#5a1a0a', '#8a2a0c', '#c8400e', '#ff6a1a'], 1 - (y - SURF) / 18, x, y);
    if (hole(x, y)) return '#3a2c48';
    let v = .08 + h * .8 + (fbm(x * .02, y * .03) - .5) * .25;
    if (form(x, y) > .6) { v -= .2; if (form(x, y - 2) <= .6) v += .3; }
    return band(BACK, v, x, y);
  }, bg);
  // sand fallen from the sinkhole
  const b = bg.getContext('2d');
  for (let i = -9; i <= 9; i++) { const hgt = Math.round(7 * (1 - Math.abs(i) / 9.5) ** 1.5); for (let j = 0; j < hgt; j++) { b.fillStyle = j === hgt - 1 ? '#d0b08c' : hash(i, j) > .5 ? '#a88874' : '#8a6e62'; b.fillRect(SX + i, FL[SX + i] - 1 - j, 1, 1); } }
}
paintBG();

/* ---------- lava: pool, fall, embers, vents ---------- */
const lavaPath = new Path2D(); for (let x = PL - 1; x <= PR + 1; x++) lavaPath.rect(x, SURF, 1, Math.max(0, bed(x) - SURF));
const drops = [], sand = [];
const glow = (x, y, r, a) => light(x, y, r, '#ff7a2a', a);
function updLava(dt) {
  if (R() < dt * 40) drops.push({ x: LX + rr(-1.5, 1.5), y: CY[LX] + 1, v: rr(8, 20), c: pick(['#ffe070', '#ffa030', '#ff6a1a']) });
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.v += 160 * dt; d.y += d.v * dt; if (d.y >= SURF) { drops.splice(i, 1); if (R() < .12) E.spawn({ x: d.x, y: SURF - 1, vx: rr(-20, 20), vy: rr(-40, -10), ay: 120, life: rr(.4, .8), col: '#ffc050', gc: '#ff8a2a', glow: 2, ga: .5, fin: .01, fout: .3 }); } }
  if (R() < dt * 8) spawn({ x: rr(PL + 4, PR - 4), y: SURF - 1, vx: rr(-3, 3), vy: rr(-18, -8), wob: 5, life: rr(2, 4), col: pick(['#ffb040', '#ff7a2a', '#ffe070']), gc: '#ff6a1a', glow: 2.5, ga: .5, fin: .1, fout: 1.5 });
  if (R() < dt * 1.2) { const x = rr(PL + 8, PR - 8); for (let i = 0; i < 5; i++) spawn({ x, y: SURF - 1, vx: rr(-16, 16), vy: rr(-50, -20), ay: 140, life: rr(.5, .9), col: '#ffd060', gc: '#ff8a2a', glow: 2, ga: .6, fin: .01, fout: .3 }); }
  if (R() < dt * 30) sand.push({ x: SX + rr(-1, 1), y: CY[SX] - 2, v: rr(5, 15), c: pick(['#e0c49c', '#c8a482', '#a88874']) });
  for (let i = sand.length - 1; i >= 0; i--) { const q = sand[i]; q.v += 150 * dt; q.y += q.v * dt; if (T.at(q.x, q.y + 1) && q.y > 60) sand.splice(i, 1); }
}
function drawLava(t) {
  // the fall
  for (let y = Math.ceil(CY[LX]); y < SURF; y++) { const s = Math.sin(y * .6 - t * 10); dot(LX, y, s > .3 ? '#ffe070' : '#ffa030'); dot(LX + (s > 0 ? 1 : -1), y, '#ff6a1a'); }
  for (const d of drops) dot(d.x, d.y, d.c);
  for (let y = CY[LX] + 6; y < SURF; y += 12) glow(LX + .5, y, 9, .22);
  // the pool surface: drifting crust over bright cracks
  p.save(); p.clip(lavaPath);
  for (let x = PL - 1; x <= PR + 1; x++) for (let y = SURF; y < SURF + 4; y++) {
    const v = fbm(x * .12 - t * .15, y * .4 + t * .05);
    if (v < .42) dot(x, y, y === SURF ? '#ffe070' : '#ffa030'); else if (v > .6) dot(x, y, '#5a1a0a');
  }
  p.restore();
  for (let x = PL; x <= PR; x += 10) glow(x, SURF, 16, .18 + .06 * Math.sin(t * 1.3 + x));
  glow(PC, SURF - 10, 70, .08); glow(LX, CY[LX] + 2, 10, .5);
  for (const q of sand) dot(q.x, q.y, q.c);
}
// steam vents on the right
const VENTS = [228, 208].map(x => ({ x, y: FL[x] - 1, t: rr(0, 3) }));
function updVents(dt) { for (const v of VENTS) { v.t -= dt; if (v.t <= 0) { v.t = rr(2.5, 6); for (let i = 0; i < 10; i++) spawn({ x: v.x + rr(-1, 1), y: v.y, vx: rr(-4, 4), vy: rr(-26, -12), drag: .8, wob: 4, life: rr(1.2, 2.2), col: pick(['#b8a8a8', '#8a7a80', '#d8c8c0']), fin: .1, fout: 1, a: .6 }); } } }
// obsidian shards on the floor
const SHARDS = [[34, 4], [42, 6], [196, 5], [204, 3], [238, 4]].map(([x, h]) => ({ x, h, y: FL[x] - 1, ph: sr(0, TAU) }));
function drawShards(t) { for (const s of SHARDS) { for (let i = 0; i < s.h; i++) { dot(s.x, s.y - i, i === s.h - 1 ? '#c8b0ff' : '#4a2a6a'); if (i < s.h - 2) dot(s.x + 1, s.y - i, '#2a1a3a'); } const tw = Math.sin(t * 1.9 + s.ph); if (tw > .8) light(s.x + .5, s.y - s.h + 1, 4, '#b890ff', (tw - .8) * 2); } }

/* ---------- the blue seam in the east wall ---------- */
let burst = 0, glintT = 0;
function updWay(dt) {
  burst = Math.max(0, burst - dt * .45);
  glintT -= dt * (1 + E.hot * 3); if (glintT > 0) return; glintT = rr(.3, .9);
  if (opened) spawn({ x: rr(296, 312), y: TY + rr(-8, 8), vx: rr(-10, -3), vy: rr(-8, -2), drag: .6, wob: 3, life: rr(1.5, 3), col: pick(['#c8d8e8', '#a8b8c8']), fin: .2, fout: 1.2, a: .5 });
  else spawn({ x: rr(304, 312), y: TY + rr(-2, 2), vx: rr(-8, -2), vy: rr(-10, -3), drag: .6, wob: 3, life: rr(1, 2), col: '#d8e8f8', fin: .2, fout: .8, a: .6 });
}
function drawWay(t) {
  const pul = .5 + .5 * Math.sin(t * 2.2);
  if (opened) { light(318, TY, 20, '#3ab8ff', .28 + burst * .7); light(300, TY, 10, '#6fd8ff', .12 + burst * .5); return; }
  light(310, TY, 6 + pul * 3 + E.hot * 5, '#6fd8ff', .38 + .2 * pul + E.hot * .4);
  light(304, TY, 14 + E.hot * 6, '#2a8aff', .12 + E.hot * .2);
}
function openWay() {
  opened = true; paintBG(); burst = 1;
  E.rubble(302, TY, 30, ['#1c1418', '#3a2220', '#141016', '#4a2418'], 8);
  for (let i = 0; i < 40; i++) spawn({ x: rr(292, 316), y: TY + rr(-9, 9), vx: rr(-40, -5), vy: rr(-30, 0), drag: 1, wob: 5, life: rr(1.5, 3), col: pick(['#e8f0f8', '#c8d8e8', '#a8b8c8']), fin: .05, fout: 1.5, a: .7 });
  ring(304, TY, 30, '#6fd8ff', 1.4);
}

/* ---------- SALAMANDER on the shelf, blowing a smoke ring ---------- */
const salamander = (() => {
  const pal = { K: '#1a1418', k: '#0a080a', y: '#ffb020', e: '#ffe070', r: '#e84a1a' };
  const body = spr(['.....KKK..', 'K.KKKKyKe.', 'KKKyKKKKKK', '.K.K..K.K.'], pal);
  const X = 34, Y = 150;
  const SPOTS = [[6, 1], [3, 2], [5, 0]];
  const o = { name: 'salamander', caption: 'The salamander blows a smoke ring', busy: false, tt: 0, flare: 0 };
  o.box = () => [X - 2, Y - 5, 14, 6];
  o.update = (dt) => {
    o.flare = Math.max(0, o.flare - dt * .8);
    for (let i = o.rings.length - 1; i >= 0; i--) { o.rings[i].t += dt; if (o.rings[i].t > 3.2) o.rings.splice(i, 1); }
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < 1.2) o.flare = Math.min(1, T0 / 1.2);
    if (T0 > 1.4 && !o.blown) { o.blown = true; o.rings.push({ x: X + 11, y: Y - 3, t: 0 }); }
    if (T0 > 2.2 && !o.b2) { o.b2 = true; o.rings.push({ x: X + 11, y: Y - 3, t: 0, s: .7 }); }
    if (T0 > 5) o.busy = false;
  };
  o.rings = [];
  o.trigger = () => { o.busy = true; o.tt = 0; o.blown = o.b2 = false; };
  o.draw = t => {
    p.drawImage(body, X, Y - 4);
    for (let i = 0; i < SPOTS.length; i++) { const [sx, sy] = SPOTS[i], pu = .5 + .5 * Math.sin(t * 1.5 + i * 2), f = Math.max(pu * .4, o.flare); dot(X + sx + 1, Y - 3 + sy, mix('#c87010', '#ffe890', f)); light(X + sx + 1.5, Y - 2.5 + sy, 3 + f * 3, '#ffa020', .15 + f * .5); }
    light(X + 8.5, Y - 2.5, 3, '#ffe070', .35);
    for (let i = o.rings.length - 1; i >= 0; i--) {
      const r = o.rings[i], k = r.t / 3.2;
      const cx = r.x + k * 26 * (r.s || 1), cy = r.y - k * 40, rad = 1.5 + k * 5;
      p.globalAlpha = (1 - k) * .8;
      for (let a = 0; a < 16; a++) { const an = a / 16 * TAU; dot(cx + Math.cos(an) * rad * .45, cy + Math.sin(an) * rad, a % 2 ? '#a89aa0' : '#d8c8c8'); }
      p.globalAlpha = 1;
    }
  };
  return o;
})();

/* ---------- BOMBARDIER BEETLE ---------- */
const beetle = (() => {
  const pal = { a: '#2a3a8a', b: '#e8781a', k: '#0a0a14', l: '#1a1a2a', s: '#4a5aba' };
  const A = spr(['.aasaa.', 'aaaaaaa', 'bbbbbbk', '.l.l.l.'], pal), B = spr(['.aasaa.', 'aaaaaaa', 'bbbbbbk', 'l.l.l.l'], pal);
  const X0 = 196;
  const o = { name: 'bombardier beetle', caption: 'The bombardier beetle fires a hot puff', busy: false, tt: 0, x: X0, dir: 1, kick: 0 };
  const gy = () => FL[Math.round(o.x)] - 1;
  o.box = () => [o.x - 4, gy() - 4, 8, 5];
  o.update = (dt) => {
    o.kick = Math.max(0, o.kick - dt * 6);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < .8) { o.x += o.dir * 6 * dt; }
    else if (T0 < 1.1) {}
    else if (!o.fired) {
      o.fired = true; o.kick = 1; const bx = o.x - o.dir * 4, by = gy() - 2;
      for (let i = 0; i < 18; i++) spawn({ x: bx, y: by, vx: -o.dir * rr(20, 60), vy: rr(-30, 5), drag: 3, wob: 3, life: rr(.5, 1.2), col: pick(['#fff8e0', '#ffe070', '#e8e0d0']), gc: '#ffd060', glow: 2, ga: .5, fin: .01, fout: .6 });
      ring(bx - o.dir * 4, by, 12, '#ffe0a0', .6);
    } else if (T0 > 2.2) { o.busy = false; o.dir = -o.dir; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.fired = false; };
  o.draw = t => { const s = o.busy && o.tt < .8 && Math.floor(t * 12) % 2 ? B : A; E.blit(s, o.x - 3 + o.dir * Math.round(o.kick * 2), gy() - 3, o.dir < 0); };
  return o;
})();

/* ---------- EMBER CRAB on the basalt columns ---------- */
const crab = (() => {
  const pal = { r: '#c8401a', R: '#e8602a', k: '#140808', l: '#8a2a10' };
  const legsA = spr(['r.k.k.r', 'Rr...rR', '.lrrrl.', 'l.l.l.l'], pal), legsB = spr(['r.k.k.r', 'Rr...rR', '.lrrrl.', '.l.l.l.'], pal);
  const PATH = [262, 270, 278, 286, 278, 270, 262];
  const o = { name: 'ember crab', caption: 'The ember crab snaps its claws and flares its coal', busy: false, tt: 0, x: 265, flare: 0, snap: 0 };
  const gy = () => FL[clamp(Math.round(o.x), 0, W - 1)] - 1;
  o.box = () => [o.x - 4, gy() - 8, 9, 9];
  o.update = (dt, t) => {
    o.flare = Math.max(0, o.flare - dt * .6); o.snap = Math.max(0, o.snap - dt * 5);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < 3) { const u = T0 / 3 * (PATH.length - 1), i = Math.floor(u); o.x = lerp(PATH[i], PATH[Math.min(PATH.length - 1, i + 1)], u - i) + 3; }
    if (T0 > 3.2 && T0 < 4.4) { const k = Math.floor((T0 - 3.2) / .3); if (k !== o.k) { o.k = k; o.snap = 1; o.flare = 1; sparkle(o.x + (k % 2 ? 4 : -4), gy() - 3, 4, '#ffd060', '#ff8a2a'); } }
    if (T0 > 4.8) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.k = -1; };
  o.draw = t => {
    const X = Math.round(o.x), Y = gy(), walking = o.busy && o.tt < 3, s = walking && Math.floor(t * 14) % 2 ? legsB : legsA;
    p.drawImage(s, X - 3, Y - 3);
    if (o.snap > 0) { dot(X - 4, Y - 3, '#e8602a'); dot(X + 4, Y - 3, '#e8602a'); }
    // the coal it carries for a shell
    const pu = .5 + .5 * Math.sin(t * 2.4), f = Math.max(pu * .4, o.flare);
    rect(X - 2, Y - 6, 5, 3, '#3a1a10'); rect(X - 1, Y - 7, 3, 1, '#3a1a10');
    dot(X - 1, Y - 5, mix('#c8400e', '#ffe070', f)); dot(X + 1, Y - 6, mix('#8a2a0c', '#ffa030', f)); dot(X, Y - 4, mix('#ff6a1a', '#fff0a0', f));
    light(X + .5, Y - 5, 6 + f * 8, '#ff7a2a', .3 + f * .5);
  };
  return o;
})();

/* ---------- BASILISK LIZARD sprinting over the lava crust ---------- */
const lizard = (() => {
  const pal = { G: '#5a7a3a', g: '#3a5a2a', y: '#e8d060', k: '#0a0a08' };
  const runA = spr(['......GGy', '.....GGGk', 'gg.GGGG..', '..gGGG...', '...G..G..', '..G....G.'], pal);
  const runB = spr(['......GGy', '.....GGGk', 'gg.GGGG..', '..gGGG...', '....GG...', '....G.G..'], pal);
  const sit = spr(['.........', '......GGy', '.....GGGk', 'ggGGGGGG.', '.g.G..G..'], pal);
  const L = 74, Rt = 184;
  const o = { name: 'basilisk lizard', caption: 'The lizard sprints across the lava crust', busy: false, tt: 0, x: L, dir: 1, prints: [] };
  const gy = x => lava(Math.round(x), SURF) ? SURF - 1 : FL[clamp(Math.round(x), 0, W - 1)] - 1;
  o.box = () => [o.x - 5, gy(o.x) - 6, 10, 6];
  o.update = (dt) => {
    for (let i = o.prints.length - 1; i >= 0; i--) { o.prints[i].a -= dt * .6; if (o.prints[i].a <= 0) o.prints.splice(i, 1); }
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt, from = o.dir > 0 ? L : Rt, to = o.dir > 0 ? Rt : L;
    if (T0 < .5) return;
    const k = Math.min(1, (T0 - .5) / 1.3); o.x = lerp(from, to, k);
    if (Math.floor(o.x / 5) !== o.lp) { o.lp = Math.floor(o.x / 5); if (lava(Math.round(o.x), SURF)) { o.prints.push({ x: Math.round(o.x), a: 1 }); if (R() < .6) spawn({ x: o.x, y: SURF - 1, vx: rr(-10, 10), vy: rr(-30, -10), ay: 100, life: .5, col: '#ffd060', gc: '#ff8a2a', glow: 2, ga: .5, fin: .01, fout: .3 }); } }
    if (k >= 1 && T0 > 2.2) { o.busy = false; o.dir = -o.dir; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.lp = -1; };
  o.draw = t => {
    for (const q of o.prints) { p.globalAlpha = q.a; dot(q.x, SURF, '#fff0a0'); } p.globalAlpha = 1;
    const running = o.busy && o.tt > .5 && o.tt < 1.8, X = Math.round(o.x), s = running ? (Math.floor(t * 16) % 2 ? runA : runB) : sit;
    E.blit(s, X - 4, gy(o.x) - s.height + 1, o.dir < 0);
  };
  return o;
})();

/* ---------- EMBER MOTHS spiralling up the lavafall ---------- */
const moths = (() => {
  const M = Array.from({ length: 3 }, (_, i) => ({ ph: i / 3 * TAU, x: 60 + i * 12, y: 100 + i * 8 }));
  const home = [[56, 96], [66, 108], [48, 116]];
  const o = { name: 'ember moths', caption: 'The ember moths spiral up the lavafall', busy: false, tt: 0 };
  o.box = () => { const xs = M.map(m => m.x), ys = M.map(m => m.y); return [Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) - Math.min(...xs) + 6, Math.max(...ys) - Math.min(...ys) + 6]; };
  o.update = (dt, t) => {
    for (let i = 0; i < M.length; i++) {
      const m = M[i];
      if (o.busy) { const k = o.tt / 5, a = m.ph + o.tt * 3.4, r = 10 + 4 * Math.sin(o.tt * 2 + i); const tx = k < .85 ? LX + Math.cos(a) * r : home[i][0], ty = k < .85 ? lerp(190, 50, k / .85) + Math.sin(a) * 3 : home[i][1]; m.x += (tx - m.x) * Math.min(1, dt * 5); m.y += (ty - m.y) * Math.min(1, dt * 5); }
      else { m.x = home[i][0] + Math.sin(t * .9 + m.ph) * 5; m.y = home[i][1] + Math.sin(t * 1.3 + m.ph * 2) * 3; }
    }
    if (!o.busy) return;
    o.tt += dt; if (o.tt > 5.6) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; };
  o.draw = t => {
    for (const m of M) {
      const f = Math.floor(t * 14 + m.ph * 3) % 2, x = Math.round(m.x), y = Math.round(m.y);
      dot(x, y, '#ffd8a0'); dot(x - 1, y - f, '#ff9a4a'); dot(x + 1, y - f, '#ff9a4a');
      light(x + .5, y + .5, 4 + (o.busy ? 3 : 0), '#ffa050', .3 + (o.busy ? .2 : 0));
      if (o.busy && R() < .1) spawn({ x, y, vx: rr(-4, 4), vy: rr(2, 8), life: .8, col: '#ffc070', gc: '#ff8a2a', glow: 1.5, ga: .4, fin: .01, fout: .5 });
    }
  };
  return o;
})();

/* ---------- render ---------- */
const critters = [salamander, beetle, crab, lizard, moths];
function ambient(dt, t) { updLava(dt); updVents(dt); updWay(dt); }
return {
  critters,
  entry: { x: SX, y: 0 },
  exit: { x: 306, y: TY, r: 14 },
  ambient,
  vig: vignette(.7, .3, '4,2,4'),
  update(dt, t) { ambient(dt, t); for (const c of critters) c.update(dt, t); },
  draw(t) {
    p.globalAlpha = 1; p.drawImage(bg, 0, 0);
    drawShards(t); drawWay(t); drawLava(t);
    for (const v of VENTS) light(v.x, v.y, 5, '#ff8a4a', .15);
    salamander.draw(t); beetle.draw(t); crab.draw(t); lizard.draw(t); moths.draw(t);
    E.drawParts();
    light(SX, CY[SX] + 4, 8, '#b0a0d0', .12);
  },
  openExit: openWay
};
};
