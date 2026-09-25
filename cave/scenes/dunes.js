/* Moonsand Dunes · a desert under a full moon. Water from Petalfall Grove spills out of the sandstone overhang into an
   oasis; a sinkhole in the dunes drops down to Cinder Deep. */
'use strict';
SCENES.dunes = E => {
const { p, light, spawn, sparkle, ring, sr, srnd, line, dot, rect } = E;

/* ---------- shape of the place ---------- */
const FX = WAYS.dunes[1], SX = WAYS.deep[1], SURF = 191, PL = 66, PR = 128, PC = (PL + PR) / 2;
const G = profile([[0, 190], [58, 191], [64, 193], [PL, 194], [PR, 194], [140, 188], [170, 172], [200, 163], [220, 175], [SX, 185], [248, 187], [272, 179], [300, 169], [W, 174]]);
for (let x = 0; x < W; x++) G[x] = Math.round(G[x] + (x < PL - 3 || x > PR + 3 ? 1.5 * (fbm(x * .08, 3) - .5) : 0));
const bed = x => SURF + 1 + 16 * Math.sqrt(Math.max(0, 1 - ((x - PC) / 32) ** 2));
const pool = (x, y) => x >= PL - 1 && x <= PR + 1 && y >= SURF && y < bed(x);
const cliffX = y => 50 + 12 * fbm(y * .035, 3) + (y > 150 ? (y - 150) * .12 : 0);
const OH = x => 22 - Math.max(0, x - 92) * .9 + 5 * fbm(x * .1, 2);
const slot = (x, y) => Math.abs(x - FX) <= 2 && y < OH(FX) + 2;
const cliff = (x, y) => (x < cliffX(y) || (x < 118 && y < OH(x))) && !slot(x, y);
let opened = false;
const shaft = (x, y) => { const s = G[SX]; if (y < s - 3) return false; const w = opened ? 3 + Math.max(0, 6 - (y - s)) * .9 : (y - s < 3 ? 1.5 - (y - s) * .3 : .6); return Math.abs(x - SX - (fbm(y * .2, 4) - .5) * 2) < w; };
const solid = (x, y) => (cliff(x, y) || (y >= G[x] && !pool(x, y))) && !shaft(x, y);
const T = terrain();
E.isSolid = (x, y) => T.at(x, y) || y >= H;
E.isWet = (x, y) => pool(Math.round(x), Math.round(y));

/* ---------- painted background ---------- */
const SKY = ['#060614', '#0a0a20', '#0e0e2a', '#141436', '#1a1a42', '#22204c', '#2a2656', '#342c5e'];
const D1 = new Float32Array(W), D2 = new Float32Array(W);
for (let x = 0; x < W; x++) { D1[x] = 150 + 10 * Math.sin(x * .021 + 1) + 8 * fbm(x * .03, 5); D2[x] = 168 + 9 * Math.sin(x * .03 + 4) + 6 * fbm(x * .04, 8); }
const MOON = { x: 252, y: 50, r: 15 };
const bg = mk(W, H);
function paintBG() {
  T.fill(solid);
  const open = (x, y) => x < 0 || x >= W || y < 0 || y >= H || !T.m[y * W + x];
  paint((x, y) => {
    const n = hash(x, y);
    if (T.m[y * W + x]) {
      if (cliff(x, y)) {
        const edge = open(x + 1, y) || open(x, y + 1), top = open(x, y - 1);
        const st = fbm(x * .015, y * .09 + fbm(x * .05, y * .02) * 1.5), shade = clamp((cliffX(y) - x) / 26, 0, 1);
        if (top && y > 5) return '#d8a078';
        if (edge) return n > .5 ? '#c89070' : '#a8705a';
        if (Math.abs(st - .5) < .025) return '#b07a60';
        const v = (st > .5 ? .75 : st > .4 ? .5 : .3) - shade * .35 + (n > .92 ? .1 : 0);
        return band(['#3a2226', '#4a2c2c', '#5a3632', '#6a4238', '#7a4e40', '#8a5a48', '#9a6650'], v, x, y);
      }
      const d = y - G[x], face = G[Math.min(W - 1, x + 2)] - G[Math.max(0, x - 2)];
      if (x >= PL - 4 && x <= PR + 4 && d < 3 && open(x, y - 1)) return '#8a7060';
      if (d === 0) return face > 0 ? (n > .5 ? '#f0d8b0' : '#e0c49c') : face < -3 ? '#a88870' : '#d0b08c';
      const rip = Math.sin(x * .55 + y * 1.3 + fbm(x * .05, y * .05) * 6) > .75;
      const v = 1 - d / 46 + (face > 0 ? .12 : -.08) + (rip ? -.1 : 0);
      return band(['#2e2238', '#3a2c40', '#4a3848', '#5a4652', '#6e5660', '#8a6e6a', '#a88874', '#c8a482'], v, x, y);
    }
    if (shaft(x, y)) return band(['#0a0608', '#1a0e0c', '#3a1a10', '#6a2a14'], (y - G[SX]) / (H - G[SX]) * (opened ? 1 : .6), x, y);
    if (pool(x, y)) return band(['#0a1230', '#0e1a3a', '#142450', '#1a3066', '#223c7a'], 1 - (y - SURF) / 16, x, y);
    if (slot(x, y)) return '#1a1020';
    if (y >= D2[x]) { const d = y - D2[x]; return d < 1 ? '#9a8090' : band(['#3a2e44', '#44364c', '#4e3e54'], .9 - d / 30, x, y); }
    if (y >= D1[x]) { const d = y - D1[x]; return d < 1 ? '#6a5a78' : band(['#2a2240', '#302648', '#362a4e'], .9 - d / 30, x, y); }
    const md = Math.hypot(x - MOON.x, y - MOON.y);
    if (md <= MOON.r) { const c = fbm(x * .3, y * .3); return md > MOON.r - 1 ? '#f8e8c8' : c > .62 ? '#e0cca8' : c > .56 ? '#ecdcbc' : '#fff4dc'; }
    const s = starAt(x, y, .991); if (s && md > MOON.r + 10) return s > 1 ? '#ffffff' : '#9a98d0';
    return band(SKY, y / 165 + (fbm(x * .015, y * .04) - .5) * .1 - Math.max(0, 1 - md / 90) * .25, x, y);
  }, bg);
}
paintBG();

/* ---------- palms, cacti, reeds (static, painted once on top) ---------- */
function palm(b, x0, h, lean, seed) {
  const rnd = seeded(seed); let x = x0, y = G[x0] - 1;
  for (let i = 0; i < h; i++) { x = x0 + Math.round(lean * (i / h) ** 2); y = G[x0] - 1 - i; b.fillStyle = i % 3 === 0 ? '#2e2018' : '#4a3428'; b.fillRect(x, y, 2, 1); }
  for (let f = 0; f < 7; f++) {
    const a = -Math.PI / 2 + (f / 6 - .5) * 3.4 + (rnd() - .5) * .3; let fx = x + 1, fy = y, ang = a;
    for (let k = 0; k < 13; k++) { fx += Math.cos(ang); fy += Math.sin(ang); ang += (Math.cos(ang) > 0 ? 1 : -1) * .1; b.fillStyle = k > 9 ? '#4a8a58' : '#2a5a3a'; b.fillRect(Math.round(fx), Math.round(fy), 1, 1); if (k % 2) { b.fillStyle = '#1e4430'; b.fillRect(Math.round(fx), Math.round(fy) + 1, 1, 1); } }
  }
  b.fillStyle = '#6a4a2a'; b.fillRect(x, y + 1, 1, 1); b.fillRect(x + 1, y + 2, 1, 1);
}
function saguaro(b, x, h) {
  const gy = G[x] - 1;
  const col = (xx, y0, y1) => { for (let y = y0; y >= y1; y--) { b.fillStyle = '#3a6a4a'; b.fillRect(xx, y, 3, 1); b.fillStyle = '#5a8a5a'; b.fillRect(xx, y, 1, 1); b.fillStyle = '#244a34'; b.fillRect(xx + 2, y, 1, 1); } b.fillStyle = '#5a8a5a'; b.fillRect(xx + 1, y1 - 1, 1, 1); };
  col(x, gy, gy - h);
  col(x - 4, gy - h * .35, gy - h * .75); b.fillStyle = '#3a6a4a'; b.fillRect(x - 3, gy - Math.round(h * .35), 3, 2);
  col(x + 4, gy - h * .5, gy - h * .85); b.fillStyle = '#3a6a4a'; b.fillRect(x + 3, gy - Math.round(h * .5), 2, 2);
}
{
  const b = bg.getContext('2d');
  palm(b, 60, 44, 8, 1); palm(b, 140, 36, -6, 2);
  saguaro(b, 172, 26); saguaro(b, 288, 30);
  for (const x of [68, 72, 124, 127, 131]) for (let i = 0; i < 6 + (x % 3); i++) { b.fillStyle = i > 4 ? '#6a8a4a' : '#3a5a3a'; b.fillRect(x + (i > 3 ? (x % 2 ? 1 : -1) : 0), G[x] - 1 - i, 1, 1); }
}
const FLOWERS = [[172, 26, 0], [168, 17, -4], [292, 25, 4], [289, 30, 0]].map(([x, h, dx]) => ({ x: x + dx + 1, y: G[x] - 2 - h - 1, ph: sr(0, TAU) }));

/* ---------- waterfall + oasis ---------- */
const falls = [], ripples = [];
const ripple = (x, s = 1) => ripples.push({ x, r: 0, t: 0, life: 1.4 * s, s });
const poolPath = new Path2D(); for (let x = PL - 1; x <= PR + 1; x++) poolPath.rect(x, SURF, 1, Math.max(0, bed(x) - SURF));
const FTOP = Math.round(OH(FX)) + 1;
function updWater(dt) {
  if (R() < dt * 45) falls.push({ x: FX + rr(-1.5, 1.5), y: FTOP, v: rr(10, 30), c: pick(['#c8e8ff', '#8ab8e8', '#e0f4ff', '#6a98d0']) });
  for (let i = falls.length - 1; i >= 0; i--) { const f = falls[i]; f.v += 180 * dt; f.y += f.v * dt; if (f.y >= SURF) { falls.splice(i, 1); if (R() < .15) E.splash(f.x, SURF - 1, 1, '#c8e8ff', '#8ac8ff'); } }
  if (R() < dt * 1.5) ripple(FX + rr(-2, 2), .8);
  for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; r.r += dt * 12 * r.s; if (r.t > r.life) ripples.splice(i, 1); }
}
function drawWater(t) {
  for (let y = FTOP; y < SURF; y++) { const s = Math.sin(y * .7 - t * 14); dot(FX + (s > .5 ? 1 : 0), y, '#4a78b0'); if (s < -.3) dot(FX - 1, y, '#2a4a80'); }
  for (const f of falls) dot(f.x, f.y, f.c);
  for (let y = FTOP + 6; y < SURF; y += 14) light(FX + .5, y, 6, '#6fa8ff', .1);
  p.save(); p.clip(poolPath);
  for (let k = 0; k < 4; k++) { const w = 7 - k * 1.5, o = Math.round(Math.sin(t * 1.4 + k) * 1.2); p.globalAlpha = .6 - k * .12; rect(112 + o - w / 2, SURF + 2 + k * 2, Math.round(w), 1, '#fff0d0'); }
  p.globalAlpha = 1; p.restore();
  for (let x = PL; x <= PR; x++) { const s = Math.sin(x * .6 + t * 1.6) + Math.sin(x * .21 - t * .9); dot(x, SURF, s > 1.3 ? '#d8e8ff' : s > .4 ? '#6a8ac0' : '#2a4a80'); }
  p.fillStyle = '#b8d0f0';
  for (const r of ripples) { p.globalAlpha = (1 - r.t / r.life) * .8; for (let k = 0; k <= 12; k++) { const an = Math.PI * k / 12, xx = Math.round(r.x + Math.cos(an) * r.r), yy = Math.round(SURF + Math.sin(an) * r.r * .25); if (E.isWet(xx, yy)) p.fillRect(xx, yy, 1, 1); } }
  p.globalAlpha = 1;
  light(FX, SURF - 2, 16, '#6fb0ff', .14);
}

/* ---------- sand in the wind, flowers, the sinkhole ---------- */
function updSand(dt) {
  if (R() < dt * 6) { const x = pick([200, 300, 170, 272]) + rr(-3, 3); spawn({ x, y: G[Math.round(x)] - 1, vx: rr(18, 34), vy: rr(-6, 0), wob: 3, life: rr(.8, 1.6), col: pick(['#e0c49c', '#f0d8b0', '#c8a482']), fin: .05, fout: .6, a: .8 }); }
}
function drawFlowers(t) { for (const f of FLOWERS) { const pu = .5 + .5 * Math.sin(t * .9 + f.ph); dot(f.x, f.y, '#fff8f0'); dot(f.x - 1, f.y, '#e8e0f0'); dot(f.x + 1, f.y, '#e8e0f0'); dot(f.x, f.y - 1, '#e8e0f0'); light(f.x + .5, f.y + .5, 5 + pu * 3, '#f8f0ff', .22 + .16 * pu); } }
let burst = 0, sandT = 0;
const pour = [];
function updWay(dt) {
  burst = Math.max(0, burst - dt * .5);
  sandT -= dt * (1 + E.hot * 3);
  if (sandT <= 0) { sandT = opened ? .02 : rr(.15, .4); const s = G[SX]; pour.push({ x: SX + rr(-1, 1) * (opened ? 3 : .5), y: s - (opened ? 2 : 0), v: rr(5, 15), c: pick(['#e0c49c', '#c8a482', '#f0d8b0', '#a88874']), inward: opened ? 0 : 1 }); }
  for (let i = pour.length - 1; i >= 0; i--) { const q = pour[i]; q.v += 150 * dt; q.y += q.v * dt; if (q.y > (opened ? H + 1 : G[SX] + 6)) pour.splice(i, 1); }
}
function drawWay(t) {
  const s = G[SX], pul = .5 + .5 * Math.sin(t * 2);
  for (const q of pour) dot(q.x, q.y, q.c);
  if (opened) { light(SX, H - 10, 20, '#ff8a4a', .22 + burst * .6); light(SX, s + 8, 8, '#ff9a5a', .1 + burst * .4); return; }
  for (let k = 0; k < 3; k++) { const a = t * 2.4 + k * 2.1, r = 3 - ((t * .8 + k / 3) % 1) * 3; dot(SX + Math.cos(a) * r * 1.4, s - 1 + Math.sin(a) * r * .3, '#f0d8b0'); }
  light(SX + .5, s + 2, 5 + pul * 2 + E.hot * 5, '#ffa060', .3 + .2 * pul + E.hot * .4);
  light(SX + .5, s - 2, 12 + E.hot * 6, '#ffd8a0', .08 + E.hot * .2);
}
function openWay() {
  opened = true; paintBG(); burst = 1;
  for (let i = 0; i < 40; i++) spawn({ x: SX + rr(-8, 8), y: G[SX] - rr(0, 4), vx: rr(-30, 30), vy: rr(-40, -8), ay: 160, life: rr(.6, 1.3), col: pick(['#e0c49c', '#c8a482', '#f0d8b0']), fin: .01, fout: .3 });
  ring(SX, G[SX], 26, '#ffb070', 1.2);
}

/* ---------- FENNEC FOX that digs ---------- */
const fennec = (() => {
  const pal = { F: '#e8c898', f: '#c8a070', e: '#c89078', t: '#3a2a20', k: '#140c08', n: '#2a1a12', w: '#f8e8d0' };
  const rows = ['......e...e.', '......ee.ee.', '.......FFFF.', 't......FkFFn', 'tt.FFFFFFFw.', '.tFFFFFFFf..', '..fFFFFFf...', '..F.F..F.F..', '..f.f..f.f..'];
  const stand = spr(rows, pal);
  const dig = spr(['..e...e.....', '..ee.ee.....', '...FFFF.....', 'tt.FFkFFFF..', '.tFFFFFFFFF.', '..fFFFFFFFnF', '...f.f..FwF.', '...f.f...f..'], pal);
  const X0 = 188;
  const o = { name: 'fennec', caption: 'The fennec digs in a spray of sand', busy: false, tt: 0, x: X0, dir: 1, pose: 'stand', sink: 0, ear: 0 };
  const gy = () => G[Math.round(o.x) + 6];
  o.box = () => [o.x, gy() - 9, 12, 9];
  o.update = (dt) => {
    tick(o, 'ear', 1.5, 4, .2, dt);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < .5) o.pose = 'stand';
    else if (T0 < 2.6) {
      o.pose = 'dig'; o.sink = Math.min(4, (T0 - .5) * 2.2);
      if (R() < dt * 50) spawn({ x: o.x + (o.dir > 0 ? 3 : 9), y: gy() - 2, vx: -o.dir * rr(20, 50), vy: rr(-45, -15), ay: 160, life: rr(.5, 1), col: pick(['#e0c49c', '#f0d8b0', '#c8a482']), fin: .01, fout: .3 });
    } else if (T0 < 3.2) { o.pose = 'stand'; o.sink = Math.max(0, 4 - (T0 - 2.6) * 10); if (!o.shook) { o.shook = true; E.rubble(o.x + 6, gy() - 4, 8, ['#e0c49c', '#f0d8b0'], 3); } }
    else o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.shook = false; };
  o.draw = () => {
    const X = Math.round(o.x), y = gy(), s = o.pose === 'dig' ? dig : stand;
    p.save(); p.beginPath(); p.rect(0, 0, W, y); p.clip();
    E.blit(s, X, y - s.height + Math.round(o.sink), o.dir < 0); p.restore();
    if (o.ear > 0 && o.pose === 'stand') { dot(X + (o.dir > 0 ? 6 : 5), y - 9, '#140c08'); }
    if (o.pose === 'dig') rect(X + 2, y - 1, 9, 1, '#a88874');
  };
  return o;
})();

/* ---------- SCORPION that glows ---------- */
const scorp = (() => {
  const X0 = 262;
  const o = { name: 'scorpion', caption: 'The scorpion raises its tail and glows', busy: false, tt: 0, x: X0, dir: -1, raise: 0, glow: 0, leg: 0 };
  const gy = () => G[Math.round(o.x)] - 1;
  o.box = () => [o.x - 6, gy() - 7, 12, 8];
  o.update = (dt, t) => {
    if (!o.busy) { o.raise = .35 + .1 * Math.sin(t * .8); o.glow = .25 + .1 * Math.sin(t * 1.3); return; }
    o.tt += dt; const T0 = o.tt;
    if (T0 < .8) o.raise = lerp(.35, 1, T0 / .8);
    else if (T0 < 2.4) { o.raise = 1; o.glow = .6 + .4 * Math.sin((T0 - .8) * 8); if (!o.r) { o.r = true; ring(o.x, gy() - 6, 22, '#5affd8', 1.2); } }
    else if (T0 < 3.8) { o.glow = lerp(o.glow, .3, dt * 3); o.raise = lerp(o.raise, .35, dt * 3); o.x += o.dir * 8 * dt; o.leg = Math.floor(T0 * 12) % 2; }
    else { o.busy = false; o.dir = -o.dir; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.r = false; };
  o.draw = t => {
    const X = Math.round(o.x), Y = gy(), d = o.dir, c = mix('#6a8a70', '#9affe8', o.glow), cd = mix('#3a5a48', '#4ad8b8', o.glow);
    const P = (dx, dy, col) => dot(X + dx * d, Y + dy, col);
    for (let i = -2; i <= 2; i++) { P(i, -1, c); P(i, -2, i % 2 ? c : cd); }
    for (const lx of [-2, 0, 2]) P(lx + (o.leg && lx === 0 ? 1 : 0), 0, cd);
    P(3, -2, c); P(4, -3, c); P(5, -3, c); P(5, -2, cd); P(4, -1, c); P(5, -1, c);
    // tail: five segments curling up and over the back
    const segs = 6; let tx = -3, ty = -2, a = Math.PI + .2;
    for (let i = 0; i < segs; i++) { a += (.45 + o.raise * .35); tx += Math.cos(a) * 1.3 * -1; ty += -Math.abs(Math.sin(a)) * 1.2 - (i < 3 ? .3 : 0); P(Math.round(tx), Math.round(ty), i === segs - 1 ? '#e8fff8' : c); }
    light(X, Y - 3, 8 + o.glow * 8, '#3affc8', .12 + o.glow * .45);
  };
  return o;
})();

/* ---------- JERBOA bounding ---------- */
const jerboa = (() => {
  const pal = { W: '#e0c8a0', w: '#b89a78', e: '#d8a890', k: '#140c08', n: '#c88878' };
  const sit = spr(['..ee.', '..eWW', '.WWkn', 'WWWW.', 'wWWw.', '.w.w.'], pal);
  const jump = spr(['...ee.', '..eWW.', '.WWWkn', 'WWWW..', '.w..w.', 'w....w'], pal);
  const X0 = 150;
  const o = { name: 'jerboa', caption: 'The jerboa bounds across the dunes', busy: false, tt: 0, x: X0, dir: 1, air: 0, pts: [] };
  o.box = () => [o.x - 3, G[Math.round(o.x)] - 7 + o.air, 7, 7];
  o.update = (dt) => {
    if (!o.busy) return;
    o.tt += dt; const per = .42, i = Math.floor(o.tt / per), k = (o.tt % per) / per;
    if (i >= o.pts.length - 1) { o.x = X0; o.air = 0; o.busy = false; o.dir = 1; return; }
    const a = o.pts[i], b = o.pts[i + 1]; o.dir = b >= a ? 1 : -1; o.x = lerp(a, b, k); o.air = -hop(k) * 14;
    if (k < .08 && !o['s' + i]) { o['s' + i] = 1; E.rubble(o.x, G[Math.round(o.x)] - 1, 3, ['#e0c49c', '#c8a482'], 1); }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.pts = [X0, 166, 184, 204, 222, 206, 186, 166, X0]; for (let i = 0; i < 10; i++) delete o['s' + i]; };
  o.draw = () => {
    const X = Math.round(o.x), Y = G[X] - 1 + Math.round(o.air), air = o.air < -1, d = o.dir;
    E.blit(air ? jump : sit, X - 2, Y - 5, d < 0);
    // the long tail with its black-and-white tuft
    for (let k = 1; k <= 8; k++) dot(X - 2 * d - k * d + (d < 0 ? 4 : 0) - (d < 0 ? 1 : 0), Y - 2 + Math.round(k * (air ? -.15 : .12)), k > 6 ? (k === 8 ? '#f8f0e8' : '#1a1210') : '#c8a882');
  };
  return o;
})();

/* ---------- SIDEWINDER ---------- */
const snake = (() => {
  const X0 = 300;
  const o = { name: 'sidewinder', caption: 'The sidewinder slithers sideways', busy: false, tt: 0, x: X0, dir: -1, ph: 0, tracks: [] };
  o.box = () => [o.x - 6, G[Math.round(o.x)] - 5, 12, 6];
  o.update = (dt) => {
    for (let i = o.tracks.length - 1; i >= 0; i--) { o.tracks[i].a -= dt / 14; if (o.tracks[i].a <= 0) o.tracks.splice(i, 1); }
    if (!o.busy) { o.ph += dt * .8; return; }
    o.tt += dt; o.ph += dt * 7;
    const k = o.tt / 3.2; o.x = lerp(o.sx, o.sx + o.dir * 34, smooth(Math.min(1, k)));
    if (Math.floor(o.ph / Math.PI) !== o.lp) { o.lp = Math.floor(o.ph / Math.PI); const bx = Math.round(o.x); for (let j = -3; j <= 2; j++) o.tracks.push({ x: bx + j, y: G[bx + j] - 1 + (j === -3 || j === 2 ? 0 : 0), a: .8 }); }
    if (k >= 1.15) { o.busy = false; o.dir = -o.dir; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.sx = o.x; o.lp = -1; };
  o.draw = () => {
    for (const q of o.tracks) { p.globalAlpha = q.a * .6; dot(q.x, q.y, '#7a6258'); } p.globalAlpha = 1;
    const X = Math.round(o.x);
    for (let i = 0; i < 14; i++) {
      const u = i / 13, x = X + (u - .5) * 12 * o.dir, lift = Math.max(0, Math.sin(o.ph - u * 5)) * (o.busy ? 2.5 : .6), y = G[Math.round(x)] - 1 - Math.round(lift);
      dot(x, y, i === 0 ? '#d8c098' : i % 3 === 0 ? '#6a5040' : '#b89a78');
      if (i === 0) { dot(x + o.dir, y, '#c8b088'); dot(x, y - 1, '#140c08'); }
    }
  };
  return o;
})();

/* ---------- GECKO on the cliff ---------- */
const gecko = (() => {
  const pal = { G: '#9ab870', g: '#6a8a50', e: '#f0e070', k: '#140c08' };
  const body = spr(['.e.e.', '.GGG.', 'g.G.g', '..G..', '.GGG.', 'g.G.g', '..G..', '..g..', '...g.'], pal);
  const Y0 = 128;
  const o = { name: 'gecko', caption: 'The gecko licks its own eyeball', busy: false, tt: 0, y: Y0, lick: 0, wag: 0 };
  const cx = y => Math.round(cliffX(y)) + 1;
  o.box = () => [cx(o.y) - 1, o.y - 1, 7, 10];
  o.update = (dt, t) => {
    o.wag = Math.sin(t * 2) > .7 ? 1 : 0;
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    o.lick = T0 > .4 && T0 < 1.5 ? Math.floor((T0 - .4) * 6) % 3 + 1 : 0;
    if (T0 > 1.8 && T0 < 2.8) o.y = Y0 - (T0 - 1.8) * 14; else if (T0 >= 2.8 && T0 < 3.8) o.y = Y0 - 14 + (T0 - 2.8) * 14;
    if (T0 > 4) { o.y = Y0; o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; };
  o.draw = t => {
    const X = cx(o.y), Y = Math.round(o.y), step = o.busy && o.tt > 1.8 && o.tt < 3.8 && Math.floor(t * 10) % 2;
    p.drawImage(body, X, Y);
    if (step) { dot(X, Y + 2, '#9ab870'); dot(X + 4, Y + 5, '#9ab870'); }
    dot(X + 3 + o.wag, Y + 8, '#6a8a50');
    if (o.lick) { const tip = o.lick === 1 ? [2, -1] : o.lick === 2 ? [1, -1] : [3, -1]; dot(X + 2, Y, '#e8687a'); dot(X + tip[0], Y + tip[1], '#ff8898'); }
    light(X + 1.5, Y + .5, 3, '#f0e070', .25); light(X + 3.5, Y + .5, 3, '#f0e070', .25);
  };
  return o;
})();

/* ---------- render ---------- */
const critters = [fennec, scorp, jerboa, snake, gecko];
function ambient(dt, t) { updWater(dt); updSand(dt); updWay(dt); }
return {
  critters,
  entry: { x: FX, y: 0 },
  exit: { x: SX, y: G[SX] + 2, r: 14 },
  ambient,
  vig: vignette(.55, .12, '4,3,12'),
  update(dt, t) { ambient(dt, t); for (const c of critters) c.update(dt, t); },
  draw(t) {
    p.globalAlpha = 1; p.drawImage(bg, 0, 0);
    light(MOON.x, MOON.y, 26, '#fff0d0', .35); light(MOON.x, MOON.y, 70, '#b0a0ff', .06);
    drawFlowers(t); drawWater(t); drawWay(t);
    snake.draw(t); jerboa.draw(t); scorp.draw(t); fennec.draw(t); gecko.draw(t);
    E.drawParts();
  },
  openExit: openWay
};
};
