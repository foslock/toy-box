// Ladder: the route solver. Finds every place on the heap you can stand, groups them into ledges you can walk
// along, and tries ladder placements from each one headlessly (the real game, climbing at a careful pace) to see
// which ledges lead to which. Used by check.mjs to prove the top can be reached, and by the autoplay bot.
import { Game, TICK, headroom } from './game.js';
import { groundAt, LADDER } from './physics.js';

const D2R = Math.PI / 180;

// Standing spots every dx metres, grouped into ledges (walkable without the ladder).
export function ledges(heap, dx = 0.3) {
  const W = heap.world, [bx0, bx1] = heap.bounds, spots = [];
  const x0 = Math.max(bx0 + 1, -30), x1 = Math.min(bx1 - 1, 50);
  for (let x = x0, i = 0; x <= x1; x += dx, i++) {
    let y0 = heap.top + 4;
    for (let guard = 0; guard < 40; guard++) {
      const g = groundAt(W, x, y0, -1);
      if (!g) break;
      if (headroom(W, x, g.y)) spots.push({ x, y: g.y, i, P: g.P });
      y0 = g.y - 0.25;
    }
  }
  // union neighbours you can walk between both ways
  const par = spots.map((_, k) => k), find = k => par[k] === k ? k : (par[k] = find(par[k]));
  const byCol = new Map(); spots.forEach((s, k) => { s.k = k; (byCol.get(s.i) || byCol.set(s.i, []).get(s.i)).push(s); });
  for (const s of spots) for (const t of byCol.get(s.i + 1) || []) if (Math.abs(t.y - s.y) <= 0.4) par[find(s.k)] = find(t.k);
  const groups = new Map();
  for (const s of spots) { const r = find(s.k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(s); }
  const list = [...groups.values()].map((sp, id) => {
    sp.sort((a, b) => a.x - b.x);
    const y = sp.reduce((m, s) => Math.max(m, s.y), -1);
    return { id, spots: sp, x0: sp[0].x, x1: sp.at(-1).x, y, ymin: Math.min(...sp.map(s => s.y)), name: sp[Math.floor(sp.length / 2)].P?.obj?.name || '?' };
  });
  list.forEach((L, id) => { L.id = id; for (const s of L.spots) s.L = L; });
  return { spots, list, at: (x, y) => nearest(list, x, y) };
}
function nearest(list, x, y) {
  let best = null, bd = 0.9;
  for (const L of list) for (const s of L.spots) { const d = Math.abs(s.x - x) * 0.6 + Math.abs(s.y - y); if (d < bd) { bd = d; best = L; } }
  return best;
}

// Put the painter at (x, y) and try the ladder at angle deg, climbing at speed (m/s). Returns where it ends.
export function tryLadder(heap, x, y, deg, speed = 1.0, opt = {}) {
  const g = opt.game || new Game(heap);
  g.reset(); g.p.x = x; g.p.y = y; g.p.face = Math.cos(deg * D2R) >= 0 ? 1 : -1; g.carryPose(true);
  g.aimStart(); g.aimA = deg * D2R; g.aimPose = g.place(g.aimA);
  const q = g.aimPose;
  if (g.aimEnd() !== 'planted') return { ok: false, why: 'nothing' };
  if (opt.precheck && !mightReach(g)) return { ok: false, why: 'noledge', pose: q };
  g.setClimb(0); g.mount();
  let stall = 0;
  for (let t = 0; t < 9; t += TICK) {
    if (g.mode === 'climb') { const s0 = g.rider.s; g.climbBy(speed * TICK); g.tick(); if (g.mode === 'climb' && g.rider.s - s0 < 1e-4) stall += TICK; else stall = 0; if (stall > 0.6) return { ok: false, why: 'stuck', pose: q }; }
    else g.tick();
    g.drain();
    if (g.mode === 'fall' || g.mode === 'down') return { ok: false, why: 'fell', pose: q };
    if (g.mode === 'stepoff' || g.mode === 'haul' || (g.mode === 'stand' && g.held === 'carry' && t > 0.5)) {
      for (let i = 0; i < 200 && g.mode !== 'stand'; i++) { g.tick(); g.drain(); }
      return { ok: true, x: g.p.x, y: g.p.y, pose: q, P: g.p.on };
    }
    if (g.mode === 'stand' && g.held === 'planted') return { ok: false, why: 'down', pose: q };
  }
  return { ok: false, why: 'time', pose: q };
}
// a quick look before simulating: is there anywhere along this ladder you could step off?
function mightReach(g) {
  const save = g.rider; g.mode = 'climb';
  let found = false;
  for (let s = 0.8; s <= LADDER.L - 0.55 && !found; s += 0.3) { g.rider = { s, side: 1 }; if (g.ledge()) found = true; }
  g.mode = 'stand'; g.rider = save;
  return found;
}

// Every ledge's ways up: for each, the placements that work and where they lead.
export function solve(heap, opt = {}) {
  const LD = ledges(heap), game = new Game(heap), step = opt.step || 2, every = opt.every || 2;
  const edges = [];
  for (const L of LD.list) {
    const out = new Map();
    L.spots.forEach((s, si) => {
      if (si % every && si !== L.spots.length - 1) return;
      for (let deg = 12; deg <= 168; deg += step) {
        const r = tryLadder(heap, s.x, s.y, deg, opt.speed || 1.0, { game, precheck: true });
        if (!r.ok) continue;
        const to = LD.at(r.x, r.y);
        if (!to || to === L) continue;
        const key = to.id;
        if (!out.has(key)) out.set(key, { from: L.id, to: to.id, tries: [] });
        out.get(key).tries.push({ x: s.x, y: s.y, deg, rest: Math.round(r.pose.a * 180 / Math.PI) });
      }
    });
    for (const e of out.values()) edges.push(e);
  }
  // hop-downs: off either end of a ledge, onto whatever is below
  for (const L of LD.list) for (const [x, d] of [[L.x0, -1], [L.x1, 1]]) {
    const g = groundAt(heap.world, x + d * 0.45, L.spots[d < 0 ? 0 : L.spots.length - 1].y - 0.2, -1);
    if (!g) continue;
    const to = LD.at(x + d * 0.45, g.y);
    if (to && to !== L) edges.push({ from: L.id, to: to.id, hop: true, tries: [] });
  }
  return { ledges: LD, edges };
}

// Shortest number of placements from each ledge to the goal ledge(s).
export function distances(sol, goal) {
  const n = sol.ledges.list.length, dist = new Array(n).fill(Infinity), inn = Array.from({ length: n }, () => []);
  for (const e of sol.edges) inn[e.to].push(e);
  const q = [];
  for (const L of sol.ledges.list) if (goal(L)) { dist[L.id] = 0; q.push(L.id); }
  while (q.length) {
    const v = q.shift();
    for (const e of inn[v]) { const c = dist[v] + (e.hop ? 0.5 : 1); if (c < dist[e.from]) { dist[e.from] = c; q.push(e.from); } }
  }
  return dist;
}
