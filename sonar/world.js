// The lake under the ice: chambers and tunnels, 1000 m square, east = x, north = y.
export const SIZE = 1000, N = 384, CELL = SIZE / N;
export const HOME = { x: 500, y: 500 };
export const FALSE_HOME = { x: 932, y: 318 };

const C = {
  H: [500, 500, 58], a: [596, 566, 44], n1: [520, 690, 46], B: [648, 812, 62], n2: [384, 770, 42], C: [246, 872, 54],
  n3: [304, 606, 50], D: [124, 660, 52], n4: [336, 408, 44], E: [148, 296, 56], n5: [424, 250, 50], F: [290, 110, 64],
  n6: [622, 334, 46], n7: [796, 424, 54], n8: [768, 640, 46], n9: [662, 148, 44], G: [856, 156, 72], X: [932, 318, 40],
};
const LINKS = [
  ['H', 'a', 20], ['H', 'n1', 20], ['a', 'n8', 15], ['n1', 'B', 20], ['n1', 'n2', 17], ['n2', 'C', 18], ['n2', 'n3', 15], ['n3', 'D', 17],
  ['D', 'C', 14], ['n3', 'H', 19], ['n3', 'n4', 16], ['n4', 'H', 18], ['n4', 'E', 17], ['E', 'D', 15], ['n4', 'n5', 16], ['n5', 'F', 18],
  ['E', 'F', 15], ['n5', 'n6', 15], ['n6', 'H', 18], ['n6', 'n7', 17], ['n7', 'n8', 17], ['n8', 'B', 17], ['n7', 'G', 20], ['n7', 'X', 15],
  ['n6', 'n9', 15], ['n9', 'G', 17], ['n9', 'n5', 14],
];
// The faint dashed track the earlier craft left on the chart.
export const TRACKS = [['H', 'a'], ['H', 'n1', 'B'], ['H', 'n3', 'D'], ['n1', 'n2', 'C'], ['H', 'n4', 'n5', 'F'], ['n4', 'E'], ['H', 'n6']].map(l => l.map(k => C[k]));
export const VENTS = [{ x: 318, y: 596, r: 52 }, { x: 428, y: 244, r: 50 }, { x: 796, y: 430, r: 55 }, { x: 500, y: 706, r: 40 }];

// Where each photograph is. `rot` turns the thing in the photo; `near` is its solid radius.
export const MARKS = [
  { id: 'A', x: 614, y: 578, rot: 0.6, near: 3, name: 'Tide pole' },
  { id: 'B', x: 668, y: 830, rot: 2.2, near: 9, name: 'Ribs' },
  { id: 'C', x: 226, y: 892, rot: -0.79, near: 8, name: 'Steps' },
  { id: 'D', x: 100, y: 672, rot: 0.9, near: 6, name: 'No. 6' },
  { id: 'E', x: 130, y: 276, rot: 0.5, near: 4, name: 'Table' },
  { id: 'F', x: 272, y: 88, rot: 0.6, near: 2, name: 'Rows' },
  { id: 'G', x: 876, y: 136, rot: 0.2, near: 8, name: 'Shaft' },
];
export const markById = Object.fromEntries(MARKS.map(m => [m.id, m]));

const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y); let u = x - i, v = y - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  return (h2(i, j) * (1 - u) + h2(i + 1, j) * u) * (1 - v) + (h2(i, j + 1) * (1 - u) + h2(i + 1, j + 1) * u) * v;
}
function raw(x, y) {
  let d = -1e3;
  for (const k in C) { const c = C[k]; d = Math.max(d, c[2] - Math.hypot(x - c[0], y - c[1])); }
  for (const [p, q, w] of LINKS) {
    const A = C[p], B = C[q], bx = B[0] - A[0], by = B[1] - A[1];
    const t = Math.max(0, Math.min(1, ((x - A[0]) * bx + (y - A[1]) * by) / (bx * bx + by * by)));
    // tunnels wander a little
    const L = Math.hypot(bx, by), off = Math.sin(t * Math.PI) * (h2(A[0], B[1]) - 0.5) * 0.22 * L;
    const cx = A[0] + bx * t - by / L * off, cy = A[1] + by * t + bx / L * off;
    d = Math.max(d, w - Math.hypot(x - cx, y - cy) * 0.97);
  }
  return d + (noise(x / 26, y / 26) - 0.5) * 13 + (noise(x / 9 + 7, y / 9) - 0.5) * 5;
}
// Exact-ish distance field: open mask, then a two-pass chamfer transform both ways.
function build() {
  const open = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + .5) * CELL, y = (j + .5) * CELL;
    open[j * N + i] = i > 1 && j > 1 && i < N - 2 && j < N - 2 && raw(x, y) > 0 ? 1 : 0;
  }
  const dt = inside => {
    const f = new Float32Array(N * N);
    for (let i = 0; i < f.length; i++) f[i] = open[i] === inside ? 1e4 : 0;
    const a = 1, b = Math.SQRT2;
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; f[k] = Math.min(f[k], f[k - 1] + a, f[k - N] + a, f[k - N - 1] + b, f[k - N + 1] + b); }
    for (let j = N - 2; j > 0; j--) for (let i = N - 2; i > 0; i--) { const k = j * N + i; f[k] = Math.min(f[k], f[k + 1] + a, f[k + N] + a, f[k + N + 1] + b, f[k + N - 1] + b); }
    return f;
  };
  const pos = dt(1), neg = dt(0), out = new Float32Array(N * N);
  for (let i = 0; i < out.length; i++) out[i] = (open[i] ? pos[i] - .5 : .5 - neg[i]) * CELL;
  // one blur so the walls are smooth
  const b = new Float32Array(out);
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; b[k] = (out[k] * 4 + (out[k - 1] + out[k + 1] + out[k - N] + out[k + N]) * 2 + out[k - N - 1] + out[k - N + 1] + out[k + N - 1] + out[k + N + 1]) / 16; }
  return b;
}
export const FIELD = build();
export function sdf(x, y) { // metres to the nearest wall, positive in open water
  const u = x / CELL - .5, v = y / CELL - .5, i = Math.max(0, Math.min(N - 2, Math.floor(u))), j = Math.max(0, Math.min(N - 2, Math.floor(v)));
  const a = Math.max(0, Math.min(1, u - i)), b = Math.max(0, Math.min(1, v - j)), k = j * N + i;
  return (FIELD[k] * (1 - a) + FIELD[k + 1] * a) * (1 - b) + (FIELD[k + N] * (1 - a) + FIELD[k + N + 1] * a) * b;
}
export function grad(x, y) { const e = 2, gx = sdf(x + e, y) - sdf(x - e, y), gy = sdf(x, y + e) - sdf(x, y - e), l = Math.hypot(gx, gy) || 1; return [gx / l, gy / l]; }
export function castRay(x, y, ang, max) { // ang: radians clockwise from north
  const dx = Math.sin(ang), dy = Math.cos(ang); let t = 0;
  while (t < max) { const d = sdf(x + dx * t, y + dy * t); if (d < .5) return t; t += Math.max(1, d * .9); }
  return Infinity;
}
export function clear(x0, y0, x1, y1) { const d = Math.hypot(x1 - x0, y1 - y0); return castRay(x0, y0, Math.atan2(x1 - x0, y1 - y0), d) >= d; }

// Flow fields for anything that swims to a point (the thing, and the test bot).
const M = 125, MC = SIZE / M;
export function flow(tx, ty, margin = 5) {
  const dist = new Float32Array(M * M).fill(1e9), ok = new Uint8Array(M * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) ok[j * M + i] = sdf((i + .5) * MC, (j + .5) * MC) > margin ? 1 : 0;
  let ti = Math.floor(tx / MC), tj = Math.floor(ty / MC), best = 1e9, s = tj * M + ti;
  for (let j = Math.max(0, tj - 5); j < Math.min(M, tj + 6); j++) for (let i = Math.max(0, ti - 5); i < Math.min(M, ti + 6); i++) if (ok[j * M + i]) { const d = (i - ti) ** 2 + (j - tj) ** 2; if (d < best) { best = d; s = j * M + i; } }
  dist[s] = 0; const q = [s];
  for (let h = 0; h < q.length; h++) { // label-correcting; cheap enough on this size
    const k = q[h], i = k % M, j = (k / M) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= M || b >= M) continue;
      const n = b * M + a; if (!ok[n] || (di && dj && (!ok[j * M + a] || !ok[b * M + i]))) continue;
      const nd = dist[k] + (di && dj ? 1.414 : 1); if (nd < dist[n] - 1e-3) { dist[n] = nd; q.push(n); }
    }
  }
  return { tx, ty, dist, at: (x, y) => near(dist, x, y)[0] * MC, dir: (x, y) => { const n = near(dist, x, y); return n[1]; } };
}
function near(dist, x, y) {
  const ci = Math.floor(x / MC), cj = Math.floor(y / MC); let bd = 1e9, bx = 0, by = 0;
  for (let r = 1; r <= 3 && bd > 9e8; r++) for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
    if (i < 0 || j < 0 || i >= M || j >= M) continue; const d = dist[j * M + i]; if (d < bd) { bd = d; bx = (i + .5) * MC; by = (j + .5) * MC; }
  }
  const l = Math.hypot(bx - x, by - y) || 1; return [bd, [(bx - x) / l, (by - y) / l]];
}
export const EMPTY_SPOTS = Object.entries(C).filter(([k]) => k !== 'H' && k !== 'X' && k !== 'a').map(([, c]) => ({ x: c[0], y: c[1] }));
