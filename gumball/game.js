// One run: what's in the machine, the money, the rent, and the tray where gumballs land.
// No DOM here, so sim.mjs can play whole runs in Node.
import { World } from './physics.js';
import { KINDS, OFFERABLE, evaluate, touching, has } from './symbols.js';

// layout, in world units (the view scales this 400 × 780 column to fit)
export const L = {
  W: 400, H: 780,
  globe: { x: 200, y: 196, r: 118 },
  body: { top: 300, bot: 432 },
  crank: { x: 200, y: 382, r: 34 },
  tray: { x0: 28, x1: 372, lid: 470, floorSide: 664, floorMid: 688 },
  R: 19,
};

export const RENTS = [15, 30, 55, 90, 130, 180, 240, 320];
export const PERIOD = 5;
export const START = ['coin', 'coin', 'cherry', 'cherry', 'flower', 'bee'];
const EGG_DV = 330;

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Game {
  constructor(seed = 1, opts = {}) {
    this.rand = rng(seed);
    this.uid = 0;
    this.items = (opts.start || START).map((k) => this.newItem(k));
    this.money = opts.money ?? 5;
    this.crank = 0;           // cranks finished
    this.rentIdx = 0;         // rents paid
    this.earned = 0;
    this.phase = 'idle';      // idle | drop | settle | done
    this.queue = [];
    this.spawnT = 0;
    this.nudges = 0;
    this.rerolls = 0;
    this.events = [];
    this.world = this.makeTray();
    this.tray = [];           // physics balls currently in the tray
    this.endless = false;
  }

  newItem(kind) { return { uid: ++this.uid, kind, age: 0 }; }

  makeTray() {
    const w = new World({ g: 1500, sub: 6, iters: 3 });
    const T = L.tray;
    w.addSeg(T.x0, T.lid, T.x1, T.lid);
    w.addSeg(T.x0, T.lid, T.x0, T.floorSide);
    w.addSeg(T.x1, T.lid, T.x1, T.floorSide);
    w.addSeg(T.x0, T.floorSide, L.W / 2, T.floorMid);
    w.addSeg(L.W / 2, T.floorMid, T.x1, T.floorSide);
    const pairT = new Map();
    w.onHit = (a, b, dv) => {
      this.events.push({ type: 'hit', a, b, dv });
      for (const x of b ? [a, b] : [a]) if (x.kind === 'dice' && !x.roll) x.roll = 1 + Math.floor(this.rand() * 6);
      if (!b) return;
      // superballs count bounces off other gumballs (with a short per-pair cooldown)
      const key = a.id < b.id ? a.id * 1000 + b.id : b.id * 1000 + a.id;
      const last = pairT.get(key) ?? -1;
      if (w.time - last > 0.08 && dv > 110) {
        pairT.set(key, w.time);
        for (const x of [a, b]) if (x.kind === 'superball' && x.bounces < 10) { x.bounces++; this.events.push({ type: 'boing', ball: x }); }
      }
      if (dv > EGG_DV) for (const x of [a, b]) if (x.kind === 'egg') this.hatch(x);
    };
    w.force = (b, h) => {
      if (!has(b.kind, 'coin')) return;
      for (const m of w.balls) {
        if (m.kind !== 'magnet') continue;
        const dx = m.x - b.x, dy = m.y - b.y, d = Math.hypot(dx, dy);
        if (d < 1 || d > 190) continue;
        const acc = 1700 * (1 - d / 190) + 300;
        b.vx += (dx / d) * acc * h; b.vy += (dy / d) * acc * h;
      }
    };
    return w;
  }

  hatch(ball) {
    ball.kind = 'chick'; ball.item.kind = 'chick'; ball.item.age = 0;
    this.events.push({ type: 'hatch', ball });
  }

  get rent() { return this.rentIdx < RENTS.length ? RENTS[this.rentIdx] : Math.round(RENTS[RENTS.length - 1] * Math.pow(1.45, this.rentIdx - RENTS.length + 1) / 10) * 10; }
  get cranksLeft() { return PERIOD - (this.crank % PERIOD); }
  get dispense() { return 5 + this.rentIdx; }
  get nudgeCost() { return this.nudges + 1; }
  get rerollCost() { return 2 + this.rerolls; }

  // pick which gumballs come out, without replacement
  draw() {
    const pool = this.items.slice();
    const out = [];
    const n = Math.min(this.dispense, pool.length);
    for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(this.rand() * pool.length), 1)[0]);
    return out;
  }

  startCrank(forced = null) {
    if (this.phase !== 'idle') return [];
    if (!this.items.length) this.items.push(this.newItem('coin'));
    const picks = forced || this.draw();
    this.queue = picks.slice();
    this.spawnT = 0.05;
    this.nudges = 0;
    this.phase = 'drop';
    this.settleT = 0;
    return picks;
  }

  spawn(item) {
    const K = KINDS[item.kind];
    const r = L.R * (K.r || 1);
    const b = this.world.add({
      id: item.uid, item, kind: item.kind, r,
      x: L.W / 2 + (this.rand() - 0.5) * 34, y: L.tray.lid + r + 2,
      vx: (this.rand() - 0.5) * 160, vy: 380,
      m: K.m || 1, e: K.e ?? 0.3, gs: K.gs ?? 1, mu: 0.3,
      bounces: 0, roll: 0, born: this.world.time,
    });
    if (item.kind === 'magnet') b.m = 1.8;
    this.tray.push(b);
    this.events.push({ type: 'spawn', ball: b });
  }

  tick(dt) {
    if (this.phase === 'drop') {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.queue.length) { this.spawn(this.queue.shift()); this.spawnT = 0.17; }
      if (!this.queue.length) { this.phase = 'settle'; this.settleT = 0; }
    }
    if (this.tray.length) this.world.step(dt);
    if (this.phase === 'settle') this.settleT += dt;
  }

  get settled() { return this.phase === 'settle' && this.settleT > 0.4 && this.world.maxSpeed() < 14; }
  get canCollect() { return this.phase === 'settle' && this.settleT > 0.25; }

  nudge(dir) {
    if (this.phase !== 'settle' && this.phase !== 'drop') return false;
    if (this.money < this.nudgeCost) return false;
    this.money -= this.nudgeCost;
    this.nudges++;
    for (const b of this.tray) {
      b.vx += dir * (300 + this.rand() * 140) / Math.sqrt(b.m);
      b.vy -= (160 + this.rand() * 160) / Math.sqrt(b.m);
    }
    this.settleT = 0;
    this.events.push({ type: 'nudge', dir });
    return true;
  }

  score() {
    const adj = touching(this.tray);
    return { adj, ...evaluate(this.tray, adj) };
  }

  collect() {
    const s = this.score();
    this.money += s.total;
    this.earned += s.total;
    const gone = new Set();
    const grew = [];
    this.tray.forEach((b, i) => {
      if (s.fate[i]) { gone.add(b.item.uid); return; }
      const G = KINDS[b.item.kind].grows;
      if (G) { b.item.age++; if (b.item.age >= G[1]) { b.item.kind = G[0]; b.item.age = 0; grew.push(b.item); } }
    });
    this.items = this.items.filter((it) => !gone.has(it.uid));
    const result = { ...s, balls: this.tray.slice(), grew };
    this.tray = [];
    this.world.balls.length = 0;
    this.crank++;
    this.phase = 'done';
    return result;
  }

  get rentDue() { return this.crank > 0 && this.crank % PERIOD === 0 && this.phase === 'done'; }

  // three choices, weighted by rarity; rarer things get likelier as the rent climbs
  offers() {
    const t = this.rentIdx;
    const w = { 1: 10, 2: 3 + t * 0.9, 3: 0.7 + t * 0.45 };
    const out = [];
    let guard = 0;
    while (out.length < 3 && guard++ < 100) {
      let tot = 0; for (const k of OFFERABLE) tot += w[KINDS[k].rarity];
      let r = this.rand() * tot, pick = OFFERABLE[0];
      for (const k of OFFERABLE) { r -= w[KINDS[k].rarity]; if (r <= 0) { pick = k; break; } }
      if (!out.includes(pick)) out.push(pick);
    }
    return out;
  }

  take(kind) { if (kind) this.items.push(this.newItem(kind)); }
  reroll() { if (this.money < this.rerollCost) return null; this.money -= this.rerollCost; this.rerolls++; return this.offers(); }

  payRent() {
    const r = this.rent;
    if (this.money < r) return false;
    this.money -= r;
    this.rentIdx++;
    if (this.rentIdx >= RENTS.length) this.endless = true;
    return true;
  }

  toss(uid) { this.items = this.items.filter((it) => it.uid !== uid); }
  next() { this.phase = 'idle'; this.rerolls = 0; }
}
