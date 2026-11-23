// The continent: one fixed world everybody learns. Pure data, no DOM (runs in Node too).

export function rng(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(...parts) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= 0x9e37; h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeNoise(seed) {
  const r = rng(seed);
  const p = new Uint8Array(512);
  const base = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [base[i], base[j]] = [base[j], base[i]]; }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const g = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function (x, y) {
    const X = Math.floor(x), Y = Math.floor(y);
    const xf = x - X, yf = y - Y, xi = X & 255, yi = Y & 255;
    const u = fade(xf), v = fade(yf);
    const aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1], ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
    const x1 = g(aa, xf, yf) + u * (g(ba, xf - 1, yf) - g(aa, xf, yf));
    const x2 = g(ab, xf, yf - 1) + u * (g(bb, xf - 1, yf - 1) - g(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 0.7;
  };
}
function fbm(n, x, y, oct = 5) {
  let s = 0, a = 1, f = 1, t = 0;
  for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); t += a; a *= 0.5; f *= 2.03; }
  return s / t;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const GW = 300, GH = 220, CELL = 4.4; // km per cell
export const KMW = GW * CELL, KMH = GH * CELL;

export const BIOMES = ['sea', 'alpine', 'tundra', 'taiga', 'forest', 'meadow', 'fog', 'steppe', 'desert', 'savanna', 'palms', 'scrub'];
export const BIOME_NAME = {
  sea: 'sea', alpine: 'high mountains', tundra: 'tundra', taiga: 'pine forest', forest: 'leafy woods', meadow: 'meadows',
  fog: 'foggy coast', steppe: 'dry steppe', desert: 'desert', savanna: 'savanna', palms: 'palm country', scrub: 'olive scrub',
};

// The four countries. Every rule here is a clue a player can learn.
export const COUNTRIES = [
  {
    id: 0, name: 'Norrow', at: [0.52, 0.15], script: 'rune', tint: '#9fb4c4',
    drive: 'right', centre: { color: 'yellow', style: 'solid' }, edge: 'white',
    roof: 'steep', roofColors: ['#3b3f45', '#2e3236', '#4a4643'], walls: ['#8c2f2a', '#a33b2c', '#d2a237', '#ede4d0'],
    pole: 'wood1', poleSide: 1, bollard: 'blackcap', plate: '#f3f0e6', sign: { bg: '#2f5f8f', fg: '#f4f0e4' },
  },
  {
    id: 1, name: 'Calimbe', at: [0.2, 0.47], script: 'loop', tint: '#a7c49a',
    drive: 'left', centre: { color: 'white', style: 'dashed' }, edge: null,
    roof: 'barrel', roofColors: ['#4f8f86', '#5e9b8c', '#3f7a72'], walls: ['#e8b9b0', '#cfe0c6', '#c9bedd', '#f0dcb4'],
    pole: 'concrete', poleSide: -1, bollard: 'stone', plate: '#f1c84b', sign: { bg: '#f4f0e4', fg: '#1d2a22', rim: '#3f7a52' },
  },
  {
    id: 2, name: 'Dastra', at: [0.76, 0.46], script: 'bar', tint: '#dcc08a',
    drive: 'right', centre: null, edge: 'yellow',
    roof: 'flat', roofColors: ['#cfc2a6', '#b9a88a'], walls: ['#f2ead8', '#e3cfa6', '#d6b48a', '#c98f6a'],
    pole: 'wood2', poleSide: -1, bollard: 'redwhite', plate: '#ffffff', sign: { bg: '#2f6b4a', fg: '#f4f0e4' },
  },
  {
    id: 3, name: 'Sulei', at: [0.5, 0.84], script: 'hook', tint: '#e5a98f',
    drive: 'left', centre: { color: 'white', style: 'double' }, edge: 'white',
    roof: 'hip', roofColors: ['#c4623b', '#b5532f', '#d07448'], walls: ['#f6f1e4', '#f0d98c', '#e9c9a4', '#f6f1e4'],
    pole: 'none', poleSide: 1, bollard: 'yellow', plate: '#7fb3d9', sign: { bg: '#f0c43a', fg: '#1f1a14' },
  },
];

export function buildWorld(seed = 11) {
  const nA = makeNoise(seed), nB = makeNoise(seed + 1), nC = makeNoise(seed + 2), nD = makeNoise(seed + 3), nE = makeNoise(seed + 4);
  const H = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const nx = x / GW, ny = y / GH;
    const wx = fbm(nC, nx * 2.2 + 5, ny * 2.2, 4) * 0.3, wy = fbm(nD, nx * 2.2, ny * 2.2 + 5, 4) * 0.3;
    const dx = (nx + wx - 0.5) / 0.41, dy = (ny + wy - 0.5) / 0.42;
    const r = Math.sqrt(dx * dx + dy * dy) + fbm(nA, nx * 3.1, ny * 3.1) * 0.5 + fbm(nB, nx * 9, ny * 9, 5) * 0.16;
    const base = 1 - r;
    // the spine: a mountain range running north to south, a little west of centre
    const rx = 0.415 + 0.03 * Math.sin(ny * 7 + 0.6) + 0.04 * fbm(nC, ny * 3, 2.5);
    const rd = (nx - rx) / (0.028 + 0.012 * smooth(0.3, 0.9, ny));
    const along = smooth(0.12, 0.3, ny) * (1 - smooth(0.78, 0.92, ny));
    const rn = 1 - Math.abs(fbm(nD, nx * 14, ny * 14, 4)) * 1.6;
    const ridge = Math.exp(-rd * rd) * along * (0.55 + 0.45 * rn);
    // northern fells
    const fell = smooth(0.32, 0.05, ny) * Math.max(0, fbm(nE, nx * 6, ny * 6)) * 1.6;
    const hills = Math.max(0, fbm(nB, nx * 7 + 3, ny * 7)) * 1500 + Math.max(0, fbm(nE, nx * 16, ny * 16 + 7, 3)) * 500;
    const landness = smooth(-0.02, 0.08, base);
    let h = base > 0 ? 30 + base * 520 + hills * landness : base * 2600;
    h += (ridge * 2900 * (0.75 + 0.5 * Math.max(0, fbm(nE, nx * 30, ny * 30, 3))) + fell * 1400) * landness;
    H[y * GW + x] = h;
  }
  const land = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && H[y * GW + x] > 0;

  // distance to the sea (cells), and whether the nearest sea lies to the west
  const dist = new Float32Array(GW * GH).fill(1e9);
  const q = [];
  for (let i = 0; i < GW * GH; i++) if (H[i] <= 0) { dist[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % GW, y = (i / GW) | 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= GW || Y >= GH) continue;
      const j = Y * GW + X; if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
    }
  }

  // rain: wet westerlies that drop their water climbing the spine
  const R = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) {
    let m = 1;
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x, h = H[i];
      if (h <= 0) { m = Math.min(1, m + 0.06); R[i] = m * 0.5; continue; }
      const prev = x > 0 ? Math.max(0, H[i - 1]) : 0;
      const rise = Math.max(0, h - prev);
      const p = m * (0.003 + rise * 0.0011);
      m = Math.max(0.03, m - p * 1.15);
      R[i] = Math.min(1, m * 0.9 + p * 6);
    }
  }
  // a weaker wind off the eastern sea
  for (let y = 0; y < GH; y++) {
    let m = 0.55;
    for (let x = GW - 1; x >= 0; x--) {
      const i = y * GW + x, h = H[i];
      if (h <= 0) { m = Math.min(0.55, m + 0.05); continue; }
      const prev = x < GW - 1 ? Math.max(0, H[i + 1]) : 0;
      const p = m * (0.012 + Math.max(0, h - prev) * 0.002);
      m = Math.max(0, m - p * 1.2);
      R[i] = Math.max(R[i], m * 0.95);
    }
  }
  // blur rain a little
  const R2 = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    let s = 0, c = 0;
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
      const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= GW || Y >= GH) continue;
      s += R[Y * GW + X]; c++;
    }
    R2[y * GW + x] = s / c;
  }
  // southern monsoon: the far south gets wetter again
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) R2[y * GW + x] = Math.min(1, R2[y * GW + x] + smooth(0.8, 1.0, y / GH) * 0.25 + smooth(0.43, 0.3, x / GW) * 0.22);

  const tempAtCell = (x, y, h) => 1.5 + 26 * (y / GH) - Math.max(0, h) / 1000 * 6.5;

  // biome per cell
  const B = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x, h = H[i];
    if (h <= 0) { B[i] = 0; continue; }
    const t = tempAtCell(x, y, h), r = R2[i];
    let b;
    if (h > 2350) b = 'alpine';
    else if (t < 4) b = 'tundra';
    else if (t < 8.5) b = r < 0.16 ? 'steppe' : 'taiga';
    else if (t < 17) b = r > 0.52 ? 'forest' : r > 0.3 ? 'meadow' : r > 0.17 ? 'steppe' : 'desert';
    else b = r > 0.6 ? 'palms' : r > 0.38 ? 'scrub' : r > 0.2 ? 'savanna' : 'desert';
    // fog: a cold current along the west coast
    if (t >= 8.5 && t < 19 && dist[i] <= 7 && x < GW * 0.4 && h < 700) b = 'fog';
    B[i] = BIOMES.indexOf(b);
  }

  // country: warped nearest-capital
  const caps = COUNTRIES.map((c) => {
    let bx = c.at[0] * GW, by = c.at[1] * GH, best = 1e9, px = bx, py = by;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (H[y * GW + x] > 60 && H[y * GW + x] < 1200) {
      const d = (x - bx) ** 2 + (y - by) ** 2; if (d < best) { best = d; px = x; py = y; }
    }
    return [px * CELL, py * CELL];
  });
  const warpN = makeNoise(seed + 9), warpM = makeNoise(seed + 10);
  function countryAt(kx, ky) {
    const wx = kx + 420 * fbm(warpN, kx / 520, ky / 520, 5), wy = ky + 420 * fbm(warpM, kx / 520, ky / 520, 5);
    let best = 1e18, id = 0;
    for (let c = 0; c < caps.length; c++) {
      const d = Math.hypot(wx - caps[c][0], (wy - caps[c][1]) * (c === 0 || c === 3 ? 1.25 : 1));
      if (d < best) { best = d; id = c; }
    }
    return id;
  }
  const C = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) C[y * GW + x] = countryAt((x + 0.5) * CELL, (y + 0.5) * CELL);

  function cellAt(kx, ky) {
    const x = Math.max(0, Math.min(GW - 1, Math.floor(kx / CELL))), y = Math.max(0, Math.min(GH - 1, Math.floor(ky / CELL)));
    return y * GW + x;
  }
  function heightAt(kx, ky) {
    const fx = kx / CELL - 0.5, fy = ky / CELL - 0.5;
    const x0 = Math.max(0, Math.min(GW - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(GH - 2, Math.floor(fy)));
    const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
    const a = H[y0 * GW + x0], b = H[y0 * GW + x0 + 1], c = H[(y0 + 1) * GW + x0], d = H[(y0 + 1) * GW + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  // towns: Poisson-ish, capitals first
  const tr = rng(seed + 77);
  const towns = [];
  caps.forEach(([x, y], c) => towns.push({ x, y, country: c, capital: true, size: 1 }));
  for (let tries = 0; tries < 9000 && towns.length < 72; tries++) {
    const x = 6 + tr() * (GW - 12), y = 6 + tr() * (GH - 12);
    const i = Math.floor(y) * GW + Math.floor(x);
    const h = H[i];
    if (h <= 12 || h > 1900) continue;
    const kx = x * CELL, ky = y * CELL;
    const b = BIOMES[B[i]];
    const minD = b === 'desert' || b === 'tundra' ? 95 : 62;
    if (towns.some((t) => Math.hypot(t.x - kx, t.y - ky) < minD)) continue;
    towns.push({ x: kx, y: ky, country: C[i], capital: false, size: tr() < 0.35 ? 0.7 : 0.45 });
  }
  towns.forEach((t, i) => { t.id = i; t.word = null; });

  // roads: join each town to its nearest neighbours with A*, reusing roads already built
  const roadCell = new Uint8Array(GW * GH);
  const roads = [];
  const edges = new Set();
  const pairs = [];
  for (const a of towns) {
    const near = towns.filter((b) => b !== a).map((b) => [b, Math.hypot(a.x - b.x, a.y - b.y)]).sort((p, q) => p[1] - q[1]).slice(0, 3);
    for (const [b, d] of near) {
      if (d > 230) continue;
      const k = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
      if (edges.has(k)) continue; edges.add(k); pairs.push([a, b, d]);
    }
  }
  pairs.sort((p, q) => p[2] - q[2]);
  for (const [a, b] of pairs) {
    const path = astar(Math.floor(a.x / CELL), Math.floor(a.y / CELL), Math.floor(b.x / CELL), Math.floor(b.y / CELL));
    if (!path) continue;
    // keep only the stretches that aren't already road, so roads don't stack
    let cur = [];
    const flush = () => { if (cur.length >= 3) roads.push(polyline(cur)); cur = []; };
    for (let k = 0; k < path.length; k++) {
      const i = path[k];
      const was = roadCell[i];
      if (was && cur.length) { cur.push(i); flush(); }
      else if (!was) { if (!cur.length && k > 0) cur.push(path[k - 1]); cur.push(i); }
      roadCell[i] = 1;
    }
    flush();
  }
  function astar(sx, sy, ex, ey) {
    const N = GW * GH, g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; // [f, i]
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const s = sy * GW + sx, e = ey * GW + ex;
    g[s] = 0; push(0, s);
    while (heap.length) {
      const [, i] = pop(); if (closed[i]) continue; closed[i] = 1;
      if (i === e) break;
      const x = i % GW, y = (i / GW) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const X = x + ox, Y = y + oy; if (X < 0 || Y < 0 || X >= GW || Y >= GH) continue;
        const j = Y * GW + X; if (closed[j] || H[j] <= 0) continue;
        const step = ox && oy ? 1.414 : 1;
        const slope = Math.abs(H[j] - H[i]) / (CELL * 1000 * step);
        let cost = step * (1 + slope * 60 + Math.max(0, H[j] - 1500) / 900);
        if (roadCell[j]) cost *= 0.45;
        const ng = g[i] + cost;
        if (ng < g[j]) { g[j] = ng; from[j] = i; push(ng + Math.hypot(X - ex, Y - ey) * 0.45, j); }
      }
    }
    if (from[e] < 0 && s !== e) return null;
    const out = []; for (let i = e; i >= 0; i = from[i]) { out.push(i); if (i === s) break; }
    return out.reverse();
  }
  function polyline(cells) {
    let pts = cells.map((i) => [(i % GW + 0.5) * CELL, (((i / GW) | 0) + 0.5) * CELL]);
    for (let it = 0; it < 2; it++) {
      const o = [pts[0]];
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
        o.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
      o.push(pts[pts.length - 1]); pts = o;
    }
    let len = 0; const cum = [0];
    for (let k = 1; k < pts.length; k++) { len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); cum.push(len); }
    return { pts, cum, len };
  }

  const world = {
    seed, H, R: R2, B, C, dist, towns, roads, caps,
    heightAt, countryAt,
    land: (kx, ky) => heightAt(kx, ky) > 0,
    biomeAt: (kx, ky) => BIOMES[B[cellAt(kx, ky)]],
    rainAt: (kx, ky) => R2[cellAt(kx, ky)],
    tempAt: (kx, ky) => tempAtCell(kx / CELL, ky / CELL, heightAt(kx, ky)),
    coastAt: (kx, ky) => dist[cellAt(kx, ky)] * CELL,
  };
  return world;
}

// bearing: degrees clockwise from north; map y grows south
export function bearing(dx, dy) { return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360; }

// pick a spot on a road
export function pickLocation(world, r, wantCountry = -1) {
  const total = world.roads.reduce((s, rd) => s + rd.len, 0);
  for (let tries = 0; tries < 400; tries++) {
    let t = r() * total, rd = world.roads[0];
    for (const R of world.roads) { if (t < R.len) { rd = R; break; } t -= R.len; }
    let k = 1; while (k < rd.cum.length - 1 && rd.cum[k] < t) k++;
    const [ax, ay] = rd.pts[k - 1], [bx, by] = rd.pts[k];
    const seg = rd.cum[k] - rd.cum[k - 1] || 1, u = Math.max(0, Math.min(1, (t - rd.cum[k - 1]) / seg));
    const x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
    if (!world.land(x, y)) continue;
    const c = world.countryAt(x, y);
    if (wantCountry >= 0 && c !== wantCountry) continue;
    // lean towards towns and villages: open road is most of the network but the least interesting
    const [tw, td] = nearestTown(world, x, y);
    const rad = tw.capital ? 4.5 : 1.6 + tw.size * 2;
    if (td > rad * 3 && r() > 0.3) continue;
    if (td > rad && td <= rad * 3 && r() > 0.75) continue;
    return { x, y, dir: bearing(bx - ax, by - ay), country: c, seed: (r() * 1e9) | 0 };
  }
  return null;
}

export function nearestTown(world, x, y) {
  let best = null, bd = 1e9;
  for (const t of world.towns) { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = t; } }
  return [best, bd];
}
