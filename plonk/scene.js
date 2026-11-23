// What you see from one spot on a road: skyline from the real terrain, plus everything near the road.
import { COUNTRIES, rng, hash, nearestTown, bearing } from './world.js';
import { makeWord } from './script.js';

export const PAL = {
  tundra:  { sky: ['#a9bcc6', '#bfccce', '#d3d8d2', '#e4e2d4'], ground: '#a3a081', ground2: '#b4ae8c', far: '#8d97a3', near: '#8f8f78', vis: 900, clouds: 5 },
  taiga:   { sky: ['#86aac2', '#a2bfcd', '#c2d3d6', '#dfe4d8'], ground: '#677f52', ground2: '#76905c', far: '#6f8399', near: '#3f5a46', vis: 650, clouds: 4, treeline: 1 },
  forest:  { sky: ['#7fb0d4', '#9fc3dc', '#c4dade', '#e6ecd9'], ground: '#7aa055', ground2: '#88ad5f', far: '#7790a8', near: '#4f7a45', vis: 650, clouds: 5, treeline: 0.8 },
  meadow:  { sky: ['#78aedb', '#9cc4e2', '#c6dce2', '#efeed6'], ground: '#9dbc5f', ground2: '#b1c96b', far: '#8098b0', near: '#7b9a52', vis: 900, clouds: 5 },
  fog:     { sky: ['#bcc4c2', '#c9cfcc', '#d4d8d3', '#dde0da'], ground: '#7c9873', ground2: '#88a27c', far: '#c4cac6', near: '#9aaa9a', vis: 95, clouds: 0, fog: 1 },
  steppe:  { sky: ['#8bbad8', '#a9cbe0', '#cfdfe0', '#f1e6c9'], ground: '#c3b177', ground2: '#cfbd84', far: '#98a3b3', near: '#a99d6c', vis: 1600, clouds: 3 },
  desert:  { sky: ['#6eaad6', '#8fbfe0', '#bdd8e2', '#f5e2bb'], ground: '#dfbe86', ground2: '#e8cb95', far: '#c39b78', near: '#d2a873', vis: 2600, clouds: 1 },
  savanna: { sky: ['#7fb6da', '#a0c8e0', '#cfdddc', '#f6e1ae'], ground: '#cbae62', ground2: '#d6bb6e', far: '#9aa0a2', near: '#a48d4f', vis: 1600, clouds: 3 },
  palms:   { sky: ['#5ea9d4', '#82bfdf', '#b6d9e0', '#eef0d0'], ground: '#68a55c', ground2: '#78b265', far: '#6f99a8', near: '#3f7a4c', vis: 750, clouds: 6, treeline: 0.6 },
  scrub:   { sky: ['#6eb1dc', '#92c4e2', '#c2dce0', '#f3ead0'], ground: '#b3ac6c', ground2: '#c0b878', far: '#8aa0b4', near: '#7e8653', vis: 1300, clouds: 2 },
  alpine:  { sky: ['#6a9fd0', '#8db8dc', '#bcd5e6', '#e4ecf0'], ground: '#9a9686', ground2: '#a9a595', far: '#7d8fa8', near: '#857f72', vis: 1500, clouds: 4 },
};
PAL.sea = PAL.meadow;

export const ROAD = ['#4a4d52', '#5e6262', '#77726a', '#56575c'];
const EYE = 1.6;
export const EXAG = 2.8;

export function makeScene(atlas, loc) {
  const { world, scripts } = atlas;
  const c = COUNTRIES[loc.country];
  const script = scripts[loc.country];
  const biome = world.biomeAt(loc.x, loc.y);
  const pal = PAL[biome] || PAL.meadow;
  const r0 = rng(loc.seed);
  const h0 = Math.max(0, world.heightAt(loc.x, loc.y));
  const dir = loc.dir; // degrees, the road's +u direction

  // how built-up it is here
  const [town, td] = nearestTown(world, loc.x, loc.y);
  const radius = town.capital ? 4.5 : 1.6 + town.size * 2;
  const s = td < radius ? 1 : td < radius * 3 ? 0.35 : 0.05;

  // --- skyline: three bands ray-cast over the heightmap
  const N = 360;
  const bands = [[0.12, 4], [4, 28], [28, 170]];
  const sky = bands.map(() => ({ ang: new Float32Array(N), kind: new Uint8Array(N), top: new Float32Array(N), dist: new Float32Array(N) }));
  const sinD = (a) => Math.sin(a * Math.PI / 180), cosD = (a) => Math.cos(a * Math.PI / 180);
  for (let a = 0; a < N; a++) {
    const dx = sinD(a), dy = -cosD(a);
    for (let b = 0; b < 3; b++) {
      const [d0, d1] = bands[b];
      let best = -1e9, kind = 0, top = 0, bd = 0;
      const steps = 46;
      for (let k = 0; k <= steps; k++) {
        const d = d0 * Math.pow(d1 / d0, k / steps);
        const h = world.heightAt(loc.x + dx * d, loc.y + dy * d);
        const curve = (d * d) / (2 * 6371) * 1000;
        const hh = Math.max(0, h);
        const ex = 1.4 + EXAG * Math.min(1, d / 25);
        const ang = (ex * (hh - h0) - curve * 0.6 - EYE) / (d * 1000);
        if (ang > best) { best = ang; kind = h <= 0 ? 1 : h > 2250 ? 2 : 0; top = h; bd = d; }
      }
      sky[b].ang[a] = best; sky[b].kind[a] = kind; sky[b].top[a] = top; sky[b].dist[a] = bd;
    }
  }
  // treeline bumps on the near band
  if (pal.treeline) {
    const tr = rng(loc.seed + 5);
    let v = 0;
    for (let a = 0; a < N; a++) { v = v * 0.55 + (tr() - 0.3) * 0.006 * pal.treeline; if (sky[0].kind[a] === 0) sky[0].ang[a] += Math.max(0, v) + 0.002 * pal.treeline; }
  }

  // sun and clouds
  const sunAz = 180 + (r0() - 0.5) * 100, sunEl = 0.35 + r0() * 0.25;
  const clouds = [];
  for (let i = 0; i < pal.clouds; i++) clouds.push({ az: r0() * 360, el: 0.06 + r0() * 0.28, w: 0.12 + r0() * 0.2, seed: (r0() * 1e9) | 0 });

  // --- road furniture
  const w = c.id === 2 && s < 0.3 ? 3.0 : 3.4;
  const sideOfDrive = c.drive === 'right' ? 1 : -1;
  const poleSide = r0() < 0.5 ? 1 : -1;
  const roadColor = ROAD[c.id];
  const segCache = new Map();
  const SEG = 20;

  const treeKinds = {
    tundra: [], taiga: ['pine', 'pine', 'pine', 'birch'], forest: ['oak', 'oak', 'birch', 'pine'], meadow: ['oak', 'poplar'],
    fog: ['cypress', 'cypress', 'oak'], steppe: ['shrub'], desert: ['shrub', 'rock'], savanna: ['acacia', 'acacia', 'shrub'],
    palms: ['palm', 'palm', 'broad'], scrub: ['olive', 'olive', 'cypress'], alpine: ['pine', 'rock', 'rock'],
  }[biome] || ['oak'];
  const treeDensity = { tundra: 0, taiga: 7, forest: 6, meadow: 1.2, fog: 2.5, steppe: 1, desert: 0.5, savanna: 1.3, palms: 4, scrub: 2.5, alpine: 1.5 }[biome] ?? 1;
  const rockDensity = { tundra: 2, alpine: 3, desert: 1.2, steppe: 0.4 }[biome] || 0;
  const fieldy = ['meadow', 'forest', 'steppe', 'savanna', 'fog', 'scrub'].includes(biome);

  function seg(k) {
    if (segCache.has(k)) return segCache.get(k);
    const r = rng(hash(loc.seed, k));
    const out = [];
    const u0 = k * SEG;
    const houses = [];
    for (const side of [-1, 1]) {
      const pH = s >= 1 ? 0.92 : s > 0.3 ? 0.4 : 0.04;
      if (r() < pH) {
        const wd = 7 + r() * 5, dp = 6 + r() * 3;
        const floors = s >= 1 && r() < 0.6 ? 2 : 1;
        const v = side * (w + 6 + dp / 2 + (s >= 1 ? r() * 2 : 4 + r() * 18));
        const hs = {
          t: 'house', u: u0 + SEG / 2 + (r() - 0.5) * 4, v, wd, dp, hh: floors * 2.9 + 0.3, floors,
          wall: c.walls[(r() * c.walls.length) | 0], roofC: c.roofColors[(r() * c.roofColors.length) | 0], style: c.roof,
          shop: s >= 1 && r() < 0.45 ? makeWord(r, 3 + ((r() * 3) | 0)) : null, shopC: ['#7a2e2a', '#24476b', '#2f5d3a', '#1f1f1f'][(r() * 4) | 0],
          tank: c.roof === 'flat' && r() < 0.4,
        };
        houses.push(hs); out.push(hs);
      }
    }
    const nT = treeDensity * (1 - Math.min(0.8, s * 0.8)) * (0.6 + r() * 0.8);
    for (let i = 0; i < nT * 2; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const v = side * (w + 4 + Math.pow(r(), 1.6) * 160), u = u0 + r() * SEG;
      if (houses.some((h) => Math.abs(h.u - u) < h.wd / 2 + 2 && Math.abs(h.v - v) < h.dp / 2 + 2)) continue;
      const kind = treeKinds[(r() * treeKinds.length) | 0];
      if (!kind) continue;
      out.push({ t: kind === 'rock' ? 'rock' : 'tree', kind, u, v, hgt: kind === 'rock' ? 0.5 + r() * 1.2 : 5 + r() * 7, seed: (r() * 1e9) | 0 });
    }
    for (let i = 0; i < rockDensity; i++) {
      if (r() > 0.6) continue;
      const side = r() < 0.5 ? -1 : 1;
      out.push({ t: 'rock', u: u0 + r() * SEG, v: side * (w + 3 + Math.pow(r(), 1.5) * 120), hgt: 0.4 + r() * 1.4, seed: (r() * 1e9) | 0 });
    }
    if (c.pole !== 'none' && k % 2 === 0) out.push({ t: 'pole', kind: c.pole, u: u0, v: poleSide * (w + 3.2), hgt: 8, k });
    if (c.pole === 'none' && s >= 1 && k % 2 === 0) out.push({ t: 'lamp', u: u0 + 5, v: -poleSide * (w + 1.4), hgt: 6 });
    if (s < 1 && c.bollard !== 'stone') {
      for (const side of [-1, 1]) out.push({ t: 'bollard', kind: c.bollard, u: u0 + (side > 0 ? 0 : 10), v: side * (w + 1.0) });
    }
    if (s < 1 && c.bollard === 'stone' && r() < 0.8) {
      const side = r() < 0.5 ? -1 : 1;
      out.push({ t: 'wall', u0, u1: u0 + SEG, v: side * (w + 1.6) });
    }
    if (fieldy && s < 1) {
      for (const side of [-1, 1]) {
        if (r() < 0.55) {
          const near = w + 5 + r() * 8, far = near + 25 + r() * 120;
          out.push({ t: 'field', u0: u0 - 2, u1: u0 + SEG + 2, v0: side * near, v1: side * far, color: r() < 0.5 ? pal.ground2 : shade(pal.ground, 0.93 + r() * 0.1), stripes: r() < 0.35 });
          if (r() < 0.5 && biome !== 'savanna') out.push({ t: 'fence', u0, u1: u0 + SEG, v: side * near });
        }
      }
    }
    segCache.set(k, out);
    return out;
  }

  // cars driving and parked
  const cars = [];
  const carCols = ['#c4412f', '#e8e1cf', '#2f5f8f', '#d9a43a', '#3c6b4a', '#4a4a4a', '#8f6ab0'];
  const nCars = (s >= 1 ? 3 : 1) + ((r0() * 2.5) | 0);
  for (let i = 0; i < nCars; i++) {
    const travel = r0() < 0.5 ? 1 : -1; // which way it goes along u
    const parked = s >= 0.35 && r0() < 0.5;
    const lane = travel * sideOfDrive; // right-hand traffic going +u sits at +v
    const v = parked ? lane * (w + 1.1) : lane * w * 0.5;
    let u = (r0() - 0.5) * 220;
    if (Math.abs(u) < 12) u += 18 * Math.sign(u || 1);
    cars.push({ t: 'car', u, v, face: travel, color: carCols[(r0() * carCols.length) | 0], plate: c.plate });
  }

  // signs: towns ahead in each direction, read from the real map
  const signs = [];
  const near = world.towns.map((t) => [t, Math.hypot(t.x - loc.x, t.y - loc.y)]).filter(([, d]) => d < 190 && d > 1).sort((a, b) => a[1] - b[1]);
  const dirTowns = (sgn) => near.filter(([t]) => { const b = bearing(t.x - loc.x, t.y - loc.y); let dd = ((b - (dir + (sgn < 0 ? 180 : 0))) % 360 + 540) % 360 - 180; return Math.abs(dd) < 65; }).slice(0, 2);
  const hasSigns = loc.signs ?? r0() < 0.62;
  if (hasSigns) {
    const us = loc.signAt ?? (r0() < 0.5 ? 1 : -1) * (35 + r0() * 90);
    for (const sgn of [1, -1]) {
      const list = dirTowns(sgn);
      if (!list.length) continue;
      // a sign for traffic heading `sgn`, on its own side of the road, facing it
      signs.push({ t: 'sign', u: us + sgn * -6, v: sgn * sideOfDrive * (w + 2.0), face: -sgn, rows: list.map(([t, d]) => ({ word: t.word, km: Math.max(1, Math.round(d)) })) });
    }
  }
  if (td < radius * 1.7) {
    const uS = (r0() < 0.5 ? 1 : -1) * (40 + r0() * 60);
    signs.push({ t: 'townsign', u: uS, v: sideOfDrive * (w + 1.8), word: town.word });
  }

  return {
    loc, c, script, biome, pal, h0, dir, w, s, town, td, sky, N, sunAz, sunEl, clouds,
    roadColor, seg, SEG, cars, signs, sideOfDrive, eye: EYE,
  };
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k) | 0, g = Math.min(255, ((n >> 8) & 255) * k) | 0, b = Math.min(255, (n & 255) * k) | 0;
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
