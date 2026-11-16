// Offline solver and vault generator for Twenty-Seven Rooms.
//   node cube/solve.mjs check              solve every vault in vaults.js, print par and the route
//   node cube/solve.mjs gen <cfg> <n> [seed]  try n random vaults for a config, print the best as JSON
// The solver treats walking as free (inside a room every feature is reachable)
// and counts turns: a 0-1 BFS over (arrangement, which connected patch you're in,
// keys, locks, treasure).
import { newState, reach, CENTRE } from './game.js';
import { solve } from './solver.js';
export { solve };
import { VAULTS } from './vaults.js';

// ---------------------------------------------------------------- generator
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const CONFIGS = {
  two: { dials: ['H', 'H'], keys: 0, lo: 3, hi: 5, beetles: 3 },
  roll: { dials: ['H', 'X'], keys: 1, lo: 4, hi: 6, beetles: 4 },
  all: { dials: ['H', 'X', 'Y'], keys: 1, lo: 5, hi: 8, beetles: 5 },
  deep: { dials: ['H', 'X', 'Y', 'H'], keys: 2, lo: 6, hi: 9, beetles: 6 },
};

export function generate(cfg, R) {
  const rooms = [];
  const pick = (a) => a[(R() * a.length) | 0];
  for (let z = 0; z < 3; z++) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const doors = [0, 1, 2, 3].map(() => R() < (cfg.doorP || 0.55) ? 1 : 0);
    if (!doors.some(Boolean)) doors[(R() * 4) | 0] = 1;
    const v = R();
    const lp = cfg.ladderP || 0.25;
    rooms.push({ home: [x, y, z], doors, up: v < lp, down: v > 1 - lp, deco: (R() * 7) | 0 });
  }
  const c = rooms[CENTRE];
  c.treasure = true; c.up = c.down = false; c.deco = 0;
  c.doors = [0, 0, 0, 0]; c.doors[(R() * 4) | 0] = 1; if (R() < 0.4) c.doors[(R() * 4) | 0] = 1;
  const top = rooms.filter(r => r.home[2] === 2);
  const entry = pick(top);
  entry.entry = true; entry.up = true; entry.down = false; entry.deco = 0;
  const free = rooms.filter(r => !r.treasure);
  for (const t of cfg.dials) {
    let r; do { r = pick(free); } while (r.dial);
    if (t === cfg.dials[0] && !rooms.some(q => q.dial)) {
      // the first turnstone sits within reach of the entrance
      const st = newState({ rooms });
      const near = [...reach(st, st.entry)].map(id => rooms[id]).filter(q => !q.treasure);
      r = pick(near);
    }
    r.dial = t;
  }
  for (let i = 0; i < cfg.keys; i++) {
    let r; do { r = pick(free); } while (r.key || r.entry);
    r.key = true;
    // lock a door: first on the treasure room, then anywhere
    const target = i === 0 ? c : pick(free.filter(q => q.lock == null && !q.entry));
    const sides = [0, 1, 2, 3].filter(s => target.doors[s]);
    target.lock = pick(sides);
  }
  const quiet = rooms.filter(r => !r.entry && !r.treasure);
  for (let i = 0; i < cfg.beetles; i++) pick(quiet).beetles = Math.min(2, (pick(quiet).beetles || 0) + 1);
  return { rooms };
}

function cleanRoom(r) {
  const o = { home: r.home, doors: r.doors };
  for (const k of ['up', 'down', 'dial', 'key', 'treasure', 'entry']) if (r[k]) o[k] = r[k];
  if (r.lock != null && r.lock >= 0) o.lock = r.lock;
  if (r.beetles) o.beetles = r.beetles;
  if (r.deco) o.deco = r.deco;
  return o;
}

function rate(cfg, v) {
  const r = solve(v, 200000);
  const ladders = v.rooms.filter(q => q.up || q.down).length;
  if (!r.ok) return { score: r.rooms + (r.gotT ? 15 : 0) - (r.capped ? 50 : 0), r };
  const route = r.route;
  const dialsUsed = new Set(route.filter(m => m.dial != null).map(m => m.dial)).size;
  const axes = new Set(route.filter(m => m.axis).map(m => m.axis)).size;
  const unlock = route.some(m => m.unlock != null) ? 1 : 0;
  const over = Math.max(0, r.turns - cfg.hi);
  const score = 100 + Math.min(r.turns, cfg.hi) * 6 - over * 12 + dialsUsed * 5 + axes * 6 + unlock * (cfg.keys ? 6 : 0) - ladders * 0.4 + r.rooms * 0.3 + Math.log2(r.states) * 1.5;
  return { score, r, dialsUsed, axes };
}
function mutate(cfg, v, R) {
  const w = JSON.parse(JSON.stringify(v));
  const pick = (a) => a[(R() * a.length) | 0];
  const rooms = w.rooms;
  const plain = rooms.filter(q => !q.treasure);
  const kind = R();
  if (kind < 0.4) {
    const q = pick(rooms), s = (R() * 4) | 0;
    q.doors[s] ^= 1;
    if (!q.doors.some(Boolean)) q.doors[s] = 1;
    if (q.lock != null && !q.doors[q.lock]) q.doors[q.lock] = 1;
  } else if (kind < 0.7) {
    const q = pick(plain.filter(q => !q.entry));
    const t = (R() * 3) | 0; q.up = t === 1; q.down = t === 2;
  } else if (kind < 0.85) {
    const from = pick(rooms.filter(q => q.dial)); const to = pick(plain.filter(q => !q.dial));
    to.dial = from.dial; delete from.dial;
  } else if (kind < 0.93 && cfg.keys) {
    const from = pick(rooms.filter(q => q.key)); const to = pick(plain.filter(q => !q.key && !q.entry));
    if (from && to) { to.key = true; delete from.key; }
  } else {
    const top = rooms.filter(q => q.home[2] === 2);
    const old = top.find(q => q.entry), nu = pick(top);
    if (nu !== old && !nu.dial) { delete old.entry; old.up = false; nu.entry = true; nu.up = true; nu.down = false; }
  }
  return w;
}
export function climb(cfg, R, steps) {
  let cur = generate(cfg, R), cr = rate(cfg, cur);
  let best = cur, br = cr;
  for (let i = 0; i < steps; i++) {
    const nx = mutate(cfg, cur, R), nr = rate(cfg, nx);
    if (nr.score >= cr.score || R() < 0.03) { cur = nx; cr = nr; }
    if (cr.score > br.score) { best = cur; br = cr; }
  }
  return { vault: best, ...br };
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
if (cmd === 'check') {
  for (const v of VAULTS) {
    const t0 = Date.now();
    const r = solve(v);
    console.log(v.name, r.ok ? `par ${r.turns}` : 'UNSOLVABLE', `${r.states} states ${Date.now() - t0}ms`);
    if (r.ok) console.log('  ' + r.route.map(m => m.unlock != null ? `unlock@${m.unlock}` : `${m.axis}${m.k}${m.dir > 0 ? '+' : '-'}@${m.dial}`).join(' '));
  }
} else if (cmd === 'climb') {
  const cfg = CONFIGS[a1], n = +(a2 || 4);
  const R = rng(+(a3 || 1));
  let best = null;
  for (let i = 0; i < n; i++) {
    const c = climb(cfg, R, 2500);
    console.error(`run ${i}: score ${c.score.toFixed(1)} ok ${c.r.ok} turns ${c.r.turns} dials ${c.dialsUsed} axes ${c.axes} states ${c.r.states}`);
    if (c.r.ok && (!best || c.score > best.score)) best = c;
  }
  if (best) console.log(JSON.stringify({ turns: best.r.turns, route: best.r.route, vault: { rooms: best.vault.rooms.map(cleanRoom) } }));
} else if (cmd === 'gen') {
  const cfg = CONFIGS[a1], n = +(a2 || 200);
  const R = rng(+(a3 || 1));
  let best = null;
  for (let i = 0; i < n; i++) {
    const seedI = (R() * 1e9) | 0;
    const v = generate(cfg, rng(seedI));
    const r = solve(v, 400000);
    if (!r.ok || r.turns < cfg.lo || r.turns > cfg.hi) continue;
    const dialsUsed = new Set(r.route.filter(m => m.dial != null).map(m => m.dial)).size;
    const axes = new Set(r.route.filter(m => m.axis).map(m => m.axis)).size;
    const unlock = r.route.some(m => m.unlock != null) ? 1 : 0;
    const score = r.turns * 2 + dialsUsed * 3 + axes * 3 + unlock * 2 + Math.min(4, Math.log2(r.states));
    if (!best || score > best.score) {
      best = { score, seedI, turns: r.turns, dialsUsed, axes, route: r.route, states: r.states, vault: { rooms: v.rooms.map(cleanRoom) } };
      console.error(`#${i} seed ${seedI} turns ${r.turns} dials ${dialsUsed} axes ${axes} unlock ${unlock} states ${r.states} score ${score.toFixed(1)}`);
    }
  }
  console.log(JSON.stringify(best));
}
