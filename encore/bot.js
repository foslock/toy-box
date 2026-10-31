// A two-beat lookahead player, for ?autoplay, ?demo and the headless sim.
import { W, H, DIRS } from './game.js';

const CHOICES = [null, 'up', 'down', 'left', 'right'];

function bfs(g, tx, ty) {
  const d = new Int16Array(W * H).fill(-1), q = [[tx, ty]]; d[ty * W + tx] = 0;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy;
      if (!g.walkable(nx, ny) || d[ny * W + nx] >= 0) continue;
      d[ny * W + nx] = d[y * W + x] + 1; q.push([nx, ny]);
    }
  }
  return d;
}

function target(g) {
  const p = g.player;
  const lost = g.items.find(i => i.kind === 'lost'); if (lost) return lost;
  const relic = g.items.find(i => i.kind === 'relic'); if (relic) return relic;
  const tape = g.items.find(i => i.kind === 'tape'); if (tape && p.gone.length) return tape;
  const alive = g.foes.filter(f => f.hp > 0);
  if (g.floor.boss || g.tutorial && alive.length) {
    let best = null, bd = 1e9;
    for (const f of alive) { const d = Math.abs(f.x - p.x) + Math.abs(f.y - p.y); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  return g.stairs.open ? g.stairs : null;
}

function value(g, tgt, dmap) {
  if (g.status === 'dead') return -1e7;
  if (g.status === 'won' || g.status === 'down' || g.status === 'tutdone') return 1e7;
  const p = g.player;
  let v = p.inst.length * 3000 + (p.halo ? 1200 : 0) + g.score;
  v -= g.foes.reduce((a, f) => a + (f.hp > 0 ? f.hp * 25 : 0), 0);
  if (tgt) {
    const d = dmap ? dmap[p.y * W + p.x] : Math.abs(tgt.x - p.x) + Math.abs(tgt.y - p.y);
    v -= (d < 0 ? 30 : d) * 14;
  }
  // stay out of blast lanes that are about to go off
  for (const f of g.foes) if (f.aim && g.lane(f).some(([x, y]) => x === p.x && y === p.y)) v -= 900;
  return v;
}

// sloppiness: chance per beat of a wrong-ish choice, for human-like sims
export function choose(g, o = {}) {
  const tgt = target(g);
  const dmap = tgt && !tgt.hp ? bfs(g, tgt.x, tgt.y) : null;
  let best = null, bv = -Infinity;
  const scored = [];
  for (const a of CHOICES) {
    const c = g.clone(); c.resolve(c.next, a);
    let v;
    if (c.status !== 'play') v = value(c, tgt, dmap);
    else {
      v = -Infinity;
      for (const b of CHOICES) { const c2 = c.clone(); c2.resolve(c2.next, b); v = Math.max(v, value(c2, tgt, dmap) - 40); }
    }
    if (a === null) v -= 6; // keep the groove going
    scored.push([a, v]);
    if (v > bv) { bv = v; best = a; }
  }
  if (o.slop && Math.random() < o.slop) return scored[Math.floor(Math.random() * scored.length)][0];
  return best;
}
