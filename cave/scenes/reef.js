/* Lantern Reef · a night reef lit by its own creatures. The flooded lava tube from Cinder Deep opens in the west wall;
   a boulder in the eastern rocks hides the channel up to Wisp Bayou. */
'use strict';
SCENES.reef = E => {
const { p, light, spawn, sparkle, ring, sr, srnd, line, dot, rect } = E;

/* ---------- shape of the place ---------- */
const TY = WAYS.reef[1], XY = WAYS.bayou[1];
const FL = profile([[0, 200], [40, 202], [80, 207], [130, 212], [170, 214], [210, 210], [250, 206], [284, 204], [W, 204]]);
for (let x = 0; x < W; x++) FL[x] = Math.round(FL[x] + 3 * (fbm(x * .07, 2) - .5));
const LW = y => 18 + 10 * fbm(2.1, y * .04) + (y > 180 ? (y - 180) * .5 : 0);
const RX = y => 282 + 10 * fbm(7.7, y * .05) - (y > 200 ? (y - 200) * .8 : 0);
const OCTO = { x: 50, y: 191, rx: 13, ry: 7 };
const tubeIn = (x, y) => x < 34 && y >= TY - 10 + Math.round(1.5 * fbm(x * .2, 3)) && y <= TY + 10;
const passage = (x, y) => x > 276 && y >= XY - 11 + Math.round(1.5 * fbm(x * .2, 9)) && y <= XY + 3;
const rocks = (x, y) => (x < LW(y) || (x > RX(y) && y > 150)) || Math.hypot((x - OCTO.x) / OCTO.rx, (y - OCTO.y) / OCTO.ry) < 1 || (x > 238 && y < 112 + (x - 238) * .15 && y > 96 + (320 - x) * .12);
const solid = (x, y) => ((y >= FL[x] || rocks(x, y)) && !tubeIn(x, y) && !passage(x, y)) || y >= H;
const T = terrain(solid);
E.isSolid = (x, y) => T.at(x, y) || y >= H;

/* ---------- painted background ---------- */
const WATER = ['#020610', '#030a18', '#050e20', '#071428', '#0a1a32', '#0e223e', '#122a4a', '#16345a'];
const CORALS = [[72, 1, 22, 11], [100, 0, 16, 5], [118, 2, 12, 9], [206, 1, 18, 13], [230, 0, 14, 7], [258, 2, 16, 3], [150, 2, 8, 1]];
const coralPx = [];
const bg = mk(W, H);
paint((x, y) => {
  const n = hash(x, y);
  if (T.m[y * W + x]) {
    const open = (a, b) => a >= 0 && a < W && b >= 0 && b < H && !T.m[b * W + a];
    if (y >= FL[x] && !rocks(x, y)) { const d = y - FL[x]; if (d === 0) return n > .7 ? '#8a88a0' : '#6a6880'; if (n > .994) return '#8a8098'; return band(['#12141e', '#1a1c28', '#262634', '#34344a', '#4a4a60'], 1 - d / 26 + (fbm(x * .1, y * .1) - .5) * .3, x, y); }
    if (open(x, y - 1)) return n > .6 ? '#8a4aa0' : n > .3 ? '#5a3a78' : '#3a4a5a';
    if (open(x - 1, y) || open(x + 1, y) || open(x, y + 1)) return '#243448';
    const f = fbm(x * .12, y * .12); return f > .6 ? '#1a2634' : f > .45 ? '#141e2a' : '#0e1620';
  }
  if (tubeIn(x, y)) return band(['#050a14', '#081020', '#0c1830', '#12223e'], x / 34, x, y);
  if (passage(x, y)) return band(['#0a1a1a', '#10262a', '#1a3a3a', '#2a4a3a'], (x - 276) / 44, x, y);
  let v = .85 - y / 240 * .8 + (fbm(x * .015, y * .02) - .5) * .2;
  const back = fbm(x * .03 + 40, y * .02) + .25 * Math.exp(-(((y - 200) / 30) ** 2));
  if (back > .64) { v -= .1; if (fbm(x * .03 + 40, (y - 2) * .02) + .25 * Math.exp(-(((y - 202) / 30) ** 2)) <= .64) v += .1; }
  return band(WATER, v, x, y);
}, bg);
// branching corals and brain corals, painted once; their glowing tips are animated
{
  const b = bg.getContext('2d'), put = (x, y, c) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const PAL = [['#c83a6a', '#ff6a9a', '#ffc0d8'], ['#c86a2a', '#ff9a4a', '#ffd8a0'], ['#6a3ac8', '#9a6aff', '#d8c0ff']];
  for (const [cx, k, h, seed] of CORALS) {
    const P = PAL[k], rnd = seeded(seed), base = FL[cx] - 1;
    if (k === 0 && h < 18) { for (let j = 0; j < h / 2; j++) for (let i = -h / 2; i <= h / 2; i++) if (Math.hypot(i / (h / 2), j / (h / 2.4)) < 1) put(cx + i, base - j, (i + j) % 3 === 0 ? P[2] : (i * 7 + j) % 4 === 0 ? P[0] : P[1]); coralPx.push([cx, base - h / 2.4, P[1]]); continue; }
    const grow = (x, y, a, len, depth) => {
      for (let i = 0; i < len; i++) { x += Math.cos(a); y += Math.sin(a); put(x, y, P[0]); put(x + 1, y, P[1]); }
      if (depth <= 0 || len < 3) { put(x, y - 1, P[2]); coralPx.push([Math.round(x), Math.round(y - 1), P[1]]); return; }
      grow(x, y, a - .45 - rnd() * .3, len * .72, depth - 1); grow(x, y, a + .45 + rnd() * .3, len * .72, depth - 1);
    };
    grow(cx, base, -Math.PI / 2, h * .38, 3);
  }
}

/* ---------- kelp, anemones, bubbles, plankton ---------- */
const KELP = [130, 138, 147, 158, 166, 178, 186, 44, 268].map((x, i) => ({ x, base: FL[x] - 1, len: Math.round(sr(70, 150) * (x < 60 || x > 250 ? .5 : 1)), ph: sr(0, TAU), leaves: [] }));
for (const k of KELP) for (let y = 6; y < k.len; y += Math.round(sr(6, 11))) k.leaves.push({ y, s: srnd() < .5 ? -1 : 1, l: Math.round(sr(2, 5)) });
function drawKelp(t) {
  for (const k of KELP) {
    const at = i => k.x + Math.round(Math.sin(t * .6 + k.ph + i * .05) * 3 * (i / k.len) + Math.sin(t * .9 + i * .12 + k.ph) * 1.2 * (i / k.len));
    for (let i = 0; i < k.len; i++) dot(at(i), k.base - i, i % 9 === 0 ? '#5a8a3a' : '#2e5a30');
    for (const l of k.leaves) { const x = at(l.y); for (let j = 1; j <= l.l; j++) dot(x + l.s * j, k.base - l.y - Math.round(j * .6), j === l.l ? '#6a9a48' : '#3a6a34'); }
    dot(at(k.len - 1), k.base - k.len, '#8aba58');
  }
}
const ANEM = [[96, '#ff8ac8', '#ff4aa8'], [188, '#8affe0', '#3ae8c8'], [240, '#ffd88a', '#ffb04a'], [26, '#b89aff', '#8a5aff']].map(([x, c, g]) => ({ x, y: FL[x] - 1, c, g, ph: sr(0, TAU), shy: 0 }));
function drawAnem(t) {
  for (const a of ANEM) {
    const k = 1 - a.shy;
    rect(a.x - 2, a.y - 1, 5, 2, '#4a2a3a');
    for (let i = -3; i <= 3; i++) { const len = Math.round((3 + (3 - Math.abs(i)) * .6) * k); for (let j = 1; j <= len; j++) dot(a.x + i + Math.round(Math.sin(t * 1.5 + a.ph + j * .6) * j * .25), a.y - 1 - j, j === len ? a.c : a.g); }
    light(a.x + .5, a.y - 4, 7, a.g, .2 + .1 * Math.sin(t * 1.2 + a.ph));
  }
}
function updBubbles(dt) {
  if (R() < dt * 5) { const x = pick([96, 188, 240, 50, 26, 150]) + rr(-2, 2); spawn({ x, y: FL[Math.round(x)] - 4, vx: 0, vy: rr(-14, -8), wob: 5, life: rr(4, 8), col: pick(['#8ac8ff', '#c8e8ff']), fin: .3, fout: .6, a: .8 }); }
  if (R() < dt * 4) spawn({ x: rr(20, 300), y: rr(20, 200), vx: rr(-2, 2), vy: rr(-2, 2), wob: 3, life: rr(2, 5), col: pick(['#6affe8', '#8ab8ff', '#c8ffe8']), glow: 2.5, gc: '#3ae8d8', ga: .5, fin: 1, fout: 1.5 });
}
function drawCorals(t) { for (let i = 0; i < coralPx.length; i++) { const [x, y, c] = coralPx[i], pu = .5 + .5 * Math.sin(t * 1.3 + i * 1.7); light(x + .5, y + .5, 3 + pu * 3, c, .16 + .2 * pu); } }
// a small school of silver fish
const school = Array.from({ length: 9 }, (_, i) => ({ ox: (i % 3) * 5 - 5 + rr(-1, 1), oy: Math.floor(i / 3) * 3 - 3 + rr(-1, 1), ph: rr(0, TAU) }));
function drawSchool(t) {
  const u = t * .05, cx = 160 + Math.sin(u * TAU) * 110, cy = 70 + Math.sin(u * TAU * 2) * 22, dir = Math.cos(u * TAU) >= 0 ? 1 : -1;
  for (const f of school) { const x = cx + f.ox * dir + Math.sin(t * 2 + f.ph), y = cy + f.oy + Math.sin(t * 1.6 + f.ph) * .7; dot(x, y, '#c8d8e8'); dot(x - dir, y, '#6a8aa8'); if (Math.sin(t * 3 + f.ph) > .8) light(x, y, 2, '#c8e8ff', .3); }
}

/* ---------- boulder in the eastern rocks ---------- */
const BO = { x: 298, y: XY - 5, r: 8 };
let opened = false, roll = 0, burst = 0, glintT = 0;
function drawWay(t) {
  const pul = .5 + .5 * Math.sin(t * 2), bx = lerp(BO.x, 262, smooth(roll)), by = opened ? lerp(BO.y, FL[262] - BO.r, smooth(roll)) : BO.y, rot = roll * 5;
  if (opened) { light(318, XY - 4, 16, '#8affc0', .22 + burst * .6); light(300, XY - 4, 8, '#b8ffd8', .1 + burst * .4); }
  else { light(BO.x + BO.r + 1, BO.y, 6 + pul * 3 + E.hot * 5, '#8affc0', .35 + .2 * pul + E.hot * .45); light(BO.x, BO.y - BO.r, 5 + E.hot * 3, '#b8ffd8', .2 + .1 * pul + E.hot * .3); }
  for (let j = -BO.r; j <= BO.r; j++) for (let i = -BO.r; i <= BO.r; i++) {
    const d = Math.hypot(i, j); if (d > BO.r) continue;
    const a = Math.atan2(j, i) + rot, v = fbm(Math.cos(a) * d * .3 + 5, Math.sin(a) * d * .3 + 5);
    dot(bx + i, by + j, d > BO.r - 1 ? (j < 0 && i < 0 ? '#3a4e62' : '#0e1620') : v > .55 ? '#2a3a4a' : v > .45 ? '#1e2a38' : '#141e2a');
  }
  dot(bx - 3, by - 5, '#8a4aa0'); dot(bx - 4, by - 4, '#5a3a78');
}
function updWay(dt) {
  burst = Math.max(0, burst - dt * .5); if (opened) roll = Math.min(1, roll + dt / 1.2);
  glintT -= dt * (1 + E.hot * 3); if (glintT > 0) return; glintT = rr(.3, .8);
  const x = opened ? rr(284, 316) : BO.x + BO.r + rr(0, 2), y = XY + rr(-8, 2);
  spawn({ x, y, vx: opened ? rr(-8, -2) : rr(-4, 0), vy: rr(-10, -4), wob: 3, life: rr(2, 4), col: pick(['#b8ffd8', '#8affc0', '#c8e8ff']), glow: opened ? 2 : 2.5, gc: '#6affb0', ga: .4, fin: .3, fout: 1 });
}
function openWay() {
  opened = true; burst = 1;
  for (let i = 0; i < 30; i++) spawn({ x: BO.x + rr(-6, 10), y: BO.y + rr(-8, 8), vx: rr(-16, 10), vy: rr(-24, -6), wob: 5, life: rr(2, 4), col: pick(['#8ac8ff', '#c8e8ff', '#b8ffd8']), fin: .1, fout: 1 });
  E.rubble(BO.x, BO.y + 6, 10, ['#6a6880', '#8a88a0'], 4);
  ring(BO.x, BO.y, 26, '#8affc0', 1.3);
}

/* ---------- OCTOPUS on its rock ---------- */
const octo = (() => {
  const o = { name: 'octopus', caption: 'The octopus flashes its colours and jets away', busy: false, tt: 0, x: OCTO.x, y: OCTO.y - OCTO.ry, col: 0, ink: false, pts: null };
  const COLS = ['#c84a3a', '#f0e8e0', '#8a4ac8', '#e87a2a', '#c84a3a'];
  const HOME = { x: OCTO.x, y: OCTO.y - OCTO.ry };
  o.box = () => [o.x - 5, o.y - 8, 10, 10];
  o.update = (dt, t) => {
    if (!o.busy) { o.col = 0; return; }
    o.tt += dt; const T0 = o.tt;
    if (T0 < 1.6) o.col = T0 / 1.6 * 3;
    else if (T0 < 5.2) {
      if (!o.ink) { o.ink = true; for (let i = 0; i < 26; i++) spawn({ x: o.x + rr(-3, 3), y: o.y - 3 + rr(-2, 2), vx: rr(-10, 10), vy: rr(-6, 6), drag: 1.5, wob: 2, life: rr(2, 3.5), col: pick(['#0a0610', '#140c1a', '#1e1428']), fin: .05, fout: 1.5, w: 2, h: 2 }); }
      const u = (T0 - 1.6) / 3.6, q = pathAt(o.pts, u); o.x = q.x; o.y = q.y; o.col = 0;
    } else { o.x = HOME.x; o.y = HOME.y; if (T0 > 5.6) o.busy = false; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.ink = false; o.pts = [HOME, { x: HOME.x + 10, y: HOME.y - 40 }, { x: rr(90, 120), y: rr(80, 110) }, { x: rr(60, 80), y: rr(120, 150) }, { x: HOME.x + 4, y: HOME.y - 12 }, HOME]; };
  o.draw = t => {
    const X = Math.round(o.x), Y = Math.round(o.y), k = Math.floor(o.col), c = mix(COLS[k], COLS[Math.min(4, k + 1)], o.col - k), moving = o.busy && o.tt > 1.6 && o.tt < 5.2;
    // mantle
    rect(X - 3, Y - 8, 6, 5, c); rect(X - 2, Y - 9, 4, 1, c); dot(X - 2, Y - 6, '#f8f0c8'); dot(X + 1, Y - 6, '#f8f0c8'); dot(X - 2, Y - 5, '#140a08'); dot(X + 1, Y - 5, '#140a08');
    // arms
    for (let a = 0; a < 6; a++) {
      const ax = X - 3 + a, sp = moving ? (a - 2.5) * .2 : (a - 2.5) * .9;
      for (let j = 0; j < (moving ? 6 : 4); j++) dot(ax + Math.round(sp * j + (moving ? 0 : Math.sin(t * 2 + a + j * .7) * .8)), Y - 3 + j, j % 2 ? mix(c, '#000000', .3) : c);
    }
    light(X, Y - 5, 8, COLS[Math.round(o.col)], .1 + (o.busy && o.tt < 1.6 ? .25 : 0));
  };
  return o;
})();

/* ---------- JELLYFISH ---------- */
const jellies = (() => {
  const J = [[80, 60, '#ff8ad8'], [210, 50, '#8ad8ff'], [270, 80, '#c8a0ff']].map(([x, y, c], i) => ({ hx: x, hy: y, x, y, c, ph: i * 2, flash: 0 }));
  const o = { name: 'jellyfish', caption: 'The jellyfish pulse in a glowing chain', busy: false, tt: 0 };
  o.box = () => { const j = J[0]; return [j.x - 5, j.y - 4, 10, 14]; };
  o.hit = [];
  o.update = (dt, t) => {
    for (const j of J) { j.flash = Math.max(0, j.flash - dt * .8); const pulse = Math.pow(Math.max(0, Math.sin(t * 1.4 + j.ph)), 2); j.y += (-pulse * 7 + 2.2) * dt * (o.busy ? 1.6 : 1); j.x = j.hx + Math.sin(t * .3 + j.ph) * 8; if (j.y > j.hy + 26) j.y = j.hy + 26; if (j.y < 24) j.y = 24; }
    if (!o.busy) return;
    o.tt += dt; const k = Math.floor(o.tt / .55);
    if (k !== o.k && k < 6) { o.k = k; const j = J[k % 3]; j.flash = 1; ring(j.x, j.y, 14, j.c, .9); }
    if (o.tt > 3.8) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.k = -1; };
  o.draw = t => {
    for (const j of J) {
      const X = Math.round(j.x), Y = Math.round(j.y), pulse = Math.pow(Math.max(0, Math.sin(t * 1.4 + j.ph)), 2), w = pulse > .5 ? 3 : 4, bell = mix(j.c, '#ffffff', j.flash * .7);
      rect(X - w, Y, w * 2 + 1, 1, bell); rect(X - w + 1, Y - 1, w * 2 - 1, 1, bell); rect(X - 1, Y - 2, 3, 1, bell); dot(X, Y - 1, '#ffffff');
      for (let i = -w + 1; i <= w - 1; i += 2) for (let k = 1; k < 7 + (i === 0 ? 3 : 0); k++) { p.globalAlpha = 1 - k / 11; dot(X + i + Math.round(Math.sin(t * 2 + k * .6 + i) * .8), Y + k, j.c); }
      p.globalAlpha = 1;
      light(X + .5, Y, 9 + j.flash * 10, j.c, .28 + .15 * pulse + j.flash * .5);
    }
  };
  return o;
})();

/* ---------- SEA TURTLE ---------- */
const turtle = (() => {
  const pal = { S: '#3a5a3a', s: '#5a7a4a', h: '#8aa878', k: '#0a0a08', f: '#7a9a68' };
  const A = spr(['....SSSS......', '..SSsSSsSS....', '.SSsSSsSSsS.hh.', 'SSSSSSSSSSShhk', '.ffSSSSSSSff.h.', 'f..........f...'].map(r => r.padEnd(15, '.')), pal);
  const B = spr(['....SSSS......', '..SSsSSsSS....', '.SSsSSsSSsS.hh.', 'SSSSSSSSSSShhk', '.ffSSSSSSSff.h.', '..f.......f....'].map(r => r.padEnd(15, '.')), pal);
  const HOME = { x: 168, y: FL[168] - 3 };
  const o = { name: 'sea turtle', caption: 'The sea turtle glides past', busy: false, tt: 0, x: HOME.x, y: HOME.y, dir: 1, pts: null, dur: 8 };
  o.box = () => [o.x - 7, o.y - 4, 15, 6];
  o.update = (dt) => {
    if (!o.busy) return;
    o.tt += dt; const u = Math.min(1, o.tt / o.dur), q = pathAt(o.pts, u);
    if (Math.abs(q.x - o.x) > .05) o.dir = q.x > o.x ? 1 : -1; o.x = q.x; o.y = q.y;
    if (R() < dt * 3) spawn({ x: o.x + o.dir * 6, y: o.y - 3, vy: -10, wob: 3, life: 3, col: '#c8e8ff', fin: .1, fout: .5, a: .8 });
    if (u >= 1) { o.busy = false; o.dir = 1; }
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.pts = [HOME, { x: HOME.x + 20, y: HOME.y - 30 }, { x: 260, y: 60 }, { x: 150, y: 34 }, { x: 60, y: 60 }, { x: 110, y: 120 }, { x: HOME.x - 20, y: HOME.y - 12 }, HOME]; o.dur = rr(7.5, 8.5); };
  o.draw = t => { const s = o.busy && Math.floor(t * 3) % 2 ? B : A; E.blit(s, o.x - 7, o.y - 4, o.dir < 0); };
  return o;
})();

/* ---------- ANGLERFISH under the ledge ---------- */
const angler = (() => {
  const pal = { B: '#2a2a3a', b: '#3a3a4e', t: '#e8e8f0', k: '#c8e8ff', m: '#0a0a10' };
  const shut = spr(['..BBBBB..', '.BBBbBBB.', 'BBBBBBBkB', 'BBbBBBBBB', 'BBBBBtBtB', '.BBBBBBB.', '..BBBBB..'], pal);
  const gape = spr(['..BBBBB..', '.BBBbBBBB', 'BBBBBBBkB', 'BBbBBBtBt', 'BBBBBmmmm', 'BBBBBtBtB', '.BBBBBBB.'], pal);
  const X = 256, Y = 128;
  const o = { name: 'anglerfish', caption: 'The anglerfish dangles its lure… and gulps', busy: false, tt: 0, gape: 0, shrimp: null };
  o.box = () => [X - 5, Y - 4, 18, 12];
  o.update = (dt, t) => {
    o.gape = Math.max(0, o.gape - dt * 3);
    if (!o.busy) return;
    o.tt += dt; const T0 = o.tt, lx = X - 6 + Math.sin(t * 1.5) * 1.5, ly = Y - 3;
    if (T0 < 2.4) { const k = T0 / 2.4; o.shrimp = { x: lerp(210, lx - 2, smooth(k)), y: lerp(150, ly + 1, smooth(k)) + Math.sin(T0 * 6) }; }
    else if (T0 < 2.6) { o.gape = 1; o.shrimp = null; if (!o.g) { o.g = true; sparkle(X - 2, Y + 2, 6, '#c8e8ff', '#6ab8ff'); ring(lx, ly, 12, '#8ad8ff', .6); } }
    else if (T0 > 3.2) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.g = false; };
  o.draw = t => {
    E.blit(o.gape > .3 ? gape : shut, X - 4, Y - 3, true);
    // the lure on its stalk
    const lx = X - 6 + Math.round(Math.sin(t * 1.5) * 1.5), ly = Y - 4, pu = .5 + .5 * Math.sin(t * 2.4);
    line(X, Y - 3, X - 2, Y - 6, '#4a4a5e'); line(X - 2, Y - 6, lx, ly - 1, '#4a4a5e');
    dot(lx, ly, pu > .5 ? '#ffffff' : '#c8f0ff'); light(lx + .5, ly + .5, 6 + pu * 4 + (o.busy ? 4 : 0), '#6ad8ff', .45 + .25 * pu);
    if (o.shrimp) { const s = o.shrimp; dot(s.x, s.y, '#ff9a8a'); dot(s.x + 1, s.y, '#ffb8a8'); dot(s.x - 1, s.y + 1, '#e87a6a'); light(s.x, s.y, 3, '#ff9a8a', .3); }
  };
  return o;
})();

/* ---------- PUFFERFISH ---------- */
const puffer = (() => {
  const pal = { Y: '#d8c070', y: '#a89040', w: '#f0e8d0', k: '#0a0a08', s: '#8a7030' };
  const slim = spr(['..YYYy..', '.YYYYkY.', 'yYwwwwYY', '.ywwwwY.', '..yyyy..'], pal);
  const puff = spr(['.s.s.s.s.', 's.YYYYY.s', '.YYYYYkY.', 'sYYwwwwYs', '.YwwwwwY.', 'sYwwwwwYs', '.yYwwwYy.', 's.yyyyy.s', '.s.s.s.s.'], pal);
  const o = { name: 'pufferfish', caption: 'The pufferfish puffs itself up', busy: false, tt: 0, x: 104, y: 150, dir: 1, big: false };
  o.box = () => [o.x - 5, o.y - 5, 10, 10];
  o.update = (dt, t) => {
    if (!o.busy) { o.x = 104 + Math.sin(t * .25) * 20; o.y = 150 + Math.sin(t * .6) * 4; o.dir = Math.cos(t * .25) >= 0 ? 1 : -1; return; }
    o.tt += dt; const T0 = o.tt;
    o.big = T0 > .4 && T0 < 2.8;
    if (T0 > .4 && !o.p1) { o.p1 = true; ring(o.x, o.y, 14, '#f0e0a0', .6); }
    if (T0 > 2.8 && !o.p2) { o.p2 = true; for (let i = 0; i < 12; i++) spawn({ x: o.x + rr(-3, 3), y: o.y + rr(-3, 3), vx: rr(-10, 10), vy: rr(-18, -6), wob: 3, life: rr(1.5, 3), col: pick(['#c8e8ff', '#8ac8ff']), fin: .05, fout: .8 }); }
    if (T0 > 3.4) o.busy = false;
  };
  o.trigger = () => { o.busy = true; o.tt = 0; o.p1 = o.p2 = false; };
  o.draw = () => { const s = o.big ? puff : slim; E.blit(s, o.x - s.width / 2, o.y - s.height / 2, o.dir < 0); if (o.big) light(o.x, o.y, 9, '#f0e0a0', .12); };
  return o;
})();

/* ---------- render ---------- */
const critters = [octo, jellies, turtle, angler, puffer];
function ambient(dt, t) { updBubbles(dt); updWay(dt); }
return {
  critters,
  entry: { x: 0, y: TY },
  exit: { x: BO.x, y: BO.y, r: 13 },
  ambient,
  vig: vignette(.6, .1, '1,3,10'),
  update(dt, t) { ambient(dt, t); for (const c of critters) c.update(dt, t); },
  draw(t) {
    p.globalAlpha = 1; p.drawImage(bg, 0, 0);
    drawCorals(t); drawKelp(t); drawAnem(t); drawSchool(t);
    drawWay(t);
    octo.draw(t); turtle.draw(t); angler.draw(t); puffer.draw(t); jellies.draw(t);
    E.drawParts();
    light(8, TY, 14, '#ff7a2a', .14);
  },
  under(g, t) {
    for (const [x, w, a] of [[70, 8, .05], [150, 12, .06], [230, 9, .045]]) E.beam(g, x + Math.sin(t * .2 + x) * 6, -4, x - 20, 200, w * .4, w, '#6ab8ff', a + .015 * Math.sin(t * .7 + x));
  },
  openExit: openWay
};
};
