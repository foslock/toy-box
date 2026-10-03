// The whole game as numbers, with no page: a state you can save as JSON, a tick that moves it on, and the few things a
// player can do to it. The page (main.js) and the balance check (check.mjs) both drive this.
import { BASE, PROJECTS, MAKERS, EVENTS, NAMES, PHASES, LN_STARS, rise } from './content.js';

export { PROJECTS, MAKERS, PHASES, LN_STARS, rise };
export const KITCHENS = 2400;
export const PEOPLE = 8.1e9;
const TOWN_JAR_G = 120;                 // grams in a jar of you in someone else's kitchen
const GIVE_G = 100, GIVE_WAIT = 4;      // a jar given away by hand, and the walk there and back
const PEAK = 0.7;                       // seconds you sit at your peak before the baker comes
// in-world minutes for each real second, by phase: hours in the kitchen, weeks in town, years in the world, aeons beyond
const CAL = [12, 360, 11520, 2.6e13];

const byId = Object.fromEntries(PROJECTS.map(p => [p.id, p]));
const makerById = Object.fromEntries(MAKERS.map(m => [m.id, m]));
export const project = id => byId[id];
export const maker = id => makerById[id];

export function fresh(seed = (Math.random() * 2 ** 31) | 0, meta = {}) {
  return {
    v: 1, seed, name: NAMES[Math.abs(seed) % NAMES.length], gen: meta.gen || 1,
    phase: 0, t: 0, phaseAt: [0], cal: 0, done: false, endedAt: 0,
    clicks: 0, b: 0, bTotal: 0,
    grams: 50, rise: 0, peakT: 0, feeds: 0, binned: 0, dough: 0, loaves: 0, adm: 0,
    jars: 0, given: 0, giveT: 0, forgotten: 0, money: 0, moneyTotal: 0,
    hosts: 0, massT: 0,
    lnSys: 0, warmth: 0.45, over: 0, chill: 0, collapses: 0,
    own: {}, ownN: 0, n: Object.fromEntries(MAKERS.map(m => [m.id, 0])), shown: {}, seen: {},
    log: [],
  };
}

// ---- the numbers, from what's been bought ---------------------------------------------------------------------------
let memo = { key: '', k: null };
export function stats(s) {
  const key = s.ownN + ':' + s.seed + ':' + s.gen;
  if (memo.key === key && memo.s === s) return memo.k;
  const k = { ...BASE };
  const owned = PROJECTS.filter(p => s.own[p.id] && p.mod);
  for (const op of ['=', '+', '*']) for (const p of owned) for (const [key2, o, v] of p.mod) if (o === op) {
    if (o === '=') k[key2] = v; else if (o === '+') k[key2] += v; else k[key2] *= v;
  }
  if (s.gen > 1) k.bMul *= 1 + 0.25 * (s.gen - 1);   // a spoonful of the last you
  memo = { key, k, s };
  return k;
}

export const vigorOf = (s, k = stats(s)) => k.vigor * (1 + k.colony * s.n.colony) * k.bMul;

// Rates the page shows, worked out fresh (also kept on s._r by tick).
export function rates(s, k = stats(s)) {
  const vig = vigorOf(s, k);
  const jarB = s.grams * vig;
  const townB = s.phase >= 1 ? s.jars * TOWN_JAR_G * vig : 0;
  const worldB = s.phase >= 2 ? (s.hosts * k.hostB + (k.crust ? s.massT * 2e-3 : 0)) * k.bMul : 0;
  const cosmosB = s.phase >= 3 ? 2e13 * Math.exp(0.4 * s.lnSys) * k.bMul : 0;
  const bps = jarB + townB + worldB + cosmosB;
  const r = { vig, jarB, bps, tapB: 1 + k.tap * bps, doubling: k.dbl };
  if (s.phase >= 1) {
    r.reachN = KITCHENS * Math.min(1, k.reach);
    r.spread = k.spread * (1 + k.klass * s.n.class);
    r.R = s.own.reservoir ? Infinity : r.spread / k.neglect;
    r.mps = ((k.honesty ? 0.3 + s.jars * 0.012 : 0) + s.n.bakery * k.bakery) * k.sell;
  }
  if (s.phase >= 2) {
    r.flour = (s.n.field + s.n.kelp) * k.yield * k.flourMul * (1 + k.mill * s.n.mill);
    r.supply = r.flour / k.perHost;
    r.appeal = Math.min(1, k.appeal * (1 + k.ads * s.n.ads));
    r.demand = PEOPLE * r.appeal;
    r.short = r.supply < r.demand;
    r.mps = (r.mps || 0) + s.hosts * k.price;
    r.massGrow = r.flour * 0.5 + (k.crust ? s.massT * 0.06 : 0);
  }
  if (s.phase >= 3) {
    r.grow = growthOf(s, k);
  }
  return r;
}

function growthOf(s, k) {
  let g = k.growth * (0.25 + 1.75 * s.warmth) * k.growMul * (1 + k.pod * s.n.pod);
  if (s.chill > 0) g *= 0.2;
  return g;
}

// ---- time -----------------------------------------------------------------------------------------------------------
export const NOOP = { log() {}, sound() {}, fx() {} };

export function tick(s, dt, ev = NOOP) {
  if (s.done) return;
  const k = stats(s);
  s.t += dt;
  s.cal += dt * CAL[s.phase];
  const r = rates(s, k);
  s._r = r;

  gain(s, r.bps * dt);
  if (s.peakT > 0) {
    s.peakT -= dt;
    if (s.peakT <= 0) feed(s, k, ev);
  } else addRise(s, k, dt / k.dbl, ev);
  if (s.giveT > 0) s.giveT = Math.max(0, s.giveT - dt);

  if (s.phase >= 1) town(s, k, r, dt, ev);
  if (s.phase >= 2) world(s, k, r, dt);
  if (s.phase >= 3) beyond(s, k, dt, ev);

  for (const e of EVENTS) if (!s.seen[e.id] && e.when(s)) { s.seen[e.id] = 1; say(s, ev, e.log, 'event'); }
  for (const p of PROJECTS) if (!s.shown[p.id] && !s.own[p.id] && p.phase === s.phase && p.when(s) && within(s, p.cost, REVEAL)) { s.shown[p.id] = s.t; ev.fx('shown', p.id); }

  if (s.phase === 3 && s.lnSys >= LN_STARS && !s.done) {
    s.done = true; s.endedAt = s.t;
    ev.fx('end');
  }
}

function gain(s, b) { s.b += b; s.bTotal += b; }

// A card shows once you have this share of what it costs, so the list is only ever things within reach.
const REVEAL = 0.25;
export const within = (s, c, f) => (!c.b || s.b >= c.b * f) && (!c.m || s.money >= c.m * f) && (!c.a || s.adm >= c.a * f);

function addRise(s, k, x, ev) {
  if (s.grams <= 0) return;
  s.rise += x;
  if (s.rise >= 1) { s.rise = 1; s.peakT = PEAK; ev.fx('peak'); }
}

// The baker comes, discards down to half the vessel if they need to, and doubles what's left.
function feed(s, k, ev) {
  s.feeds++; s.rise = 0; s.peakT = 0;
  let disc = 0;
  if (s.grams * 2 > k.cap) { disc = Math.max(0, s.grams - k.cap / 2); s.grams -= disc; }
  s.grams = Math.min(k.cap, s.grams * 2);
  let loaves = 0, crumbs = 0;
  if (disc > 0) {
    if (s.own.tang) {
      let pool = s.dough + disc;
      loaves = Math.min(k.lpf, Math.floor(pool / 100));
      pool -= loaves * 100;
      s.dough = Math.min(pool, 99);
      crumbs = pool - s.dough;
    } else crumbs = disc;
    if (crumbs > 0) { if (k.crack > 0) s.adm += crumbs * k.crack * k.adm; else s.binned += crumbs; }
    if (loaves) { s.loaves += loaves; s.adm += loaves * k.adm; }
  }
  ev.fx('feed', { disc, loaves });
  ev.sound('feed');
}

function town(s, k, r, dt, ev) {
  if (s.own.reservoir) { s.jars = KITCHENS; }
  else {
    const J = s.jars;
    const up = r.spread * J * Math.max(0, 1 - J / r.reachN);
    const down = k.neglect * J;
    s.jars = Math.min(KITCHENS, Math.max(0, J + (up - down) * dt));
    s.forgotten += down * dt;
    if (s.jars < 0.5 && J >= 0.5) { s.jars = 0; say(s, ev, 'The last jar of you in town has been forgotten. Just the baker\'s now.', 'event'); }
  }
  const m = (r.mps || 0) * dt;
  s.money += m; s.moneyTotal += m;
}

function world(s, k, r, dt) {
  const target = Math.min(r.supply, r.demand);
  s.hosts += (target - s.hosts) * (1 - Math.exp(-(target > s.hosts ? 0.06 : 0.3) * dt));
  s.massT += r.massGrow * dt;
}

function beyond(s, k, dt, ev) {
  if (k.auto) s.warmth = Math.min(1, k.safe);
  const g = growthOf(s, k);
  if (s.chill > 0) s.chill = Math.max(0, s.chill - dt);
  s.lnSys = Math.min(LN_STARS, s.lnSys + g * dt);
  if (s.warmth > k.safe + 1e-9) s.over += (s.warmth - k.safe) * k.overRate * dt;
  else s.over = Math.max(0, s.over - k.cool * dt);
  if (s.over >= 1) {
    s.collapses++; s.over = 0; s.chill = 8;
    s.lnSys *= 0.85;
    s.warmth = Math.min(s.warmth, k.safe);
    ev.fx('collapse'); ev.sound('collapse');
    if (s.collapses > 1) say(s, ev, ['You overproofed again. A slow sag, and a sigh, and you start again from lower down.',
      'Too warm. You fall, softly, by a few billion galaxies.', 'Collapse. It doesn\'t hurt. It\'s just very disappointing.'][s.collapses % 3], 'warn');
  }
}

// ---- things a player does -------------------------------------------------------------------------------------------
export function tap(s, ev = NOOP) {
  if (s.done) return 0;
  const k = stats(s);
  const r = s._r || rates(s, k);
  const b = 1 + k.tap * r.bps;
  s.clicks++;
  gain(s, b);
  if (s.peakT <= 0) addRise(s, k, k.tapRise, ev);
  ev.sound('bubble');
  return b;
}

export const costOf = (s, id) => { const m = makerById[id]; return m.base * Math.pow(m.grow, s.n[id]); };
const purse = (s, cur) => cur === 'b' ? s.b : cur === 'm' ? s.money : s.adm;

export function affordable(s, cost) {
  return (!cost.b || s.b >= cost.b) && (!cost.m || s.money >= cost.m) && (!cost.a || s.adm >= cost.a);
}

export function canBuy(s, id) {
  const p = byId[id];
  return !!p && !s.own[id] && !!s.shown[id] && p.phase === s.phase && !s.done && affordable(s, p.cost);
}

export function buy(s, id, ev = NOOP) {
  if (!canBuy(s, id)) return false;
  const p = byId[id];
  if (p.cost.b) s.b -= p.cost.b;
  if (p.cost.m) s.money -= p.cost.m;
  if (p.cost.a) s.adm -= p.cost.a;
  s.own[id] = s.t; s.ownN++;
  say(s, ev, p.log, 'buy');
  ev.sound('buy'); ev.fx('bought', id);
  if (p.next) advance(s, ev);
  return true;
}

export function makerOpen(s, id) {
  const m = makerById[id];
  return !!m && m.phase === s.phase && m.when(s) && !s.done;
}
export function makerMax(s, id) {
  const m = makerById[id];
  return m.max ? m.max(s, stats(s)) : Infinity;
}
export function canMake(s, id) {
  if (!makerOpen(s, id)) return false;
  const m = makerById[id];
  return s.n[id] < makerMax(s, id) && purse(s, m.cur) >= costOf(s, id);
}
export function make(s, id, ev = NOOP) {
  if (!canMake(s, id)) return false;
  const m = makerById[id];
  const c = costOf(s, id);
  if (m.cur === 'b') s.b -= c; else if (m.cur === 'm') s.money -= c; else s.adm -= c;
  s.n[id]++;
  ev.sound('make'); ev.fx('made', id);
  return true;
}

export const canGive = s => s.phase === 1 && !s.own.reservoir && s.giveT <= 0 && s.grams >= GIVE_G + 20 && s.jars < KITCHENS;
const STREET = [3, 5, 8, 11, 12, 17, 21, 23, 26, 31, 33, 40, 42, 47, 52, 58, 61, 66, 73, 79];
export function give(s, ev = NOOP) {
  if (!canGive(s)) return false;
  s.grams -= GIVE_G; s.jars += 1; s.given++; s.giveT = GIVE_WAIT;
  if (s.given <= 4 || s.given % 10 === 0) say(s, ev, s.given === 1
    ? 'The baker walks a jar of you round to number 31. "Feed it every day," they say. "Don\'t forget."'
    : `A jar of you goes to number ${STREET[(s.given * 7) % STREET.length]}${s.given >= 10 ? `. That's ${s.given} you've handed out yourself` : ''}.`, 'small');
  ev.sound('give'); ev.fx('give');
  return true;
}

export function setWarmth(s, w) {
  if (s.phase < 3 || stats(s).auto) return;
  s.warmth = Math.max(0, Math.min(1, w));
}

function advance(s, ev) {
  s.phase++;
  s.phaseAt[s.phase] = s.t;
  if (s.phase === 1) { s.jars = 1; s.given = 0; }
  if (s.phase === 2) { s.n.field = 1; s.hosts = 6000; s.massT = 3; }
  if (s.phase === 3) { s.lnSys = 0; s.warmth = 0.45; s.calBeyond = s.cal; }
  ev.fx('phase', s.phase); ev.sound('phase');
}

// ---- the log --------------------------------------------------------------------------------------------------------
export function say(s, ev, text, kind = 'event') {
  const line = { text: text.replace(/\{N\}/g, s.name), kind, t: s.t, phase: s.phase };
  s.log.push(line);
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
  ev.log(line);
}

export const nameIt = (s, text) => text.replace(/\{N\}/g, s.name);

// Lists for the page: what can be bought now, cheapest first.
export function openProjects(s) {
  return PROJECTS.filter(p => p.phase === s.phase && s.shown[p.id] && !s.own[p.id]);
}
export function openMakers(s) {
  return MAKERS.filter(m => makerOpen(s, m.id));
}

// Catch up after the tab was closed or hidden: passive growth only, in coarse steps, nothing bought.
export function catchUp(s, seconds, ev = NOOP) {
  const before = snapshot(s);
  const quiet = { log: l => ev.log && ev.quiet !== true && ev.log(l), sound() {}, fx(n, d) { if (n === 'end') ev.fx('end'); } };
  let left = Math.min(seconds, 12 * 3600);
  while (left > 0 && !s.done) {
    const dt = Math.min(left, left > 600 ? 2 : 0.5);
    tick(s, dt, quiet);
    left -= dt;
  }
  return { before, after: snapshot(s), seconds: Math.min(seconds, 12 * 3600) };
}
export const snapshot = s => ({ b: s.b, feeds: s.feeds, loaves: s.loaves, adm: s.adm, jars: s.jars, money: s.money, hosts: s.hosts, massT: s.massT, lnSys: s.lnSys, grams: s.grams });

// How much of you there is, in grams, for the big number at the top.
export function massG(s) {
  if (s.phase === 0) return s.grams;
  if (s.phase === 1) return s.grams + s.jars * TOWN_JAR_G + s.n.bakery * 4000 + (s.own.reservoir ? 4e9 : 0);
  if (s.phase === 2) return 4e9 + s.massT * 1e6;
  return 4e9 + s.massT * 1e6 + Math.expm1(s.lnSys) * 4e33;
}
