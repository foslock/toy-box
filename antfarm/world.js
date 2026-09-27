// A new farm from a seed: layers of dirt two-thirds of the way up the glass, with pebbles, a boulder or two, roots
// from the plants on top, a few odd things somebody lost, and pockets of food. One pocket sits on a root with aphids
// on it (they make honeydew forever), and a sugar drip hangs from the lid.
import { W, H, SURFACE, AIR, TOPSOIL, LOAM, SAND, CLAY, GRAVEL, ROCK, THING, ROOT, SOURCES } from './rules.js';
import { THINGS, TWIG } from './art.js';

export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1440670441) | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
// Smooth 1D noise in [-1, 1].
function noise1(R) {
  const p = Array.from({ length: 64 }, () => R() * 2 - 1);
  return x => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f), a = p[(i % 64 + 64) % 64], b = p[((i + 1) % 64 + 64) % 64]; return a + (b - a) * s; };
}
// Smooth 2D value noise in [0, 1].
function noise2(seed) {
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

const N = W * H;
const at = (x, y) => y * W + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

export function generate(seed) {
  const R = mulberry32(seed ^ 0x2545f491);
  const rnd = (a, b) => a + R() * (b - a), irnd = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(R() * a.length)];
  const mat = new Uint8Array(N), aux = new Uint8Array(N), surf = new Int16Array(W);

  /* ---------- the ground and its layers ---------- */
  const sA = noise1(R), sB = noise1(R);
  for (let x = 0; x < W; x++) surf[x] = SURFACE + Math.round(sA(x / 40) * 2 + sB(x / 11) * 0.8);
  const middle = [[LOAM, 7, 12], [R() < .5 ? SAND : LOAM, 5, 8], [CLAY, 5, 9], [LOAM, 6, 10], [GRAVEL, 3, 5], [SAND, 6, 10]];
  if (R() < .5) [middle[2], middle[3]] = [middle[3], middle[2]];
  const plan = [[TOPSOIL, 5, 8], ...middle];
  const bounds = [];
  let depth = 0;
  for (const [m, a, b] of plan) { depth += rnd(a, b); bounds.push({ m, d: depth, wob: noise1(R), amp: rnd(1.2, 3) }); }
  const deepest = R() < .5 ? CLAY : LOAM;
  for (let x = 0; x < W; x++) for (let y = surf[x]; y < H; y++) {
    const d = y - surf[x];
    let m = deepest;
    for (const b of bounds) if (d < b.d + b.wob(x / 22) * b.amp) { m = b.m; break; }
    mat[at(x, y)] = m;
  }
  // lenses of one dirt inside another
  for (let k = irnd(4, 7); k > 0; k--) {
    const cx = rnd(10, W - 10), cy = rnd(SURFACE + 12, H - 6), rx = rnd(4, 11), ry = rnd(2, 4.5), m = pick([SAND, CLAY, GRAVEL, LOAM]);
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (!inside(x, y) || mat[at(x, y)] === AIR) continue;
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (hash2(x, y, seed) - .5) * .5;
      if (e < 1) mat[at(x, y)] = m;
    }
  }
  // shade: clumps at two scales plus grain, and the odd pebble speck
  const nA = noise2(seed * 7 + 1), nB = noise2(seed * 7 + 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (mat[i] === AIR) continue;
    const v = nA(x / 4.5, y / 4.5) * .5 + nB(x / 13, y / 13) * .5 + (hash2(x, y, seed + 3) - .5) * .35;
    let s = Math.max(0, Math.min(4, Math.floor(v * 5)));
    const g = hash2(x, y, seed + 9);
    if (g < .025) s = 0; else if (g > .975) s = 4;
    aux[i] = s;
  }

  /* ---------- things that can't be dug: rocks, lost things, roots ---------- */
  const blocked = new Uint8Array(N);       // keep-out map so nothing overlaps
  const claim = (x, y, r) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (inside(xx, yy)) blocked[at(xx, yy)] = 1; };
  const free = (x0, y0, w, h, pad) => {
    for (let y = y0 - pad; y < y0 + h + pad; y++) for (let x = x0 - pad; x < x0 + w + pad; x++) {
      if (!inside(x, y) || blocked[at(x, y)] || mat[at(x, y)] === AIR) return false;
    }
    return true;
  };
  const deepEnough = (x, y, d) => y >= surf[Math.max(0, Math.min(W - 1, x))] + d;

  // Rocks: a lumpy ellipse lit from the top left, with a dark rim.
  const rock = (cx, cy, rx, ry) => {
    const cells = [];
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!inside(x, y)) continue;
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, e = dx * dx + dy * dy + (hash2(x, y, seed + 17) - .5) * .35;
      if (e < 1) cells.push([x, y, dx, dy, e]);
    }
    const set = new Set(cells.map(([x, y]) => at(x, y)));
    for (const [x, y, dx, dy, e] of cells) {
      const i = at(x, y);
      const rim = !set.has(at(x - 1, y)) || !set.has(at(x + 1, y)) || !set.has(at(x, y - 1)) || !set.has(at(x, y + 1));
      const lit = -(dx * .62 + dy * .78) * .8 + (1 - e) * .5;
      mat[i] = ROCK;
      aux[i] = rim ? (lit > .35 ? 2 : 0) : lit > .62 ? 4 : lit > .25 ? 3 : lit > -.2 ? 2 : 1;
      blocked[i] = 1;
    }
    for (const [x, y] of cells) claim(x, y, 1);
  };
  const place = (w, h, minDepth, pad, tries = 80) => {
    for (let t = 0; t < tries; t++) {
      const x = irnd(2, W - w - 3), y = irnd(SURFACE + minDepth, H - h - 2);
      if (deepEnough(x, y, minDepth) && deepEnough(x + w, y, minDepth) && free(x, y, w, h, pad)) return [x, y];
    }
    return null;
  };
  for (let k = irnd(1, 2); k > 0; k--) {
    const rx = rnd(5, 8), ry = rx * rnd(.6, .8), p = place(Math.ceil(rx * 2), Math.ceil(ry * 2), 16, 3);
    if (p) rock(p[0] + rx, p[1] + ry, rx, ry);
  }
  for (let k = irnd(11, 17); k > 0; k--) {
    const rx = rnd(1.4, 3.8), ry = rx * rnd(.55, .9), p = place(Math.ceil(rx * 2), Math.ceil(ry * 2), 5, 2);
    if (p) rock(p[0] + rx, p[1] + ry, rx, ry);
  }
  const lost = [];
  const pool = [...THINGS].sort(() => R() - .5);
  for (const th of pool.slice(0, irnd(5, 7))) {
    const p = place(th.w, th.h, 7, 3);
    if (!p) continue;
    for (const [dx, dy, c] of th.cells) { const i = at(p[0] + dx, p[1] + dy); mat[i] = THING; aux[i] = c; }
    for (let y = p[1]; y < p[1] + th.h; y++) for (let x = p[0]; x < p[0] + th.w; x++) claim(x, y, 1);
    lost.push({ id: th.id, x: p[0], y: p[1], w: th.w, h: th.h });
  }
  for (let k = irnd(1, 3); k > 0; k--) {         // twigs
    const len = irnd(9, 17), ang = rnd(-.5, .5) + (R() < .5 ? 0 : Math.PI), dx = Math.cos(ang), dy = Math.sin(ang) * .6;
    const p = place(12, 8, 4, 1);
    if (!p) continue;
    const pts = [];
    for (let s = 0; s < len; s++) {
      const x = Math.round(p[0] + 6 + dx * (s - len / 2)), y = Math.round(p[1] + 4 + dy * (s - len / 2));
      if (inside(x, y) && mat[at(x, y)] !== AIR && !blocked[at(x, y)]) pts.push([x, y]);
    }
    for (const [x, y] of pts) { const i = at(x, y); mat[i] = THING; aux[i] = TWIG[(x + y) % 3 === 0 ? 0 : 1 + (x & 1)]; }
    for (const [x, y] of pts) claim(x, y, 1);
  }

  // Roots hang down from little plants on top, wandering as they go, with a branch or two.
  const roots = [];
  const growRoot = (x, y, len, drift, thick) => {
    const path = [];
    let fx = x;
    for (let s = 0; s < len; s++) {
      fx += drift + rnd(-.55, .55); drift *= .96;
      const cx = Math.round(fx), cy = y + s;
      if (!inside(cx, cy) || cy >= H - 2) break;
      if (blocked[at(cx, cy)] && mat[at(cx, cy)] !== ROOT) break;
      path.push([cx, cy]);
      if (thick && s < len * .4 && inside(cx + 1, cy) && !blocked[at(cx + 1, cy)]) path.push([cx + 1, cy]);
    }
    for (const [px, py] of path) { const i = at(px, py); mat[i] = ROOT; aux[i] = hash2(px, py, seed) < .3 ? 0 : hash2(px, py, seed + 1) < .5 ? 1 : 2; }
    return path;
  };
  const plants = [];
  for (let k = irnd(1, 3), tries = 0; k > 0 && tries < 40; tries++) {
    const x = irnd(14, W - 15);
    if (plants.some(p => Math.abs(p.x - x) < 26)) continue;
    const main = growRoot(x, surf[x], irnd(24, 44), rnd(-.3, .3), true);
    if (main.length < 12) continue;
    const branches = [];
    for (let b = irnd(1, 2); b > 0; b--) {
      const [bx, by] = main[irnd(Math.floor(main.length * .3), main.length - 4)];
      branches.push(growRoot(bx, by, irnd(8, 16), (R() < .5 ? -1 : 1) * rnd(.5, .9), false));
    }
    for (const [px, py] of main) claim(px, py, 1);
    for (const br of branches) for (const [px, py] of br) claim(px, py, 1);
    roots.push({ x, main, branches });
    plants.push({ x, kind: pick(['sprout', 'clover', 'grass']) });
    k--;
  }

  /* ---------- food ---------- */
  const sources = [];
  let nextId = 1;
  const cavity = (cx, cy, rx, ry, keep) => {
    const cells = [];
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (!inside(x, y)) continue;
      const i = at(x, y);
      if ((((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2) > 1 || (keep && keep(i))) continue;
      if (mat[i] === ROCK || mat[i] === THING || mat[i] === ROOT) continue;
      mat[i] = AIR; cells.push(i);
    }
    return cells;
  };
  // Pockets spread across the farm, each as far from the others as it can be.
  const kinds = ['seeds', 'beetle', 'berry', 'sugar', 'seeds', R() < .5 ? 'berry' : 'beetle'].sort(() => R() - .5);
  const spots = [];
  for (let k = 0; k < kinds.length; k++) {
    let best = null, bestScore = -1;
    for (let t = 0; t < 40; t++) {
      const x = irnd(12, W - 13), y = irnd(surf[x] + 9, H - 6);
      if (!free(x - 4, y - 2, 9, 5, 1)) continue;
      const near = Math.min(90, ...spots.map(s => Math.hypot(s.x - x, (s.y - y) * 1.5)));
      const score = near + R() * 6;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    if (!best) continue;
    spots.push(best);
    const def = SOURCES[kinds[k]], amount = irnd(def.amount[0], def.amount[1]);
    const cells = cavity(best.x, best.y, rnd(2.8, 3.8), rnd(1.8, 2.3));
    claim(best.x, best.y, 5);
    sources.push({ id: nextId++, kind: kinds[k], x: best.x, y: best.y, cells, stock: amount, total: amount, infinite: false });
  }
  // Aphids on a root, a good way down it.
  const r0 = roots[Math.floor(R() * roots.length)];
  if (r0) {
    const [ax, ay] = r0.main[Math.min(r0.main.length - 1, Math.floor(r0.main.length * rnd(.5, .75)))];
    const side = R() < .5 ? -1 : 1, cx = ax + side * 2.5, cy = ay;
    const cells = cavity(cx, cy, 3.2, 2.1);
    const def = SOURCES.aphids;
    sources.push({ id: nextId++, kind: 'aphids', x: Math.round(cx), y: cy, cells, stock: 3, cap: def.cap, period: def.period, timer: 0, infinite: true, root: [ax, ay] });
    claim(Math.round(cx), cy, 4);
  }
  // The sugar drip hangs from the lid, clear of the plants.
  let dripX = W >> 1;
  for (let t = 0; t < 30; t++) {
    const x = irnd(28, W - 29);
    if (plants.every(p => Math.abs(p.x - x) > 12)) { dripX = x; break; }
  }
  const dd = SOURCES.drip;
  sources.push({ id: nextId++, kind: 'drip', x: dripX, y: surf[dripX] - 1, cells: [], stock: 2, cap: dd.cap, period: dd.period, timer: 0, infinite: true, surface: true, known: true });

  // Make sure every pocket can be dug to from the top: flood through anything diggable and knock out whatever
  // hard stuff walls a pocket in.
  const reach = new Uint8Array(N), q = [];
  for (let x = 0; x < W; x++) { const i = at(x, surf[x] - 1 < 0 ? 0 : surf[x] - 1); reach[i] = 1; q.push(i); }
  const hard = m => m === ROCK || m === THING || m === ROOT;
  while (q.length) {
    const i = q.pop(), x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny)) continue;
      const j = at(nx, ny);
      if (!reach[j] && !hard(mat[j])) { reach[j] = 1; q.push(j); }
    }
  }
  for (const s of sources) if (s.cells.length && !s.cells.some(i => reach[i])) {
    for (let y = s.y - 6; y <= s.y + 6; y++) for (let x = s.x - 7; x <= s.x + 7; x++) if (inside(x, y) && hard(mat[at(x, y)])) { mat[at(x, y)] = LOAM; aux[at(x, y)] = 2; }
  }

  // Grass along the top, as decoration.
  const tufts = [];
  for (let x = 3; x < W - 3; x++) if (hash2(x, 0, seed + 31) < .09 && Math.abs(x - dripX) > 4) tufts.push({ x, h: 1 + Math.floor(hash2(x, 1, seed) * 3) });

  return { mat, aux, surf, sources, nextId, dripX, plants, tufts, lost, roots };
}
