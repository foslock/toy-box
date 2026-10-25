// A season of launches: days, fish, gear, and the heap that never goes away.
import { World, Run, GEAR, LINES, NAMES, GOAL, payout } from './sim.js';

export class Game {
  constructor(save) {
    this.day = 1; this.fish = 0; this.best = 0; this.won = 0; this.total = 0;
    this.tiers = { ramp: 0, wings: 0, rocket: 0, belly: 0 };
    this.log = [];                   // every wreck ever, in the order it landed
    if (save) Object.assign(this, { day: save.day, fish: save.fish, best: save.best, won: save.won || 0, total: save.total || 0, tiers: { ...this.tiers, ...save.tiers }, log: save.log || [] });
    this.world = new World();
    for (const r of this.log) this.world.stamp(r.k, r.x, { d: r.d, n: r.n, wings: r.wings, rocket: r.rocket });
    this.run = null;
  }
  nameFor(day) {
    const n = NAMES[(day - 1) % NAMES.length], lap = Math.floor((day - 1) / NAMES.length);
    return lap ? n + ' ' + ['II', 'III', 'IV', 'V', 'VI'][Math.min(4, lap - 1)] : n;
  }
  get name() { return this.nameFor(this.day); }
  newRun() {
    const r = this.run = new Run(this.world, this.tiers);
    r.day = this.day; r.name = this.name;
    return r;
  }
  // the run has ended: write down the wrecks, pay out, move the calendar on
  settle() {
    const r = this.run;
    for (const d of r.debris) if (d.wreck) this.log.push(rec(d.wreck));
    if (r.wreck) this.log.push(rec(r.wreck));
    const dist = r.end === 'sea' ? GOAL : Math.max(0, r.x);
    const parts = payout(r.stats, dist, this.best);
    if (r.end === 'sea') parts.push(['Reached the sea', 500]);
    const earned = parts.reduce((a, p) => a + p[1], 0);
    const prevBest = this.best;
    this.best = Math.max(this.best, dist);
    this.fish += earned; this.total += earned;
    const firstWin = r.end === 'sea' && !this.won;
    if (firstWin) this.won = this.day;
    const rep = { day: this.day, name: r.name, dist, parts, earned, end: r.end, record: dist > prevBest, prevBest, stats: r.stats, firstWin, wreck: r.wreck };
    this.day++;
    this.run = null;
    return rep;
  }
  next(line) { const t = this.tiers[line]; return t + 1 < GEAR[line].length ? GEAR[line][t + 1] : null; }
  canBuy(line) { const n = this.next(line); return !!n && n.price <= this.fish; }
  buy(line) {
    const n = this.next(line);
    if (!n || n.price > this.fish) return false;
    this.fish -= n.price; this.tiers[line]++;
    return true;
  }
  cheapest() {
    let best = null;
    for (const l of LINES) { const n = this.next(l); if (n && (!best || n.price < best.price)) best = { line: l, price: n.price }; }
    return best;
  }
  toJSON() { return { v: 1, day: this.day, fish: this.fish, best: this.best, won: this.won, total: this.total, tiers: this.tiers, log: this.log }; }
}
function rec(w) {
  const o = { k: w.k, x: Math.round(w.x * 100) / 100, d: w.d };
  if (w.n) o.n = w.n;
  if (w.wings) o.wings = w.wings;
  if (w.rocket) o.rocket = w.rocket;
  return o;
}

// A sensible pilot, for the demo and the balance sim (and the tutorial's ghost hints).
export function pilot(run, opts = {}) {
  const gam = Math.atan2(run.vy, run.vx), alt = run.alt, v = run.speed;
  const out = { pitch: gam, boost: run.hasRocket && run.state === 'fly' };
  const sl = Math.atan(run.w.slope(run.x + run.vx * 0.15));
  const sink = -run.vy;
  if (alt < Math.max(3, sink * 0.45) && run.vy < 0) { out.pitch = sl; return out; }
  if (run.hasWings) {
    const wg = run.wing, vs = Math.sqrt(9.8 / (wg.c * 1.35));
    if (out.boost) out.pitch = opts.climb ?? 0.35;
    else if (v < vs * 1.25) out.pitch = gam - 0.12;
    else out.pitch = gam + (opts.aoa ?? Math.sqrt(wg.cd0 / wg.k) / 5);
  } else if (out.boost) out.pitch = opts.climb ?? 0.5;
  return out;
}
