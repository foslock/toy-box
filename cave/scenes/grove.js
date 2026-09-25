/* Petalfall Grove · cherry trees and bamboo round a koi pond at dusk. The ice tunnel from Aurora Barrens opens in the
   rocks at the right; a crack beneath the pond lets water down to Moonsand Dunes. */
'use strict';
SCENES.grove = E => {
const { p, light, spawn, sparkle, ring, sr, srnd, line, dot, rect } = E;

/* ---------- shape of the place ---------- */
const TY = WAYS.grove[1], FX = WAYS.dunes[1];
const SURF = 186, PL = 60, PR = 150, PC = (PL + PR) / 2;
const G = profile([[0, 178], [36, 176], [56, 183], [PL, 184], [PR, 184], [170, 180], [200, 178], [240, 180], [276, 181], [W, 181]]);
for (let x = 0; x < W; x++) { if (x < PL - 4 || x > PR + 4) G[x] += 2 * (fbm(x * .15, 2) - .5); G[x] = Math.round(G[x]); }
const bed = x => SURF + 1 + 27 * Math.sqrt(Math.max(0, 1 - ((x - PC) / 47) ** 2));
const pond = (x, y) => x >= PL - 2 && x <= PR + 2 && y >= SURF && y < bed(x);
const rockX = y => 272 + (150 - Math.min(y, 150)) * 1.2 + 6 * fbm(y * .08, 4) - (y > 150 ? (y - 150) * .15 : 0);
const rock = (x, y) => y >= 138 + (W - x) * .35 && x > rockX(y) && y < G[x] + 2;
const tunnel = (x, y) => x > 284 && y >= TY - 11 + Math.max(0, (292 - x)) * .5 && y <= TY + 10;
let opened = false;
const chan = (x, y) => y >= bed(FX) - 2 && (opened ? Math.abs(x - FX - Math.round(1.5 * (fbm(y * .15, 3) - .5))) <= 3 : Math.abs(x - FX - Math.round(2.5 * (fbm(y * .3, 5) - .5))) < 1);
const solid = (x, y) => ((y >= G[x] && !pond(x, y)) || rock(x, y)) && !tunnel(x, y) && !chan(x, y);
const T = terrain();
E.isSolid = (x, y) => T.at(x, y) || y >= H;
E.isWet = (x, y) => pond(Math.round(x), Math.round(y));

/* ---------- painted background ---------- */
const TREES = [
  { base: [38, 177], pts: [[38, 177], [42, 150], [40, 128], [47, 104], [50, 88]], br: [[[44, 116], [20, 96]], [[46, 108], [78, 96]], [[50, 92], [56, 72]], [[42, 124], [28, 112]]], blobs: [[18, 86, 24, 15], [50, 66, 28, 17], [82, 84, 22, 14], [34, 100, 20, 10], [66, 98, 16, 8], [8, 100, 12, 8]] },
  { base: [236, 179], pts: [[236, 179], [232, 152], [228, 128], [230, 106], [236, 90]], br: [[[229, 116], [196, 113]], [[231, 104], [262, 92]], [[233, 96], [224, 74]], [[232, 130], [252, 118]]], blobs: [[208, 84, 24, 14], [238, 68, 28, 17], [266, 88, 22, 14], [192, 98, 12, 7], [250, 102, 16, 8], [284, 100, 12, 7]] }
];
const blossom = (x, y) => { let v = 0; for (const t of TREES) for (const [bx, by, rx, ry] of t.blobs) v = Math.max(v, 1 - Math.hypot((x - bx) / rx, (y - by) / ry)); return v + (fbm(x * .18, y * .18) - .5) * .5; };
const distSeg = (x, y, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - ax - dx * k, y - ay - dy * k); };
const wood = (x, y) => { for (const t of TREES) { for (let i = 0; i < t.pts.length - 1; i++) if (distSeg(x, y, t.pts[i], t.pts[i + 1]) < 4.2 - i * .7 + (y > 168 ? (y - 168) * .35 : 0)) return true; for (const [a, b] of t.br) if (distSeg(x, y, a, b) < 1.4 + (1 - Math.hypot(x - a[0], y - a[1]) / 30) * .8) return true; } return false; };
const HILLS = [new Float32Array(W), new Float32Array(W)];
for (let x = 0; x < W; x++) { HILLS[0][x] = 128 - 26 * fbm(x * .015, 12) ** 1.4; HILLS[1][x] = 152 - 20 * fbm(x * .022 + 9, 3); }
const SKY = ['#120a26', '#1c0e32', '#28123c', '#361646', '#461a4e', '#581e56', '#6c245c', '#82305e', '#98405e', '#aa545e'];
const bg = mk(W, H);
function paintBG() {
  T.fill(solid);
  const open = (x, y) => x < 0 || x >= W || y < 0 || y >= H || !T.m[y * W + x];
  paint((x, y) => {
    const n = hash(x, y);
    if (T.m[y * W + x]) {
      if (rock(x, y) && y < G[x]) { if (open(x, y - 1)) return n > .5 ? '#6aa060' : '#4a8048'; if (open(x - 1, y) || open(x, y + 1)) return '#4a3c5a'; return fbm(x * .2, y * .2) > .5 ? '#2e2440' : '#241c34'; }
      const d = y - G[x];
      if (x >= PL - 4 && x <= PR + 4 && open(x, y - 1) && y >= SURF - 3) return n > .5 ? '#7a6a80' : '#5a4c62';
      if (d === 0) return (x < 100 || (x > 186 && x < 290)) && n > .82 ? '#f8b8d0' : n > .7 ? '#9ac870' : n > .3 ? '#6aa058' : '#4a8048';
      if (d === 1) return '#3a6040';
      if (open(x - 1, y) || open(x + 1, y) || open(x, y - 1)) return n > .5 ? '#5a4c62' : '#4a3e54';
      if (n > .985) return '#4a3e54';
      if (Math.abs(fbm(x * .1, y * .25 + 5) - .5) < .02) return '#2e2030';
      return y > 220 ? '#120c18' : fbm(x * .1, y * .1) > .5 ? '#1e1626' : '#1a1220';
    }
    if (chan(x, y) && y >= bed(FX) - 2) return opened ? band(['#1a2a4a', '#2a4a6a', '#3a6a8a'], .5 + .5 * Math.sin(y * .5), x, y) : '#3a5a7a';
    if (pond(x, y)) return band(['#0e1428', '#141c38', '#1a2848', '#223458', '#2a4068'], 1 - (y - SURF) / 26, x, y);
    if (tunnel(x, y)) return band(['#1a2440', '#243258', '#304470', '#4a6a98'], (x - 284) / 36, x, y);
    const bl = blossom(x, y);
    if (bl > .2) {
      const lit = blossom(x - 2, y - 2) < .2;
      if (lit) return n > .4 ? '#ffd8e8' : '#f8b8d0';
      return bl > .62 ? (n > .6 ? '#e890b8' : '#d878a8') : bl > .45 ? (n > .5 ? '#c8689a' : '#b05888') : (n > .5 ? '#8a4070' : '#6a3060');
    }
    if (wood(x, y)) return n > .6 ? '#4a3038' : '#2e1c24';
    if (y >= HILLS[1][x]) return y - HILLS[1][x] < 1 ? '#5a3a64' : band(['#1e1430', '#241636', '#2a1a3c', '#301e42'], .95 - (y - HILLS[1][x]) / 40 + (fbm(x * .05, y * .05) - .5) * .3, x, y);
    if (y >= HILLS[0][x]) return y - HILLS[0][x] < 1 ? '#9a6090' : band(['#3a2250', '#422656', '#4a2a5c', '#542e62'], .95 - (y - HILLS[0][x]) / 30 + (fbm(x * .05, y * .05) - .5) * .3, x, y);
    const s = starAt(x, y, .992); if (s && y < 90) return s > 1 ? '#fff0f8' : '#c0a0d8';
    return band(SKY, y / 150 + (fbm(x * .015, y * .04) - .5) * .1, x, y);
  }, bg);
  // crescent moon
  const b = bg.getContext('2d');
  for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) { const d = Math.hypot(i, j), d2 = Math.hypot(i - 3, j - 2); if (d <= 6.5 && d2 > 5.5) { b.fillStyle = d > 5.6 || d2 < 6.4 ? '#f0d8b0' : '#fff4dc'; b.fillRect(58 + i, 30 + j, 1, 1); } }
}
paintBG();

/* ---------- bamboo ---------- */
const BAM = [[160, 34, 11], [167, 22, 12], [175, 44, 10], [183, 28, 12], [191, 52, 9], [198, 38, 11]].map(([x, top, seg], i) => ({ x, top, seg, ph: sr(0, TAU), w: i % 2 ? 1 : 2, leaves: [] }));
for (const b of BAM) for (let y = b.top + 6; y < 150; y += Math.round(sr(14, 26))) b.leaves.push({ y, s: srnd() < .5 ? -1 : 1, l: Math.round(sr(3, 6)) });
function drawBamboo(t) {
  for (const b of BAM) {
    const base = G[b.x], len = base - b.top, sw = Math.sin(t * .7 + b.ph) * 2.2;
    const off = y => Math.round(sw * ((base - y) / len) ** 2);
    for (let y = base; y > b.top; y -= b.seg) {
      const y1 = Math.max(b.top, y - b.seg), o = off(y);
      rect(b.x + o, y1, b.w, y - y1, '#3a7a4a'); if (b.w > 1) rect(b.x + o, y1, 1, y - y1, '#5a9a5a');
      rect(b.x + o - (b.w > 1 ? 0 : 0), y1, b.w + 1, 1, '#8ac070');
    }
    for (const l of b.leaves) { const o = off(l.y); for (let k = 1; k <= l.l; k++) dot(b.x + o + l.s * (k + (b.w - 1) * (l.s > 0)), l.y + Math.round(k * .5), k === l.l ? '#6aa058' : '#4a8a4a'); }
  }
}

/* ---------- petals ---------- */
const petals = [];
function updPetals(dt, t) {
  if (R() < dt * 3.2) { const tr = pick(TREES), [bx, by, rx, ry] = pick(tr.blobs); petals.push({ x: bx + rr(-rx, rx) * .8, y: by + rr(-ry, ry) * .6, vx: rr(2, 7), vy: rr(5, 9), ph: rr(0, TAU), st: 0, t: 0, c: pick(['#ffd8e8', '#f8b8d0', '#e890b8']) }); }
  for (let i = petals.length - 1; i >= 0; i--) {
    const q = petals[i]; q.t += dt;
    if (q.st === 0) {
      q.x += (q.vx + Math.sin(t * 1.3 + q.ph) * 8) * dt; q.y += (q.vy + Math.sin(t * 2 + q.ph) * 3) * dt;
      if (q.y >= SURF - .5 && q.x > PL && q.x < PR) { q.st = 1; q.y = SURF - 1; q.t = 0; ripple(q.x, .4); }
      else if (T.at(q.x, q.y + 1)) { q.st = 2; q.t = 0; }
      if (q.x > W + 2) petals.splice(i, 1);
    } else { if (q.st === 1) q.x += Math.sin(t * .3 + q.ph) * 1.2 * dt; if (q.t > (q.st === 1 ? 14 : 6)) petals.splice(i, 1); }
  }
}
function drawPetals() { for (const q of petals) { p.globalAlpha = q.st ? Math.min(1, ((q.st === 1 ? 14 : 6) - q.t) / 2) : 1; dot(q.x, q.y, q.c); } p.globalAlpha = 1; }

/* ---------- pond: water, lotus, ripples ---------- */
const ripples = [];
const ripple = (x, s = 1) => ripples.push({ x, r: 0, t: 0, life: 1.6 * s, s });
const LOTUS = [[74, 0], [88, 1], [118, 0], [131, 1], [104, 2]].map(([x, k]) => ({ x, k, ph: sr(0, TAU) }));
const pondPath = new Path2D(); for (let x = PL - 2; x <= PR + 2; x++) pondPath.rect(x, SURF, 1, Math.max(0, bed(x) - SURF));
function drawWater(t) {
  p.save(); p.clip(pondPath);
  p.globalAlpha = .55; p.fillStyle = '#1a2a50'; p.fillRect(PL - 2, SURF, PR - PL + 5, 30); p.globalAlpha = 1;
  for (let i = 0; i < 12; i++) { const x = PL + ((i * 29 + t * 4) % (PR - PL)), y = SURF + 4 + (i * 7) % 20; if (Math.sin(t * 1.4 + i) > .6) dot(x, y, '#3a5a8a'); }
  p.restore();
  for (let x = PL - 1; x <= PR + 1; x++) { if (!E.isWet(x, SURF)) continue; const s = Math.sin(x * .6 + t * 1.6) + Math.sin(x * .21 - t * .9); dot(x, SURF, s > 1.3 ? '#e0c8f0' : s > .4 ? '#7a78b8' : '#3a4a80'); }
  // moon on the water
  for (let k = 0; k < 4; k++) { const w = 5 - k, y = SURF + 2 + k * 2, o = Math.round(Math.sin(t * 1.5 + k) * 1.2); p.globalAlpha = .5 - k * .1; rect(64 + o - w / 2, y, w, 1, '#fff0d8'); } p.globalAlpha = 1;
  p.fillStyle = '#c8d0f0';
  for (const r of ripples) { p.globalAlpha = (1 - r.t / r.life) * .8; for (let k = 0; k <= 12; k++) { const an = Math.PI * k / 12, xx = Math.round(r.x + Math.cos(an) * r.r), yy = Math.round(SURF + Math.sin(an) * r.r * .25); if (E.isWet(xx, yy)) p.fillRect(xx, yy, 1, 1); } }
  p.globalAlpha = 1;
  for (const l of LOTUS) {
    const pu = .5 + .5 * Math.sin(t * 1.1 + l.ph), bob = Math.sin(t * 1.3 + l.ph) > .7 ? 1 : 0, y = SURF - 1 + bob;
    rect(l.x - 3, y + 1, 7, 1, '#2a6a44'); rect(l.x - 2, y + 1, 2, 1, '#3a8a54');
    if (l.k === 2) continue;
    const c = l.k ? '#fff0f8' : '#ff9ac8';
    dot(l.x - 1, y, c); dot(l.x + 1, y, c); dot(l.x, y - 1, c); dot(l.x, y, '#ffe890');
    light(l.x + .5, y, 6 + pu * 3, l.k ? '#fff0ff' : '#ff7ab8', .28 + .18 * pu);
  }
}

/* ---------- the crack under the pond ---------- */
let burst = 0, dripT = 0, glintT = 0;
const falls = [];
function updWay(dt) {
  burst = Math.max(0, burst - dt * .5);
  const top = bed(FX);
  if (!opened) {
    dripT -= dt * (1 + E.hot * 2); if (dripT <= 0) { dripT = rr(.4, 1); spawn({ x: FX + rr(-1, 1), y: top + 1, vy: rr(10, 20), ay: 90, life: 1.5, col: '#bfe0ff', gc: '#7fb8ff', glow: 2, ga: .5, fin: .05, fout: .2 }); }
  } else if (R() < dt * 50) falls.push({ x: FX + rr(-3, 3), y: top - 1, v: rr(40, 70), c: pick(['#c8e8ff', '#8ab8e8', '#e0f4ff']) });
  for (let i = falls.length - 1; i >= 0; i--) { const f = falls[i]; f.v += 200 * dt; f.y += f.v * dt; if (f.y > H + 2) falls.splice(i, 1); }
  glintT -= dt; if (glintT <= 0 && !opened) { glintT = rr(.6, 1.4); sparkle(FX + rr(-2, 2), rr(top + 4, H - 4), 1, '#e0f0ff', '#8fc8ff'); }
}
function drawWay(t) {
  const top = bed(FX), pul = .5 + .5 * Math.sin(t * 2);
  if (opened) {
    for (const f of falls) { dot(f.x, f.y, f.c); dot(f.x, f.y - 1, f.c); }
    for (let y = Math.ceil(top); y < H; y += 6) light(FX + .5, y, 7, '#6fb0ff', .12 + burst * .3);
    return;
  }
  light(FX + .5, top + 6, 6 + pul * 2 + E.hot * 5, '#9fd0ff', .3 + .2 * pul + E.hot * .4);
  light(FX + .5, (top + H) / 2, 10 + E.hot * 6, '#5a8aff', .12 + E.hot * .2);
}
function openWay() {
  opened = true; paintBG(); burst = 1;
  const top = bed(FX);
  E.rubble(FX, top + 4, 24, ['#5a4c62', '#4a3e54', '#2e2030', '#1e1626'], 5);
  for (let i = 0; i < 12; i++) spawn({ x: FX + rr(-4, 4), y: rr(top, H), vx: rr(-10, 10), vy: rr(10, 30), drag: 1, life: rr(.8, 1.5), col: '#c8e8ff', gc: '#7fb8ff', glow: 2, ga: .4, fin: .02, fout: .5 });
  ring(FX, top + 4, 22, '#8fc8ff', 1.2); ripple(FX, 1.4); ripple(FX - 6, 1);
}

/* ---------- RED PANDA on the cherry branch ---------- */
const panda = (() => {
  const pal = { R: '#c0542a', r: '#8a3a1e', w: '#f0e0d0', k: '#140a08', n: '#1a0e0a', d: '#3a1a12', T: '#a8481f', t: '#e8b090' };
  const lie = spr(['.w.w......', 'wRRw......', 'RwkRRRRRR.', 'wRnRRRRRRR', '.ddRRRRdd.'], pal);
  const tall = spr(['.w..w.', '.RRRR.', '.wkRkw', '..RnR.', '.dRRd.', '.dRRd.', '..RR..', '.dRRd.', '.d..d.'], pal);
  const tallUp = spr(['d....d', 'dw..wd', 'dRRRRd', '.wkRkw', '..RnR.', '..RR..', '..RR..', '.dRRd.', '.d..d.'], pal);
  const X = 200, Y = 112;
  const o = { name: 'red panda', caption: 'The red panda stands up tall', busy: false, tt: 0, pose: 'lie', sw: 0 };
  o.box = () => [X - 2, Y - 10, 12, 11];
  o.update = (dt, t) => {
    o.sw = Math.sin(t * 1.2);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    o.pose = T0 < .5 ? 'lie' : T0 < 1.2 ? 'tall' : T0 < 2.6 ? 'up' : T0 < 3.2 ? 'tall' : 'lie';
    if (T0 > 1.3 && !o.pf) { o.pf = true; for (let i = 0; i < 8; i++) petals.push({ x: X + rr(-12, 20), y: Y - rr(8, 20), vx: rr(-6, 6), vy: rr(4, 10), ph: rr(0, TAU), st: 0, t: 0, c: pick(['#ffd8e8', '#f8b8d0']) }); }
    if (T0 > 3.6) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.pf = false; };
  o.draw = t => {
    // ringed tail hanging off the branch
    const tx = o.pose === 'lie' ? X + 8 : X + 5, sw = Math.round(o.sw);
    for (let k = 0; k < 9; k++) dot(tx + (k > 4 ? sw : 0), Y + 1 + k, (k >> 1) % 2 ? '#e8b090' : '#a8481f');
    if (o.pose === 'lie') p.drawImage(lie, X, Y - 4);
    else p.drawImage(o.pose === 'tall' ? tall : tallUp, X + 1, Y - 9);
  };
  return o;
})();

/* ---------- CRANE in the shallows ---------- */
const crane = (() => {
  const pal = { W: '#f4f0f4', w: '#c8c0cc', K: '#1a1418', r: '#e83a3a', y: '#d8c070', g: '#6a6068' };
  const stand = spr(['.r...', 'KKy..', 'K....', 'K....', 'K....', 'WWW..', 'WWWW.', 'WWWWK', 'WWWKK', '.WW..', '..g..', '..g..', '..g..', '..g..'], pal);
  const spread = spr(['......r.....', '.....KKy....', '.....K......', 'W....K.....W', 'WW...K....WW', 'wWW.WWW..WWw', '.wWWWWWWWWw.', '..wWWWWWKw..', '....WWWKK...', '.....WW.....', '.....g.g....', '....g...g...', '...g.....g..', '............'], pal);
  const X = 138;
  const o = { name: 'crane', caption: 'The crane dances', busy: false, tt: 0, pose: 'stand', air: 0, dir: -1, bob: 0 };
  o.box = () => [X - 3, SURF - 14 + o.air, 10, 14];
  o.update = (dt, t) => {
    if (!o.busy) { o.bob = Math.sin(t * .5) > .9 ? 1 : 0; return; }
    o.tt += dt; const T0 = o.tt;
    if (T0 < .6) { o.pose = 'stand'; o.bob = Math.floor(T0 * 6) % 2; }
    else if (T0 < 1.3) { o.pose = 'spread'; o.air = 0; }
    else if (T0 < 1.9) { o.pose = 'spread'; o.air = -hop((T0 - 1.3) / .6) * 9; }
    else if (T0 < 2.3) { o.pose = 'spread'; o.air = 0; if (!o.l1) { o.l1 = true; E.splash(X, SURF - 1, 6, '#e0e8ff', '#aac8ff'); ripple(X, 1); } }
    else if (T0 < 2.8) { o.pose = 'spread'; o.air = -hop((T0 - 2.3) / .5) * 6; o.dir = 1; }
    else if (T0 < 3.2) { o.pose = 'stand'; o.air = 0; if (!o.l2) { o.l2 = true; E.splash(X, SURF - 1, 5, '#e0e8ff', '#aac8ff'); ripple(X, .9); } }
    else { o.dir = -1; o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.l1 = o.l2 = false; };
  o.draw = () => {
    const y = SURF + 1 + Math.round(o.air);
    if (o.pose === 'spread') E.blit(spread, X - 6, y - 14, o.dir > 0);
    else E.blit(stand, X - 2, y - 14 + o.bob, o.dir > 0);
    light(X, y - 8, 10, '#f0f0ff', .06);
  };
  return o;
})();

/* ---------- KOI leaping ---------- */
const koi = (() => {
  const mkK = (c1, c2) => [spr(['..aa...', 'abbbba.', 'aabbbbk', 'abbbba.', '..a....'], { a: c1, b: c2, k: '#140a08' }), spr(['..aa...', '.bbbba.', 'babbbbk', '.bbbba.', '...a...'], { a: c1, b: c2, k: '#140a08' })];
  const fish = [{ s: mkK('#ff7a2a', '#ffb070'), x: 80, y: SURF + 10, vx: 4, vy: 0, tx: 80, ty: 200, tT: 0, dir: 1, ang: 0, st: 'swim' }, { s: mkK('#f0f0f0', '#ff6a3a'), x: 120, y: SURF + 14, vx: -4, vy: 0, tx: 110, ty: 200, tT: 0, dir: -1, ang: 0, st: 'swim' }];
  const ok = (x, y) => E.isWet(x - 4, y) && E.isWet(x + 4, y) && E.isWet(x, y + 3) && y > SURF + 3;
  const pickT = f => { for (let i = 0; i < 30; i++) { const x = rr(PL + 8, PR - 8), y = rr(SURF + 5, SURF + 20); if (ok(x, y)) { f.tx = x; f.ty = y; break; } } f.tT = rr(2, 5); };
  fish.forEach(pickT);
  const o = { name: 'koi', caption: 'The koi leaps through the falling petals', busy: false, tt: 0, f: fish[0] };
  o.box = () => { const f = fish[0]; return [f.x - 4, f.y - 3, 8, 6]; };
  o.update = (dt, t) => {
    for (const f of fish) {
      const py = f.y;
      if (f.st === 'swim' || f.st === 'wind') {
        const fast = f.st === 'wind', acc = fast ? 40 : 6, max = fast ? 26 : 8;
        if (!fast) { f.tT -= dt; if (f.tT <= 0 || Math.hypot(f.tx - f.x, f.ty - f.y) < 2) pickT(f); }
        const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy) || 1;
        f.vx += dx / d * acc * dt; f.vy += dy / d * acc * dt; const k = Math.exp(-(fast ? 1.5 : .8) * dt); f.vx *= k; f.vy *= k;
        const s = Math.hypot(f.vx, f.vy); if (s > max) { f.vx *= max / s; f.vy *= max / s; }
        f.x += f.vx * dt; f.y += f.vy * dt; if (Math.abs(f.vx) > .8) f.dir = Math.sign(f.vx); f.ang = 0;
        if (fast) { o.tt += dt; if (d < 3 || o.tt > 3) { f.st = 'air'; f.dir = f.ldir; f.vx = f.dir * 34; f.vy = -110; o.tt = 0; } }
      } else if (f.st === 'air') {
        f.vy += 200 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.ang = Math.round(Math.atan2(f.vy, Math.abs(f.vx)) / (Math.PI / 4)) * (Math.PI / 4);
        if (py >= SURF && f.y < SURF) { E.splash(f.x, SURF - 1, 7, '#e0e8ff', '#aac8ff'); ripple(f.x, 1); }
        if (f.y < SURF && R() < dt * 20) sparkle(f.x, f.y, 1, '#ffd8e8', '#ff9ac8');
        if (py < SURF && f.y >= SURF && f.vy > 0) { E.splash(f.x, SURF - 1, 10, '#e0e8ff', '#aac8ff'); ripple(f.x, 1.2); ring(f.x, SURF, 16, '#ff9ac8', .8); f.st = 'dive'; o.tt = 0; }
      } else if (f.st === 'dive') {
        o.tt += dt; const k = Math.exp(-6 * dt); f.vx *= k; f.vy *= k; f.x += f.vx * dt; f.y += f.vy * dt; if (!ok(f.x, f.y)) f.y -= .5;
        if (o.tt > 1) { f.st = 'swim'; o.busy = false; pickT(f); }
      }
    }
  };
  o.trigger = () => {
    const f = fish[0]; f.ldir = f.x < PC ? 1 : -1; f.tx = f.ldir > 0 ? rr(78, 90) : rr(120, 132); f.ty = SURF + 10; f.st = 'wind'; o.busy = true; o.tt = 0;
    for (let i = 0; i < 10; i++) petals.push({ x: PC + rr(-30, 30), y: rr(120, 160), vx: rr(-4, 6), vy: rr(5, 10), ph: rr(0, TAU), st: 0, t: 0, c: pick(['#ffd8e8', '#f8b8d0', '#e890b8']) });
  };
  const drawF = (f, t, a) => { const s = f.s[f.st === 'air' ? 0 : Math.floor(t * 3 + f.x) % 2]; p.save(); p.globalAlpha = a; p.translate(Math.round(f.x), Math.round(f.y)); if (f.dir < 0) p.scale(-1, 1); if (f.ang) p.rotate(f.ang); p.drawImage(s, -3, -2); p.restore(); };
  o.drawUnder = t => { p.save(); p.clip(pondPath); for (const f of fish) if (f.y >= SURF) drawF(f, t, .75); p.restore(); };
  o.drawAbove = t => { for (const f of fish) if (f.y < SURF) { drawF(f, t, 1); light(f.x, f.y, 7, '#ffb070', .3); } };
  return o;
})();

/* ---------- MANDARIN DUCK ---------- */
const duck = (() => {
  const pal = { o: '#e8782a', w: '#f4f0e8', p: '#6a3a8a', g: '#2a6a5a', b: '#8a5a3a', k: '#140a08', r: '#e84a3a', c: '#c8a070' };
  const swim = spr(['....ggg.', '...wwwkr', '...owwo.', '.b.pp...', 'bbooppp.', '.bbbbbb.'], pal);
  const tip = spr(['..b.....', '.bb.....', 'bbooo...', '.bbppp..', '...ppppg'], pal);
  const o = { name: 'mandarin duck', caption: 'The mandarin duck dabbles bottoms-up', busy: false, tt: 0, x: 96, dir: 1, pose: 'swim', wig: 0 };
  o.box = () => [o.x - 4, SURF - 7, 9, 7];
  o.update = (dt, t) => {
    if (!o.busy) { o.x += o.dir * 3 * dt; if (o.x > 124) o.dir = -1; if (o.x < 72) o.dir = 1; if (R() < dt * .8) ripple(o.x - o.dir * 3, .5); return; }
    o.tt += dt; const T0 = o.tt;
    if (T0 < .3) o.pose = 'swim';
    else if (T0 < 2.2) { if (o.pose !== 'tip') { ripple(o.x, .9); E.splash(o.x + o.dir * 2, SURF - 1, 3, '#e0e8ff', '#aac8ff'); } o.pose = 'tip'; o.wig = Math.floor(T0 * 8) % 2; }
    else if (T0 < 2.8) { if (o.pose !== 'swim') { ripple(o.x, 1); } o.pose = 'swim'; if (T0 > 2.4 && !o.shook) { o.shook = true; for (let i = 0; i < 8; i++) spawn({ x: o.x + rr(-3, 3), y: SURF - 5, vx: rr(-24, 24), vy: rr(-30, -10), ay: 160, life: rr(.4, .7), col: '#c8e0ff', gc: '#8fc8ff', glow: 1.5, ga: .4, kind: 2, fin: .01, fout: .2 }); } }
    else o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.shook = false; };
  o.draw = () => {
    const X = Math.round(o.x);
    if (o.pose === 'tip') { E.blit(tip, X - 4 + o.wig, SURF - 4, o.dir < 0); return; }
    E.blit(swim, X - 4, SURF - 5, o.dir < 0);
  };
  return o;
})();

/* ---------- RABBIT that sits up to look at the moon ---------- */
const rabbit = (() => {
  const pal = { W: '#e8e0e8', w: '#b0a8b8', k: '#1a1418', n: '#e8a0b0', e: '#d8a0b8' };
  const sit = spr(['....ee.', '....ee.', '...WWW.', '..WWWkn', '.WWWWW.', 'WWWWWW.', '.ww.ww.'], pal);
  const up = spr(['..e.e', '..e.e', '..WWW', '..WkW', '..WnW', '.WWW.', '.WWW.', 'WWWW.', '.ww..'], pal);
  const X0 = 214;
  const o = { name: 'rabbit', caption: 'The rabbit sits up to gaze at the moon', busy: false, tt: 0, x: X0, dir: -1, pose: 'sit', air: 0, glow: 0 };
  o.box = () => [o.x - 3, G[Math.round(o.x)] - 9, 7, 9];
  o.update = (dt) => {
    o.glow = Math.max(0, o.glow - dt * .4);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < .4) o.pose = 'sit';
    else if (T0 < 2.2) { o.pose = 'up'; if (!o.g) { o.g = true; o.glow = 1; ring(58, 30, 20, '#fff0d8', 1.4); } }
    else if (T0 < 3.9) { o.pose = 'sit'; const k = (T0 - 2.2) / 1.7, h = Math.floor(k * 3), kk = (k * 3) % 1; o.air = -hop(kk) * 5; o.x = X0 + o.dir * 5 * (h + kk) * (o.back ? -1 : 1); }
    else { o.air = 0; o.busy = false; o.back = !o.back; o.x = Math.round(o.x); }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.g = false; o.dir = o.back ? 1 : -1; if (o.back) o.dir = 1; };
  o.draw = () => {
    const X = Math.round(o.x), gy = G[X];
    if (o.pose === 'up') E.blit(up, X - 3, gy - 9, false); else E.blit(sit, X - 3, gy - 7 + Math.round(o.air), o.dir < 0);
  };
  return o;
})();

/* ---------- fireflies (a few, pale) ---------- */
const motes = Array.from({ length: 8 }, () => ({ x: rr(20, 300), y: rr(120, 175), ph: rr(0, TAU), sp: rr(.3, .6) }));
function drawMotes(t) {
  for (const m of motes) {
    const x = m.x + Math.sin(t * m.sp + m.ph) * 14, y = m.y + Math.sin(t * m.sp * 1.3 + m.ph * 2) * 8, b = Math.pow(Math.max(0, Math.sin(t * 1.6 + m.ph)), 3);
    dot(x, y, b > .3 ? '#e0fff0' : '#6a9a80'); light(x + .5, y + .5, 3 + 4 * b, '#a8ffd8', .1 + .45 * b);
  }
}

/* ---------- render ---------- */
const critters = [panda, crane, koi, duck, rabbit];
function ambient(dt, t) {
  updPetals(dt, t); updWay(dt);
  for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; r.r += dt * 12 * r.s; if (r.t > r.life) ripples.splice(i, 1); }
}
return {
  critters,
  entry: { x: W - 1, y: TY },
  exit: { x: FX, y: 222, r: 14 },
  ambient,
  vig: vignette(.55, .15, '10,4,16'),
  update(dt, t) { ambient(dt, t); for (const c of critters) c.update(dt, t); },
  draw(t) {
    p.globalAlpha = 1; p.drawImage(bg, 0, 0);
    const mg = .5 + .5 * Math.sin(t * .4);
    light(58, 30, 20, '#ffe8c8', .28 + .04 * mg + rabbit.glow * .4); light(58, 30, 50, '#ff9ac8', .06 + rabbit.glow * .1);
    drawBamboo(t); drawWay(t);
    koi.drawUnder(t); drawWater(t); koi.drawAbove(t);
    panda.draw(t); crane.draw(t); duck.draw(t); rabbit.draw(t);
    drawPetals(); drawMotes(t); E.drawParts();
    light(300, TY, 14, '#9fd8ff', .12);
    for (const tr of TREES) for (const [bx, by, rx] of tr.blobs) light(bx, by, rx * 1.2, '#ff8ac0', .045);
  },
  openExit: openWay
};
};
