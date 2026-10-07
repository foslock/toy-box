// Scales: the rules. A hanging market scale rides a rail under the awning with the next piece of produce in its pan;
// you slide it along and tip it out onto the plank. Two of a kind merge. Anything that reaches the ground ends the
// market day. As the score climbs, gusts blow through, a crow drops in to stand on one end, and the stallholder saws
// the plank shorter. No page in here: main.js drives it, render.js draws it, balance.mjs runs it headless.
import { World, STEP, G, massOf } from './physics.js';
import { PRODUCE, TOP, DROP_WEIGHTS, POINTS, RIBBON } from './produce.js';

export { STEP };
export const RAIL_Y = -405, PAN_Y = -298;      // the rail the scale hangs from, and the floor of its pan
export const START_L = 540;
export const HEAP_Y = PAN_Y + 38;             // a heap whose top stays above this line for HEAP_T seconds closes the market
const HEAP_T = 3;
const COOL = 0.5;                               // seconds before the pan is loaded again
const CHAIN = 0.9;                              // merges this close together make a chain
// what comes when, by score
export const TUNE = {
  windFrom: 150, windEvery: [26, 40], windPeak: [45, 160],
  crowFrom: 260, crowEvery: [30, 46], crowStay: [7, 10], crowM: 6,
  trims: [700, 1400, 2300, 3400, 4700, 6200], trimBy: 20, minL: 300, trimWarn: 4.5,
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export class Game {
  constructor(seed = Date.now()) { this.reset(seed); }
  reset(seed = Date.now()) {
    this.seed = seed; this.rand = rng(seed);
    this.world = new World(START_L);
    this.state = 'play'; this.t = 0; this.score = 0; this.drops = 0; this.merges = 0; this.maxTier = 0; this.sold = 0;
    this.chain = 0; this.chainT = 0; this.events = []; this.over = null; this.overT = 0; this.ribbons = 0;
    this.pan = { x: 0, vx: 0, tx: 0, kv: 0, tier: this.roll(), next: this.roll(), cool: 0, swing: 0, sw: 0, tip: 0 };
    this.wind = { st: 'calm', t: 0, next: 0, dir: 1, peak: 0, f: 0 };
    this.crow = { st: 'away', t: 0, next: 0, x: 0, y: 0, s: 0, side: 1, from: null, stay: 0, peck: 0, hop: 0, face: 1, flap: 0 };
    this.trim = { i: 0, st: 'idle', t: 0, grace: 0, cuts: [] };
    this.heap = 0; this.heapTop = 0;   // seconds the heap has been too tall, and how high its top is
    this.debris = [];
  }
  ev(type, o = {}) { o.type = type; this.events.push(o); return o; }
  drain() { const e = this.events; this.events = []; return e; }
  roll() {
    let r = this.rand() * DROP_WEIGHTS.reduce((a, b) => a + b, 0);
    for (let i = 0; i < DROP_WEIGHTS.length; i++) { r -= DROP_WEIGHTS[i]; if (r <= 0) return i; }
    return 0;
  }
  get L() { return this.world.plank.L; }
  get ready() { return this.state === 'play' && this.pan.cool <= 0; }
  panRange(tier = this.pan.tier) { return this.L / 2 - PRODUCE[tier].r * 0.5; }

  /* ------------------------------------------------------------------------------------------------- input */
  aim(x) { this.pan.tx = clamp(x, -this.panRange(), this.panRange()); }
  push(dir) { this.pan.kv = dir; }          // keys: -1, 0 or 1
  drop() {
    if (!this.ready) return false;
    const p = this.pan, d = PRODUCE[p.tier];
    p.x = clamp(p.x, -this.panRange(), this.panRange());
    const b = this.world.add(p.tier, p.x, PAN_Y - d.r * 0.7);
    b.vx = p.vx * 0.15; b.dropped = this.t; b.fresh = true;
    this.drops++; p.cool = COOL; p.tip = 1; p.tipDir = p.vx < 0 ? -1 : 1;
    this.ev('drop', { tier: p.tier, x: p.x, body: b });
    p.tier = -1;
    return true;
  }
  shoo() {
    const c = this.crow;
    if (c.st !== 'perch' && c.st !== 'in') return false;
    this.crowLeave('shoo'); return true;
  }

  /* ------------------------------------------------------------------------------------------------- the clock */
  tick() {
    const w = this.world;
    this.t += STEP;
    if (this.state === 'play') { this.movePan(); this.weather(); this.crowTick(); this.trimTick(); this.heapTick(); }
    else this.overT += STEP;
    w.tick();
    for (const e of w.drain()) this.react(e);
    if (this.chainT > 0) { this.chainT -= STEP; if (this.chainT <= 0) this.chain = 0; }
    // anything on the ground, or gone over the side
    if (this.state === 'play') {
      for (const b of w.bodies) {
        if (b.onGround || b.y > w.groundY + 40 || Math.abs(b.x) > 1200) {
          if (this.trim.grace > 0) { this.sell(b, 'caught'); continue; }
          this.end(b); break;
        }
      }
    }
    for (const d of this.debris) { if (d.rest) continue; d.vy += G * STEP; d.x += d.vx * STEP; d.y += d.vy * STEP; d.a += d.w * STEP;
      if (d.y > w.groundY - 6) { d.y = w.groundY - 6; d.vy *= -0.25; d.vx *= 0.6; d.w *= 0.5; if (Math.abs(d.vy) < 40) { d.rest = true; d.vy = 0; } this.ev('clatter', { v: Math.abs(d.vy) }); } }
  }

  movePan() {
    const p = this.pan;
    // keys: slow for the first moment, so a tap nudges, then quicker the longer it's held
    if (p.kv) { p.kt = (p.kt || 0) + STEP; p.tx = clamp(p.tx + p.kv * Math.min(460, 110 + p.kt * 600) * STEP, -this.panRange(Math.max(0, p.tier)), this.panRange(Math.max(0, p.tier))); }
    else p.kt = 0;
    const lim = this.panRange(Math.max(0, p.tier)); p.tx = clamp(p.tx, -lim, lim);
    // a stiff spring toward the target, so a drag feels direct but the pan still swings on its chains
    const ax = (p.tx - p.x) * 900 - p.vx * 55;
    p.vx += ax * STEP; p.x += p.vx * STEP;
    p.sw += (-ax * 0.00012 - p.swing * 30 - p.sw * 3.2) * STEP * 1; p.swing += p.sw * STEP * 6;
    p.swing = clamp(p.swing, -0.5, 0.5);
    if (p.tip > 0) p.tip = Math.max(0, p.tip - STEP * 2.4);
    if (p.cool > 0) {
      p.cool -= STEP;
      if (p.cool <= 0) { p.tier = p.next; p.next = this.roll(); p.tx = clamp(p.tx, -this.panRange(), this.panRange()); this.ev('ready', { tier: p.tier }); }
    }
  }

  react(e) {
    if (e.type === 'merge') {
      this.merges++;
      this.chain = this.chainT > 0 ? this.chain + 1 : 1; this.chainT = CHAIN;
      const base = POINTS[e.tier], bonus = this.chain > 1 ? Math.round(base * 0.5 * (this.chain - 1)) : 0;
      this.score += base + bonus;
      const first = e.tier > this.maxTier; this.maxTier = Math.max(this.maxTier, e.tier);
      this.ev('merge', { tier: e.tier, x: e.x, y: e.y, pts: base + bonus, chain: this.chain, first, body: e.body, a: e.a, b: e.b });
      this.crowStartle(e.x, e.y, PRODUCE[e.tier].r + 30);
    } else if (e.type === 'ribbon') {
      this.ribbons++; this.merges++;
      this.score += RIBBON; this.maxTier = TOP;
      this.ev('ribbon', { x: e.x, y: e.y, pts: RIBBON });
    } else if (e.type === 'hit' || e.type === 'bump') this.events.push(e);
  }

  // the heap touching the scale: settled produce (not the piece on its way down) above the line
  heapTick() {
    let top = Infinity;
    for (const b of this.world.bodies) if (this.t - (b.dropped ?? -9) > 1.2 && Math.hypot(b.vx, b.vy) < 120) top = Math.min(top, b.y - b.r);
    this.heapTop = top;
    if (top < HEAP_Y) {
      if (this.heap === 0) this.ev('heapWarn');
      this.heap += STEP;
      if (this.heap >= HEAP_T) {
        const b = this.world.bodies.reduce((a, q) => (q.y - q.r < a.y - a.r ? q : a));
        this.end(b, 'heap');
      }
    } else this.heap = Math.max(0, this.heap - STEP * 2);
  }

  end(b, why) {
    this.state = 'over'; this.overT = 0;
    const cause = why || (this.wind.st === 'gust' ? 'wind' : this.crow.st === 'perch' || (this.crow.st === 'out' && this.crow.t < 2) ? 'crow'
      : this.trim.st === 'warn' || (this.trim.t < 3 && this.trim.i > 0) ? 'trim' : 'balance');
    this.over = { tier: b.tier, x: b.x, side: Math.sign(b.x) || 1, cause, body: b, heap: why === 'heap' };
    if (this.crow.st === 'perch' || this.crow.st === 'in') this.crowLeave('end');
    this.ev('fell', this.over);
  }

  sell(b, how) {
    const pts = Math.max(1, POINTS[b.tier]);
    this.score += pts; this.sold++;
    this.world.remove(b);
    this.ev('sold', { tier: b.tier, x: b.x, y: b.y, a: b.a, pts, how });
  }

  /* ------------------------------------------------------------------------------------------------- gusts */
  weather() {
    const W = this.wind, T = TUNE;
    W.t += STEP;
    if (W.st === 'calm') {
      this.world.wind = 0; W.f = 0;
      if (this.score < T.windFrom && !W.forced) { W.next = W.t + 8; return; }
      if (!W.next) W.next = W.t + 6;
      if (W.t >= W.next) {
        W.st = 'warn'; W.t = 0; W.dir = this.rand() < 0.5 ? -1 : 1; W.forced = false;
        const k = clamp((this.score - T.windFrom) / 1800, 0, 1);
        W.peak = T.windPeak[0] + (T.windPeak[1] - T.windPeak[0]) * k * (0.7 + 0.3 * this.rand());
        this.ev('gustWarn', { dir: W.dir });
      }
    } else if (W.st === 'warn') {
      W.f = W.t / 1.8 * 0.15;
      this.world.wind = 0;
      if (W.t >= 1.8) { W.st = 'gust'; W.t = 0; this.ev('gust', { dir: W.dir, peak: W.peak }); }
    } else if (W.st === 'gust') {
      const D = 3.4, x = W.t / D;
      W.f = Math.sin(Math.PI * Math.min(1, x)) ** 0.7 * (1 + 0.15 * Math.sin(W.t * 9));
      this.world.wind = W.dir * W.peak * W.f;
      if (W.t >= D) { W.st = 'calm'; W.t = 0; this.world.wind = 0; W.f = 0; W.next = T.windEvery[0] + this.rand() * (T.windEvery[1] - T.windEvery[0]); }
    }
  }

  /* ------------------------------------------------------------------------------------------------- the crow */
  crowTick() {
    const C = this.crow, T = TUNE, w = this.world, pk = w.plank;
    C.t += STEP; C.flap += STEP;
    if (C.st === 'away') {
      if (this.score < T.crowFrom && !C.forced) { C.next = C.t + 6; return; }
      if (!C.next) C.next = C.t + 8;
      if (C.t < C.next) return;
      const spot = this.perchSpot();
      if (spot == null) { C.next = C.t + 4; return; }
      C.st = 'in'; C.t = 0; C.s = spot; C.side = Math.sign(spot); C.forced = false;
      C.from = { x: C.side * (430 + this.rand() * 80), y: RAIL_Y - 40 - this.rand() * 80 };
      C.x = C.from.x; C.y = C.from.y; C.face = -C.side;
      this.ev('crowIn', { side: C.side });
    } else if (C.st === 'in') {
      const D = 1.9, k = Math.min(1, C.t / D), [tx, ty] = w.atPlank(C.s, pk.T);
      // a swoop: out wide, down low, then up onto the plank
      const mx = (C.from.x + tx) / 2 + C.side * 40, my = Math.max(C.from.y, ty) - 30 + 120;
      const e = 1 - (1 - k) * (1 - k);
      C.x = (1 - e) * (1 - e) * C.from.x + 2 * e * (1 - e) * mx + e * e * tx;
      C.y = (1 - e) * (1 - e) * C.from.y + 2 * e * (1 - e) * my + e * e * ty;
      if (k >= 1) {
        // somewhere else to stand if that spot has filled up while it flew
        if (!this.free(C.s)) { const s = this.perchSpot(); if (s == null) { this.crowLeave('busy'); return; } C.s = s; }
        C.st = 'perch'; C.t = 0; C.stay = T.crowStay[0] + this.rand() * (T.crowStay[1] - T.crowStay[0]);
        w.extra = { s: C.s, m: T.crowM };
        this.ev('crowLand', { s: C.s });
      }
    } else if (C.st === 'perch') {
      // it hops toward the end now and then, and pecks at the wood
      if (C.hop > 0) { C.hop -= STEP; }
      else if (this.rand() < STEP * 0.35) {
        const ns = C.s + C.side * (8 + this.rand() * 14);
        if (Math.abs(ns) < pk.L / 2 - 10 && this.free(ns)) { C.s = ns; C.hop = 0.25; w.extra.s = ns; this.ev('hop'); }
      }
      if (C.peck > 0) C.peck -= STEP; else if (this.rand() < STEP * 0.6) { C.peck = 0.3; this.ev('peck'); }
      if (this.rand() < STEP * 0.18) this.ev('caw', { n: 1 + (this.rand() * 2 | 0) });
      const [x, y] = w.atPlank(C.s, pk.T); C.x = x; C.y = y;
      if (Math.abs(C.s) > pk.L / 2 - 4) this.crowLeave('edge');
      else if (Math.abs(pk.th) > pk.max * 0.8) this.crowLeave('tilt');
      else if (C.t > C.stay) this.crowLeave('bored');
      else this.crowStartle(0, 0, 0);
    } else if (C.st === 'out') {
      C.x += C.vx * STEP; C.y += C.vy * STEP; C.vy -= 260 * STEP;
      if (C.t > 3) { C.st = 'away'; C.t = 0; C.next = T.crowEvery[0] + this.rand() * (T.crowEvery[1] - T.crowEvery[0]); }
    }
  }
  // anything moving near it, or landing next to it, sends it off
  crowStartle(x, y, r) {
    const C = this.crow;
    if (C.st !== 'perch') return;
    if (r && Math.hypot(C.x - x, C.y - 16 - y) < r) { this.crowLeave('startled'); return; }
    for (const b of this.world.bodies) {
      const d = Math.hypot(b.x - C.x, b.y - (C.y - 16));
      if (d < b.r + 22 && Math.hypot(b.vx, b.vy) > 40) { this.crowLeave('startled'); return; }
    }
  }
  crowLeave(why) {
    const C = this.crow;
    if (C.st === 'perch' && why !== 'end') this.ev('crowLeave', { why, s: C.s });
    C.st = 'out'; C.t = 0; this.world.extra = null;
    const dir = why === 'edge' ? C.side : -C.side * (this.rand() < 0.5 ? 1 : -1) || 1;
    C.vx = dir * (240 + this.rand() * 80); C.vy = -260; C.face = Math.sign(C.vx);
    if (why !== 'end') this.ev('caw', { n: 2 + (this.rand() * 2 | 0), loud: true });
  }
  free(s) {
    const w = this.world;
    for (const b of w.bodies) {
      const [ls, lh] = w.local(b.x, b.y);
      if (Math.abs(ls - s) < b.r + 16 && lh < w.plank.T + b.r + 50) return false;
    }
    return true;
  }
  perchSpot() {
    const half = this.L / 2;
    for (let i = 0; i < 10; i++) {
      const s = (this.rand() < 0.5 ? -1 : 1) * half * (0.55 + this.rand() * 0.33);
      if (this.free(s)) return s;
    }
    return null;
  }

  /* ------------------------------------------------------------------------------------------------- the saw */
  trimTick() {
    const R = this.trim, T = TUNE, w = this.world;
    R.t += STEP;
    if (R.grace > 0) R.grace -= STEP;
    if (R.st === 'idle') {
      if (R.i < T.trims.length && this.score >= T.trims[R.i] && this.L - 2 * T.trimBy >= T.minL) {
        R.st = 'warn'; R.t = 0; R.at = this.L / 2 - T.trimBy;
        this.ev('trimWarn', { at: R.at });
      }
    } else if (R.st === 'warn') {
      if (R.t >= T.trimWarn) {
        const old = this.L, L = old - 2 * T.trimBy, pk = w.plank;
        R.st = 'idle'; R.t = 0; R.i++; R.grace = 1.6;
        // the two offcuts drop to the ground
        for (const side of [-1, 1]) {
          const [x, y] = w.atPlank(side * (L / 2 + T.trimBy / 2), pk.T / 2);
          this.debris.push({ x, y, a: pk.th, vx: side * 40, vy: -60, w: side * (2 + this.rand() * 3), len: T.trimBy, rest: false });
        }
        w.setLength(L);
        if (this.crow.st === 'perch' && Math.abs(this.crow.s) > L / 2 - 14) this.crowLeave('edge');
        // anything left standing past the cut is sold off the end of the stall
        for (const b of [...w.bodies]) { const [s] = w.local(b.x, b.y); if (Math.abs(s) > L / 2) this.sell(b, 'trim'); }
        this.ev('trim', { L, old });
      }
    }
  }

  // for ?demo and ?debug: bring the crow or a gust in now, whatever the score
  summonCrow() { if (this.crow.st === 'away') { this.crow.next = this.crow.t; this.crow.forced = true; } }
  summonGust() { if (this.wind.st === 'calm') { this.wind.next = this.wind.t; this.wind.forced = true; } }

  /* ------------------------------------------------------------------------------------------------- for the page */
  // where a piece dropped from x would first come to rest, ignoring rolling: { y, on: body|null }
  landing(x, r) {
    const w = this.world, pk = w.plank, c = Math.cos(pk.th), s = Math.sin(pk.th);
    let best = Infinity, on = null;
    const ps = x / c;
    if (Math.abs(ps) < pk.L / 2 + r * 0.3) best = ps * s - pk.T / c - r / c;
    for (const b of w.bodies) {
      const dx = Math.abs(b.x - x), R = b.r + r;
      if (dx >= R) continue;
      const y = b.y - Math.sqrt(R * R - dx * dx);
      if (y < best) { best = y; on = b; }
    }
    return best === Infinity ? { y: w.groundY - r, on: null, off: true } : { y: best, on, off: false };
  }
  // how far over the plank would go with everything as it lies now, as a fraction of the way to the ground
  lean() { const pk = this.world.plank; return clamp(this.world.torque() * G / pk.k / pk.max, -1.5, 1.5); }
  weightOf(tier) { return massOf(PRODUCE[tier].r); }
}
