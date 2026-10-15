// A bot that tries a fan of putts on a copy of the game and picks the one that
// ends nearest the cup by walking distance, without waking anyone. Used by
// ?demo, ?autoplay and the Node balance sim.
import { BALL_R } from './game.js';

const CELL = 5;

// Walking distance to the cup over a coarse grid, around the furniture.
export function distField(game) {
  const h = game.h;
  const W = Math.ceil(h.w / CELL), H = Math.ceil(h.h / CELL);
  const block = new Uint8Array(W * H);
  const pad = BALL_R + 1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL;
    let bad = x < pad || y < pad || x > h.w - pad || y > h.h - pad;
    for (const s of game.solids.segs) {
      if (bad) break;
      const ex = s.b[0] - s.a[0], ey = s.b[1] - s.a[1], L2 = ex * ex + ey * ey;
      const u = Math.max(0, Math.min(1, ((x - s.a[0]) * ex + (y - s.a[1]) * ey) / L2));
      if (Math.hypot(x - s.a[0] - ex * u, y - s.a[1] - ey * u) < pad + s.t / 2 - 1) bad = true;
    }
    for (const b of h.blocks || []) if (x > b.r[0] && x < b.r[0] + b.r[2] && y > b.r[1] && y < b.r[1] + b.r[3]) bad = true;
    for (const c of game.solids.circles) if (Math.hypot(x - c.x, y - c.y) < c.r + pad - 1) bad = true;
    if (h.stairs) { const r = h.stairs.r; if (x > r[0] - 4 && x < r[0] + r[2] && y > r[1] - 4 && y < r[1] + r[3] + 4) bad = true; }
    block[j * W + i] = bad ? 1 : 0;
  }
  const dist = new Float32Array(W * H).fill(1e9);
  const ci = Math.floor(h.cup.x / CELL), cj = Math.floor(h.cup.y / CELL);
  dist[cj * W + ci] = 0;
  // Dijkstra-ish with a simple bucket queue (8 neighbours)
  const q = [[ci, cj]];
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  for (let k = 0; k < q.length; k++) {
    const [i, j] = q[k];
    const d0 = dist[j * W + i];
    for (const [di, dj, w] of nb) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= W || b >= H || block[b * W + a]) continue;
      const nd = d0 + w * CELL;
      if (nd < dist[b * W + a] - 0.01) { dist[b * W + a] = nd; q.push([a, b]); }
    }
  }
  return (x, y) => {
    const i = Math.max(0, Math.min(W - 1, Math.floor(x / CELL))), j = Math.max(0, Math.min(H - 1, Math.floor(y / CELL)));
    const d = dist[j * W + i];
    if (d < 1e8) return d;
    // inside something: use the best neighbour
    let best = 1e9;
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
      const ii = i + a, jj = j + b;
      if (ii >= 0 && jj >= 0 && ii < W && jj < H) best = Math.min(best, dist[jj * W + ii] + Math.hypot(a, b) * CELL);
    }
    return best < 1e8 ? best : Math.hypot(x - game.h.cup.x, y - game.h.cup.y) * 3;
  };
}

// opts: angles, powers, care (how much it minds noise), noise (aim error, radians), rng
export function choose(game, field, opts = {}) {
  const nA = opts.angles || 120, powers = opts.powers || [0.12, 0.18, 0.24, 0.3, 0.36, 0.42, 0.5, 0.58, 0.66, 0.75, 0.85, 1];
  const care = opts.care ?? 1;
  const snap = game.snapshot();
  let best = null;
  for (let ai = 0; ai < nA; ai++) {
    const a = (ai / nA) * Math.PI * 2;
    for (const p of powers) {
      game.restore(snap);
      const end = game.simulate(a, p);
      let score;
      const maxM = Math.max(0, ...game.meters);
      if (end === 'caught') score = 1e6;
      else if (end === 'sunk') score = -1000 + maxM * care * 2;
      else score = field(game.ball.x, game.ball.y) + Math.max(0, maxM - 45) * care * 6 + game.fell * 400;
      if (!best || score < best.score) best = { a, p, score, end };
    }
  }
  game.restore(snap);
  return best;
}
