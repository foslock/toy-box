// A new world from a seed. First a plan: the shape of the ground, where each layer starts, and every big thing in
// it (caverns and lakes, rivers, geodes, lava, firedamp, ore veins, the gems laid out in rings and arcs and spirals
// for the worm to follow, the ruins and their vaults, the core). Then the ground itself, one band of rows at a time,
// cell by cell: the layer's rock and its texture, pockets and tunnels carved by noise, and the plan's things drawn
// in. Everything comes from the seed, so a band built twice comes out the same.
import {
  W, H, GROUND, BAND, BANDS, CORE_X, CORE_Y, CORE_R, STRATA, FINDS, ITEMS,
  AIR, WATER, LAVA, GAS, SOIL, ROOT, MOSS, STONE, CLAY, SAND, GRAVEL, LIME, GRANITE, GEODE, CRYSTAL, BASALT, OBSIDIAN,
  RUIN, MANTLE, ALLOY, CORE, COAL,
} from './rules.js';

/* ---------- seeded numbers ---------- */
// mulberry32, with a few helpers. f.state() reads and restores where it's up to.
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  const f = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.state = v => { if (v !== undefined) s = v | 0; return s; };
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.chance = p => f() < p;
  f.weighted = pairs => { let tot = 0; for (const [, w] of pairs) tot += w; let r = f() * tot; for (const [v, w] of pairs) if ((r -= w) <= 0) return v; return pairs[pairs.length - 1][0]; };
  return f;
}
// A stable number in [0, 1) for a cell (and a salt).
export function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1440670441) | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
// Smooth value noise in [0, 1], in 2D and 1D.
export function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function vnoise1(x, s) {
  const xi = Math.floor(x), f = x - xi, t = f * f * (3 - 2 * f), a = hash2(xi, 0, s), b = hash2(xi + 1, 0, s);
  return a + (b - a) * t;
}
function fbm(x, y, s) { return (vnoise(x, y, s) * .57 + vnoise(x * 2.03, y * 2.03, s + 1) * .29 + vnoise(x * 4.1, y * 4.1, s + 2) * .14); }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// Seeds typed by a person: a number is used as it is, anything else is hashed into one.
export function seedOf(text) {
  const t = String(text ?? '').trim();
  if (/^\d{1,9}$/.test(t)) return +t || 1;
  let h = 2166136261;
  for (const ch of t.toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 999999999 + 1;
}
const WORDS1 = ['amber', 'ashen', 'brass', 'cinder', 'copper', 'deep', 'dusk', 'ember', 'flint', 'gold', 'hollow', 'iron', 'jade', 'loam', 'moss', 'ochre', 'quiet', 'red', 'rust', 'salt', 'silver', 'slate', 'sunk', 'tawny', 'umber', 'velvet', 'wild'];
const WORDS2 = ['barrow', 'bed', 'cellar', 'crown', 'deep', 'delve', 'dune', 'ember', 'field', 'furrow', 'gully', 'heart', 'hollow', 'mere', 'mound', 'reach', 'root', 'seam', 'shelf', 'sink', 'spire', 'vault', 'vein', 'warren', 'well'];
// A seed as two words, easier to share than a number.
export function randomSeedText() {
  const r = Math.random;
  return WORDS1[Math.floor(r() * WORDS1.length)] + '-' + WORDS2[Math.floor(r() * WORDS2.length)] + '-' + (10 + Math.floor(r() * 90));
}

/* ---------- shapes to follow ---------- */
// A shape as a dense run of points about a centre: rings, arcs, spirals, waves and the rest. size is roughly its
// radius. The worm can trace every one of them in a single sweep.
export const SHAPES = ['ring', 'arc', 'spiral', 'wave', 'zigzag', 'eight', 'heart', 'star', 'loops', 'line', 'scurve', 'double'];
function shapePoints(kind, size, R) {
  const P = [], TAU = Math.PI * 2, rot = R() * TAU;
  const add = (x, y) => P.push([x, y]);
  if (kind === 'ring') for (let t = 0; t <= TAU; t += .8 / size) add(Math.cos(t) * size, Math.sin(t) * size);
  else if (kind === 'arc') { const span = R.range(1.9, 4.2), a0 = R() * TAU; for (let t = 0; t <= span; t += .8 / size) add(Math.cos(a0 + t) * size, Math.sin(a0 + t) * size); }
  else if (kind === 'spiral') { const turns = R.range(1.2, 1.9), r0 = size * .22, a0 = R() * TAU, dir = R() < .5 ? 1 : -1; for (let t = 0; t <= turns * TAU;) { const r = r0 + (size - r0) * t / (turns * TAU); add(Math.cos(a0 + dir * t) * r, Math.sin(a0 + dir * t) * r); t += .8 / Math.max(r, 3); } }
  else if (kind === 'wave' || kind === 'zigzag') {
    const len = size * R.range(2.6, 3.4), amp = size * R.range(.28, .42), per = R.range(1.5, 2.6);
    for (let u = -len / 2; u <= len / 2; u += .6) {
      const ph = (u / len + .5) * per * TAU;
      const v = kind === 'wave' ? Math.sin(ph) : (2 / Math.PI) * Math.asin(Math.sin(ph));
      add(u, v * amp);
    }
  } else if (kind === 'eight') { for (let t = 0; t <= TAU; t += .5 / size) { const d = 1 + Math.sin(t) ** 2; add(size * 1.3 * Math.cos(t) / d, size * 1.3 * Math.sin(t) * Math.cos(t) / d); } }
  else if (kind === 'heart') { const k = size / 16; for (let t = 0; t <= TAU; t += .4 / size) add(k * 16 * Math.sin(t) ** 3, -k * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))); return P; }
  else if (kind === 'star') {
    const pts = [];
    for (let j = 0; j <= 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? size * .45 : size; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    for (let j = 0; j < 10; j++) { const [ax, ay] = pts[j], [bx, by] = pts[j + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) / .7); for (let q = 0; q < n; q++) add(ax + (bx - ax) * q / n, ay + (by - ay) * q / n); }
    return P;
  } else if (kind === 'loops') {
    const n = R.int(2, 3), s = size * .34, k = size * .5, len = n * TAU;
    for (let t = 0; t <= len; t += .05) add((t - len / 2) * s / 1.1 - k * Math.sin(t) * .9, -k * Math.cos(t));
  } else if (kind === 'line') { const len = size * R.range(2, 3); for (let u = -len / 2; u <= len / 2; u += .7) add(u, 0); }
  else if (kind === 'scurve') {
    for (let t = 0; t <= Math.PI; t += .8 / size) add(-size * .5 + Math.cos(Math.PI - t) * size * .5, Math.sin(t) * size * .5 * -1);
    for (let t = 0; t <= Math.PI; t += .8 / size) add(size * .5 + Math.cos(Math.PI - t) * size * .5, Math.sin(t) * size * .5);
  } else if (kind === 'double') {
    const span = R.range(2.4, 3.6), a0 = R() * TAU;
    for (let t = 0; t <= span; t += .8 / size) add(Math.cos(a0 + t) * size, Math.sin(a0 + t) * size);
    for (let t = span; t >= 0; t -= .8 / size) add(Math.cos(a0 + t) * size * .62, Math.sin(a0 + t) * size * .62);
  }
  // turn it (a wave or a line mostly lies flat, or steps gently down)
  const flat = kind === 'wave' || kind === 'zigzag' || kind === 'loops' || kind === 'line';
  const a = flat ? (R() - .5) * (kind === 'line' ? 1.9 : .9) : rot, c = Math.cos(a), s = Math.sin(a);
  return P.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}
// Points spaced `gap` apart along a run of points.
function spaced(P, gap) {
  const out = [P[0]];
  let acc = 0;
  for (let j = 1; j < P.length; j++) {
    acc += Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]);
    if (acc >= gap) { out.push(P[j]); acc = 0; }
  }
  return out;
}
function bbox(P) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of P) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

/* ---------- the plan ---------- */
// How many of each thing a layer gets for every hundred rows of it.
const DENSITY = [
  { form: 2.2, loose: 17, veins: 1.2, rocks: 5, caverns: 0, lakes: 0, gas: 0 },
  { form: 2.1, loose: 13, veins: 1.3, rocks: 1.3, caverns: .25, lakes: .45, gas: 0 },
  { form: 2, loose: 11, veins: 1.3, rocks: 1.1, caverns: 1.2, lakes: .6, gas: 0, shafts: .3 },
  { form: 2, loose: 10, veins: 1.3, rocks: 1, caverns: .55, lakes: .3, gas: .55, shafts: .15, rivers: .12 },
  { form: 1.9, loose: 9, veins: 1.3, rocks: .7, caverns: .25, lakes: .15, gas: .15, geodes: .62 },
  { form: 1.8, loose: 8.5, veins: 1.3, rocks: .9, caverns: .3, lakes: 0, gas: .75, lava: .8, rivers: .1 },
  { form: 1.6, loose: 7, veins: 1.1, rocks: 0, caverns: .15, lakes: 0, gas: .2 },
  { form: 1.9, loose: 8, veins: 1.4, rocks: 0, caverns: .15, lakes: 0, gas: .3, lava: .45 },
];
// Harder rock that turns up as boulders in each layer: the next layer's, so it's in the way until you can shake it.
const BOULDER = [STONE, LIME, GRANITE, GEODE, BASALT, OBSIDIAN, -1, -1];
// Noise caves in each layer: blob [scale x, scale y, threshold] for pockets, tun [scale x, scale y, half width] for
// winding tunnels. `from`: no caves nearer the grass than this.
const CAVES = [
  { blob: null, tun: [30, 20, .006], from: 28 },
  { blob: [22, 14, .77], tun: [36, 24, .011] },
  { blob: [30, 18, .69], tun: [42, 28, .018] },
  { blob: [26, 20, .74], tun: [24, 56, .021] },
  { blob: [28, 22, .765], tun: [38, 30, .014] },
  { blob: [34, 16, .755], tun: [64, 20, .022] },
  { blob: [26, 26, .8], tun: null },
  { blob: [24, 24, .77], tun: [38, 38, .012] },
];

let NEXT_FEAT = 1;
export function makePlan(seed) {
  const R = rng(seed ^ 0x2545f491);
  const salt = k => (Math.imul(seed | 0, 2654435761) ^ Math.imul(k + 1, 40503)) | 0;
  const plan = { seed, salt: Array.from({ length: 64 }, (_, k) => salt(k)), feats: [], items: [], sets: [], vaults: [], protect: [], beams: [] };
  NEXT_FEAT = 1;

  /* the ground line: low rolling ground, flat where the camp's two buildings stand, rising into bluffs at the edges */
  const surf = plan.surf = new Int16Array(W);
  const sA = plan.salt[0], sB = plan.salt[1];
  for (let x = 0; x < W; x++) {
    let h = (vnoise1(x / 26, sA) - .5) * 7 + (vnoise1(x / 8, sB) - .5) * 2.2;
    const edge = Math.max(0, 26 - Math.min(x, W - 1 - x));
    h -= edge * edge * .028 + (edge > 0 ? (vnoise1(x / 3, sB + 5) - .5) * 3 : 0);
    for (const c of [84, 176]) { const d = Math.abs(x - c); if (d < 22) h *= d < 15 ? .05 : .05 + (d - 15) / 7 * .95; }
    surf[x] = GROUND + Math.round(h);
  }
  /* where each layer starts, column by column: a wavy line */
  plan.bnd = STRATA.map((s, k) => {
    const a = new Int16Array(W);
    for (let x = 0; x < W; x++) a[x] = k === 0 ? surf[x] : GROUND + s.top + Math.round((vnoise1(x / 36, plan.salt[2 + k]) - .5) * 18 + (vnoise1(x / 9, plan.salt[12 + k]) - .5) * 6);
    return a;
  });

  for (let k = 0; k < STRATA.length; k++) planLayer(plan, k, R);
  plan.feats.push({ t: 'core', z: 9, y0: CORE_Y - CORE_R - 20, y1: H - 1 });

  // index everything by band, so building a band only looks at what's in it
  plan.feats.sort((a, b) => a.z - b.z);
  plan.byBand = Array.from({ length: BANDS }, () => []);
  for (const f of plan.feats) for (let b = Math.max(0, Math.floor(f.y0 / BAND)); b <= Math.min(BANDS - 1, Math.floor(f.y1 / BAND)); b++) plan.byBand[b].push(f);
  plan.protectByBand = Array.from({ length: BANDS }, () => []);
  for (const p of plan.protect) for (let b = Math.max(0, Math.floor((p.y - p.r) / BAND)); b <= Math.min(BANDS - 1, Math.floor((p.y + p.r) / BAND)); b++) plan.protectByBand[b].push(p);
  return plan;
}

function planLayer(plan, k, R) {
  const S = STRATA[k], D = DENSITY[k], F = FINDS[k];
  const top = GROUND + S.top + 14, bot = (k < STRATA.length - 1 ? GROUND + STRATA[k + 1].top : CORE_Y - CORE_R) - 14;
  const rows = bot - top, per = n => { const v = n * rows / 100; return Math.floor(v) + (R() < v % 1 ? 1 : 0); };
  const used = [];                       // circles already taken by something that mustn't overlap
  const free = (x, y, r, pad = 4) => used.every(u => Math.hypot(u.x - x, u.y - y) > u.r + r + pad);
  const spot = (r, pad = 4, tries = 60, y0 = top, y1 = bot) => {
    for (let t = 0; t < tries; t++) {
      const x = R.range(r + 3, W - r - 3), y = R.range(y0 + r, y1 - r);
      if (y1 - y0 < 2 * r) return null;
      if (free(x, y, r, pad)) { const c = { x, y, r }; used.push(c); return c; }
    }
    return null;
  };
  const feat = (f, z) => { f.id = NEXT_FEAT++; f.z = z; f.st = k; plan.feats.push(f); return f; };
  const item = (kind, x, y, set = -1, n = 0) => { const o = { id: plan.items.length, kind, x: Math.round(x), y: Math.round(y), set, n, st: k }; plan.items.push(o); return o; };

  /* ruins first: their walls, rooms and vaults decide where everything else can go */
  if (S.id === 'ruins') planRuins(plan, k, R, top, bot, used, feat, item);

  /* big open spaces */
  const cavern = (rx, ry, o = {}) => {
    const c = spot(Math.max(rx, ry) + 3, 8);
    if (!c) return null;
    return feat({ t: 'cavern', x: c.x, y: c.y, rx, ry, salt: R.int(1, 1e6), y0: c.y - ry - 16, y1: c.y + ry + 16, ...o }, 3);
  };
  for (let j = per(D.caverns); j > 0; j--) {
    const big = S.id === 'lime' && R() < .35;
    const rx = big ? R.range(36, 60) : R.range(14, 34), ry = big ? R.range(20, 32) : R.range(9, 20);
    const style = S.id === 'lime' ? 'stal' : S.id === 'granite' ? 'grotto' : S.id === 'crystal' ? 'crystal' : S.id === 'magma' || S.id === 'mantle' ? 'hot' : 'plain';
    const c = cavern(rx, ry, { style });
    if (!c) continue;
    for (let q = R.int(1, 3); q > 0; q--) item(R.pick(F.cave), c.x + R.range(-rx * .6, rx * .6), c.y);
    // a few stalactites loose enough to fall on a passing worm
    if (style === 'stal') for (let q = R.int(1, 3); q > 0; q--) {
      const x = c.x + R.range(-rx * .7, rx * .7), top = ceilingOf(c, x);
      if (top !== null) item('stalactite', x, top + 3);
    }
    if (S.id === 'granite') for (let q = R.int(2, 5); q > 0; q--) item('glowcap', c.x + R.range(-rx * .7, rx * .7), c.y);
  }
  for (let j = per(D.lakes); j > 0; j--) {
    const rx = R.range(12, 30), ry = R.range(8, 16);
    const c = cavern(rx, ry, { style: S.id === 'lime' ? 'stal' : 'plain', fill: WATER, level: R.range(-.25, .25) });
    if (!c) continue;
    for (let q = R.int(1, 2); q > 0; q--) item(R.pick(F.lake), c.x + R.range(-rx * .5, rx * .5), c.y + ry * .5);
  }
  for (let j = per(D.lava || 0); j > 0; j--) {
    const rx = R.range(16, 38), ry = R.range(10, 22);
    const c = cavern(rx, ry, { style: 'hot', fill: LAVA, level: R.range(-.05, .35), crust: true });
    if (c && R() < .6) item(R.pick(F.lake), c.x + R.range(-rx * .4, rx * .4), c.y + ry * .6);
  }
  for (let j = per(D.geodes || 0); j > 0; j--) {
    const r = R.range(20, 42), c = spot(r + 6, 10);
    if (!c) continue;
    const g = feat({ t: 'geode', x: c.x, y: c.y, r, salt: R.int(1, 1e6), y0: c.y - r - 8, y1: c.y + r + 8 }, 4);
    g.spikes = [];
    const n = Math.round(r * .55);
    for (let q = 0; q < n; q++) {
      const a = (q + R.range(-.3, .3)) / n * Math.PI * 2;
      if (R() < .3) continue;        // gaps, so there's always a way out through the shell
      g.spikes.push({ a, len: R.range(r * .22, r * .5), w: R.range(1.6, 3.4) });
    }
    for (let q = R.int(2, 4); q > 0; q--) item(R.pick(F.cave), c.x + R.range(-r * .5, r * .5), c.y + r * .3);
    // crystal spikes hanging from the roof of the geode, ready to drop
    for (let q = R.int(1, 3); q > 0; q--) { const a = -Math.PI / 2 + R.range(-.9, .9); item('spike', c.x + Math.cos(a) * (r - 2), c.y + Math.sin(a) * (r - 2) + 4); }
  }
  for (let j = per(D.rivers || 0); j > 0; j--) {
    const y = R.range(top + 30, bot - 30);
    if (!used.every(u => Math.abs(u.y - y) > u.r + 12)) continue;
    used.push({ x: W / 2, y, r: 10 });   // (a thin band: only its row matters)
    for (let x = 0; x < W; x += 16) used.push({ x, y, r: 9 });
    feat({ t: 'river', y, amp: R.range(3, 7), per: R.range(18, 34), ph: R() * 6.28, thick: R.range(9, 14), level: R.range(-.1, .3), salt: R.int(1, 1e6), y0: y - 24, y1: y + 24, fill: S.id === 'magma' ? LAVA : WATER }, 3);
  }
  for (let j = per(D.shafts || 0); j > 0; j--) {
    const h = R.range(40, 120), w = R.range(5, 10), c = spot(Math.max(h / 2, w), 6);
    if (!c) continue;
    feat({ t: 'shaft', x: c.x, y: c.y, h, w, salt: R.int(1, 1e6), y0: c.y - h / 2 - 2, y1: c.y + h / 2 + 2 }, 3);
  }
  for (let j = per(D.gas || 0); j > 0; j--) {
    const r = R.range(4, S.id === 'magma' ? 12 : 9), c = spot(r + 2, 4);
    if (c) feat({ t: 'gas', x: c.x, y: c.y, r, salt: R.int(1, 1e6), y0: c.y - r - 3, y1: c.y + r + 3 }, 6);
  }

  /* rock too hard to shake yet */
  if (BOULDER[k] >= 0) for (let j = per(D.rocks); j > 0; j--) {
    const r = k === 0 ? R.range(1.8, 5) : R.range(4, 12), x = R.range(r, W - r), y = R.range(top + r, bot - r);
    if (!free(x, y, r, 2) || Math.hypot(x - W / 2, y - plan.surf[W / 2] - 18) < r + 16) continue;
    used.push({ x, y, r });
    feat({ t: 'blob', x, y, r, mat: BOULDER[k], salt: R.int(1, 1e6), y0: y - r * 1.4 - 2, y1: y + r * 1.4 + 2 }, 1);
  }
  if (S.id === 'topsoil') {
    // roots from the plants on top, wandering down
    for (let j = R.int(5, 9); j > 0; j--) {
      let x = R.range(8, W - 8), y = plan.surf[Math.round(x)] + 1, a = Math.PI / 2 + R.range(-.4, .4);
      const pts = [];
      for (let s = R.int(18, 60); s > 0; s--) { pts.push([x, y]); a += R.range(-.35, .35); a = clamp(a, .4, Math.PI - .4); x += Math.cos(a) * 1.5; y += Math.sin(a) * 1.5; }
      const b = bbox(pts);
      feat({ t: 'line', pts, mat: ROOT, thick: R.range(.9, 1.4), only: [SOIL], y0: b.y0 - 2, y1: b.y1 + 2 }, 2);
    }
  }

  /* ore veins, in shapes and in wandering seams */
  for (let j = per(D.veins); j > 0; j--) {
    const kind = R() < .6 ? R.pick(SHAPES) : 'seam', size = R.range(12, 28);
    let pts;
    if (kind === 'seam') {
      pts = []; let x = 0, y = 0, a = R.range(-.5, .5) + (R() < .5 ? 0 : Math.PI);
      for (let s = R.int(40, 120); s > 0; s--) { pts.push([x, y]); a += R.range(-.25, .25); x += Math.cos(a) * 1.2; y += Math.sin(a) * .8; }
    } else pts = shapePoints(kind, size, R);
    const placed = fit(pts, top, bot, R);
    if (!placed) continue;
    const b = bbox(placed);
    feat({ t: 'line', pts: placed, mat: S.ore, thick: kind === 'seam' ? R.range(1.2, 2.4) : R.range(1.6, 2.6), only: null, y0: b.y0 - 3, y1: b.y1 + 3 }, 2);
  }

  /* gems in shapes */
  for (let j = per(D.form); j > 0; j--) {
    const kind = R.pick(SHAPES), size = R.range(11, 24);
    const pts = shapePoints(kind, size, R), b0 = bbox(pts), r = Math.max(b0.x1 - b0.x0, b0.y1 - b0.y0) / 2 + 5;
    const c = spot(r, 3);
    if (!c) continue;
    const cx = (b0.x0 + b0.x1) / 2, cy = (b0.y0 + b0.y1) / 2;
    const at = spaced(pts.map(([x, y]) => [x - cx + c.x, y - cy + c.y]), R.range(7, 9.5));
    if (at.length < 4) continue;
    const set = plan.sets.length, kindOf = F.form.length > 1 && R() < .25 ? null : R.pick(F.form);
    plan.sets.push({ id: set, shape: kind, n: at.length, st: k });
    at.forEach(([x, y], n) => item(kindOf || F.form[n % F.form.length], x, y, set, n));
    plan.protect.push({ x: c.x, y: c.y, r: r + 2 });
  }

  /* the big ones: often at the heart of a ring of little ones */
  const bigs = k === 0 ? R.int(1, 2) : k === 6 ? 1 : R.int(2, 3);
  for (let j = 0; j < bigs; j++) {
    const c = spot(16, 6);
    if (!c) continue;
    item(R.pick(F.big), c.x, c.y);
    if (R() < .6) {
      const n = R.int(6, 9), set = plan.sets.length, gem = R.pick(F.form);
      plan.sets.push({ id: set, shape: 'ring', n, st: k });
      for (let q = 0; q < n; q++) { const a = q / n * Math.PI * 2; item(gem, c.x + Math.cos(a) * 13, c.y + Math.sin(a) * 13, set, q); }
    }
    plan.protect.push({ x: c.x, y: c.y, r: 18 });
  }

  /* finds scattered through the ground */
  for (let j = per(D.loose); j > 0; j--) {
    const x = R.range(5, W - 5), y = R.range(k === 0 ? GROUND + 8 : top - 10, bot + 10);
    if (!used.every(u => Math.hypot(u.x - x, u.y - y) > u.r * .8)) continue;
    item(R.weighted(F.loose), x, y);
  }
}

// Where a cavern's roof is above x (worked out the same way its cells are drawn), or null.
function ceilingOf(f, x) {
  const inside = y => ((x - f.x) / f.rx) ** 2 + ((y - f.y) / f.ry) ** 2 + (vnoise(x * .11, y * .11, f.salt) - .5) * .7 < 1;
  for (let y = Math.floor(f.y - f.ry * 1.4); y <= f.y; y++) if (inside(y) && !inside(y - 1)) return y;
  return null;
}

// Move a run of points (about 0, 0) somewhere it fits across the world and within rows y0..y1. null if it can't.
function fit(pts, y0, y1, R) {
  const b = bbox(pts), w = b.x1 - b.x0, h = b.y1 - b.y0;
  if (w > W - 12 || h > y1 - y0 - 4) return null;
  const x = R.range(6 - b.x0, W - 6 - b.x1), y = R.range(y0 + 2 - b.y0, y1 - 2 - b.y1);
  return pts.map(([px, py]) => [px + x, py + y]);
}

// The Old Ones: alloy floors across the whole width with a gap at one end, turn and turn about, so the way down
// zigzags; buildings of rooms between them; and vaults, sealed until every keystone around them has been eaten.
function planRuins(plan, k, R, top, bot, used, feat, item) {
  const rect = (x0, y0, x1, y1, mat) => [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), mat];
  const slabs = [];
  let side = R() < .5 ? 0 : 1;
  for (let y = top + R.range(70, 100); y < bot - 60; y += R.range(140, 175)) {
    const gap = R.range(30, 42), th = 3;
    const ops = side ? [rect(gap, y, W - 1, y + th, ALLOY)] : [rect(0, y, W - 1 - gap, y + th, ALLOY)];
    // a line of circuitry along its top, to follow along to the gap
    const cx0 = side ? gap + 4 : 4, cx1 = side ? W - 5 : W - 5 - gap;
    const pts = []; for (let x = cx0; x <= cx1; x += .8) pts.push([x, y - 3 + Math.sin(x / 9) * 1.2]);
    feat({ t: 'rects', ops, y0: y - 1, y1: y + th + 1 }, 7);
    feat({ t: 'line', pts, mat: STRATA[k].ore, thick: 1.4, only: null, y0: y - 6, y1: y + 1 }, 2);
    // a barrier across every other gap: wait for it to drop
    if (R() < .6) { const gx0 = side ? 0 : W - gap, gx1 = side ? gap : W - 1; plan.beams.push({ x0: gx0, y0: y + 1, x1: gx1, y1: y + 1, phase: R() * 3 }); }
    for (let x = 0; x < W; x += 12) used.push({ x, y: y + 1, r: 8 });
    slabs.push(y);
    side ^= 1;
  }
  // buildings
  for (let j = R.int(4, 6); j > 0; j--) {
    const w = R.range(56, 110), h = R.range(28, 44);
    const c = (() => { for (let t = 0; t < 40; t++) { const x = R.range(w / 2 + 6, W - w / 2 - 6), y = R.range(top + h / 2 + 10, bot - h / 2 - 10); if (used.every(u => Math.abs(u.x - x) > u.r + w / 2 + 3 || Math.abs(u.y - y) > u.r + h / 2 + 3)) return { x, y }; } return null; })();
    if (!c) continue;
    for (let x = c.x - w / 2; x <= c.x + w / 2; x += 10) used.push({ x, y: c.y - h / 2, r: 6 }, { x, y: c.y + h / 2, r: 6 }, { x, y: c.y, r: Math.min(10, h / 2) });
    const x0 = c.x - w / 2, x1 = c.x + w / 2, y0 = c.y - h / 2, y1 = c.y + h / 2;
    const ops = [rect(x0, y0, x1, y1, ALLOY), rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2, AIR)];
    // rooms: split by inner walls of old stone, each with a doorway at the floor
    const rooms = R.int(2, 4), rw = (w - 4) / rooms;
    for (let q = 1; q < rooms; q++) { const wx = x0 + 2 + q * rw; ops.push(rect(wx - 1, y0 + 2, wx + 1, y1 - 2, R() < .5 ? ALLOY : RUIN), rect(wx - 1, y1 - 15, wx + 1, y1 - 3, AIR)); }
    if (h > 36 && R() < .7) { const gx = x0 + 6 + R.range(0, w - 26); ops.push(rect(x0 + 2, c.y - 1, x1 - 2, c.y + 1, RUIN), rect(gx, c.y - 1, gx + 12, c.y + 1, AIR)); }
    // ways in: a gap in each end wall, at the floor
    // (tall enough for the biggest worm to get through)
    ops.push(rect(x0, y1 - 14, x0 + 2, y1 - 3, AIR), rect(x1 - 2, y1 - 14, x1, y1 - 3, AIR));
    for (const bx of [x0 + 1, x1 - 1]) if (R() < .5) plan.beams.push({ x0: Math.round(bx), y0: Math.round(y1 - 14), x1: Math.round(bx), y1: Math.round(y1 - 3), phase: R() * 3 });
    // pillars and a stripe of circuitry round the inside
    for (let q = 0; q < rooms; q++) { const rx = x0 + 2 + (q + .5) * rw; if (R() < .5) ops.push(rect(rx - 1, y0 + 2, rx + 1, y0 + 6, ALLOY)); }
    feat({ t: 'rects', ops, y0: y0 - 1, y1: y1 + 1 }, 7);
    const pts = []; for (let x = x0 + 4; x <= x1 - 4; x += .8) pts.push([x, y0 + 2.5]);
    feat({ t: 'line', pts, mat: STRATA[k].ore, thick: 1.2, only: [AIR], y0: y0 + 2, y1: y0 + 7 }, 8);
    for (let q = 0; q < rooms; q++) if (R() < .75) item(R.pick(['scrap', 'powercell', 'scrap', 'glyph']), x0 + 2 + (q + .5) * rw + R.range(-4, 4), y1 - 6);
    plan.protect.push({ x: c.x, y: c.y, r: Math.max(w, h) / 2 + 4 });
  }
  // vaults: an alloy box with something wonderful inside, and a ring of keystones around it
  const relics = ['idol', 'orb', 'mask'];
  for (let j = 0; j < 3; j++) {
    const c = (() => { for (let t = 0; t < 80; t++) { const x = R.range(40, W - 40), y = R.range(top + 40, bot - 40); if (used.every(u => Math.hypot(u.x - x, u.y - y) > u.r + 36)) return { x, y }; } return null; })();
    if (!c) continue;
    used.push({ x: c.x, y: c.y, r: 38 });
    const ops = [rect(c.x - 14, c.y - 12, c.x + 14, c.y + 12, ALLOY), rect(c.x - 11, c.y - 9, c.x + 11, c.y + 9, AIR), rect(c.x - 4, c.y + 6, c.x + 4, c.y + 9, ALLOY)];
    feat({ t: 'rects', ops, y0: c.y - 13, y1: c.y + 13 }, 7);
    const relic = item(relics[j % 3], c.x, c.y + 1);
    const n = R.int(4, 6), set = plan.sets.length, keys = [];
    plan.sets.push({ id: set, shape: 'ring', n, st: k, vault: plan.vaults.length });
    for (let q = 0; q < n; q++) { const a = q / n * Math.PI * 2 + .3; keys.push(item('keystone', c.x + Math.cos(a) * 28, c.y + Math.sin(a) * 26, set, q).id); }
    plan.vaults.push({ id: plan.vaults.length, x: c.x, y: c.y, set, keys, relic: relic.id, door: [Math.round(c.x) - 6, Math.round(c.y) - 12, Math.round(c.x) + 6, Math.round(c.y) - 9] });
    plan.protect.push({ x: c.x, y: c.y, r: 36 });
  }
}

/* ---------- building a band ---------- */
// Fills rows b*BAND … b*BAND+BAND-1 of mat and shade. shade packs a cell's texture: its low six bits are how light
// it is (0–63), its top two a mark on it (1: a dark line or crack, 2: a light fleck, 3: something special).
export function buildBand(plan, b, mat, shade) {
  const y0 = b * BAND, y1 = y0 + BAND, { surf, bnd, salt } = plan;
  const prot = plan.protectByBand[b];
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (y < surf[x]) { mat[i] = AIR; shade[i] = 0; continue; }
      let k = 0;
      for (let q = STRATA.length - 1; q >= 1; q--) if (y >= bnd[q][x]) { k = q; break; }
      const d = y - surf[x];
      let mt = STRATA[k].mat, acc = 0;
      let v = vnoise(x * .21, y * .21, salt[20]) * .6 + vnoise(x * .07, y * .07, salt[21]) * .4;
      const h = hash2(x, y, salt[22]);
      switch (k) {
        case 0:
          v = v * .8 + .2 - Math.min(.25, d / 600);
          if (h < .018) acc = 2;
          // (none where the worm starts, under the middle of the camp)
          if (d > 5 && vnoise(x * .3, y * .3, salt[23]) > .86 && (x - W / 2) ** 2 + (d - 18) ** 2 > 400) mt = STONE;
          break;
        case 1:
          v = v * .7 + .15 + .16 * Math.sin(y * .55 + 5 * vnoise1(x * .03, salt[24]));
          if (vnoise(x * .05, y * .12, salt[25]) > .79) mt = SAND;
          else if (vnoise(x * .09, y * .15, salt[26]) > .85) mt = GRAVEL;
          if (h < .01) acc = 2;
          break;
        case 2: {
          const bed = (y + 5 * vnoise1(x * .04, salt[27]) + 400) % 11;
          if (bed < 1) acc = 1; else if (h < .014) acc = 2;
          v = v * .7 + .3 * (bed / 11);
          break;
        }
        case 3: if (h < .09) acc = 2; else if (h > .91) acc = 1; break;
        case 4: if (h < .035) acc = 2; else if (vnoise(x * .12, y * .04, salt[28]) > .78) acc = 1; break;
        case 5: {
          const cx = x + 2.5 * vnoise1(y * .025, salt[29]), col = Math.floor(cx / 7);
          if (cx - col * 7 < 1 || (y + col * 5) % 13 === 0) acc = 1; else if (h < .01) acc = 2;
          v = v * .6 + .4 * hash2(col, 0, salt[30]);
          break;
        }
        case 6: {
          const row = Math.floor(y / 6), bx = (x + (row & 1) * 6) % 12;
          if (y % 6 === 0 || bx === 0) acc = 1;
          else if (vnoise(x * .06, y * .06, salt[31]) > .8 && h < .5) acc = 3;
          v = v * .5 + .5 * hash2(Math.floor((x + (row & 1) * 6) / 12), row, salt[32]);
          break;
        }
        case 7: {
          const sh = .5 + .5 * Math.sin((x + y) * .13 + 4 * vnoise(x * .03, y * .03, salt[33]));
          if (sh > .93) acc = 2;
          v = v * .6 + .4 * sh;
          break;
        }
      }
      // pockets and tunnels, but never in the shelf between two layers, near the grass, or over something laid out
      const cv = CAVES[k];
      if (d > (cv.from || 0) && y - bnd[k][x] > 9 && (k === STRATA.length - 1 || bnd[k + 1][x] - y > 9)) {
        let open = false;
        if (cv.blob && fbm(x / cv.blob[0], y / cv.blob[1], salt[34 + k]) > cv.blob[2]) open = true;
        else if (cv.tun && Math.abs(fbm(x / cv.tun[0], y / cv.tun[1], salt[44 + k]) - .5) < cv.tun[2]) open = true;
        if (open) for (const p of prot) if ((x - p.x) ** 2 + (y - p.y) ** 2 < p.r * p.r) { open = false; break; }
        if (open) { mt = AIR; v = v * .8; acc = 0; }
      }
      mat[i] = mt;
      shade[i] = (acc << 6) | clamp(Math.round(v * 63), 0, 63);
    }
  }
  for (const f of plan.byBand[b]) drawFeature(plan, f, y0, y1, mat, shade);
}

// Which layer's rock a cell would be if nothing had happened to it (what an eaten vein leaves behind).
export function baseAt(plan, x, y) {
  let k = 0;
  for (let q = STRATA.length - 1; q >= 1; q--) if (y >= plan.bnd[q][x]) { k = q; break; }
  return STRATA[k].mat;
}
export function layerAt(plan, x, y) {
  for (let q = STRATA.length - 1; q >= 1; q--) if (y >= plan.bnd[q][x]) return q;
  return 0;
}

const SOLIDISH = new Uint8Array(32);
for (const mt of [SOIL, ROOT, MOSS, STONE, CLAY, SAND, GRAVEL, LIME, GRANITE, GEODE, BASALT, RUIN, MANTLE, COAL]) SOLIDISH[mt] = 1;

function drawFeature(plan, f, y0, y1, mat, shade) {
  const lo = Math.max(y0, Math.floor(f.y0)), hi = Math.min(y1 - 1, Math.ceil(f.y1));
  if (lo > hi) return;
  const set = (x, y, mt, sh) => { if (x < 0 || x >= W || y < lo || y > hi) return; const i = y * W + x; mat[i] = mt; if (sh !== undefined) shade[i] = sh; };
  switch (f.t) {
    case 'blob': {
      for (let y = lo; y <= hi; y++) for (let x = Math.max(0, Math.floor(f.x - f.r * 1.4)); x <= Math.min(W - 1, Math.ceil(f.x + f.r * 1.4)); x++) {
        const e = Math.hypot(x - f.x, (y - f.y) * 1.15) / f.r + (vnoise(x * .3, y * .3, f.salt) - .5) * .5;
        const i = y * W + x;
        if (e < 1 && SOLIDISH[mat[i]]) { mat[i] = f.mat; shade[i] = (e > .8 ? 1 << 6 : 0) | Math.round(20 + 30 * (1 - e) + 8 * hash2(x, y, f.salt)); }
      }
      break;
    }
    case 'line': {
      const r = f.thick / 2, only = f.only;
      for (const [px, py] of f.pts) {
        if (py < lo - r - 1 || py > hi + r + 1) continue;
        for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
          if (x < 0 || x >= W || y < lo || y > hi) continue;
          if ((x + .5 - px) ** 2 + (y + .5 - py) ** 2 > r * r + .25) continue;
          const i = y * W + x;
          if (only ? !only.includes(mat[i]) : !SOLIDISH[mat[i]]) continue;
          mat[i] = f.mat; shade[i] = Math.round(30 + 30 * hash2(x, y, 77));
        }
      }
      break;
    }
    case 'cavern': {
      const inside = (x, y) => { const e = ((x - f.x) / f.rx) ** 2 + ((y - f.y) / f.ry) ** 2 + (vnoise(x * .11, y * .11, f.salt) - .5) * .7; return e < 1; };
      const level = f.fill ? f.y + f.level * f.ry : Infinity;
      for (let y = lo; y <= hi; y++) for (let x = Math.max(0, Math.floor(f.x - f.rx * 1.35)); x <= Math.min(W - 1, Math.ceil(f.x + f.rx * 1.35)); x++) {
        const i = y * W + x;
        if (mat[i] === ALLOY) continue;
        if (inside(x, y)) { mat[i] = y >= level ? f.fill : AIR; shade[i] = shade[i] & 63; }
        else if (f.crust && y > level - 3) { if (inside(x, y - 2) || inside(x - 2, y) || inside(x + 2, y) || inside(x, y + 2)) { mat[i] = OBSIDIAN; shade[i] = Math.round(18 + 20 * hash2(x, y, f.salt)); } }
        else if (f.style === 'grotto' && SOLIDISH[mat[i]] && (inside(x, y - 2) || inside(x - 2, y) || inside(x + 2, y) || inside(x, y + 2))) { mat[i] = MOSS; shade[i] = Math.round(20 + 40 * hash2(x, y, f.salt)); }
      }
      if (f.style === 'stal' || f.style === 'crystal') {
        // stalactites down from the ceiling and stalagmites up from the floor
        const mt = f.style === 'crystal' ? CRYSTAL : LIME;
        for (let x = Math.ceil(f.x - f.rx * 1.2); x <= f.x + f.rx * 1.2; x++) {
          if (x < 1 || x >= W - 1) continue;
          const hs = hash2(x, 3, f.salt);
          if (hs > .22) continue;
          let top = null, bottom = null;
          for (let y = Math.floor(f.y - f.ry * 1.4); y <= f.y + f.ry * 1.4; y++) if (inside(x, y) && !inside(x, y - 1)) { top = y; break; }
          for (let y = Math.ceil(f.y + f.ry * 1.4); y >= f.y - f.ry * 1.4; y--) if (inside(x, y) && !inside(x, y + 1)) { bottom = y; break; }
          if (top === null || bottom === null || bottom - top < 8) continue;
          const len = Math.min((bottom - top) * .45, 3 + hash2(x, 5, f.salt) * 11), w = 1 + hash2(x, 7, f.salt) * 1.6;
          const up = hs < .07 && (f.fill === undefined || bottom < f.y + f.level * f.ry);
          for (let q = 0; q < len; q++) {
            const hw = w * (1 - q / len);
            for (let dx = -Math.floor(hw); dx <= Math.floor(hw); dx++) {
              if (up) set(x + dx, bottom - q, mt, Math.round(26 + 24 * (1 - q / len)));
              else set(x + dx, top + q, mt, Math.round(26 + 24 * (1 - q / len)));
            }
          }
        }
      }
      break;
    }
    case 'river': {
      const level = f.y + f.level * f.thick / 2;
      for (let x = 0; x < W; x++) {
        const cy = f.y + Math.sin(x / f.per + f.ph) * f.amp + (vnoise1(x / 13, f.salt) - .5) * 5, hw = f.thick / 2 * (.8 + .4 * vnoise1(x / 7, f.salt + 1));
        for (let y = Math.max(lo, Math.floor(cy - hw)); y <= Math.min(hi, Math.ceil(cy + hw)); y++) {
          const i = y * W + x;
          if (mat[i] === ALLOY) continue;
          mat[i] = y >= level ? (f.fill || WATER) : AIR; shade[i] &= 63;
        }
      }
      break;
    }
    case 'shaft':
      for (let y = lo; y <= hi; y++) {
        const u = (y - f.y) / (f.h / 2);
        if (Math.abs(u) > 1) continue;
        const hw = f.w / 2 * Math.sqrt(1 - u * u * .7) * (.75 + .5 * vnoise(y * .15, 1, f.salt)), cx = f.x + (vnoise(y * .05, 2, f.salt) - .5) * 8;
        for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) if (x >= 0 && x < W && mat[y * W + x] !== ALLOY) { mat[y * W + x] = AIR; shade[y * W + x] &= 63; }
      }
      break;
    case 'gas':
      for (let y = lo; y <= hi; y++) for (let x = Math.max(0, Math.floor(f.x - f.r - 2)); x <= Math.min(W - 1, Math.ceil(f.x + f.r + 2)); x++) {
        const e = Math.hypot(x - f.x, y - f.y) / f.r + (vnoise(x * .35, y * .35, f.salt) - .5) * .6;
        if (e < 1 && mat[y * W + x] !== ALLOY) { mat[y * W + x] = GAS; shade[y * W + x] = Math.round(63 * hash2(x, y, f.salt)); }
      }
      break;
    case 'geode': {
      for (let y = lo; y <= hi; y++) for (let x = Math.max(0, Math.floor(f.x - f.r - 6)); x <= Math.min(W - 1, Math.ceil(f.x + f.r + 6)); x++) {
        const e = Math.hypot(x - f.x, y - f.y) / f.r + (vnoise(x * .2, y * .2, f.salt) - .5) * .12;
        const i = y * W + x;
        if (e < 1) { mat[i] = AIR; shade[i] = Math.round(10 + 20 * vnoise(x * .2, y * .2, f.salt + 3)); }
        else if (e < 1.14) { mat[i] = GEODE; shade[i] = (1 << 6) | Math.round(8 + 14 * hash2(x, y, f.salt)); }
      }
      for (const s of f.spikes) {
        const ca = Math.cos(s.a), sa = Math.sin(s.a), bx = f.x + ca * f.r * 1.02, by = f.y + sa * f.r * 1.02;
        for (let q = 0; q < s.len; q += .5) {
          const hw = s.w * (1 - q / s.len), px = bx - ca * q, py = by - sa * q;
          for (let t = -hw; t <= hw; t += .5) set(Math.round(px - sa * t), Math.round(py + ca * t), CRYSTAL, Math.round(30 + 30 * (1 - q / s.len)));
        }
      }
      break;
    }
    case 'rects':
      for (const [x0, ry0, x1, ry1, mt] of f.ops) for (let y = Math.max(lo, ry0); y <= Math.min(hi, ry1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const i = y * W + x;
        mat[i] = mt;
        shade[i] = mt === ALLOY ? ((x + y) % 9 === 0 ? 2 << 6 : 0) | Math.round(26 + 10 * hash2(x, y, 5)) : mt === AIR ? Math.round(10 + 10 * hash2(x >> 2, y >> 2, 6)) | 3 << 6 : shade[i];
      }
      break;
    case 'core':
      for (let y = lo; y <= hi; y++) for (let x = 0; x < W; x++) {
        const dd = Math.hypot(x - CORE_X, y - CORE_Y), i = y * W + x;
        if (dd < CORE_R) { mat[i] = CORE; shade[i] = Math.round(63 * (1 - dd / CORE_R)); }
        else if (dd < CORE_R + 16 && mat[i] === MANTLE) shade[i] = (3 << 6) | Math.round(63 * (1 - (dd - CORE_R) / 16));
      }
      break;
  }
}
