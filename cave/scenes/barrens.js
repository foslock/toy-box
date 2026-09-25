/* Aurora Barrens · snowfields under the northern lights. The rope bridge from Duskcrag Peaks lands on a plateau at the
   right; a warm glow behind the ice wall on the left hides the way to Petalfall Grove. */
'use strict';
SCENES.barrens = E => {
const { p, light, spawn, sparkle, ring, sr, srnd, line, dot, rect } = E;
const OX = W;  // left edge in world pixels

/* ---------- shape of the place ---------- */
const EDGE = 287, TY = WAYS.grove[1], POND = { x0: 120, x1: 192, y: 200 }, HOLE = { x0: 155, x1: 163 };
const G = profile([[0, 194], [40, 195], [60, 190], [82, 193], [104, 196], [116, 199], [122, 200], [190, 200], [198, 197], [210, 190], [222, 170], [230, 150], [238, 143], [EDGE, 143]]);
for (let x = 0; x < W; x++) {
  if (x > EDGE) { G[x] = 999; continue; }
  if (x < POND.x0 - 2 || x > POND.x1 + 2) G[x] += (x > 236 ? 1 : 3) * (fbm(x * .12, 4) - .5);
  G[x] = Math.round(G[x]);
}
const cliff = y => EDGE + Math.round(2.5 * (fbm(y * .1, 6) - .5));
const wallTop = x => 56 + 12 * fbm(x * .12, 2) + x * .4;
const iceX = y => 25 + 9 * fbm(y * .05, 3) + (y > 150 ? (y - 150) * .12 : 0);
let opened = false;
const tunnel = (x, y) => opened ? y >= TY - 11 + (x > iceX(y) - 6 ? 0 : Math.round(2 * fbm(x * .3, 1))) + Math.max(0, (x - iceX(y) + 4)) * .6 && y <= TY + 10
  : y >= TY - 1 + Math.round(1.6 * (fbm(x * .45, 8) - .5) * 2) && y <= TY + (x < 6 ? 2 : 1);
const iceWall = (x, y) => y >= wallTop(x) && x < iceX(y) && y < G[x] + 1;
const pondWater = (x, y) => x >= POND.x0 && x <= POND.x1 && y > POND.y + 2 && y < POND.y + 2 + 15 * Math.sqrt(Math.max(0, 1 - ((x - 156) / 37) ** 2));
const hole = (x, y) => x >= HOLE.x0 && x <= HOLE.x1 && y >= POND.y && y <= POND.y + 2;
const solid = (x, y) => ((y >= G[x] && x <= cliff(y) && !pondWater(x, y) && !hole(x, y)) || iceWall(x, y)) && !(x < iceX(y) + 1 && tunnel(x, y));
const T = terrain();
E.isSolid = (x, y) => T.at(x, y) || y >= H;
E.isWet = (x, y) => pondWater(Math.round(x), Math.round(y)) || hole(Math.round(x), Math.round(y));

/* ---------- painted background ---------- */
const PINES = [[62, 34], [90, 26], [214, 22], [258, 30], [274, 20], [12, 18]];
const pine = (x, y) => { for (const [px0, h] of PINES) { const base = G[px0], k = (base - y) / h; if (k < 0 || k > 1) continue; const w = (1 - k) * h * .32 + 1 - (Math.floor(k * 5) % 1); if (Math.abs(x - px0) <= w * (1 - ((k * 5) % 1) * .35)) return [px0, k, w]; } return null; };
const HILL = new Float32Array(W); for (let x = 0; x < W; x++) HILL[x] = 168 - 22 * fbm(x * .018, 9) - 8 * fbm(x * .06, 3);
const SKY = ['#030612', '#050a1c', '#081026', '#0b1630', '#0f1c3a', '#132244', '#18284c'];
const bg = mk(W, H);
function paintBG() {
  T.fill(solid);
  const open = (x, y) => x < 0 || x >= W || y < 0 || y >= H || !T.m[y * W + x];
  paint((x, y) => {
    const n = hash(x, y);
    if (T.m[y * W + x]) {
      if (iceWall(x, y)) {
        if (open(x, y - 1)) return '#e0f8ff';
        const edge = open(x + 1, y) || open(x + 2, y);
        const c = fbm(x * .15 + y * .05, y * .08);
        if (Math.abs(c - .5) < .018) return '#9adcf0';
        if (edge) return n > .5 ? '#c8f0ff' : '#8ad0ec';
        return c > .55 ? '#4a90c0' : c > .42 ? '#3a78a8' : '#2a6090';
      }
      if (x >= POND.x0 && x <= POND.x1 && y <= POND.y + 2) return y === POND.y ? (n > .7 ? '#e8f8ff' : '#b8e0f4') : y === POND.y + 1 ? '#8ac8e8' : '#5a98c8';
      const d = y - G[x];
      if (d === 0) return n > .85 ? '#ffffff' : '#e0ecff';
      if (d < 3) return n > .5 ? '#c8d8f0' : '#b0c4e8';
      if (open(x + 1, y) || open(x - 1, y)) return '#6a80b8';
      const v = 1 - d / 40 + (fbm(x * .08, y * .08) - .5) * .4;
      return band(['#1a2448', '#243058', '#2e3c6a', '#3a4a7c', '#4a5c90', '#5a6ea0', '#7890c0', '#9ab0d8'], v, x, y);
    }
    if (tunnel(x, y) && x < iceX(y) + 1) { const k = 1 - x / 34; return band(['#2a1830', '#4a2440', '#7a3a50', '#b85a60', '#e89070'], opened ? .35 + k * .3 : .5 + k * .5, x, y); }
    if (pondWater(x, y) || hole(x, y)) return band(['#081830', '#0c2442', '#123256', '#1a426a', '#24547e'], 1 - (y - POND.y - 2) / 15, x, y);
    const pn = pine(x, y);
    if (pn) { const [px0, k] = pn, top = n > .3 && pine(x, y - 1) === null; return top || ((k * 5) % 1 > .8 && n > .4) ? '#c8d8f0' : x < px0 ? '#102426' : '#0a1a1c'; }
    if (x > EDGE && y > 150) return band(['#050a18', '#081026', '#0b1630'], (H - y) / 90, x, y);
    if (y >= HILL[x]) { const d = y - HILL[x]; return d < 1 ? '#3a5080' : d < 3 && hash(x, 1) > .4 ? '#2a3e62' : '#0e1a30'; }
    const s = starAt(x, y, .993); if (s) return s > 1 ? '#ffffff' : '#8aa0d0';
    return band(SKY, y / 175 + (fbm(x * .02, y * .04) - .5) * .12, x, y);
  }, bg);
}
paintBG();

/* ---------- sky, snow, ice ---------- */
const AUR = mk(1, 64);
{ const a = AUR.getContext('2d'), gr = a.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(120,80,255,0)'); gr.addColorStop(.25, 'rgba(120,120,255,.4)'); gr.addColorStop(.55, 'rgba(90,255,170,1)'); gr.addColorStop(.85, 'rgba(60,255,150,.5)'); gr.addColorStop(1, 'rgba(255,90,200,0)'); a.fillStyle = gr; a.fillRect(0, 0, 1, 64); }
function drawAurora(g, t) {
  g.imageSmoothingEnabled = true;
  for (let x = 0; x < W; x += 1) {
    const band1 = .15 + .85 * Math.pow(.5 + .5 * Math.sin(x * .031 + t * .22 + 2.2 * Math.sin(x * .009 - t * .07)), 1.5);
    const rays = .5 + .5 * Math.sin(x * .41 + t * 1.3) * Math.sin(x * .13 - t * .6);
    const a = band1 * rays * .5; if (a < .01) continue;
    const top = 10 + 16 * Math.sin(x * .017 - t * .12) + 6 * Math.sin(x * .061 + t * .31), h = 58 + 18 * Math.sin(x * .023 + t * .2);
    g.globalAlpha = a; g.drawImage(AUR, x, top, 1, h);
  }
}
function drawSparkles(t) {
  for (let i = 0; i < 26; i++) {
    const x = (i * 97 + 13) % 280 + 20, y = T.ground(x, 40), tw = Math.sin(t * 1.7 + i * 2.3);
    if (tw > .92 && y < H) { dot(x, y, '#ffffff'); light(x + .5, y + .5, 3, '#c8f0ff', .5 * (tw - .92) / .08); }
  }
  for (const [x, y] of [[20, 90], [28, 120], [14, 140], [32, 176], [22, 70]]) { const tw = .5 + .5 * Math.sin(t * .9 + x); light(x, y, 8, '#6fd8ff', .08 + .08 * tw); }
}
function updSnow(dt) {
  if (R() < dt * 14) spawn({ x: rr(-10, W), y: -2, vx: rr(2, 6), vy: rr(7, 12), wob: 5, life: 30, col: R() < .3 ? '#ffffff' : '#c8d8f0', kind: 3, fin: 1, fout: .5 });
}

/* ---------- bridge + ice wall ---------- */
let burst = 0, glintT = 0;
function drawBridge() {
  const post = x => { rect(x, 135, 2, 8, '#4a3428'); dot(x, 134, '#6a4c38'); dot(x, 134, '#e0ecff'); };
  post(EDGE - 8); post(EDGE - 2);
  for (let x = BRIDGE.x0 - OX; x < W; x++) {
    const y = Math.round(bridgeY(OX + x)); dot(x, y, x % 3 === 0 ? '#3a2820' : '#6a4c38'); if (x % 3) dot(x, y + 1, '#3a2820');
    const ry = Math.round(y - 6 + (y - BRIDGE.y) * .15); dot(x, ry, '#8a7058'); if (x % 6 === 0) line(x, ry, x, y - 1, '#5a4434');
  }
}
function drawWay(t) {
  if (opened) { light(4, TY, 18, '#ff9a8a', .22 + burst * .7); light(18, TY + 4, 10, '#ffc0a0', .12 + burst * .4); return; }
  const pul = .5 + .5 * Math.sin(t * 1.8);
  light(8, TY, 10 + pul * 4 + E.hot * 6, '#ff9a8a', .3 + .2 * pul + E.hot * .4);
  light(24, TY, 6 + E.hot * 4, '#ffc8a0', .25 + .15 * pul + E.hot * .3);
}
function updWay(dt) {
  burst = Math.max(0, burst - dt * .5);
  glintT -= dt * (1 + E.hot * 3); if (glintT > 0) return; glintT = rr(.5, 1.3);
  const x = iceX(TY) + rr(0, 2); spawn({ x, y: TY + rr(-1, 1), vx: rr(2, 6), vy: rr(-4, -1), wob: 2, life: rr(1.5, 3), col: opened ? pick(['#ffc0d8', '#ffe0e8']) : '#ffd8b0', gc: '#ff9a8a', glow: 2.5, ga: .5, fin: .3, fout: 1 });
}
function openWay() {
  opened = true; paintBG(); burst = 1;
  E.rubble(iceX(TY) - 3, TY, 34, ['#e0f8ff', '#8ad0ec', '#4a90c0', '#c8f0ff'], 8);
  for (let i = 0; i < 10; i++) spawn({ x: rr(0, 30), y: TY + rr(-8, 8), vx: rr(4, 20), vy: rr(-8, 4), drag: 1, wob: 4, life: rr(2, 4), col: pick(['#ffc0d8', '#ffd8e8']), gc: '#ff9ac0', glow: 2, ga: .4, fin: .1, fout: 1 });
  ring(iceX(TY), TY, 28, '#ffb0a0', 1.3);
}

/* ---------- ARCTIC FOX that dives into the snow ---------- */
const fox = (() => {
  const pal = { W: '#e8eef8', w: '#b8c4dc', t: '#f8fbff', e: '#c8d0e4', k: '#141420', n: '#1a1a24' };
  const stand = spr(['.........e.e.', '.........WWW.', 'tt......WWkWn', 'tWt.WWWWWWWw.', '.ttWWWWWWWW..', '...wWWWWWWw..', '...W.W..W.W..', '...w.w..w.w..'], pal);
  const leap = spr(['.........e.e.', '.........WWW.', 'tt......WWkWn', 'tWtWWWWWWWWw.', '.ttWWWWWWWW..', '...wWWWWWWw..', '.ww......WW..', 'w.........w..'], pal);
  const X0 = 78;
  const o = { name: 'arctic fox', caption: 'The fox dives headfirst into the snow', busy: false, tt: 0, x: X0, dir: 1, air: 0, ang: 0, state: 'stand', ear: 0 };
  o.box = () => [o.x - 7, G[Math.round(o.x)] - 9 + o.air, 14, 9];
  o.update = (dt, t) => {
    tick(o, 'ear', 2, 5, .25, dt);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt, d = o.dir;
    if (T0 < .9) { o.state = 'stand'; o.ear = T0 > .3 && T0 < .6 ? .1 : 0; o.air = T0 > .6 ? 1 : 0; }
    else if (T0 < 1.6) { o.state = 'leap'; const k = (T0 - .9) / .7; o.x = o.sx + d * 22 * k; o.air = -hop(k) * 22; o.ang = lerp(-.7, 1.6, k) * d; }
    else if (T0 < 3) {
      if (o.state !== 'dive') { o.state = 'dive'; const gy = G[Math.round(o.x)]; for (let i = 0; i < 18; i++) spawn({ x: o.x + rr(-3, 3), y: gy - 1, vx: rr(-30, 30), vy: rr(-50, -15), ay: 120, life: rr(.6, 1.2), col: pick(['#ffffff', '#e0ecff', '#c8d8f0']), kind: 2, fin: .01, fout: .3 }); ring(o.x, gy - 2, 14, '#e0f0ff', .7); }
      o.air = 0; o.wig = Math.floor(T0 * 10) % 2;
    } else if (T0 < 3.5) { o.state = 'stand'; o.air = 0; if (!o.pop) { o.pop = true; E.rubble(o.x, G[Math.round(o.x)] - 2, 8, ['#ffffff', '#e0ecff'], 3); } }
    else { o.busy = false; o.dir = -o.dir; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.sx = o.x; o.pop = false; if (o.x > 96) o.dir = -1; else if (o.x < 60) o.dir = 1; };
  o.draw = t => {
    const X = Math.round(o.x), gy = G[X];
    if (o.state === 'dive') {
      p.save(); p.beginPath(); p.rect(0, 0, W, gy + 1); p.clip();
      E.spin(stand, X, gy - 3, Math.PI / 2 * o.dir + (o.wig ? .01 : 0), o.dir < 0); p.restore();
      dot(X + (o.wig ? 1 : 0) - o.dir, gy - 9, '#f8fbff');
      return;
    }
    if (o.state === 'leap') { E.spin(leap, X, gy - 4 + o.air, o.ang, o.dir < 0); return; }
    const s = o.state === 'stand' ? stand : stand;
    E.blit(s, X - 6, gy - 8 + o.air, o.dir < 0);
    if (o.ear > 0) dot(o.dir > 0 ? X + 3 : X - 4, gy - 8, '#e8eef8');
  };
  return o;
})();

/* ---------- SNOW HARE that zigzags ---------- */
const hare = (() => {
  const pal = { W: '#eef2fa', w: '#b8c4dc', e: '#1a1a24', k: '#141420', n: '#e0a0b0' };
  const sit = spr(['......e..', '.....ee..', '.....WW..', '..WWWWkW.', '.WWWWWWWn', 'WWWWWWW..', '.wWWWw...', '..ww.ww..'], pal);
  const bound = spr(['.......e.', '......e..', '.....WWW.', '.WWWWWWkW', 'WWWWWWWWn', '.WWWWWW..', 'ww....ww.', '.........'], pal);
  const X0 = 196;
  const o = { name: 'hare', caption: 'The hare zigzags over the drifts', busy: false, tt: 0, x: X0, dir: -1, air: 0, pts: [] };
  o.box = () => [o.x - 5, G[Math.round(o.x)] - 8 + o.air, 10, 8];
  o.update = (dt) => {
    if (!o.busy) return;
    o.tt += dt; const per = .32, i = Math.floor(o.tt / per), k = (o.tt % per) / per;
    if (i >= o.pts.length - 1) { o.x = o.pts[o.pts.length - 1]; o.air = 0; o.busy = false; o.dir = -1; return; }
    const a = o.pts[i], b = o.pts[i + 1]; o.dir = b >= a ? 1 : -1; o.x = lerp(a, b, k); o.air = -hop(k) * 6;
    if (k < .1 && R() < .5) E.rubble(o.x, G[Math.round(o.x)] - 1, 2, ['#ffffff', '#c8d8f0'], 1);
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.pts = [X0, 184, 176, 186, 166, 156, 170, 148, 140, 156, 172, 188, X0]; };
  o.draw = () => { const X = Math.round(o.x), s = o.air < -1 ? bound : sit; E.blit(s, X - 4, G[X] - 8 + Math.round(o.air), o.dir < 0); };
  return o;
})();

/* ---------- POLAR BEAR CUB that belly-slides ---------- */
const cub = (() => {
  const pal = { W: '#f0ecf4', w: '#c8c0d8', e: '#d8d0e0', k: '#141018', n: '#141018' };
  const walkA = spr(['........ee..', '.......WWWW.', '.WWWWWWWWkWn', 'WWWWWWWWWWW.', 'wWWWWWWWWWw.', '.WW.WW.WW.WW', '.ww.ww.ww.ww'], pal);
  const walkB = spr(['........ee..', '.......WWWW.', '.WWWWWWWWkWn', 'WWWWWWWWWWW.', 'wWWWWWWWWWw.', 'WW..WW.WW..W', 'ww..ww.ww..w'], pal);
  const slide = spr(['..........ee..', 'www......WWWW.', 'wWWWWWWWWWWkWn', '.wWWWWWWWWWWW.', '..wwwww.wwww..'], pal);
  const X0 = 256;
  const o = { name: 'bear cub', caption: 'The bear cub slides down the drift on its belly', busy: false, tt: 0, x: X0, y: 0, dir: -1, pose: 'walk', ang: 0, spin: 0 };
  const gy = x => T.ground(Math.round(x), 100);
  o.box = () => [o.x - 7, gy(o.x) - 8, 13, 8];
  o.update = (dt, t) => {
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < 1.3) { o.dir = -1; o.pose = 'walk'; o.x = lerp(X0, 240, T0 / 1.3); }
    else if (T0 < 2.6) {
      o.pose = 'slide'; const k = (T0 - 1.3) / 1.3; o.x = lerp(240, 172, 1 - (1 - k) * (1 - k));
      o.ang = Math.atan2(gy(o.x - 3) - gy(o.x + 3), 6);
      if (R() < dt * 30) spawn({ x: o.x + 5, y: gy(o.x) - 1, vx: rr(0, 20), vy: rr(-20, -5), ay: 60, life: rr(.4, .9), col: pick(['#ffffff', '#e0ecff']), fin: .01, fout: .3 });
    } else if (T0 < 3.4) { o.pose = 'slide'; o.ang = 0; o.spin = Math.floor((T0 - 2.6) * 8); if (o.spin % 2) o.dir = -o.dir; if (R() < dt * 20) sparkle(o.x, gy(o.x) - 2, 1, '#ffffff', '#c8f0ff'); }
    else if (T0 < 7) { o.pose = 'walk'; o.dir = 1; o.ang = 0; const k = (T0 - 3.4) / 3.6; o.x = lerp(172, X0, k); }
    else { o.dir = -1; o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; };
  o.draw = t => {
    const X = Math.round(o.x), y = gy(X);
    if (o.pose === 'slide') { E.spin(slide, X, y - 2, o.ang, o.dir < 0); return; }
    const moving = o.busy && (o.tt < 1.3 || (o.tt > 3.4 && o.tt < 7));
    E.blit(moving && Math.floor(t * 6) % 2 ? walkB : walkA, X - 6, y - 7, o.dir < 0);
  };
  return o;
})();

/* ---------- STOAT popping out of snow holes ---------- */
const stoat = (() => {
  const HOLES = [44, 70, 102, 214].map(x => ({ x, y: G[x] }));
  const pal = { W: '#f4f6fc', k: '#141420', n: '#1a1a24', e: '#d0d8e8' };
  const head = spr(['e.e', 'WWW', 'kWk', 'WnW', 'WWW', 'WWW'], pal), side = spr(['.e..', 'WWW.', 'WkWn', 'WWW.', 'WW..', 'WW..'], pal);
  const o = { name: 'stoat', caption: 'The stoat pops out of every snow hole', busy: false, tt: 0, at: 0, up: 0, look: 0 };
  o.box = () => { const h = HOLES[Math.max(0, o.at)]; return [h.x - 3, h.y - 7, 7, 8]; };
  o.update = (dt) => {
    if (!o.busy) { o.up = Math.max(0, o.up - dt * 3); return; }
    o.tt += dt; const per = 1.15, i = Math.floor(o.tt / per), k = (o.tt % per) / per;
    if (i >= HOLES.length) { o.busy = false; o.at = 0; o.up = 0; return; }
    if (i !== o.at) { o.at = i; E.rubble(HOLES[i].x, HOLES[i].y - 1, 4, ['#ffffff', '#c8d8f0'], 1); }
    o.up = k < .2 ? k / .2 : k < .75 ? 1 : 1 - (k - .75) / .25; o.look = k > .35 && k < .55 ? -1 : k > .55 ? 1 : 0;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.at = -1; };
  o.draw = () => {
    for (const h of HOLES) { rect(h.x - 1, h.y, 3, 1, '#3a4a7c'); }
    if (o.at < 0 || o.up <= 0) { if (!o.busy) { const h = HOLES[0]; dot(h.x - 1, h.y - 1, '#f4f6fc'); dot(h.x + 1, h.y - 1, '#f4f6fc'); } return; }
    const h = HOLES[o.at], rise = Math.round(o.up * 6);
    p.save(); p.beginPath(); p.rect(0, 0, W, h.y); p.clip();
    E.blit(o.look ? side : head, h.x - 1, h.y - rise, o.look < 0); p.restore();
  };
  return o;
})();

/* ---------- SEAL at the breathing hole ---------- */
const seal = (() => {
  const pal = { S: '#6a7488', s: '#8a94a8', k: '#0a0c14', n: '#1a1c24', w: '#c8d0e0' };
  const head = spr(['...SSS..', '..SSSkS.', '..SsSSSn', '.SSsss..', 'SSSSS...', 'SSSS....'], pal);
  const HX = (HOLE.x0 + HOLE.x1) / 2;
  const o = { name: 'seal', caption: 'The seal pops up through the ice', busy: false, tt: 0, up: 0, dir: 1, breath: 0 };
  o.box = () => [HOLE.x0 - 3, POND.y - 8, 14, 10];
  o.update = (dt) => {
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt;
    if (T0 < .5) o.up = T0 / .5 * 6;
    else if (T0 < 3.2) { o.up = 6 + Math.sin(T0 * 3) * .5; o.dir = T0 > 1.6 ? -1 : 1; if (Math.floor(T0 / .9) !== o.breath && T0 > .8) { o.breath = Math.floor(T0 / .9); for (let i = 0; i < 5; i++) spawn({ x: HX + o.dir * 4, y: POND.y - 7, vx: o.dir * rr(4, 12), vy: rr(-10, -4), drag: 1.5, wob: 3, life: rr(1, 1.8), col: '#e0ecff', fin: .1, fout: 1, a: .7 }); } }
    else if (T0 < 3.6) o.up = 6 * (1 - (T0 - 3.2) / .4);
    else { o.up = 0; o.busy = false; E.splash(HX, POND.y - 1, 10, '#c8e8ff', '#6fb8ff'); ring(HX, POND.y, 16, '#8fd0ff', .8); }
    if (T0 < .1 && o.up < 1) E.splash(HX, POND.y - 1, 6, '#c8e8ff', '#6fb8ff');
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.breath = 0; E.splash(HX, POND.y - 1, 6, '#c8e8ff', '#6fb8ff'); };
  o.draw = t => {
    const pu = .5 + .5 * Math.sin(t * 1.2);
    for (let x = HOLE.x0; x <= HOLE.x1; x++) dot(x, POND.y, Math.sin(x * .9 + t * 2) > .5 ? '#4a8ac0' : '#1a3a6a');
    light(HX, POND.y + 2, 8, '#3a8aff', .08 + .05 * pu);
    if (o.up <= 0) return;
    p.save(); p.beginPath(); p.rect(0, 0, W, POND.y); p.clip();
    E.blit(head, HX - 4, POND.y - Math.round(o.up), o.dir < 0); p.restore();
    dot(o.dir > 0 ? HX + 5 : HX - 6, POND.y - Math.round(o.up) + 3, '#c8d0e0');
  };
  return o;
})();

/* ---------- render ---------- */
const critters = [fox, hare, cub, stoat, seal];
function ambient(dt, t) { updSnow(dt); updWay(dt); }
return {
  critters,
  entry: { x: W - 1, y: BRIDGE.y },
  exit: { x: 18, y: TY, r: 14 },
  ambient,
  vig: vignette(.6, .1, '2,4,12'),
  update(dt, t) { ambient(dt, t); for (const c of critters) c.update(dt, t); },
  draw(t) {
    p.globalAlpha = 1; p.drawImage(bg, 0, 0);
    drawWay(t); drawSparkles(t); drawBridge();
    seal.draw(t); stoat.draw(t); hare.draw(t); cub.draw(t); fox.draw(t);
    E.drawParts();
    light(160, 190, 70, '#4affb0', .045 + .02 * Math.sin(t * .2));
  },
  under(g, t) { drawAurora(g, t); },
  openExit: openWay
};
};
