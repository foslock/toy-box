// Rigged Racer: the race. Everything that happens on the road, stepped at a fixed 60 a second and with no randomness,
// so the same setup always runs the same race: that's what makes it a puzzle. The state is plain data, so a copy of it
// is a save (the page keeps one at the start of every lap, to rewind to). The page and check.mjs both run it.
//
// Each driver keeps to their lane unless something makes them change: trouble ahead they can see in time, a lane
// that ends, a slower kart in the way, something they want (crates, boost pads, a shortcut). Hazards are only dodged
// if they're seen soon enough and there's a free lane to go to.
import { lanesAt, snapLane, edgesAt, bendAt, ahead, progressOf, roadDistance, sampleAt } from './track.js';
import { RACERS, has, rivalOf, crateItem } from './data.js';

export const DT = 1 / 60;
export const NEAR = 6;          // nothing can be put down this close in front of a kart
const LEN = .95;                // a kart's length, nose to tail, for who's in whose way
const WIDE = .6;                // how far apart two karts (or a kart and a thing) must be across the road to pass
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// How much each thing on the road is worth avoiding (or going for), to a driver choosing a lane.
const HAZARD = { oil: 45, spikes: 50, mine: 75, barrel: 120, rubble: 120 };
const LURE = { crate: [6, 40], skull: [14, 60], boost: [5, 28], ramp: [0, 8] };   // [anyone, greedy]
const SHOOTABLE = new Set(['barrel', 'mine', 'spikes', 'crate', 'skull', 'rubble']);
const TRAPS = new Set(['barrel', 'mine', 'spikes', 'rubble', 'oil']);

// signed distance from a to b along a path: on a loop, the short way round
const sd = (p, a, b) => { let d = b - a; if (p.closed) { d = ((d % p.L) + p.L) % p.L; if (d > p.L / 2) d -= p.L; } return d; };
const crossed = (p, s0, s1, at) => p.closed ? ahead(p, ((s0 % p.L) + p.L) % p.L, at) < s1 - s0 : s0 < at && s1 >= at;
const out = k => k.gone > 0 || k.lift > 0;                 // not on the road at all
const up = k => k.air > 0 || k.jump > 0;                   // off the ground
const stopped = k => k.stun > 0 || k.squash > 0;

/* ---------- a new race ---------- */
export function newRace(T, level) {
  const main = T.main, n = level.racers.length;
  const S = {
    t: 0, tick: 0, laps: level.laps, n, lapShown: 1, finished: 0, over: false, used: 0, nextId: 1,
    karts: [], objs: [], shots: [], ev: [],
    stock: { ...(level.stock?.[0] || {}) }, plan: level.stock || [],
    gates: {}, fx: [],
  };
  // the grid: pole position first, across the lanes, staggered back from the line
  const grid = lanesAt(main, main.L - 1);
  level.racers.forEach((r, i) => {
    const who = typeof r === 'string' ? r : r.who;
    const col = i % grid.length, row = Math.floor(i / grid.length);
    const s = main.L - 1.1 - row * 1.9 - col * .55;
    const x = grid[(col + Math.floor(grid.length / 2)) % grid.length];
    S.karts.push({
      i, who, path: 0, s, x, tx: x, v: 0, lap: 0, dist: s - main.L, rank: i + 1, fin: false, finT: 0, place: 0,
      item: typeof r === 'object' && r.item || null, fork: 0, hits: [],
      spin: 0, spinMax: 1, flat: 0, stun: 0, air: 0, airMax: 1, jump: 0, jumpMax: 1, boost: 0, chrome: 0, lift: 0, gone: 0, squash: 0, scrape: 0, shoved: 0,
    });
  });
  S.order = S.karts.map(k => k.i);
  for (const b of T.paths.slice(1)) if (b.gate) S.gates[b.gate] = level.gates?.[b.gate] ?? true;
  for (const f of T.def.fixtures || []) {
    const p = T.paths[f.path || 0];
    S.fx.push({ id: f.id, kind: f.kind, path: f.path || 0, s0: f.at * p.L, len: f.len || 2.5, armed: false, at: -9, victim: -1 });
  }
  // the track's own crates, a row across the road, that come back a few seconds after they're taken
  for (const c of T.def.crates || []) {
    const s = c.at * main.L;
    for (const x of lanesAt(main, s)) S.objs.push({ id: S.nextId++, kind: 'crate', by: 'track', path: 0, s, x, hp: 1, off: 0, ci: -1 });
  }
  rank(S, T);
  return S;
}
export const copy = S => structuredClone(S);

/* ---------- one step ---------- */
export function step(S, T) {
  if (S.over) return;
  S.t += DT; S.tick++;
  for (const i of S.order) drive(S, T, S.karts[i]);
  flyShots(S, T);
  rank(S, T);
  if (S.karts.every(k => k.fin) || S.t > 600) { S.over = true; S.ev.push({ type: 'over' }); }
}
export function runFor(S, T, secs) { const n = Math.round(secs / DT); for (let i = 0; i < n && !S.over; i++) step(S, T); }

function rank(S, T) {
  const main = T.main;
  for (const k of S.karts) if (!k.fin) k.dist = (k.lap - 1) * main.L + progressOf(T, k.path, k.s);
  S.order = S.karts.map(k => k.i).sort((a, b) => {
    const A = S.karts[a], B = S.karts[b];
    if (A.fin || B.fin) return A.fin && B.fin ? A.place - B.place : A.fin ? -1 : 1;
    return B.dist - A.dist || a - b;
  });
  S.order.forEach((i, r) => S.karts[i].rank = r + 1);
}
export const leader = S => S.karts[S.order[0]];

/* ---------- a kart ---------- */
function drive(S, T, k) {
  const R = RACERS[k.who];
  for (const f of ['spin', 'flat', 'stun', 'air', 'jump', 'boost', 'chrome', 'squash', 'shoved']) if (k[f] > 0) k[f] = Math.max(0, k[f] - DT);
  k.scrape = Math.max(0, k.scrape - DT);
  if (k.gone > 0) { k.gone -= DT; k.v = 0; if (k.gone <= 0) { k.gone = 0; S.ev.push({ type: 'spit', k: k.i }); } return; }
  if (k.lift > 0) { k.lift -= DT; k.v = 0; if (k.lift <= 0) { k.lift = 0; S.ev.push({ type: 'drop', k: k.i }); } return; }
  if (stopped(k)) { k.v = 0; return; }
  let p = T.paths[k.path];

  // how fast: top speed, eased off for the bends ahead (less so with grip), and whatever's happened to them
  let top = R.speed;
  if (k.fin) top *= .45;
  else {
    let bend = 0;
    for (const d of [0, 1.5, 3]) bend = Math.max(bend, Math.abs(bendAt(p, k.s + d)));
    top *= 1 - clamp((bend - .05) * 2.6 * (1 - R.grip), 0, .42);
    if (k.flat > 0) top *= .55;
    if (k.chrome > 0) top *= 1.22;
    if (k.boost > 0) top *= 1.6;
  }
  if (k.spin > 0) k.v = Math.max(1.2, k.v - 15 * DT);
  else if (k.air > 0) k.v = Math.min(k.v, 2.2);
  else if (k.v < top) k.v = Math.min(top, k.v + R.acc * (k.boost > 0 ? 5 : 1) * DT);
  else k.v = Math.max(top, k.v - 9 * DT);

  // which lane, then across toward it, unless someone's alongside in the way
  if (!k.fin && (S.tick + k.i) % 4 === 0 && k.spin <= 0 && !up(k)) decide(S, T, k);
  if (k.spin <= 0 && !up(k)) {
    const want = k.tx - k.x;
    if (Math.abs(want) > 1e-4) {
      const nx = k.x + Math.sign(want) * Math.min(Math.abs(want), R.lat * DT);
      if (!sideBlocked(S, k, p, nx)) k.x = nx;
    }
  }

  // forward, but not through whoever's ahead in the lane
  let ds = k.v * DT;
  if (!k.fin && !up(k)) {
    for (const j of S.karts) {
      if (j === k || j.path !== k.path || j.fin || out(j) || up(j) || Math.abs(j.x - k.x) >= WIDE) continue;
      const d = sd(p, k.s, j.s);
      if (d <= 0 || d > LEN + ds) continue;
      if (j.shoved > 0 && has(k.who, 'bully')) continue;      // just shoved aside: he barges on past
      if (has(k.who, 'bully') && R.weight > RACERS[j.who].weight && shove(S, T, k, j)) continue;
      ds = Math.max(0, d - LEN);
      k.v = Math.min(k.v, j.v + .3);
    }
  }
  const s0 = k.s;
  k.s += ds;

  // onto a shortcut, off it, and over the line
  if (k.path === 0) {
    for (const b of T.paths.slice(1)) {
      if (k.fork !== b.id || S.gates[b.gate] === false || Math.abs(k.x - b.outerFrom) > .4 || !crossed(p, s0, k.s, b.from)) continue;
      k.path = b.id; k.s = ahead(p, b.from, ((k.s % p.L) + p.L) % p.L); k.x -= b.outerFrom; k.tx = snapLane(b, k.s, k.x); k.fork = 0;
      S.ev.push({ type: 'fork', k: k.i, path: b.id });
      p = b;
      break;
    }
  } else if (k.s >= p.L) {
    const b = p;
    k.path = 0; k.s = b.to + (k.s - b.L); k.x += b.outerTo; p = T.main; k.tx = snapLane(p, k.s, k.x);
  }
  if (k.path === 0) {
    for (const f of S.fx) if (f.armed && f.path === 0 && crossed(p, s0, k.s, f.s0) && !k.fin) trigger(S, T, f, k);
    if (k.s >= p.L) { k.s -= p.L; k.lap++; overTheLine(S, k); }
  } else for (const f of S.fx) if (f.armed && f.path === k.path && s0 < f.s0 && k.s >= f.s0 && !k.fin) trigger(S, T, f, k);
  if (out(k)) return;

  // the road's edges: scraping along one slows you
  const [lo, hi] = edgesAt(p, k.s), x0 = k.x;
  k.x = clamp(k.x, lo + .3, hi - .3);
  if (Math.abs(k.x - x0) > .015) { k.v *= .985; k.scrape = .15; }
  if (k.tx < lo + .3 || k.tx > hi - .3) k.tx = snapLane(p, k.s + 1, k.x);
  if (k.fin) return;

  // driving over things
  k.hits = k.hits.filter(h => S.t - h[1] < 1.2);
  for (const o of S.objs) {
    if (o.off > S.t || o.path !== k.path || o.dead) continue;
    const d = sd(p, k.s, o.s);
    if (d > .6 || d < -.6 || Math.abs(o.x - k.x) > WIDE + .02) continue;
    if (k.hits.some(h => h[0] === o.id)) continue;
    if (up(k)) continue;
    k.hits.push([o.id, S.t]);
    hit(S, T, k, o);
    if (stopped(k) || out(k) || up(k)) break;
  }
  S.objs = S.objs.filter(o => !o.dead);
  useItem(S, T, k);
}

// Whether a step sideways to nx would run into a kart alongside.
function sideBlocked(S, k, p, nx) {
  for (const j of S.karts) {
    if (j === k || j.path !== k.path || j.fin || out(j) || up(j)) continue;
    if (Math.abs(sd(p, k.s, j.s)) >= LEN) continue;
    const dn = Math.abs(nx - j.x);
    if (dn < WIDE && dn < Math.abs(k.x - j.x)) return true;
  }
  return false;
}

// A bully's shove: the lighter kart is knocked into the next lane over and loses speed. Not if there's nowhere to go.
function shove(S, T, k, j) {
  if (stopped(j) || j.spin > 0) return false;
  const p = T.paths[j.path], lanes = lanesAt(p, j.s), at = snapLane(p, j.s, j.x);
  const side = j.x > k.x + .05 ? 1 : j.x < k.x - .05 ? -1 : 0;
  const opts = lanes.filter(o => Math.abs(o - at) > .5 && Math.abs(o - at) < 1.5).sort((a, b) => side ? (b - a) * side : Math.abs(a) - Math.abs(b));
  const to = opts[0];
  if (to == null) return false;
  j.tx = to; j.x += Math.sign(to - j.x) * .45; j.v *= .7; j.shoved = .6;
  S.ev.push({ type: 'shove', k: k.i, j: j.i });
  return true;
}

function overTheLine(S, k) {
  if (k.lap > S.laps) {
    k.fin = true; k.place = ++S.finished; k.finT = S.t - k.s / Math.max(k.v, .5);
    S.ev.push({ type: 'finish', k: k.i, place: k.place });
    return;
  }
  if (k.lap > S.lapShown) {
    S.lapShown = k.lap;
    for (const [kind, n] of Object.entries(S.plan[k.lap - 1] || {})) S.stock[kind] = (S.stock[kind] || 0) + n;
    S.ev.push({ type: 'lap', lap: k.lap, k: k.i });
  }
}

/* ---------- choosing a lane ---------- */
function decide(S, T, k) {
  const R = RACERS[k.who], p = T.paths[k.path], main = T.main;
  const cautious = has(k.who, 'cautious'), sight = R.sight;
  // a shortcut coming up: do they want it?
  let fork = null;
  if (k.path === 0) for (const b of T.paths.slice(1)) {
    const d = ahead(main, ((k.s % main.L) + main.L) % main.L, b.from);
    if (d > 0 && d < sight + 8) fork = { b, want: wantsShortcut(S, k, b) };
  }
  k.fork = fork?.want ? fork.b.id : 0;
  const lanes = lanesAt(p, k.s + 1.5), cur = snapLane(p, k.s + 1.5, k.tx);
  let best = cur, bestC = Infinity, curC = Infinity;
  for (const o of lanes) {
    let c = Math.abs(o - k.tx) * 2.5 + Math.abs(o - k.x) * 1.5;
    // a lane that ends
    for (let d = 1; d <= sight + 2; d++) {
      if (!p.closed && k.s + d > p.L) break;
      const [lo, hi] = edgesAt(p, k.s + d);
      if (o < lo + .45 || o > hi - .45) { c += 200 * (1.5 - d / (sight + 2)); break; }
    }
    if (fork?.want) c += Math.abs(o - fork.b.outerFrom) * 30;
    // what's on the road in it
    for (const ob of S.objs) {
      if (ob.off > S.t || ob.path !== k.path || ob.dead || Math.abs(ob.x - o) > WIDE) continue;
      const d = sd(p, k.s, ob.s);
      if (d < -.3 || d > sight * (cautious ? 1 : 1)) continue;
      c += worth(S, k, ob.kind);
    }
    // karts: slower ones ahead, and ones alongside (which it can't move into yet)
    for (const j of S.karts) {
      if (j === k || j.path !== k.path || out(j) || j.fin || up(j) || Math.abs(j.x - o) > WIDE) continue;
      const d = sd(p, k.s, j.s);
      if (d > 0 && d < 5) { if (stopped(j) || j.spin > 0) c += 60; else if (j.v < k.v - .25) c += 10; }
      else if (Math.abs(d) < LEN && Math.abs(o - cur) > .1) c += 25;
    }
    if (Math.abs(o - cur) < .01) curC = c;
    if (c < bestC) { bestC = c; best = o; }
  }
  k.tx = bestC < curC - 3 ? best : cur;
}
// What a thing on the road is worth to this driver: a cost to avoid, or (below zero) a pull toward it.
function worth(S, k, kind) {
  if (HAZARD[kind] != null) {
    if (k.chrome > 0) return 0;
    if (has(k.who, 'reckless') && kind !== 'barrel' && kind !== 'rubble') return 0;
    if (kind === 'spikes' && has(k.who, 'prickly')) return 0;
    return HAZARD[kind] * (has(k.who, 'cautious') ? 1.3 : 1);
  }
  const l = LURE[kind];
  if (!l) return 0;
  const greedy = has(k.who, 'greedy');
  if (kind === 'crate' && k.item) return greedy ? -4 : 0;
  return -l[greedy ? 1 : 0];
}
function wantsShortcut(S, k, b) {
  if (S.gates[b.gate] === false || has(k.who, 'cautious')) return false;
  if (has(k.who, 'reckless')) return true;
  const sight = RACERS[k.who].sight;
  for (const o of S.objs) if (o.path === b.id && !(o.off > S.t) && !o.dead && HAZARD[o.kind] && o.s < sight && worth(S, k, o.kind) > 0) return false;
  return true;
}

/* ---------- running into things ---------- */
function hit(S, T, k, o) {
  const chrome = k.chrome > 0, e = { k: k.i, o: o.id, kind: o.kind, by: o.by };
  switch (o.kind) {
    case 'oil':
      if (!chrome) { spinOut(k, .95); S.ev.push({ type: 'spin', ...e }); }
      if (--o.hp <= 0) o.dead = true;
      break;
    case 'spikes':
      if (chrome) { o.dead = true; S.ev.push({ type: 'smash', ...e }); }
      else if (has(k.who, 'prickly')) S.ev.push({ type: 'prickly', ...e });
      else { k.flat = 2.6; o.dead = true; S.ev.push({ type: 'flat', ...e }); }
      break;
    case 'barrel': case 'rubble':
      o.dead = true;
      if (chrome) S.ev.push({ type: 'smash', ...e });
      else { k.stun = .75; k.v = 0; S.ev.push({ type: 'crash', ...e }); }
      break;
    case 'mine':
      o.dead = true;
      if (chrome) S.ev.push({ type: 'smash', ...e });
      else { blast(k); S.ev.push({ type: 'boom', ...e }); }
      break;
    case 'boost': k.boost = 1.25; S.ev.push({ type: 'boost', ...e }); break;
    case 'ramp': k.jump = k.jumpMax = clamp(5.5 / Math.max(k.v, 4), .35, .8); k.v *= 1.08; S.ev.push({ type: 'jump', ...e }); break;
    case 'crate':
      if (o.by === 'track') o.off = S.t + 4; else o.dead = true;
      if (!k.item) { k.item = crateItem(k.rank, S.n); S.ev.push({ type: 'item', item: k.item, ...e }); }
      else S.ev.push({ type: 'crate', ...e });
      break;
    case 'skull': o.dead = true; k.chrome = 4; S.ev.push({ type: 'chrome', ...e }); break;
  }
}
function spinOut(k, t) { k.spin = k.spinMax = t; }
function blast(k) { k.air = k.airMax = 1.1; k.v = Math.min(k.v, 2.2); k.spin = 0; k.jump = 0; }

/* ---------- the track's traps ---------- */
function trigger(S, T, f, k) {
  if (!((S.stock[f.kind] || 0) > 0)) { f.armed = false; return; }
  S.stock[f.kind]--; S.used++;
  f.armed = false; f.at = S.t; f.victim = k.i;
  const p = T.paths[f.path], hurt = j => j.chrome <= 0 && !out(j) && !j.fin;
  if (f.kind === 'worm') { if (hurt(k)) { k.gone = 2.4; k.v = 0; } }
  else if (f.kind === 'magnet') { if (hurt(k)) { k.lift = 2.2; k.v = 0; } }
  else if (f.kind === 'boulder') {
    for (const j of S.karts) if (j.path === f.path && Math.abs(sd(p, f.s0 + .3, j.s)) < 1.3 && hurt(j)) { j.squash = 1.6; j.v = 0; }
  } else if (f.kind === 'flare') {
    for (const j of S.karts) { const d = sd(p, f.s0, j.s); if (j.path === f.path && d > -.6 && d < f.len + .4 && hurt(j) && !up(j)) spinOut(j, 1.15); }
  }
  S.ev.push({ type: 'trap', kind: f.kind, id: f.id, k: k.i });
}

/* ---------- items the karts carry ---------- */
function useItem(S, T, k) {
  if (!k.item || k.spin > 0 || up(k) || stopped(k)) return;
  const p = T.paths[k.path], R = RACERS[k.who];
  const trig = has(k.who, 'trigger'), rival = rivalOf(k.who), rk = rival && S.karts.find(j => j.who === rival);
  // sweepers shoot traps out of their lane whenever they see one, last lap or not
  if (has(k.who, 'sweeper') && (k.item === 'rocket' || k.item === 'homing')) {
    for (const o of S.objs) {
      if (o.path !== k.path || o.off > S.t || o.dead || !TRAPS.has(o.kind) || o.kind === 'oil' || Math.abs(o.x - k.x) > .45) continue;
      const d = sd(p, k.s, o.s);
      if (d > 1 && d < R.sight) return fire(S, T, k, 'rocket');
    }
  }
  if (has(k.who, 'hoarder') && k.lap < S.laps) return;
  switch (k.item) {
    case 'nitro': {
      let bend = 0;
      for (let d = 0; d < 8; d += 2) bend = Math.max(bend, Math.abs(bendAt(p, k.s + d)));
      if (trig || (bend < .08 && !trapInLane(S, k, p, 9))) { k.boost = 1.6; use(S, k, 'nitro'); }
      break;
    }
    case 'oil': {
      const behind = S.karts.some(j => j !== k && j.path === k.path && !j.fin && !out(j) && (!rk || j === rk) && (() => { const d = sd(p, j.s, k.s); return d > 0 && d < (rk ? 6 : 5) && Math.abs(j.x - k.x) < .8; })());
      if (trig || behind) {
        const s = k.s - 1.15;
        S.objs.push({ id: S.nextId++, kind: 'oil', by: k.i, path: k.path, s: p.closed ? ((s % p.L) + p.L) % p.L : Math.max(0, s), x: snapLane(p, s, k.x), hp: 1, off: 0, ci: -1 });
        use(S, k, 'oil');
      }
      break;
    }
    case 'rocket': {
      let tgt = null;
      for (const j of S.karts) {
        if (j === k || j.path !== k.path || j.fin || out(j) || Math.abs(j.x - k.x) > .5) continue;
        const d = sd(p, k.s, j.s);
        if (d > .5 && d < 16 && (!tgt || d < sd(p, k.s, tgt.s))) tgt = j;
      }
      if ((tgt && (!rk || tgt === rk)) || (trig && !rk)) fire(S, T, k, 'rocket');
      break;
    }
    case 'homing': {
      let tgt = null;
      if (rk) { if (!rk.fin && rk.dist > k.dist && rk.dist - k.dist < 45) tgt = rk; }
      else {
        const j = S.karts[S.order[k.rank - 2]];
        if (j && !j.fin && (trig || j.dist - k.dist < 30)) tgt = j;
      }
      if (tgt) fire(S, T, k, 'homing', tgt);
      break;
    }
    case 'chrome':
      if (trig || k.lap >= S.laps || trapInLane(S, k, p, 6)) { k.chrome = 4; use(S, k, 'chrome'); }
      break;
    case 'vulture':
      if (k.rank > 1) {
        const tgt = leader(S);
        if (!tgt.fin) { S.shots.push({ id: S.nextId++, kind: 'vulture', by: k.i, target: tgt.i, t: 0, dur: 1.5, path: k.path, s: k.s, x: k.x }); use(S, k, 'vulture'); }
      }
      break;
  }
}
function trapInLane(S, k, p, range) {
  for (const o of S.objs) {
    if (o.path !== k.path || o.off > S.t || o.dead || !HAZARD[o.kind] || Math.abs(o.x - k.x) > .5) continue;
    const d = sd(p, k.s, o.s);
    if (d > 0 && d < range) return true;
  }
  return false;
}
function use(S, k, item) { S.ev.push({ type: 'use', k: k.i, item }); k.item = null; }
function fire(S, T, k, kind, tgt) {
  const p = T.paths[k.path];
  S.shots.push({ id: S.nextId++, kind, by: k.i, target: tgt ? tgt.i : -1, path: k.path, s: k.s + .55, x: snapLane(p, k.s, k.x), v: kind === 'homing' ? 20 : 26, life: kind === 'homing' ? 4 : 1.5, age: 0 });
  use(S, k, kind);
}

function flyShots(S, T) {
  for (const sh of S.shots) {
    sh.age = (sh.age || 0) + DT;
    if (sh.kind === 'vulture') {
      sh.t += DT;
      if (sh.t >= sh.dur) {
        sh.dead = true;
        const j = S.karts[sh.target];
        if (j.fin || out(j)) S.ev.push({ type: 'miss', shot: sh.id });
        else if (j.chrome > 0) S.ev.push({ type: 'clang', k: j.i, shot: sh.id });
        else { blast(j); S.ev.push({ type: 'bomb', k: j.i, shot: sh.id }); }
      }
      continue;
    }
    sh.life -= DT;
    if (sh.life <= 0) { sh.dead = true; S.ev.push({ type: 'fizzle', shot: sh.id }); continue; }
    let p = T.paths[sh.path];
    const tgt = sh.target >= 0 ? S.karts[sh.target] : null;
    // a homing rocket closes on its target, and if it's overshot, it hangs back and lets the target run into it
    if (sh.kind === 'homing' && tgt && !tgt.fin && tgt.path === sh.path) { const d = sd(p, sh.s, tgt.s); sh.v = clamp(tgt.v + d * 3 + (d > 0 ? 5 : -2), .5, 22); }
    const s0 = sh.s, ds = sh.v * DT;
    sh.s += ds;
    if (tgt && !tgt.fin && tgt.path === sh.path) sh.x += clamp(tgt.x - sh.x, -5 * DT, 5 * DT);
    if (sh.path === 0) {
      if (tgt && tgt.path !== 0) {
        const b = T.paths[tgt.path];
        if (crossed(p, s0, sh.s, b.from)) { sh.path = b.id; sh.s = ahead(p, b.from, ((sh.s % p.L) + p.L) % p.L); sh.x = 0; p = b; }
      }
      if (sh.path === 0 && sh.s >= p.L) sh.s -= p.L;
    } else if (sh.s >= p.L) { const b = p; sh.path = 0; sh.s = b.to + (sh.s - b.L); sh.x += b.outerTo; p = T.main; }
    // the first thing in its way
    let what = null, wd = Infinity;
    for (const o of S.objs) {
      if (o.path !== sh.path || o.off > S.t || o.dead || !SHOOTABLE.has(o.kind) || Math.abs(o.x - sh.x) > .5) continue;
      const d = sd(p, sh.s - ds, o.s);
      if (d > -.3 && d < ds + .3 && d < wd) { wd = d; what = o; }
    }
    for (const j of S.karts) {
      if ((j.i === sh.by && sh.age < .4) || j.path !== sh.path || j.fin || out(j) || up(j) || Math.abs(j.x - sh.x) > .55) continue;
      if (sh.kind === 'homing' && j !== tgt) continue;
      const d = sd(p, sh.s - ds, j.s);
      if (d > -.5 && d < ds + .5 && d < wd) { wd = d; what = j; }
    }
    if (!what) continue;
    sh.dead = true;
    if (what.who) {
      if (what.chrome > 0) S.ev.push({ type: 'clang', k: what.i, shot: sh.id });
      else { blast(what); S.ev.push({ type: 'blast', k: what.i, shot: sh.id, by: sh.by }); }
    } else {
      what.dead = true;
      if (what.by === 'track') { what.dead = false; what.off = S.t + 4; }
      S.ev.push({ type: what.kind === 'mine' ? 'boom' : 'pop', o: what.id, kind: what.kind, shot: sh.id, path: what.path, s: what.s, x: what.x });
    }
  }
  S.shots = S.shots.filter(s => !s.dead);
  S.objs = S.objs.filter(o => !o.dead);
}

/* ---------- what the player does ---------- */
// The square of road under a point on a path: its middle, and the lane nearest x. Null off the road.
export function cellAt(T, path, s, x) {
  const p = T.paths[path];
  if (!p.closed && (s < 0 || s > p.L)) return null;
  const i = Math.floor((p.closed ? ((s % p.L) + p.L) % p.L : s) / p.cellLen), cs = (i + .5) * p.cellLen;
  const lanes = lanesAt(p, cs);
  let lane = -1, bd = .75;
  lanes.forEach((o, l) => { const d = Math.abs(o - x); if (d < bd) { bd = d; lane = l; } });
  if (lane < 0) return null;
  return { path, i, s: cs, x: lanes[lane], lane };
}
// Why something can't go there, or '' if it can.
export function whyNot(S, T, kind, cell) {
  if (!cell) return 'off the road';
  if (!((S.stock[kind] || 0) > 0)) return 'none left';
  const p = T.paths[cell.path];
  for (const ds of [-.6, 0, .6]) { const [lo, hi] = edgesAt(p, cell.s + ds); if (cell.x < lo + .45 || cell.x > hi - .45) return 'the lane narrows there'; }
  for (const o of S.objs) if (o.path === cell.path && Math.abs(sd(p, o.s, cell.s)) < p.cellLen * .6 && Math.abs(o.x - cell.x) < .5 && !(o.by === 'track' && o.off > S.t + 99)) return 'something’s already there';
  for (const k of S.karts) {
    if (k.fin) continue;
    const d = roadDistance(T, k.path, k.s, cell.path, cell.s), back = roadDistance(T, cell.path, cell.s, k.path, k.s);
    if (d < NEAR || back < 1.2) return 'too close in front of a kart';
  }
  return '';
}
export function place(S, T, kind, cell) {
  if (whyNot(S, T, kind, cell)) return null;
  const o = { id: S.nextId++, kind, by: 'you', path: cell.path, s: cell.s, x: cell.x, hp: kind === 'oil' ? 2 : 1, off: 0, ci: cell.i, t0: S.t };
  S.objs.push(o);
  S.stock[kind]--; S.used++;
  S.ev.push({ type: 'place', o: o.id, kind });
  return o;
}
// takes back something put down (the page only allows it until the race moves on)
export function unplace(S, id) {
  const o = S.objs.find(o => o.id === id && o.by === 'you');
  if (!o) return false;
  S.objs = S.objs.filter(q => q !== o);
  S.stock[o.kind] = (S.stock[o.kind] || 0) + 1; S.used--;
  return true;
}
export function arm(S, id, on = true) {
  const f = S.fx.find(f => f.id === id);
  if (!f) return false;
  if (on && !((S.stock[f.kind] || 0) > 0)) return false;
  f.armed = on;
  return true;
}
export function setGate(S, gate, open) { if (gate in S.gates) S.gates[gate] = open; }

// One step of a level's written solution (levels.js), done to the race as it stands.
export function doStep(S, T, st) {
  if (st.place) {
    const p = T.paths[st.path || 0], s = st.s * p.L, lanes = lanesAt(p, s);
    return place(S, T, st.place, cellAt(T, p.id, s, lanes[Math.min(st.lane ?? 0, lanes.length - 1)]));
  }
  if (st.arm) return arm(S, st.arm, st.on !== false);
  if (st.gate) { setGate(S, st.gate, !!st.open); return true; }
  return null;
}
// Runs a level to the end with a list of steps; onLap(S, lap) and onStep(S) are told as it goes.
export function playThrough(T, level, steps = [], hooks = {}) {
  const S = newRace(T, level), timed = steps.filter(st => st.t != null).sort((a, b) => a.t - b.t);
  const fails = [];
  const apply = st => { if (!doStep(S, T, st)) fails.push(st); };
  for (const st of steps) if (st.t == null && (st.lap ?? 1) === 1) apply(st);
  hooks.onLap?.(S, 1);
  let ti = 0;
  while (!S.over) {
    while (ti < timed.length && S.t >= timed[ti].t - 1e-9) apply(timed[ti++]);
    step(S, T);
    for (const e of S.ev) if (e.type === 'lap') { for (const st of steps) if (st.t == null && st.lap === e.lap) apply(st); hooks.onLap?.(S, e.lap); }
    hooks.onStep?.(S);
    S.ev.length = 0;
  }
  S.fails = fails;
  return S;
}

/* ---------- how it's going ---------- */
// Each goal, and whether the standings meet it right now (at the end, whether they did).
export function goalState(S, level) {
  const kOf = who => S.karts.find(k => k.who === who);
  return level.goal.map(g => {
    const k = kOf(g.who), r = k.fin ? k.place : k.rank;
    let ok;
    if (g.place) ok = r === (g.place < 0 ? S.n + 1 + g.place : g.place);
    else if (g.top) ok = r <= g.top;
    else if (g.bottom) ok = r > S.n - g.bottom;
    else if (g.ahead) { const o = kOf(g.ahead); ok = r < (o.fin ? o.place : o.rank); }
    else if (g.behind) { const o = kOf(g.behind); ok = r > (o.fin ? o.place : o.rank); }
    return ok;
  });
}
export const won = (S, level) => goalState(S, level).every(Boolean);
