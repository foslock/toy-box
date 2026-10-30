// Unlocked: one room, 33 achievements, and each one changes the room.
// The room is 720×540 world units, drawn to a canvas scaled to fit. Everything in it
// is derived from the set of achievements you've earned, plus a few toggles (hat,
// lights, bird) that are saved with it.

import { ACH, INDEX } from './data.js';
import { sfx, wake, isMuted, setMuted } from './sound.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), HOLD = Q.has('hold');
const W = 720, H = 540, STEP = 1 / 120;
const COL = { paper: '#ECE4D0', ink: '#191817', red: '#D63C26', blue: '#2152A3', yellow: '#F0B323', cream: '#FFF8E6' };
const MEDAL = [COL.red, COL.blue, COL.yellow];
const TOUCH = matchMedia('(pointer: coarse)').matches;

// ---- tuning
const SPEED = 230, GRAV = 1800, JUMP = 620, SPRING = 1300, MAXFALL = 950;
const START = { x: 50, y: 488 };

// ---- saved state
const KEY = 'unlocked.v1';
function blank() {
  return { got: [], stats: { jumps: 0, deaths: 0, dist: 0 }, shards: [0, 0, 0, 0, 0], hat: 'ceiling', lights: 1, bird: 'none', ball: 'shelf', seen: 0 };
}
let S = blank();
if (!DEMO) try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.got)) S = Object.assign(blank(), s); } catch {}
let got = new Set(S.got);
const returning = got.size > 0;
const has = id => got.has(id);
let dirty = false;
function save() {
  if (DEMO) return;
  S.got = [...got];
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
  dirty = false;
}

// when each thing appeared, for the pop-in; things loaded from the save are already there
const born = {};
const bornAt = id => born[id] ?? -99;

// ---- the room
const R = (id, x, y, w, h, kind) => ({ id, x, y, w, h, kind });
let rects = [];
function buildRoom() {
  const door = has('deed');
  rects = [
    R('L', -60, -60, 90, door ? 510 : 660, 'wall'),
    R('R', 690, -60, 90, door ? 510 : 660, 'wall'),
    R('C', -60, -60, 840, 90, 'wall'),
    R('F', -60, 510, 840, 90, 'wall'),
  ];
  if (has('hello')) rects.push(R('P1', 90, 450, 120, 60, 'block'));
  if (has('up')) rects.push(R('P2', 270, 390, 120, 12, 'oneway'));
  if (has('duck')) rects.push(R('P3', 450, 330, 120, 12, 'oneway'), R('P4', 600, 270, 90, 30, 'block'));
  if (has('headbutt')) rects.push(R('P5', 30, 210, 120, 30, 'block'), R('P6', 270, 240, 120, 12, 'oneway'));
  if (has('hat')) rects.push(R('P7', 480, 120, 90, 30, 'block'));
}
const rectBorn = { P1: 'hello', P2: 'up', P3: 'duck', P4: 'duck', P5: 'headbutt', P6: 'headbutt', P7: 'hat' };

const SPRING_R = { x: 225, y: 498, w: 30, h: 12 };
const SPIKES = { x: 420, y: 494, w: 60, h: 16 };
const SHARDS = [[150, 405], [95, 150], [240, 70], [660, 488], [645, 228]];
const FLOORPAD = { x: 182, y: 440, w: 26, h: 10 };
const CEILPAD = { x: 525, y: 30, w: 30, h: 10 };
const HAT_AT = { x: 100, y: 30 };
const STAND = { x: 62, y: 158, w: 22, h: 52 };
const BALL_AT = { x: 525, y: 107 };
const SQUARE = { x: 545, y: 480, w: 30, h: 30 };
const CORD = { x: 290, y: 140 };
const STAR = { x: 48, y: 330 };
const TROPHY = { x: 360, y: 186 };

// ---- the poster in the background: one shape per achievement
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const POSTER = (() => {
  const rnd = mulberry(58), out = [];
  const cols = [COL.red, COL.blue, COL.yellow, COL.ink];
  const kinds = ['quarter', 'half', 'circle', 'bar', 'tri', 'ring', 'square', 'quarter', 'half', 'dots'];
  // 24 cells of a 6×4 grid, shuffled, then 9 big shapes over the top
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) cells.push([c, r]);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  for (let i = 0; i < 24; i++) {
    const [c, r] = cells[i];
    out.push({ kind: kinds[Math.floor(rnd() * kinds.length)], x: 30 + c * 110 + 55, y: 30 + r * 120 + 60, s: 50, rot: Math.floor(rnd() * 4), col: cols[i % 4] });
  }
  const big = [
    { kind: 'circle', x: 520, y: 200, s: 150, col: COL.red },
    { kind: 'bar', x: 200, y: 300, s: 260, rot: 0, col: COL.ink },
    { kind: 'half', x: 160, y: 120, s: 120, rot: 2, col: COL.blue },
    { kind: 'quarter', x: 600, y: 420, s: 140, rot: 1, col: COL.yellow },
    { kind: 'ring', x: 330, y: 380, s: 110, col: COL.blue },
    { kind: 'tri', x: 430, y: 110, s: 100, rot: 0, col: COL.yellow },
    { kind: 'bar', x: 610, y: 260, s: 200, rot: 1, col: COL.red },
    { kind: 'dots', x: 100, y: 430, s: 80, col: COL.ink },
    { kind: 'circle', x: 300, y: 160, s: 60, col: COL.yellow },
  ];
  for (let i = 0; i < 9; i++) out.splice(Math.floor(rnd() * out.length), 0, big[i]);
  return out;
})();

// ---- player
const P = { x: START.x, y: START.y, w: 22, h: 22, vx: 0, vy: 0, g: 1, ground: false, on: null, coyote: 0, buffer: 0, jumping: false,
  usedDouble: false, dropT: 0, face: 1, peak: START.y, dead: false, deadT: 0, squash: 0, carry: false, idle: 0, prevY: START.y };
let T = 0;
const keys = { left: false, right: false, jump: false, down: false };
let jumpEdge = false, downEdge = false, duckTap = false;
const touches = { left: false, right: false };
const wallT = { L: -99, R: -99 };
const presses = [];
let shake = 0, flash = 0;
let padTouch = { floor: true, ceil: true, stand: true, cord: true, square: true };
let dark = S.lights ? 0 : 1;
let squareSay = '', squareSayT = 0;
const birdFly = { t: -1, x: 0, y: 0 };
const parts = [];

function respawn() {
  Object.assign(P, { x: START.x, y: START.y, vx: 0, vy: 0, g: 1, dead: false, ground: false, peak: START.y, dropT: 0, squash: 0, jumping: false });
}

// ---- unlocking
const queue = [];
function unlock(id) {
  if (has(id) || DEMO && !demoLive) return;
  got.add(id);
  born[id] = T;
  buildRoom();
  queue.push(id);
  if (id === 'still') S.bird = 'head';
  if (id === 'hat') sayInit();
  if (id === 'deed') { squareSay = 'my ball! thank you!'; squareSayT = T + 4; }
  burst(P.x + 11, P.y + 11, 18);
  save();
  renderList(id);
  // the last one waits for its trophy, which appears once everything else is done
}
function sayInit() { squareSay = 'my ball’s on the top shelf'; squareSayT = 1e9; }
const allButLast = () => ACH.every(a => a.id === 'unlocked' || has(a.id));

// ---- particles
function burst(x, y, n, cols = MEDAL, sp = 260) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = sp * (.3 + Math.random() * .7);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: .7 + Math.random() * .5, t: 0, col: cols[i % cols.length], kind: i % 3, rot: Math.random() * 6, s: 4 + Math.random() * 5 });
  }
}

// ---- simulation
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const near = (p, x, y, r) => { const cx = p.x + p.w / 2, cy = p.y + p.h / 2; return (cx - x) ** 2 + (cy - y) ** 2 < (r + 11) ** 2; };
const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);

function die() {
  if (P.dead) return;
  P.dead = true; P.deadT = .9;
  sfx('die'); shake = .35;
  burst(P.x + 11, P.y + 11, 26, [COL.red, COL.red, COL.ink], 340);
  S.stats.deaths++; dirty = true;
  unlock('ouch');
  if (S.hat === 'on') unlock('dressed');
  if (S.stats.deaths >= 5) unlock('setbacks');
  if (P.carry) { P.carry = false; S.ball = 'shelf'; }
  if (S.bird === 'head') shoo();
}
function shoo() {
  S.bird = 'perch'; birdFly.t = T; birdFly.x = P.x + 11; birdFly.y = P.y - 6 * P.g; sfx('bird');
  unlock('shoo');
}

function step(dt) {
  T += dt;
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.rot += dt * 6; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t > parts[i].life) parts.splice(i, 1);
  shake = Math.max(0, shake - dt);
  dark += ((S.lights ? 0 : 1) - dark) * Math.min(1, dt * 6);

  if (P.dead) { P.deadT -= dt; if (P.deadT <= 0) respawn(); jumpEdge = downEdge = false; return; }

  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir) { P.face = dir; unlock('hello'); }
  P.vx = approach(P.vx, dir * SPEED, (P.ground ? 2600 : 1700) * dt);

  if (jumpEdge) {
    P.buffer = .12;
    presses.push(T); while (presses.length && presses[0] < T - 2) presses.shift();
    if (presses.length >= 10) unlock('mash');
  }
  P.buffer -= dt;
  P.coyote = P.ground ? .09 : P.coyote - dt;
  if (P.buffer > 0) {
    if (P.coyote > 0) doJump(false);
    else if (S.hat === 'on' && !P.usedDouble) doJump(true);
  }
  if (!keys.jump && P.jumping && P.vy * P.g < -200) { P.vy *= .5; P.jumping = false; }
  if (P.vy * P.g >= 0) P.jumping = false;

  duckTap = downEdge && P.ground;
  if (downEdge && P.ground) {
    unlock('duck');
    if (P.on?.kind === 'oneway') { P.dropT = .22; P.ground = false; P.y += 2 * P.g; unlock('drop'); }
  }
  jumpEdge = downEdge = false;
  P.dropT -= dt;

  P.vy += GRAV * P.g * dt;
  if (Math.abs(P.vy) > MAXFALL && P.vy * P.g > 0) P.vy = MAXFALL * P.g;

  // x
  const ox = P.x;
  P.x += P.vx * dt;
  for (const r of rects) {
    if (r.kind === 'oneway' || !overlap(P, r)) continue;
    if (P.x + P.w / 2 < r.x + r.w / 2) P.x = r.x - P.w; else P.x = r.x + r.w;
    P.vx = 0;
  }
  // y
  const wasGround = P.ground;
  P.prevY = P.y; P.y += P.vy * dt; P.ground = false; P.on = null;
  for (const r of rects) {
    if (!overlap(P, r)) continue;
    if (r.kind === 'oneway') {
      if (P.dropT > 0) continue;
      if (P.g > 0 ? (P.vy < 0 || P.prevY + P.h > r.y + .5) : (P.vy > 0 || P.prevY < r.y + r.h - .5)) continue;
    }
    const down = P.vy > 0 || (P.vy === 0 && P.y + P.h / 2 < r.y + r.h / 2);
    if (down) P.y = r.y - P.h; else P.y = r.y + r.h;
    const landing = down === (P.g > 0);
    if (landing) { P.ground = true; P.on = r; }
    else if (Math.abs(P.vy) > 120) {
      if (r.id === 'C' && P.g > 0) { unlock('headbutt'); shake = .2; }
      sfx('bump'); P.squash = -.3;
    }
    P.vy = 0;
  }
  if (P.ground) {
    if (!wasGround) {
      const fall = P.g > 0 ? P.y - P.peak : P.peak - P.y;
      if (fall > 380 && P.g > 0) unlock('longway');
      if (fall > 30) { sfx('land'); P.squash = Math.min(.45, fall / 600); }
    }
    P.usedDouble = false; P.peak = P.y;
    if (P.on.id === 'P4') unlock('highground');
    S.stats.dist += Math.abs(P.x - ox);
    if (S.stats.dist > 12000) unlock('stroll');
  } else {
    P.peak = P.g > 0 ? Math.min(P.peak, P.y) : Math.max(P.peak, P.y);
  }
  P.squash *= Math.pow(.0001, dt);

  // walls (not counting the doorways)
  // walking out through a doorway counts as touching that wall
  if (P.x <= 30.5) touchWall('L');
  if (P.x + P.w >= 689.5) touchWall('R');

  // the doors wrap round
  if (P.x > W) { P.x -= W + P.w; unlock('door'); sfx('door'); }
  else if (P.x < -P.w) { P.x += W + P.w; unlock('door'); sfx('door'); }

  // idle → bird
  const still = !dir && !keys.jump && !keys.down && P.ground && Math.abs(P.vx) < 1;
  P.idle = still ? P.idle + dt : 0;
  if (P.idle > 10 && !has('still')) { unlock('still'); sfx('bird'); }
  if (S.bird === 'head' && (dir || !P.ground)) shoo();

  interact();
}

function doJump(dbl) {
  P.vy = -JUMP * P.g; P.buffer = 0; P.coyote = 0; P.jumping = true; P.ground = false; P.squash = -.25;
  if (dbl) { P.usedDouble = true; unlock('double'); sfx('double'); burst(P.x + 11, P.y + (P.g > 0 ? 22 : 0), 6, [COL.yellow], 120); }
  else sfx('jump');
  S.stats.jumps++; dirty = true;
  unlock('up');
  if (S.stats.jumps >= 50) unlock('flyer');
}

function touchWall(side) {
  wallT[side] = T;
  const other = side === 'L' ? 'R' : 'L';
  if (wallT[other] > 0) unlock('walls');
  if (T - wallT[other] < 4) unlock('sprint');
}

function interact() {
  // spring
  if (has('highground') && P.g > 0 && P.vy >= 0 && overlap(P, SPRING_R)) {
    if (P.y - P.peak > 380) unlock('longway');
    P.vy = -SPRING; P.jumping = false; P.usedDouble = false; P.ground = false; P.peak = P.y;
    springT = T; sfx('spring'); unlock('boing');
  }
  // spikes
  if (has('highground') && overlap(P, { x: SPIKES.x + 4, y: SPIKES.y + 6, w: SPIKES.w - 8, h: SPIKES.h - 6 })) { die(); return; }
  // shards
  if (has('headbutt')) SHARDS.forEach(([x, y], i) => {
    if (!S.shards[i] && near(P, x, y, 10)) {
      S.shards[i] = 1; dirty = true; sfx('pickup'); burst(x, y, 10, [COL.yellow, COL.ink], 160);
      unlock('shard');
      if (S.shards.every(Boolean)) unlock('fullset');
    }
  });
  if (has('fullset')) {
    // the pads flip gravity, one each way
    // the arrow pads flip gravity when you duck on them, one each way
    onPad = P.ground && (P.g > 0 ? overlap(P, FLOORPAD) : overlap(P, CEILPAD));
    if (onPad && duckTap) {
      P.g = -P.g; P.vy = 200 * P.g; P.ground = false; P.peak = P.y; sfx('flip');
      unlock(P.g < 0 ? 'topsy' : 'rightway');
    }
    if (S.hat === 'ceiling' && near(P, HAT_AT.x, HAT_AT.y + 10, 12)) { S.hat = 'on'; sfx('pickup'); unlock('hat'); }
  }
  if (has('double') && S.hat !== 'ceiling') {
    const at = overlap(P, STAND);
    if (at && padTouch.stand) {
      if (S.hat === 'on') { S.hat = 'stand'; sfx('pickup'); unlock('hatless'); }
      else { S.hat = 'on'; sfx('pickup'); }
      dirty = true;
    }
    padTouch.stand = !at;
  }
  if (has('hat')) {
    if (S.ball === 'shelf' && near(P, BALL_AT.x, BALL_AT.y, 15)) { S.ball = 'carry'; P.carry = true; sfx('pickup'); }
    const atSq = overlap(P, SQUARE);
    if (S.ball === 'carry' && atSq) { S.ball = 'home'; P.carry = false; sfx('pickup'); unlock('deed'); }
    else if (atSq && padTouch.square && S.ball !== 'home') { squareSayT = Math.max(squareSayT, T + 2.5); }
    padTouch.square = !atSq;
  }
  if (has('double')) {
    const at = near(P, CORD.x, CORD.y, 10);
    if (at && padTouch.cord) {
      S.lights = S.lights ? 0 : 1; dirty = true; sfx('cord'); cordT = T;
      unlock(S.lights ? 'lightson' : 'lightsout');
    }
    padTouch.cord = !at;
  }
  if (has('lightsout') && !S.lights && dark > .6 && !has('glow') && near(P, STAR.x, STAR.y, 12)) {
    sfx('pickup'); burst(STAR.x, STAR.y, 16, [COL.yellow, COL.cream], 200); unlock('glow');
  }
  if (allButLast() && !has('unlocked') && near(P, TROPHY.x, TROPHY.y, 18)) finale();
}
let springT = -9, cordT = -9, onPad = false;

function finale() {
  unlock('unlocked');
  sfx('fanfare');
  for (let i = 0; i < 6; i++) setTimeout(() => burst(100 + Math.random() * 520, 80 + Math.random() * 200, 30, [...MEDAL, COL.ink], 400), i * 220);
  setTimeout(() => { if (!DEMO) document.getElementById('end').hidden = false; }, 2800);
}

// ---- input
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', ArrowDown: 'down', KeyS: 'down' };
addEventListener('keydown', e => {
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (!titleEl.hidden) { if (e.code === 'Enter' || e.code === 'Space') { begin(); e.preventDefault(); } return; }
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  wake();
  if (!keys[k]) { if (k === 'jump') jumpEdge = true; if (k === 'down') downEdge = true; }
  keys[k] = true;
});
document.addEventListener('click', e => e.target.closest?.('button')?.blur());
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const padOwners = new Map();
document.querySelectorAll('.pb').forEach(b => {
  const k = b.dataset.k;
  const down = e => {
    e.preventDefault(); wake();
    b.setPointerCapture?.(e.pointerId);
    padOwners.set(e.pointerId, k);
    if (!keys[k]) { if (k === 'jump') jumpEdge = true; if (k === 'down') downEdge = true; }
    keys[k] = true; b.classList.add('on');
  };
  const up = e => {
    if (padOwners.get(e.pointerId) !== k) return;
    padOwners.delete(e.pointerId);
    if (![...padOwners.values()].includes(k)) { keys[k] = false; b.classList.remove('on'); }
  };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});

// ---- UI: list, banners, title
const listEl = document.getElementById('list'), sideEl = document.getElementById('side');
const titleEl = document.getElementById('title');
const revealed = new Set();
function medalCol(i) { return MEDAL[i % 3]; }
function renderList(fresh) {
  listEl.innerHTML = '';
  ACH.forEach((a, i) => {
    const li = document.createElement('li');
    const mine = has(a.id);
    li.className = mine ? 'got' : 'locked' + (revealed.has(a.id) ? ' shown' : '');
    if (a.id === fresh) li.classList.add('fresh');
    const m = document.createElement('div'); m.className = 'm'; m.textContent = i + 1;
    if (mine) { m.style.background = medalCol(i); m.style.color = i % 3 === 1 ? COL.paper : COL.ink; }
    const t = document.createElement('div');
    t.innerHTML = `<div class="n"></div><div class="d"></div>`;
    t.firstChild.textContent = mine ? a.name : '???';
    t.lastChild.textContent = mine ? a.desc : revealed.has(a.id) ? a.hint : 'Tap for a hint';
    li.append(m, t);
    li.addEventListener('click', () => {
      if (mine) return;
      sfx('tap');
      revealed.add(a.id);
      li.classList.add('shown'); t.lastChild.textContent = a.hint;
      unlock('lookup');
    });
    listEl.append(li);
  });
  const n = got.size;
  document.querySelectorAll('#count .num, #side .of').forEach(e => e.textContent = `${n}/${ACH.length}`);
  document.querySelector('#bar span').style.width = (n / ACH.length * 100) + '%';
}

const bannersEl = document.getElementById('banners');
let bannerBusy = 0;
function pumpBanners() {
  const now = performance.now() / 1000;
  if (bannerBusy > now || !queue.length) return;
  const id = queue.shift(), i = INDEX[id], a = ACH[i];
  const b = document.createElement('div'); b.className = 'banner';
  b.innerHTML = `<div class="medal"></div><div><div class="kicker">Achievement unlocked · ${got.size}/${ACH.length}</div><div class="title"></div><div class="desc"></div></div>`;
  const m = b.querySelector('.medal'); m.textContent = i + 1; m.style.background = medalCol(i); if (i % 3 === 1) m.style.color = COL.paper;
  b.querySelector('.title').textContent = a.name;
  b.querySelector('.desc').textContent = a.desc;
  bannersEl.append(b);
  requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('in')));
  sfx('unlock', i);
  const hold = queue.length ? 1.6 : 2.6;
  bannerBusy = now + hold + .35;
  setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 400); }, hold * 1000);
}

const countBtn = document.getElementById('count');
countBtn.addEventListener('click', () => { sideEl.classList.toggle('open'); sfx('tap'); seenList(); });
document.getElementById('close').addEventListener('click', () => sideEl.classList.remove('open'));
function seenList() { if (!S.seen) { S.seen = 1; dirty = true; } }
listEl.addEventListener('pointerdown', seenList);
const resetBtn = document.getElementById('reset');
let resetArm = 0;
resetBtn.addEventListener('click', () => {
  if (T < resetArm) { wipe(); return; }
  resetArm = T + 3; resetBtn.textContent = 'Sure? Tap again'; resetBtn.classList.add('sure');
  setTimeout(() => { resetBtn.textContent = 'Start over'; resetBtn.classList.remove('sure'); }, 3000);
});
function wipe() {
  S = blank(); got = new Set(); revealed.clear(); queue.length = 0;
  try { localStorage.removeItem(KEY); } catch {}
  S.lights = 1; dark = 0; P.carry = false; respawn(); buildRoom(); renderList();
  sideEl.classList.remove('open'); document.getElementById('end').hidden = true;
  resetBtn.textContent = 'Start over'; resetBtn.classList.remove('sure');
}

const muteBtn = document.getElementById('mute');
const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#191817"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#191817" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#191817"/><path d="M16 9l6 6M22 9l-6 6" stroke="#D63C26" stroke-width="2.6" stroke-linecap="round"/></svg>';
function toggleMute() { setMuted(!isMuted()); muteBtn.innerHTML = isMuted() ? ICON_OFF : ICON_ON; }
muteBtn.innerHTML = isMuted() ? ICON_OFF : ICON_ON;
muteBtn.addEventListener('click', () => { wake(); toggleMute(); });

let started = false;
function begin() {
  if (started) return;
  started = true; wake(); titleEl.hidden = true;
  if (returning) setTimeout(() => unlock('back'), 900);
}
document.getElementById('start').addEventListener('click', begin);
document.getElementById('keep').addEventListener('click', () => document.getElementById('end').hidden = true);
document.getElementById('again').addEventListener('click', wipe);
if (TOUCH) document.getElementById('keyhelp').innerHTML = 'Use the buttons under the room: <b>◀ ▶</b> move, <b>▲</b> jump, <b>▼</b> duck.';
if (returning) document.getElementById('start').textContent = `Continue · ${got.size}/${ACH.length}`;

// ---- drawing
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const frameEl = document.getElementById('frame'), stageEl = document.getElementById('stage');
const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
let scale = 1, dpr = 1;
function fit() {
  const cs = getComputedStyle(stageEl);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  let aw, ah;
  if (getComputedStyle(document.getElementById('app')).gridTemplateRows.split(' ').length === 3) {
    // upright: the room's row is sized from the room, so measure the window, leaving room for the buttons
    aw = innerWidth - padX; ah = innerHeight - 56 - padY - 190;
  } else {
    aw = stageEl.clientWidth - padX; ah = stageEl.clientHeight - padY;
  }
  let w = aw, h = aw * H / W;
  if (h > ah) { h = ah; w = h * W / H; }
  w = Math.floor(w); h = Math.floor(h);
  frameEl.style.width = w + 'px'; frameEl.style.height = h + 'px';
  dpr = Math.min(2.5, devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  mask.width = cv.width; mask.height = cv.height;
  scale = w / W;
}
addEventListener('resize', fit);
new ResizeObserver(fit).observe(stageEl);

const pop = (id, dur = .5) => {
  const t = (T - bornAt(id)) / dur;
  if (t >= 1) return 1;
  if (t <= 0) return 0;
  return 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2); // ease out back
};

function drawPoster() {
  POSTER.forEach((s, i) => {
    const id = ACH[i].id;
    if (!has(id)) return;
    const k = pop(id, .7);
    if (k <= 0) return;
    ctx.save();
    ctx.translate(s.x, s.y); ctx.scale(k, k); ctx.rotate((s.rot || 0) * Math.PI / 2);
    ctx.globalAlpha = s.col === COL.ink ? .09 : .2;
    ctx.fillStyle = ctx.strokeStyle = s.col;
    const r = s.s;
    ctx.beginPath();
    switch (s.kind) {
      case 'circle': ctx.arc(0, 0, r, 0, 7); ctx.fill(); break;
      case 'half': ctx.arc(0, r / 2, r, Math.PI, 0); ctx.fill(); break;
      case 'quarter': ctx.moveTo(-r / 2, -r / 2); ctx.arc(-r / 2, -r / 2, r, 0, Math.PI / 2); ctx.fill(); break;
      case 'bar': ctx.fillRect(-r / 2, -r / 10, r, r / 5); break;
      case 'tri': ctx.moveTo(0, -r * .6); ctx.lineTo(r * .6, r * .5); ctx.lineTo(-r * .6, r * .5); ctx.fill(); break;
      case 'ring': ctx.lineWidth = r / 4; ctx.arc(0, 0, r * .8, 0, 7); ctx.stroke(); break;
      case 'square': ctx.fillRect(-r * .45, -r * .45, r * .9, r * .9); break;
      case 'dots': for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { ctx.moveTo(-r / 2 + a * r / 2 + r / 9, -r / 2 + b * r / 2); ctx.arc(-r / 2 + a * r / 2, -r / 2 + b * r / 2, r / 9, 0, 7); } ctx.fill(); break;
    }
    ctx.restore();
  });
}

function label(text, x, y, size, col = COL.ink, align = 'center', font = 'Archivo Black') {
  ctx.font = `${size}px '${font}'`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col;
  ctx.fillText(text, x, y);
}

function drawTutorial() {
  // the lessons are painted on the poster, one at a time
  let big = null, small = null;
  if (!has('hello')) { big = TOUCH ? '◀  ▶' : '←  →'; small = 'to move'; }
  else if (!has('up')) { big = TOUCH ? '▲' : 'SPACE'; small = 'to jump'; }
  else if (!has('duck')) { big = TOUCH ? '▼' : '↓'; small = 'to duck'; }
  else if (!has('highground')) { big = 'CLIMB'; small = 'you earned those shelves'; }
  if (!big) return;
  const a = Math.min(1, (T - Math.max(bornAt('hello'), bornAt('up'), bornAt('duck'), 0)) * 2);
  ctx.globalAlpha = Math.max(0, a) * .88;
  label(big, 360, 175, big.length > 4 ? 64 : 84);
  label(small.toUpperCase(), 360, 240, small.length > 12 ? 22 : 28, COL.ink, 'center', 'Archivo Black');
  ctx.globalAlpha = 1;
}

function drawRoom() {
  ctx.fillStyle = COL.ink;
  for (const r of rects) {
    const k = rectBorn[r.id] ? pop(rectBorn[r.id], .45) : 1;
    if (k <= 0) continue;
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(k, k); ctx.translate(-r.x - r.w / 2, -r.y - r.h / 2);
    if (r.kind === 'oneway') {
      ctx.fillRect(r.x, r.y, r.w, 6);
      for (let x = r.x + 4; x < r.x + r.w - 2; x += 10) ctx.fillRect(x, r.y + 6, 4, 6);
    } else if (r.kind === 'block') {
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // a colour stripe per block, so the shelves read as poster pieces
      ctx.fillStyle = { P1: COL.blue, P4: COL.red, P5: COL.yellow, P7: COL.blue }[r.id] || COL.ink;
      ctx.fillRect(r.x + 6, r.y + 6, r.w - 12, 6);
      ctx.fillStyle = COL.ink;
    } else ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  // door frames
  if (has('deed')) {
    const k = pop('deed');
    ctx.fillStyle = COL.yellow;
    ctx.fillRect(22, 450 - 8 * k, 8, 8 * k); ctx.fillRect(690, 450 - 8 * k, 8, 8 * k);
  }
}

function drawThings() {
  // spikes
  if (has('highground')) {
    const k = pop('highground');
    ctx.fillStyle = COL.red; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const x = SPIKES.x + i * 15; ctx.moveTo(x, 510); ctx.lineTo(x + 7.5, 510 - 16 * k); ctx.lineTo(x + 15, 510); }
    ctx.fill();
    // spring
    const sq = Math.max(0, 1 - (T - springT) * 4);
    const top = 510 - (16 - 9 * Math.sin(Math.min(1, (T - springT) * 4) * Math.PI) * (sq > 0 ? 1 : 0)) * k;
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 3; ctx.beginPath();
    const sx = SPRING_R.x;
    for (let i = 0; i <= 4; i++) { const y = 510 - (510 - top) * i / 4; ctx.lineTo(sx + (i % 2 ? 25 : 5), y); }
    ctx.stroke();
    ctx.fillStyle = COL.yellow; ctx.fillRect(sx - 2, top - 6, 34, 7);
    ctx.strokeRect(sx - 2, top - 6, 34, 7);
  }
  // shards
  if (has('headbutt')) SHARDS.forEach(([x, y], i) => {
    if (S.shards[i]) return;
    const k = pop('headbutt', .6 + i * .1), bob = Math.sin(T * 3 + i) * 3;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(k, k); ctx.rotate(Math.sin(T * 2 + i) * .2);
    ctx.fillStyle = COL.yellow; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  });
  // gravity pads
  if (has('fullset')) {
    const k = pop('fullset');
    pad(FLOORPAD.x + 13, 450, 1, k, P.g < 0);
    pad(CEILPAD.x + 15, 30, -1, k, P.g > 0);
    if (S.hat === 'ceiling') hat(HAT_AT.x, 30, -1, k);
    if (onPad && !P.dead) {
      const g = P.g, y = g > 0 ? P.y - 26 - (S.hat === 'on' ? 18 : 0) : P.y + P.h + 26 + (S.hat === 'on' ? 18 : 0), b = Math.sin(T * 8) * 3;
      ctx.fillStyle = COL.ink; ctx.beginPath();
      ctx.moveTo(P.x + 4, y + b * g - 6 * g); ctx.lineTo(P.x + 18, y + b * g - 6 * g); ctx.lineTo(P.x + 11, y + b * g + 4 * g); ctx.fill();
      label(TOUCH ? '\u25BC' : 'DUCK', P.x + 11, y + b * g - 16 * g, 11);
    }
  }
  // hat stand on the top-left shelf
  if (has('double')) {
    const k = pop('double');
    ctx.save(); ctx.translate(STAND.x + 11, 210); ctx.scale(k, k);
    ctx.fillStyle = COL.ink; ctx.fillRect(-2, -50, 4, 50); ctx.fillRect(-10, -3, 20, 3); ctx.fillRect(-8, -50, 16, 3);
    ctx.restore();
    if (S.hat === 'stand') hat(STAND.x + 11, 160, 1, 1);
    // light cord
    const sw = Math.sin((T - cordT) * 14) * Math.max(0, 1 - (T - cordT) * 1.5) * .25;
    ctx.save(); ctx.translate(CORD.x, 30); ctx.rotate(sw); ctx.scale(1, k);
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, CORD.y - 38); ctx.stroke();
    ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(0, CORD.y - 30, 8, 0, 7); ctx.fill();
    ctx.restore();
  }
  // Square, the ball, the top shelf
  if (has('hat')) {
    const k = pop('hat', .8);
    const hop = S.ball === 'home' ? Math.abs(Math.sin(T * 4)) * 8 : 0;
    ctx.save(); ctx.translate(SQUARE.x + 15, 510 - hop); ctx.scale(k, k);
    ctx.fillStyle = COL.blue; ctx.fillRect(-15, -30, 30, 30);
    const look = Math.max(-2, Math.min(2, (P.x - SQUARE.x) / 60));
    ctx.fillStyle = COL.paper; ctx.fillRect(-9, -22, 7, 7); ctx.fillRect(3, -22, 7, 7);
    ctx.fillStyle = COL.ink; ctx.fillRect(-7 + look, -20, 3, 3); ctx.fillRect(5 + look, -20, 3, 3);
    ctx.fillRect(-5, -9, 10, 2);
    ctx.restore();
    if (S.ball === 'home') ball(SQUARE.x - 10, 498 - Math.abs(Math.sin(T * 4 + 1.6)) * 14);
    else if (S.ball === 'shelf') ball(BALL_AT.x, BALL_AT.y + 1);
    if (squareSay && T < squareSayT && k >= 1) bubble(squareSay, SQUARE.x + 15, 462);
  }
  // the hidden star only shows in the dark
  if (has('lightsout') && !has('glow') && dark > .05) {
    ctx.save(); ctx.globalAlpha = dark; ctx.translate(STAR.x, STAR.y); ctx.rotate(T);
    star(0, 0, 10, COL.yellow); ctx.restore();
  }
  // the trophy
  if (allButLast() && !has('unlocked')) {
    const bob = Math.sin(T * 2.5) * 4;
    ctx.save(); ctx.translate(TROPHY.x, TROPHY.y + bob);
    ctx.fillStyle = COL.yellow; ctx.strokeStyle = COL.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -4, 14, 0, Math.PI); ctx.lineTo(-14, -14); ctx.lineTo(14, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.ink; ctx.fillRect(-3, 10, 6, 8); ctx.fillRect(-10, 18, 20, 5);
    ctx.restore();
  }
  // perched bird
  if (S.bird === 'perch') {
    const t = Math.min(1, (T - birdFly.t) / 1.2);
    const x = birdFly.t < 0 ? 680 : birdFly.x + (680 - birdFly.x) * t, y = birdFly.t < 0 ? 270 : birdFly.y + (270 - birdFly.y) * t - Math.sin(t * Math.PI) * 80;
    bird(x, y, t < 1 ? Math.sin(T * 30) : 0, -1);
  }
}

function pad(x, y, dir, k, live) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k * dir);
  ctx.fillStyle = live ? COL.blue : '#7d8bb0';
  ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI, 0); ctx.fill();
  ctx.fillStyle = COL.paper;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, -4); ctx.lineTo(2, -4); ctx.lineTo(2, 0); ctx.lineTo(-2, 0); ctx.lineTo(-2, -4); ctx.lineTo(-6, -4); ctx.fill();
  ctx.restore();
}
function hat(x, y, dir, k) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k * dir);
  ctx.fillStyle = COL.yellow; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(0, -20); ctx.lineTo(9, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.red; ctx.beginPath(); ctx.moveTo(-5, -9); ctx.lineTo(5, -9); ctx.lineTo(6.4, -6); ctx.lineTo(-6.4, -6); ctx.fill();
  ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(0, -21, 3.5, 0, 7); ctx.fill();
  ctx.restore();
}
function ball(x, y) {
  ctx.fillStyle = COL.yellow; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(x, y, 11, -.6, .6); ctx.lineTo(x, y); ctx.fill();
}
function star(x, y, r, col) {
  ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.fill();
}
function bird(x, y, flap, face) {
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  ctx.fillStyle = COL.blue; ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.lineTo(8, 2); ctx.lineTo(-8, 2); ctx.fill();
  ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-13, -1); ctx.lineTo(-8, 1); ctx.fill();
  ctx.fillStyle = COL.paper; ctx.beginPath(); ctx.arc(-4, -3, 2, 0, 7); ctx.fill();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(-4.5, -3, 1, 0, 7); ctx.fill();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.moveTo(-1, -2); ctx.lineTo(7, -2 - 8 * flap); ctx.lineTo(6, 1); ctx.fill();
  ctx.restore();
}
function bubble(text, x, y) {
  ctx.font = "700 19px 'Archivo Narrow'";
  const w = ctx.measureText(text).width + 16, bx = Math.min(684 - w, Math.max(36, x - w / 2));
  ctx.fillStyle = COL.paper; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.rect(bx, y - 34, w, 28); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x, y + 2); ctx.lineTo(x + 5, y - 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.paper; ctx.fillRect(x - 4, y - 8, 8, 3);
  ctx.fillStyle = COL.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + 8, y - 19);
}

function drawPlayer() {
  if (P.dead) return;
  const cx = P.x + P.w / 2, g = P.g;
  const footY = g > 0 ? P.y + P.h : P.y;
  const duck = keys.down && P.ground ? .3 : 0;
  const sq = Math.max(-.35, Math.min(.5, P.squash + duck)) - (P.ground ? 0 : Math.min(.2, Math.abs(P.vy) / 4000));
  const sx = 1 + sq * .6, sy = 1 - sq;
  ctx.save(); ctx.translate(cx, footY); ctx.scale(sx, sy * g);
  // body: a red disc with a black base, sitting on its feet
  ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(0, -11, 11, 0, 7); ctx.fill();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(0, -11, 11, .15 * Math.PI, .85 * Math.PI); ctx.fill();
  // eye looks where you're going (and up while rising)
  const ex = P.face * 3.5, ey = -14 + Math.max(-2, Math.min(2, P.vy * g / 300));
  ctx.fillStyle = COL.paper; ctx.beginPath(); ctx.arc(ex, ey, 4.6, 0, 7); ctx.fill();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(ex + P.face * 1.8, ey, 2.2, 0, 7); ctx.fill();
  if (P.idle > 4 && Math.sin(T * 3) > .97) { ctx.fillStyle = COL.red; ctx.fillRect(ex - 5, ey - 5, 10, 5); }
  ctx.restore();
  // what's on your head
  const topY = g > 0 ? P.y : P.y + P.h;
  let stack = 0;
  if (S.hat === 'on') { hat(cx, topY + 2 * g, g, 1); stack = 16; }
  if (P.carry) ball(cx, topY - (10 + stack) * g);
  if (S.bird === 'head') bird(cx + 2, topY - (5 + stack) * g, 0, P.face);
}

function drawParts() {
  for (const p of parts) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.col;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (p.kind === 0) { ctx.beginPath(); ctx.arc(0, 0, p.s / 1.6, 0, 7); ctx.fill(); }
    else if (p.kind === 1) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
    else { ctx.beginPath(); ctx.moveTo(0, -p.s / 1.4); ctx.lineTo(p.s / 1.4, p.s / 2); ctx.lineTo(-p.s / 1.4, p.s / 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawDark() {
  if (dark < .01) return;
  const s = scale * dpr;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.globalCompositeOperation = 'source-over';
  mctx.clearRect(0, 0, mask.width, mask.height);
  mctx.fillStyle = `rgba(14,13,24,${.9 * dark})`;
  mctx.fillRect(0, 0, mask.width, mask.height);
  mctx.globalCompositeOperation = 'destination-out';
  mctx.setTransform(s, 0, 0, s, 0, 0);
  const cx = P.x + 11, cy = P.y + 11;
  const gr = mctx.createRadialGradient(cx, cy, 10, cx, cy, 95);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  mctx.fillStyle = gr; mctx.beginPath(); mctx.arc(cx, cy, 95, 0, 7); mctx.fill();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(mask, 0, 0); ctx.restore();
  // a few things glow through: the cord pull, the star, the door frames
  ctx.globalAlpha = dark;
  ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(CORD.x, CORD.y - 2, 5, 0, 7); ctx.fill();
  if (!has('glow')) { ctx.save(); ctx.translate(STAR.x, STAR.y); ctx.rotate(T); ctx.shadowColor = COL.yellow; ctx.shadowBlur = 16 * scale * dpr; star(0, 0, 10, COL.yellow); ctx.restore(); }
  ctx.globalAlpha = 1;
}

function render() {
  const s = scale * dpr;
  const sh = shake > 0 ? (Math.random() - .5) * shake * 18 : 0;
  ctx.setTransform(s, 0, 0, s, sh * s, sh * .6 * s);
  ctx.fillStyle = COL.paper; ctx.fillRect(-20, -20, W + 40, H + 40);
  drawPoster();
  drawTutorial();
  drawThings();
  drawRoom();
  drawPlayer();
  drawDark();
  drawParts();
  // the room's name, printed along the floor like a poster caption
  ctx.globalAlpha = .9;
  label('UNLOCKED', 40, 525, 13, COL.paper, 'left');
  label(`${String(got.size).padStart(2, '0')} / ${ACH.length}`, 680, 525, 13, COL.paper, 'right');
  ctx.globalAlpha = 1;
}

// ---- nudge towards the list after the first lessons
const nudge = document.getElementById('nudge');
function updateNudge() {
  const want = has('duck') && !S.seen && !has('lookup') && started;
  if (want && !nudge.classList.contains('on')) nudge.textContent = getComputedStyle(sideEl).position === 'fixed' ? 'Hints in here \u2191' : 'Stuck? Hints in the list \u2192';
  nudge.classList.toggle('on', want);
}

// ---- demo: a room mid-way through, with the little red disc bounding about
let demoLive = false;
if (DEMO) {
  ['hello', 'up', 'duck', 'highground', 'boing', 'headbutt', 'longway', 'shard', 'fullset', 'walls', 'ouch', 'topsy', 'hat', 'rightway', 'double', 'still', 'shoo', 'drop', 'mash', 'lookup'].forEach(id => got.add(id));
  S.shards = [1, 1, 1, 1, 1]; S.hat = 'on'; S.bird = 'perch'; S.ball = 'home';
  Object.assign(P, { x: 330, y: 218, face: -1 });
  started = true;
}

// ---- loop
if (has('hat') && !has('deed')) sayInit();
buildRoom();
renderList();
fit();
if (!DEMO) titleEl.hidden = false;
let last = performance.now(), acc = 0, saveT = 0, demoT = 0;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  acc += dt;
  if (DEMO) demoDrive(dt);
  while (acc >= STEP) { if (started && !HOLD) step(STEP); acc -= STEP; }
  pumpBanners();
  updateNudge();
  if (dirty && (saveT += dt) > 2) { saveT = 0; save(); }
  render();
  requestAnimationFrame(frame);
}
function demoDrive(dt) {
  demoT += dt;
  const ph = demoT % 1.3;
  if (ph < dt && demoT > .2) jumpEdge = true;
  keys.jump = ph < .4;
  if (demoT > .6 && !demoLive) { demoLive = true; unlock('deed'); }
}
requestAnimationFrame(frame);
window.toyboxReady?.();
addEventListener('visibilitychange', () => { if (document.hidden && dirty) save(); });
addEventListener('pagehide', () => { if (dirty) save(); });

// for playtesting from the console
window.__unlocked = { P, get S() { return S; }, keys, begin, render, rects: () => rects, get T() { return T; }, get got() { return got; }, step, unlock, press: k => { keys[k] = true; if (k === 'jump') jumpEdge = true; if (k === 'down') downEdge = true; }, release: k => keys[k] = false };
