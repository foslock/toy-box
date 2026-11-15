// Lantern: the simulation. No DOM here, so sim.mjs can run it in Node.
// World units are roughly CSS pixels at zoom 1. Time is in seconds.

export const WORLD = 1800;
export const DAY_LEN = 150;          // seconds of daylight before the bell
export const OIL_BURN_DAY = 100 / 150;
export const OIL_BURN_NIGHT = 0.9;
export const FLARE_COST = 12;
const BUFFER = 0.22;        // a press made a moment too early still counts

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TAU = Math.PI * 2;
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot;

// light radius for a given amount of oil
export const lightFor = (oil) => oil <= 0 ? 52 : 70 + 190 * Math.sqrt(Math.min(100, oil) / 100);

export const WEAPONS = {
  hatchet: { name: "Woodman's Hatchet", short: 'Hatchet', desc: 'Plain and honest. No passive.', passive: null,
    light: { dmg: 15, reach: 50, arc: 1.7, wind: 0.09, act: 0.1, rec: 0.2, st: 14, step: 40 },
    heavy: { dmg: 38, reach: 60, arc: 2.3, act: 0.14, rec: 0.36, st: 30, step: 70 } },
  spear: { name: "Pilgrim's Spear", short: 'Spear', desc: 'Long and narrow. Each kill drips oil (+4).', passive: 'oil',
    light: { dmg: 13, reach: 82, arc: 0.7, wind: 0.1, act: 0.1, rec: 0.22, st: 13, step: 30 },
    heavy: { dmg: 34, reach: 104, arc: 0.8, act: 0.16, rec: 0.36, st: 28, step: 150 } },
  sickle: { name: 'Moth Sickle', short: 'Sickle', desc: 'Quick little cuts. Every hit heals you a little.', passive: 'leech',
    light: { dmg: 11, reach: 44, arc: 1.9, wind: 0.05, act: 0.08, rec: 0.13, st: 10, step: 30 },
    heavy: { dmg: 28, reach: 52, arc: 2.6, act: 0.12, rec: 0.28, st: 24, step: 60 } },
  greatsword: { name: 'Ember Greatsword', short: 'Greatsword', desc: 'Slow and wide. Hits set the Night alight.', passive: 'burn',
    light: { dmg: 20, reach: 66, arc: 2.5, wind: 0.2, act: 0.12, rec: 0.36, st: 22, step: 40 },
    heavy: { dmg: 52, reach: 76, arc: 3.3, act: 0.16, rec: 0.5, st: 38, step: 60 } },
};

export const FOES = {
  shade:  { name: 'Shade', hp: 34, r: 15, speed: 95, runes: 25 },
  hound:  { name: 'Gloam hound', hp: 20, r: 12, speed: 170, runes: 20 },
  wisp:   { name: 'Wisp', hp: 22, r: 13, speed: 80, runes: 30 },
  brute:  { name: 'Lamp-eater', hp: 95, r: 22, speed: 68, runes: 70 },
  moth:   { name: 'Moth', hp: 12, r: 10, speed: 190, runes: 6 },
  dummy:  { name: 'Shade', hp: 34, r: 15, speed: 80, runes: 0 },
};

export const BOSSES = [
  { id: 'ringer', name: 'The Bell-Ringer', title: 'Servant of the Night', hp: 520, r: 34, speed: 88, runes: 400 },
  { id: 'mother', name: 'Mother of Moths', title: 'Servant of the Night', hp: 600, r: 30, speed: 120, runes: 600 },
  { id: 'lord', name: 'The Nightlord', title: 'Who Wants the Last Light', hp: 900, r: 36, speed: 100, runes: 0 },
];

// ---------------------------------------------------------------- map
function circleRect(x, y, r, w) {
  const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h);
  const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
  return d2 < r * r ? { dx, dy, d: Math.sqrt(d2) } : null;
}

export function makeMap(seed) {
  const R = rng(seed);
  const C = WORLD / 2;
  const map = { seed, walls: [], trees: [], graces: [], camps: [], jars: [], paths: [] };
  map.graces.push({ x: C, y: C, r: 150, name: 'Lychgate Chapel', used: -1 });
  // two more chapels in opposite quadrants
  const ga = R() * TAU;
  for (let i = 0; i < 2; i++) {
    const a = ga + i * Math.PI + (R() - 0.5) * 0.6, d = 560 + R() * 120;
    map.graces.push({ x: C + Math.cos(a) * d, y: C + Math.sin(a) * d, r: 140, name: ['Moth Chapel', 'Chapel of the Wick'][i], used: -1 });
  }
  // camps: poisson-ish
  const pts = [];
  let guard = 0;
  while (pts.length < 7 && guard++ < 2000) {
    const x = 170 + R() * (WORLD - 340), y = 170 + R() * (WORLD - 340);
    if (hyp(x - C, y - C) < 380) continue;
    if (map.graces.some(g => hyp(g.x - x, g.y - y) < 300)) continue;
    if (pts.some(p => hyp(p.x - x, p.y - y) < 330)) continue;
    pts.push({ x, y });
  }
  const names = ['Hanged Oak', 'Tallow Ruin', 'Cold Hearth', 'Widow\'s Well', 'Ashen Yard', 'Low Barrow', 'Snuffed Mill', 'Crow Tithe'];
  pts.forEach((p, i) => map.camps.push({ x: p.x, y: p.y, name: names[i], chest: true, opened: false, cleared: false, loot: null }));
  // ruins: wall fragments around each camp and some loose
  const addWall = (x, y, w, h) => map.walls.push({ x, y, w, h });
  for (const c of map.camps) {
    const n = 3 + Math.floor(R() * 3), base = R() * TAU;
    for (let k = 0; k < n; k++) {
      const a = base + k * TAU / n + (R() - 0.5) * 0.5, d = 95 + R() * 50;
      const len = 50 + R() * 70, thick = 18;
      const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
      if (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))) addWall(x - thick / 2, y - len / 2, thick, len);
      else addWall(x - len / 2, y - thick / 2, len, thick);
    }
  }
  // chapels: broken walls framing the grace, open on all four sides
  for (const g of map.graces) {
    const s = 105, t = 18, gap = 60;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      addWall(g.x + sx * s - (sx < 0 ? 0 : t) + (sx < 0 ? 0 : 0), g.y + sy * s - (sy < 0 ? 0 : t), t, 0);
      // L corner pieces
      const cx = g.x + sx * s, cy = g.y + sy * s;
      const lw = s - gap / 2;
      addWall(sx < 0 ? cx : cx - lw, sy < 0 ? cy : cy - t, lw, t);
      addWall(sx < 0 ? cx : cx - t, sy < 0 ? cy : cy - lw, t, lw);
    }
  }
  map.walls = map.walls.filter(w => w.w > 0 && w.h > 0);
  // loose ruins
  guard = 0;
  let loose = 0;
  while (loose < 16 && guard++ < 3000) {
    const x = 120 + R() * (WORLD - 240), y = 120 + R() * (WORLD - 240);
    if (map.graces.some(g => hyp(g.x - x, g.y - y) < 220)) continue;
    if (map.camps.some(c => hyp(c.x - x, c.y - y) < 190)) continue;
    const len = 60 + R() * 110;
    if (R() < 0.5) addWall(x, y, len, 18); else addWall(x, y, 18, len);
    loose++;
  }
  // trees
  guard = 0;
  while (map.trees.length < 70 && guard++ < 5000) {
    const x = 60 + R() * (WORLD - 120), y = 60 + R() * (WORLD - 120), r = 14 + R() * 16;
    if (map.graces.some(g => hyp(g.x - x, g.y - y) < 190)) continue;
    if (map.camps.some(c => hyp(c.x - x, c.y - y) < 150)) continue;
    if (map.trees.some(t => hyp(t.x - x, t.y - y) < t.r + r + 40)) continue;
    if (map.walls.some(w => circleRect(x, y, r + 26, w))) continue;
    map.trees.push({ x, y, r });
  }
  // a dead-tree hedge round the edge
  for (let i = 0; i < 64; i++) {
    const t = i / 64 * 4, side = Math.floor(t), f = t - side, r = 26 + R() * 12;
    const along = 30 + f * (WORLD - 60), off = 18 + R() * 14;
    const [x, y] = side === 0 ? [along, off] : side === 1 ? [WORLD - off, along] : side === 2 ? [WORLD - along, WORLD - off] : [off, WORLD - along];
    map.trees.push({ x, y, r, edge: true });
  }
  // oil jars in the loose ruins
  guard = 0;
  while (map.jars.length < 7 && guard++ < 3000) {
    const x = 150 + R() * (WORLD - 300), y = 150 + R() * (WORLD - 300);
    if (hyp(x - C, y - C) < 250) continue;
    if (map.jars.some(j => hyp(j.x - x, j.y - y) < 300)) continue;
    if (blocked(map, x, y, 20)) continue;
    map.jars.push({ x, y, oil: 12, taken: false });
  }
  // paths: chapel to each camp, for drawing only
  for (const c of map.camps) {
    let best = map.graces[0], bd = 1e9;
    for (const g of map.graces) { const d = hyp(g.x - c.x, g.y - c.y); if (d < bd) { bd = d; best = g; } }
    map.paths.push([best.x, best.y, c.x, c.y]);
  }
  // loot: one of each weapon somewhere, the rest oil
  const order = [0, 1, 2, 3, 4, 5, 6].sort(() => R() - 0.5);
  ['spear', 'sickle', 'greatsword'].forEach((w, i) => { map.camps[order[i]].loot = w; });
  return map;
}

export function blocked(map, x, y, r) {
  if (x < r || y < r || x > WORLD - r || y > WORLD - r) return true;
  for (const w of map.walls) if (circleRect(x, y, r, w)) return true;
  for (const t of map.trees) if (hyp(t.x - x, t.y - y) < t.r + r) return true;
  return false;
}

// push a circle out of walls and trees
function collide(map, e) {
  for (let pass = 0; pass < 2; pass++) {
    for (const w of map.walls) {
      const c = circleRect(e.x, e.y, e.r, w);
      if (c) {
        if (c.d > 0.0001) { const p = (e.r - c.d) / c.d; e.x += c.dx * p; e.y += c.dy * p; }
        else { // centre inside: push out the short way
          const l = e.x - w.x, r = w.x + w.w - e.x, t = e.y - w.y, b = w.y + w.h - e.y, m = Math.min(l, r, t, b);
          if (m === l) e.x = w.x - e.r; else if (m === r) e.x = w.x + w.w + e.r; else if (m === t) e.y = w.y - e.r; else e.y = w.y + w.h + e.r;
        }
      }
    }
    for (const t of map.trees) {
      const dx = e.x - t.x, dy = e.y - t.y, d = hyp(dx, dy), m = t.r + e.r;
      if (d < m && d > 0.001) { e.x = t.x + dx / d * m; e.y = t.y + dy / d * m; }
    }
  }
  e.x = clamp(e.x, e.r + 4, WORLD - e.r - 4); e.y = clamp(e.y, e.r + 4, WORLD - e.r - 4);
}

// ---------------------------------------------------------------- game
export class Game {
  constructor(seed = 1, opts = {}) {
    this.seed = seed;
    this.R = rng(seed * 7 + 3);
    this.map = makeMap(seed);
    this.tutorial = !!opts.tutorial;
    this.t = 0;
    this.day = 0;          // 0, 1 = days; 2 = the last night
    this.phase = 'day';    // day | dusk | night | dawn | won | dead
    this.phaseT = 0;
    this.clock = 0;        // seconds into the current day
    this.events = [];
    this.foes = [];
    this.shots = [];
    this.waves = [];
    this.drops = [];
    this.boss = null;
    this.flare = 0;        // flare light, decays
    this.eclipse = 0;      // Nightlord dims your light
    this.hitstop = 0;
    this.embers = 1;       // one second try at a boss per run
    this.stats = { kills: 0, camps: 0, bosses: 0, flares: 0, rolls: 0, dodged: 0 };
    const g0 = this.map.graces[0];
    this.p = {
      x: g0.x, y: g0.y + 40, r: 13, vx: 0, vy: 0, face: -Math.PI / 2,
      hp: 100, maxHp: 100, st: 100, maxSt: 100, stDelay: 0,
      flasks: 3, maxFlasks: 3, oil: 100, runes: 0, level: 1, str: 1,
      weapon: 'hatchet', weapons: ['hatchet'],
      act: null, inv: 0, hurtT: 0, rollDir: 0, inGrace: -1, burnT: 0, swingId: 0,
      buf: { roll: 0, flask: 0, flare: 0, attack: 0, heavy: 0 },
    };
    this.input = { mx: 0, my: 0, aim: null, attackDown: false, attackPressed: false, attackReleased: false, heavyPressed: false, roll: false, flask: false, flare: false };
    if (!this.tutorial) this.populate();
  }

  emit(t, o = {}) { this.events.push({ t, ...o }); }

  populate() {
    const R = this.R;
    this.foes = this.foes.filter(f => f.tut);
    const day = this.day;
    for (const c of this.map.camps) {
      c.cleared = false;
      const n = 3 + Math.floor(R() * 2) + day;
      const pool = day === 0 ? ['shade', 'shade', 'hound', 'wisp'] : ['shade', 'hound', 'wisp', 'wisp', 'brute', 'shade'];
      const list = [];
      for (let i = 0; i < n; i++) list.push(pool[Math.floor(R() * pool.length)]);
      if (day > 0 && !list.includes('brute')) list[0] = 'brute';
      for (const type of list) {
        let x, y, k = 0;
        do { const a = R() * TAU, d = 20 + R() * 70; x = c.x + Math.cos(a) * d; y = c.y + Math.sin(a) * d; } while (blocked(this.map, x, y, 24) && k++ < 30);
        this.spawn(type, x, y, c);
      }
    }
  }

  spawn(type, x, y, camp = null, extra = {}) {
    const F = FOES[type];
    const hpMul = 1 + this.day * 0.25;
    const f = { type, x, y, hx: x, hy: y, r: F.r, hp: F.hp * hpMul, maxHp: F.hp * hpMul, speed: F.speed, camp,
      state: 'idle', st: 0, face: this.R() * TAU, aggro: false, lit: false, litT: 0, stagger: 0, flash: 0, burn: 0,
      wander: this.R() * TAU, wT: this.R() * 2, cd: 0.5 + this.R(), hitBy: -1, vx: 0, vy: 0, id: Math.floor(this.R() * 1e9), ...extra };
    this.foes.push(f);
    return f;
  }

  // ---------------- lights
  lights() {
    const L = [];
    const p = this.p;
    const r = this.lightR();
    L.push({ x: p.x, y: p.y, r, main: true });
    for (const g of this.map.graces) L.push({ x: g.x, y: g.y, r: g.r, grace: true });
    for (const f of this.foes) if (f.burn > 0) L.push({ x: f.x, y: f.y, r: 40 });
    return L;
  }
  lightR() {
    const base = lightFor(this.p.oil) * (1 - 0.45 * clamp(this.eclipse, 0, 1));
    return base + this.flare * 140;
  }
  isLit(x, y, pad = 0) {
    const p = this.p, r = this.lightR();
    if (hyp(x - p.x, y - p.y) < r + pad - 6) return true;
    for (const g of this.map.graces) if (hyp(x - g.x, y - g.y) < g.r + pad - 6) return true;
    return false;
  }

  // ---------------- main tick
  step(dt) {
    this.events.length = this.events.length > 200 ? 0 : this.events.length;
    if (this.phase === 'won' || this.phase === 'dead') { this.phaseT += dt; this.tickFx(dt); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; this.latch(); this.clearPresses(); return; }
    this.t += dt; this.phaseT += dt;
    const p = this.p;

    // the clock and the oil
    const frozen = this.tutorial && !this.tutorialLive;
    if (this.phase === 'day' && !frozen) {
      this.clock += dt;
      if (this.clock >= DAY_LEN) this.toDusk();
    }
    if (!frozen && this.phase !== 'dawn') {
      const burn = this.phase === 'night' ? OIL_BURN_NIGHT : OIL_BURN_DAY;
      p.oil = Math.max(0, p.oil - burn * dt);
    }
    if (this.phase === 'dusk' && this.phaseT > 3.2) this.toNight();
    if (this.phase === 'dawn' && this.phaseT > 4.5) this.toDay();

    this.flare = Math.max(0, this.flare - dt / 1.4);
    if (this.eclipse > 0 && !(this.boss && this.boss.eclipseHold > 0)) this.eclipse = Math.max(0, this.eclipse - dt / 1.2);

    this.tickPlayer(dt);
    this.tickFoes(dt);
    if (this.boss) this.tickBoss(dt);
    this.tickShots(dt);
    this.tickWaves(dt);
    this.tickDrops(dt);
    this.tickFx(dt);

    // the Night bites when the lamp is out
    if (p.oil <= 0 && !this.inGraceLight() && this.phase !== 'dawn') {
      p.burnT += dt;
      if (p.burnT > 0.5) { p.burnT = 0; this.hurtPlayer(this.phase === 'night' ? 3 : 2, null, true); }
    }
    this.clearPresses();
  }
  // remember presses for a moment, so one made during hit-stop, a flinch or the tail of a swing isn't lost
  latch() {
    const I = this.input, B = this.p.buf;
    if (I.roll) B.roll = BUFFER; if (I.flask) B.flask = BUFFER; if (I.flare) B.flare = BUFFER;
    if (I.attackPressed) { B.attack = BUFFER; B.heavy = 0; } if (I.heavyPressed) { B.heavy = BUFFER; B.attack = 0; }
  }
  clearPresses() { const i = this.input; i.attackPressed = i.attackReleased = i.heavyPressed = i.roll = i.flask = i.flare = false; }
  tickFx() {}

  inGraceLight() { const p = this.p; return this.map.graces.some(g => hyp(g.x - p.x, g.y - p.y) < g.r - 10); }

  toDusk() {
    this.phase = 'dusk'; this.phaseT = 0;
    this.emit('bell');
    for (const f of this.foes) if (!f.tut) { f.dying = 1; f.state = 'fade'; }
  }
  toNight() {
    this.phase = 'night'; this.phaseT = 0;
    this.foes = this.foes.filter(f => !f.dying);
    const B = BOSSES[this.day];
    const p = this.p;
    // emerge from the dark, away from walls
    let bx = p.x, by = p.y - 330, best = -1;
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * TAU, x = p.x + Math.cos(a) * 330, y = p.y + Math.sin(a) * 330;
      if (blocked(this.map, x, y, B.r + 10)) continue;
      const s = Math.min(x, y, WORLD - x, WORLD - y);
      if (s > best) { best = s; bx = x; by = y; }
    }
    const hpMul = this.day === 2 ? 1 : 1;
    this.boss = { ...B, x: bx, y: by, maxHp: B.hp * hpMul, hp: B.hp * hpMul, face: Math.atan2(p.y - by, p.x - bx), state: 'enter', st: 0, cd: 1.2,
      flash: 0, burn: 0, stagger: 0, lit: false, move: null, hitBy: -1, phase2: false, eclipseHold: 0, combo: 0, poise: 0, vx: 0, vy: 0 };
    this.emit('boss', { name: B.name });
  }
  toDawn() {
    this.phase = 'dawn'; this.phaseT = 0;
    this.emit('dawn');
  }
  toDay() {
    this.day++;
    this.phase = 'day'; this.phaseT = 0; this.clock = 0;
    const p = this.p;
    if (this.day === 2) { // the last night comes straight on
      p.flasks = p.maxFlasks; p.oil = Math.min(100, p.oil + 45); p.hp = p.maxHp;
      this.phase = 'dusk'; this.phaseT = 0; this.emit('bell', { last: true });
      return;
    }
    p.flasks = p.maxFlasks; p.oil = Math.min(100, p.oil + 35); p.hp = Math.min(p.maxHp, p.hp + 40);
    for (const g of this.map.graces) g.used = -1;
    for (const c of this.map.camps) { c.opened = false; c.cleared = false; }
    this.populate();
    this.emit('day', { day: this.day });
  }

  // ---------------- player
  tickPlayer(dt) {
    const p = this.p, I = this.input, map = this.map;
    p.inv = Math.max(0, p.inv - dt);
    p.stDelay = Math.max(0, p.stDelay - dt);
    if (p.stDelay <= 0 && (!p.act || p.act.type === 'drink')) p.st = Math.min(p.maxSt, p.st + 46 * dt);
    if (p.hp <= 0) return;
    const B = p.buf;
    for (const k in B) B[k] = Math.max(0, B[k] - dt);
    this.latch();
    let mx = I.mx, my = I.my; const ml = hyp(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const W = WEAPONS[p.weapon];
    // aim
    let aim = I.aim;
    if (aim == null) {
      const t = this.autoTarget();
      aim = t ? Math.atan2(t.y - p.y, t.x - p.x) : (ml > 0.2 ? Math.atan2(my, mx) : p.face);
    }
    const a = p.act;
    // start actions
    const free = !a || (a.type === 'light' && a.t > a.wind + a.actT + a.rec * 0.5) || (a.type === 'heavy' && a.t > a.actT + a.rec * 0.6);
    if (p.hurtT > 0) { p.hurtT -= dt; }
    else if (B.roll > 0 && (free || (a && a.type === 'charge')) && p.st > 0) {
      B.roll = 0;
      const dir = ml > 0.2 ? Math.atan2(my, mx) : p.face;
      p.act = { type: 'roll', t: 0, dir }; p.st -= 25; p.stDelay = 0.55; p.face = dir; this.stats.rolls++;
      this.emit('roll');
    } else if (B.flask > 0 && free && p.flasks > 0 && (!a || a.type !== 'drink')) {
      B.flask = 0;
      p.act = { type: 'drink', t: 0, done: false }; p.flasks--;
      this.emit('drink');
    } else if (B.flare > 0 && free && p.oil >= FLARE_COST && (!this.flareCd || this.t > this.flareCd)) {
      B.flare = 0;
      this.doFlare();
    } else if ((B.attack > 0 || B.heavy > 0) && free && p.st > 0) {
      p.face = aim;
      const heavy = B.heavy > 0; B.attack = B.heavy = 0;
      if (heavy) { p.act = { type: 'charge', t: 0, max: 0.6 }; }
      else p.act = { type: 'charge', t: 0, max: 0.6, tap: true };
    }
    const act = p.act;
    let speed = 150;
    if (act) {
      act.t += dt;
      if (act.type === 'charge') {
        speed = 55; p.face = aim;
        const release = act.tap ? (!I.attackDown) : (!I.attackDown && !I.heavyDown);
        if (release || act.t >= act.max + 0.4) {
          if (act.t < 0.22 && act.tap) this.startSwing('light', W.light, 1);
          else this.startSwing('heavy', W.heavy, 0.65 + 0.35 * clamp((act.t - 0.22) / (act.max - 0.22), 0, 1));
        }
      } else if (act.type === 'light' || act.type === 'heavy') {
        speed = 30;
        const sw = act;
        const begin = sw.wind, end = sw.wind + sw.actT;
        if (sw.t < end) { // lunge
          const k = sw.step / (sw.wind + sw.actT);
          p.x += Math.cos(p.face) * k * dt; p.y += Math.sin(p.face) * k * dt;
        }
        if (sw.t >= begin && sw.t < end) this.swingHits(sw);
        if (sw.t >= end + sw.rec) p.act = null;
      } else if (act.type === 'roll') {
        const T = 0.36;
        const v = 340 * (1 - act.t / T * 0.5);
        p.x += Math.cos(act.dir) * v * dt; p.y += Math.sin(act.dir) * v * dt;
        speed = 0;
        if (act.t > T) p.act = null;
      } else if (act.type === 'drink') {
        speed = 55;
        if (!act.done && act.t > 0.45) { act.done = true; p.hp = Math.min(p.maxHp, p.hp + 45); this.emit('healed'); }
        if (act.t > 0.75) p.act = null;
      } else if (act.type === 'flare') {
        speed = 40; if (act.t > 0.3) p.act = null;
      }
    }
    if (p.hurtT > 0) speed = 0;
    if (!act || act.type !== 'roll') {
      const tx = mx * speed, ty = my * speed;
      p.vx += (tx - p.vx) * Math.min(1, dt * 14); p.vy += (ty - p.vy) * Math.min(1, dt * 14);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!act && ml > 0.2) p.face = I.aim != null ? I.aim : this.autoTarget() ? aim : Math.atan2(my, mx);
      if (!act && I.aim != null) p.face = I.aim;
    }
    collide(map, p);
    // grace
    let gi = -1;
    map.graces.forEach((g, i) => { if (hyp(g.x - p.x, g.y - p.y) < 40) gi = i; });
    if (gi !== p.inGrace) {
      p.inGrace = gi;
      if (gi >= 0) {
        const g = map.graces[gi];
        // the day's refill is only spent when there is something to fill
        if (g.used !== this.day && !this.tutorial && p.flasks < p.maxFlasks) { g.used = this.day; p.flasks = p.maxFlasks; this.emit('grace', { i: gi, refill: true }); }
        else this.emit('grace', { i: gi, refill: false, unspent: g.used !== this.day });
      }
    }
    // pick-ups
    for (const j of map.jars) if (!j.taken && hyp(j.x - p.x, j.y - p.y) < 26) { j.taken = true; p.oil = Math.min(100, p.oil + j.oil); this.emit('oil', { x: j.x, y: j.y, n: j.oil }); }
    for (const c of map.camps) if (c.cleared && !c.opened && hyp(c.x - p.x, c.y - p.y) < 30) this.openChest(c);
  }

  levelCost() { return 120 + (this.p.level - 1) * 90; }
  levelUp(stat) {
    const p = this.p, cost = this.levelCost();
    if (p.runes < cost) return false;
    p.runes -= cost; p.level++;
    if (stat === 'vigor') { p.maxHp += 15; p.hp += 15; }
    if (stat === 'endurance') { p.maxSt += 15; p.st += 15; }
    if (stat === 'strength') p.str += 0.1;
    this.emit('level', { stat });
    return true;
  }

  openChest(c) {
    c.opened = true; const p = this.p;
    if (c.loot && !p.weapons.includes(c.loot)) {
      p.weapons.push(c.loot); p.weapon = c.loot; this.emit('weapon', { w: c.loot, x: c.x, y: c.y });
    } else {
      p.oil = Math.min(100, p.oil + 15); p.runes += 60; this.emit('oil', { x: c.x, y: c.y, n: 15, chest: true });
    }
  }

  autoTarget() {
    const p = this.p; let best = null, bd = 170;
    const cand = this.boss ? [...this.foes, this.boss] : this.foes;
    for (const f of cand) {
      if (f.dying || f.hp <= 0 || !f.lit) continue;
      const d = hyp(f.x - p.x, f.y - p.y) - f.r;
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  startSwing(kind, s, mul) {
    const p = this.p;
    if (p.st <= 0) { p.act = null; return; }
    p.st -= s.st * (kind === 'heavy' ? 1 : 1); p.stDelay = 0.6;
    p.swingId++;
    p.act = { type: kind, t: 0, wind: kind === 'light' ? s.wind : 0.02, actT: s.act, rec: s.rec, dmg: s.dmg * mul * p.str, reach: s.reach, arc: s.arc, step: s.step * (kind === 'heavy' ? mul : 1), id: p.swingId, hit: new Set() };
    this.emit('swing', { heavy: kind === 'heavy' });
  }

  swingHits(sw) {
    const p = this.p;
    const targets = this.boss ? [...this.foes, this.boss] : this.foes;
    for (const f of targets) {
      if (f.hp <= 0 || f.dying || sw.hit.has(f)) continue;
      const dx = f.x - p.x, dy = f.y - p.y, d = hyp(dx, dy);
      if (d - f.r > sw.reach) continue;
      const ad = Math.abs(angDiff(p.face, Math.atan2(dy, dx)));
      const angPad = Math.atan2(f.r, Math.max(d, 1));
      if (ad > sw.arc / 2 + angPad && d > f.r + p.r + 4) continue;
      sw.hit.add(f);
      if (!f.lit) { this.emit('ghost', { x: f.x, y: f.y }); continue; } // the swing passes through a shadow
      this.damageFoe(f, sw.dmg, sw.type === 'heavy', Math.atan2(dy, dx));
    }
  }

  damageFoe(f, dmg, heavy, ang) {
    const p = this.p, W = WEAPONS[p.weapon];
    const isBoss = f === this.boss;
    f.hp -= dmg; f.flash = 0.12;
    if (W.passive === 'leech') p.hp = Math.min(p.maxHp, p.hp + 2);
    if (W.passive === 'burn') f.burn = 3;
    const kb = isBoss ? (heavy ? 30 : 6) : heavy ? 90 : 38;
    f.x += Math.cos(ang) * kb * 0.3; f.y += Math.sin(ang) * kb * 0.3;
    f.vx = Math.cos(ang) * kb * 4; f.vy = Math.sin(ang) * kb * 4;
    if (!isBoss) {
      f.aggro = true;
      if (heavy || f.state !== 'strike') { f.stagger = heavy ? 0.55 : 0.22; if (f.state === 'wind') f.state = 'chase'; }
    } else {
      f.poise += heavy ? 34 : dmg * 0.6;
      if (f.poise > 120) { f.poise = 0; f.stagger = 1.1; f.state = 'recover'; f.st = 0; this.emit('break', { x: f.x, y: f.y }); }
    }
    this.hitstop = heavy ? 0.07 : 0.035;
    this.emit('hit', { x: f.x, y: f.y, heavy, boss: isBoss, n: Math.round(dmg) });
    if (f.hp <= 0) this.killFoe(f);
  }

  killFoe(f) {
    const p = this.p, W = WEAPONS[p.weapon];
    if (f === this.boss) {
      p.runes += f.runes; this.stats.bosses++;
      this.emit('bossdown', { name: f.name, x: f.x, y: f.y });
      this.boss = null; this.shots = []; this.waves = [];
      this.foes = this.foes.filter(o => o.tut);
      this.eclipse = 0;
      if (this.day >= 2) { this.phase = 'won'; this.phaseT = 0; this.emit('won'); }
      else this.toDawn();
      return;
    }
    f.dead = true; this.stats.kills++;
    p.runes += Math.round(FOES[f.type].runes * (1 + this.day * 0.3));
    if (W.passive === 'oil') p.oil = Math.min(100, p.oil + 4);
    this.emit('kill', { x: f.x, y: f.y, type: f.type });
    if (f.camp && !this.foes.some(o => o !== f && !o.dead && o.camp === f.camp)) {
      f.camp.cleared = true; this.stats.camps++;
      this.emit('cleared', { name: f.camp.name, x: f.camp.x, y: f.camp.y, opened: f.camp.opened });
    }
    if (f.type !== 'moth' && f.type !== 'dummy' && this.R() < 0.12) this.drops.push({ x: f.x, y: f.y, kind: 'oil', n: 8, t: 0 });
  }

  doFlare() {
    const p = this.p;
    p.oil -= FLARE_COST; this.flare = 1; this.flareCd = this.t + 0.8; this.stats.flares++;
    p.act = { type: 'flare', t: 0 };
    const R = lightFor(p.oil) + 60;
    const all = this.boss ? [...this.foes, this.boss] : this.foes;
    for (const f of all) {
      if (f.dying || f.hp <= 0) continue;
      const d = hyp(f.x - p.x, f.y - p.y);
      if (d < R + f.r) {
        const a = Math.atan2(f.y - p.y, f.x - p.x);
        f.lit = true;
        if (f === this.boss) { f.hp -= 22; f.flash = 0.15; f.poise += 40; if (f.hp <= 0) this.killFoe(f); continue; }
        f.stagger = Math.max(f.stagger, 0.9); f.state = 'chase';
        f.vx = Math.cos(a) * 420; f.vy = Math.sin(a) * 420;
        this.damageFoe(f, 18, true, a);
      }
    }
    for (const s of this.shots) if (hyp(s.x - p.x, s.y - p.y) < R) s.dead = true;
    this.hitstop = 0;
    this.emit('flare');
  }

  hurtPlayer(dmg, from, chip = false) {
    const p = this.p;
    if (p.hp <= 0) return false;
    if (!chip) {
      if (p.act && p.act.type === 'roll' && p.act.t > 0.03 && p.act.t < 0.3) { this.stats.dodged++; this.emit('dodge'); return false; }
      if (p.inv > 0) return false;
    }
    p.hp -= dmg;
    if (!chip) {
      p.inv = 0.45; p.hurtT = 0.22; p.act = null;
      if (from) { const a = Math.atan2(p.y - from.y, p.x - from.x); p.x += Math.cos(a) * 18; p.y += Math.sin(a) * 18; collide(this.map, p); }
      this.emit('hurt', { n: dmg, src: !from ? '?' : from === this.boss ? this.boss.id + ':' + (this.boss.move || 'body') : from.type ? from.type : from.vx !== undefined ? (this.boss ? this.boss.id + ':shot' : 'bolt') : from.th ? 'wave' : (this.boss ? this.boss.id + ':slam' : 'slam') });
    } else this.emit('chill');
    if (p.hp <= 0) {
      p.hp = 0;
      if (this.boss && this.embers > 0) { this.emit('fallen', { ember: true }); }
      this.phase = 'dead'; this.phaseT = 0; this.emit('died');
    }
    return true;
  }

  // second try at a boss: back to full, the boss starts over
  rekindle() {
    if (this.embers <= 0 || !this.boss) return false;
    this.embers--;
    const p = this.p;
    p.hp = p.maxHp; p.flasks = p.maxFlasks; p.st = p.maxSt; p.act = null; p.inv = 1.5; p.oil = Math.max(p.oil, 30);
    for (const k in p.buf) p.buf[k] = 0;
    const B = BOSSES[this.day];
    this.foes = this.foes.filter(f => f.tut); this.shots = []; this.waves = []; this.eclipse = 0;
    this.toNight();
    this.boss.hp = this.boss.maxHp = B.hp;
    this.phase = 'night';
    this.emit('rekindle');
    return true;
  }

  // ---------------- foes
  tickFoes(dt) {
    const p = this.p, map = this.map;
    const pr = this.lightR();
    for (const f of this.foes) {
      if (f.dead) continue;
      if (f.dying) { f.dying -= dt / 1.5; continue; }
      f.flash = Math.max(0, f.flash - dt);
      const wasLit = f.lit;
      f.lit = this.isLit(f.x, f.y, f.r * 0.5);
      if (f.lit && !wasLit) f.litT = 0; f.litT += dt;
      if (!f.lit && f.hp < f.maxHp && f.type !== 'dummy') f.hp = Math.min(f.maxHp, f.hp + 7 * dt);
      if (f.burn > 0) { f.burn -= dt; f.hp -= 3 * dt; if (f.hp <= 0) { this.killFoe(f); continue; } }
      // knockback slide
      f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= Math.pow(0.002, dt); f.vy *= Math.pow(0.002, dt);
      const dx = p.x - f.x, dy = p.y - f.y, d = hyp(dx, dy), toP = Math.atan2(dy, dx);
      if (f.stagger > 0) { f.stagger -= dt; collide(map, f); continue; }
      // foes won't step into a grace's light unless chasing someone standing at its edge
      const inG = map.graces.find(g => hyp(g.x - f.x, g.y - f.y) < g.r + 10);
      const pInGrace = this.inGraceLight();
      if (!f.aggro && d < Math.max(260, pr + 90) && p.hp > 0 && !pInGrace) f.aggro = true;
      if (f.aggro && !f.tut && (d > 620 || pInGrace)) { f.aggro = false; f.state = 'idle'; }
      if (f.tut) f.aggro = true;
      f.cd -= dt;
      let mv = 0, ma = f.face;
      const T = f.type;
      if (f.state === 'wind' || f.state === 'strike' || f.state === 'recover' || f.state === 'lunge') {
        f.st += dt;
        this.foeAttack(f, dt, d, toP);
      } else if (!f.aggro) {
        f.wT -= dt;
        if (f.wT <= 0) { f.wT = 1.5 + this.R() * 2; f.wander = this.R() * TAU; f.wMove = this.R() < 0.6; }
        const hd = hyp(f.hx - f.x, f.hy - f.y);
        if (hd > 90) { ma = Math.atan2(f.hy - f.y, f.hx - f.x); mv = f.speed * 0.5; }
        else if (f.wMove) { ma = f.wander; mv = f.speed * 0.25; }
      } else {
        ma = toP;
        const range = T === 'wisp' ? 230 : T === 'hound' ? 140 : T === 'brute' ? 62 : 44;
        if (T === 'wisp') {
          if (d > (f.tut ? 150 : 260)) mv = f.speed; else if (d < (f.tut ? 60 : 170)) { ma = toP + Math.PI; mv = f.speed * 0.8; } else { ma = toP + Math.PI / 2 * (f.id % 2 ? 1 : -1); mv = f.speed * 0.5; }
          if (d < 300 && f.cd <= 0) { f.state = 'wind'; f.st = 0; f.face = toP; }
        } else {
          if (d > range + f.r) mv = f.speed;
          else if (T === 'shade' || T === 'dummy') { ma = toP + Math.PI / 2 * (f.id % 2 ? 1 : -1); mv = f.speed * 0.3; }
          if (d < range + f.r + p.r && f.cd <= 0) { f.state = 'wind'; f.st = 0; f.face = toP; }
        }
        // shades hesitate at the edge of a big light, then come in
        if (!f.lit && T !== 'wisp' && d < pr + 20 && f.litT < 99) { mv *= 0.55; }
      }
      if (mv > 0) {
        f.face += angDiff(f.face, ma) * Math.min(1, dt * 8);
        f.x += Math.cos(ma) * mv * dt; f.y += Math.sin(ma) * mv * dt;
      }
      // grace light pushes foes out
      if (inG && !f.tut) { const a = Math.atan2(f.y - inG.y, f.x - inG.x); f.x += Math.cos(a) * 80 * dt; f.y += Math.sin(a) * 80 * dt; }
      // separation
      for (const o of this.foes) {
        if (o === f || o.dead || o.dying) continue;
        const ox = f.x - o.x, oy = f.y - o.y, od = hyp(ox, oy), m = f.r + o.r;
        if (od < m && od > 0.01) { f.x += ox / od * (m - od) * 0.5; f.y += oy / od * (m - od) * 0.5; }
      }
      if (d < f.r + p.r && d > 0.01 && (!p.act || p.act.type !== 'roll')) { // don't overlap the player
        const push = (f.r + p.r - d) * 0.5; f.x -= dx / d * push; f.y -= dy / d * push;
      }
      collide(map, f);
    }
    this.foes = this.foes.filter(f => !f.dead && !(f.dying !== undefined && f.dying <= 0 && f.state === 'fade'));
  }

  foeAttack(f, dt, d, toP) {
    const p = this.p, T = f.type;
    if (T === 'shade' || T === 'dummy') {
      const W = f.tut ? 0.75 : 0.55;
      if (f.state === 'wind') { f.face += angDiff(f.face, toP) * Math.min(1, dt * 3); if (f.st > W) { f.state = 'strike'; f.st = 0; f.hitDone = false; this.emit('fswing', { x: f.x, y: f.y }); } }
      else if (f.state === 'strike') {
        f.x += Math.cos(f.face) * 120 * dt; f.y += Math.sin(f.face) * 120 * dt;
        if (!f.hitDone && this.arcHit(f, 56, 1.9)) { f.hitDone = true; this.hurtPlayer(f.tut ? 8 : 14 + this.day * 3, f); }
        if (f.st > 0.14) { f.state = 'recover'; f.st = 0; }
      } else if (f.st > 0.6) { f.state = 'chase'; f.cd = 0.8 + this.R() * 0.8; }
    } else if (T === 'hound' || T === 'moth') {
      const W = T === 'moth' ? 0.35 : 0.45;
      if (f.state === 'wind') { f.face = toP; if (f.st > W) { f.state = 'lunge'; f.st = 0; f.hitDone = false; this.emit('lunge', { x: f.x, y: f.y }); } }
      else if (f.state === 'lunge') {
        const v = T === 'moth' ? 380 : 430;
        f.x += Math.cos(f.face) * v * dt; f.y += Math.sin(f.face) * v * dt;
        if (!f.hitDone && hyp(p.x - f.x, p.y - f.y) < f.r + p.r + 6) { f.hitDone = true; this.hurtPlayer(T === 'moth' ? 7 : 11 + this.day * 3, f); }
        if (f.st > 0.3) { f.state = 'recover'; f.st = 0; }
      } else if (f.st > 0.75) { f.state = 'chase'; f.cd = 1 + this.R(); }
    } else if (T === 'wisp') {
      if (f.state === 'wind') { f.face = toP; if (f.st > 0.8) { f.state = 'recover'; f.st = 0; this.shoot(f.x, f.y, toP, 230, 11 + this.day * 3); } }
      else if (f.st > 0.4) { f.state = 'chase'; f.cd = 1.6 + this.R(); }
    } else if (T === 'brute') {
      if (f.state === 'wind') {
        if (!f.tx) { f.tx = p.x; f.ty = p.y; }
        if (f.st > 0.9) {
          f.state = 'strike'; f.st = 0;
          if (hyp(p.x - f.tx, p.y - f.ty) < 70 + p.r) this.hurtPlayer(26 + this.day * 2, { x: f.tx, y: f.ty });
          this.emit('slam', { x: f.tx, y: f.ty, r: 70 });
        }
      } else if (f.state === 'strike') { if (f.st > 0.15) { f.state = 'recover'; f.st = 0; f.tx = null; } }
      else if (f.st > 0.9) { f.state = 'chase'; f.cd = 1.2 + this.R(); }
    }
  }

  arcHit(src, reach, arc) {
    const p = this.p, dx = p.x - src.x, dy = p.y - src.y, d = hyp(dx, dy);
    if (d - p.r > reach) return false;
    return Math.abs(angDiff(src.face, Math.atan2(dy, dx))) < arc / 2 + 0.2;
  }

  shoot(x, y, a, v, dmg, r = 7) { this.shots.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dmg, r, t: 0 }); this.emit('bolt', { x, y }); }
  tickShots(dt) {
    const p = this.p;
    for (const s of this.shots) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.t > 4 || blocked(this.map, s.x, s.y, 2)) { s.dead = true; continue; }
      if (hyp(s.x - p.x, s.y - p.y) < s.r + p.r) { if (this.hurtPlayer(s.dmg, s) || !(p.act && p.act.type === 'roll')) s.dead = true; }
    }
    this.shots = this.shots.filter(s => !s.dead);
  }
  tickWaves(dt) {
    const p = this.p;
    for (const w of this.waves) {
      w.t += dt; const r = w.r0 + (w.r1 - w.r0) * (w.t / w.dur);
      const d = hyp(p.x - w.x, p.y - w.y);
      if (!w.hit && Math.abs(d - r) < w.th / 2 + p.r) { if (this.hurtPlayer(w.dmg, w)) w.hit = true; }
      w.cur = r;
      if (w.t >= w.dur) w.dead = true;
    }
    this.waves = this.waves.filter(w => !w.dead);
  }
  tickDrops(dt) {
    const p = this.p;
    for (const d of this.drops) {
      d.t += dt;
      if (hyp(d.x - p.x, d.y - p.y) < 26) { d.dead = true; p.oil = Math.min(100, p.oil + d.n); this.emit('oil', { x: d.x, y: d.y, n: d.n }); }
      if (d.t > 30) d.dead = true;
    }
    this.drops = this.drops.filter(d => !d.dead);
  }

  // ---------------- bosses
  tickBoss(dt) {
    const b = this.boss, p = this.p, map = this.map;
    b.flash = Math.max(0, b.flash - dt);
    b.lit = this.isLit(b.x, b.y, b.r * 0.6);
    if (b.burn > 0) { b.burn -= dt; b.hp -= 3 * dt; if (b.hp <= 0) { this.killFoe(b); return; } }
    b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= Math.pow(0.001, dt); b.vy *= Math.pow(0.001, dt);
    b.poise = Math.max(0, b.poise - 12 * dt);
    if (b.eclipseHold > 0) { b.eclipseHold -= dt; this.eclipse = Math.min(1, this.eclipse + dt * 2); }
    if (!b.phase2 && b.hp < b.maxHp * 0.5) { b.phase2 = true; this.emit('phase2', { name: b.name }); b.speed *= 1.15; }
    const dx = p.x - b.x, dy = p.y - b.y, d = hyp(dx, dy), toP = Math.atan2(dy, dx);
    if (b.stagger > 0) { b.stagger -= dt; collide(map, b); return; }
    if (b.state === 'enter') { if (b.st === 0) b.st = 0.001; b.st += dt; b.face = toP; if (b.st > 1.6) { b.state = 'chase'; b.st = 0; } return; }
    if (b.state === 'chase') {
      b.cd -= dt;
      b.face += angDiff(b.face, toP) * Math.min(1, dt * 5);
      const want = b.id === 'mother' ? 120 : 70;
      if (d > want + b.r) { b.x += Math.cos(toP) * b.speed * dt; b.y += Math.sin(toP) * b.speed * dt; }
      else if (b.id === 'mother') { const a = toP + Math.PI / 2; b.x += Math.cos(a) * b.speed * 0.6 * dt; b.y += Math.sin(a) * b.speed * 0.6 * dt; }
      if (b.cd <= 0) this.bossPick(d);
    } else {
      b.st += dt;
      this.bossMove(dt, d, toP);
    }
    if (d < b.r + p.r && d > 0.01 && (!p.act || p.act.type !== 'roll')) { const push = b.r + p.r - d; p.x += dx / d * push; p.y += dy / d * push; collide(map, p); }
    collide(map, b);
  }

  bossPick(d) {
    const b = this.boss, R = this.R;
    let moves;
    if (b.id === 'ringer') moves = d < 140 ? ['sweep', 'sweep', 'slam', 'toll'] : ['slam', 'charge', 'toll', 'charge'];
    else if (b.id === 'mother') moves = d < 130 ? ['wing', 'dash', 'dust', 'brood'] : ['dash', 'dust', 'dust', 'brood', 'dash'];
    else moves = d < 140 ? ['sweep', 'sweep', 'toll', 'fan', 'eclipse'] : ['dash', 'fan', 'slam', 'eclipse', 'dash'];
    if (b.id === 'mother' && this.foes.filter(f => f.type === 'moth').length >= 3) moves = moves.filter(m => m !== 'brood');
    if (b.id === 'lord' && this.eclipse > 0.2) moves = moves.filter(m => m !== 'eclipse');
    let m = moves[Math.floor(R() * moves.length)];
    if (m === b.last && R() < 0.6) m = moves[Math.floor(R() * moves.length)];
    b.last = m;
    b.move = m; b.state = 'move'; b.st = 0; b.hitDone = false; b.fired = 0;
    const p = this.p;
    b.tx = p.x; b.ty = p.y;
    this.emit('bwind', { m });
  }

  bossMove(dt, d, toP) {
    const b = this.boss, p = this.p, m = b.move, fast = b.phase2 ? 0.82 : 1;
    const end = () => { b.state = 'chase'; b.cd = (b.id === 'mother' ? 0.6 : 0.8) * fast + this.R() * 0.6; b.move = null; };
    const W = (x) => x * fast;
    if (m === 'sweep' || m === 'wing') {
      const wind = W(m === 'wing' ? 0.55 : 0.7), reach = m === 'wing' ? 100 : 115, arc = m === 'wing' ? 2.2 : 2.7;
      b.tele = { kind: 'arc', reach, arc, k: Math.min(1, b.st / wind) };
      if (b.st < wind) b.face += angDiff(b.face, toP) * Math.min(1, dt * 2.5);
      else if (!b.hitDone) { b.hitDone = true; if (this.arcHit(b, reach, arc)) this.hurtPlayer(22 + this.day * 3, b); this.emit('bswing'); b.x += Math.cos(b.face) * 20; b.y += Math.sin(b.face) * 20; }
      if (b.st > wind + 0.15) b.tele = null;
      if (b.st > wind + 0.7) { b.tele = null; end(); if (b.phase2 && m === 'sweep' && (b.combo = (b.combo + 1) % 2)) { b.move = 'sweep'; b.state = 'move'; b.st = 0.25; b.hitDone = false; } }
    } else if (m === 'slam') {
      const wind = W(1.0);
      if (b.st < wind * 0.6) { b.tx += (p.x - b.tx) * Math.min(1, dt * 4); b.ty += (p.y - b.ty) * Math.min(1, dt * 4); }
      b.tele = { kind: 'circle', x: b.tx, y: b.ty, r: 95, k: Math.min(1, b.st / wind) };
      if (b.st >= wind && !b.hitDone) {
        b.hitDone = true; this.emit('slam', { x: b.tx, y: b.ty, r: 95 });
        if (hyp(p.x - b.tx, p.y - b.ty) < 95 + p.r) this.hurtPlayer(30 + this.day * 3, { x: b.tx, y: b.ty });
        const a = Math.atan2(b.ty - b.y, b.tx - b.x), dd = Math.min(hyp(b.tx - b.x, b.ty - b.y) - b.r, 120);
        if (dd > 0) { b.x += Math.cos(a) * dd; b.y += Math.sin(a) * dd; }
      }
      if (b.st > wind + 0.15) b.tele = null;
      if (b.st > wind + 0.9) end();
    } else if (m === 'charge' || m === 'dash') {
      const wind = W(m === 'dash' ? 0.6 : 0.85), dur = m === 'dash' ? 0.42 : 0.6, v = m === 'dash' ? 560 : 400;
      if (b.st < wind) { b.face += angDiff(b.face, toP) * Math.min(1, dt * 6); b.tele = { kind: 'line', len: v * dur, w: b.r * 1.6, k: b.st / wind }; }
      else if (b.st < wind + dur) {
        b.tele = null;
        b.x += Math.cos(b.face) * v * dt; b.y += Math.sin(b.face) * v * dt;
        if (!b.hitDone && hyp(p.x - b.x, p.y - b.y) < b.r + p.r + 4) { b.hitDone = true; this.hurtPlayer(24 + this.day * 3, b); }
        if (blocked(this.map, b.x + Math.cos(b.face) * b.r, b.y + Math.sin(b.face) * b.r, 4)) { b.st = wind + dur; b.stagger = 0.6; this.emit('slam', { x: b.x, y: b.y, r: 40 }); }
      } else if (b.st > wind + dur + 0.7) end();
    } else if (m === 'toll') {
      const wind = W(1.15);
      b.tele = b.st < wind ? { kind: 'ring', k: b.st / wind } : null;
      if (b.st >= wind && !b.fired) { b.fired = 1; this.waves.push({ x: b.x, y: b.y, r0: b.r, r1: 360, dur: 1.15, t: 0, th: 22, dmg: 18 + this.day * 3 }); this.emit('toll'); }
      if (b.phase2 && b.st >= wind + 0.5 && b.fired === 1 && b.id === 'lord') { b.fired = 2; this.waves.push({ x: b.x, y: b.y, r0: b.r, r1: 360, dur: 1.15, t: 0, th: 22, dmg: 18 }); this.emit('toll'); }
      if (b.st > wind + 1.0) end();
    } else if (m === 'dust' || m === 'fan') {
      const wind = W(0.7);
      b.tele = b.st < wind ? { kind: 'glow', k: b.st / wind } : null;
      if (b.st < wind) b.face = toP;
      if (b.st >= wind && !b.fired) {
        b.fired = 1;
        if (m === 'dust') { const n = b.phase2 ? 14 : 10, off = this.R() * TAU; for (let i = 0; i < n; i++) this.shoot(b.x, b.y, off + i / n * TAU, 170, 12 + this.day * 2, 8); }
        else { const n = b.phase2 ? 7 : 5; for (let i = 0; i < n; i++) this.shoot(b.x, b.y, toP + (i - (n - 1) / 2) * 0.22, 250, 15, 8); }
      }
      if (m === 'dust' && b.phase2 && b.st >= wind + 0.45 && b.fired === 1) { b.fired = 2; const n = 14, off = this.R() * TAU; for (let i = 0; i < n; i++) this.shoot(b.x, b.y, off + i / n * TAU, 150, 12, 8); }
      if (b.st > wind + 0.8) end();
    } else if (m === 'brood') {
      const wind = W(0.8);
      b.tele = b.st < wind ? { kind: 'glow', k: b.st / wind } : null;
      if (b.st >= wind && !b.fired) { b.fired = 1; for (let i = 0; i < 2; i++) { const a = this.R() * TAU; const f = this.spawn('moth', b.x + Math.cos(a) * 40, b.y + Math.sin(a) * 40); f.aggro = true; } this.emit('brood'); }
      if (b.st > wind + 0.5) end();
    } else if (m === 'eclipse') {
      const wind = W(1.0);
      b.tele = b.st < wind ? { kind: 'eclipse', k: b.st / wind } : null;
      if (b.st >= wind && !b.fired) { b.fired = 1; b.eclipseHold = 4.5; this.emit('eclipse'); }
      if (b.st > wind + 0.4) end();
    } else end();
  }

  // ---------------- tutorial helpers
  // out of the dark, from whichever side is most open and furthest from chapel light
  tutSpawn(type) {
    const p = this.p;
    let x = p.x, y = p.y - 200, best = -1e9;
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU + this.R() * 0.2, cx = p.x + Math.cos(a) * 210, cy = p.y + Math.sin(a) * 210;
      if (blocked(this.map, cx, cy, 22)) continue;
      const gd = Math.min(...this.map.graces.map(g => hyp(g.x - cx, g.y - cy) - g.r));
      const edge = Math.min(cx, cy, WORLD - cx, WORLD - cy);
      const score = Math.min(gd, 120) + Math.min(edge, 300) * 0.5 + this.R() * 30;
      if (score > best) { best = score; x = cx; y = cy; }
    }
    const f = this.spawn(type, x, y, null, { tut: true });
    f.aggro = true;
    if (type === 'dummy') { f.hp = f.maxHp = 34; }
    return f;
  }
}
