// The little solar system: planetoids carved into a cell grid, their gravity, and projectile flight.
// Everything here is pure enough for the CPU to run thousands of trial shots against it (live=false never carves).

export const CELL = 2;                 // world units per terrain cell
export const TROOP_R = 8;              // astronaut body radius
export const STRAY_T = 6;              // seconds of flight before a shell counts as "in orbit"
const G = 84;                          // surface gravity of an untouched planetoid ≈ G·π ≈ 264 u/s²

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const PALETTES = [
  { name: 'rust',  base: [214, 96, 52],  light: [247, 176, 102], dark: [96, 30, 40],  core: [255, 214, 92] },
  { name: 'lilac', base: [150, 108, 208], light: [216, 186, 246], dark: [56, 34, 104], core: [255, 120, 170] },
  { name: 'mint',  base: [64, 178, 150],  light: [160, 236, 206], dark: [20, 82, 86],  core: [255, 236, 120] },
  { name: 'sand',  base: [226, 178, 82],  light: [252, 228, 160], dark: [120, 72, 40], core: [255, 110, 70] },
  { name: 'rose',  base: [222, 96, 126],  light: [248, 180, 194], dark: [102, 32, 70], core: [255, 220, 110] },
  { name: 'slate', base: [120, 150, 188], light: [208, 228, 248], dark: [40, 56, 100], core: [140, 255, 220] },
];

export class World {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.gw = Math.ceil(W / CELL); this.gh = Math.ceil(H / CELL);
    this.cells = new Uint8Array(this.gw * this.gh);   // planet id + 1, 0 = space
    this.scorch = new Uint8Array(this.gw * this.gh);
    this.planets = [];
    this.wells = [];                                   // gravity mines: { x, y, mass, turns }
    this.dirty = null;                                 // cell rect the renderer must repaint
    this.vmax = 400 * Math.sqrt(Math.min(W, H) / 680);
  }

  solidAt(x, y) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) return false;
    return this.cells[j * this.gw + i] !== 0;
  }
  planetAt(x, y) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    if (i < 0 || j < 0 || i >= this.gw || j >= this.gh) return null;
    const c = this.cells[j * this.gw + i];
    return c ? this.planets[c - 1] : null;
  }

  // Gravity at a point. Inside a planetoid's radius the pull falls off linearly, so drills and tunnels behave.
  gravity(x, y, wells = true) {
    let gx = 0, gy = 0;
    for (const p of this.planets) {
      if (p.mass <= 0) continue;
      const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
      const s = d < p.r ? G * p.mass / (p.r * p.r * p.r) : G * p.mass / (d2 * d);
      gx += dx * s; gy += dy * s;
    }
    if (wells) for (const w of this.wells) {
      const dx = w.x - x, dy = w.y - y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1, soft = 14;
      const s = d < soft ? G * w.mass / (soft * soft * soft) : G * w.mass / (d2 * d);
      gx += dx * s; gy += dy * s;
    }
    return { x: gx, y: gy };
  }

  // Which way is up for someone standing here: away from the strongest planetary pull.
  up(x, y) {
    const g = this.gravity(x, y, false), m = Math.hypot(g.x, g.y) || 1;
    return { x: -g.x / m, y: -g.y / m };
  }

  // Outward surface normal near a point in rock: points toward the open cells around it.
  normalAt(x, y) {
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    let nx = 0, ny = 0;
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
      if (di * di + dj * dj > 10) continue;
      const i = ci + di, j = cj + dj;
      const solid = i >= 0 && j >= 0 && i < this.gw && j < this.gh && this.cells[j * this.gw + i] !== 0;
      if (!solid) { nx += di; ny += dj; }
    }
    const m = Math.hypot(nx, ny);
    if (m < 0.5) { const u = this.up(x, y); return u; }
    return { x: nx / m, y: ny / m };
  }

  carve(x, y, r, scorch = true) {
    const gw = this.gw, gh = this.gh, rr = r / CELL, sr = rr + 3.2;
    const ci = x / CELL, cj = y / CELL;
    const i0 = Math.max(0, Math.floor(ci - sr)), i1 = Math.min(gw - 1, Math.ceil(ci + sr));
    const j0 = Math.max(0, Math.floor(cj - sr)), j1 = Math.min(gh - 1, Math.ceil(cj + sr));
    if (i0 > i1 || j0 > j1) return 0;
    let removed = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = i + 0.5 - ci, dy = j + 0.5 - cj, d2 = dx * dx + dy * dy, k = j * gw + i;
      if (d2 <= rr * rr) {
        const c = this.cells[k];
        if (c) { this.planets[c - 1].mass -= CELL * CELL; this.cells[k] = 0; removed++; }
      } else if (scorch && d2 <= sr * sr && this.cells[k]) {
        const v = Math.round(255 * (1 - (Math.sqrt(d2) - rr) / (sr - rr)));
        if (v > this.scorch[k]) this.scorch[k] = v;
      }
    }
    this.markDirty(i0 - 1, j0 - 1, i1 + 1, j1 + 1);
    return removed;
  }

  markDirty(i0, j0, i1, j1) {
    const d = this.dirty;
    this.dirty = d ? [Math.min(d[0], i0), Math.min(d[1], j0), Math.max(d[2], i1), Math.max(d[3], j1)] : [i0, j0, i1, j1];
  }

  // Fill a lumpy disc of rock for planet p.
  fillPlanet(p, rand) {
    const gw = this.gw, a = rand() * 6.28, b = rand() * 6.28, c = rand() * 6.28;
    const ci = p.x / CELL, cj = p.y / CELL, rr = p.r / CELL * 1.1;
    for (let j = Math.max(0, Math.floor(cj - rr)); j <= Math.min(this.gh - 1, Math.ceil(cj + rr)); j++) {
      for (let i = Math.max(0, Math.floor(ci - rr)); i <= Math.min(gw - 1, Math.ceil(ci + rr)); i++) {
        const dx = (i + 0.5) * CELL - p.x, dy = (j + 0.5) * CELL - p.y, d = Math.hypot(dx, dy), t = Math.atan2(dy, dx);
        const edge = p.r * (1 + 0.035 * Math.sin(3 * t + a) + 0.025 * Math.sin(5 * t + b) + 0.012 * Math.sin(11 * t + c));
        if (d < edge) { this.cells[j * gw + i] = p.id + 1; p.mass += CELL * CELL; }
      }
    }
    // a few old craters bitten out of the rim, for character
    const n = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const t = rand() * 6.28, cr = p.r * (0.12 + rand() * 0.1);
      this.carve(p.x + Math.cos(t) * p.r * 1.0, p.y + Math.sin(t) * p.r * 1.0, cr, false);
    }
  }

  addPlanet(x, y, r, pal, rand) {
    const p = { id: this.planets.length, x, y, r, mass: 0, pal, seed: Math.floor(rand() * 1e9) };
    this.planets.push(p);
    this.fillPlanet(p, rand);
    p.mass0 = p.mass;
    return p;
  }
}

// Lay out 4–5 planetoids in a W×H field, sorted along its long axis so the teams can take opposite ends.
export function generate(W, H, seed) {
  const rand = rng(seed), w = new World(W, H), md = Math.min(W, H), horiz = W >= H;
  const want = W * H > 520000 ? 5 : 4;
  const gap = Math.max(54, md * 0.11);
  let best = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const ps = [];
    for (let tries = 0; tries < 500 && ps.length < want; tries++) {
      const r = md * (0.105 + rand() * 0.08);
      const x = r + 26 + rand() * (W - 2 * r - 52), y = r + 50 + rand() * (H - 2 * r - 100);
      if (ps.every(q => Math.hypot(q.x - x, q.y - y) > q.r + r + gap)) ps.push({ x, y, r });
    }
    if (!best || ps.length > best.length) best = ps;
    if (ps.length >= want) {
      // both ends of the long axis need a planetoid: the extremes must be well apart
      const ax = ps.map(p => horiz ? p.x : p.y), span = Math.max(...ax) - Math.min(...ax);
      if (span > (horiz ? W : H) * 0.55) { best = ps; break; }
    }
  }
  best.sort((a, b) => horiz ? a.x - b.x : a.y - b.y);
  const pals = PALETTES.slice().sort(() => rand() - 0.5);
  best.forEach((p, i) => w.addPlanet(p.x, p.y, p.r, pals[i % pals.length], rand));
  w.horiz = horiz;
  return w;
}

// ---- projectiles ---------------------------------------------------------------------------------
export const WEAPONS = {
  shell:   { name: 'Heavy Shell', short: 'Shell',   R: 30, dmg: 42, kb: 250, speed: 1.0,  r: 3 },
  grenade: { name: 'Bouncy Grenade', short: 'Grenade', R: 26, dmg: 36, kb: 230, speed: 0.9, r: 3, fuse: 3 },
  drill:   { name: 'Drill',       short: 'Drill',   R: 22, dmg: 34, kb: 200, speed: 0.95, r: 3, bore: 150 },
  mine:    { name: 'Gravity Mine', short: 'G-Mine', R: 28, dmg: 30, kb: 260, speed: 0.8,  r: 4, turns: 3 },
  jet:     { name: 'Jetpack',     short: 'Jetpack', speed: 0.75, r: TROOP_R },
};
export const WELL_MASS = 5600;

export function makeProj(kind, x, y, vx, vy, owner) {
  const W = WEAPONS[kind];
  return { kind, x, y, vx, vy, owner, t: 0, r: W.r, fuse: W.fuse || 0, rest: false, drilling: false, drilled: false, boreLeft: W.bore || 0, inside: 0, outside: 0, dx: 0, dy: 0, stray: false };
}

// Advance one projectile by dt. Returns null while it flies, or an event:
// { ev: 'boom', x, y } · { ev: 'stick', x, y } (mine) · { ev: 'land', x, y, speed } (jetpack) · { ev: 'lost' } · { ev: 'stray' } · { ev: 'bounce' } (keeps flying)
export function stepProj(world, p, dt, troops, live) {
  p.t += dt;
  if (p.kind === 'grenade' && p.t >= p.fuse) return { ev: 'boom', x: p.x, y: p.y };
  if (p.kind === 'drill' && p.drilling) {
    const sp = 230, step = sp * dt;
    p.x += p.dx * step; p.y += p.dy * step; p.boreLeft -= step;
    const solid = world.solidAt(p.x + p.dx * 4, p.y + p.dy * 4) || world.solidAt(p.x, p.y);
    if (live) world.carve(p.x, p.y, 7, true);
    const hit = hitTroop(p, troops);
    if (hit) return { ev: 'boom', x: p.x, y: p.y, troop: hit };
    if (solid) { p.inside += step; p.outside = 0; } else p.outside += step;
    if (p.boreLeft <= 0) return { ev: 'boom', x: p.x, y: p.y };
    if (p.inside > 10 && p.outside > 6) { p.drilling = false; p.drilled = true; p.vx = p.dx * sp * 0.85; p.vy = p.dy * sp * 0.85; }
    return null;
  }
  if (p.rest) return null;
  const g = world.gravity(p.x, p.y, true);
  p.vx += g.x * dt; p.vy += g.y * dt;
  const ox = p.x, oy = p.y, nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
  for (let s = 1; s <= 2; s++) {
    const x = ox + (nx - ox) * s / 2, y = oy + (ny - oy) * s / 2;
    // gravity mines go off when anything flies into them
    if (p.kind !== 'jet') for (const w of world.wells) if (w !== p.well && Math.hypot(w.x - x, w.y - y) < 11) return { ev: 'boom', x: w.x, y: w.y, well: w };
    if (p.kind !== 'grenade' && p.kind !== 'mine' && p.kind !== 'jet') {
      const hit = hitTroop({ x, y, r: p.r, t: p.t, owner: p.owner }, troops);
      if (hit) return { ev: 'boom', x, y, troop: hit };
    }
    if (world.solidAt(x, y)) {
      const px = ox + (nx - ox) * (s - 1) / 2, py = oy + (ny - oy) * (s - 1) / 2;
      switch (p.kind) {
        case 'shell': return { ev: 'boom', x, y };
        case 'drill':
          if (p.drilled) return { ev: 'boom', x, y };
          { const m = Math.hypot(p.vx, p.vy) || 1; p.dx = p.vx / m; p.dy = p.vy / m; }
          p.drilling = true; p.x = x; p.y = y; return null;
        case 'mine': return { ev: 'stick', x: px, y: py };
        case 'jet': return { ev: 'land', x: px, y: py, speed: Math.hypot(p.vx, p.vy) };
        case 'grenade': {
          const n = world.normalAt(x, y), vn = p.vx * n.x + p.vy * n.y;
          if (vn < 0) {
            const tx = p.vx - vn * n.x, ty = p.vy - vn * n.y;
            p.vx = tx * 0.8 - vn * n.x * 0.5; p.vy = ty * 0.8 - vn * n.y * 0.5;
          }
          p.x = px + n.x * 0.5; p.y = py + n.y * 0.5;
          if (Math.hypot(p.vx, p.vy) < 28) { p.rest = true; p.vx = p.vy = 0; }
          return { ev: 'bounce', x: px, y: py, speed: Math.abs(vn) };
        }
      }
    }
  }
  p.x = nx; p.y = ny;
  const M = 360;
  if (p.x < -M || p.y < -M || p.x > world.W + M || p.y > world.H + M) return { ev: 'lost' };
  if (!p.stray && p.t > STRAY_T && p.kind !== 'jet') return { ev: 'stray' };
  return null;
}

function hitTroop(p, troops) {
  for (const tr of troops) {
    if (tr.dead || tr.flying) continue;
    if (tr === p.owner && p.t < 0.3) continue;
    const d = Math.hypot(tr.x - p.x, tr.y - p.y);
    if (d < TROOP_R + p.r + 1) return tr;
  }
  return null;
}

// Where a shot from (x, y) with velocity (vx, vy) ends up, without changing anything. Used by the CPU and the aim preview.
export function simulate(world, kind, x, y, vx, vy, owner, troops, maxT = STRAY_T, path = null, pathT = 0) {
  const p = makeProj(kind, x, y, vx, vy, owner), dt = 1 / 120;
  while (p.t < maxT) {
    const e = stepProj(world, p, dt, troops, false);
    if (path && p.t <= pathT) path.push(p.x, p.y);
    if (e && e.ev !== 'bounce') return { ...e, t: p.t };
  }
  return { ev: 'stray', x: p.x, y: p.y, t: p.t };
}
