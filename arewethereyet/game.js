// Are We There Yet: the rules, with no DOM, so sim.mjs can drive whole trips headlessly.
import { FAMILY, FIGHTS, TAPE_ORDER, TOWNS, GAS_NAMES, DINER_NAMES, MOTELS, ATTRACTIONS, EVENTS, FIX_NAMES } from './data.js';

export const SEATS = ['drive', 'shot', 'benchL', 'benchM', 'benchR', 'wayback'];
export const SEAT_NAMES = { drive: 'driver\'s seat', shot: 'shotgun', benchL: 'back seat', benchM: 'middle of the back seat', benchR: 'back seat', wayback: 'way-back' };
export const ADJ = { drive: ['shot'], shot: ['drive'], benchL: ['benchM'], benchM: ['benchL', 'benchR'], benchR: ['benchM'], wayback: [] };
export const COLS = 13; // 0 home … 12 Grandma's
export const MOTEL_COLS = [3, 6, 9];
export const SUMMIT_COL = 7;

export const TUNE = {
  legSeconds: 27, legHours: 3,
  line: 0.65,
  hunger: 0.0115, bladder: 0.0105, boreInter: 0.019, boreScenic: 0.007, boreWayback: 0.008,
  boreLiked: -0.04, boreHated: 0.017,
  drainNeed: 0.26, drainHangry: 0.55, drainAreWe: 0.5, drainFight: 1.6, drainCap: 1.5,
  tired: 0.0105,
  gasInter: 0.24, gasScenic: 0.19, gasPrice: 22,
  wearInter: 5, wearScenic: 7,
  snackPack: 6, snackPrice: 5, tuneUp: 35, tuneUpAmt: 30,
  dinerEach: 4, tow: 90,
  startCash: 260, startSnacks: 6, startMorale: 72, startCar: 80,
};

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------------------------------------------------------------- map
function genMap(r) {
  const towns = shuffle(TOWNS.slice(), r), gas = shuffle(GAS_NAMES.slice(), r), diners = shuffle(DINER_NAMES.slice(), r);
  const motels = shuffle(MOTELS.slice(), r), sights = shuffle(ATTRACTIONS.slice(), r);
  let ti = 0, gi = 0, di = 0, mi = 0, si = 0;
  const nodes = [], cols = [];
  for (let c = 0; c < COLS; c++) {
    let n = c === 0 || c === SUMMIT_COL || c === COLS - 1 ? 1 : MOTEL_COLS.includes(c) ? 2 : r() < 0.55 ? 3 : 2;
    let types;
    if (c === 0) types = ['home'];
    else if (c === COLS - 1) types = ['grandma'];
    else if (c === SUMMIT_COL) types = ['summit'];
    else if (MOTEL_COLS.includes(c)) types = ['motel', 'motel'];
    else {
      types = shuffle(['gas', 'diner', 'attraction', 'event'], r).slice(0, n);
      if (!types.includes('gas') && r() < 0.7) types[Math.floor(r() * n)] = 'gas';
    }
    const col = [];
    for (let i = 0; i < n; i++) {
      const t = types[i];
      const node = { id: nodes.length, col: c, i, n, type: t,
        x: 70 + c * (860 / (COLS - 1)) + (c && c < COLS - 1 ? (r() - 0.5) * 26 : 0),
        y: (n === 1 ? 300 : 90 + i * (420 / (n - 1))) + (n > 1 ? (r() - 0.5) * 50 : (c === SUMMIT_COL ? -30 : 0)),
        town: c === 0 ? 'Valley Oaks' : c === COLS - 1 ? 'Pickett’s Corner' : c === SUMMIT_COL ? 'Sawtooth Pass' : towns[ti++ % towns.length] };
      if (t === 'gas') node.place = gas[gi++ % gas.length];
      if (t === 'diner') node.place = diners[di++ % diners.length];
      if (t === 'motel') { node.motel = motels[mi++ % motels.length]; node.place = node.motel.name; }
      if (t === 'attraction') { node.sight = sights[si++ % sights.length]; node.place = node.sight.name; }
      nodes.push(node); col.push(node.id);
    }
    cols.push(col);
  }
  const edges = [];
  const rank = nd => nd.n === 1 ? 0.5 : nd.i / (nd.n - 1);
  let route = 15 + Math.floor(r() * 20) * 5;
  for (let c = 0; c < COLS - 1; c++) {
    const A = cols[c].map(i => nodes[i]), B = cols[c + 1].map(i => nodes[i]);
    const has = new Set();
    const add = (a, b) => { const k = a.id + '-' + b.id; if (has.has(k)) return; has.add(k);
      const inter = r() < (Math.abs(rank(a) - rank(b)) < 0.1 ? 0.6 : 0.4);
      edges.push({ a: a.id, b: b.id, road: inter ? 'interstate' : 'scenic', num: inter ? [40, 70, 80, 15, 25][Math.floor(r() * 5)] : (route += 7 + Math.floor(r() * 30)) }); };
    for (const a of A) for (const b of B) if (Math.abs(rank(a) - rank(b)) <= 0.51) add(a, b);
    for (const a of A) { const b = B.slice().sort((p, q) => Math.abs(rank(p) - rank(a)) - Math.abs(rank(q) - rank(a)))[0]; add(a, b); }
    for (const b of B) { const a = A.slice().sort((p, q) => Math.abs(rank(p) - rank(b)) - Math.abs(rank(q) - rank(b)))[0]; add(a, b); }
  }
  // the summit is on the scenic road whatever happens
  for (const e of edges) if (nodes[e.b].col === SUMMIT_COL || nodes[e.a].col === SUMMIT_COL) { e.road = 'scenic'; e.num = 9; }
  return { nodes, cols, edges };
}

// ---------------------------------------------------------------- new game
export function newGame(seed = (Math.random() * 1e9) | 0) {
  const r = mulberry(seed);
  const people = {};
  for (const f of FAMILY) people[f.id] = { ...f, rates: { hunger: f.hunger, bladder: f.bladder, bore: f.bore, tired: f.tired }, seat: null, hunger: 0.15, bladder: 0, bore: 0.1, fatigue: 0 };
  const s = {
    seed, r, map: genMap(r), at: 0, day: 1, clock: 8, cash: TUNE.startCash, gas: 0.85, snacks: TUNE.startSnacks,
    morale: TUNE.startMorale, car: TUNE.startCar, tapes: TAPE_ORDER.slice(), tapeIdx: -1, get tapeId() { return this.tapeIdx < 0 ? null : this.tapes[this.tapeIdx]; },
    people, trail: [0], mode: 'stop', leg: null, bd: null, stop: null, polaroids: [], usedEvents: new Set(), flags: {}, lastRoad: null,
    toasts: [], cues: [], paused: false, smell: 0, fight: null, legsDriven: 0, over: null, stats: { snacks: 0, pullovers: 0, wrong: 0, accidents: 0, fights: 0, swerves: 0, breakdowns: 0, minMorale: 100 },
  };
  s.stop = { node: s.map.nodes[0], event: null, result: null, bought: {}, slept: false };
  return s;
}

// ---------------------------------------------------------------- helpers
export const seated = s => Object.values(s.people).filter(p => p.seat);
export const inSeat = (s, seat) => Object.values(s.people).find(p => p.seat === seat) || null;
export const driverOf = s => inSeat(s, 'drive');
export const node = s => s.map.nodes[s.at];
export function nextEdges(s) { return s.map.edges.filter(e => e.a === s.at); }
export function neighbours(s, p) { return (ADJ[p.seat] || []).map(seat => inSeat(s, seat)).filter(Boolean); }
const fightsWith = (a, b) => FIGHTS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
export const likes = (p, tape) => tape && p.likes === tape;
export const hates = (p, tape) => tape && p.hates === tape;
function toast(s, text, who = null, kind = 'info') { s.toasts.push({ text, who, kind }); }
function cue(s, name, x) { s.cues.push({ name, x }); }
export function addMorale(s, d) { s.morale = clamp(s.morale + d, 0, 100); s.stats.minMorale = Math.min(s.stats.minMorale, s.morale); }
const fmtClock = h => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };
export { fmtClock };

export function canDrive(p) { return p.drive > 0; }

// Returns null if the move is fine, otherwise a reason to show.
export function moveSeat(s, id, seat) {
  const p = s.people[id];
  if (!p || p.seat === seat) return null;
  const moving = s.mode === 'drive';
  if (seat === 'drive' && !canDrive(p)) return `${p.name} is ${p.age}. ${p.name} can’t drive.`;
  if (moving && (seat === 'drive' || p.seat === 'drive')) return 'Not while the car is moving!';
  const other = inSeat(s, seat);
  if (other) {
    if (p.seat === 'drive' && !canDrive(other)) return `${other.name} can’t drive.`;
    other.seat = p.seat;
  }
  p.seat = seat;
  cue(s, 'seat');
  return null;
}

export function allAboard(s) { return Object.values(s.people).every(p => p.seat); }

// ---------------------------------------------------------------- driving
export function canLeave(s) {
  if (!allAboard(s)) return 'Everybody in the car first.';
  if (!driverOf(s)) return 'Somebody has to drive.';
  if (s.stop && s.stop.node.type === 'motel' && !s.stop.slept) return 'Pick where you’re sleeping tonight.';
  if (s.stop && s.stop.event && !s.stop.result) return 'Deal with this first.';
  return null;
}

export function startLeg(s, edge) {
  const why = canLeave(s); if (why) return why;
  const r = s.r, nav = inSeat(s, 'shot');
  const wrongP = [0.55, 0.42, 0.22, 0.07][nav ? nav.map : 0];
  const toNode = s.map.nodes[edge.b];
  const boss = toNode.col === SUMMIT_COL;
  const bChance = s.car < 55 ? (55 - s.car) / 65 : 0;
  const short = !!s.flags.shortcut; s.flags.shortcut = false;
  s.leg = { edge, to: toNode, road: short ? 'dirt' : edge.road, dist: short ? 0.7 : 1, prog: 0, t: 0, pulled: 0,
    wrongAt: r() < wrongP ? 0.25 + r() * 0.45 : -1, wrongDone: false,
    breakAt: boss ? 0.55 : r() < bChance ? 0.25 + r() * 0.5 : -1, boss, outGas: false, swerveCd: 3, shake: 0 };
  s.mode = 'drive'; s.stop = null; s.fight = null;
  cue(s, 'start');
  return null;
}

export function pullOver(s) {
  if (s.mode !== 'drive' || s.leg.pulled > 0) return false;
  s.leg.pulled = 3.2; s.stats.pullovers++;
  for (const p of seated(s)) p.bladder = 0;
  s.clock += 0.25; addMorale(s, -1);
  cue(s, 'brake');
  return true;
}

export function giveSnack(s, id) {
  const p = s.people[id];
  if (s.snacks <= 0) { toast(s, 'The cooler’s empty.', id, 'bad'); cue(s, 'nope'); return false; }
  if (p.hunger < 0.3) { toast(s, `${p.name}: “I’m not hungry.”`, id); cue(s, 'nope'); return false; }
  s.snacks--; p.hunger = 0; p.bore = Math.max(0, p.bore - 0.2); s.stats.snacks++;
  cue(s, 'snack');
  return true;
}

export function cycleTape(s) {
  s.tapeIdx = s.tapeIdx + 1 >= s.tapes.length ? -1 : s.tapeIdx + 1;
  cue(s, 'tape');
}
export function setTape(s, id) { s.tapeIdx = id ? s.tapes.indexOf(id) : -1; }

export function boreRate(s, p) {
  if (p.seat === 'drive') return 0;
  const road = s.leg ? s.leg.road : 'interstate';
  let r = (road === 'interstate' ? TUNE.boreInter : TUNE.boreScenic) * p.rates.bore;
  if (p.seat === 'wayback') r += TUNE.boreWayback;
  if (s.flags.comics && (p.id === 'kevin' || p.id === 'jo' || p.id === 'tina')) r *= 0.8;
  if (s.flags.walkman && p.id === 'tina') r *= 0.5;
  if (s.smell > 0) r += 0.012;
  const t = s.tapeId;
  if (likes(p, t)) r = TUNE.boreLiked;
  else if (hates(p, t)) r += TUNE.boreHated;
  if (p.id === 'kevin' && neighbours(s, p).some(o => fightsWith('kevin', o.id))) r *= 1.35;
  return r;
}

// What's wrong with a person right now, worst first. Used for bubbles and morale drain.
export function complaints(s, p) {
  const L = TUNE.line, out = [];
  if (s.fight && s.fight.includes(p.id)) out.push('fight');
  if (p.bladder >= L) out.push(p.bladder >= 0.88 ? 'pee!' : 'pee');
  if (p.hunger >= L) out.push(p.hunger >= 1 ? 'hangry' : 'hungry');
  if (p.seat !== 'drive' && p.bore >= L && !(s.fight && s.fight.includes(p.id))) out.push(p.bore >= 1 ? 'arewe' : 'bored');
  if (p.seat === 'drive' && p.fatigue >= 0.7) out.push('sleepy');
  return out;
}

export function tick(s, dt) {
  if (s.paused || s.over) return;
  if (s.mode === 'drive') tickDrive(s, dt);
  else if (s.mode === 'breakdown') tickBreakdown(s, dt);
}

function tickDrive(s, dt) {
  const L = s.leg, r = s.r;
  L.t += dt;
  L.shake = Math.max(0, L.shake - dt);
  if (s.smell > 0) s.smell -= dt;
  const drv = driverOf(s);
  const ps = seated(s);
  if (L.pulled > 0) {
    L.pulled -= dt; s.clock += dt * 0.05;
    for (const p of ps) if (p !== drv) p.bore = Math.max(0, p.bore - dt * 0.02);
    return;
  }
  const speed = (drv ? drv.speed : 1) * (L.road === 'interstate' ? 1.1 : L.road === 'dirt' ? 0.8 : 0.85);
  const dp = dt * speed / TUNE.legSeconds;
  L.prog += dp;
  s.clock += dt * TUNE.legHours / TUNE.legSeconds;
  s.gas -= dp * (L.road === 'interstate' ? TUNE.gasInter : TUNE.gasScenic);
  if (s.gas <= 0 && !L.outGas) {
    L.outGas = true; s.gas = 0.12; s.clock += 1.5; addMorale(s, -10);
    const pay = Math.min(s.cash, 10); s.cash -= pay;
    toast(s, 'Out of gas! Dad hikes to a farmhouse with the gas can. (–1½ hours, $10)', 'dad', 'bad'); cue(s, 'bad');
    if (pay < 10) { s.over = 'stranded'; return; }
  }

  // needs
  for (const p of ps) {
    p.hunger = Math.min(1.05, p.hunger + dt * TUNE.hunger * p.rates.hunger);
    p.bladder += dt * TUNE.bladder * p.rates.bladder;
    p.bore = clamp(p.bore + dt * boreRate(s, p), 0, 1.02);
    if (p === drv) p.fatigue = Math.min(1.1, p.fatigue + dt * TUNE.tired * p.rates.tired);
    else p.fatigue = Math.max(0, p.fatigue - dt * 0.004);
    if (p.bladder >= 1) {
      p.bladder = 0; addMorale(s, -12); s.smell = 12; s.stats.accidents++;
      toast(s, `${p.name} had an accident. Windows down, everybody.`, p.id, 'bad'); cue(s, 'bad');
    }
  }

  // Kevin starts a fight if he's had enough and someone he picks on is right there
  const kev = s.people.kevin;
  if (s.fight) {
    const [a, b] = s.fight;
    const pa = s.people[a], pb = s.people[b];
    if (!neighbours(s, pa).includes(pb) || pa.bore < 0.5) { s.fight = null; cue(s, 'calm'); }
    else { pb.bore = Math.min(1, pb.bore + dt * 0.02); }
  } else if (kev.seat && kev.bore >= 1) {
    const victim = neighbours(s, kev).find(o => fightsWith('kevin', o.id));
    if (victim) { s.fight = ['kevin', victim.id]; s.stats.fights++; toast(s, `“MOM! Kevin’s touching me!”`, victim.id, 'bad'); cue(s, 'fight'); }
  }

  // morale drain
  let drain = 0;
  for (const p of ps) {
    for (const c of complaints(s, p)) {
      if (c === 'fight') drain += TUNE.drainFight / 2;
      else if (c === 'hangry') drain += TUNE.drainHangry;
      else if (c === 'arewe') drain += TUNE.drainAreWe;
      else if (c === 'bored') drain += TUNE.drainNeed * 0.6;
      else if (c === 'sleepy') drain += 0;
      else drain += TUNE.drainNeed;
    }
  }
  if (drain) addMorale(s, -Math.min(TUNE.drainCap, drain) * dt);

  // the driver nods off
  if (drv && drv.fatigue > 0.7) {
    L.swerveCd -= dt;
    if (L.swerveCd <= 0 && r() < dt * 0.3 * (drv.fatigue - 0.6)) {
      L.swerveCd = 4; L.shake = 0.8; addMorale(s, -5); s.car = Math.max(0, s.car - 3); drv.fatigue -= 0.05; s.stats.swerves++;
      toast(s, `${drv.name} drifts onto the rumble strip! Everyone screams.`, drv.id, 'bad'); cue(s, 'swerve');
    }
  }

  if (L.wrongAt >= 0 && !L.wrongDone && L.prog >= L.wrongAt) {
    L.wrongDone = true; L.dist += 0.25; addMorale(s, -4); s.stats.wrong++;
    const nav = inSeat(s, 'shot');
    toast(s, nav ? `${nav.name} missed the exit. Turning around…` : 'Nobody’s reading the map. Missed the exit.', nav && nav.id, 'bad'); cue(s, 'nope');
  }
  if (L.breakAt >= 0 && L.prog >= L.breakAt) { L.breakAt = -1; startBreakdown(s, L.boss); return; }
  if (s.morale <= 0) { s.over = 'morale'; cue(s, 'bad'); return; }
  if (L.prog >= L.dist) arrive(s);
}

// ---------------------------------------------------------------- breakdowns
export function fixRate(p, type) {
  if (p.id === 'jo') return 0;
  if (p.fix === type) return 0.18;
  return p.age >= 16 ? 0.07 : 0.05;
}

export function startBreakdown(s, boss) {
  const r = s.r;
  let types = shuffle(['belt', 'tire', 'battery', 'radiator', 'hose'], r);
  const n = boss ? 4 : r() < 0.5 ? 2 : 3;
  if (boss) types = ['radiator', ...types.filter(t => t !== 'radiator')];
  s.bd = { problems: types.slice(0, n).map(type => ({ type, work: 0, crew: [] })), t: 0, boss };
  s.mode = 'breakdown'; s.fight = null; s.stats.breakdowns++;
  toast(s, boss ? 'Halfway up the pass, the temperature needle hits H. Steam everywhere.' : 'BANG. Something under the hood gives up. Pull over!', 'dad', 'bad');
  cue(s, 'breakdown');
}

export function assignFix(s, id, pi) {
  if (s.mode !== 'breakdown') return;
  for (const pr of s.bd.problems) pr.crew = pr.crew.filter(x => x !== id);
  const pr = s.bd.problems[pi];
  if (pr && pr.work < 1) {
    if (pr.crew.length >= 2) pr.crew.shift();
    pr.crew.push(id);
  }
  cue(s, 'seat');
}

export function problemRate(s, pr) {
  let rate = pr.crew.reduce((a, id) => a + fixRate(s.people[id], pr.type), 0);
  if (pr.crew.includes('jo') && pr.crew.length > 1) rate *= 1.5;
  return rate;
}

function tickBreakdown(s, dt) {
  const B = s.bd;
  B.t += dt; s.clock += dt * 0.06;
  addMorale(s, -0.55 * dt);
  for (const p of seated(s)) { p.hunger = Math.min(1.05, p.hunger + dt * TUNE.hunger * p.rates.hunger * 0.5); }
  let done = true;
  for (const pr of B.problems) {
    if (pr.work >= 1) continue;
    const rate = problemRate(s, pr);
    if (B.boss && pr.type === 'radiator' && !pr.crew.length) pr.work = Math.max(0, pr.work - dt * 0.03);
    pr.work = Math.min(1, pr.work + rate * dt);
    if (pr.work >= 1) { pr.crew = []; cue(s, 'fixed'); toast(s, `Fixed the ${FIX_NAMES[pr.type]}!`, null, 'good'); }
    else done = false;
  }
  if (s.morale <= 0) { s.over = 'morale'; return; }
  if (done) endBreakdown(s, false);
}

export function tow(s) {
  if (s.mode !== 'breakdown' || s.cash < TUNE.tow) return false;
  s.cash -= TUNE.tow; s.clock += 2; addMorale(s, -3);
  endBreakdown(s, true);
  return true;
}

function endBreakdown(s, towed) {
  s.car = Math.max(s.car, towed ? 60 : Math.min(100, s.car + 25));
  s.bd = null; s.mode = 'drive';
  toast(s, towed ? 'A tow truck named Earl hauls you to a garage. Two hours and $90 later, back on the road.' : 'Hood down. Everybody back in the car!', null, 'good');
  cue(s, 'start');
}

// ---------------------------------------------------------------- stops
function arrive(s) {
  const L = s.leg, nd = L.to;
  s.at = nd.id; s.trail.push(nd.id); s.lastRoad = L.road; s.legsDriven++;
  s.car = Math.max(0, s.car - (L.road === 'interstate' ? TUNE.wearInter : L.road === 'dirt' ? 12 : TUNE.wearScenic) - s.r() * 2);
  s.mode = 'stop'; s.leg = null; s.fight = null; s.smell = 0;
  for (const p of seated(s)) { p.bladder = 0; p.bore = Math.max(0, p.bore - 0.3); if (p.seat !== 'drive') p.fatigue = Math.max(0, p.fatigue - 0.12); }
  cue(s, 'arrive');
  s.stop = { node: nd, event: null, result: null, bought: {}, slept: false, note: null };
  if (nd.type === 'grandma') { finish(s); return; }
  if (nd.type === 'motel' && s.clock > 21) {
    const d = Math.round((s.clock - 21) * 6);
    addMorale(s, -d);
    s.stop.note = `It’s ${fmtClock(s.clock)}. Everyone’s cranky and way past bedtime. (–${d} family)`;
  }
  const chance = nd.type === 'event' ? 1 : nd.type === 'motel' || nd.type === 'summit' ? 0 : 0.33;
  if (s.r() < chance) {
    const pool = EVENTS.filter(e => e.types.includes(nd.type) && !s.usedEvents.has(e.id) && (!e.when || e.when(s)));
    if (pool.length) { const e = pool[Math.floor(s.r() * pool.length)]; s.usedEvents.add(e.id); s.stop.event = e; }
  }
  if (s.morale <= 0) s.over = 'morale';
}

function helpers(s) {
  const r = s.r;
  return {
    cash: d => { s.cash = Math.max(0, s.cash + d); }, morale: d => addMorale(s, d), clock: d => { s.clock += d; },
    car: d => { s.car = clamp(s.car + d, 0, 100); }, snacks: d => { s.snacks = Math.max(0, s.snacks + d); }, gas: d => { s.gas = clamp(s.gas + d, 0, 1); },
    chance: p => r() < p, roll: () => r(), flag: f => { s.flags[f] = true; },
    bore: (id, d) => { const p = s.people[id]; p.bore = clamp(p.bore + d, 0, 1); }, boreAll: d => { for (const p of Object.values(s.people)) p.bore = clamp(p.bore + d, 0, 1); },
    hunger: (id, d) => { const p = s.people[id]; p.hunger = clamp(p.hunger + d, 0, 1); }, hungerAll: d => { for (const p of Object.values(s.people)) p.hunger = clamp(p.hunger + d, 0, 1); },
    tired: d => { const p = s.people.dad; p.fatigue = clamp(p.fatigue + d, 0, 1); },
    polaroid: (key, caption) => { s.polaroids.push({ key, caption, day: s.day, town: node(s).town }); cue(s, 'camera'); },
  };
}

export function choose(s, ci) {
  const st = s.stop; if (!st || !st.event || st.result) return;
  const c = st.event.choices[ci]; if (!c) return;
  const ok = c.need ? c.need(s) : true;
  if (ok !== true) return;
  st.result = c.go(s, helpers(s));
  st.choice = ci;
  cue(s, 'choose');
  if (s.morale <= 0) s.over = 'morale';
}

export function choiceOK(s, c) { const ok = c.need ? c.need(s) : true; return ok === true ? null : ok; }

// Services on offer at the current stop.
export function services(s) {
  const st = s.stop; if (!st) return [];
  const nd = st.node, T = TUNE, out = [], b = st.bought;
  const fillCost = Math.ceil((1 - s.gas) * T.gasPrice);
  const fill = () => ({ id: 'fill', label: 'Fill ’er up', sub: s.gas > 0.97 ? 'tank’s full' : `$${fillCost}`, cost: fillCost, off: s.gas > 0.97 || b.fill });
  if (nd.type === 'gas') {
    out.push(fill());
    out.push({ id: 'snacks', label: `Snacks ×${T.snackPack}`, sub: `$${T.snackPrice}`, cost: T.snackPrice, off: (b.snacks || 0) >= 2 });
    out.push({ id: 'tune', label: 'Tune-up', sub: `$${T.tuneUp} • car +${T.tuneUpAmt}`, cost: T.tuneUp, off: s.car >= 98 || b.tune });
  }
  if (nd.type === 'diner') {
    out.push({ id: 'eat', label: 'Sit down and eat', sub: `$${T.dinerEach * 5} • +1 hr`, cost: T.dinerEach * 5, off: b.eat });
    out.push({ id: 'coffee', label: 'Coffee for the grown-ups', sub: '$1 • less sleepy', cost: 1, off: b.coffee });
    out.push({ id: 'pie', label: 'Pie to go', sub: '$3 • 3 snacks', cost: 3, off: b.pie });
  }
  if (nd.type === 'attraction') {
    const sg = nd.sight;
    out.push({ id: 'see', label: 'Go see it!', sub: `$${sg.price * 2} • +1½ hr`, cost: sg.price * 2, off: b.see });
  }
  if (nd.type === 'motel') {
    const m = nd.motel;
    out.push({ id: 'room', label: `A room at the ${m.name}`, sub: `$${m.price}`, cost: m.price, off: st.slept, sleep: true });
    out.push({ id: 'carsleep', label: 'Sleep in the car', sub: 'free • nobody sleeps well', cost: 0, off: st.slept, sleep: true });
    out.push(fill());
    out.push({ id: 'snacks', label: 'Vending machine', sub: `$${T.snackPrice} • ${T.snackPack} snacks`, cost: T.snackPrice, off: (b.snacks || 0) >= 2 });
  }
  if (nd.type === 'summit') out.push({ id: 'snacks', label: 'Snack shack', sub: `$${T.snackPrice + 2} • ${T.snackPack} snacks`, cost: T.snackPrice + 2, off: (b.snacks || 0) >= 2 });
  if (nd.type === 'summit') out.push({ id: 'look', label: 'Scenic overlook', sub: 'free • +½ hr', cost: 0, off: b.look });
  for (const o of out) if (!o.off && o.cost > s.cash) { o.off = true; o.broke = true; }
  return out;
}

export function buy(s, id) {
  const sv = services(s).find(o => o.id === id); if (!sv || sv.off) return false;
  const st = s.stop, T = TUNE, ps = Object.values(s.people);
  s.cash -= sv.cost;
  switch (id) {
    case 'fill': s.gas = 1; s.clock += 0.25; st.bought.fill = true; cue(s, 'pump'); break;
    case 'snacks': s.snacks += T.snackPack; st.bought.snacks = (st.bought.snacks || 0) + 1; cue(s, 'snack'); break;
    case 'tune': s.car = Math.min(100, s.car + T.tuneUpAmt); s.clock += 0.5; st.bought.tune = true; cue(s, 'fixed'); break;
    case 'eat': for (const p of ps) p.hunger = 0; addMorale(s, 9); s.clock += 1; st.bought.eat = true; cue(s, 'choose'); break;
    case 'coffee': for (const p of ps) if (canDrive(p)) p.fatigue = Math.max(0, p.fatigue - 0.35); s.clock += 0.2; st.bought.coffee = true; cue(s, 'choose'); break;
    case 'pie': s.snacks += 3; st.bought.pie = true; cue(s, 'snack'); break;
    case 'see': {
      const sg = st.node.sight; addMorale(s, 10 + sg.price); for (const p of ps) p.bore = 0; s.clock += 1.5; st.bought.see = true;
      helpers(s).polaroid(sg.key, sg.caption); break;
    }
    case 'room': case 'carsleep': {
      const good = id === 'room', m = st.node.motel;
      addMorale(s, good ? m.mood : -12);
      for (const p of ps) { p.fatigue = good ? 0 : Math.min(p.fatigue, 0.35); p.hunger = 0.35; p.bladder = 0; p.bore = 0.15; }
      s.day++; s.clock = 8; st.slept = true; st.sleptHow = id; s.flags.walkman = false; cue(s, 'night'); break;
    }
    case 'look': addMorale(s, 6); s.clock += 0.5; st.bought.look = true; helpers(s).polaroid('summit', 'top of the pass!! 9,240 ft'); break;
  }
  return true;
}

// ---------------------------------------------------------------- the end
export function finish(s) {
  s.mode = 'end';
  const onTime = s.day < 4 || (s.day === 4 && s.clock <= 19);
  if (onTime) addMorale(s, 15);
  s.polaroids.push({ key: 'grandma', caption: onTime ? 'Grandma’s 80th!! made it for cake' : 'Grandma’s (cake was gone)', day: s.day, town: 'Pickett’s Corner' });
  const score = Math.round(s.morale * 2 + s.polaroids.length * 15 + s.cash / 2 + (onTime ? 50 : 0));
  s.result = { onTime, score, morale: Math.round(s.morale), cash: s.cash, photos: s.polaroids.length };
  cue(s, 'win');
}

export function rating(score) {
  if (score >= 330) return ['Best. Trip. Ever.', 'They’ll be talking about this one at Thanksgiving for twenty years.'];
  if (score >= 260) return ['A real family vacation', 'Sunburnt, sticky and happy. Grandma cried a little.'];
  if (score >= 185) return ['We made it', 'Nobody’s speaking to Kevin, but you made it.'];
  return ['Never again', 'Next year, Grandma can fly.'];
}
