/* Duskcrag Peaks · a mountainside at dusk above Fernlight Wood. A trail climbs out of a gully from the wood below;
   a rope bridge half-buried in snow waits to be thrown across the chasm to Aurora Barrens. */
'use strict';
SCENES.peaks = E => {
const { p, light, spawn, sparkle, ring, sr, srnd, line, dot, rect } = E;
const OX = 2 * W;  // this place's left edge in world pixels (for the shared bridge)

/* ---------- shape of the place ---------- */
const CH = 38, GX = WAYS.peaks[1];
const LEDGES = [[251, 260], [270, 278], [287, 294], [300, 305]];
const G = profile([[CH, 142], [62, 143], [80, 152], [104, 170], [128, 184], [156, 191], [196, 194], [216, 194], [234, 191], [247, 170], [251, 163], [260, 162], [265, 146], [270, 130], [278, 129], [283, 108], [287, 96], [294, 95], [297, 76], [300, 63], [305, 62], [311, 51], [316, 56], [320, 62]]);
for (let x = 0; x < W; x++) {
  if (x < CH) { G[x] = 999; continue; }
  if (!LEDGES.some(([a, b]) => x >= a && x <= b)) G[x] += 2.6 * (fbm(x * .2, 3) - .5);
  G[x] = Math.round(G[x]);
  const d = Math.abs(x - GX); if (d < 8) G[x] = Math.max(G[x], Math.round(194 + 70 * (1 - d / 7.5)));
}
const cliff = y => CH + Math.round(3 * fbm(y * .09, 5)) - 1;
const BOULDER = { x: 104, y: 165, rx: 11, ry: 7.5 };
const TALUS = [[224, 190, 5], [233, 188, 6], [241, 186, 4], [229, 183, 3.5]];
const rocky = (x, y) => Math.hypot((x - BOULDER.x) / BOULDER.rx, (y - BOULDER.y) / BOULDER.ry) < 1 || TALUS.some(([a, b, r]) => Math.hypot(x - a, (y - b) * 1.2) < r);
const solid = (x, y) => (x >= cliff(y) && y >= G[x]) || rocky(x, y);
const T = terrain(solid);
E.isSolid = (x, y) => T.at(x, y) || y >= H;
const top = x => T.ground(x, 30);

/* ---------- painted background ---------- */
// ridged noise gives sharp peaks
const rm = (x, f, s) => { let v = 0, a = 1, fr = f, tot = 0; for (let i = 0; i < 4; i++) { v += a * (1 - Math.abs(2 * vn(x * fr, s + i * 7) - 1)); tot += a; a *= .5; fr *= 2.2; } return v / tot; };
const FR1 = new Float32Array(W), FR2 = new Float32Array(W);
for (let x = 0; x < W; x++) { FR1[x] = 166 - 78 * rm(x, .011, 11) ** 1.8; FR2[x] = 196 - 70 * rm(x + 50, .015, 21) ** 1.8; }
const SKY = ['#08071c', '#0e0a26', '#150d30', '#1e1038', '#291340', '#361646', '#46194a', '#581c4c', '#6c224c', '#82294a', '#983446', '#ac4442', '#bc5840'];
const open = (x, y) => x < 0 || x >= W || y < 0 || y >= H || !T.m[y * W + x];
const bg = mk(W, H);
paint((x, y) => {
  const n = hash(x, y);
  if (T.m[y * W + x]) {
    if (Math.hypot(x - 150, (y - G[150] - 2) * 1.6) < 3.2 && y > G[150]) return '#060408';
    if (rocky(x, y) && !(y >= G[x] && x >= cliff(y) && y > G[x] + 2)) {
      if (open(x, y - 1)) return n > .4 ? '#d0c8e4' : '#a8a0c8';
      if (open(x - 1, y)) return '#5a4064';
      return fbm(x * .3, y * .3) > .5 ? '#2c2036' : '#1f1628';
    }
    const d = y - G[x], flat = Math.abs(G[Math.min(W - 1, x + 1)] - G[Math.max(0, x - 1)]) < 3;
    if (x > 60 && x < 246 && Math.abs(x - GX) > 8) {
      if (d === 0) return x < 200 && x > 70 && hash(x, 3) > .3 ? (n > .8 ? '#6a5a60' : '#4a3c44') : n > .6 ? '#6a8a50' : '#4a6a44';
      if (d === 1) return n > .5 ? '#3a4a3a' : '#2c3a30';
      if (n > .97) return '#3a2e38';
      return d > 16 ? '#0e0a14' : fbm(x * .1, y * .12) > .5 ? '#1c1624' : '#161020';
    }
    if (Math.abs(x - GX) <= 9 && d < 6) return (y % 4 === 0) ? '#5a4c54' : '#3e3238';
    if (d < (flat ? 3 : 1) + (fbm(x * .2, 1) > .55 ? 1 : 0)) return d === 0 ? (x < 70 || n > .5 ? '#f0e0ec' : '#d0c8e4') : '#a8a0c8';
    if (open(x - 1, y) || open(x - 2, y)) return n > .5 ? '#5a4064' : '#4a3454';
    const strata = fbm(x * .05 + y * .06, y * .02) ;
    if (Math.abs(strata - .5) < .02) return '#2c2036';
    return d > 40 ? '#0f0a16' : strata > .5 ? '#1f1628' : '#181020';
  }
  // mid ridge, far ridge, sky
  if (y >= FR2[x]) {
    const d = y - FR2[x], snow = FR2[x] < 150 && d < (150 - FR2[x]) * .35 + 2 * fbm(x * .2, 6);
    const lit = FR2[Math.max(0, x - 1)] > FR2[x];
    if (snow) return d < 1 ? '#c890a8' : lit ? (n > .4 ? '#9a7896' : '#8a6a88') : (n > .5 ? '#6a5078' : '#5a4468');
    if (d < 1) return '#4a3050';
    return band(['#150e20', '#1a1126', '#20142c', '#261832'], .95 - d / 70 + (fbm(x * .05, y * .05) - .5) * .3, x, y);
  }
  if (y >= FR1[x]) {
    const d = y - FR1[x], snow = FR1[x] < 128 && d < (128 - FR1[x]) * .45 + 3 * fbm(x * .2, 7);
    const lit = FR1[Math.max(0, x - 1)] > FR1[x];
    if (snow) return d < 1 ? '#f4c0c8' : lit ? (n > .4 ? '#e0a8b8' : '#d098ac') : (n > .5 ? '#a8789a' : '#98688c');
    if (d < 1) return '#7a3e5a';
    return band(['#3a2040', '#42244a', '#4a2850', '#542c54'], .9 - d / 55, x, y);
  }
  const s = starAt(x, y, .993); if (s && y < 110 && hash(x, y + 9) > y / 110) return s > 1 ? '#fff0f8' : '#a898c8';
  return band(SKY, y / 172 + (fbm(x * .012, y * .03) - .5) * .09, x, y);
}, bg);

/* ---------- sky + weather ---------- */
const clouds = [[40, 118, .8, 46], [180, 104, 1.3, 60], [270, 128, .6, 34]].map(([x, y, sp, w]) => {
  const c = mk(w, 8), cx = c.getContext('2d');
  for (let j = 0; j < 8; j++) for (let i = 0; i < w; i++) {
    const v = fbm(i * .12 + x, j * .35) - Math.abs(j - 4) * .08 - Math.abs(i - w / 2) / w * .6;
    if (v > .3 + bay(i, j) * .18) { cx.fillStyle = j > 4 ? '#c86a6a' : v > .48 ? '#7a3a5c' : '#5a2a50'; cx.fillRect(i, j, 1, 1); }
  }
  return { c, x, y, sp, w };
});
function drawClouds(t) { for (const c of clouds) { const x = ((c.x + t * c.sp) % (W + c.w)) - c.w; p.drawImage(c.c, Math.round(x), c.y); } }
let shoot = null, shootT = 6;
function updSky(dt) {
  shootT -= dt; if (shootT <= 0 && !shoot) { shootT = rr(8, 18); shoot = { x: rr(40, 260), y: rr(8, 50), vx: rr(90, 140) * (R() < .5 ? -1 : 1), vy: rr(25, 45), t: 0 }; }
  if (shoot) { shoot.t += dt; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt; if (shoot.t > .7) shoot = null; }
  if (R() < dt * 9) spawn({ x: rr(300, 318), y: rr(46, 60), vx: rr(14, 34), vy: rr(-4, 2), wob: 3, life: rr(1, 2.2), col: '#f0e8ff', fin: .1, fout: .8, a: .7 });
}
function drawSky(t) {
  for (const [x, y, ph] of [[64, 34, 0], [212, 22, 2], [150, 60, 4]]) { const tw = .5 + .5 * Math.sin(t * 2.3 + ph); dot(x, y, tw > .5 ? '#ffffff' : '#c8b8e8'); light(x + .5, y + .5, 3 + tw * 2, '#c8b8ff', .2 + .2 * tw); }
  light(236, 150, 4, '#fff0c8', .5); dot(236, 150, '#fff8e0');
  if (shoot) { const k = shoot.t / .7; for (let i = 0; i < 9; i++) { p.globalAlpha = (1 - i / 9) * (1 - k); dot(shoot.x - shoot.vx * i * .006, shoot.y - shoot.vy * i * .006, '#fff4e8'); } p.globalAlpha = 1; light(shoot.x, shoot.y, 5, '#ffe0c8', .5 * (1 - k)); }
  drawClouds(t);
}

/* ---------- flowers + lichen ---------- */
const blooms = [];
for (let i = 0; i < 16; i++) { const x = Math.round(sr(150, 198)); if (Math.abs(x - GX) < 10) continue; blooms.push({ x, y: G[x] - 1, h: Math.round(sr(1, 4)), k: srnd() < .55 ? 0 : 1, ph: sr(0, TAU), gone: 0 }); }
for (let i = 0; i < 6; i++) { const x = Math.round(sr(214, 222)); blooms.push({ x, y: G[x] - 1, h: Math.round(sr(1, 3)), k: 1, ph: sr(0, TAU), gone: 0 }); }
for (let i = 0; i < 5; i++) { const x = Math.round(sr(40, 60)); blooms.push({ x, y: G[x] - 1, h: 1, k: 0, ph: sr(0, TAU), gone: 0 }); }
function drawBlooms(t) {
  for (const b of blooms) {
    if (b.gone > 0) continue;
    const sw = Math.sin(t * 1.4 + b.ph) > .6 ? 1 : 0;
    for (let i = 0; i < b.h; i++) dot(b.x + (i === b.h - 1 ? sw : 0), b.y - i, '#3a5a3a');
    const x = b.x + sw, y = b.y - b.h, pu = .5 + .5 * Math.sin(t * 1.1 + b.ph);
    if (b.k === 0) { dot(x - 1, y, '#e8e4f0'); dot(x + 1, y, '#e8e4f0'); dot(x, y - 1, '#e8e4f0'); dot(x, y, '#fff8c8'); light(x + .5, y + .5, 4 + pu * 2, '#f0f0ff', .16 + .14 * pu); }
    else { dot(x, y, pu > .5 ? '#9ab8ff' : '#5a78ff'); dot(x, y - 1, '#3a58e0'); light(x + .5, y + .5, 4 + pu * 2, '#5a7aff', .2 + .16 * pu); }
  }
}
const LICHEN = [];
for (let i = 0; i < 22; i++) { const x = Math.round(sr(246, 318)), y = Math.round(sr(G[x] + 2, Math.min(H - 2, G[x] + 60))); if (T.at(x, y)) LICHEN.push({ x, y, c: srnd() < .5 ? '#ffb05a' : '#7ff0d0', ph: sr(0, TAU) }); }
function drawLichen(t) { for (const l of LICHEN) { const pu = .5 + .5 * Math.sin(t * .8 + l.ph); p.globalAlpha = .4 + .5 * pu; dot(l.x, l.y, l.c); p.globalAlpha = 1; light(l.x + .5, l.y + .5, 3, l.c, .08 + .1 * pu); } }

/* ---------- the rope bridge ---------- */
let opened = false, unroll = 0, burst = 0;
function drawBridge(t) {
  const post = (x, y) => { rect(x, y - 7, 2, 8, '#4a3428'); dot(x, y - 8, '#6a4c38'); };
  post(CH + 1, 142); post(CH + 7, 142);
  if (!opened) {
    const pul = .5 + .5 * Math.sin(t * 2), hx = CH + 6;
    for (let i = 0; i < 12; i++) { const x = CH + 2 + i; rect(x, 141 - Math.round(3 * Math.sin(i / 11 * Math.PI)), 1, 2 + Math.round(3 * Math.sin(i / 11 * Math.PI)), i % 3 ? '#e8e0f4' : '#c8c0e0'); }
    dot(CH + 4, 139, '#8a6a4a'); dot(CH + 9, 138, '#8a6a4a'); dot(CH + 11, 139, '#6a4c38');
    light(hx + 2, 138, 6 + pul * 2 + E.hot * 5, '#ffd8a8', .35 + .2 * pul + E.hot * .4);
    light(CH - 6, 140, 12 + E.hot * 6, '#ffb08a', .1 + E.hot * .2);
    return;
  }
  const xl = Math.max(0, BRIDGE.x0 - OX), xr = BRIDGE.x1 - OX, reach = lerp(xr, xl, smooth(unroll));
  for (let x = Math.floor(reach); x <= xr; x++) {
    const y = Math.round(bridgeY(OX + x));
    dot(x, y, x % 3 === 0 ? '#3a2820' : '#6a4c38'); if (x % 3) dot(x, y + 1, '#3a2820');
    const ry = Math.round(y - 6 + (y - BRIDGE.y) * .15); dot(x, ry, '#8a7058');
    if (x % 6 === 0) line(x, ry, x, y - 1, '#5a4434');
  }
  if (burst > 0) light(CH - 10, 138, 20, '#ffd0a0', burst * .5);
}
function openWay() {
  opened = true; burst = 1;
  for (let i = 0; i < 30; i++) spawn({ x: CH + rr(2, 14), y: rr(136, 142), vx: rr(-40, 10), vy: rr(-40, -8), ay: 50, drag: 1.4, wob: 4, life: rr(1, 2.4), col: pick(['#ffffff', '#e8e0f4', '#c8c0e0']), fin: .02, fout: .8 });
  ring(CH + 6, 138, 26, '#ffd8a8', 1.2);
}
let glintT = 0;
function updWay(dt) {
  burst = Math.max(0, burst - dt * .5); if (opened) unroll = Math.min(1, unroll + dt / .6);
  glintT -= dt * (1 + E.hot * 3); if (opened || glintT > 0) return; glintT = rr(.5, 1.3);
  spawn({ x: CH + rr(3, 13), y: rr(136, 140), vx: rr(-6, 2), vy: rr(-6, -1), wob: 3, life: rr(1, 2), col: '#fff0d8', gc: '#ffd0a0', glow: 2.5, ga: .5, fin: .2, fout: .8 });
}

/* ---------- MOUNTAIN GOAT on the crag ---------- */
const goat = (() => {
  const pal = { W: '#dcd4e4', w: '#a89cbc', h: '#2a2430', k: '#140e18', n: '#6a5a70', b: '#c8bcd4' };
  const stand = spr(['........h..', '.......hWW.', '.......WWkn', '.WWWWWWWWW.', 'WWWWWWWWWb.', 'wWWWWWWWW..', '.wwWWWWWw..', '.W.W...W.W.', '.W.W...W.W.', '.h.h...h.h.'], pal);
  const leap = spr(['........h..', '.......hWW.', '.......WWkn', '.WWWWWWWWW.', 'WWWWWWWWWb.', 'wWWWWWWWW..', '.wwWWWWWw..', 'W.W.....WW.', 'h..h.....h.', '...........'], pal);
  const chew = sprv(['........h..', '.......hWW.', '.......WWkn', '.WWWWWWWWW.', 'WWWWWWWWWb.', 'wWWWWWWWW..', '.wwWWWWWw..', '.W.W...W.W.', '.W.W...W.W.', '.h.h...h.h.'], pal, r => { r[4][9] = '.'; r[3][9] = 'b'; });
  const SPOTS = [255, 274, 290, 302, 311];
  const o = { name: 'goat', caption: 'The goat bounds up the crag', busy: false, tt: 0, i: 0, x: SPOTS[0], y: 0, air: false, dir: 1, ch: 0 };
  const gy = x => top(Math.round(x));
  o.y = gy(o.x);
  o.box = () => [o.x - 6, o.y - 10, 11, 10];
  o.update = (dt, t) => {
    tick(o, 'ch', 1, 3, .5, dt);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt, per = .75;
    const plan = [0, 1, 2, 3, 4, 4, 4, 3, 2, 1, 0], step = Math.floor(T0 / per), k = (T0 % per) / per;
    if (step >= plan.length - 1) { o.x = SPOTS[0]; o.y = gy(o.x); o.air = false; o.dir = 1; o.busy = false; return; }
    const a = SPOTS[plan[step]], b = SPOTS[plan[step + 1]];
    o.dir = b > a ? 1 : b < a ? -1 : o.dir;
    if (a === b) { o.x = a; o.y = gy(a); o.air = false; if (step === 5 && k > .2 && !o.bleat) { o.bleat = true; ring(o.x + 3, o.y - 8, 24, '#f0d8ff', 1.2); for (let i = 0; i < 10; i++) spawn({ x: o.x + rr(-6, 6), y: o.y - rr(0, 3), vx: rr(8, 30), vy: rr(-8, 2), wob: 3, life: rr(1, 2), col: '#ffffff', fin: .05, fout: .8 }); } return; }
    const kk = clamp(k / .7, 0, 1); o.air = kk > 0 && kk < 1;
    o.x = lerp(a, b, kk); o.y = lerp(gy(a), gy(b), kk) - hop(kk) * 10;
    if (kk >= 1 && !o['l' + step]) { o['l' + step] = 1; E.rubble(o.x, gy(o.x), 3, ['#5a4064', '#a8a0c8'], 2); }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.bleat = false; for (let i = 0; i < 12; i++) delete o['l' + i]; };
  o.draw = () => {
    const s = o.air ? leap : (!o.busy && o.ch > 0 && Math.floor(o.ch * 8) % 2 ? chew : stand);
    E.blit(s, o.x - 5, o.y - 10, o.dir < 0);
    light(o.x, o.y - 5, 10, '#e8d8ff', .07);
  };
  return o;
})();

/* ---------- EAGLE on the snag ---------- */
const eagle = (() => {
  const SX = 54, pal = { H: '#e8e4ec', k: '#140e10', y: '#e8b040', B: '#3a2a24', b: '#5a4232', t: '#d8d4dc' };
  const perch = spr(['..HHH..', '.HHHk..', '..HHHy.', '.BBBB..', 'BBbBBB.', 'BBBbBB.', '.BBBB..', '.BbBB..', '..ttt..', '..y.y..'], pal);
  const F = [
    ['BB...........BB', '.BBB..HHH..BBB.', '..BBBBHkHBBBB..', '....BBBBBBy....', '......BBB......', '......ttt......'],
    ['...............', '....HHH........', 'BBBBBHkHBBBBBBB', '.BBBBBBBBBBBBy.', '......BBB......', '......ttt......'],
    ['...............', '......HHH......', '....BBHkHBB....', '..BBBBBBBBBBy..', '.BB...BBB...BB.', 'B.....ttt.....B']
  ].map(r => spr(r, pal));
  const o = { name: 'eagle', caption: 'The eagle circles the valley', busy: false, tt: 0, flying: false, x: SX, y: 0, pts: null, dur: 7, dir: 1, look: 0 };
  const PY = 104;
  o.box = () => o.flying ? [o.x - 7, o.y - 3, 15, 6] : [SX - 3, PY - 10, 7, 10];
  o.update = (dt, t) => {
    o.look = Math.sin(t * .4) > .7 ? 1 : 0;
    if (!o.busy) return;
    o.tt += dt;
    if (o.flying) {
      const u = Math.min(1, o.tt / o.dur), q = pathAt(o.pts, u - Math.sin(TAU * u) / TAU * .8);
      o.dir = q.x >= o.x ? 1 : -1; o.x = q.x; o.y = q.y;
      if (u >= 1) { o.flying = false; o.tt = 0; ring(SX, PY - 6, 14, '#f0d0b0', .7); }
    } else if (o.tt > .5) o.busy = false;
  };
  o.trigger = () => {
    const s = { x: SX, y: PY - 5 };
    o.pts = [s, { x: SX + 10, y: PY - 26 }, { x: rr(110, 140), y: rr(40, 60) }, { x: rr(190, 230), y: rr(30, 50) }, { x: rr(240, 262), y: rr(80, 100) }, { x: rr(180, 210), y: rr(118, 132) }, { x: rr(110, 140), y: rr(96, 116) }, { x: SX + 20, y: PY - 30 }, { x: SX + 4, y: PY - 12 }, s];
    o.x = s.x; o.y = s.y; o.flying = true; o.busy = true; o.tt = 0; o.dur = rr(6.5, 7.5);
  };
  o.draw = t => {
    // the snag
    line(SX, 142, SX, PY + 1, '#3a2a24'); line(SX + 1, 142, SX + 1, PY + 8, '#2a1e1a'); line(SX, PY + 12, SX - 6, PY + 6, '#3a2a24'); line(SX + 1, PY + 20, SX + 7, PY + 15, '#3a2a24');
    if (o.flying) {
      const u = o.tt / o.dur, flap = u < .15 || u > .85 || Math.sin(o.tt * 3) > .6;
      const s = flap ? F[[0, 1, 2, 1][Math.floor(t * 12) % 4]] : F[1];
      E.blit(s, o.x - 7, o.y - 3, o.dir < 0);
      return;
    }
    E.blit(perch, SX - 3, PY - 10, o.look > 0);
  };
  return o;
})();

/* ---------- MARMOT by its burrow ---------- */
const marmot = (() => {
  const pal = { M: '#8a6a4a', m: '#5a4432', b: '#c8a878', k: '#140c08', n: '#2a1a12' };
  const sit = spr(['...MMM..', '..MMkMn.', '..MMMMM.', '.MMMMMM.', 'MMbbMMM.', 'mMbbMMm.', '.m..m...'], pal);
  const tall = spr(['.MMM.', 'MkMMn', 'MMMM.', '.MbM.', '.MbM.', 'MMbMM', '.MbM.', '.MbM.', '.MMM.', '.m.m.'], pal);
  const peek = spr(['.MMM.', 'MkMkM', '.MnM.'], pal);
  const X = 138, BX = 150;
  const o = { name: 'marmot', caption: 'The marmot whistles a warning', busy: false, tt: 0, state: 'sit', x: X, wh: 0 };
  o.box = () => o.state === 'gone' ? [BX - 4, G[BX] - 5, 8, 6] : [o.x - 1, G[o.x] - 10, 9, 10];
  o.update = (dt) => {
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < .4) o.state = 'tall';
    else if (T0 < 1.9) { o.state = 'tall'; const k = Math.floor((T0 - .5) / .45); if (k >= 0 && k !== o.wh && k < 3) { o.wh = k; ring(o.x + 5, G[o.x] - 8, 16, '#fff0c8', .6); spawn({ x: o.x + 5, y: G[o.x] - 9, vx: 18, vy: -6, drag: 2, life: .5, col: '#fff8e0', gc: '#ffe0a0', glow: 2, ga: .5, fin: .01, fout: .3 }); } }
    else if (T0 < 2.3) { o.state = 'run'; o.x = Math.round(lerp(X, BX - 3, (T0 - 1.9) / .4)); }
    else if (T0 < 3.6) o.state = 'gone';
    else if (T0 < 4.6) o.state = 'peek';
    else if (T0 < 5) { o.state = 'run'; o.x = Math.round(lerp(BX - 3, X, (T0 - 4.6) / .4)); }
    else { o.state = 'sit'; o.x = X; o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.wh = -1; };
  o.draw = () => {
    const gy = G[o.x];
    if (o.state === 'sit') E.blit(sit, o.x, gy - 7, false);
    else if (o.state === 'tall') E.blit(tall, o.x + 1, gy - 10, false);
    else if (o.state === 'run') E.blit(sit, o.x, gy - 7, o.tt > 4);
    else if (o.state === 'peek') p.drawImage(peek, BX - 2, G[BX] - 1);
  };
  return o;
})();

/* ---------- PIKA in the rock pile ---------- */
const pika = (() => {
  const pal = { e: '#b8a8a0', p: '#8a7a70', k: '#0a0808', n: '#3a2a28', f: '#6a5a50' };
  const A = spr(['.ee..', 'pppk.', 'ppppn', '.f.f.'], pal), B = spr(['.ee..', 'pppk.', 'ppppn', 'f...f'], pal);
  const HOME = 226;
  const o = { name: 'pika', caption: 'The pika gathers a mouthful of flowers', busy: false, tt: 0, x: HOME, dir: -1, target: null, carry: null, hide: false };
  o.box = () => [o.x - 2, top(o.x) - 5, 7, 5];
  o.update = (dt) => {
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt, tx = o.target.x;
    const out = Math.abs(tx - HOME) / 45;
    if (T0 < out) { o.dir = tx < HOME ? -1 : 1; o.x = Math.round(lerp(HOME, tx, T0 / out)); }
    else if (T0 < out + .6) { if (!o.carry) { o.carry = o.target.k ? '#7a98ff' : '#f0ecf8'; o.target.gone = 1; sparkle(tx, top(tx) - 2, 4, '#fff8c8', '#ffe0a0'); } }
    else if (T0 < out * 2 + .6) { o.dir = tx < HOME ? 1 : -1; o.x = Math.round(lerp(tx, HOME, (T0 - out - .6) / out)); }
    else if (T0 < out * 2 + 1.4) { o.hide = true; }
    else { o.hide = false; o.carry = null; o.busy = false; o.dir = -1; setTimeout(() => { o.target.gone = 0; }, 9000); }
  };
  o.trigger = () => {
    const opts = blooms.filter(b => !b.gone && b.x > 150 && b.x < 222); o.target = opts.length ? pick(opts) : blooms[0];
    o.busy = true; o.tt = 0; o.carry = null;
  };
  o.draw = t => {
    if (o.hide) return;
    const moving = o.busy && !o.hide && o.tt > 0 && (o.tt < Math.abs(o.target.x - HOME) / 45 || o.tt > Math.abs(o.target.x - HOME) / 45 + .6);
    const s = moving && Math.floor(t * 14) % 2 ? B : A, gy = top(o.x);
    E.blit(s, o.x - 2, gy - 4, o.dir > 0);
    if (o.carry) { dot(o.dir < 0 ? o.x - 3 : o.x + 3, gy - 2, o.carry); light(o.dir < 0 ? o.x - 2.5 : o.x + 3.5, gy - 1.5, 3, '#fff0c8', .3); }
  };
  return o;
})();

/* ---------- SNOW LEOPARD on the boulder ---------- */
const leopard = (() => {
  const pal = { L: '#c8c4d0', l: '#a8a2b4', s: '#5a546a', e: '#9ae8b0', k: '#1a1620', n: '#c88a9a', m: '#e87a9a' };
  const lie = spr(['...........l.l..', '..........lLLLl.', '.lsLLsLLLLLLeLLn', 'LLLsLLsLLsLLLLL.', 'lLLLLLLLLLLLLl..', '..ll.....lll....'], pal);
  const yawn = sprv(['...........l.l..', '..........lLLLl.', '.lsLLsLLLLLLeLLn', 'LLLsLLsLLsLLLLL.', 'lLLLLLLLLLLLLl..', '..ll.....lll....'], pal, r => { r[2][12] = 'k'; r[3][14] = 'm'; r[3][15] = 'm'; r[2][15] = 'n'; r[1][10] = '.'; r[0][11] = '.'; });
  const stand = spr(['............l.l.', '...........lLLLl', '..lsLLsLLLLLLeLn', '.LLLsLLsLLsLLLL.', '.lLLLLLLLLLLLLl.', '..LL.......LL...', '..LL.......LL...', '..ll.......ll...'], pal);
  const stretch = spr(['................', '..lsLL..........', '.LLLsLLsLl..l.l.', '.lLLLLLLsLLlLLLl', '..LL...lLLLLLeLn', '..LL.....lLLLL..', '..LL.....LL.LL..', '..ll.....ll.ll..'], pal);
  const X = 97, Y = 157;
  const o = { name: 'snow leopard', caption: 'The snow leopard stretches and yawns', busy: false, tt: 0, pose: 'lie', dir: 1, tw: 0 };
  o.box = () => [X - 1, Y - 8, 18, 9];
  o.update = (dt, t) => {
    tick(o, 'tw', 1.2, 3, .5, dt);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    o.pose = T0 < .6 ? 'yawn' : T0 < 1.1 ? 'lie' : T0 < 1.6 ? 'stand' : T0 < 3 ? 'stretch' : T0 < 3.5 ? 'stand' : T0 < 4.3 ? 'lie' : 'yawn';
    if (T0 > 3.4 && !o.turned) { o.turned = true; o.dir = -o.dir; }
    if (T0 > 4.9) { o.pose = 'lie'; o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.turned = false; };
  o.draw = t => {
    const s = o.pose === 'yawn' ? yawn : o.pose === 'stand' ? stand : o.pose === 'stretch' ? stretch : lie;
    const y = Y - s.height + 1; E.blit(s, X, y, o.dir < 0);
    // the long tail, curled forward along the rock and flicking at the tip
    const tx = o.dir > 0 ? X - 1 : X + 16, sw = o.tw > 0 ? Math.round(Math.sin(t * 20) * 1) : 0;
    const pts = [[0, -2], [-1, -1], [-2, 0], [-3, 0], [-4, 0], [-5, -1], [-6, -2 + sw], [-6, -3 + sw]];
    for (let i = 0; i < pts.length; i++) dot(tx + pts[i][0] * (o.dir > 0 ? 1 : -1), Y + pts[i][1], i > 5 ? '#5a546a' : i % 2 ? '#a8a2b4' : '#c8c4d0');
    const ex = o.dir > 0 ? X + 12 : X + 3;
    if (o.pose !== 'stretch' && o.pose !== 'yawn') light(ex + .5, y + 2.5, 3, '#9ae8b0', .3);
  };
  return o;
})();

/* ---------- render ---------- */
const critters = [goat, eagle, marmot, pika, leopard];
function ambient(dt, t) { updSky(dt); updWay(dt); }
return {
  critters,
  entry: { x: GX, y: H - 1 },
  exit: { x: CH + 7, y: 138, r: 12 },
  ambient,
  vig: vignette(.55, .15, '6,3,12'),
  update(dt, t) { ambient(dt, t); for (const c of critters) c.update(dt, t); },
  draw(t) {
    p.globalAlpha = 1; p.drawImage(bg, 0, 0);
    drawSky(t); drawLichen(t); drawBlooms(t); drawBridge(t);
    leopard.draw(t); marmot.draw(t); pika.draw(t); goat.draw(t); eagle.draw(t);
    E.drawParts();
    light(160, 190, 90, '#ff7a4a', .07); light(236, 170, 60, '#ff9a6a', .06);
  },
  openExit: openWay
};
};
