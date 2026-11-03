// Three areas. Geometry is hand-placed; the small stuff (graves, crates, pews) is scattered from a fixed seed
// so every visit looks the same.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mkPath(pts, closed, opts = {}) {
  const cum = [0];
  let L = 0;
  const m = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
    cum.push(L);
  }
  return { pts, closed, cum, L, postChance: opts.postChance ?? 0.4, postDur: opts.postDur ?? [2, 5], crowd: opts.crowd ?? 1, posts: [] };
}

// point and unit tangent at arc length s
export function pathAt(p, s) {
  if (p.closed) s = ((s % p.L) + p.L) % p.L;
  else s = Math.max(0, Math.min(p.L, s));
  let i = 0;
  while (i < p.cum.length - 2 && p.cum[i + 1] < s) i++;
  const a = p.pts[i], b = p.pts[(i + 1) % p.pts.length];
  const len = p.cum[i + 1] - p.cum[i] || 1;
  const u = (s - p.cum[i]) / len;
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, dx: (b[0] - a[0]) / len, dy: (b[1] - a[1]) / len };
}

export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let u = ((px - ax) * dx + (py - ay) * dy) / l2;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
}

export function pathSegs(paths) {
  const segs = [];
  for (const p of paths) {
    const m = p.closed ? p.pts.length : p.pts.length - 1;
    for (let i = 0; i < m; i++) {
      const a = p.pts[i], b = p.pts[(i + 1) % p.pts.length];
      segs.push([a[0], a[1], b[0], b[1]]);
    }
  }
  return segs;
}

function nearSeg(segs, x, y, d) {
  for (const s of segs) if (segDist(x, y, s[0], s[1], s[2], s[3]) < d) return true;
  return false;
}
function hitsRect(rects, x, y, pad) {
  for (const r of rects) if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return true;
  return false;
}
function hitsCirc(circs, x, y, pad) {
  for (const c of circs) if (Math.hypot(x - c.x, y - c.y) < c.r + pad) return true;
  return false;
}
function poly(cx, cy, r, n, a0 = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; out.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]); }
  return out;
}

function finish(L, seed) {
  const R = rng(seed);
  L.segs = pathSegs(L.paths);
  for (const p of L.paths) {
    let s = 40 + R() * 80;
    while (s < p.L - 30) { p.posts.push(s); s += 90 + R() * 130; }
  }
  return L;
}

function wallBox(W, H, t, gaps) {
  const walls = [];
  const side = (x, y, w, h) => walls.push({ x, y, w, h, sight: true, kind: 'wall' });
  side(0, 0, W, t); side(0, 0, t, H); side(W - t, 0, t, H);
  let x = 0;
  for (const [a, b] of gaps) { side(x, H - t, a - x, t); x = b; }
  side(x, H - t, W - x, t);
  return walls;
}

export function graveyard() {
  const W = 1400, H = 1100;
  const walls = wallBox(W, H, 24, [[640, 760]]);
  walls.push({ x: 560, y: 96, w: 280, h: 194, sight: true, kind: 'chapel' });
  for (const [x, y] of [[180, 160], [1110, 160], [200, 830], [1100, 830]]) walls.push({ x, y, w: 104, h: 84, sight: true, kind: 'tomb' });
  const circles = [[420, 690], [980, 690], [1000, 215], [400, 215]].map(([x, y]) => ({ x, y, r: 30, sight: true, kind: 'yew' }));
  const paths = [
    mkPath([[90, 330], [1310, 330], [1310, 1010], [90, 1010]], true, { crowd: 1.6 }),
    mkPath([[700, 330], [700, 1060]], false),
    mkPath([[90, 570], [1310, 570]], false, { crowd: 1.2 }),
    mkPath([[90, 450], [1310, 450]], false),
    mkPath([[90, 790], [1310, 790]], false),
    mkPath([[480, 330], [480, 60], [920, 60], [920, 330]], true, { crowd: 0.8 }),
    mkPath([[90, 330], [90, 110], [350, 110], [350, 330]], true, { crowd: 0.5 }),
    mkPath([[1310, 330], [1310, 110], [1050, 110], [1050, 330]], true, { crowd: 0.5 }),
  ];
  const L = {
    id: 'graveyard', name: 'The Graveyard', n: 'I', W, H, walls, circles, paths, smalls: [],
    crowd: 80, start: { x: 300, y: 570 }, hostStart: { x: 700, y: 1085 },
    gesture: { verb: 'Kneel', ing: 'kneeling', not: 'NOT KNEELING', alone: 'KNEELING ALONE', pose: 'kneel' },
    folk: 'the dead', habit: 'glance',
    host: { name: 'Sir Aldous Venn', epithet: 'a careful knight', speed: 30, half: 0.95, range: 250, torch: 220 },
    bell: { first: 14, every: [20, 28], dur: 4.2 },
    loop: 1,
    route: [[700, 1050], [700, 790, 2.5], [1210, 790], [1210, 450, 2.5], [920, 450], [920, 330], [920, 70], [480, 70, 2.5], [480, 330], [480, 450], [190, 450, 2.5], [190, 790], [400, 790], [400, 1010], [700, 1010]],
    lights: [],
    ambient: [176, 166, 150],
  };
  // gravestones in the blocks between paths
  const R = rng(11);
  L.segs = pathSegs(paths);
  for (let y = 60; y < H - 50; y += 38) {
    for (let x = 60; x < W - 50; x += 44) {
      const gx = x + (R() - 0.5) * 10, gy = y + (R() - 0.5) * 8;
      if (R() < 0.18) continue;
      if (nearSeg(L.segs, gx, gy, 30) || hitsRect(walls, gx, gy, 20) || hitsCirc(circles, gx, gy, 18)) continue;
      L.smalls.push({ x: gx, y: gy, w: 18, h: 9, rot: (R() - 0.5) * 0.25, kind: R() < 0.2 ? 'cross' : 'stone', v: R() });
    }
  }
  return finish(L, 21);
}

export function market() {
  const W = 1300, H = 1300, cx = 650, cy = 650;
  const walls = wallBox(W, H, 24, [[600, 700]]);
  const circles = [{ x: cx, y: cy, r: 66, sight: false, kind: 'fountain' }];
  // eight stalls in a ring, spokes pass between them
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) / 8 * Math.PI * 2;
    const sx = cx + Math.cos(a) * 335, sy = cy + Math.sin(a) * 335;
    walls.push({ x: Math.round(sx - 52), y: Math.round(sy - 30), w: 104, h: 60, sight: true, kind: 'stall', v: k });
  }
  for (const [x, y] of [[30, 30], [1210, 30], [30, 1210], [1210, 1210]]) walls.push({ x, y, w: 60, h: 60, sight: true, kind: 'house' });
  const paths = [
    mkPath(poly(cx, cy, 128, 16), true, { crowd: 1.2 }),
    mkPath(poly(cx, cy, 228, 20), true, { crowd: 1.4, postChance: 0.6, postDur: [3, 7] }),
    mkPath(poly(cx, cy, 440, 24), true, { crowd: 1.6, postChance: 0.6, postDur: [3, 7] }),
    mkPath([[80, 200], [200, 80], [1100, 80], [1220, 200], [1220, 1100], [1100, 1220], [200, 1220], [80, 1100]], true, { crowd: 1.1 }),
    mkPath([[cx, cy - 128], [cx, 50]], false, { crowd: 0.5 }),
    mkPath([[cx, cy + 128], [cx, 1270]], false, { crowd: 0.6 }),
    mkPath([[cx - 128, cy], [50, cy]], false, { crowd: 0.5 }),
    mkPath([[cx + 128, cy], [1250, cy]], false, { crowd: 0.5 }),
  ];
  const L = {
    id: 'market', name: 'The Market', n: 'II', W, H, walls, circles, paths, smalls: [],
    crowd: 84, start: { x: 650, y: 210 }, hostStart: { x: 650, y: 1290 },
    gesture: { verb: 'Bow', ing: 'bowing', not: 'NOT BOWING', alone: 'BOWING ALONE', pose: 'bow' },
    folk: 'the merchants', habit: 'impatient',
    host: { name: 'Mags of the Long Road', epithet: 'an impatient wanderer', speed: 35, half: 1.0, range: 250, torch: 220 },
    bell: { first: 12, every: [17, 24], dur: 4 },
    loop: 1,
    route: [],
    lights: [],
    ambient: [168, 158, 144],
  };
  // south spoke, round the outer ring past each stall, in to the inner ring, out the north and back down the west
  const ring = (r, a0, a1, n) => { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]); } return out; };
  const P = Math.PI;
  L.route = [[650, 1240], [650, 1090, 2],
    ...ring(440, P / 2, P * 2.5 - 0.01, 16).map((p, i) => i % 4 === 2 ? [...p, 2.2] : p),
    [650, 878, 1.5], ...ring(228, P / 2, -P * 2.5, 18).map((p, i) => i % 6 === 3 ? [...p, 2] : p),
    [650, 210, 2.5], [200, 120], [120, 650, 2], [200, 1180], [650, 1180]];
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) / 8 * Math.PI * 2;
    L.lights.push({ x: cx + Math.cos(a) * 290, y: cy + Math.sin(a) * 290, r: 120, i: 0.5 });
  }
  const R = rng(7);
  L.segs = pathSegs(paths);
  for (let i = 0; i < 260; i++) {
    const x = 50 + R() * (W - 100), y = 50 + R() * (H - 100);
    if (nearSeg(L.segs, x, y, 30) || hitsRect(walls, x, y, 14) || hitsCirc(circles, x, y, 20)) continue;
    if (hitsCirc(L.smalls.map(s => ({ x: s.x, y: s.y, r: 14 })), x, y, 4)) continue;
    L.smalls.push({ x, y, w: 14, h: 14, rot: R() * P, kind: R() < 0.5 ? 'barrel' : 'crate', v: R() });
  }
  return finish(L, 33);
}

export function choir() {
  const W = 900, H = 1500;
  const walls = wallBox(W, H, 28, [[400, 500]]);
  walls.push({ x: 360, y: 70, w: 180, h: 60, sight: true, kind: 'altar' });
  const circles = [];
  for (let y = 560; y <= 1200; y += 160) for (const x of [270, 630]) circles.push({ x, y, r: 26, sight: true, kind: 'pillar' });
  const paths = [
    mkPath([[450, 1460], [450, 250]], false, { crowd: 1.2 }),
    mkPath([[170, 250], [730, 250], [730, 1400], [170, 1400]], true, { crowd: 2 }),
    mkPath([[170, 480], [730, 480]], false, { crowd: 0.8 }),
    mkPath([[170, 1340], [730, 1340]], false, { crowd: 0.6 }),
    mkPath([[300, 300], [410, 300], [410, 440], [300, 440]], true, { crowd: 0.9, postChance: 0.8, postDur: [5, 10] }),
    mkPath([[490, 300], [600, 300], [600, 440], [490, 440]], true, { crowd: 0.9, postChance: 0.8, postDur: [5, 10] }),
  ];
  const L = {
    id: 'choir', name: 'The Choir', n: 'III', W, H, walls, circles, paths, smalls: [],
    crowd: 66, start: { x: 170, y: 900 }, hostStart: { x: 450, y: 1490 },
    gesture: { verb: 'Sing', ing: 'singing', not: 'NOT SINGING', alone: 'SINGING ALONE', pose: 'raise' },
    folk: 'the choir', habit: 'devout',
    host: { name: 'Brother Calder', epithet: 'a devout hunter', speed: 30, half: 0.95, range: 260, torch: 230 },
    bell: { first: 13, every: [19, 26], dur: 4.4 },
    loop: 1,
    route: [[450, 1440], [450, 1000, 2], [450, 500, 2.5], [450, 210, 3], [730, 250], [730, 820, 2], [730, 1400], [450, 1400, 2], [170, 1400], [170, 820, 2], [170, 250], [450, 210, 2.5], [450, 1000]],
    lights: [],
    ambient: [150, 142, 132],
  };
  for (const [x, y] of [[300, 100], [600, 100], [120, 600], [780, 600], [120, 1100], [780, 1100], [450, 160]]) L.lights.push({ x, y, r: 110, i: 0.55 });
  L.segs = pathSegs(paths);
  // pews either side of the centre aisle
  for (let y = 560; y <= 1290; y += 52) {
    if (Math.abs(y - 1340) < 30) continue;
    for (const [x, w] of [[312, 110], [478, 110]]) {
      if (nearSeg(L.segs.slice(0, 1), x + w / 2, y, 20)) continue;
      L.smalls.push({ x: x + w / 2, y, w, h: 18, rot: 0, kind: 'pew', v: 0 });
    }
  }
  return finish(L, 44);
}

export const LEVELS = [graveyard, market, choir];
